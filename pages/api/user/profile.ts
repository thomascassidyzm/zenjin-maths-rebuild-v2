/**
 * User Profile Endpoint
 * 
 * Retrieves the authenticated user's profile information.
 */
import { createAuthHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { logApiError } from '../../../lib/api/logging';

export default createAuthHandler(
  async (req, res, userId, db) => {
    try {
      // Get user profile from database
      const { data: profile, error } = await db
        .from('profiles')
        .select(`
          id,
          display_name,
          total_points,
          avg_blink_speed,
          evolution_level,
          total_sessions,
          last_session_date,
          created_at,
          updated_at
        `)
        .eq('id', userId)
        .single();
      
      if (error) {
        logApiError('Profile Retrieval', error, userId);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
          errorResponse('Failed to retrieve user profile')
        );
      }
      
      if (!profile) {
        // No profile found - try to create a basic one
        const { error: createError } = await db
          .from('profiles')
          .insert({
            id: userId,
            display_name: '',
            total_points: 0,
            avg_blink_speed: 2.5,
            evolution_level: 1,
            total_sessions: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_session_date: new Date().toISOString()
          });
        
        if (createError) {
          logApiError('Profile Auto-Creation', createError, userId);
          return res.status(HTTP_STATUS.NOT_FOUND).json(
            errorResponse('User profile not found')
          );
        }
        
        // Return the basic profile we just created
        return res.status(HTTP_STATUS.OK).json(
          successResponse({
            profile: {
              id: userId,
              displayName: '',
              totalPoints: 0,
              avgBlinkSpeed: 2.5,
              evolutionLevel: 1,
              totalSessions: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastSessionDate: new Date().toISOString()
            }
          })
        );
      }
      
      // Transform database column names to camelCase for frontend
      return res.status(HTTP_STATUS.OK).json(
        successResponse({
          profile: {
            id: profile.id,
            displayName: profile.display_name,
            totalPoints: profile.total_points,
            avgBlinkSpeed: profile.avg_blink_speed,
            evolutionLevel: profile.evolution_level,
            totalSessions: profile.total_sessions,
            lastSessionDate: profile.last_session_date,
            createdAt: profile.created_at,
            updatedAt: profile.updated_at
          }
        })
      );
    } catch (error) {
      // Error is automatically logged by the handler wrapper
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('Profile service unavailable')
      );
    }
  },
  {
    methods: ['GET'],
    context: 'User/GetProfile'
  }
);