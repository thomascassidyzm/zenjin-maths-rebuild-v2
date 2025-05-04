/**
 * Authentication utilities for API routes
 * 
 * Provides consistent authentication handling for all API endpoints.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { logApiError } from './logging';
import { errorResponse } from './responses';
import { HTTP_STATUS, ERROR_MESSAGES } from './responses';

// Initialize Supabase admin client for database operations with hardcoded URL
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylyxga.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.MKPlabJrcvZQ2jyW0LKLs9VqnrQf2vOfllCZV9hv8tQ'
);

/**
 * Creates a Supabase client with request/response context for cookie handling
 */
export function createAuthClient(req: NextApiRequest, res: NextApiResponse) {
  return createServerSupabaseClient({ req, res });
}

/**
 * Wrapper for authenticated API routes
 * 
 * Verifies the user is authenticated before executing the callback.
 * 
 * @param req - The incoming request
 * @param res - The response object
 * @param callback - Function to execute if authenticated
 */
export async function withAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  callback: (userId: string, db: any) => Promise<any>
) {
  try {
    // Create a Supabase client with the request context
    const supabaseClient = createAuthClient(req, res);
    
    // Get session from Supabase
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    // If no authenticated session, check for JWT in authorization header
    if (!session) {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        try {
          // Verify the JWT token
          const { data: jwtData, error: jwtError } = await supabaseAdmin.auth.getUser(token);
          
          if (!jwtError && jwtData?.user) {
            // Valid JWT token, proceed with the authenticated user
            console.log('API auth: Using JWT from Authorization header');
            return callback(jwtData.user.id, supabaseAdmin);
          }
        } catch (jwtVerifyError) {
          logApiError('JWT Verification', jwtVerifyError);
        }
      }
      
      // Check for token in query params for special cases
      const queryToken = req.query.access_token as string;
      if (queryToken) {
        try {
          // Verify the token from query
          const { data: queryTokenData, error: queryTokenError } = 
            await supabaseAdmin.auth.getUser(queryToken);
            
          if (!queryTokenError && queryTokenData?.user) {
            // Valid token from query, proceed with the authenticated user
            console.log('API auth: Using token from query params');
            return callback(queryTokenData.user.id, supabaseAdmin);
          }
        } catch (queryTokenError) {
          logApiError('Query Token Verification', queryTokenError);
        }
      }
      
      // No valid session or token, return 401
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(
        errorResponse(ERROR_MESSAGES.UNAUTHORIZED)
      );
    }
    
    // Pass user ID and admin DB client to callback
    return callback(session.user.id, supabaseAdmin);
  } catch (error) {
    // Log the error
    logApiError('Auth Wrapper', error);
    
    // Return error response
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse('Authentication service unavailable')
    );
  }
}

/**
 * Wrapper for API routes that support both anonymous and authenticated users
 * 
 * @param req - The incoming request
 * @param res - The response object
 * @param callback - Function to execute with user ID and auth status
 */
export async function withAnonymousAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  callback: (userId: string, db: any, isAuthenticated: boolean) => Promise<any>
) {
  try {
    // First check for authenticated user
    const supabaseClient = createAuthClient(req, res);
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    // If authenticated, use user ID from session
    if (session) {
      return callback(session.user.id, supabaseAdmin, true);
    }
    
    // If not authenticated, use anonymous ID from request
    // Check for anonymousId in both request body and query parameters
    const anonymousIdFromBody = req.body?.anonymousId;
    const anonymousIdFromQuery = req.query?.userId;
    const isAnonymous = req.query?.isAnonymous === 'true';
    
    // Use anonymousId from body first, then userId from query if flagged as anonymous
    const anonymousId = anonymousIdFromBody || (isAnonymous ? anonymousIdFromQuery : null);
    
    if (!anonymousId) {
      console.error('Anonymous auth failed: No anonymousId in body or query params');
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('Anonymous ID required in request body or query parameters')
      );
    }
    
    console.log(`Anonymous auth: Using ID ${anonymousId}`);
    
    // Allow operation with anonymous ID
    return callback(anonymousId, supabaseAdmin, false);
  } catch (error) {
    // Log the error
    logApiError('Anonymous Auth Wrapper', error);
    
    // Return error response
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse('Authentication service unavailable')
    );
  }
}

/**
 * Get hardcoded user ID from email
 * Used as a fallback for known test users
 * 
 * @param email - User email
 * @returns User ID if known, null otherwise
 */
export function getHardcodedUserId(email: string): string | null {
  const knownUsers: Record<string, string> = {
    'thomas.cassidy+zm301@gmail.com': 'e45b377a-9d72-4b6b-9b9e-ee8efb26b916',
    // Add other known users as needed
  };
  
  return knownUsers[email] || null;
}

/**
 * Extract user ID from various sources in priority order
 * 
 * @param req - The request object
 * @param sessionUserId - User ID from session (if available)
 * @returns The best available user ID or null
 */
export function extractUserId(
  req: NextApiRequest,
  sessionUserId: string | null = null
): string | null {
  // Priority order:
  // 1. Session user ID (if provided)
  // 2. User ID in request body
  // 3. User ID in query params
  // 4. User ID in headers
  // 5. Anonymous ID in body
  // 6. Hardcoded ID for known email
  
  if (sessionUserId) {
    return sessionUserId;
  }
  
  if (req.body?.userId) {
    return req.body.userId;
  }
  
  if (req.query?.userId) {
    return req.query.userId as string;
  }
  
  if (req.headers['x-user-id']) {
    return req.headers['x-user-id'] as string;
  }
  
  if (req.body?.anonymousId) {
    return req.body.anonymousId;
  }
  
  // If email is provided, check for hardcoded ID
  if (req.body?.email) {
    const hardcodedId = getHardcodedUserId(req.body.email);
    if (hardcodedId) {
      return hardcodedId;
    }
  }
  
  return null;
}