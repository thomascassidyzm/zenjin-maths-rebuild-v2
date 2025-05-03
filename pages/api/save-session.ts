import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../lib/supabase/route';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Create a Supabase client with proper auth context
    const supabase = createRouteHandlerClient(req, res);
    
    // Get authenticated user
    const { data: { session } } = await supabase.auth.getSession();
    const authenticatedUserId = session?.user?.id;
    
    // Extract parameters from request body
    const { 
      userId = '00000000-0000-0000-0000-000000000000', // Use UUID format for anonymous
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

    // Support both new Triple-Helix format and legacy format
    const effectiveThreadId = threadId;
    const effectiveStitchId = stitchId;
    const effectiveUserId = userId;
    const effectiveScore = score !== undefined ? score : (results ? results.filter(r => r.correct).length : 0);
    const effectiveTotalQuestions = totalQuestions || (results ? results.length : 20);
    const effectivePoints = points !== undefined ? points : totalPoints;
    
    if (!effectiveThreadId || !effectiveStitchId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters (threadId, stitchId)' 
      });
    }

    // Security check: Allow diagnostic IDs to save sessions directly 
    // These start with 'diag-' and are used for testing
    const isDiagnosticUser = effectiveUserId.toString().startsWith('diag-');
    
    // For non-diagnostic users, ensure they can only save their own sessions
    if (!isDiagnosticUser && authenticatedUserId && effectiveUserId !== authenticatedUserId && effectiveUserId !== 'anonymous') {
      return res.status(403).json({
        success: false,
        error: 'You can only save your own session results'
      });
    }

    console.log(`API: Saving session for user ${effectiveUserId}: Thread ${effectiveThreadId}, Stitch ${effectiveStitchId}`);
    console.log(`API: Score: ${effectiveScore}/${effectiveTotalQuestions}, Points: ${effectivePoints}`);
    
    // Create a session ID
    const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Try saving to both tables for maximum compatibility
    let savedSuccessfully = false;
    
    // First try saving to modern session_results table
    try {
      // Convert string 'anonymous' to standard UUID if needed
      const effectiveUserIdUUID = 
        effectiveUserId === 'anonymous' 
        ? '00000000-0000-0000-0000-000000000000' 
        : effectiveUserId;
      
      console.log(`API: Using user ID: ${effectiveUserIdUUID} for session_results`);
      
      const { error } = await supabase
        .from('session_results')
        .insert({
          id: sessionId,
          thread_id: effectiveThreadId,
          stitch_id: effectiveStitchId,
          user_id: effectiveUserIdUUID,
          results: results || [],
          total_points: effectivePoints || 0,
          accuracy: accuracy || (effectiveTotalQuestions > 0 ? (effectiveScore / effectiveTotalQuestions) * 100 : 0),
          completed_at: completedAt || new Date().toISOString()
        });
      
      if (!error) {
        savedSuccessfully = true;
        console.log(`API: Session saved to session_results table`);
      } else {
        console.error('API: Error saving to session_results:', error);
        
        // Try with minimal fields if there's a column error
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          console.log('API: Column error detected, trying minimal insert for session_results');
          
          const { error: minimalError } = await supabase
            .from('session_results')
            .insert({
              id: sessionId,
              thread_id: effectiveThreadId,
              stitch_id: effectiveStitchId,
              user_id: effectiveUserIdUUID,
              results: results || [],
              total_points: effectivePoints || 0
            });
            
          if (!minimalError) {
            savedSuccessfully = true;
            console.log(`API: Session saved to session_results table with minimal fields`);
          } else {
            console.error('API: Even minimal insert failed for session_results:', minimalError);
          }
        }
      }
    } catch (err) {
      console.error('API: Error in session_results insert:', err);
    }
    
    // Also try saving to user_sessions table (Triple-Helix format)
    try {
      // Convert string 'anonymous' to standard UUID if needed
      const effectiveUserIdUUID = 
        effectiveUserId === 'anonymous' 
        ? '00000000-0000-0000-0000-000000000000' 
        : effectiveUserId;
      
      console.log(`API: Using user ID: ${effectiveUserIdUUID} for user_sessions`);
      
      const { error } = await supabase
        .from('user_sessions')
        .insert({
          session_id: sessionId,
          user_id: effectiveUserIdUUID,
          thread_id: effectiveThreadId,
          stitch_id: effectiveStitchId,
          score: effectiveScore,
          total_questions: effectiveTotalQuestions,
          points: effectivePoints || 0,
          completed_at: completedAt || new Date().toISOString()
        });
      
      if (!error) {
        savedSuccessfully = true;
        console.log(`API: Session saved to user_sessions table`);
      } else {
        console.error('API: Error saving to user_sessions:', error);
        
        // Try with minimal fields if there's a column error
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          console.log('API: Column error detected, trying minimal insert for user_sessions');
          
          const { error: minimalError } = await supabase
            .from('user_sessions')
            .insert({
              session_id: sessionId,
              user_id: effectiveUserIdUUID,
              thread_id: effectiveThreadId,
              stitch_id: effectiveStitchId,
              score: effectiveScore,
              total_questions: effectiveTotalQuestions
            });
            
          if (!minimalError) {
            savedSuccessfully = true;
            console.log(`API: Session saved to user_sessions table with minimal fields`);
          } else {
            console.error('API: Even minimal insert failed for user_sessions:', minimalError);
            
            // Try with legacy sessions table as a last resort
            try {
              const { error: legacyError } = await supabase
                .from('sessions')
                .insert({
                  session_id: sessionId,
                  user_id: effectiveUserIdUUID,
                  thread_id: effectiveThreadId,
                  stitch_id: effectiveStitchId,
                  score: effectiveScore,
                  total_questions: effectiveTotalQuestions
                });
                
              if (!legacyError) {
                savedSuccessfully = true;
                console.log(`API: Session saved to legacy sessions table`);
              } else {
                console.error('API: Error saving to legacy sessions table:', legacyError);
              }
            } catch (legacyErr) {
              console.error('API: Error in legacy sessions insert:', legacyErr);
            }
          }
        } else {
          // Try with legacy sessions table directly if not a column error
          try {
            console.log(`API: Using user ID: ${effectiveUserIdUUID} for legacy sessions`);
            const { error: legacyError } = await supabase
              .from('sessions')
              .insert({
                session_id: sessionId,
                user_id: effectiveUserIdUUID,
                thread_id: effectiveThreadId,
                stitch_id: effectiveStitchId,
                score: effectiveScore,
                total_questions: effectiveTotalQuestions
              });
              
            if (!legacyError) {
              savedSuccessfully = true;
              console.log(`API: Session saved to legacy sessions table`);
            } else {
              console.error('API: Error saving to legacy sessions table:', legacyError);
            }
          } catch (legacyErr) {
            console.error('API: Error in legacy sessions insert:', legacyErr);
          }
        }
      }
    } catch (err) {
      console.error('API: Error in user_sessions insert:', err);
    }
    
    if (!savedSuccessfully) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save session to any table' 
      });
    }
    
    // Check if we need to update stitch progress
    const isPerfectScore = effectiveScore === effectiveTotalQuestions;
    
    if (isPerfectScore) {
      console.log(`API: Perfect score! Updating stitch progress for ${effectiveStitchId}`);
      
      // Convert string 'anonymous' to standard UUID if needed
      const effectiveUserIdUUID = 
        effectiveUserId === 'anonymous' 
        ? '00000000-0000-0000-0000-000000000000' 
        : effectiveUserId;
        
      console.log(`API: Using user ID: ${effectiveUserIdUUID} for stitch progress`);
      
      // First, get current progress
      const { data: progressData, error: progressError } = await supabase
        .from('user_stitch_progress')
        .select('*')
        .eq('user_id', effectiveUserIdUUID)
        .eq('thread_id', effectiveThreadId)
        .eq('stitch_id', effectiveStitchId)
        .single();
        
      if (progressError && progressError.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('API: Error fetching progress:', progressError);
      } else {
        // Get current skip number
        const currentSkipNumber = progressData?.skip_number || 3;
        
        // Calculate new skip number
        let newSkipNumber = currentSkipNumber;
        if (currentSkipNumber === 1) newSkipNumber = 3;
        else if (currentSkipNumber === 3) newSkipNumber = 5;
        else if (currentSkipNumber === 5) newSkipNumber = 10;
        else if (currentSkipNumber === 10) newSkipNumber = 25;
        else if (currentSkipNumber === 25) newSkipNumber = 100;
        else newSkipNumber = 100; // Max value
        
        // Get distractor level
        const currentLevel = progressData?.distractor_level || 'L1';
        
        // Calculate new distractor level
        let newLevel = currentLevel;
        if (currentLevel === 'L1') newLevel = 'L2';
        else if (currentLevel === 'L2') newLevel = 'L3';
        // L3 is max level
        
        console.log(`API: Updating skip number: ${currentSkipNumber} → ${newSkipNumber}`);
        console.log(`API: Updating distractor level: ${currentLevel} → ${newLevel}`);
        
        // Update the progress
        try {
          const { error: updateError } = await supabase
            .from('user_stitch_progress')
            .update({
              skip_number: newSkipNumber,
              distractor_level: newLevel,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', effectiveUserIdUUID)
            .eq('thread_id', effectiveThreadId)
            .eq('stitch_id', effectiveStitchId);
            
          if (updateError) {
            console.error('API: Error updating progress:', updateError);
            
            // Try updating with minimal fields
            if (updateError.message.includes('column') && updateError.message.includes('does not exist')) {
              console.log('API: Column error detected, trying minimal update');
              
              await supabase
                .from('user_stitch_progress')
                .update({
                  skip_number: newSkipNumber
                })
                .eq('user_id', effectiveUserIdUUID)
                .eq('thread_id', effectiveThreadId)
                .eq('stitch_id', effectiveStitchId);
            }
          }
        } catch (updateErr) {
          console.error('API: Unexpected error updating progress:', updateErr);
        }
      }
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Session saved successfully',
      data: {
        sessionId,
        isPerfectScore
      }
    });
    
  } catch (err) {
    console.error('API: Unexpected error in save-session:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: err instanceof Error ? err.message : String(err)
    });
  }
}