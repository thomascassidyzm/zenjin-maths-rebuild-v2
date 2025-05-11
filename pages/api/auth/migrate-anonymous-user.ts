/**
 * Migrate Anonymous User API Endpoint
 * 
 * Updates all user data from an anonymous user to an authenticated user.
 * Rather than copying data, this simply updates the user_id in all tables,
 * treating the anonymous user record as the same user that's now authenticated.
 */
import { createAuthHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { logApiInfo, logApiError } from '../../../lib/api/logging';

export default createAuthHandler(
  async (req, res, userId, db) => {
    // Get information from request
    const { anonymousId } = req.body;
    
    if (!anonymousId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('Anonymous ID is required')
      );
    }
    
    try {
      console.log(`Migrating anonymous user ${anonymousId} to authenticated user ${userId}`);
      
      // Check if the anonymous ID exists in the user_state table
      const { data: anonymousState, error: stateCheckError } = await db
        .from('user_state')
        .select('id')
        .eq('user_id', anonymousId)
        .limit(1);
        
      if (stateCheckError) {
        console.error(`Error checking anonymous state: ${stateCheckError.message}`);
      }
      
      if (!anonymousState || anonymousState.length === 0) {
        console.log(`No state found for anonymous ID ${anonymousId}`);
        // If no anonymous state, it's not critical - we'll just continue and update any data if found
      }
      
      // Perform migrations in a transaction to ensure consistency
      const { error: transactionError } = await db.rpc('begin_transaction');
      if (transactionError) {
        console.error(`Transaction start error: ${transactionError.message}`);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
          errorResponse('Failed to start transaction')
        );
      }
      
      try {
        // 1. Migrate all user_state records
        const { error: stateError } = await db
          .from('user_state')
          .update({ 
            user_id: userId,
            // Update the state JSON to include the new user ID
            state: db.raw(`jsonb_set(state, '{userId}', '"${userId}"')`)
          })
          .eq('user_id', anonymousId);
          
        if (stateError) {
          logApiError('User State Migration', stateError, userId, { anonymousId });
          throw stateError;
        }
        
        // 2. Migrate session results
        const { error: sessionError } = await db
          .from('session_results')
          .update({ user_id: userId, is_anonymous: false })
          .eq('user_id', anonymousId);
        
        if (sessionError) {
          logApiError('Session Migration', sessionError, userId, { anonymousId });
          throw sessionError;
        }
        
        // 3. Migrate stitch progress
        const { error: stitchError } = await db
          .from('user_stitch_progress')
          .update({ user_id: userId, is_anonymous: false })
          .eq('user_id', anonymousId);
        
        if (stitchError) {
          logApiError('Stitch Progress Migration', stitchError, userId, { anonymousId });
          throw stitchError;
        }
        
        // 4. Migrate stitch positions
        const { error: positionError } = await db
          .from('user_stitch_positions')
          .update({ user_id: userId })
          .eq('user_id', anonymousId);
          
        if (positionError) {
          logApiError('Stitch Positions Migration', positionError, userId, { anonymousId });
          throw positionError;
        }
        
        // 5. Update or create profile with accumulated points from sessions
        // First, check if profile exists
        const { data: profile, error: profileCheckError } = await db
          .from('profiles')
          .select('id, total_points, total_sessions')
          .eq('id', userId)
          .single();
          
        if (profileCheckError && !profileCheckError.message.includes('No rows found')) {
          logApiError('Profile Check', profileCheckError, userId, { anonymousId });
          throw profileCheckError;
        }
        
        // Calculate total points from all sessions (both previous anonymous and any new ones)
        const { data: sessions, error: sessionsError } = await db
          .from('session_results')
          .select('total_points')
          .eq('user_id', userId);
          
        if (sessionsError) {
          logApiError('Sessions Check', sessionsError, userId, { anonymousId });
          throw sessionsError;
        }
        
        const totalPoints = sessions ? sessions.reduce(
          (sum, session) => sum + (session.total_points || 0), 
          0
        ) : 0;
        
        const totalSessions = sessions ? sessions.length : 0;
        
        // If profile exists, update it
        if (profile) {
          const { error: profileUpdateError } = await db
            .from('profiles')
            .update({
              total_points: totalPoints,
              total_sessions: totalSessions,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);
            
          if (profileUpdateError) {
            logApiError('Profile Update', profileUpdateError, userId, { anonymousId });
            throw profileUpdateError;
          }
        } 
        // If profile doesn't exist, create it
        else {
          const { error: profileCreateError } = await db
            .from('profiles')
            .insert({
              id: userId,
              display_name: 'New User',
              total_points: totalPoints,
              avg_blink_speed: 2.5,
              evolution_level: 1,
              total_sessions: totalSessions,
              last_session_date: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            
          if (profileCreateError) {
            logApiError('Profile Creation', profileCreateError, userId, { anonymousId });
            throw profileCreateError;
          }
        }
        
        // Commit the transaction
        const { error: commitError } = await db.rpc('commit_transaction');
        if (commitError) {
          console.error(`Transaction commit error: ${commitError.message}`);
          throw commitError;
        }
        
        // Log success
        logApiInfo('Anonymous User Migration', 
          `Migrated anonymous user ${anonymousId} to authenticated user ${userId}`, 
          userId, 
          { 
            anonymousId, 
            sessions: totalSessions, 
            points: totalPoints 
          }
        );
        
        return res.status(HTTP_STATUS.OK).json(
          successResponse({
            totalSessions,
            totalPoints
          }, 'Anonymous user migrated successfully')
        );
      } catch (migrationError) {
        // Rollback on error
        await db.rpc('rollback_transaction').catch(rollbackError => {
          console.error(`Rollback error: ${rollbackError.message}`);
        });
        
        throw migrationError;
      }
    } catch (error) {
      console.error(`Error migrating anonymous user: ${error}`);
      logApiError('Anonymous User Migration', error, userId, { anonymousId });
      
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('Failed to migrate anonymous user: ' + (error.message || error))
      );
    }
  },
  {
    methods: ['POST'],
    context: 'Auth/MigrateAnonymousUser'
  }
);