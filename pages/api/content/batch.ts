/**
 * API endpoint for batch fetching multiple stitches
 * 
 * Allows fetching multiple stitches in a single request to efficiently
 * load a buffer of upcoming content based on the manifest.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createAdminClient } from '../../../lib/supabase/route';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests for batch operations
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST to fetch batch content.' 
    });
  }
  
  try {
    const { stitchIds } = req.body;
    
    if (!stitchIds || !Array.isArray(stitchIds) || stitchIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'stitchIds array is required' 
      });
    }
    
    // Limit batch size for performance
    const MAX_BATCH_SIZE = 20;
    const batchSize = Math.min(stitchIds.length, MAX_BATCH_SIZE);
    const batchIds = stitchIds.slice(0, batchSize);
    
    // Create admin client to bypass RLS
    const supabase = createAdminClient();
    
    // Fetch stitches from database with their questions
    const { data: stitches, error: stitchError } = await supabase
      .from('stitches')
      .select('*, questions(*)')
      .in('id', batchIds);
    
    if (stitchError) {
      console.error('Error fetching stitches:', stitchError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error fetching stitches' 
      });
    }
    
    // Format response for client use
    const formattedStitches = stitches.map(stitch => ({
      id: stitch.id,
      threadId: stitch.thread_id,
      title: stitch.title || '',
      content: stitch.content || '',
      order: stitch.order || 0,
      questions: stitch.questions || []
    }));
    
    // Set cache control headers - allow caching for content
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    
    return res.status(200).json({ 
      success: true, 
      stitches: formattedStitches,
      count: formattedStitches.length,
      total: stitchIds.length
    });
  } catch (error: any) {
    console.error('Error in batch API:', error);
    
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
}