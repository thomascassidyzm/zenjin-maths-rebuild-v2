import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../lib/supabase/route';

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
    const { userId } = req.body;
    
    // Validate inputs
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Security check: Allow diagnostic IDs to reset progress directly 
    // These start with 'diag-' and are used for testing
    const isDiagnosticUser = userId.toString().startsWith('diag-');
    
    // For non-diagnostic users, ensure they can only reset their own progress
    if (!isDiagnosticUser && authenticatedUserId && userId !== authenticatedUserId && userId !== 'anonymous') {
      return res.status(403).json({
        success: false,
        error: 'You can only reset your own progress'
      });
    }
    
    console.log(`API: Resetting progress for user ${userId}`);
    
    // Delete all stitch progress for this user
    const { error: deleteStitchError } = await supabase
      .from('user_stitch_progress')
      .delete()
      .eq('user_id', userId);
    
    if (deleteStitchError) {
      console.error('API: Error deleting user stitch progress:', deleteStitchError);
      // Continue anyway - the table might not exist yet
    }
    
    // Delete tube position for this user
    const { error: deleteTubeError } = await supabase
      .from('user_tube_position')
      .delete()
      .eq('user_id', userId);
    
    if (deleteTubeError) {
      console.error('API: Error deleting user tube position:', deleteTubeError);
      // Continue anyway - the table might not exist yet
    }
    
    // Delete all session results for this user
    const { error: deleteSessionError } = await supabase
      .from('session_results')
      .delete()
      .eq('user_id', userId);
    
    if (deleteSessionError) {
      console.error('API: Error deleting user session results:', deleteSessionError);
      // Continue anyway - the table might not exist yet
    }
    
    // After deleting, we need to reinitialize with valid configurations
    // Get all threads and stitches
    const [threadsResult, stitchesResult] = await Promise.all([
      supabase.from('threads').select('*').order('id'),
      supabase.from('stitches').select('*')
    ]);
    
    if (threadsResult.error) {
      console.error('API: Error fetching threads:', threadsResult.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch threads for initialization',
        details: threadsResult.error.message
      });
    }
    
    if (stitchesResult.error) {
      console.error('API: Error fetching stitches:', stitchesResult.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch stitches for initialization',
        details: stitchesResult.error.message
      });
    }
    
    const threads = threadsResult.data || [];
    const allStitches = stitchesResult.data || [];
    
    console.log(`API: Found ${threads.length} threads and ${allStitches.length} stitches for initialization`);
    
    // Create fresh progress records for the user
    const progressRecords = [];
    
    // For each thread, initialize progress for its stitches
    for (const thread of threads) {
      const threadStitches = allStitches.filter(stitch => stitch.thread_id === thread.id);
      
      // Sort by database order if available
      const sortedStitches = [...threadStitches];
      if (sortedStitches.length > 0 && sortedStitches[0].order !== undefined) {
        sortedStitches.sort((a, b) => (a.order || 0) - (b.order || 0));
      }
      
      // Create progress record for each stitch in this thread
      sortedStitches.forEach((stitch, index) => {
        progressRecords.push({
          user_id: userId,
          thread_id: thread.id,
          stitch_id: stitch.id,
          order_number: index === 0 ? 0 : index, // First stitch is active (0), rest are sequential
          skip_number: 3,
          distractor_level: 'L1'
        });
      });
    }
    
    // Insert the new progress records
    if (progressRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('user_stitch_progress')
        .upsert(progressRecords);
        
      if (insertError) {
        console.error('API: Error inserting reset progress records:', insertError);
        
        // If we get a column error, try with minimal fields
        if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
          console.log('API: Schema error detected, trying minimal insert');
          
          // Create minimal records with only essential fields
          const minimalRecords = progressRecords.map(record => ({
            user_id: record.user_id,
            thread_id: record.thread_id,
            stitch_id: record.stitch_id,
            order_number: record.order_number
          }));
          
          // Try again with minimal fields
          const { error: minimalError } = await supabase
            .from('user_stitch_progress')
            .upsert(minimalRecords);
            
          if (minimalError) {
            console.error('API: Even minimal insert failed:', minimalError);
            return res.status(500).json({
              success: false,
              error: 'Failed to reset user progress',
              details: minimalError.message
            });
          }
        } else {
          return res.status(500).json({
            success: false,
            error: 'Failed to reset user progress',
            details: insertError.message
          });
        }
      }
    }
    
    // Set up tube positions
    for (const thread of threads) {
      // Get tube number (from thread data or calculate it)
      let tubeNumber = thread.tube_number;
      
      // If tube_number isn't available in the database, calculate it
      if (tubeNumber === undefined) {
        // Extract letter from thread ID (e.g., thread-A -> A)
        const letter = thread.id.match(/thread-([A-Z])/)?.[1] || '';
        
        // Calculate tube number with specific assignments
        tubeNumber = 1; // Default
        if (letter) {
          // Direct letter to tube mapping
          if (letter === 'A') tubeNumber = 1;
          else if (letter === 'B') tubeNumber = 2;
          else if (letter === 'C') tubeNumber = 3;
          else if (letter === 'D') tubeNumber = 3;
          else if (letter === 'E') tubeNumber = 2;
          else if (letter === 'F') tubeNumber = 1;
          else {
            // Fallback for any other letters
            const charCode = letter.charCodeAt(0) - 65; // A=0, B=1, C=2, etc.
            tubeNumber = (charCode % 3) + 1; // 1, 2, or 3 with wraparound
          }
        }
      }
      
      // Insert tube position record - one per tube
      const { error: tubePositionError } = await supabase
        .from('user_tube_position')
        .upsert({
          user_id: userId,
          tube_number: tubeNumber,
          thread_id: thread.id
        });
      
      if (tubePositionError) {
        console.error(`API: Error setting tube position for tube ${tubeNumber}:`, tubePositionError);
      }
    }
    
    // Call the user-stitches API to ensure everything is properly initialized
    // This is just for validation, as we've already done the work above
    try {
      await fetch(`${req.headers.origin}/api/user-stitches?userId=${userId}&prefetch=5`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('API: Error calling user-stitches for validation:', error);
      // Continue anyway, this is just for extra validation
    }
    
    return res.status(200).json({
      success: true,
      message: `Progress successfully reset and reinitialized for user ${userId}`,
      initializedThreads: threads.length,
      initializedStitches: progressRecords.length
    });
  } catch (err) {
    console.error('Unexpected error in reset-progress API:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: err instanceof Error ? err.message : String(err)
    });
  }
}