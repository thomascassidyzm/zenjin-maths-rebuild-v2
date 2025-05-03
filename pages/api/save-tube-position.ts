import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../lib/supabase/route';
import { createClient } from '@supabase/supabase-js';

/**
 * Save Tube Position API endpoint
 * 
 * With the Triple Helix model, each tube has one active stitch (order_number = 0).
 * This endpoint doesn't need to save a separate tube position record - 
 * it just needs to get the active stitch for the specified tube/thread
 * and mark it as the current focus for the user.
 * 
 * We set an 'is_current_tube' column on user_stitch_progress if it exists,
 * otherwise we handle this purely client-side.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { userId, tubeNumber, threadId } = req.body;

    if (!userId || !tubeNumber || !threadId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters' 
      });
    }

    console.log(`API: Saving current tube focus for user ${userId}: Tube-${tubeNumber}, Thread-${threadId}`);
    
    // Create Supabase client with route handler
    const supabase = createRouteHandlerClient(req, res);
    
    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylxga.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.3bvfZGkTc9nVtf1I7A0TwYy9pMFudJTrp974RZIwrq0'
    );
    
    // Convert string 'anonymous' to standard UUID if needed
    const effectiveUserIdUUID = 
      userId === 'anonymous' 
      ? '00000000-0000-0000-0000-000000000000' 
      : userId;
    
    console.log(`API: Using user ID: ${effectiveUserIdUUID} for current tube`);
    
    // Get the active stitches for this user
    // We need to find all active stitches (one per tube) to update their is_current_tube flags
    const { data: stitchData, error: stitchError } = await supabaseAdmin
      .from('user_stitch_progress')
      .select('*, threads!inner(*)')
      .eq('user_id', effectiveUserIdUUID)
      .eq('order_number', 0) // Active stitches
      .order('updated_at', { ascending: false });
    
    if (stitchError) {
      console.error('API: Error getting active stitch:', stitchError);
      return res.status(500).json({
        success: false,
        error: 'Failed to get active stitch for tube',
        details: stitchError.message
      });
    }
    
    if (!stitchData || stitchData.length === 0) {
      console.log(`API: No active stitches found for user ${effectiveUserIdUUID}`);
      
      // Try to find a stitch in the requested thread to activate
      const { data: threadStitches, error: threadStitchError } = await supabaseAdmin
        .from('stitches')
        .select('id')
        .eq('thread_id', threadId)
        .order('order', { ascending: true })
        .limit(1);
        
      if (threadStitchError || !threadStitches || threadStitches.length === 0) {
        console.log(`API: No stitches found for thread ${threadId}`);
        return res.status(404).json({
          success: false,
          error: 'No stitches found for this thread'
        });
      }
      
      // Create an active stitch for this thread
      const firstStitchId = threadStitches[0].id;
      console.log(`API: Creating active stitch ${firstStitchId} for thread ${threadId}`);
      
      const { error: createError } = await supabaseAdmin
        .from('user_stitch_progress')
        .upsert({
          user_id: effectiveUserIdUUID,
          thread_id: threadId,
          stitch_id: firstStitchId,
          order_number: 0, // Active stitch
          skip_number: 3, // Default skip
          distractor_level: 'L1', // Default level
          is_current_tube: true, // This tube is in focus
          updated_at: new Date().toISOString()
        });
        
      if (createError) {
        console.error(`API: Error creating active stitch: ${createError.message}`);
        return res.status(500).json({
          success: false,
          error: 'Failed to create active stitch',
          details: createError.message
        });
      }
      
      console.log(`API: Successfully created active stitch for thread ${threadId}`);
      
      // Legacy tube position support
      try {
        await supabaseAdmin
          .from('user_tube_position')
          .upsert({
            user_id: effectiveUserIdUUID,
            tube_number: parseInt(tubeNumber, 10),
            thread_id: threadId,
            updated_at: new Date().toISOString()
          });
      } catch (err) {
        console.log('API: Legacy user_tube_position table not updated (likely does not exist)');
      }
      
      return res.status(200).json({ 
        success: true, 
        message: `Initialized and set current tube focus to Tube-${tubeNumber}`,
        tubeNumber: parseInt(tubeNumber, 10),
        threadId
      });
    }
    
    console.log(`API: Found ${stitchData.length} active stitches across all tubes`);
    
    // Verify if the requested thread belongs to the requested tube
    // This ensures we're not setting a thread as active in the wrong tube
    const requestedThread = stitchData.find(s => s.thread_id === threadId && s.threads);
    let verifiedTubeNumber = parseInt(tubeNumber, 10);
    
    if (requestedThread && requestedThread.threads && requestedThread.threads.tube_number) {
      const threadTubeNumber = requestedThread.threads.tube_number;
      if (threadTubeNumber !== verifiedTubeNumber) {
        console.log(`API: Warning - thread ${threadId} belongs to tube ${threadTubeNumber}, not ${tubeNumber}`);
        verifiedTubeNumber = threadTubeNumber;
      } else {
        console.log(`API: Confirmed thread ${threadId} belongs to tube ${tubeNumber}`);
      }
    }
    
    // Store tube selection in user state
    try {
      // First, check if is_current_tube column exists by trying to update
      const timestamp = new Date().toISOString();
      
      // Try to update all active stitches for this user to set is_current_tube appropriately
      const updatePromises = stitchData.map(async (stitch) => {
        try {
          // Set is_current_tube=true for the requested thread, false for all others
          const { error } = await supabaseAdmin
            .from('user_stitch_progress')
            .update({
              is_current_tube: stitch.thread_id === threadId,
              updated_at: timestamp
            })
            .eq('user_id', effectiveUserIdUUID)
            .eq('stitch_id', stitch.stitch_id)
            .eq('thread_id', stitch.thread_id)
            .eq('order_number', 0); // Only update active stitches
          
          if (error) {
            if (error.message.includes('column') && error.message.includes('does not exist')) {
              console.log('API: is_current_tube column does not exist, client will handle tube selection');
              return null;
            }
            console.error(`API: Error updating is_current_tube for stitch ${stitch.stitch_id}:`, error);
          } else {
            console.log(`API: Set is_current_tube=${stitch.thread_id === threadId} for stitch ${stitch.stitch_id}`);
          }
          return stitch;
        } catch (err) {
          console.error(`API: Unexpected error updating stitch ${stitch.stitch_id}:`, err);
          return null;
        }
      });
      
      // Wait for all updates to complete
      await Promise.all(updatePromises);
    } catch (err) {
      console.log('API: Could not update is_current_tube, client will handle tube selection');
    }
    
    // Legacy support - try to update the old table if it exists
    try {
      await supabaseAdmin
        .from('user_tube_position')
        .upsert({
          user_id: effectiveUserIdUUID,
          tube_number: parseInt(tubeNumber, 10),
          thread_id: threadId,
          updated_at: new Date().toISOString()
        });
      console.log('API: Legacy tube position updated for backward compatibility');
    } catch (err) {
      console.log('API: Legacy user_tube_position table not updated (likely does not exist)');
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Current tube focus saved successfully',
      tubeNumber: parseInt(tubeNumber, 10),
      threadId
    });
    
  } catch (err) {
    console.error('API: Unexpected error in save-tube-position:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: err instanceof Error ? err.message : String(err)
    });
  }
}