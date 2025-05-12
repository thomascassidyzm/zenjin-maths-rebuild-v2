import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';
import { createRouteHandlerClient } from '../../lib/supabase/route';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { generateRandomLearningPath, getSuggestedFallbackStitch } from '../../utils/fallbackContent';

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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Dashboard API: Starting request');
    console.log('Dashboard API: Cookies:', req.cookies);

    // CRITICAL FLAG: Check if this request is coming from the Continue Learning flow
    // If so, we'll skip loading default state to prevent overriding the state in localStorage
    const isContinueLearningFlow = req.headers['x-zenjin-continue-learning'] === 'true';

    if (isContinueLearningFlow) {
      console.log('Dashboard API: Request is from Continue Learning flow - will skip loading default state');
      // Set response header to track this special case
      res.setHeader('X-Zenjin-Continue-Learning', 'true');
    }

    // Create only the admin client for maximum reliability - ALWAYS USE ADMIN CLIENT
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylxga.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.3bvfZGkTc9nVtf1I7A0TwYy9pMFudJTrp974RZIwrq0'
    );

    // Extract user ID from multiple sources for maximum reliability
    let userId;

    // Try extracting from query params first
    if (req.query.userId) {
      userId = req.query.userId as string;
      console.log('Dashboard API: Using userId from query param:', userId);
    }
    // Next try auth header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      // Extract token
      const token = req.headers.authorization.substring(7);

      try {
        // Verify the token with admin client
        const { data: userData, error } = await supabaseAdmin.auth.getUser(token);

        if (!error && userData?.user) {
          userId = userData.user.id;
          console.log('Dashboard API: Extracted userId from valid JWT:', userId);
        } else {
          console.log('Dashboard API: Invalid JWT in authorization header:', error?.message);
        }
      } catch (e) {
        console.error('Dashboard API: Error verifying JWT:', e);
      }
    }
    // Try x-user-id header
    else if (req.headers['x-user-id']) {
      userId = req.headers['x-user-id'] as string;
      console.log('Dashboard API: Using userId from x-user-id header:', userId);
    }

    // If still no user ID, try to get from cookies with createRouteHandlerClient
    if (!userId) {
      try {
        const supabaseClient = createRouteHandlerClient(req, res);
        const { data: sessionData, error } = await supabaseClient.auth.getSession();

        if (!error && sessionData?.session?.user) {
          userId = sessionData.session.user.id;
          console.log('Dashboard API: Extracted userId from cookie session:', userId);
        } else {
          console.log('Dashboard API: No valid session in cookies');
        }
      } catch (e) {
        console.error('Dashboard API: Error getting session from cookies:', e);
      }
    }

    // Last resort - check if anonymous ID is provided
    if (!userId && req.headers['x-anonymous-id']) {
      userId = req.headers['x-anonymous-id'] as string;
      console.log('Dashboard API: Using anonymous ID as fallback:', userId);
    }

    // CRITICAL FIX: When in Continue Learning flow, if we have a user ID but no DB data,
    // return a stripped-down response without overriding localStorage state
    if (isContinueLearningFlow && userId) {
      // Since we're in Continue Learning flow, we'll return minimal data
      // This prevents the dashboard from resetting localStorage state

      console.log('Dashboard API: Returning minimal data for Continue Learning flow');

      return res.status(200).json({
        userId: userId,
        totalPoints: 0, // These will be updated by the session recording logic
        blinkSpeed: 2.5,
        blinkSpeedTrend: 'steady',
        evolution: {
          currentLevel: 'Mind Spark',
          levelNumber: 1,
          progress: 0,
          nextLevel: 'Thought Weaver'
        },
        globalStanding: {
          percentile: null,
          date: null,
          message: "Continue learning to see your ranking"
        },
        recentSessions: [],
        dataSource: 'continue-learning-flow',
        message: 'Continuing from previous learning state...',
        // No fallbackContent to ensure we use the state from localStorage
        preserveLocalState: true
      });
    }

    // If still no user ID, we can't proceed - but rather than 401, provide bundled content
    if (!userId) {
      console.log('Dashboard API: No user ID found, generating fallback content');

      // Generate a random bundled content path
      const fallbackContent = generateRandomLearningPath();
      const suggestedStitch = getSuggestedFallbackStitch();

      return res.status(200).json({
        userId: 'anonymous',
        totalPoints: 0,
        blinkSpeed: 0,
        blinkSpeedTrend: 'steady',
        evolution: {
          currentLevel: 'Mind Spark',
          levelNumber: 1,
          progress: 0,
          nextLevel: 'Thought Weaver'
        },
        globalStanding: {
          percentile: null,
          date: null,
          message: "Start learning to see your ranking"
        },
        recentSessions: [],
        dataSource: 'emergency-fallback',
        message: 'Using bundled content - please log in to save your progress',
        fallbackContent: {
          stitches: fallbackContent.stitches,
          threads: fallbackContent.threads,
          suggestedNext: suggestedStitch,
          isFallback: true
        }
      });
    }
    
    console.log(`Dashboard API: Proceeding with userId: ${userId}`);
    console.log(`Dashboard API: Fetching data for user ${userId}`);

    // Try to get or create user profile
    let profile;
    let noRealData = false; // Track if we're using synthetic data
    let useCache = false; // Track if we're using cached data
    
    try {
      console.log(`Dashboard API: Looking for profile with ID ${userId}`);
      
      // First try with admin client to bypass RLS
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('total_points, avg_blink_speed, evolution_level, last_session_date')
        .eq('id', userId)
        .single();
        
      if (profileError) {
        console.log('Dashboard API: Profile not found with admin client, checking local cache');
        
        // Check if we have cached profile data
        const cachedProfile = readFromCache(userId, 'user_profile');
        
        if (cachedProfile) {
          console.log('Dashboard API: Found cached profile data');
          profile = {
            total_points: cachedProfile.total_points || 0,
            avg_blink_speed: cachedProfile.avg_blink_speed || 2.5,
            evolution_level: cachedProfile.evolution_level || 1,
            last_session_date: cachedProfile.last_session_date || new Date().toISOString()
          };
          useCache = true;
        } else {
          console.log('Dashboard API: No cached profile, checking recent sessions first');
          
          // Check for cached sessions to generate a profile
          const cachedSessions = readFromCache(userId, 'user_sessions');
          let initialPoints = 0;
          
          if (cachedSessions && Array.isArray(cachedSessions) && cachedSessions.length > 0) {
            console.log(`Dashboard API: Found ${cachedSessions.length} cached sessions`);
            initialPoints = cachedSessions.reduce((sum, session) => sum + (session.total_points || 0), 0);
            useCache = true;
          } else {
            // If no cache, try database sessions as a final attempt
            const { data: sessionData, error: sessionError } = await supabaseAdmin
              .from('session_results')
              .select('total_points')
              .eq('user_id', userId)
              .order('completed_at', { ascending: false });
            
            // If we have session data, use the real total from sessions
            if (!sessionError && sessionData && sessionData.length > 0) {
              // Sum up points from all sessions
              initialPoints = sessionData.reduce((sum, session) => sum + (session.total_points || 0), 0);
              console.log(`Dashboard API: Found ${sessionData.length} sessions with total points: ${initialPoints}`);
            } else {
              console.log('Dashboard API: No sessions found for this user');
              // Mark that we're using synthetic data
              noRealData = true;
            }
          }
          
          // Create a profile with actual session data if available (or zeros if no sessions)
          const { data: newProfile, error: createError } = await supabaseAdmin
            .from('profiles')
            .upsert({
              id: userId,
              total_points: initialPoints,
              avg_blink_speed: 2.5, // Default for now
              evolution_level: Math.max(1, Math.floor(initialPoints / 1000) + 1),
              total_sessions: useCache ? (cachedSessions?.length || 0) : 0,
              last_session_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            })
            .select()
            .single();
            
          if (createError) {
            console.error('Dashboard API: Error creating profile with admin client:', createError);
            
            profile = {
              total_points: initialPoints,
              avg_blink_speed: 2.5,
              evolution_level: Math.max(1, Math.floor(initialPoints / 1000) + 1)
            };
          } else {
            console.log('Dashboard API: Successfully created profile with admin client');
            profile = newProfile;
          }
        }
      } else {
        console.log('Dashboard API: Found existing profile');
        profile = profileData;
      }
    } catch (profileError) {
      console.error('Dashboard API: Exception handling profile:', profileError);
      
      // Last resort: try to get profile from cache if database completely fails
      const cachedProfile = readFromCache(userId, 'user_profile');
      
      if (cachedProfile) {
        console.log('Dashboard API: Using cached profile as fallback after error');
        profile = {
          total_points: cachedProfile.total_points || 0,
          avg_blink_speed: cachedProfile.avg_blink_speed || 2.5,
          evolution_level: cachedProfile.evolution_level || 1,
          last_session_date: cachedProfile.last_session_date || new Date().toISOString()
        };
        useCache = true;
      } else {
        // Absolute fallback to empty profile
        profile = {
          total_points: 0, // Default to 0, not fake points
          avg_blink_speed: 2.5,
          evolution_level: 1
        };
        noRealData = true;
      }
    }

    // Calculate evolution information
    const evolutionData = calculateEvolutionData(
      profile.total_points,
      profile.avg_blink_speed,
      profile.evolution_level
    );

    // Default values for other metrics
    const blinkSpeedTrend = 'steady';
    const recentSessions = [];
    
    // Try to get recent sessions but continue if it fails
    try {
      console.log('Dashboard API: Fetching recent sessions with user ID:', userId);
      
      // First try with admin client to bypass RLS
      const { data: sessionData, error: sessionError } = await supabaseAdmin
        .from('session_results')  // Updated table name from user_sessions to session_results
        .select('id, completed_at, total_points, accuracy, results')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(10); // Fetch more to ensure we have enough valid sessions
      
      console.log(`Dashboard API: Fetched recent sessions (count=${sessionData?.length || 0})`);
        
      if (sessionData && sessionData.length > 0) {
        // Transform the data to match expected format
        const transformedSessions = sessionData.map(session => {
          // Calculate correct answers from results array if available
          let correctAnswers = 0;
          let totalQuestions = 0;
          let blinkSpeedTotal = 0;
          let blinkSpeedCount = 0;
          
          // Process results array if it exists
          if (Array.isArray(session.results)) {
            totalQuestions = session.results.length;
            
            session.results.forEach(result => {
              if (result.correct) correctAnswers++;
              
              // Calculate blink speed if available
              if (result.timeToAnswer && typeof result.timeToAnswer === 'number') {
                blinkSpeedTotal += result.timeToAnswer;
                blinkSpeedCount++;
              }
            });
          }
          
          // Use session completion time or fallback
          const timestamp = session.completed_at || new Date().toISOString();
          
          return {
            id: session.id,
            timestamp,
            total_points: session.total_points || 0,
            correct_answers: correctAnswers || 0,
            total_questions: totalQuestions || 0,
            blink_speed: blinkSpeedCount > 0 ? (blinkSpeedTotal / blinkSpeedCount / 1000) : null
          };
        });
        
        // Only use sessions with some data
        const validSessions = transformedSessions.filter(session => 
          session.total_questions > 0 || session.total_points > 0
        );
        
        // Take the 5 most recent valid sessions
        recentSessions.push(...validSessions.slice(0, 5));
        
        console.log(`Dashboard API: Found ${recentSessions.length} valid recent sessions`);
      } else {
        // If no database sessions, try to use cached sessions
        console.log('Dashboard API: No database sessions, checking cache');
        
        // Read cached sessions
        const cachedSessions = readFromCache(userId, 'user_sessions');
        
        if (cachedSessions && Array.isArray(cachedSessions) && cachedSessions.length > 0) {
          console.log(`Dashboard API: Found ${cachedSessions.length} cached sessions`);
          
          // Transform cached sessions to match expected format
          const transformedSessions = cachedSessions.map(session => {
            // Calculate correct answers from results array
            let correctAnswers = 0;
            let totalQuestions = 0;
            let blinkSpeedTotal = 0;
            let blinkSpeedCount = 0;
            
            if (Array.isArray(session.results)) {
              totalQuestions = session.results.length;
              
              session.results.forEach(result => {
                if (result.correct) correctAnswers++;
                
                if (result.timeToAnswer && typeof result.timeToAnswer === 'number') {
                  blinkSpeedTotal += result.timeToAnswer;
                  blinkSpeedCount++;
                }
              });
            }
            
            return {
              id: session.id,
              timestamp: session.completed_at || new Date().toISOString(),
              total_points: session.total_points || 0,
              correct_answers: correctAnswers || 0,
              total_questions: totalQuestions || 0,
              blink_speed: blinkSpeedCount > 0 ? (blinkSpeedTotal / blinkSpeedCount / 1000) : null
            };
          });
          
          // Only use sessions with some data
          const validSessions = transformedSessions.filter(session => 
            session.total_questions > 0 || session.total_points > 0
          );
          
          // Take the 5 most recent valid sessions
          recentSessions.push(...validSessions.slice(0, 5));
          
          console.log(`Dashboard API: Using ${recentSessions.length} valid cached sessions`);
        } else if (sessionError) {
          console.log('Dashboard API: Error fetching from session_results, trying fallback table');
          
          // Fallback to older table name if it exists
          const { data: fallbackSessionData, error: fallbackError } = await supabaseAdmin
            .from('user_sessions')
            .select('id, timestamp, total_points, correct_answers, total_questions, blink_speed')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .limit(5);
            
          if (!fallbackError && fallbackSessionData && fallbackSessionData.length > 0) {
            // Filter for valid sessions
            const validSessions = fallbackSessionData.filter(session => 
              session.total_questions > 0 || session.total_points > 0
            );
            
            recentSessions.push(...validSessions);
            console.log(`Dashboard API: Found ${recentSessions.length} valid sessions from fallback table`);
          } else {
            console.log('Dashboard API: No sessions found in fallback table either', fallbackError);
          }
        }
      }
    } catch (sessionsError) {
      console.error('Dashboard API: Error fetching recent sessions:', sessionsError);
      
      // Last resort: try to read from cache on exception
      try {
        const cachedSessions = readFromCache(userId, 'user_sessions');
        
        if (cachedSessions && Array.isArray(cachedSessions) && cachedSessions.length > 0) {
          console.log(`Dashboard API: Using ${cachedSessions.length} cached sessions after error`);
          
          // Transform and filter cached sessions
          const validSessions = cachedSessions
            .map(session => ({
              id: session.id,
              timestamp: session.completed_at || new Date().toISOString(),
              total_points: session.total_points || 0,
              correct_answers: session.results?.filter(r => r.correct)?.length || 0,
              total_questions: session.results?.length || 0,
              blink_speed: null // Skip complex calculation in error case
            }))
            .filter(s => s.total_points > 0 || s.total_questions > 0)
            .slice(0, 5);
          
          recentSessions.push(...validSessions);
        }
      } catch (cacheError) {
        console.error('Dashboard API: Error reading from cache as last resort:', cacheError);
      }
    }

    // Global standing based on actual point count
    const globalStanding = {
      percentile: profile.total_points > 500 ? 25 : (profile.total_points > 100 ? 50 : 75),
      date: new Date().toISOString().split('T')[0],
      message: profile.total_points > 0 
        ? `Based on your ${profile.total_points} points` 
        : "Play more to see your global standing"
    };

    // Add detailed debug info to help trace issues
    console.log('Dashboard API: Sending response with profile data:', {
      userId,
      points: profile.total_points,
      blinkSpeed: profile.avg_blink_speed,
      sessions: recentSessions.length,
      usingCache: useCache
    });
    
    // Add cache information to response headers
    res.setHeader('X-Zenjin-Data-Source', useCache ? 'cache' : 'database');
    if (useCache) {
      res.setHeader('X-Zenjin-Cache-Used', 'true');
    }
    
    // Generate fallback content if we're using cache
    let fallbackContentData = null;
    if (useCache) {
      const fallbackContent = generateRandomLearningPath();
      const suggestedStitch = getSuggestedFallbackStitch();
      fallbackContentData = {
        stitches: fallbackContent.stitches,
        threads: fallbackContent.threads,
        suggestedNext: suggestedStitch,
        isFallback: true
      };
    }
    
    // Send response with the correctly mapped data
    return res.status(200).json({
      userId,
      totalPoints: profile.total_points || 0,
      blinkSpeed: profile.avg_blink_speed || 2.5,
      blinkSpeedTrend,
      evolution: evolutionData,
      globalStanding,
      recentSessions,
      dataSource: useCache ? 'cache' : 'database',
      message: useCache
        ? 'Using cached data - progress won\'t be saved until connection is restored'
        : 'Your global standings have been updated. Keep learning to improve your position!',
      // Include fallback content if using cache
      fallbackContent: fallbackContentData
    });
  } catch (error) {
    console.error('Dashboard API: Fatal error:', error);
    
    // Use the user ID we already found if available
    let fallbackUserId = userId || 'anonymous';
    
    // Add emergency fallback header
    res.setHeader('X-Zenjin-Data-Source', 'emergency-fallback');
    
    // Generate a random learning path from bundled content
    const fallbackContent = generateRandomLearningPath();
    const suggestedStitch = getSuggestedFallbackStitch();
    
    // Return fallback data instead of an error, but include actual user ID if we have it
    return res.status(200).json({
      userId: fallbackUserId,
      totalPoints: 50,
      blinkSpeed: 2.5,
      blinkSpeedTrend: 'steady',
      evolution: {
        currentLevel: 'Mind Spark',
        levelNumber: 1,
        progress: 50,
        nextLevel: 'Thought Weaver'
      },
      globalStanding: {
        percentile: 50,
        date: new Date().toISOString().split('T')[0],
        message: "Global standing data not available"
      },
      recentSessions: [],
      dataSource: 'emergency-fallback',
      message: 'Using bundled content - progress won\'t be saved until connection is restored',
      fallbackContent: {
        stitches: fallbackContent.stitches,
        threads: fallbackContent.threads,
        suggestedNext: suggestedStitch,
        isFallback: true
      }
    });
  }
}

