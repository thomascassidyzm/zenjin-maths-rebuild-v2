import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../lib/supabase/route';

/**
 * Authentication test endpoint
 * 
 * This endpoint helps diagnose authentication issues by returning
 * detailed information about the current authentication state.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isDebug = true;
  
  console.log(`Auth Test API Request: ${req.method} ${req.url}`);
  console.log('Headers:', {
    cookie: !!req.headers.cookie,
    authorization: !!req.headers.authorization
  });
  
  try {
    // Create standard client with cookie auth
    const supabase = createRouteHandlerClient(req, res);
    
    // Request user information
    let { data: authData, error: authError } = await supabase.auth.getUser();
    
    // Log for server-side debugging
    console.log(`Auth test results:`, { 
      hasError: !!authError, 
      hasData: !!authData, 
      hasUser: !!authData?.user,
      email: authData?.user?.email,
      userId: authData?.user?.id,
      errorMessage: authError?.message
    });
    
    // Get session information
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    // Return comprehensive authentication details for client debugging
    return res.status(200).json({
      success: true,
      authenticated: !!authData?.user,
      user: authData?.user ? {
        id: authData.user.id,
        email: authData.user.email,
        created_at: authData.user.created_at
      } : null,
      auth: {
        hasSession: !!sessionData?.session,
        sessionExpires: sessionData?.session?.expires_at ? new Date(sessionData.session.expires_at * 1000).toISOString() : null,
        error: authError ? authError.message : null,
        sessionError: sessionError ? sessionError.message : null
      },
      request: {
        hasCookie: !!req.headers.cookie,
        hasAuthHeader: !!req.headers.authorization,
        url: req.url,
        method: req.method
      }
    });
  } catch (error) {
    console.error('Unexpected error in auth-test API:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred during authentication test',
      details: isDebug ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
}