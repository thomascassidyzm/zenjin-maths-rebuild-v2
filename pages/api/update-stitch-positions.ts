import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../lib/supabase/route';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { userId, stitches } = req.body;
    
    if (!userId || !stitches || !Array.isArray(stitches)) {
      return res.status(400).json({ success: false, message: 'Invalid request data' });
    }
    
    console.log(`API: Processing update-stitch-positions for ${userId} with ${stitches.length} stitches`);
    
    // Create a Supabase client with proper auth context
    const supabase = createRouteHandlerClient(req, res);
    
    // Create a direct admin client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylxga.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.3bvfZGkTc9nVtf1I7A0TwYy9pMFudJTrp974RZIwrq0'
    );
    
    // CRITICAL FIX: First, validate stitch positions to ensure uniqueness
    // This prevents conflicts from occurring at the database level
    
    // Extract tube number from each stitch ID (format: stitch-T{tubeNum}-...)
    // And group stitches by tube number
    const stitchesByTube = {
      1: [],
      2: [],
      3: []
    };
    
    stitches.forEach(stitch => {
      // Extract tube number from stitch ID
      const tubeMatch = stitch.stitchId.match(/stitch-T(\d+)-/);
      let tubeNumber = null;
      
      if (tubeMatch && tubeMatch[1]) {
        tubeNumber = parseInt(tubeMatch[1]);
      } else if (stitch.tubeNumber) {
        // Use explicit tube number if provided
        tubeNumber = stitch.tubeNumber;
      } else {
        // Try to extract from thread ID as fallback
        const threadMatch = stitch.threadId?.match(/thread-T(\d+)-/);
        if (threadMatch && threadMatch[1]) {
          tubeNumber = parseInt(threadMatch[1]);
        }
      }
      
      // If we have a valid tube number, add to the appropriate group
      if (tubeNumber && [1, 2, 3].includes(tubeNumber)) {
        stitchesByTube[tubeNumber].push(stitch);
      } else {
        console.warn(`Could not determine tube number for stitch ${stitch.stitchId}, thread ${stitch.threadId}`);
      }
    });
    
    // For each tube, validate and fix position conflicts
    for (const [tubeNumber, tubeStitches] of Object.entries(stitchesByTube)) {
      if (tubeStitches.length === 0) continue;
      
      // Check for duplicated positions within this tube
      const positionMap = new Map();
      tubeStitches.forEach(stitch => {
        const position = stitch.orderNumber;
        if (!positionMap.has(position)) {
          positionMap.set(position, []);
        }
        positionMap.get(position).push(stitch);
      });
      
      // Find conflicts (multiple stitches at the same position)
      let hasConflicts = false;
      for (const [position, conflictStitches] of positionMap.entries()) {
        if (conflictStitches.length > 1) {
          hasConflicts = true;
          console.warn(`Position conflict detected at position ${position} in tube ${tubeNumber}. ${conflictStitches.length} stitches have the same position.`);
          
          // Keep the first one at this position, adjust others
          for (let i = 1; i < conflictStitches.length; i++) {
            let newPosition = parseInt(position) + i;
            
            // Make sure the new position is not already taken
            while (positionMap.has(newPosition) && positionMap.get(newPosition).length > 0) {
              newPosition++;
            }
            
            console.log(`Fixing conflict: Moving stitch ${conflictStitches[i].stitchId} from position ${position} to ${newPosition}`);
            conflictStitches[i].orderNumber = newPosition;
            
            // Update the position map
            if (!positionMap.has(newPosition)) {
              positionMap.set(newPosition, []);
            }
            positionMap.get(newPosition).push(conflictStitches[i]);
          }
        }
      }
      
      if (hasConflicts) {
        console.log(`Fixed position conflicts in tube ${tubeNumber}`);
      }
    }
    
    // Fetch existing stitch progress from database
    const { data: existingProgress, error: fetchError } = await supabaseAdmin
      .from('user_stitch_progress')
      .select('thread_id, stitch_id, order_number')
      .eq('user_id', userId);
    
    if (fetchError) {
      console.error('Error fetching existing stitch progress:', fetchError);
      return res.status(500).json({ 
        success: false, 
        message: 'Error fetching existing stitch progress', 
        error: fetchError.message 
      });
    }
    
    // Process existing records to map by tube number
    const existingPositionsByTube = {
      1: new Map(),
      2: new Map(),
      3: new Map()
    };
    
    if (existingProgress) {
      existingProgress.forEach(record => {
        const { thread_id, order_number, stitch_id } = record;
        
        // Extract tube number from stitch ID
        const tubeMatch = stitch_id.match(/stitch-T(\d+)-/);
        let tubeNumber = null;
        
        if (tubeMatch && tubeMatch[1]) {
          tubeNumber = parseInt(tubeMatch[1]);
        } else {
          // Try to extract from thread ID as fallback
          const threadMatch = thread_id?.match(/thread-T(\d+)-/);
          if (threadMatch && threadMatch[1]) {
            tubeNumber = parseInt(threadMatch[1]);
          }
        }
        
        // If we have a valid tube number, record the position
        if (tubeNumber && [1, 2, 3].includes(tubeNumber)) {
          existingPositionsByTube[tubeNumber].set(order_number, stitch_id);
        }
      });
    }
    
    // Further check for conflicts with existing database records
    const stitchesWithUpdates = [];
    
    stitches.forEach(stitch => {
      const { stitchId, orderNumber } = stitch;
      let finalOrderNumber = orderNumber;
      
      // Extract tube number from stitch ID
      const tubeMatch = stitchId.match(/stitch-T(\d+)-/);
      let tubeNumber = null;
      
      if (tubeMatch && tubeMatch[1]) {
        tubeNumber = parseInt(tubeMatch[1]);
      } else if (stitch.tubeNumber) {
        tubeNumber = stitch.tubeNumber;
      } else {
        // Try thread ID as fallback
        const threadMatch = stitch.threadId?.match(/thread-T(\d+)-/);
        if (threadMatch && threadMatch[1]) {
          tubeNumber = parseInt(threadMatch[1]);
        }
      }
      
      // If we have a valid tube number, check for conflicts
      if (tubeNumber && [1, 2, 3].includes(tubeNumber)) {
        // Check if this position conflicts with an existing stitch (other than this one)
        if (existingPositionsByTube[tubeNumber].has(orderNumber) && 
            existingPositionsByTube[tubeNumber].get(orderNumber) !== stitchId) {
          
          console.warn(`Detected conflict with existing database record: position ${orderNumber} in tube ${tubeNumber} is already used by stitch ${existingPositionsByTube[tubeNumber].get(orderNumber)}`);
          
          // Find the next available position
          let newPosition = orderNumber + 1;
          while (existingPositionsByTube[tubeNumber].has(newPosition)) {
            newPosition++;
          }
          
          console.log(`Resolving conflict: Assigning position ${newPosition} to stitch ${stitchId} instead of ${orderNumber}`);
          finalOrderNumber = newPosition;
          
          // Update the stitch's order number
          stitch.orderNumber = finalOrderNumber;
          
          // Mark this position as used
          existingPositionsByTube[tubeNumber].set(finalOrderNumber, stitchId);
        }
      }
      
      // Add to the list of stitches to update
      stitchesWithUpdates.push(stitch);
    });
    
    // Now process the updated stitch list in batches
    const batchSize = 10;
    const results = [];
    
    for (let i = 0; i < stitchesWithUpdates.length; i += batchSize) {
      const batch = stitchesWithUpdates.slice(i, i + batchSize);
      
      // Process this batch in parallel
      const batchPromises = batch.map(async (stitch) => {
        const { 
          threadId, 
          stitchId, 
          orderNumber, 
          skipNumber, 
          distractorLevel, 
          tubeNumber,
          currentStitchId 
        } = stitch;
        
        try {
          // Directly upsert into user_stitch_progress table
          const { data, error } = await supabaseAdmin
            .from('user_stitch_progress')
            .upsert({
              user_id: userId,
              thread_id: threadId,
              stitch_id: stitchId,
              order_number: orderNumber,
              skip_number: skipNumber || 1, // Default to 1 if not provided
              distractor_level: distractorLevel || 'L1', // Default to L1 if not provided
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,thread_id,stitch_id' });
          
          if (error) {
            console.error(`API: Error updating stitch ${stitchId}:`, error);
            return { stitchId, success: false, error: error.message };
          }
          
          // Note: We're skipping tube_position updates since that table doesn't exist
          // Just mark the stitch as being the current one in the logs
          if (currentStitchId) {
            console.log(`Stitch ${stitchId} is marked as current stitch for thread ${threadId}`);
          }
          
          return { stitchId, success: true, orderNumber };
        } catch (error: any) {
          console.error(`API: Exception updating stitch ${stitchId}:`, error);
          return { stitchId, success: false, error: error.message };
        }
      });
      
      // Wait for this batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add a small delay between batches to avoid overwhelming the database
      if (i + batchSize < stitchesWithUpdates.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // Check for any failures
    const failures = results.filter(r => !r.success);
    
    if (failures.length > 0) {
      console.error(`API: ${failures.length} failures updating stitch positions:`, failures);
      return res.status(207).json({ 
        success: true, 
        message: 'Some stitch positions failed to update',
        results: results
      });
    }
    
    console.log(`API: Successfully updated ${stitchesWithUpdates.length} stitch positions for user ${userId}`);
    
    // Return success response with modification count
    return res.status(200).json({ 
      success: true, 
      message: 'Stitch positions updated successfully',
      count: stitchesWithUpdates.length
    });
  } catch (error: any) {
    console.error('API: Error updating stitch positions:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message
    });
  }
}