/**
 * Calculate the user's evolution level data
 */
function calculateEvolutionData(totalPoints: number, blinkSpeed: number, currentLevelNumber: number) {
  // Define evolution levels
  const levels = [
    { name: "Mind Spark", threshold: 0 },
    { name: "Thought Weaver", threshold: 1000 },
    { name: "Pattern Seeker", threshold: 3000 },
    { name: "Vision Runner", threshold: 6000 },
    { name: "Insight Chaser", threshold: 10000 },
    { name: "Clarity Crafter", threshold: 15000 },
    { name: "Perception Prowler", threshold: 25000 },
    { name: "Enigma Explorer", threshold: 40000 },
    { name: "Riddle Ranger", threshold: 60000 },
    { name: "Puzzle Prophet", threshold: 85000 },
    { name: "Nexus Navigator", threshold: 120000 },
    { name: "Echo Elementalist", threshold: 160000 },
    { name: "Horizon Hunter", threshold: 220000 },
    { name: "Cipher Sentinel", threshold: 300000 },
    { name: "Quantum Quicksilver", threshold: 400000 }
  ];

  // Ensure level number is valid
  if (currentLevelNumber < 1) currentLevelNumber = 1;
  if (currentLevelNumber > levels.length) currentLevelNumber = levels.length;

  // Get current level info
  const currentLevel = levels[currentLevelNumber - 1];
  
  // If at max level, no next level
  if (currentLevelNumber >= levels.length) {
    return {
      currentLevel: currentLevel.name,
      levelNumber: currentLevelNumber,
      progress: 100,
      nextLevel: null
    };
  }

  // Get next level
  const nextLevel = levels[currentLevelNumber];
  
  // Calculate evolution score
  const safeBlinkSpeed = blinkSpeed || 5; // Default if no blink speed data
  const evolutionScore = totalPoints / safeBlinkSpeed;
  
  // Calculate progress to next level
  const currentThreshold = currentLevel.threshold;
  const nextThreshold = nextLevel.threshold;
  const progressRange = nextThreshold - currentThreshold;
  const progressPoints = evolutionScore - currentThreshold;
  const progress = Math.min(Math.round((progressPoints / progressRange) * 100), 100);

  return {
    currentLevel: currentLevel.name,
    levelNumber: currentLevelNumber,
    progress: progress,
    nextLevel: nextLevel.name
  };
}

