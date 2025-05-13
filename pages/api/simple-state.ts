import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Ultra-simplified state API
 * 
 * GET - Load state for a user
 * POST - Save state for a user
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`SIMPLE-STATE API: Request method=${req.method}`);
  
  // Create Supabase admin client with service role key
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false
      }
    }
  );
  
  // Log the credentials (masked) for debugging
  console.log(`SIMPLE-STATE API: Using Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`SIMPLE-STATE API: Using service role key: ${process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 5)}...`);
  
  try {
    // GET - Load state for a user
    if (req.method === 'GET') {
      const { userId } = req.query;
      
      console.log(`SIMPLE-STATE API: Loading state for user ${userId}`);
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }
      
      // Try to retrieve state from the database
      const { data, error } = await supabaseAdmin
        .from('user_state')
        .select('state')
        .eq('user_id', userId)
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        console.error(`SIMPLE-STATE API: Error retrieving state:`, error);
        
        // Return default empty state
        return res.status(200).json({
          success: true,
          state: {
            userId,
            tubeState: null,
            userInformation: null,
            learningProgress: null,
            lastUpdated: new Date().toISOString()
          },
          source: 'default'
        });
      }
      
      console.log(`SIMPLE-STATE API: Successfully retrieved state for user ${userId}`);
      
      return res.status(200).json({
        success: true,
        state: data?.state || {
          userId,
          tubeState: null,
          userInformation: null,
          learningProgress: null,
          lastUpdated: new Date().toISOString()
        },
        source: data ? 'database' : 'default'
      });
    }
    
    // POST - Save state for a user
    if (req.method === 'POST') {
      // Extract state and user ID from request
      let { state, id } = req.body;
      
      console.log(`SIMPLE-STATE API: Saving state, request body keys: ${Object.keys(req.body).join(', ')}`);
      
      if (!state || typeof state !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'state object is required'
        });
      }
      
      // Get user ID from state or standalone id field
      const userId = state.userId || id;
      
      console.log(`SIMPLE-STATE API: Extracted userId=${userId} (state.userId=${state.userId}, id=${id})`);
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }
      
      // Ensure userId is in state
      if (!state.userId) {
        state.userId = userId;
      }
      
      // Timestamp
      const now = new Date().toISOString();
      
      // First delete any existing state for this user
      const { error: deleteError } = await supabaseAdmin
        .from('user_state')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) {
        console.log(`SIMPLE-STATE API: Delete operation had error but continuing: ${deleteError.message}`);
      }
      
      // Insert new state
      const { error: insertError } = await supabaseAdmin
        .from('user_state')
        .insert({
          user_id: userId,
          state: state,
          last_updated: now,
          created_at: now
        });
      
      if (insertError) {
        console.error(`SIMPLE-STATE API: Error saving state:`, insertError);
        return res.status(500).json({
          success: false,
          error: 'Error saving state',
          details: insertError.message
        });
      }
      
      console.log(`SIMPLE-STATE API: Successfully saved state for user ${userId}`);
      
      return res.status(200).json({
        success: true,
        message: 'State saved successfully'
      });
    }
    
    // Other methods not supported
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error(`SIMPLE-STATE API: Unhandled error:`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}