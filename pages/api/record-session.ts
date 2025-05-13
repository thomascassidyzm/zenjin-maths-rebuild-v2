/**
 * EMERGENCY BYPASS VERSION (2025-05-06):
 * 
 * This is a simplified version of the record-session endpoint
 * that stores session data locally without requiring database access.
 * 
 * It ensures sessions can be recorded even when database operations fail.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../lib/supabase/route';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

interface QuestionResult {
  questionId: string;
  correct: boolean;
  timeToAnswer: number; // in milliseconds
  firstTimeCorrect: boolean;
}

interface SessionRequest {
  userId: string;
  threadId?: string;  // Make threadId optional
  tubeId?: number;    // Add tubeId as an option
  stitchId: string;
  questionResults: QuestionResult[];
  sessionDuration: number; // in seconds
}

// Save to localStorage-cache directory for future use
const saveToCache = (userId: string, fileType: string, data: any) => {
  try {
    // Create cache directory if it doesn't exist
    const cacheDir = path.join(process.cwd(), 'localStorage-cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    const filePath = path.join(cacheDir, `${fileType}_${userId}.json`);
    
    // If it's a session, append to existing sessions array
    if (fileType === 'user_sessions') {
      let existingSessions = [];
      try {
        if (fs.existsSync(filePath)) {
          const existingData = fs.readFileSync(filePath, 'utf8');
          existingSessions = JSON.parse(existingData);
        }
      } catch (error) {
        console.error(`Error reading existing ${fileType} from cache:`, error);
      }
      
      // Add new session to the beginning of the array
      existingSessions = [data, ...existingSessions].slice(0, 50); // Keep only the 50 most recent
      fs.writeFileSync(filePath, JSON.stringify(existingSessions, null, 2));
    } else {
      // For other data types, just write directly
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
    
    console.log(`Cached ${fileType} data for user ${userId}`);
  } catch (error) {
    console.error(`Error saving ${fileType} to cache:`, error);
  }
};

// Read from localStorage-cache directory if available
const readFromCache = (userId: string, fileType: string) => {
  try {
    // Check if we have a cached version of this user's data
    const cacheDir = path.join(process.cwd(), 'localStorage-cache');
    if (!fs.existsSync(cacheDir)) {
      return null;
    }
    
    const filePath = path.join(cacheDir, `${fileType}_${userId}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    // Read the cached data
    const cachedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return cachedData;
  } catch (error) {
    console.error(`Error reading ${fileType} from cache:`, error);
    return null;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Set response headers for debugging
    res.setHeader('X-Zenjin-Emergency-Mode', 'true');
    
    // Create only the admin client for maximum reliability - ALWAYS USE ADMIN CLIENT
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylxga.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.3bvfZGkTc9nVtf1I7A0TwYy9pMFudJTrp974RZIwrq0'
    );
    
    // Extract user ID from multiple sources for maximum reliability
    let effectiveUserId;
    
    // Try extracting from body first (most common for this endpoint)
    if (req.body.userId) {
      effectiveUserId = req.body.userId;
      console.log('record-session: Using userId from request body:', effectiveUserId);
    }
    // Check for anonymousId in the body
    else if (req.body.anonymousId) {
      effectiveUserId = req.body.anonymousId;
      console.log('record-session: Using anonymousId from request body:', effectiveUserId);
    }
    // Try query params
    else if (req.query.userId) {
      effectiveUserId = req.query.userId as string;
      console.log('record-session: Using userId from query param:', effectiveUserId);
    } 
    // Try headers
    else if (req.headers['x-user-id']) {
      effectiveUserId = req.headers['x-user-id'] as string;
      console.log('record-session: Using userId from x-user-id header:', effectiveUserId);
    }
    // Last check auth header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      // Extract token
      const token = req.headers.authorization.substring(7);
      
      try {
        // Verify the token with admin client
        const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
        
        if (!error && userData?.user) {
          effectiveUserId = userData.user.id;
          console.log('record-session: Extracted userId from valid JWT:', effectiveUserId);
        } else {
          console.log('record-session: Invalid JWT in authorization header:', error?.message);
        }
      } catch (e) {
        console.error('record-session: Error verifying JWT:', e);
      }
    }
    
    // Last resort - try cookies
    if (!effectiveUserId) {
      try {
        const supabaseClient = createRouteHandlerClient(req, res);
        const { data: sessionData, error } = await supabaseClient.auth.getSession();
        
        if (!error && sessionData?.session?.user) {
          effectiveUserId = sessionData.session.user.id;
          console.log('record-session: Extracted userId from cookie session:', effectiveUserId);
        } else {
          console.log('record-session: No valid session in cookies');
        }
      } catch (e) {
        console.error('record-session: Error getting session from cookies:', e);
      }
    }
                   
    let { threadId, tubeId, stitchId, questionResults, sessionDuration } = req.body as SessionRequest & { anonymousId?: string };
    
    if (!effectiveUserId) {
      console.warn('No user ID found in record-session - generating random anonymous ID');
      // Generate a random ID as a last resort
      effectiveUserId = `anon-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    
    console.log(`Using effective user ID: ${effectiveUserId}`);
    res.setHeader('X-Zenjin-UserId', effectiveUserId);
    
    // Handle tube-stitch model by generating threadId if not provided
    if (!threadId && tubeId) {
      threadId = `thread-T${tubeId}-001`;
      console.log(`Using derived threadId ${threadId} from tubeId ${tubeId}`);
    }
    
    // Basic validation with enhanced error messaging
    if (!threadId) {
      console.error('Missing thread ID in request');
      return res.status(400).json({ success: false, error: 'Missing thread ID' });
    }
    
    if (!stitchId) {
      console.error('Missing stitch ID in request');
      return res.status(400).json({ success: false, error: 'Missing stitch ID' });
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
    console.log(`EMERGENCY MODE: Recording session for user ${effectiveUserId}, thread ${threadId}, stitch ${stitchId}`);

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
    
    let blinkSpeed = null;
    try {
      blinkSpeed = correctAnswerTimes.length > 0
        ? correctAnswerTimes.reduce((sum, time) => sum + time, 0) / correctAnswerTimes.length / 1000
        : null;
    } catch (error) {
      console.error('Error calculating blink speed:', error);
    }
    
    // Calculate session points
    const basePoints = (firstTimeCorrect * 3) + ((correctAnswers - firstTimeCorrect) * 1);
    const multiplier = 1; // Default multiplier in emergency mode
    const totalPoints = Math.round(basePoints * multiplier);
    
    // Generate a unique session ID
    const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Build session record - this will be persisted to cache
    const sessionRecord = {
      id: sessionId,
      user_id: effectiveUserId,
      thread_id: threadId,
      stitch_id: stitchId,
      total_points: totalPoints,
      accuracy: totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0,
      results: validQuestionResults,
      completed_at: new Date().toISOString()
    };
    
    console.log('EMERGENCY MODE: Storing session data in local cache');
    
    // First try database insert if available
    let dbSuccess = false;
    try {
      console.log('Attempting database insert first (with minimal data)');
      const { data, error } = await supabaseAdmin
        .from('session_results')
        .insert({
          id: sessionId,
          user_id: effectiveUserId,
          thread_id: threadId,
          stitch_id: stitchId,
          total_points: totalPoints,
          accuracy: totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0,
          results: [],  // Minimal empty array to avoid JSON parsing issues
          completed_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.log('Database insert failed, using cache only:', error.message);
      } else {
        console.log('Database insert succeeded');
        dbSuccess = true;
      }
    } catch (dbError) {
      console.error('Database insert exception:', dbError);
    }
    
    // Always update local cache regardless of database success
    saveToCache(effectiveUserId, 'user_sessions', sessionRecord);
    
    // Update profile with new points
    let userProfile = readFromCache(effectiveUserId, 'user_profile');
    if (!userProfile) {
      userProfile = {
        id: effectiveUserId,
        total_points: totalPoints,
        avg_blink_speed: blinkSpeed || 0,
        evolution_level: 1,
        last_session_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
    } else {
      // Update existing profile
      userProfile.total_points = (userProfile.total_points || 0) + totalPoints;
      userProfile.avg_blink_speed = blinkSpeed || userProfile.avg_blink_speed || 0;
      userProfile.last_session_date = new Date().toISOString();
      userProfile.updated_at = new Date().toISOString();
    }
    
    // Save updated profile
    saveToCache(effectiveUserId, 'user_profile', userProfile);
    
    // CRITICAL FIX: Always try to update the profile in the database
    // regardless of session storage success
    try {
      console.log('Updating user profile in database with accumulated points...');

      // First check if profile exists
      const { data: existingProfile, error: checkError } = await supabaseAdmin
        .from('profiles')
        .select('total_points, avg_blink_speed')
        .eq('id', effectiveUserId)
        .single();

      if (checkError) {
        console.log('Profile not found in database, creating new one');

        // Create a new profile
        await supabaseAdmin
          .from('profiles')
          .upsert({
            id: effectiveUserId,
            total_points: totalPoints, // Start with points from this session
            avg_blink_speed: blinkSpeed || userProfile.avg_blink_speed || 2.5,
            evolution_level: 1,
            total_sessions: 1,
            last_session_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        console.log(`New profile created with ${totalPoints} points`);
      } else {
        console.log(`Existing profile found with ${existingProfile.total_points} points`);

        // Calculate accumulated points
        const updatedTotalPoints = (existingProfile.total_points || 0) + totalPoints;

        // Update profile with accumulated points
        await supabaseAdmin
          .from('profiles')
          .update({
            total_points: updatedTotalPoints,
            avg_blink_speed: blinkSpeed || userProfile.avg_blink_speed || existingProfile.avg_blink_speed || 2.5,
            last_session_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', effectiveUserId);

        console.log(`Profile updated to ${updatedTotalPoints} points (added ${totalPoints})`);
      }
    } catch (profileError) {
      console.log('Profile database update failed:', profileError);
      console.log('Using cache only for profile data');
    }
    
    // Return success response with session data
    return res.status(200).json({
      success: true,
      sessionId,
      basePoints,
      multiplier,
      multiplierType: "Standard",
      totalPoints,
      blinkSpeed,
      correctAnswers,
      totalQuestions,
      firstTimeCorrect,
      dbSuccess,
      savedToAccount: dbSuccess,
      storageType: dbSuccess ? 'database' : 'local_cache',
      message: dbSuccess 
        ? 'Session recorded successfully and saved to your account' 
        : 'Session recorded locally only - progress has not been saved to your account'
    });
  } catch (error) {
    console.error('Error processing session:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      savedToAccount: false,
      storageType: 'failed',
      message: 'Error recording session - your progress for this session was not saved'
    });
  }
}