import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * API endpoint to completely reset a user's progress
 * Deletes all user_stitch_progress and user_tube_position entries
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    // Get userId from request body
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Create admin Supabase client with service role for direct access
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    console.log(`Resetting progress for user: ${userId}`);

    // Delete all user_stitch_progress entries
    const { error: progressError } = await supabaseAdmin
      .from('user_stitch_progress')
      .delete()
      .eq('user_id', userId);

    if (progressError) {
      console.error('Error deleting user progress:', progressError);
      return res.status(500).json({
        success: false,
        error: `Error deleting user progress: ${progressError.message}`
      });
    }

    // Reset is_current_tube on all user_stitch_progress entries (may not exist)
    try {
      const { error: resetCurrentError } = await supabaseAdmin
        .from('user_stitch_progress')
        .update({ is_current_tube: false })
        .eq('user_id', userId);

      if (resetCurrentError && !resetCurrentError.message.includes('does not exist')) {
        console.error('Error resetting is_current_tube on stitch progress:', resetCurrentError);
      }
    } catch (err) {
      console.log('is_current_tube column likely does not exist, continuing...');
    }
    
    // Delete any special tube entries from user_stitch_progress for backward compatibility
    try {
      const { error: tubePositionError } = await supabaseAdmin
        .from('user_stitch_progress')
        .delete()
        .eq('user_id', userId)
        .like('stitch_id', 'tube:%');

      if (tubePositionError) {
        console.log('Note: Unable to delete tube entries (likely do not exist):', tubePositionError.message);
      }
    } catch (err) {
      console.log('Error checking for special tube entries, continuing...');
    }
    
    // Try to delete from legacy user_tube_position table (may not exist)
    try {
      const { error: positionError } = await supabaseAdmin
        .from('user_tube_position')
        .delete()
        .eq('user_id', userId);

      if (positionError) {
        console.log('Note: Legacy tube position table may not exist:', positionError.message);
      }
    } catch (err) {
      console.log('Legacy user_tube_position table likely does not exist, continuing...');
    }

    // Query for valid thread IDs from database
    const { data: threads, error: threadError } = await supabaseAdmin
      .from('threads')
      .select('id')
      .like('id', 'thread-T1-%')
      .order('id')
      .limit(1);

    if (threadError) {
      console.error('Error fetching valid thread:', threadError);
      return res.status(500).json({
        success: false,
        error: `Error fetching valid thread: ${threadError.message}`
      });
    }

    let validThreadId: string | null = null;
    
    // Find a valid thread for Tube 1 (new format)
    if (threads && threads.length > 0) {
      validThreadId = threads[0].id;
    } else {
      // Fallback to any thread if no thread-T1-* format is found
      const { data: anyThreads, error: anyThreadError } = await supabaseAdmin
        .from('threads')
        .select('id')
        .order('id')
        .limit(1);
      
      if (anyThreadError) {
        console.error('Error fetching any thread:', anyThreadError);
        // Continue anyway, we'll handle this case
      } else if (anyThreads && anyThreads.length > 0) {
        validThreadId = anyThreads[0].id;
      }
    }

    // Only set up default tube position if we found a valid thread
    if (validThreadId) {
      console.log(`Setting up default tube position with thread: ${validThreadId}`);
      
      // Get stitches for this thread
      const { data: threadStitches, error: getStitchesError } = await supabaseAdmin
        .from('stitches')
        .select('id')
        .eq('thread_id', validThreadId)
        .order('order', { ascending: true })
        .limit(1);
        
      if (getStitchesError) {
        console.error('Error getting stitches for thread:', getStitchesError);
        return res.status(500).json({
          success: false,
          error: `Error getting stitches for thread: ${getStitchesError.message}`
        });
      }
      
      if (!threadStitches || threadStitches.length === 0) {
        console.warn(`No stitches found for thread ${validThreadId}`);
        return res.status(500).json({
          success: false,
          error: `No stitches found for thread ${validThreadId}`
        });
      }
      
      // Use the first stitch from the thread as the initial active stitch
      const firstStitchId = threadStitches[0].id;
      
      // Set up default stitch progress with this stitch as order_number 0 (active)
      // and is_current_tube = true (this tube is in focus)
      const { error } = await supabaseAdmin
        .from('user_stitch_progress')
        .upsert({
          user_id: userId,
          thread_id: validThreadId,
          stitch_id: firstStitchId,
          order_number: 0, // Active stitch
          skip_number: 3, // Default skip
          distractor_level: 'L1', // Default level
          is_current_tube: true, // This tube is in focus
          updated_at: new Date().toISOString()
        });

      if (error) {
        // If is_current_tube doesn't exist, try without it
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          console.log('is_current_tube column does not exist, trying without it');
          
          const { error: basicError } = await supabaseAdmin
            .from('user_stitch_progress')
            .upsert({
              user_id: userId,
              thread_id: validThreadId,
              stitch_id: firstStitchId,
              order_number: 0, // Active stitch
              skip_number: 3, // Default skip
              distractor_level: 'L1', // Default level
              updated_at: new Date().toISOString()
            });
            
          if (basicError) {
            // Final attempt with minimal fields
            const { error: minimalError } = await supabaseAdmin
              .from('user_stitch_progress')
              .upsert({
                user_id: userId,
                thread_id: validThreadId,
                stitch_id: firstStitchId,
                order_number: 0 // Just set active stitch
              });
              
            if (minimalError) {
              console.error('Error setting up initial stitch progress:', minimalError);
              return res.status(500).json({
                success: false,
                error: `Error setting up initial stitch progress: ${minimalError.message}`
              });
            }
          }
        }
      }
      
      // Legacy support - try to update old tables too for backward compatibility
      try {
        // Special stitch format
        await supabaseAdmin
          .from('user_stitch_progress')
          .upsert({
            user_id: userId,
            thread_id: validThreadId,
            stitch_id: 'tube:1',
            order_number: 1,
            updated_at: new Date().toISOString()
          });
          
        // Legacy tube position table  
        await supabaseAdmin
          .from('user_tube_position')
          .upsert({
            user_id: userId,
            tube_number: 1,
            thread_id: validThreadId,
            updated_at: new Date().toISOString()
          });
          
        console.log('Legacy tube position records updated for backward compatibility');
      } catch (err) {
        console.log('Legacy tables not updated (may not exist)');
      }
    } else {
      console.warn('No valid threads found in database. Skipping tube position setup.');
    }

    // Return success
    return res.status(200).json({
      success: true,
      message: 'User progress reset successfully',
      threadId: validThreadId
    });
  } catch (error) {
    console.error('Error in reset-user-progress API:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Server error resetting user progress'
    });
  }
}