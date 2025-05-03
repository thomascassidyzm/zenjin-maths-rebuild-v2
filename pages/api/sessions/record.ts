/**
 * Record Session Endpoint
 * 
 * Saves a completed learning session to the database.
 * Works for both authenticated and anonymous users.
 */
import { createAnonymousHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { logApiInfo, logApiError } from '../../../lib/api/logging';

export default createAnonymousHandler(
  async (req, res, userId, db, isAuthenticated) => {
    // Extract parameters from request body
    const { 
      threadId, 
      stitchId, 
      score, 
      totalQuestions, 
      points,
      results,
      totalPoints,
      accuracy,
      completedAt
    } = req.body;

    // Validate required fields
    if (!threadId || !stitchId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('Thread ID and stitch ID are required')
      );
    }

    try {
      // Generate a unique session ID
      const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Normalize the input values
      const effectiveScore = score !== undefined ? score : (results ? results.filter(r => r.correct).length : 0);
      const effectiveTotalQuestions = totalQuestions || (results ? results.length : 0);
      const effectivePoints = points !== undefined ? points : totalPoints || 0;
      const effectiveAccuracy = accuracy || (effectiveTotalQuestions > 0 ? (effectiveScore / effectiveTotalQuestions) * 100 : 0);
      const effectiveCompletedAt = completedAt || new Date().toISOString();
      
      // Log session recording attempt
      logApiInfo('Sessions/Record', `Recording session for ${threadId}/${stitchId}`, userId, {
        score: effectiveScore,
        totalQuestions: effectiveTotalQuestions,
        points: effectivePoints
      });

      // Save to session_results table
      const { error: saveError } = await db
        .from('session_results')
        .insert({
          id: sessionId,
          thread_id: threadId,
          stitch_id: stitchId,
          user_id: userId,
          is_anonymous: !isAuthenticated,
          results: results || [],
          total_points: effectivePoints,
          accuracy: effectiveAccuracy,
          completed_at: effectiveCompletedAt
        });

      if (saveError) {
        // Try with minimal fields if column error
        if (saveError.message.includes('column') && saveError.message.includes('does not exist')) {
          logApiInfo('Sessions/Record', 'Column error, trying minimal fields', userId);
          
          const { error: minimalError } = await db
            .from('session_results')
            .insert({
              id: sessionId,
              thread_id: threadId,
              stitch_id: stitchId,
              user_id: userId,
              is_anonymous: !isAuthenticated,
              results: results || [],
              total_points: effectivePoints
            });
            
          if (minimalError) {
            logApiError('Sessions/Record', minimalError, userId);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
              errorResponse('Failed to save session results')
            );
          }
        } else {
          logApiError('Sessions/Record', saveError, userId);
          return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            errorResponse('Failed to save session results')
          );
        }
      }

      // Check if perfect score to update progress
      const isPerfectScore = effectiveScore === effectiveTotalQuestions && effectiveTotalQuestions > 0;
      
      if (isPerfectScore) {
        await updateProgressForPerfectScore(db, userId, threadId, stitchId);
      }

      // Update user profile with points
      await updateUserProfile(db, userId, effectivePoints);
      
      return res.status(HTTP_STATUS.OK).json(
        successResponse({
          sessionId,
          isPerfectScore
        }, 'Session recorded successfully')
      );
    } catch (error) {
      // Error is logged by the handler
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('Failed to record session')
      );
    }
  },
  {
    methods: ['POST'],
    context: 'Sessions/Record'
  }
);

/**
 * Update stitch progress when user gets a perfect score
 */
async function updateProgressForPerfectScore(db, userId, threadId, stitchId) {
  try {
    // Get current progress
    const { data: progressData, error: progressError } = await db
      .from('user_stitch_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('thread_id', threadId)
      .eq('stitch_id', stitchId)
      .single();
      
    if (progressError && progressError.code !== 'PGRST116') { // PGRST116 = no rows
      logApiError('Progress/PerfectScore/Fetch', progressError, userId);
      return;
    }
    
    // Current values
    const currentSkipNumber = progressData?.skip_number || 3;
    const currentLevel = progressData?.distractor_level || 'L1';
    
    // Calculate new skip number
    let newSkipNumber = currentSkipNumber;
    if (currentSkipNumber === 1) newSkipNumber = 3;
    else if (currentSkipNumber === 3) newSkipNumber = 5;
    else if (currentSkipNumber === 5) newSkipNumber = 10;
    else if (currentSkipNumber === 10) newSkipNumber = 25;
    else if (currentSkipNumber === 25) newSkipNumber = 100;
    else newSkipNumber = 100; // Max value
    
    // Calculate new distractor level
    let newLevel = currentLevel;
    if (currentLevel === 'L1') newLevel = 'L2';
    else if (currentLevel === 'L2') newLevel = 'L3';
    // L3 is max level
    
    logApiInfo('Progress/PerfectScore/Update', 
      `Updating skip: ${currentSkipNumber}→${newSkipNumber}, level: ${currentLevel}→${newLevel}`, 
      userId
    );
    
    // Update the progress
    const { error: updateError } = await db
      .from('user_stitch_progress')
      .update({
        skip_number: newSkipNumber,
        distractor_level: newLevel,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('thread_id', threadId)
      .eq('stitch_id', stitchId);
      
    if (updateError) {
      // Try updating with minimal fields if column error
      if (updateError.message.includes('column') && updateError.message.includes('does not exist')) {
        const { error: minimalError } = await db
          .from('user_stitch_progress')
          .update({
            skip_number: newSkipNumber
          })
          .eq('user_id', userId)
          .eq('thread_id', threadId)
          .eq('stitch_id', stitchId);
          
        if (minimalError) {
          logApiError('Progress/PerfectScore/MinimalUpdate', minimalError, userId);
        }
      } else {
        logApiError('Progress/PerfectScore/Update', updateError, userId);
      }
    }
  } catch (error) {
    logApiError('Progress/PerfectScore', error, userId);
  }
}

/**
 * Update the user's profile with accumulated points
 */
async function updateUserProfile(db, userId, points) {
  try {
    // Get the current profile
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('total_points, total_sessions')
      .eq('id', userId)
      .single();
      
    if (profileError && profileError.code !== 'PGRST116') {
      logApiError('Profile/Update/Fetch', profileError, userId);
      return;
    }
    
    // If profile exists, update it; otherwise, create it
    if (profile) {
      const totalPoints = (profile.total_points || 0) + points;
      const totalSessions = (profile.total_sessions || 0) + 1;
      
      const { error: updateError } = await db
        .from('profiles')
        .update({
          total_points: totalPoints,
          total_sessions: totalSessions,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
        
      if (updateError) {
        logApiError('Profile/Update', updateError, userId);
      }
    } else {
      // Create a minimal profile
      const { error: createError } = await db
        .from('profiles')
        .insert({
          id: userId,
          total_points: points,
          total_sessions: 1,
          avg_blink_speed: 2.5,
          evolution_level: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (createError) {
        logApiError('Profile/Create', createError, userId);
      }
    }
  } catch (error) {
    logApiError('Profile/Update', error, userId);
  }
}