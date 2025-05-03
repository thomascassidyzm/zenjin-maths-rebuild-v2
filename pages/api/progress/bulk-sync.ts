/**
 * Bulk Synchronization Endpoint
 * 
 * Synchronizes multiple progress records and sessions at once.
 * This is especially useful for offline-to-online transitions.
 */
import { createAnonymousHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { logApiInfo, logApiError } from '../../../lib/api/logging';

// Define types for request data
interface ProgressRecord {
  threadId: string;
  stitchId: string;
  orderNumber: number;
  skipNumber?: number;
  distractorLevel?: string;
}

interface SessionRecord {
  threadId: string;
  stitchId: string;
  score: number;
  totalQuestions: number;
  points?: number;
  results?: any[];
  completedAt?: string;
}

export default createAnonymousHandler(
  async (req, res, userId, db, isAuthenticated) => {
    // Extract data from request body
    const { progress = [], sessions = [] } = req.body;

    // Validate input
    if (!Array.isArray(progress) && !Array.isArray(sessions)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('Progress and sessions must be arrays')
      );
    }

    if (progress.length === 0 && sessions.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('At least one progress record or session record is required')
      );
    }

    try {
      // Process results
      const results = {
        progress: { success: 0, failed: 0, errors: [] },
        sessions: { success: 0, failed: 0, errors: [] }
      };

      // Log sync attempt
      logApiInfo('Progress/BulkSync', 
        `Syncing ${progress.length} progress records and ${sessions.length} sessions`, 
        userId
      );

      // Process progress records
      if (progress.length > 0) {
        for (const record of progress) {
          const { threadId, stitchId, orderNumber, skipNumber, distractorLevel } = record;
          
          // Validate required fields
          if (!threadId || !stitchId || orderNumber === undefined) {
            results.progress.failed++;
            results.progress.errors.push({ 
              record, 
              error: 'Missing required fields' 
            });
            continue;
          }
          
          // Perform upsert
          const { error } = await db
            .from('user_stitch_progress')
            .upsert({
              user_id: userId,
              thread_id: threadId,
              stitch_id: stitchId,
              order_number: orderNumber,
              skip_number: skipNumber || 3,
              distractor_level: distractorLevel || 'L1',
              is_anonymous: !isAuthenticated,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,thread_id,stitch_id',
              ignoreDuplicates: false
            });
          
          if (error) {
            results.progress.failed++;
            results.progress.errors.push({ 
              threadId, 
              stitchId, 
              error: error.message 
            });
            logApiError('Progress/BulkSync/ProgressRecord', error, userId, {
              threadId,
              stitchId
            });
          } else {
            results.progress.success++;
          }
        }
      }

      // Process session records
      if (sessions.length > 0) {
        for (const session of sessions) {
          const { 
            threadId, 
            stitchId, 
            score, 
            totalQuestions, 
            points = 0, 
            results = [], 
            completedAt 
          } = session;
          
          // Validate required fields
          if (!threadId || !stitchId || score === undefined || totalQuestions === undefined) {
            results.sessions.failed++;
            results.sessions.errors.push({ 
              session, 
              error: 'Missing required fields' 
            });
            continue;
          }
          
          // Generate a session ID
          const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          
          // Calculate accuracy
          const accuracy = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
          
          // Save the session
          const { error } = await db
            .from('session_results')
            .insert({
              id: sessionId,
              thread_id: threadId,
              stitch_id: stitchId,
              user_id: userId,
              is_anonymous: !isAuthenticated,
              results: results,
              total_points: points,
              accuracy: accuracy,
              completed_at: completedAt || new Date().toISOString()
            });
          
          if (error) {
            results.sessions.failed++;
            results.sessions.errors.push({ 
              threadId, 
              stitchId, 
              error: error.message 
            });
            logApiError('Progress/BulkSync/SessionRecord', error, userId, {
              threadId,
              stitchId
            });
          } else {
            results.sessions.success++;
          }
        }
      }

      // Update user profile with accumulated points
      const totalPoints = sessions.reduce((sum, session) => sum + (session.points || 0), 0);
      if (totalPoints > 0) {
        await updateUserProfile(db, userId, totalPoints, sessions.length);
      }

      return res.status(HTTP_STATUS.OK).json(
        successResponse({
          results
        }, 'Bulk synchronization completed')
      );
    } catch (error) {
      // Error is logged by the handler
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('Failed to process bulk synchronization')
      );
    }
  },
  {
    methods: ['POST'],
    context: 'Progress/BulkSync'
  }
);

/**
 * Update the user's profile with accumulated points and sessions
 */
async function updateUserProfile(db, userId, points, sessionCount) {
  try {
    // Get the current profile
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('total_points, total_sessions')
      .eq('id', userId)
      .single();
      
    if (profileError && profileError.code !== 'PGRST116') {
      logApiError('BulkSync/ProfileUpdate/Fetch', profileError, userId);
      return;
    }
    
    // If profile exists, update it; otherwise, create it
    if (profile) {
      const totalPoints = (profile.total_points || 0) + points;
      const totalSessions = (profile.total_sessions || 0) + sessionCount;
      
      const { error: updateError } = await db
        .from('profiles')
        .update({
          total_points: totalPoints,
          total_sessions: totalSessions,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
        
      if (updateError) {
        logApiError('BulkSync/ProfileUpdate', updateError, userId);
      }
    } else {
      // Create a minimal profile
      const { error: createError } = await db
        .from('profiles')
        .insert({
          id: userId,
          total_points: points,
          total_sessions: sessionCount,
          avg_blink_speed: 2.5,
          evolution_level: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (createError) {
        logApiError('BulkSync/ProfileCreate', createError, userId);
      }
    }
  } catch (error) {
    logApiError('BulkSync/ProfileUpdate', error, userId);
  }
}