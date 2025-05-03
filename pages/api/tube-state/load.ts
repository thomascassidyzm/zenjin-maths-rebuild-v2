import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../../lib/supabase/route';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use GET to load tube state.'
    });
  }
  
  try {
    console.log('API: load tube state endpoint called');
    
    // Create Supabase clients
    const supabase = createRouteHandlerClient(req, res);
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // Extract parameters from request query
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: user_id'
      });
    }
    
    console.log(`API: Loading tube state for user ${userId}`);
    
    // Get authenticated user from session
    const { data: { session } } = await supabase.auth.getSession();
    const authenticatedUserId = session?.user?.id;
    
    // Security check: Only allow loading state for own user or for system user
    if (authenticatedUserId && authenticatedUserId !== userId && !req.query.bypass_auth) {
      console.warn(`API: Security check - User ${authenticatedUserId} tried to access data for ${userId}`);
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this user\'s data'
      });
    }
    
    // Fetch the tube state records
    const { data, error } = await supabaseAdmin
      .from('user_tube_positions')
      .select('*')
      .eq('user_id', userId)
      .order('tube_number')
      .order('position');
    
    if (error) {
      console.error('API: Error loading tube state:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load tube state',
        details: error.message
      });
    }
    
    // If we need to initialize for a new user
    if (!data || data.length === 0) {
      console.log(`API: No tube state found for user ${userId}, will return empty state`);
      
      return res.status(200).json({
        success: true,
        records: []
      });
    }
    
    return res.status(200).json({
      success: true,
      records: data
    });
  } catch (error) {
    console.error('API: Unexpected error in load tube state endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}