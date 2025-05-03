import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../lib/supabase/route';
import { createClient } from '@supabase/supabase-js';

interface QuestionResult {
  questionId: string;
  correct: boolean;
  timeToAnswer: number; // in milliseconds
  firstTimeCorrect: boolean;
}

interface SessionRequest {
  userId?: string;
  threadId: string;
  stitchId: string;
  questionResults: QuestionResult[];
  sessionDuration: number; // in seconds
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create a Supabase client with proper auth context
    const supabaseClient = createRouteHandlerClient(req, res);
    
    // Create a direct admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylxga.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.3bvfZGkTc9nVtf1I7A0TwYy9pMFudJTrp974RZIwrq0'
    );
    
    const session = await supabaseClient.auth.getSession();
    
    console.log('record-session: Authentication check');
    console.log('record-session: Session present:', !!session?.data?.session);
    
    // Extract request parameters
    // Extract data from request, using 'let' for questionResults since we might modify it
    const { 
      threadId, 
      stitchId, 
      sessionDuration = 0,
      userId: requestUserId
    } = req.body as SessionRequest;
    
    // Extract questionResults with let since we might need to modify it
    let questionResults = req.body.questionResults || [];
    
    // Get authenticated user ID with fallbacks
    const hardcodedUserID = 'e45b377a-9d72-4b6b-9b9e-ee8efb26b916'; // Known user fallback
    
    // Select user ID from various sources in priority order
    let effectiveUserId = session?.data?.session?.user?.id || 
                          requestUserId || 
                          req.headers['x-user-id'] as string || 
                          hardcodedUserID;
    
    // Generate a random ID as last resort
    if (!effectiveUserId) {
      console.warn('No user ID found in record-session - generating random anonymous ID');
      effectiveUserId = `anon-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    
    console.log(`Using effective user ID: ${effectiveUserId}`);
    
    // Basic validation - less strict to handle manual session ending
    if (!threadId || !stitchId) {
      return res.status(400).json({ error: 'Missing thread or stitch ID' });
    }
    
    // Log enhanced debugging info about the request
    console.log('Request data:', {
      threadId,
      stitchId,
      questionResultsLength: Array.isArray(questionResults) ? questionResults.length : 'not an array',
      userId: effectiveUserId
    });
    
    console.log(`Recording session for user ${effectiveUserId}, thread ${threadId}, stitch ${stitchId}`);
    console.log(`Session has ${questionResults.length} question results and lasted ${sessionDuration} seconds`);

    // Ensure questionResults is a valid array before processing
    if (!Array.isArray(questionResults)) {
      console.warn('questionResults is not an array, converting to empty array');
      questionResults = [];
    }

    // Calculate session metrics with safety checks
    const totalQuestions = questionResults.length;
    const correctAnswers = questionResults.filter(q => q && q.correct === true).length;
    const firstTimeCorrect = questionResults.filter(q => q && q.firstTimeCorrect === true).length;
    
    // Calculate blink speed with safety checks (average time for correct answers, in seconds)
    const correctAnswerTimes = questionResults
      .filter(q => q && q.correct === true && typeof q.timeToAnswer === 'number')
      .map(q => q.timeToAnswer);
    
    console.log(`Found ${correctAnswerTimes.length} valid time measurements for blink speed calculation`);
    
    const blinkSpeed = correctAnswerTimes.length > 0
      ? correctAnswerTimes.reduce((sum, time) => sum + (time || 0), 0) / correctAnswerTimes.length / 1000
      : null;

    // Calculate base points (3 points per first-time correct, 1 point for others)
    const basePoints = (firstTimeCorrect * 3) + ((correctAnswers - firstTimeCorrect) * 1);

    // Calculate multiplier
    const { multiplier, multiplierType } = await calculateMultiplier(
      effectiveUserId, 
      threadId, 
      stitchId, 
      supabaseAdmin
    );
    
    // Calculate total points
    const totalPoints = Math.round(basePoints * multiplier);

    console.log('Session metrics:', {
      totalQuestions,
      correctAnswers,
      firstTimeCorrect,
      blinkSpeed: blinkSpeed ? `${blinkSpeed.toFixed(2)}s` : 'N/A',
      basePoints,
      multiplier,
      multiplierType,
      totalPoints
    });

    // Generate a unique session ID
    const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create a properly formatted session_results record
    const sessionRecord = {
      id: sessionId,
      user_id: effectiveUserId,
      thread_id: threadId,
      stitch_id: stitchId,
      results: questionResults,
      total_points: totalPoints,
      accuracy: totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0,
      completed_at: new Date().toISOString()
    };
    
    console.log('Saving to session_results with:', sessionRecord);
    
    // Save to session_results table
    try {
      const { data: sessionData, error: sessionError } = await supabaseAdmin
        .from('session_results')
        .insert(sessionRecord)
        .select();
      
      if (sessionError) {
        console.error('Error saving to session_results:', sessionError);
        
        // Try with minimal fields if there's a problem
        const minimalRecord = {
          id: sessionId,
          user_id: effectiveUserId,
          thread_id: threadId,
          stitch_id: stitchId,
          results: [],
          total_points: totalPoints,
          accuracy: totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0,
          completed_at: new Date().toISOString()
        };
        
        console.log('Trying minimal record:', minimalRecord);
        
        const { data: minimalData, error: minimalError } = await supabaseAdmin
          .from('session_results')
          .insert(minimalRecord)
          .select();
          
        if (minimalError) {
          console.error('Error with minimal record:', minimalError);
          return res.status(500).json({ 
            error: 'Failed to store session data', 
            details: minimalError.message 
          });
        }
        
        console.log('Saved with minimal record');
      } else {
        console.log('Successfully saved to session_results');
      }
    } catch (error) {
      console.error('Exception saving to session_results:', error);
      return res.status(500).json({ 
        error: 'Exception during session storage',
        details: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Update user_stitch_progress if this was a perfect score
    if (firstTimeCorrect === totalQuestions && totalQuestions > 0) {
      try {
        console.log('Perfect score achieved! Updating stitch progress...');
        
        // First get current stitch progress to find skip number
        const { data: currentProgress, error: progressError } = await supabaseAdmin
          .from('user_stitch_progress')
          .select('skip_number, order_number, distractor_level')
          .eq('user_id', effectiveUserId)
          .eq('thread_id', threadId)
          .eq('stitch_id', stitchId)
          .single();
        
        // Default values if we can't find existing progress
        const skipNumber = currentProgress?.skip_number || 3;
        const currentOrder = currentProgress?.order_number || 0;
        const distractorLevel = currentProgress?.distractor_level || 'L1';
        
        // Prepare progress update
        const progressUpdate = {
          user_id: effectiveUserId,
          thread_id: threadId,
          stitch_id: stitchId,
          // When completed perfectly, stitch moves to end of queue
          order_number: currentOrder + skipNumber,
          skip_number: skipNumber,
          distractor_level: distractorLevel,
          updated_at: new Date().toISOString()
        };
        
        console.log('Updating user_stitch_progress with:', progressUpdate);
        
        const { error: updateError } = await supabaseAdmin
          .from('user_stitch_progress')
          .upsert(progressUpdate, { onConflict: 'user_id,thread_id,stitch_id' });
          
        if (updateError) {
          console.error('Error updating stitch progress:', updateError);
        } else {
          console.log('Successfully updated stitch progress');
        }
      } catch (error) {
        console.error('Exception updating stitch progress:', error);
        // Don't fail the request if stitch progress update fails
      }
    }
    
    // Return session results
    return res.status(200).json({
      sessionId,
      basePoints,
      multiplier,
      multiplierType,
      totalPoints,
      blinkSpeed,
      correctAnswers,
      totalQuestions,
      firstTimeCorrect
    });
  } catch (error) {
    console.error('Error processing session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Calculate multiplier based on user history and session performance
 */
async function calculateMultiplier(
  userId: string, 
  threadId: string, 
  stitchId: string,
  supabaseClient: any
) {
  try {
    // Get recent sessions
    const { data: recentSessions } = await supabaseClient
      .from('session_results')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(10);
    
    // Default multiplier
    let multiplier = 1;
    let multiplierType = "Standard";
    
    // No previous sessions means first-time bonus
    if (!recentSessions || recentSessions.length === 0) {
      multiplier = 2;
      multiplierType = "First Session Bonus";
      return { multiplier, multiplierType };
    }
    
    // Check for consistency (sessions on consecutive days)
    const lastWeekDates = new Set();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    recentSessions.forEach(session => {
      const sessionDate = new Date(session.completed_at);
      if (sessionDate > oneWeekAgo) {
        lastWeekDates.add(sessionDate.toISOString().split('T')[0]);
      }
    });
    
    if (lastWeekDates.size >= 3) {
      multiplier = 3;
      multiplierType = "Consistency Charm";
      return { multiplier, multiplierType };
    }
    
    // Check for content variety
    const recentThreads = new Set(recentSessions.slice(0, 3).map(s => s.thread_id));
    const recentStitches = new Set(recentSessions.slice(0, 3).map(s => s.stitch_id));
    
    if (!recentThreads.has(threadId) || !recentStitches.has(stitchId)) {
      multiplier = 2;
      multiplierType = "Explorer's Fortune";
      return { multiplier, multiplierType };
    }
    
    // Random chance for bonus
    const randomChance = Math.random();
    if (randomChance < 0.05) { // 5% chance
      multiplier = 5;
      multiplierType = "Golden Moment";
      return { multiplier, multiplierType };
    }
    
    // Default - no multiplier
    return { multiplier, multiplierType };
  } catch (error) {
    console.error("Error calculating multiplier:", error);
    return { multiplier: 1, multiplierType: "Standard" };
  }
}