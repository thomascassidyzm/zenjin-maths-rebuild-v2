/**
 * Update User Password Endpoint
 * 
 * Changes the password for an authenticated user.
 * Requires the current password for verification.
 */
import { createAuthHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { logApiInfo, logApiError } from '../../../lib/api/logging';
import { createAuthClient } from '../../../lib/api/auth';

export default createAuthHandler(
  async (req, res, userId, db) => {
    // Get the password details from the request
    const { currentPassword, newPassword } = req.body;
    
    // Validate inputs
    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('Current password is required')
      );
    }
    
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('New password must be at least 8 characters')
      );
    }
    
    if (currentPassword === newPassword) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('New password must be different from current password')
      );
    }
    
    try {
      // Create auth client for session operations
      const authClient = createAuthClient(req, res);
      
      // First, get the user's current email for re-authentication
      const { data: { user } } = await authClient.auth.getUser();
      
      if (!user || !user.email) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          errorResponse('Unable to retrieve current user')
        );
      }
      
      // Re-authenticate with their current email and password
      const { error: signInError } = await authClient.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });
      
      if (signInError) {
        logApiError('Password Update Re-auth', signInError, userId);
        return res.status(HTTP_STATUS.UNAUTHORIZED).json(
          errorResponse('Current password is incorrect')
        );
      }
      
      // Update the user's password
      const { error: updateError } = await authClient.auth.updateUser({
        password: newPassword
      });
      
      if (updateError) {
        logApiError('Password Update', updateError, userId);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          errorResponse(updateError.message)
        );
      }
      
      // Log successful password update
      logApiInfo('Auth/UpdatePassword', 'Password updated successfully', userId);
      
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
        successResponse({}, 'Password updated successfully')
      );
    } catch (error) {
      // Error is automatically logged by the handler wrapper
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('Password update service unavailable')
      );
    }
  },
  {
    methods: ['POST'],
    context: 'Auth/UpdatePassword'
  }
);