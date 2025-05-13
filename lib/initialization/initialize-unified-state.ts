/**
 * Unified State Initialization
 * 
 * This module handles state initialization for both anonymous and authenticated users
 * with a unified approach focused on position-based content model.
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Initialize state for any user type with position-based stitch arrangement
 * Ensures the user_state table exists and initializes default state
 * @param userId - User ID (anonymous or authenticated)
 */
export async function initializeUnifiedState(userId: string) {
  if (!userId) throw new Error('User ID is required');
  
  console.log(`Initializing unified state for user: ${userId}`);
  
  // Create a database client with admin privileges for table operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false
      }
    }
  );

  // Create the user_state table if needed
  try {
    console.log('Ensuring user_state table exists...');
    
    // Try creating the table using direct SQL to avoid RPC calls
    const { error } = await supabase.query(`
      CREATE TABLE IF NOT EXISTS public.user_state (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        state JSONB NOT NULL,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Create index for efficient queries by user
      CREATE INDEX IF NOT EXISTS idx_user_state_user_id ON user_state(user_id);
    `);
    
    if (error) {
      console.error('Error creating user_state table:', error);
      // Continue anyway - table might already exist
    } else {
      console.log('user_state table created or verified successfully');
    }
  } catch (err) {
    console.error('Error setting up user_state table:', err);
    // Continue - we'll try to save state anyway
  }
  
  // Check if user already has state
  try {
    console.log(`Checking if user ${userId} already has state...`);
    
    const { data, error } = await supabase
      .from('user_state')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
      
    if (!error && data && data.length > 0) {
      console.log(`User ${userId} already has state, skipping initialization`);
      return true; // User already has state
    }
  } catch (err) {
    console.error('Error checking for existing user state:', err);
  }
  
  // Create a default state with position-based model
  const initialState = getDefaultPositionBasedState(userId);
  
  // Save the state
  try {
    console.log(`Saving initial state for user ${userId}...`);
    
    const { error } = await supabase
      .from('user_state')
      .insert({
        user_id: userId,
        state: initialState,
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
      
    if (error) {
      console.error('Error saving initial state:', error);
      throw error;
    }
    
    console.log(`Successfully saved initial state for user ${userId}`);
    return initialState;
  } catch (error) {
    console.error('Error initializing user state:', error);
    throw error;
  }
}

/**
 * Returns a default position-based state for a new user
 * This state uses the positions property for better stitch tracking
 */
export function getDefaultPositionBasedState(userId: string) {
  return {
    userId,
    userInformation: {
      userId,
      isAnonymous: userId.startsWith('anonymous'),
      displayName: `User`,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    },
    tubeState: {
      activeTube: 1, // Start with tube 1
      tubes: {
        // Tube 1 - Number Facts
        1: {
          threadId: 'thread-T1-001',
          currentStitchId: 'stitch-T1-001-01',
          positions: {
            0: { 
              stitchId: 'stitch-T1-001-01', 
              skipNumber: 1, 
              distractorLevel: 1,
              perfectCompletions: 0 
            },
            1: { 
              stitchId: 'stitch-T1-001-02', 
              skipNumber: 1, 
              distractorLevel: 1,
              perfectCompletions: 0 
            },
            2: { 
              stitchId: 'stitch-T1-001-03', 
              skipNumber: 1, 
              distractorLevel: 1,
              perfectCompletions: 0 
            },
            3: { 
              stitchId: 'stitch-T1-001-04', 
              skipNumber: 1, 
              distractorLevel: 1,
              perfectCompletions: 0 
            },
            4: { 
              stitchId: 'stitch-T1-001-05', 
              skipNumber: 1, 
              distractorLevel: 1,
              perfectCompletions: 0 
            }
          },
          // Keep stitchOrder for backward compatibility
          stitchOrder: [
            'stitch-T1-001-01',
            'stitch-T1-001-02',
            'stitch-T1-001-03',
            'stitch-T1-001-04',
            'stitch-T1-001-05'
          ]
        },
        
        // Tube 2 - Basic Operations
        2: {
          threadId: 'thread-T2-001',
          currentStitchId: 'stitch-T2-001-01',
          positions: {
            0: { 
              stitchId: 'stitch-T2-001-01', 
              skipNumber: 1, 
              distractorLevel: 1,
              perfectCompletions: 0 
            },
            1: { 
              stitchId: 'stitch-T2-001-02', 
              skipNumber: 1, 
              distractorLevel: 1,
              perfectCompletions: 0 
            },
            2: { 
              stitchId: 'stitch-T2-001-03', 
              skipNumber: 1, 
              distractorLevel: 1,
              perfectCompletions: 0 
            }
          },
          // Keep stitchOrder for backward compatibility
          stitchOrder: [
            'stitch-T2-001-01',
            'stitch-T2-001-02',
            'stitch-T2-001-03'
          ]
        },
        
        // Tube 3 - Problem Solving
        3: {
          threadId: 'thread-T3-001',
          currentStitchId: 'stitch-T3-001-01',
          positions: {
            0: { 
              stitchId: 'stitch-T3-001-01', 
              skipNumber: 1, 
              distractorLevel: 1,
              perfectCompletions: 0 
            },
            1: { 
              stitchId: 'stitch-T3-001-02', 
              skipNumber: 1, 
              distractorLevel: 1,
              perfectCompletions: 0 
            },
            2: { 
              stitchId: 'stitch-T3-001-03', 
              skipNumber: 1, 
              distractorLevel: 1,
              perfectCompletions: 0 
            }
          },
          // Keep stitchOrder for backward compatibility
          stitchOrder: [
            'stitch-T3-001-01',
            'stitch-T3-001-02',
            'stitch-T3-001-03'
          ]
        }
      }
    },
    learningProgress: {
      userId,
      totalTimeSpentLearning: 0,
      evoPoints: 0,
      evolutionLevel: 1,
      currentBlinkSpeed: 1,
      previousSessionBlinkSpeeds: [],
      completedStitchesCount: 0,
      perfectScoreStitchesCount: 0
    },
    lastUpdated: new Date().toISOString(),
    isInitialized: true
  };
}

/**
 * Creates a user_state table if it doesn't exist
 * This function is used by API endpoints to ensure the table exists
 * @returns boolean success indicator
 */
export async function ensureUserStateTableExists() {
  // Create an admin client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false
      }
    }
  );
  
  try {
    // Create the table using direct SQL
    const { error } = await supabase.query(`
      CREATE TABLE IF NOT EXISTS public.user_state (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        state JSONB NOT NULL,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Create index for efficient queries by user
      CREATE INDEX IF NOT EXISTS idx_user_state_user_id ON user_state(user_id);
    `);
    
    if (error) {
      console.error('Error creating user_state table:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error setting up user_state table:', err);
    return false;
  }
}