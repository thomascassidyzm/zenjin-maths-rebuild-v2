/**
 * Magic Link / OTP Authentication Endpoint
 * 
 * Sends a one-time password (OTP) or magic link to the user's email
 * for passwordless authentication.
 */
import { createPublicHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { createClient } from '@supabase/supabase-js';
import { logApiInfo } from '../../../lib/api/logging';

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
      
      // Send magic link/OTP using signInWithOtp for better compatibility
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: cleanEmail,
        options: {
          // Create user if they don't exist
          shouldCreateUser: true,
          // Set options for the magic link with proper redirect
          redirectTo: origin ? `${origin}/api/auth/callback` : undefined,
        }
      });
      
      if (error) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          errorResponse(error.message)
        );
      }
      
      // Log successful operation
      logApiInfo('Auth/MagicLink', `Magic link sent to ${cleanEmail}`);
      
      return res.status(HTTP_STATUS.OK).json(
        successResponse({}, 'Verification email sent')
      );
    } catch (error) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('Failed to send verification email')
      );
    }
  },
  {
    methods: ['POST'],
    context: 'Auth/MagicLink'
  }
);