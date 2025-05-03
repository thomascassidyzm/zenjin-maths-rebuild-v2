/**
 * OTP Verification Endpoint
 * 
 * Verifies the one-time password (OTP) sent to the user's email
 * and creates an authenticated session if valid.
 */
import { createPublicHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { createRouteHandlerClient } from '../../../lib/supabase/route';
import { logApiInfo, logApiError } from '../../../lib/api/logging';

export default createPublicHandler(
  async (req, res) => {
    // Get verification parameters
    const { email, code } = req.body;
    
    // Validate inputs
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('Valid email address required')
      );
    }
    
    if (!code || typeof code !== 'string') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('Verification code required')
      );
    }
    
    // Clean the email
    const cleanEmail = email.trim().toLowerCase();
    
    try {
      // Create Supabase client with cookie handling
      const supabaseClient = createRouteHandlerClient(req, res);
      
      // Verify OTP code
      const { data, error } = await supabaseClient.auth.verifyOtp({
        email: cleanEmail,
        token: code,
        type: 'email'
      });
      
      if (error) {
        logApiError('OTP Verification', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          errorResponse(error.message)
        );
      }
      
      if (!data.session || !data.user) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          errorResponse('Verification failed')
        );
      }
      
      // Log successful verification
      logApiInfo('Auth/Verify', `User verified: ${data.user.id}`, data.user.id);
      
      // Successfully verified
      return res.status(HTTP_STATUS.OK).json(
        successResponse({
          user: {
            id: data.user.id,
            email: data.user.email
          }
        }, 'Successfully verified')
      );
    } catch (error) {
      logApiError('OTP Verification Exception', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('Verification service unavailable')
      );
    }
  },
  {
    methods: ['POST'],
    context: 'Auth/Verify'
  }
);