import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../../lib/supabase/route';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST to save tube state.'
    });
  }
  
  try {
    console.log('API: save tube state endpoint called');
    
    // Create Supabase clients
    const supabase = createRouteHandlerClient(req, res);
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Extract parameters from request body
    const { records } = req.body;
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid required parameter: records (must be a non-empty array)'
      });
    }
    
    console.log(`API: Saving ${records.length} tube position records`);
    
    // Verify all records have the required fields
    for (const record of records) {
      if (!record.user_id || !record.tube_number || typeof record.position !== 'number' || !record.stitch_id) {
        return res.status(400).json({
          success: false,
          error: 'All records must have user_id, tube_number, position, and stitch_id fields'
        });
      }
    }
    
    // Insert the records
    const { data, error } = await supabaseAdmin
      .from('user_tube_positions')
      .upsert(records);
    
    if (error) {
      console.error('API: Error saving tube state:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save tube state',
        details: error.message
      });
    }
    
    return res.status(200).json({
      success: true,
      message: `Successfully saved ${records.length} tube position records`
    });
  } catch (error) {
    console.error('API: Unexpected error in save tube state endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}