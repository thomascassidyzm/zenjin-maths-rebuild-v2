/**
 * Update User Email Endpoint
 * 
 * Changes the email address for an authenticated user.
 * This operation requires re-authentication for users with passwords
 * and sends a verification email to the new address.
 */
import { createAuthHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { logApiInfo, logApiError } from '../../../lib/api/logging';
import { createRouteHandlerClient } from '../../../lib/supabase/route';

export default createAuthHandler(
  async (req, res, userId, db) => {
    // Get the new email from the request
    const { email, password } = req.body;
    
    // Validate inputs
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('Valid email address required')
      );
    }
    
    try {
      // Create Supabase client with cookie handling
      const supabaseClient = createRouteHandlerClient(req, res);
      
      // First, get the user's current email and profile
      const { data: { user } } = await supabaseClient.auth.getUser();
      
      if (!user || !user.email) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          errorResponse('Unable to retrieve current user')
        );
      }
      
      // Check if the user has a password set
      const { data: profileData, error: profileError } = await db
        .from('profiles')
        .select('has_password')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        logApiError('Email Update Profile Check', profileError, userId);
      }
      
      const hasPassword = profileData?.has_password || false;
      
      // If user has a password and one is provided, verify it
      if (hasPassword && password) {
        // Re-authenticate with their current email and password
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({
          email: user.email,
          password: password
        });
        
        if (signInError) {
          logApiError('Email Update Re-auth', signInError, userId);
          return res.status(HTTP_STATUS.UNAUTHORIZED).json(
            errorResponse('Password verification failed')
          );
        }
      } 
      // If user has a password but didn't provide one
      else if (hasPassword && !password) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          errorResponse('Password required for verification')
        );
      }
      // For OTP users without a password, we allow the change without verification
      // since they're already authenticated with their session
      
      // Update the user's email
      const { error: updateError } = await supabaseClient.auth.updateUser({
        email: email
      });
      
      if (updateError) {
        logApiError('Email Update', updateError, userId);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          errorResponse(updateError.message)
        );
      }
      
      // Log successful email update request
      logApiInfo('Auth/UpdateEmail', 'Email update initiated', userId, {
        newEmail: email
      });
      
      return res.status(HTTP_STATUS.OK).json(
        successResponse({}, 'Email update initiated. Please check your new email for verification.')
      );
    } catch (error) {
      // Error is automatically logged by the handler wrapper
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('Email update service unavailable')
      );
    }
  },
  {
    methods: ['POST'],
    context: 'Auth/UpdateEmail'
  }
);