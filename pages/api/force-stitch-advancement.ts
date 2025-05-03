import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../lib/supabase/route';

/**
 * API endpoint to force stitch advancement for a user in a specific tube
 * This endpoint ensures stitch positions are properly updated in the database
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  try {
    // Create a Supabase client with proper auth context
    const supabase = createRouteHandlerClient(req, res);
    
    // Get authenticated user
    const { data: { session } } = await supabase.auth.getSession();
    const authenticatedUserId = session?.user?.id;
    
    // Get request body
    const { userId, tubeNumber } = req.body;
    
    // Validate inputs
    if (!userId || !tubeNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: { 
          userId: !!userId, 
          tubeNumber: !!tubeNumber
        }
      });
    }
    
    // Security check: Allow authenticated users to update their own progress
    const isDiagnosticUser = userId && typeof userId === 'string' && userId.startsWith('diag-');
    
    if (!isDiagnosticUser && authenticatedUserId && userId !== authenticatedUserId && userId !== 'anonymous') {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own progress'
      });
    }
    
    console.log(`API: Force stitch advancement for user ${userId} in Tube-${tubeNumber}`);
    
    // The threads that share a tube will be from threadIds with specific letters:
    // Tube-1: thread-A, thread-D
    // Tube-2: thread-B, thread-E
    // Tube-3: thread-C, thread-F
    const threadLetterMap = {
      1: ['A', 'D', 'G', 'J'], // Tube-1 threads
      2: ['B', 'E', 'H', 'K'], // Tube-2 threads
      3: ['C', 'F', 'I', 'L']  // Tube-3 threads
    };
    
    // Get the letters for the current tube
    const tubeThreadLetters = threadLetterMap[tubeNumber] || [];
    
    // Step 1: Query user_stitch_progress to get all threadIds for this user
    const { data: progressData, error: progressError } = await supabase
      .from('user_stitch_progress')
      .select('thread_id')
      .eq('user_id', userId)
      .order('thread_id');
      
    if (progressError) {
      console.error('API: Error fetching thread IDs:', progressError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch thread IDs',
        details: progressError.message
      });
    }
    
    // Extract unique threadIds
    const allThreadIds = [...new Set(progressData.map(p => p.thread_id))];
    console.log(`API: Found ${allThreadIds.length} threads for user ${userId}`);
    
    // Filter to just the threads in this tube
    const tubeThreadIds = allThreadIds.filter(id => {
      const match = id.match(/thread-([A-Z])/);
      if (match && match[1]) {
        const threadLetter = match[1];
        return tubeThreadLetters.includes(threadLetter);
      }
      return false;
    });
    
    console.log(`API: Filtered to ${tubeThreadIds.length} threads in Tube-${tubeNumber}: ${tubeThreadIds.join(', ')}`);
    
    if (tubeThreadIds.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No threads found for Tube-${tubeNumber}`
      });
    }
    
    // Select the primary thread for this tube (first one)
    const primaryThreadId = tubeThreadIds[0];
    
    // Step 2: Get all stitches in this thread
    const { data: stitchData, error: stitchError } = await supabase
      .from('user_stitch_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('thread_id', primaryThreadId)
      .order('order_number');
      
    if (stitchError) {
      console.error('API: Error fetching stitch data:', stitchError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch stitch data',
        details: stitchError.message
      });
    }
    
    console.log(`API: Found ${stitchData.length} stitches in thread ${primaryThreadId}`);
    
    // Find the currently active stitch (order_number = 0)
    const activeStitch = stitchData.find(s => s.order_number === 0);
    
    if (!activeStitch) {
      return res.status(404).json({
        success: false,
        error: `No active stitch found in thread ${primaryThreadId}`
      });
    }
    
    console.log(`API: Currently active stitch is ${activeStitch.stitch_id} with position ${activeStitch.order_number}`);
    
    // Find the next stitch that should become active (order_number = 1)
    const nextActiveStitch = stitchData.find(s => s.order_number === 1);
    
    if (!nextActiveStitch) {
      console.log(`API: No next stitch found at position 1, creating a new one`);
      
      // Create a new stitch ID
      const newStitchId = `stitch-${primaryThreadId.replace('thread-', '')}-${Date.now().toString(36)}`;
      
      // Add the stitch to the database
      const { error: insertError } = await supabase
        .from('user_stitch_progress')
        .insert({
          user_id: userId,
          thread_id: primaryThreadId,
          stitch_id: newStitchId,
          order_number: 0,
          skip_number: 3,
          distractor_level: 'L1'
        });
        
      if (insertError) {
        console.error('API: Error creating new stitch:', insertError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create new stitch',
          details: insertError.message
        });
      }
      
      // Move the current active stitch to the skip position
      const skipNumber = activeStitch.skip_number || 3;
      const { error: updateError } = await supabase
        .from('user_stitch_progress')
        .update({ order_number: skipNumber })
        .eq('user_id', userId)
        .eq('thread_id', primaryThreadId)
        .eq('stitch_id', activeStitch.stitch_id);
        
      if (updateError) {
        console.error('API: Error updating active stitch position:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update active stitch position',
          details: updateError.message
        });
      }
      
      // Update the tube position (increment by 1)
      try {
        // Get current position
        const { data: positionData, error: positionError } = await supabase
          .from('user_tube_position')
          .select('position')
          .eq('user_id', userId)
          .eq('tube_number', tubeNumber)
          .single();
        
        const currentPosition = positionData?.position || 0;
        const newPosition = currentPosition + 1;
        
        // Update the position
        const { error: updatePositionError } = await supabase
          .from('user_tube_position')
          .upsert({
            user_id: userId,
            tube_number: tubeNumber,
            thread_id: primaryThreadId,
            position: newPosition,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,tube_number'
          });
          
        if (updatePositionError) {
          console.error('API: Error updating tube position:', updatePositionError);
        }
      } catch (err) {
        console.error('API: Error updating tube position:', err);
      }
      
      return res.status(200).json({
        success: true,
        message: 'Stitch advancement successful',
        data: {
          previousStitchId: activeStitch.stitch_id,
          newStitchId: newStitchId,
          threadId: primaryThreadId,
          tubeNumber: tubeNumber,
          positionIncremented: true
        }
      });
    } else {
      console.log(`API: Found next stitch ${nextActiveStitch.stitch_id} at position 1`);
      
      // Move the current active stitch to the skip position
      const skipNumber = activeStitch.skip_number || 3;
      const { error: updateCurrentError } = await supabase
        .from('user_stitch_progress')
        .update({ order_number: skipNumber })
        .eq('user_id', userId)
        .eq('thread_id', primaryThreadId)
        .eq('stitch_id', activeStitch.stitch_id);
        
      if (updateCurrentError) {
        console.error('API: Error updating active stitch position:', updateCurrentError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update active stitch position',
          details: updateCurrentError.message
        });
      }
      
      // Move the next stitch to position 0
      const { error: updateNextError } = await supabase
        .from('user_stitch_progress')
        .update({ order_number: 0 })
        .eq('user_id', userId)
        .eq('thread_id', primaryThreadId)
        .eq('stitch_id', nextActiveStitch.stitch_id);
        
      if (updateNextError) {
        console.error('API: Error updating next stitch position:', updateNextError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update next stitch position',
          details: updateNextError.message
        });
      }
      
      // Update all stitches between 2 and skipNumber
      const stitchesToUpdate = stitchData.filter(s => s.order_number > 1 && s.order_number < skipNumber);
      
      for (const stitch of stitchesToUpdate) {
        const { error: updateError } = await supabase
          .from('user_stitch_progress')
          .update({ order_number: stitch.order_number - 1 })
          .eq('user_id', userId)
          .eq('thread_id', primaryThreadId)
          .eq('stitch_id', stitch.stitch_id);
          
        if (updateError) {
          console.error(`API: Error updating stitch ${stitch.stitch_id} position:`, updateError);
        }
      }
      
      // Update the tube position (increment by 1)
      try {
        // Get current position
        const { data: positionData, error: positionError } = await supabase
          .from('user_tube_position')
          .select('position')
          .eq('user_id', userId)
          .eq('tube_number', tubeNumber)
          .single();
        
        const currentPosition = positionData?.position || 0;
        const newPosition = currentPosition + 1;
        
        // Update the position
        const { error: updatePositionError } = await supabase
          .from('user_tube_position')
          .upsert({
            user_id: userId,
            tube_number: tubeNumber,
            thread_id: primaryThreadId,
            position: newPosition,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,tube_number'
          });
          
        if (updatePositionError) {
          console.error('API: Error updating tube position:', updatePositionError);
        }
      } catch (err) {
        console.error('API: Error updating tube position:', err);
      }
      
      return res.status(200).json({
        success: true,
        message: 'Stitch advancement successful',
        data: {
          previousStitchId: activeStitch.stitch_id,
          newStitchId: nextActiveStitch.stitch_id,
          threadId: primaryThreadId,
          tubeNumber: tubeNumber,
          positionIncremented: true
        }
      });
    }
  } catch (err) {
    console.error('API: Unexpected error in force-stitch-advancement API:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: err instanceof Error ? err.message : String(err)
    });
  }
}