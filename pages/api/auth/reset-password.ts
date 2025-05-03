/**
 * Reset Password Endpoint
 * 
 * Initiates a password reset for a user who has forgotten their password.
 * Sends a password reset email with a link.
 */
import { createPublicHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { logApiInfo, logApiError } from '../../../lib/api/logging';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client for auth operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default createPublicHandler(
  async (req, res) => {
    const { email } = req.body;
    
    // Validate email
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('Valid email address required')
      );
    }
    
    // Clean the email
    const cleanEmail = email.trim().toLowerCase();
    
    try {
      // Get the origin for redirects
      const origin = req.headers.origin || process.env.NEXT_PUBLIC_SITE_URL || '';
      
      // Send password reset email
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(
        cleanEmail,
        {
          redirectTo: origin ? `${origin}/reset-password` : undefined,
        }
      );
      
      if (error) {
        logApiError('Password Reset', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          errorResponse(error.message)
        );
      }
      
      // Log successful operation
      logApiInfo('Auth/ResetPassword', `Password reset email sent to ${cleanEmail}`);
      
      return res.status(HTTP_STATUS.OK).json(
        successResponse({}, 'Password reset instructions sent to your email')
      );
    } catch (error) {
      logApiError('Password Reset Exception', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('Failed to send password reset email')
      );
    }
  },
  {
    methods: ['POST'],
    context: 'Auth/ResetPassword'
  }
);