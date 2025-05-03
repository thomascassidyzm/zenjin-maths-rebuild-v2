/**
 * Create User Profile Endpoint
 * 
 * Creates or updates a user profile after successful authentication,
 * optionally migrating data from an anonymous session.
 */
import { createAuthHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { logApiInfo, logApiError } from '../../../lib/api/logging';
import { initializeUserState } from '../../../lib/initialization/initialize-user-state';

export default createAuthHandler(
  async (req, res, userId, db) => {
    // Get profile information from request
    const { displayName = '', anonymousId = null } = req.body;
    
    try {
      console.log(`Creating/updating profile for user ID: ${userId}`);
      
      // Check if the user ID is valid
      if (!userId || userId.length < 5) {
        console.error(`Invalid user ID: ${userId}`);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          errorResponse('Invalid user ID')
        );
      }
      
      // Double-check user exists in auth.users
      const { data: authUser, error: authError } = await db.auth.admin.getUserById(userId);
      
      if (authError || !authUser) {
        console.error(`User not found in auth.users: ${userId}`, authError);
        // Continue anyway - the user might exist but the admin API failed
      } else {
        console.log(`User verified in auth.users: ${userId}, email: ${authUser.email}`);
      }
      
      // Check if profile already exists - with better error handling
      let existingProfile;
      try {
        const { data, error } = await db
          .from('profiles')
          .select('id, display_name, total_points, total_sessions')
          .eq('id', userId)
          .single();
          
        existingProfile = data;
        
        // Only log real errors, not "no rows found"
        if (error && !error.message.includes('No rows found')) {
          logApiError('Profile Check', error, userId);
          console.error(`Error checking profile: ${error.message}`);
        }
      } catch (checkError) {
        console.error(`Exception checking profile: ${checkError}`);
        // Continue with profile creation even if check fails
      }
      
      if (existingProfile) {
        console.log(`Updating existing profile for ${userId}`);
        // Update existing profile
        try {
          const { error: updateError } = await db
            .from('profiles')
            .update({
              display_name: displayName || existingProfile.display_name,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);
          
          if (updateError) {
            logApiError('Profile Update', updateError, userId);
            console.error(`Error updating profile: ${updateError.message}`);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
              errorResponse('Failed to update profile')
            );
          }
          
          // Log successful update
          logApiInfo('Auth/UpdateProfile', 'Profile updated', userId);
          
          // If anonymous ID provided, migrate anonymous progress
          if (anonymousId) {
            await migrateAnonymousProgress(db, anonymousId, userId);
          }
          
          // Profile already exists and was updated if needed
          return res.status(HTTP_STATUS.OK).json(
            successResponse({}, 'Profile updated')
          );
        } catch (updateException) {
          console.error(`Exception updating profile: ${updateException}`);
          return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            errorResponse('Exception updating profile')
          );
        }
      }
      
      // Create new profile
      console.log(`Creating new profile for ${userId}`);
      try {
        const profileData = {
          id: userId,
          display_name: displayName || 'New User',
          total_points: 0,
          avg_blink_speed: 2.5,
          evolution_level: 1,
          total_sessions: 0,
          last_session_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        console.log(`Inserting profile data:`, profileData);
        
        const { error: createError } = await db
          .from('profiles')
          .insert(profileData);
        
        if (createError) {
          logApiError('Profile Creation', createError, userId);
          console.error(`Error creating profile: ${createError.message}`);
          
          // Check if it's a duplicate key error - profile might exist despite our check
          if (createError.message.includes('duplicate key') || createError.code === '23505') {
            console.log(`Profile already exists (concurrent creation). Returning success anyway.`);
            return res.status(HTTP_STATUS.OK).json(
              successResponse({}, 'Profile already exists')
            );
          }
          
          return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            errorResponse('Failed to create profile: ' + createError.message)
          );
        }
        
        // Log successful creation
        logApiInfo('Auth/CreateProfile', 'Profile created', userId);
        
        // NEW: Initialize user state with default setup
        try {
          console.log('Initializing user state with default values...');
          await initializeUserState(userId, 'free');
          console.log('User state initialized successfully');
        } catch (stateError) {
          console.error('Error initializing user state:', stateError);
          // Continue anyway - the profile was created successfully
          logApiError('User State Initialization', stateError, userId);
          // This is non-critical, so we don't fail the whole request
        }
        
        // If anonymous ID provided, migrate anonymous progress
        if (anonymousId) {
          await migrateAnonymousProgress(db, anonymousId, userId);
        }
        
        return res.status(HTTP_STATUS.CREATED).json(
          successResponse({}, 'Profile created successfully')
        );
      } catch (createException) {
        console.error(`Exception creating profile: ${createException}`);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
          errorResponse('Exception creating profile: ' + (createException.message || createException))
        );
      }
    } catch (error) {
      // Add detailed logging despite handler wrapper
      console.error(`Top level error in create-profile: ${error}`);
      logApiError('Profile Creation', error, userId);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('Profile service unavailable: ' + (error.message || error))
      );
    }
  },
  {
    methods: ['POST'],
    context: 'Auth/CreateProfile'
  }
);

