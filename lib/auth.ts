/**
 * Authentication helper functions for API routes
 */
import { NextApiRequest } from 'next';
import { supabase } from './auth/supabaseClient';

/**
 * Get authenticated user from request
 * @param req Next.js API request
 * @returns User object and any error
 */
export async function getUser(req: NextApiRequest) {
  try {
    // Extract the token from the request
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (!token) {
      // If using cookie-based auth, try to get session that way
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session?.user) {
        return { user: null, error: new Error('No authentication token provided') };
      }
      
      return { user: session.user, error: null };
    }
    
    // Verify token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { user: null, error: error || new Error('Invalid token') };
    }
    
    return { user, error: null };
  } catch (error) {
    console.error('Error authenticating user:', error);
    return { user: null, error };
  }
}