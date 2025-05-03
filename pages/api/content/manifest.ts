import type { NextApiRequest, NextApiResponse } from 'next';
import { createAdminClient } from '../../../lib/supabase/route';

/**
 * Content Manifest API
 * 
 * Provides a lightweight manifest of all stitches in the system,
 * organized by tube and thread. This allows the client to:
 * 
 * 1. Know the complete learning journey structure
 * 2. Implement look-ahead buffering of content
 * 3. Pre-fetch upcoming stitches based on the user's position
 * 
 * The manifest doesn't include actual stitch content (questions, etc.)
 * to keep it lightweight.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET to retrieve the manifest.'
    });
  }

  try {
    // Use admin client for consistent access to content regardless of auth status
    const supabase = createAdminClient();
    
    // Fetch all threads with their tube assignments
    const { data: threads, error: threadsError } = await supabase
      .from('threads')
      .select('id, tube_number, title')
      .order('id');
      
    if (threadsError) {
      console.error('Error fetching threads:', threadsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch thread data'
      });
    }
    
    // Fetch all stitches with their order
    const { data: stitches, error: stitchesError } = await supabase
      .from('stitches')
      .select('id, thread_id, order, title')
      .order('order');
      
    if (stitchesError) {
      console.error('Error fetching stitches:', stitchesError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch stitch data'
      });
    }
    
    // Organize threads by tube number
    const tubeThreads: Record<number, any[]> = {};
    
    threads.forEach(thread => {
      // Ensure thread has a tube number (default to 1 if missing)
      let tubeNumber = thread.tube_number;
      
      // If no tube_number, try to extract from thread ID (thread-T1-001 -> 1)
      if (!tubeNumber) {
        const match = thread.id.match(/thread-T(\d+)/);
        tubeNumber = match ? parseInt(match[1], 10) : 1;
      }
                          
      if (!tubeThreads[tubeNumber]) {
        tubeThreads[tubeNumber] = [];
      }
      
      tubeThreads[tubeNumber].push({
        id: thread.id,
        title: thread.title || thread.id
      });
    });
    
    // Organize stitches by thread
    const threadStitches: Record<string, any[]> = {};
    
    stitches.forEach(stitch => {
      if (!threadStitches[stitch.thread_id]) {
        threadStitches[stitch.thread_id] = [];
      }
      
      threadStitches[stitch.thread_id].push({
        id: stitch.id,
        order: stitch.order || 0,
        title: stitch.title || stitch.id
      });
    });
    
    // For each thread, sort its stitches by order
    Object.keys(threadStitches).forEach(threadId => {
      threadStitches[threadId].sort((a, b) => a.order - b.order);
    });
    
    // Build the final manifest structure
    const manifest = {
      tubes: {} as Record<number, any>
    };
    
    // For each tube, build the thread and stitch structure
    Object.keys(tubeThreads).forEach(tubeNumberStr => {
      const tubeNumber = parseInt(tubeNumberStr, 10);
      const threads = tubeThreads[tubeNumber];
      
      manifest.tubes[tubeNumber] = {
        threads: {}
      };
      
      // For each thread in this tube, add its stitches
      threads.forEach(thread => {
        const stitches = threadStitches[thread.id] || [];
        
        manifest.tubes[tubeNumber].threads[thread.id] = {
          title: thread.title,
          stitches: stitches.map(stitch => ({
            id: stitch.id,
            order: stitch.order,
            title: stitch.title
          }))
        };
      });
    });
    
    // Add metadata to help with caching and version tracking
    const manifestWithMeta = {
      version: 1,
      generated: new Date().toISOString(),
      tubes: manifest.tubes,
      stats: {
        tubeCount: Object.keys(manifest.tubes).length,
        threadCount: threads.length,
        stitchCount: stitches.length
      }
    };
    
    // Cache control headers for efficiency
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    
    return res.status(200).json({
      success: true,
      manifest: manifestWithMeta
    });
  } catch (error) {
    console.error('Error generating content manifest:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate content manifest'
    });
  }
}