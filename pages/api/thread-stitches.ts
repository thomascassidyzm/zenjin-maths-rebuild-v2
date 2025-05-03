import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../lib/supabase/route';

/**
 * Endpoint to fetch stitches for a specific thread
 * Used for lazy loading additional stitches
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { thread, prefetch, startAfter } = req.query;
    
    if (!thread) {
      return res.status(400).json({ success: false, error: 'Thread ID is required' });
    }
    
    const count = parseInt(prefetch as string, 10) || 5;
    const startIndex = parseInt(startAfter as string, 10) || 0;
    
    console.log(`API: Fetching ${count} stitches for thread ${thread} starting after index ${startIndex}`);
    
    // Create a Supabase client with proper auth context
    const supabase = createRouteHandlerClient(req, res);
    
    // Get authenticated user or use anonymous
    const { data: { session } } = await supabase.auth.getSession();
    
    // Fetch stitches for this thread
    const { data: stitches, error: stitchesError } = await supabase
      .from('stitches')
      .select('*, questions(*)')
      .eq('thread_id', thread)
      .order('id');
      
    if (stitchesError) {
      console.error('API: Error fetching stitches:', stitchesError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch stitches',
        details: stitchesError.message 
      });
    }
    
    if (!stitches || stitches.length === 0) {
      return res.status(200).json({ 
        success: true, 
        stitches: [] 
      });
    }
    
    console.log(`API: Found ${stitches.length} stitches for thread ${thread}`);
    
    // Get user progress if authenticated
    let userProgress: any[] = [];
    
    if (session?.user) {
      const { data: progress, error: progressError } = await supabase
        .from('user_stitch_progress')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('thread_id', thread);
        
      if (!progressError && progress) {
        userProgress = progress;
        console.log(`API: Found ${progress.length} progress entries for user ${session.user.id}`);
      }
    }
    
    // Combine stitches with progress data
    const stitchesWithProgress = stitches.map(stitch => {
      // Find progress for this stitch
      const progress = userProgress.find(p => p.stitch_id === stitch.id);
      
      // Default order to stitch index if no progress exists
      const orderNumber = progress?.order_number !== undefined
        ? progress.order_number
        : 999; // High number to put at end
        
      return {
        ...stitch,
        order_number: orderNumber,
        skip_number: progress?.skip_number ?? 3,
        distractor_level: progress?.distractor_level ?? 'L1'
      };
    });
    
    // Sort by order_number
    stitchesWithProgress.sort((a, b) => a.order_number - b.order_number);
    
    // Get stitches after the specified index
    const nextStitches = stitchesWithProgress
      .filter(stitch => stitch.order_number > startIndex)
      .slice(0, count);
      
    console.log(`API: Returning ${nextStitches.length} stitches for thread ${thread}`);
    
    return res.status(200).json({
      success: true,
      stitches: nextStitches
    });
    
  } catch (error) {
    console.error('API: Unexpected error in thread-stitches endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}