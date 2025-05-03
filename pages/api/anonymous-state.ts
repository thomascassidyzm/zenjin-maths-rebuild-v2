import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Anonymous state API endpoint - doesn't require authentication
 * 
 * This allows users who are not logged in to persist their state.
 * Used as a fallback when authentication fails or isn't available.
 * 
 * GET - Retrieve state for an anonymous user
 * POST - Update state for an anonymous user
 * 
 * This version includes enhanced error handling and debugging
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check if debug mode is enabled via query param
  const isDebug = req.query.debug === 'true';
  
  try {
    // Log environment info for debugging
    if (isDebug) {
      console.log('API Environment:', {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not set',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not set',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set'
      });
    }

    // Validate Supabase credentials
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('Missing Supabase URL');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Missing Supabase URL'
      });
    }

    // Prefer service role key for more reliable access
    const useServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Create Supabase client with appropriate key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      useServiceRole 
        ? process.env.SUPABASE_SERVICE_ROLE_KEY as string
        : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
    );

    if (isDebug) {
      console.log(`Using ${useServiceRole ? 'service role' : 'anon'} key for anonymous state API`);
    }
    
    // GET request to retrieve anonymous user state
    if (req.method === 'GET') {
      const { id } = req.query;
      
      if (isDebug) {
        console.log(`GET request for anonymous state: id=${id}`);
      }
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'Anonymous user ID is required' 
        });
      }
      
      // Validate the ID format (starts with "anonymous-")
      if (!id.startsWith('anonymous-') && !id.startsWith('diag-') && !id.startsWith('test-')) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid anonymous user ID format. Must start with "anonymous-", "diag-", or "test-"'
        });
      }
      
      try {
        // Verify database connection with a simpler query first
        if (isDebug) {
          const { error: connectionError } = await supabase
            .from('anonymous_user_state')
            .select('count', { count: 'exact', head: true });
            
          if (connectionError) {
            console.error('Error testing database connection:', connectionError);
          } else {
            console.log('Database connection test successful');
          }
        }
        
        // Query the database for the user's state
        const { data, error } = await supabase
          .from('anonymous_user_state')
          .select('state')
          .eq('id', id)
          .single();
        
        if (error) {
          console.error('Error fetching anonymous user state:', error);
          
          // Check if this is a "not found" error (which should return 404, not 500)
          if (error.code === 'PGRST116') {
            return res.status(404).json({
              success: false,
              error: 'No state found for this anonymous user',
              details: isDebug ? error.message : undefined
            });
          }
          
          return res.status(500).json({
            success: false,
            error: 'Error fetching state',
            details: error.message
          });
        }
        
        if (!data) {
          // No state found for this anonymous user
          return res.status(404).json({ 
            success: false, 
            error: 'No state found' 
          });
        }
        
        if (isDebug) {
          console.log(`Successfully retrieved state for anonymous user ${id}`);
        }
        
        // Return the state
        return res.status(200).json({ 
          success: true, 
          state: data.state 
        });
      } catch (err) {
        console.error('Unexpected error in GET handler:', err);
        return res.status(500).json({
          success: false,
          error: 'Unexpected error retrieving state',
          details: isDebug ? (err instanceof Error ? err.message : String(err)) : undefined
        });
      }
    }
    
    // POST request to update anonymous user state
    if (req.method === 'POST') {
      const { id, state } = req.body;
      
      if (isDebug) {
        console.log(`POST request to update anonymous state:`, { 
          id,
          hasState: !!state,
          isObject: typeof state === 'object'
        });
      }
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'Anonymous user ID is required' 
        });
      }
      
      if (!state || typeof state !== 'object') {
        return res.status(400).json({ 
          success: false, 
          error: 'Valid state object is required' 
        });
      }
      
      // Validate the ID format
      if (!id.startsWith('anonymous-') && !id.startsWith('diag-') && !id.startsWith('test-')) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid anonymous user ID format. Must start with "anonymous-", "diag-", or "test-"'
        });
      }
      
      try {
        // Upsert the state (insert if not exists, update if exists)
        const { data, error } = await supabase
          .from('anonymous_user_state')
          .upsert({ id, state }, { onConflict: 'id' })
          .select();
        
        if (error) {
          console.error('Error updating anonymous user state:', error);
          return res.status(500).json({
            success: false,
            error: 'Error updating state',
            details: error.message
          });
        }
        
        if (isDebug) {
          console.log(`Successfully updated state for anonymous user ${id}`);
        }
        
        // Return success
        return res.status(200).json({ 
          success: true,
          message: 'State updated successfully',
          data: isDebug ? data : undefined
        });
      } catch (err) {
        console.error('Unexpected error in POST handler:', err);
        return res.status(500).json({
          success: false,
          error: 'Unexpected error updating state',
          details: isDebug ? (err instanceof Error ? err.message : String(err)) : undefined
        });
      }
    }
    
    // Handle unsupported HTTP methods
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use GET to retrieve state or POST to update state.'
    });
  } catch (error) {
    console.error('Unexpected error in anonymous state API:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred',
      details: isDebug ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
}