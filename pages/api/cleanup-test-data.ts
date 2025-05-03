import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/auth/supabaseClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Delete any threads with test-* pattern from threads table
    const { error: threadError, data: deletedThreads } = await supabase
      .from('threads')
      .delete()
      .like('thread_id', 'test-%')
      .select();

    // 2. Delete any stitches with test-* pattern from stitches table
    const { error: stitchError, data: deletedStitches } = await supabase
      .from('stitches')
      .delete()
      .like('id', 'test-%')
      .select();

    // 3. Delete any stitch_thread_map entries with test-* pattern
    const { error: mapError, data: deletedMappings } = await supabase
      .from('stitch_thread_map')
      .delete()
      .or('stitch_id.like.test-%,thread_id.like.test-%')
      .select();

    // 4. Delete any user_stitch_progress entries with test-* pattern
    const { error: progressError, data: deletedProgress } = await supabase
      .from('user_stitch_progress')
      .delete()
      .or('stitch_id.like.test-%,thread_id.like.test-%')
      .select();

    // Check for errors
    if (threadError || stitchError || mapError || progressError) {
      return res.status(500).json({
        success: false,
        error: {
          thread: threadError?.message,
          stitch: stitchError?.message,
          map: mapError?.message,
          progress: progressError?.message
        }
      });
    }

    // Return deletion results
    return res.status(200).json({
      success: true,
      deleted: {
        threads: deletedThreads?.length || 0,
        stitches: deletedStitches?.length || 0,
        mappings: deletedMappings?.length || 0,
        progress: deletedProgress?.length || 0
      }
    });
  } catch (error) {
    console.error('Error cleaning up test data:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}