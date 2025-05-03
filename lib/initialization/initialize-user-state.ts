/**
 * User State Initialization
 * 
 * This module handles initializing a user's state with default positions.
 * The default positions match the alphanumeric ordering of stitches in the content tables.
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Initialize user state with default stitch positions
 * @param userId - The user's ID
 */
export async function initializeUserState(userId: string) {
  if (!userId) throw new Error('User ID is required');
  
  console.log(`Initializing user state for user: ${userId}`);
  
  // Create a database client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Create a default state that matches the content table structure
  const initialState = getDefaultUserState(userId);
  
  // Create the user_state table if needed
  try {
    const { error: checkError } = await supabase
      .from('user_state')
      .select('count', { count: 'exact', head: true });
      
    if (checkError && checkError.code === '42P01') {
      console.log('Creating user_state table...');
      
      await supabase.query(`
        CREATE TABLE IF NOT EXISTS public.user_state (
          user_id TEXT NOT NULL,
          state JSONB NOT NULL,
          last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, last_updated)
        );
        
        -- Create index for efficient queries by user
        CREATE INDEX IF NOT EXISTS idx_user_state_user_id ON user_state(user_id);
      `);
      
      console.log('Table created successfully');
    }
  } catch (err) {
    console.error('Error checking/creating user_state table:', err);
    // Continue - we'll try to save state anyway
  }
  
  // Save the state
  try {
    const { error } = await supabase
      .from('user_state')
      .upsert({
        user_id: userId,
        state: initialState,
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
      
    if (error) {
      console.error('Error saving initial state:', error);
      throw error;
    }
    
    console.log('Successfully saved initial user state');
    return initialState;
  } catch (error) {
    console.error('Error initializing user state:', error);
    throw error;
  }
}

/**
 * Returns a default user state for a new user
 * The default state has three tubes, each with the first thread in that tube
 * and initial stitches in the default position ordering
 */
export function getDefaultUserState(userId: string) {
  return {
    userId,
    tubes: {
      // Tube 1 - Number Facts
      1: {
        threadId: 'thread-T1-001',
        stitches: [
          {
            id: 'stitch-T1-001-01', 
            threadId: 'thread-T1-001',
            position: 0,  // Active
            skipNumber: 1,
            distractorLevel: 'L1'
          },
          {
            id: 'stitch-T1-001-02', 
            threadId: 'thread-T1-001',
            position: 1,
            skipNumber: 1,
            distractorLevel: 'L1'
          },
          {
            id: 'stitch-T1-001-03', 
            threadId: 'thread-T1-001',
            position: 2,
            skipNumber: 1,
            distractorLevel: 'L1'
          },
          {
            id: 'stitch-T1-001-04', 
            threadId: 'thread-T1-001',
            position: 3,
            skipNumber: 1,
            distractorLevel: 'L1'
          },
          {
            id: 'stitch-T1-001-05', 
            threadId: 'thread-T1-001',
            position: 4,
            skipNumber: 1,
            distractorLevel: 'L1'
          }
        ],
        currentStitchId: 'stitch-T1-001-01'
      },
      
      // Tube 2 - Basic Operations
      2: {
        threadId: 'thread-T2-001',
        stitches: [
          {
            id: 'stitch-T2-001-01', 
            threadId: 'thread-T2-001',
            position: 0,  // Active
            skipNumber: 1,
            distractorLevel: 'L1'
          },
          {
            id: 'stitch-T2-001-02', 
            threadId: 'thread-T2-001',
            position: 1,
            skipNumber: 1,
            distractorLevel: 'L1'
          },
          {
            id: 'stitch-T2-001-03', 
            threadId: 'thread-T2-001',
            position: 2,
            skipNumber: 1,
            distractorLevel: 'L1'
          },
          {
            id: 'stitch-T2-001-04', 
            threadId: 'thread-T2-001',
            position: 3,
            skipNumber: 1,
            distractorLevel: 'L1'
          },
          {
            id: 'stitch-T2-001-05', 
            threadId: 'thread-T2-001',
            position: 4,
            skipNumber: 1,
            distractorLevel: 'L1'
          }
        ],
        currentStitchId: 'stitch-T2-001-01'
      },
      
      // Tube 3 - Problem Solving
      3: {
        threadId: 'thread-T3-001',
        stitches: [
          {
            id: 'stitch-T3-001-01', 
            threadId: 'thread-T3-001',
            position: 0,  // Active
            skipNumber: 1,
            distractorLevel: 'L1'
          },
          {
            id: 'stitch-T3-001-02', 
            threadId: 'thread-T3-001',
            position: 1,
            skipNumber: 1,
            distractorLevel: 'L1'
          },
          {
            id: 'stitch-T3-001-03', 
            threadId: 'thread-T3-001',
            position: 2,
            skipNumber: 1,
            distractorLevel: 'L1'
          },
          {
            id: 'stitch-T3-001-04', 
            threadId: 'thread-T3-001',
            position: 3,
            skipNumber: 1,
            distractorLevel: 'L1'
          },
          {
            id: 'stitch-T3-001-05', 
            threadId: 'thread-T3-001',
            position: 4,
            skipNumber: 1,
            distractorLevel: 'L1'
          }
        ],
        currentStitchId: 'stitch-T3-001-01'
      }
    },
    activeTubeNumber: 1,  // Start with tube 1
    lastUpdated: new Date().toISOString()
  };
}