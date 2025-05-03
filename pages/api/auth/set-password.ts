/**
 * Set Initial Password Endpoint
 * 
 * Sets a password for an authenticated user who initially signed in via 
 * magic link/OTP and doesn't have a password yet.
 */
import { createAuthHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { logApiInfo, logApiError } from '../../../lib/api/logging';
import { createAuthClient } from '../../../lib/api/auth';

export default createAuthHandler(
  async (req, res, userId, db) => {
    // Get the new password from the request
    const { password } = req.body;
    
    // Validate password
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('Password must be at least 8 characters')
      );
    }
    
    try {
      // Create auth client for session operations
      const authClient = createAuthClient(req, res);
      
      // Update the user's password
      const { error: updateError } = await authClient.auth.updateUser({
        password: password
      });
      
      if (updateError) {
        logApiError('Password Set', updateError, userId);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          errorResponse(updateError.message)
        );
      }
      
      // Log successful password set
      logApiInfo('Auth/SetPassword', 'Initial password set successfully', userId);
      
      // Update the profile to mark that the user has a password
      const { error: profileError } = await db
        .from('profiles')
        .update({ 
          has_password: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (profileError) {
        // Log but don't fail the operation
        logApiError('Profile Password Status Update', profileError, userId);
      }
      
      return res.status(HTTP_STATUS.OK).json(
        successResponse({}, 'Password set successfully')
      );
    } catch (error) {
      // Error is automatically logged by the handler wrapper
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('Password service unavailable')
      );
    }
  },
  {
    methods: ['POST'],
    context: 'Auth/SetPassword'
  }
);