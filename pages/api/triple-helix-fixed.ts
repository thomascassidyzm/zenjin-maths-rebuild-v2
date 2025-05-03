import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../lib/supabase/route';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Create Supabase client
    const supabase = createRouteHandlerClient(req, res);
    
    // Get session info
    const { data: { session } } = await supabase.auth.getSession();
    
    // Get user ID from query or session
    const queryUserId = req.query.userId as string;
    const userId = queryUserId || session?.user?.id || 'anonymous';
    
    // Redirect to the Triple-Helix Fixed player page with the user ID
    res.redirect(302, `/triple-helix-fixed?userId=${encodeURIComponent(userId)}`);
  } catch (err) {
    console.error('Error in triple-helix-fixed API route:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}