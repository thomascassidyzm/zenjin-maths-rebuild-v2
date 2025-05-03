import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../lib/supabase/route';

/**
 * API endpoint for reordering stitches in a tube
 * Implements the Triple-Helix algorithm for stitch progression with perfect scores
 * 
 * This reorders all stitches for all threads in the same tube to maintain the 
 * complete progression system.
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
    const { 
      userId, 
      tubeNumber, 
      threadId, 
      completedStitchId, 
      skipNumber 
    } = req.body;
    
    // Validate inputs
    if (!userId || !tubeNumber || !threadId || !completedStitchId || !skipNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: { 
          userId: !!userId, 
          tubeNumber: !!tubeNumber, 
          threadId: !!threadId,
          completedStitchId: !!completedStitchId,
          skipNumber: !!skipNumber
        }
      });
    }
    
    // Security check: Allow diagnostic IDs or allow authenticated users to update their own progress
    const isDiagnosticUser = userId && typeof userId === 'string' && userId.startsWith('diag-');
    
    if (!isDiagnosticUser && authenticatedUserId && userId !== authenticatedUserId && userId !== 'anonymous') {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own progress'
      });
    }
    
    console.log(`API: Reordering stitches for user ${userId} in Tube-${tubeNumber}`);
    console.log(`API: Completed stitch ${completedStitchId} in thread ${threadId} with skip ${skipNumber}`);
    
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
    
    // CRITICAL FIX: First update the user's tube position to increment position value
    // This ensures that the client-side state will know this tube has advanced
    try {
      // First get the current position
      const { data: positionData, error: positionError } = await supabase
        .from('user_tube_position')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (positionError && positionError.code !== 'PGRST116') { // PGRST116 is "No rows returned"
        console.error('API: Error fetching tube position:', positionError);
      } else {
        // Update or create position as needed
        const currentPosition = positionData?.position || 0;
        const newPosition = currentPosition + 1;
        
        console.log(`API: Incrementing tube position from ${currentPosition} to ${newPosition} for tube ${tubeNumber}`);
        
        // Update position counter - this tracks how many times this tube has advanced
        const { error: updateError } = await supabase
          .from('user_tube_position')
          .upsert({
            user_id: userId,
            tube_number: tubeNumber,
            thread_id: threadId,
            position: newPosition,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });
          
        if (updateError) {
          console.error('API: Error updating tube position:', updateError);
        } else {
          console.log(`API: Successfully updated tube position to ${newPosition}`);
        }
      }
    } catch (posErr) {
      console.error('API: Exception updating tube position:', posErr);
    }
    
    // Step 1: Find all threads in this tube
    console.log(`API: Finding all thread IDs for threads in Tube-${tubeNumber}`);
    
    // Query user_stitch_progress to get all threadIds for this user
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
    
    // Step 2: Get all stitches from these threads with their current positions
    const { data: stitchData, error: stitchError } = await supabase
      .from('user_stitch_progress')
      .select('*')
      .eq('user_id', userId)
      .in('thread_id', tubeThreadIds)
      .order('order_number');
      
    if (stitchError) {
      console.error('API: Error fetching stitch data:', stitchError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch stitch data',
        details: stitchError.message
      });
    }
    
    console.log(`API: Found ${stitchData.length} stitches across all threads in Tube-${tubeNumber}`);
    
    // Step 3: Implement the Triple-Helix algorithm
    // The algorithm involves:
    // 1. Decrement all stitches with order_number between 1 and skipNumber by 1
    // 2. Place the completed stitch at position skipNumber
    // 3. Ensure exactly one stitch has order_number=0 (ready state)
    
    // Track all updates that need to be made
    const stitchUpdates = [];
    
    // First find the stitch that was just completed (it should be at position 0)
    const completedStitch = stitchData.find(s => s.stitch_id === completedStitchId);
    if (!completedStitch) {
      // If completed stitch is not found, log warning but continue with other processing
      console.warn(`API: Completed stitch ${completedStitchId} not found in tube data!`);
    } else {
      console.log(`API: Found completed stitch ${completedStitchId} at position ${completedStitch.order_number}`);
      
      // Ensure it's moved to the skipNumber position
      stitchUpdates.push({
        stitch_id: completedStitchId,
        thread_id: threadId,
        order_number: skipNumber
      });
    }
    
    // Check if we need to create a new ready stitch
    // In the Triple Helix model, a new stitch becomes ready (position 0) after a perfect score
    // Generate a new stitch ID for consistency with client
    const newStitchId = `stitch-${threadId.replace('thread-', '')}-${Date.now().toString(36)}`;
    
    // Track which stitch will become the new ready stitch
    let newReadyStitchId = null;
    let newReadyStitchThreadId = null;
    
    // Find the stitch that was at position 1 (it will become the new ready stitch)
    const nextReadyStitch = stitchData.find(stitch => 
      stitch.thread_id === threadId && 
      stitch.stitch_id !== completedStitchId && 
      stitch.order_number === 1
    );
    
    if (nextReadyStitch) {
      newReadyStitchId = nextReadyStitch.stitch_id;
      newReadyStitchThreadId = nextReadyStitch.thread_id;
      console.log(`API: Found stitch at position 1 that will become the new ready stitch: ${newReadyStitchId}`);
    } else {
      console.log(`API: No stitch found at position 1 to become the new ready stitch, will create a new one`);
    }
    
    // Decrement positions of all stitches in the range 1 to skipNumber
    stitchData.forEach(stitch => {
      // Skip the stitch that was just completed (it gets special handling above)
      if (stitch.stitch_id === completedStitchId) {
        return;
      }
      
      // If this stitch is in positions 1 through skipNumber, decrement its position
      if (stitch.order_number >= 1 && stitch.order_number <= skipNumber) {
        const newPosition = stitch.order_number - 1;
        console.log(`API: Decrementing stitch ${stitch.stitch_id} from position ${stitch.order_number} to ${newPosition}`);
        
        // Add to updates
        stitchUpdates.push({
          stitch_id: stitch.stitch_id,
          thread_id: stitch.thread_id,
          order_number: newPosition
        });
        
        // CRITICAL: If this is the stitch that was at position 1, make sure it becomes position 0
        if (stitch.stitch_id === newReadyStitchId) {
          console.log(`API: CRITICAL - Ensuring stitch ${stitch.stitch_id} becomes the new ready stitch at position 0`);
        }
      }
    });
    
    // Step 4: Check integrity - ensure exactly one stitch has order_number=0
    // Count how many stitches will have order_number=0 after updates
    const readyStitches = stitchData.filter(stitch => {
      // Skip the completed stitch since it's moving to skipNumber
      if (stitch.stitch_id === completedStitchId) {
        return false;
      }
      
      // Check if it's already at position 0
      if (stitch.order_number === 0) {
        return true;
      }
      
      // Check if it will become position 0 after our updates
      const update = stitchUpdates.find(u => u.stitch_id === stitch.stitch_id);
      return update && update.order_number === 0;
    });
    
    console.log(`API: After updates, ${readyStitches.length} stitches will have order_number=0`);
    
    // CRITICAL FIX: If we found a stitch at position 1, that should be our primary candidate for position 0
    if (newReadyStitchId) {
      console.log(`API: Prioritizing stitch ${newReadyStitchId} from position 1 to become the new ready stitch`);
      
      // Check if it's already set to be moved to position 0
      const existingUpdate = stitchUpdates.find(u => u.stitch_id === newReadyStitchId);
      if (existingUpdate && existingUpdate.order_number !== 0) {
        console.log(`API: Correcting position for stitch ${newReadyStitchId} to ensure it becomes position 0`);
        existingUpdate.order_number = 0;
      }
      
      // Check for any other stitches that would end up at position 0 and move them to position 1+
      const otherZeroStitches = stitchUpdates.filter(u => 
        u.stitch_id !== newReadyStitchId && 
        u.order_number === 0
      );
      
      if (otherZeroStitches.length > 0) {
        console.log(`API: Found ${otherZeroStitches.length} other stitches that would become position 0, reassigning them`);
        let position = 1;
        
        otherZeroStitches.forEach(update => {
          console.log(`API: Reassigning stitch ${update.stitch_id} from position 0 to position ${position}`);
          update.order_number = position++;
        });
      }
    }
    // If no ready stitch will exist and we didn't find a stitch at position 1, create a new one
    else if (readyStitches.length === 0) {
      console.log(`API: No ready stitch found and no stitch at position 1, creating a new stitch at position 0: ${newStitchId}`);
      
      // We need to insert a new stitch with order_number=0
      const { data, error } = await supabase
        .from('user_stitch_progress')
        .insert({
          user_id: userId,
          thread_id: threadId,
          stitch_id: newStitchId,
          order_number: 0,
          skip_number: 3, // Initial skip number
          distractor_level: 'L1' // Initial distractor level
        });
        
      if (error) {
        console.error('API: Error creating new ready stitch:', error);
      } else {
        console.log(`API: Successfully created new ready stitch ${newStitchId}`);
      }
    } 
    // If multiple ready stitches will exist, prioritize the one that was at position 1
    else if (readyStitches.length > 1) {
      console.log(`API: Multiple ready stitches (${readyStitches.length}), prioritizing based on position`);
      
      // First check if our next ready stitch from position 1 is among them
      let keepReadyStitchId = newReadyStitchId;
      
      // If we didn't find a stitch from position 1, choose the first one alphabetically
      if (!keepReadyStitchId) {
        console.log(`API: No stitch from position 1 found, choosing the first one alphabetically`);
        readyStitches.sort((a, b) => a.thread_id.localeCompare(b.thread_id));
        keepReadyStitchId = readyStitches[0].stitch_id;
      }
      
      console.log(`API: Keeping stitch ${keepReadyStitchId} at position 0`);
      
      // Demote all other ready stitches
      let position = 1;
      for (const readyStitch of readyStitches) {
        if (readyStitch.stitch_id === keepReadyStitchId) continue;
        
        console.log(`API: Demoting extra ready stitch ${readyStitch.stitch_id} to position ${position}`);
        
        // Add or update this stitch's position
        const existingUpdate = stitchUpdates.find(u => u.stitch_id === readyStitch.stitch_id);
        if (existingUpdate) {
          existingUpdate.order_number = position;
        } else {
          stitchUpdates.push({
            stitch_id: readyStitch.stitch_id,
            thread_id: readyStitch.thread_id,
            order_number: position
          });
        }
        
        position++;
      }
    } else {
      console.log(`API: One ready stitch will exist after reordering, which is correct`);
      
      // Check if it's our desired stitch from position 1
      const readyStitch = readyStitches[0];
      if (readyStitch.stitch_id !== newReadyStitchId && newReadyStitchId) {
        console.log(`API: Current ready stitch ${readyStitch.stitch_id} is not the one from position 1, adjusting`);
        
        // Set the stitch from position 1 to position 0
        stitchUpdates.push({
          stitch_id: newReadyStitchId,
          thread_id: newReadyStitchThreadId,
          order_number: 0
        });
        
        // Move the other ready stitch to position 1
        stitchUpdates.push({
          stitch_id: readyStitch.stitch_id,
          thread_id: readyStitch.thread_id,
          order_number: 1
        });
      }
    }
    
    // Step 5: Apply all updates to the database
    console.log(`API: Applying ${stitchUpdates.length} stitch position updates to database`);
    
    // Use an array to track promises for updates
    const updatePromises = [];
    
    for (const update of stitchUpdates) {
      const { stitch_id, thread_id, order_number } = update;
      
      console.log(`API: Updating stitch ${stitch_id} to position ${order_number}`);
      
      const updatePromise = supabase
        .from('user_stitch_progress')
        .update({ order_number })
        .eq('user_id', userId)
        .eq('thread_id', thread_id)
        .eq('stitch_id', stitch_id);
        
      updatePromises.push(updatePromise);
    }
    
    // Wait for all updates to complete
    const updateResults = await Promise.all(updatePromises);
    
    // Check for any errors
    const errors = updateResults
      .map((result, index) => ({
        error: result.error,
        stitch: stitchUpdates[index].stitch_id
      }))
      .filter(item => item.error);
      
    if (errors.length > 0) {
      console.error(`API: ${errors.length} errors occurred during updates:`, errors);
      
      // Continue anyway - partial success is better than complete failure
      console.log(`API: ${updateResults.length - errors.length} updates were successful`);
    } else {
      console.log(`API: All ${updateResults.length} updates completed successfully`);
    }
    
    // Return success with information about the reordering
    return res.status(200).json({
      success: true,
      message: 'Stitch positions reordered successfully',
      stats: {
        totalStitches: stitchData.length,
        updatedStitches: stitchUpdates.length,
        successfulUpdates: updateResults.length - errors.length,
        failedUpdates: errors.length,
        newStitchId,
        tubePosition: {
          tubeNumber,
          threadId,
          incremented: true
        }
      }
    });
    
  } catch (err) {
    console.error('API: Unexpected error in reorder-tube-stitches API:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: err instanceof Error ? err.message : String(err)
    });
  }
}