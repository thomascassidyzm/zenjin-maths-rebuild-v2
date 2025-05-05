/**
 * API handler factories
 * 
 * Provides standardized patterns for creating API handlers with authentication and error handling.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth, withAnonymousAuth, createAuthClient, supabaseAdmin } from './auth';
import { logApiError } from './logging';
import { successResponse, errorResponse, HTTP_STATUS } from './responses';

/**
 * Options for API handler factories
 */
interface HandlerOptions {
  methods?: string[];
  context?: string;
  exposeErrors?: boolean;
}

/**
 * Create an authenticated API handler with standardized patterns
 * 
 * @param handlerFn - The actual handler function
 * @param options - Handler options
 * @returns Next.js API handler function
 */
export function createAuthHandler(
  handlerFn: (
    req: NextApiRequest,
    res: NextApiResponse,
    userId: string,
    db: any
  ) => Promise<any>,
  options: HandlerOptions = {}
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Method validation
    const allowedMethods = options.methods || ['GET'];
    if (!allowedMethods.includes(req.method as string)) {
      return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json(
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
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
          errorResponse('An error occurred processing your request', 
                      options.exposeErrors ? errorInfo : null)
        );
      }
    });
  };
}

/**
 * Create an API handler that supports anonymous users
 * 
 * @param handlerFn - The actual handler function
 * @param options - Handler options
 * @returns Next.js API handler function
 */
export function createAnonymousHandler(
  handlerFn: (
    req: NextApiRequest,
    res: NextApiResponse,
    userId: string,
    db: any,
    isAuthenticated: boolean
  ) => Promise<any>,
  options: HandlerOptions = {}
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Method validation
    const allowedMethods = options.methods || ['POST'];
    if (!allowedMethods.includes(req.method as string)) {
      return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json(
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
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
          errorResponse('An error occurred processing your request', 
                      options.exposeErrors ? errorInfo : null)
        );
      }
    });
  };
}

/**
 * Create an advanced API handler with extended capabilities
 * 
 * @param handlerFn - The actual handler function
 * @param options - Handler options
 * @returns Next.js API handler function
 */
export function createAdvancedHandler(
  handlerFn: (
    req: NextApiRequest,
    res: NextApiResponse,
    userId: string | null,
    db: any,
    isAuthenticated: boolean,
    context: Record<string, any>
  ) => Promise<any>,
  options: HandlerOptions & {
    requireAuth?: boolean;
    contextBuilder?: (req: NextApiRequest) => Record<string, any>;
    allowAnonymous?: boolean;
  } = {}
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Method validation
    const allowedMethods = options.methods || ['GET', 'POST'];
    if (!allowedMethods.includes(req.method as string)) {
      return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json(
        errorResponse(`Method ${req.method} not allowed`)
      );
    }
    
    // Build context
    const context = options.contextBuilder ? options.contextBuilder(req) : {};
    
    // Decide auth approach based on options
    if (options.requireAuth) {
      // Require authentication
      return withAuth(req, res, async (userId, db) => {
        try {
          return await handlerFn(req, res, userId, db, true, context);
        } catch (error) {
          const errorInfo = logApiError(options.context || 'Advanced API', error, userId);
          return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            errorResponse('An error occurred processing your request', 
                        options.exposeErrors ? errorInfo : null)
          );
        }
      });
    } else {
      // Support anonymous but check auth if available
      return withAnonymousAuth(req, res, async (userId, db, isAuthenticated) => {
        try {
          return await handlerFn(req, res, userId, db, isAuthenticated, context);
        } catch (error) {
          const errorInfo = logApiError(options.context || 'Advanced API', error, userId);
          return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            errorResponse('An error occurred processing your request', 
                        options.exposeErrors ? errorInfo : null)
          );
        }
      });
    }
  };
}

/**
 * Create a public API handler (no authentication required)
 * 
 * @param handlerFn - The actual handler function
 * @param options - Handler options
 * @returns Next.js API handler function
 */
export function createPublicHandler(
  handlerFn: (
    req: NextApiRequest,
    res: NextApiResponse
  ) => Promise<any>,
  options: HandlerOptions = {}
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Method validation
    const allowedMethods = options.methods || ['GET'];
    if (!allowedMethods.includes(req.method as string)) {
      return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json(
        errorResponse(`Method ${req.method} not allowed`)
      );
    }
    
    try {
      // Call the actual handler
      return await handlerFn(req, res);
    } catch (error) {
      // Log the error
      const errorInfo = logApiError(options.context || 'Public API', error);
      
      // Return error response
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('An error occurred processing your request', 
                    options.exposeErrors ? errorInfo : null)
      );
    }
  };
}