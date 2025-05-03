# API Utilities

This document outlines the core API utilities that form the foundation of our rebuild.

## Authentication Utilities (`lib/api/auth.ts`)

These utilities provide consistent authentication handling for all API routes.

### withAuth

A wrapper for authenticated API routes that verifies the user is logged in.

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

// Admin client with full database access
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Wrapper for authenticated API routes
 * 
 * @param req - The incoming request
 * @param res - The response object
 * @param callback - Function to execute if authenticated
 */
export async function withAuth(req, res, callback) {
  try {
    const supabaseClient = createRouteHandlerClient({ req, res });
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }
    
    return callback(session.user.id, supabaseAdmin);
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Authentication service unavailable' 
    });
  }
}
```

### withAnonymousAuth

A wrapper that supports both authenticated and anonymous users.

```typescript
/**
 * Wrapper for API routes that support both anonymous and authenticated users
 * 
 * @param req - The incoming request
 * @param res - The response object
 * @param callback - Function to execute with user ID and auth status
 */
export async function withAnonymousAuth(req, res, callback) {
  try {
    // First check for authenticated user
    const supabaseClient = createRouteHandlerClient({ req, res });
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    // If authenticated, use user ID
    if (session) {
      return callback(session.user.id, supabaseAdmin, true);
    }
    
    // If not authenticated, use anonymous ID from request
    const { anonymousId } = req.body;
    if (!anonymousId) {
      return res.status(400).json({
        success: false,
        error: 'Anonymous ID required'
      });
    }
    
    // Allow operation with anonymous ID
    return callback(anonymousId, supabaseAdmin, false);
  } catch (error) {
    console.error('Anonymous auth error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication service unavailable'
    });
  }
}
```

## Response Formatting (`lib/api/responses.ts`)

Standardized API response formatting ensures consistency across all endpoints.

```typescript
/**
 * Generate a successful API response
 */
export function successResponse(data = {}, message = 'Success') {
  return {
    success: true,
    message,
    ...data
  };
}

/**
 * Generate an error API response
 */
export function errorResponse(error = 'An error occurred', details = null) {
  return {
    success: false,
    error,
    details: details || null
  };
}
```

## Error Logging (`lib/api/logging.ts`)

Centralized error logging with context information.

```typescript
/**
 * Log an API error with context information
 */
export function logApiError(context, error, userId = null) {
  const errorInfo = {
    context,
    userId,
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null
  };
  
  console.error(`API Error [${context}]:`, errorInfo);
  
  // In production, could send to error monitoring service
  if (process.env.NODE_ENV === 'production') {
    // e.g., Sentry.captureException(error, { extra: errorInfo });
  }
  
  // Optionally log to database
  try {
    supabaseAdmin
      .from('error_logs')
      .insert({
        context,
        user_id: userId,
        error_message: errorInfo.error,
        error_stack: errorInfo.stack,
        created_at: errorInfo.timestamp
      })
      .then(() => {})
      .catch(() => {});
  } catch (_) {
    // Silently fail if DB logging fails
  }
  
  return errorInfo;
}
```

## API Handler Factory (`lib/api/handlers.ts`)

A factory function to create API handlers with consistent patterns.

```typescript
import { withAuth, withAnonymousAuth } from './auth';
import { logApiError } from './logging';
import { successResponse, errorResponse } from './responses';

/**
 * Create an authenticated API handler with standardized patterns
 */
export function createAuthHandler(handlerFn, options = {}) {
  return async (req, res) => {
    // Method validation
    const allowedMethods = options.methods || ['GET'];
    if (!allowedMethods.includes(req.method)) {
      return res.status(405).json(
        errorResponse(`Method ${req.method} not allowed`)
      );
    }
    
    // Authentication check
    return withAuth(req, res, async (userId, db) => {
      try {
        // Call the actual handler
        return await handlerFn(req, res, userId, db);
      } catch (error) {
        // Log the error
        const errorInfo = logApiError(options.context || 'API', error, userId);
        
        // Return error response
        return res.status(500).json(
          errorResponse('An error occurred processing your request', 
                      options.exposeErrors ? errorInfo : null)
        );
      }
    });
  };
}

/**
 * Create an API handler that supports anonymous users
 */
export function createAnonymousHandler(handlerFn, options = {}) {
  return async (req, res) => {
    // Method validation
    const allowedMethods = options.methods || ['POST'];
    if (!allowedMethods.includes(req.method)) {
      return res.status(405).json(
        errorResponse(`Method ${req.method} not allowed`)
      );
    }
    
    // Authentication check (supports anonymous)
    return withAnonymousAuth(req, res, async (userId, db, isAuthenticated) => {
      try {
        // Call the actual handler
        return await handlerFn(req, res, userId, db, isAuthenticated);
      } catch (error) {
        // Log the error
        const errorInfo = logApiError(options.context || 'Anonymous API', error, userId);
        
        // Return error response
        return res.status(500).json(
          errorResponse('An error occurred processing your request', 
                      options.exposeErrors ? errorInfo : null)
        );
      }
    });
  };
}
```

## How to Use These Utilities

Example usage in an API endpoint:

```typescript
// pages/api/user/profile.ts
import { createAuthHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse } from '../../../lib/api/responses';

async function profileHandler(req, res, userId, db) {
  if (req.method === 'GET') {
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      return res.status(500).json(
        errorResponse('Failed to fetch profile')
      );
    }
    
    return res.status(200).json(
      successResponse({ profile: data })
    );
  }
  
  // Handle other methods...
}

export default createAuthHandler(profileHandler, {
  methods: ['GET', 'PUT'],
  context: 'User Profile'
});
```