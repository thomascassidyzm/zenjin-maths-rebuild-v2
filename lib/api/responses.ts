/**
 * API response utilities
 * 
 * These utilities provide standardized response formatting for all API endpoints.
 */

// These will be defined below after the functions are declared

/**
 * Generate a successful API response
 * 
 * @param data - Optional data to include in the response
 * @param message - Optional success message
 * @returns Standardized success response object
 */
export function successResponse(data: Record<string, any> = {}, message: string = 'Success') {
  return {
    success: true,
    message,
    ...data
  };
}

/**
 * Generate an error API response
 * 
 * @param error - Error message
 * @param details - Optional error details (for debugging)
 * @returns Standardized error response object
 */
export function errorResponse(error: string = 'An error occurred', details: any = null) {
  return {
    success: false,
    error,
    details: details || null
  };
}

/**
 * Standard HTTP status codes for common scenarios
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

/**
 * Standard error messages for common scenarios
 */
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Authentication required',
  INVALID_INPUT: 'Invalid input data',
  NOT_FOUND: 'Resource not found',
  METHOD_NOT_ALLOWED: 'Method not allowed',
  SERVER_ERROR: 'An error occurred on the server',
  DATABASE_ERROR: 'Database operation failed',
  MISSING_FIELDS: 'Required fields are missing',
  INVALID_CREDENTIALS: 'Invalid credentials'
};

// Export aliases for backward compatibility
export const formatSuccessResponse = successResponse;
export const formatErrorResponse = errorResponse;