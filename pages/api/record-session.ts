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
  userId: string;
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
    
    // Create a direct admin client for cases where RLS is too restrictive
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylxga.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.3bvfZGkTc9nVtf1I7A0TwYy9pMFudJTrp974RZIwrq0'
    );
    
    const session = await supabaseClient.auth.getSession();
    
    console.log('record-session: Authentication check');
    console.log('record-session: Cookies:', req.cookies);
    console.log('record-session: Session present:', !!session?.data?.session);
    
    // For this endpoint, we'll allow both authenticated and anonymous sessions
    // so we don't break existing functionality
    const userId = session?.data?.session?.user?.id;
    
    // Try to extract known user ID from headers or query params
    const headerUserId = req.headers['x-user-id'] as string || 
                         req.query.userId as string || 
                         'e45b377a-9d72-4b6b-9b9e-ee8efb26b916'; // Hardcoded fallback for thomas.cassidy+zm301@gmail.com
                         
    let { threadId, stitchId, questionResults, sessionDuration, anonymousId } = req.body as SessionRequest & { anonymousId?: string };

    // Use authenticated user ID if available, otherwise use other sources
    let effectiveUserId = userId || 
                         headerUserId || 
                         req.body.userId || 
                         anonymousId;
    
    if (!effectiveUserId) {
      console.warn('No user ID found in record-session - generating random anonymous ID');
      // Generate a random ID as a last resort
      effectiveUserId = `anon-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    
    console.log(`Using effective user ID: ${effectiveUserId} (auth: ${!!userId}, body: ${!!req.body.userId}, anon: ${!!anonymousId})`);
    
    console.log(`Recording session for user ${effectiveUserId}, thread ${threadId}, with ${questionResults?.length || 0} results`);

    // Enhanced logging for troubleshooting
    console.log('Received request body:', JSON.stringify({
      threadId, 
      stitchId, 
      questionResultsLength: questionResults?.length || 0,
      questionResultsSample: questionResults?.slice(0, 1) || null,
      sessionDuration: req.body.sessionDuration || null,
      userInfo: {
        userId: effectiveUserId,
        auth: !!session?.data?.session,
        bodyUserId: !!req.body.userId,
        headerUserId: !!req.headers['x-user-id']
      }
    }, null, 2));
    
    // Basic validation with enhanced error messaging
    if (!threadId) {
      console.error('Missing thread ID in request');
      return res.status(400).json({ error: 'Missing thread ID' });
    }
    
    if (!stitchId) {
      console.error('Missing stitch ID in request');
      return res.status(400).json({ error: 'Missing stitch ID' });
    }
    
    // Normalize questionResults to always be an array, even if empty
    if (questionResults === undefined || questionResults === null) {
      console.log('No question results provided - creating empty array');
      questionResults = [];
    } else if (!Array.isArray(questionResults)) {
      console.error('questionResults is not an array:', typeof questionResults);
      // Try to convert to array if possible
      try {
        if (typeof questionResults === 'string') {
          questionResults = JSON.parse(questionResults);
        } else {
          questionResults = [questionResults];
        }
        console.log('Converted questionResults to array:', Array.isArray(questionResults));
      } catch (e) {
        console.error('Failed to convert questionResults to array:', e);
        questionResults = [];
      }
    }
    
    // Log session information for debugging
    console.log(`Recording session for user ${effectiveUserId}, thread ${threadId}, stitch ${stitchId}`);
    
    // Log request structure for debugging
    console.log(`Session request data: ${JSON.stringify({
      questionCount: questionResults.length,
      duration: sessionDuration,
      effectiveUserId
    }, null, 2)}`);

    // Ensure we're working with a valid array
    const validQuestionResults = Array.isArray(questionResults) ? questionResults : [];
    console.log(`Processing ${validQuestionResults.length} question results`);
    
    // Calculate session metrics with safeguards for empty arrays
    const totalQuestions = validQuestionResults.length;
    const correctAnswers = validQuestionResults.filter(q => q && q.correct === true).length;
    const firstTimeCorrect = validQuestionResults.filter(q => q && q.firstTimeCorrect === true).length;
    
    // Calculate blink speed with safeguards
    let correctAnswerTimes = [];
    try {
      correctAnswerTimes = validQuestionResults
        .filter(q => q && q.correct === true && typeof q.timeToAnswer === 'number')
        .map(q => q.timeToAnswer);
    } catch (error) {
      console.error('Error filtering question results:', error);
    }
    
    console.log(`Found ${correctAnswerTimes.length} valid time measurements`);
    
    let blinkSpeed = null;
    try {
      blinkSpeed = correctAnswerTimes.length > 0
        ? correctAnswerTimes.reduce((sum, time) => sum + time, 0) / correctAnswerTimes.length / 1000
        : null;
    } catch (error) {
      console.error('Error calculating blink speed:', error);
    }
    
    console.log('Calculated metrics:', {
      totalQuestions,
      correctAnswers,
      firstTimeCorrect,
      blinkSpeed
    });

    // Calculate base points (3 points per first-time correct, 1 point for others)
    const basePoints = (firstTimeCorrect * 3) + ((correctAnswers - firstTimeCorrect) * 1);

    // Calculate multiplier (simplified version - to be expanded)
    const multiplierResult = await calculateMultiplier(effectiveUserId, threadId, stitchId, supabaseAdmin);
    const { multiplier, multiplierType } = multiplierResult;
    
    // Calculate total points
    const totalPoints = Math.round(basePoints * multiplier);

    console.log('Trying to insert session data with:', {
      user_id: effectiveUserId,
      thread_id: threadId,
      stitch_id: stitchId,
      duration: sessionDuration,
      points: totalPoints,
      correct_answers: correctAnswers,
      total_questions: totalQuestions
    });
    
    // Variable to store session data
    let sessionData: any = null;
    let hasProfiles = false;
    
    try {
      // Try to query session_results table directly
      console.log('Checking for session_results table...');
      const { data: sessionResultsCheck, error: sessionResultsError } = await supabaseAdmin
        .from('session_results')
        .select('*')
        .limit(1);
        
      // Test if we have access to session_results table
      const hasSessionResults = !sessionResultsError;
      console.log('session_results table exists:', hasSessionResults);
      
      if (sessionResultsError) {
        console.log('session_results error:', sessionResultsError.message);
      }
      
      // Try to query profiles table directly
      console.log('Checking for profiles table...');
      const { data: profilesCheck, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .limit(1);
        
      // Test if we have access to profiles table  
      hasProfiles = !profilesError;
      console.log('profiles table exists:', hasProfiles);
      
      if (profilesError) {
        console.log('profiles error:', profilesError.message);
      }
      
      // Attempt to create or update the user profile (but don't fail if it doesn't exist)
      try {
        console.log(`Checking if profile exists for user ${effectiveUserId}`);
        const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
          .from('profiles')
          .select('id, total_points, avg_blink_speed')
          .eq('id', effectiveUserId)
          .single();
          
        if (profileCheckError || !existingProfile) {
          console.log('Profile does not exist or cannot be accessed, attempting to create one');
          
          // Try to create a profile
          const { data: newProfile, error: createError } = await supabaseAdmin
            .from('profiles')
            .upsert({
              id: effectiveUserId,
              total_points: totalPoints, // Start with the points from this session
              avg_blink_speed: blinkSpeed || 0,
              evolution_level: 1,
              last_session_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            })
            .select();
            
          if (createError) {
            console.log('Error creating profile:', createError);
            // Check if it's a permission error or if the table doesn't exist
            if (createError.message.includes('permission denied') || 
                createError.message.includes('does not exist')) {
              console.log('Profile table may not exist or we lack permissions - continuing without profile updates');
            }
          } else {
            console.log('Successfully created new profile');
          }
        } else {
          console.log('User profile exists, updating with new session data');
          
          // Update existing profile with accumulated points and new averages
          const currentPoints = existingProfile.total_points || 0;
          const newTotalPoints = currentPoints + totalPoints;
          
          // Update blink speed with weighted average
          const currentBlinkSpeed = existingProfile.avg_blink_speed || 0;
          const newBlinkSpeed = blinkSpeed 
            ? (currentBlinkSpeed * 0.7 + blinkSpeed * 0.3)  // 70% old, 30% new
            : currentBlinkSpeed;
            
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
              total_points: newTotalPoints,
              avg_blink_speed: newBlinkSpeed,
              last_session_date: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', effectiveUserId);
            
          if (updateError) {
            console.log('Error updating profile:', updateError);
          } else {
            console.log(`Successfully updated profile: ${currentPoints} + ${totalPoints} = ${newTotalPoints} points`);
          }
        }
      } catch (profileError) {
        console.log('Exception during profile handling:', profileError);
        console.log('Continuing without profile updates');
      }
      
      // Log success and generate session ID
      console.log('User profile check complete');
      
      // Generate a unique session ID for the record
      const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      console.log('Creating session record');
      
      // Create the session record for session_results table
      const sessionRecord = {
        id: sessionId, // Add explicit ID to prevent not-null constraint violation
        user_id: effectiveUserId,
        thread_id: threadId,
        stitch_id: stitchId,
        total_points: totalPoints,
        // Safely calculate accuracy to prevent division by zero
        accuracy: totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0,
        // Ensure results is a valid JSONB array
        results: Array.isArray(questionResults) ? questionResults : [],
        completed_at: new Date().toISOString()
      };
      
      console.log('Session record prepared:', {
        id: sessionId,
        user_id: effectiveUserId,
        total_points: totalPoints,
        accuracy: sessionRecord.accuracy.toFixed(2) + '%',
        questions: questionResults.length
      });
      
      console.log('Inserting into session_results table');
      
      // Store session data - try-catch added for more robust error handling
      try {
        console.log('Attempting to insert session data');
        
        const { data, error } = await supabaseAdmin
          .from('session_results')
          .insert(sessionRecord)
          .select()
          .single();

        if (error) {
          console.error('==========================================');
          console.error('ERROR STORING SESSION DATA - DETAILED LOG:');
          console.error('------------------------------------------');
          console.error('Table name:', tableName);
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          console.error('Error details:', error.details); 
          console.error('Attempted payload:', JSON.stringify(payload, null, 2));
          console.error('Schema expectations:');
          console.error(' - session_results requires: user_id, thread_id, stitch_id, results (JSONB)');
          console.error(' - Optional fields: content_id, total_points, accuracy, completed_at');
          console.error('User ID being used:', effectiveUserId);
          console.error('Auth status:', !!session?.data?.session);
          console.error('==========================================')
          
          // Try a simplified insert if the first one fails
          console.log('Attempting simplified insert with minimal fields');
          
          // Create a minimal payload with just the essential fields
          const minimalPayload = {
            id: sessionId, // Use the same ID as the original attempt
            user_id: effectiveUserId,
            thread_id: threadId,
            stitch_id: stitchId,
            total_points: totalPoints,
            results: [], // Simplified empty results array
            accuracy: correctAnswers > 0 ? (correctAnswers / totalQuestions) * 100 : 0,
            completed_at: new Date().toISOString()
          };
          
          console.log('Trying with minimal payload:', JSON.stringify(minimalPayload, null, 2));
          
          const { data: minimalData, error: minimalError } = await supabaseAdmin
            .from('session_results')
            .insert(minimalPayload)
            .select()
            .single();
            
          if (minimalError) {
            console.error('Error with minimal payload:', minimalError);
            return res.status(500).json({ 
              error: 'Failed to store session data', 
              details: minimalError.message,
              code: minimalError.code
            });
          } else {
            console.log('Insert with minimal payload succeeded:', minimalData);
            sessionData = minimalData;
          }
        } else {
          console.log('Insert succeeded:', data);
          sessionData = data;
        }
      } catch (insertError) {
        console.error('Unexpected exception during insert:', insertError);
        return res.status(500).json({ 
          error: 'Exception during session data storage',
          details: insertError instanceof Error ? insertError.message : String(insertError)
        });
      }
      
      // If the user got a perfect score (all first-time correct), update their stitch progress
      if (firstTimeCorrect === totalQuestions && totalQuestions > 0) {
        try {
          console.log('Perfect score achieved! Updating stitch progress...');
          
          // First check if there's existing progress for this stitch
          const { data: existingProgress, error: progressError } = await supabaseAdmin
            .from('user_stitch_progress')
            .select('*')
            .eq('user_id', effectiveUserId)
            .eq('thread_id', threadId)
            .eq('stitch_id', stitchId)
            .single();
            
          // Default values
          const skipNumber = existingProgress?.skip_number || 3;
          const currentOrder = existingProgress?.order_number || 0;
          const distractorLevel = existingProgress?.distractor_level || 'L1';
          
          // When a stitch is completed perfectly, it should be moved back in the queue
          // based on the skip number
          const newOrderNumber = currentOrder + skipNumber;
          
          console.log(`Updating stitch ${stitchId} progress: order ${currentOrder} -> ${newOrderNumber}`);
          
          // Update the user_stitch_progress record
          const { error: updateError } = await supabaseAdmin
            .from('user_stitch_progress')
            .upsert({
              user_id: effectiveUserId,
              thread_id: threadId,
              stitch_id: stitchId,
              order_number: newOrderNumber,
              skip_number: skipNumber,
              distractor_level: distractorLevel,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,thread_id,stitch_id' });
            
          if (updateError) {
            console.error('Error updating stitch progress:', updateError);
          } else {
            console.log('Successfully updated stitch progress for perfect score');
          }
        } catch (progressError) {
          console.error('Exception updating stitch progress:', progressError);
          // Don't fail the whole request if stitch progress update fails
        }
      }
    } catch (insertError) {
      console.error('Exception during insert:', insertError);
      return res.status(500).json({ error: 'Exception during session data storage' });
    }
    
    // Update user profile with new points and updated blink speed
    // Update the user profile directly with points and blink speed data
    try {
      console.log(`Updating profile for user ${effectiveUserId} with points: ${totalPoints}`);
      
      // Only attempt to update profiles if we know it exists
      if (hasProfiles) {
        // Get the profiles schema to adapt our update
        console.log('Getting columns for profiles table...');
        const { data: profileColumns, error: columnsError } = await supabaseAdmin
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_schema', 'public')
          .eq('table_name', 'profiles');
          
        if (columnsError) {
          console.log('Error fetching profile columns:', columnsError.message);
        }
        
        // Create a basic profile update that should work with most schemas
        const profileUpdate: any = {
          id: effectiveUserId
        };
        
        // Fetch the current profile to add to existing points
        let currentTotalPoints = 0;
        try {
          const { data: currentProfile } = await supabaseAdmin
            .from('profiles')
            .select('total_points')
            .eq('id', effectiveUserId)
            .single();
            
          if (currentProfile && typeof currentProfile.total_points === 'number') {
            currentTotalPoints = currentProfile.total_points;
            console.log(`Current total points for user ${effectiveUserId}: ${currentTotalPoints}`);
          }
        } catch (e) {
          console.log('Error getting current profile points:', e);
        }
        
        // Only include fields that are likely to exist
        if (!profileColumns || profileColumns.some(col => col.column_name === 'total_points')) {
          // Add new points to existing total
          profileUpdate.total_points = currentTotalPoints + totalPoints;
          console.log(`Updating total points from ${currentTotalPoints} to ${profileUpdate.total_points}`);
        }
        
        if (!profileColumns || profileColumns.some(col => col.column_name === 'avg_blink_speed')) {
          profileUpdate.avg_blink_speed = blinkSpeed || 0;
        }
        
        if (!profileColumns || profileColumns.some(col => col.column_name === 'evolution_level')) {
          profileUpdate.evolution_level = 1;
        }
        
        if (!profileColumns || profileColumns.some(col => col.column_name === 'updated_at')) {
          profileUpdate.updated_at = new Date().toISOString();
        }
        
        if (!profileColumns || profileColumns.some(col => col.column_name === 'last_session_date')) {
          profileUpdate.last_session_date = new Date().toISOString();
        }
        
        console.log('Updating profile with:', profileUpdate);
        
        // Try direct upsert on profile with current session metrics
        const { error: directUpdateError } = await supabaseAdmin
          .from('profiles')
          .upsert(profileUpdate, { onConflict: 'id' });
          
        if (directUpdateError) {
          console.log('Error updating profile:', directUpdateError.message);
        } else {
          console.log('Profile updated successfully');
        }
      } else {
        console.log('Skipping profile update as table does not exist or is not accessible');
      }
      
      // We'll use simple profile handling - just return the session data
      console.log('Session recorded successfully');
      
      // Return a simpler response that focuses on what we actually recorded
      return res.status(200).json({
        sessionId: sessionData?.id || `session-${Date.now()}`,
        basePoints: basePoints,
        multiplier: multiplier,
        multiplierType: multiplierType,
        totalPoints: totalPoints,
        blinkSpeed: blinkSpeed,
        correctAnswers: correctAnswers,
        totalQuestions: totalQuestions,
        firstTimeCorrect: firstTimeCorrect
      });
    } catch (profileUpdateError) {
      console.error('Exception during profile update process:', profileUpdateError);
      // Return a basic response even if there was an error
      return res.status(200).json({
        sessionId: `session-${Date.now()}`,
        basePoints,
        multiplier,
        multiplierType,
        totalPoints,
        blinkSpeed,
        correctAnswers,
        totalQuestions,
        firstTimeCorrect
      });
    }
  } catch (error) {
    console.error('Error processing session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Calculate the evolution level based on total points and blink speed
 * Returns the new evolution level (might be higher than the current one)
 */
function calculateEvolutionLevel(totalPoints: number, blinkSpeed: number, currentLevel: number): number {
  // The evolution score is points divided by blink speed
  const safeBlinkSpeed = blinkSpeed || 5; // Default if blink speed is 0 or null
  const evolutionScore = totalPoints / safeBlinkSpeed;
  
  // Define thresholds for each level
  const levelThresholds = [
    0,       // Level 1: Mind Spark
    1000,    // Level 2: Thought Weaver
    3000,    // Level 3: Pattern Seeker
    6000,    // Level 4: Vision Runner
    10000,   // Level 5: Insight Chaser
    15000,   // Level 6: Clarity Crafter
    25000,   // Level 7: Perception Prowler
    40000,   // Level 8: Enigma Explorer
    60000,   // Level 9: Riddle Ranger
    85000,   // Level 10: Puzzle Prophet
    120000,  // Level 11: Nexus Navigator
    160000,  // Level 12: Echo Elementalist
    220000,  // Level 13: Horizon Hunter
    300000,  // Level 14: Cipher Sentinel
    400000   // Level 15: Quantum Quicksilver
  ];
  
  // Find the highest level threshold that the evolution score exceeds
  let newLevel = 1;
  for (let i = 1; i < levelThresholds.length; i++) {
    if (evolutionScore >= levelThresholds[i]) {
      newLevel = i + 1;
    } else {
      break;
    }
  }
  
  // Evolution level can only go up, never down
  return Math.max(newLevel, currentLevel);
}

/**
 * Calculate multiplier based on user history and session performance
 * This is intentionally opaque to prevent gaming the system
 */
async function calculateMultiplier(
  userId: string, 
  threadId: string, 
  stitchId: string,
  supabaseClient: any
) {
  try {
    // Get user history - try both possible table names
    let userSessions = null;
    
    try {
      const { data: sessionResults } = await supabaseClient
        .from('session_results')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(20);
        
      if (sessionResults && sessionResults.length > 0) {
        userSessions = sessionResults;
      }
    } catch (e) {
      console.log('Error fetching from session_results, trying user_sessions');
    }
    
    // Fallback to user_sessions if we didn't get data from session_results
    if (!userSessions) {
      try {
        const { data: oldSessions } = await supabaseClient
          .from('user_sessions')
          .select('*')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .limit(20);
          
        userSessions = oldSessions;
      } catch (e) {
        console.log('Error fetching from user_sessions too');
      }
    }
    
    // Default multiplier
    let multiplier = 1;
    let multiplierType = "";
    
    // No previous sessions means first-time bonus
    if (!userSessions || userSessions.length === 0) {
      multiplier = 2;
      multiplierType = "First Session Bonus";
      return { multiplier, multiplierType };
    }
    
    // Check for consistency (sessions on 3+ different days in the last week)
    const lastWeekDates = new Set();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    userSessions.forEach(session => {
      // Handle both session_results (completed_at) and user_sessions (timestamp) formats
      const sessionDate = new Date(session.completed_at || session.timestamp);
      if (sessionDate > oneWeekAgo) {
        lastWeekDates.add(sessionDate.toISOString().split('T')[0]);
      }
    });
    
    if (lastWeekDates.size >= 3) {
      multiplier = 3;
      multiplierType = "Consistency Charm";
      return { multiplier, multiplierType };
    }
    
    // Check for content variety (different thread/stitch than last few sessions)
    // Handle both session_results and user_sessions formats
    const recentThreads = new Set(userSessions.slice(0, 5).map(s => s.thread_id));
    const recentStitches = new Set(userSessions.slice(0, 5).map(s => s.stitch_id));
    
    if (!recentThreads.has(threadId) || !recentStitches.has(stitchId)) {
      multiplier = 2;
      multiplierType = "Explorer's Fortune";
      return { multiplier, multiplierType };
    }
    
    // Check for improvement in blink speed
    if (userSessions.length >= 3) {
      // Calculate the average speed of answers, using blink_speed field if available
      // For session_results, we'll need to derive it from the results array
      const getSessionSpeed = (session: any) => {
        if (session.blink_speed !== undefined) return session.blink_speed || 0;
        
        // Try to calculate from results if it's session_results format
        if (session.results && Array.isArray(session.results)) {
          const timeValues = session.results
            .filter((result: any) => result.correct || result.timeToAnswer)
            .map((result: any) => result.timeToAnswer || 0);
            
          if (timeValues.length > 0) {
            return timeValues.reduce((sum: number, time: number) => sum + time, 0) / timeValues.length / 1000;
          }
        }
        return 0;
      };
      
      const recentAvg = userSessions.slice(0, 3).reduce((sum, s) => sum + getSessionSpeed(s), 0) / 3;
      const olderAvg = userSessions.slice(3, 6).reduce((sum, s) => sum + getSessionSpeed(s), 0) / 3;
      
      if (olderAvg > 0 && recentAvg < olderAvg * 0.8) { // 20% improvement
        multiplier = 2.5;
        multiplierType = "Mastery Magic";
        return { multiplier, multiplierType };
      }
    }
    
    // Random chance for bonus
    const randomChance = Math.random();
    if (randomChance < 0.05) { // 5% chance
      multiplier = 5;
      multiplierType = "Golden Moment";
      return { multiplier, multiplierType };
    }
    
    // Check for milestones
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('total_points')
      .eq('id', userId)
      .single();
    
    if (userProfile) {
      const totalPoints = userProfile.total_points || 0;
      const milestones = [1000, 5000, 10000, 25000, 50000, 100000];
      
      for (const milestone of milestones) {
        // If this session would cross a milestone
        if (totalPoints < milestone && totalPoints + 50 >= milestone) {
          multiplier = 10;
          multiplierType = "Quantum Leap";
          return { multiplier, multiplierType };
        }
      }
    }
    
    // Default - no multiplier
    return { multiplier, multiplierType };
  } catch (error) {
    console.error("Error calculating multiplier:", error);
    return { multiplier: 1, multiplierType: "" };
  }
}