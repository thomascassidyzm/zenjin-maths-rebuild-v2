import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient, createAdminClient } from '../../lib/supabase/route';
import { getFreeUserAccessProfile } from '../../lib/tier-manager';

/**
 * API endpoint to transfer anonymous user progress data to authenticated user account
 * POST /api/transfer-anonymous-data
 * 
 * Takes anonymous session data from localStorage and transfers it to the authenticated user
 * by creating appropriate tube and stitch progress records.
 * 
 * When a user transitions from anonymous to authenticated, they become a free tier user
 * with access to all free content.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed, use POST' });
    }
    
    const { userId, anonymousData } = req.body;
    
    if (!userId || !anonymousData) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    console.log(`API: Transferring anonymous data to user ${userId}`);
    
    // Create a Supabase client
    const supabase = createRouteHandlerClient(req, res);
    const adminClient = createAdminClient();
    
    // Validate the user exists
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();
      
    if (userError) {
      console.error('Error validating user:', userError);
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }
    
    // Extract the necessary data from anonymous session
    // Handle both direct state format and wrapped state format
    let state, totalPoints;
    
    console.log('Received anonymous data format:', Object.keys(anonymousData));
    
    if (anonymousData.state && anonymousData.totalPoints !== undefined) {
      // Wrapped format: { state: {...}, totalPoints: number }
      state = anonymousData.state;
      totalPoints = anonymousData.totalPoints;
    } else if (anonymousData.tubes) {
      // Direct state format: the state object itself
      state = anonymousData;
      totalPoints = anonymousData.totalPoints || 0;
    } else if (anonymousData.payload && anonymousData.payload.tubes) {
      // Sometimes state is wrapped in a payload property
      state = anonymousData.payload;
      totalPoints = anonymousData.payload.totalPoints || 0;
    } else {
      console.error('Invalid state format received:', JSON.stringify(anonymousData).substring(0, 200) + '...');
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid anonymous session format. State structure not recognized.',
        stateKeys: Object.keys(anonymousData)
      });
    }
    
    if (!state || !state.tubes) {
      console.error('State missing tubes property:', JSON.stringify(state).substring(0, 200) + '...');
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid anonymous session format. State missing required tubes property.',
        stateKeys: state ? Object.keys(state) : []
      });
    }
    
    // Get the free user access profile to know what content they should have access to
    const freeUserProfile = getFreeUserAccessProfile();
    
    // 1. Save tube position
    try {
      const { error: tubeError } = await supabase
        .from('user_tube_position')
        .upsert({
          user_id: userId,
          tube_number: state.activeTubeNumber || 1,
          thread_id: Object.values(state.tubes).find((tube: any) => 
            tube.stitches && tube.stitches.length > 0)?.threadId || 'thread-A'
        });
        
      if (tubeError) {
        console.error('Error saving tube position:', tubeError);
      }
    } catch (e) {
      console.error('Exception saving tube position:', e);
    }
    
    // 2. Save stitch positions and progress for each tube
    const progressRecords = [];
    
    try {
      // Process each tube
      Object.entries(state.tubes).forEach(([tubeNum, tube]: [string, any]) => {
        if (!tube || !tube.stitches) return;
        
        const tubeNumber = parseInt(tubeNum);
        const threadId = tube.threadId;
        
        // Only transfer progress for threads the user has access to
        if (!freeUserProfile.hasAccessToThreads.includes(threadId)) {
          console.log(`Skipping thread ${threadId} as it's not in the free tier`);
          return;
        }
        
        // Process each stitch in the tube
        tube.stitches.forEach((stitch: any) => {
          progressRecords.push({
            user_id: userId,
            thread_id: stitch.threadId || threadId,
            stitch_id: stitch.id,
            order_number: stitch.position,
            skip_number: stitch.skipNumber || 1,
            distractor_level: stitch.distractorLevel || 'L1',
            updated_at: new Date().toISOString()
          });
        });
      });
      
      // Insert all records
      if (progressRecords.length > 0) {
        const { error: progressError } = await supabase
          .from('user_stitch_progress')
          .upsert(progressRecords);
          
        if (progressError) {
          console.error('Error saving stitch progress:', progressError);
          console.error(`Progress records count: ${progressRecords.length}`);
          console.error(`Sample records: ${JSON.stringify(progressRecords.slice(0, 2))}`);
        } else {
          console.log(`Successfully saved ${progressRecords.length} stitch progress records for user ${userId}`);
        }
      } else {
        console.log(`No stitch progress records to transfer for user ${userId}`);
      }
    } catch (e) {
      console.error('Exception saving stitch progress:', e);
      console.error(`Progress records data state: ${JSON.stringify({
        recordCount: progressRecords.length,
        tubeCount: Object.keys(state.tubes).length,
        hasStitches: Object.values(state.tubes).some((t: any) => t.stitches && t.stitches.length > 0)
      })}`);
    }
    
    // 3. Create a summary session record with accumulated points
    try {
      const { error: sessionError } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_date: new Date().toISOString(),
          points: totalPoints || 0,
          description: 'Transferred from anonymous session'
        });
        
      if (sessionError) {
        console.error('Error recording session points:', sessionError);
      }
    } catch (e) {
      console.error('Exception recording session points:', e);
    }
    
    // 4. IMPORTANT: Transfer the complete user state as well
    try {
      // First check if user_state table exists, create if needed
      try {
        const { error: tableError } = await adminClient
          .from('user_state')
          .select('count', { count: 'exact', head: true });
          
        if (tableError && tableError.code === '42P01') {
          console.log('Creating user_state table...');
          
          await adminClient.query(`
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
        }
      } catch (tableErr) {
        console.error('Error checking/creating user_state table:', tableErr);
      }
      
      // Now transfer the state - update the userId in the state
      console.log(`Preparing to transfer complete state for user ${userId}`);
      
      // Make a deep copy and ensure all required fields are present
      const updatedState = {
        ...state,
        userId: userId,
        lastUpdated: new Date().toISOString(),
        tubes: state.tubes || {},
        totalScore: state.totalScore || totalPoints || 0,
        activeTubeNumber: state.activeTubeNumber || 1
      };
      
      console.log(`State prepared for transfer with fields: ${Object.keys(updatedState).join(', ')}`);
      console.log(`Tube count: ${Object.keys(updatedState.tubes).length}`);
      
      // Save the migrated state
      const { error: stateError } = await adminClient
        .from('user_state')
        .upsert({
          user_id: userId,
          state: updatedState,
          last_updated: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
        
      if (stateError) {
        console.error('Error saving migrated state:', stateError);
        console.error('State error details:', JSON.stringify(stateError));
        
        // Try a fallback with a more minimal state object if the full one fails
        try {
          const minimalState = {
            userId: userId,
            lastUpdated: new Date().toISOString(),
            tubes: {},
            activeTubeNumber: 1,
            totalScore: totalPoints || 0
          };
          
          // Copy just the essential tube data
          Object.entries(state.tubes || {}).forEach(([tubeNum, tube]: [string, any]) => {
            if (tube) {
              minimalState.tubes[tubeNum] = {
                threadId: tube.threadId,
                stitches: Array.isArray(tube.stitches) ? tube.stitches.map((s: any) => ({
                  id: s.id,
                  threadId: s.threadId,
                  position: s.position
                })) : []
              };
            }
          });
          
          console.log('Attempting fallback with minimal state');
          const { error: fallbackError } = await adminClient
            .from('user_state')
            .upsert({
              user_id: userId,
              state: minimalState,
              last_updated: new Date().toISOString(),
              created_at: new Date().toISOString()
            });
            
          if (fallbackError) {
            console.error('Fallback state save also failed:', fallbackError);
          } else {
            console.log('Successfully saved minimal fallback state');
          }
        } catch (fallbackErr) {
          console.error('Error during fallback state save attempt:', fallbackErr);
        }
      } else {
        console.log('Successfully migrated complete anonymous state to user account');
      }
    } catch (stateErr) {
      console.error('Error migrating user state:', stateErr);
    }
    
    // 4. Set user tier - currently all registered users are free tier
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          tier: 'free',
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        
      if (profileError) {
        console.error('Error setting user tier:', profileError);
      } else {
        console.log(`User ${userId} set to free tier`);
      }
    } catch (e) {
      console.error('Exception setting user tier:', e);
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Anonymous data transferred successfully',
      recordsTransferred: progressRecords.length,
      tier: 'free',
      accessibleThreads: freeUserProfile.hasAccessToThreads
    });
    
  } catch (error) {
    console.error('Error transferring anonymous data:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error during data transfer' 
    });
  }
}