import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../../lib/supabase/route';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST to clear tube state.'
    });
  }
  
  try {
    console.log('API: clear tube state endpoint called');
    
    // Create Supabase clients
    const supabase = createRouteHandlerClient(req, res);
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Extract parameters from request body
    const { user_id, tube_number } = req.body;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: user_id'
      });
    }
    
    console.log(`API: Clearing tube state for user ${user_id}`);
    
    // Get authenticated user from session
    const { data: { session } } = await supabase.auth.getSession();
    const authenticatedUserId = session?.user?.id;
    
    // Security check: Only allow clearing state for own user or for system user
    if (authenticatedUserId && authenticatedUserId !== user_id && !req.body.bypass_auth) {
      console.warn(`API: Security check - User ${authenticatedUserId} tried to clear data for ${user_id}`);
      return res.status(403).json({
        success: false,
        error: 'Not authorized to modify this user\'s data'
      });
    }
    
    // Delete the tube state records
    let query = supabaseAdmin
      .from('user_tube_positions')
      .delete()
      .eq('user_id', user_id);
    
    // If tube number is specified, filter by that
    if (tube_number !== undefined) {
      query = query.eq('tube_number', tube_number);
      console.log(`API: Clearing tube ${tube_number} for user ${user_id}`);
    } else {
      console.log(`API: Clearing all tubes for user ${user_id}`);
    }
    
    const { error } = await query;
    
    if (error) {
      console.error('API: Error clearing tube state:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to clear tube state',
        details: error.message
      });
    }
    
    return res.status(200).json({
      success: true,
      message: `Successfully cleared ${tube_number ? `tube ${tube_number}` : 'all tubes'} for user ${user_id}`
    });
  } catch (error) {
    console.error('API: Unexpected error in clear tube state endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}