/**
 * Calculate the trend in blink speed
 */
function calculateBlinkSpeedTrend(recentSessions: any[], currentAvg: number): "improving" | "steady" | "declining" {
  if (!recentSessions || recentSessions.length < 5) {
    return "steady"; // Not enough data
  }

  // Split sessions into two groups
  const recentFive = recentSessions.slice(0, 5);
  const previousFive = recentSessions.slice(5, 10);
  
  if (previousFive.length === 0) {
    return "steady"; // Not enough data for previous period
  }

  // Calculate averages
  const recentAvg = recentFive
    .map(s => s.blink_speed)
    .filter(Boolean)
    .reduce((sum, speed) => sum + speed, 0) / recentFive.length;
    
  const previousAvg = previousFive
    .map(s => s.blink_speed)
    .filter(Boolean)
    .reduce((sum, speed) => sum + speed, 0) / previousFive.length;

  // Lower is better for blink speed
  const improvementThreshold = 0.1; // 10% change threshold
  
  if (recentAvg < previousAvg * (1 - improvementThreshold)) {
    return "improving";
  } else if (recentAvg > previousAvg * (1 + improvementThreshold)) {
    return "declining";
  } else {
    return "steady";
  }
}

/**
 * Get the user's global standing for a given date
 */
async function getGlobalStanding(userId: string, date: string) {
  // Get user's points for the given date
  const { data: userStats } = await supabase  // Using global supabase here - would need refactoring for req/res context
    .from('daily_user_stats')
    .select('points_earned')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  // If no activity today, find most recent day with activity
  if (!userStats) {
    const { data: mostRecentDay } = await supabase
      .from('daily_user_stats')
      .select('date, points_earned')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (!mostRecentDay) {
      return {
        percentile: null,
        date: null,
        message: "No activity recorded yet"
      };
    }

    // Use most recent day with activity
    return getPercentileForDay(mostRecentDay.points_earned, mostRecentDay.date);
  }

  // Use today's data
  return getPercentileForDay(userStats.points_earned, date);
}

/**
 * Calculate percentile based on points for a specific day
 */
async function getPercentileForDay(points: number, date: string) {
  // Get global stats for the day
  const { data: globalStats } = await supabase
    .from('global_daily_stats')
    .select('*')
    .eq('date', date)
    .single();

  // If no global stats yet, return placeholder
  if (!globalStats) {
    return {
      percentile: null,
      date,
      message: "Global statistics not available yet"
    };
  }

  // Find which percentile the user falls into
  let percentile;
  if (points >= globalStats.percentile_99) percentile = 1;
  else if (points >= globalStats.percentile_95) percentile = 5;
  else if (points >= globalStats.percentile_90) percentile = 10;
  else if (points >= globalStats.percentile_75) percentile = 25;
  else if (points >= globalStats.percentile_50) percentile = 50;
  else if (points >= globalStats.percentile_25) percentile = 75;
  else if (points >= globalStats.percentile_10) percentile = 90;
  else percentile = 95; // Bottom 5%

  return {
    percentile,
    date,
    message: `Top ${percentile}% globally today!`
  };
}