/**
 * Migrate progress from anonymous user to authenticated user
 */
async function migrateAnonymousProgress(db, anonymousId, userId) {
  try {
    // 1. Migrate session results
    const { error: sessionError } = await db.from('session_results')
      .update({ user_id: userId, is_anonymous: false })
      .eq('user_id', anonymousId);
    
    if (sessionError) {
      logApiError('Session Migration', sessionError, userId, { anonymousId });
    }
    
    // 2. Migrate stitch progress
    const { error: stitchError } = await db.from('user_stitch_progress')
      .update({ user_id: userId, is_anonymous: false })
      .eq('user_id', anonymousId);
    
    if (stitchError) {
      logApiError('Stitch Progress Migration', stitchError, userId, { anonymousId });
    }
    
    // 3. Update profile with accumulated points from anonymous sessions
    const { data: sessions, error: pointsError } = await db
      .from('session_results')
      .select('total_points')
      .eq('user_id', userId);
    
    if (pointsError) {
      logApiError('Points Migration', pointsError, userId, { anonymousId });
      return;
    }
    
    if (sessions && sessions.length > 0) {
      const totalPoints = sessions.reduce(
        (sum, session) => sum + (session.total_points || 0), 
        0
      );
      
      const { error: profileError } = await db.from('profiles')
        .update({ 
          total_points: totalPoints,
          total_sessions: sessions.length,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (profileError) {
        logApiError('Profile Points Update', profileError, userId, { anonymousId });
      } else {
        logApiInfo('Anonymous Migration', 
          `Migrated ${sessions.length} sessions and ${totalPoints} points from anonymous ID`, 
          userId, 
          { anonymousId, sessions: sessions.length, points: totalPoints }
        );
      }
    }
    
    // 4. Migrate any user state data from anonymous to authenticated user
    try {
      const { data: anonymousState, error: stateError } = await db
        .from('user_state')
        .select('state')
        .eq('user_id', anonymousId)
        .order('last_updated', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (stateError) {
        logApiError('User State Migration', stateError, userId, { anonymousId });
      } else if (anonymousState && anonymousState.state) {
        // Update the user ID in the state
        const updatedState = {
          ...anonymousState.state,
          userId
        };
        
        // Save the migrated state
        const { error: updateError } = await db
          .from('user_state')
          .upsert({
            user_id: userId,
            state: updatedState,
            last_updated: new Date().toISOString(),
            created_at: new Date().toISOString()
          });
          
        if (updateError) {
          logApiError('User State Update', updateError, userId, { anonymousId });
        } else {
          logApiInfo('User State Migration', 'Migrated anonymous state to authenticated user', userId, { anonymousId });
        }
      }
    } catch (stateError) {
      logApiError('User State Migration Exception', stateError, userId, { anonymousId });
    }
  } catch (error) {
    // Log but don't fail the overall operation
    logApiError('Anonymous Migration Exception', error, userId, { anonymousId });
  }
}