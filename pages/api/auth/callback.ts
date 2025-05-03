/**
 * Authentication Callback Endpoint
 * 
 * Handles callbacks from authentication flows including:
 * - Magic link redirects
 * - OAuth provider redirects
 * - OTP verification
 * - PKCE flow callbacks
 * 
 * This endpoint processes the callback and redirects to the appropriate
 * client-side page to complete the authentication flow.
 */
import { createPublicHandler } from '../../../lib/api/handlers';
import { errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { logApiInfo } from '../../../lib/api/logging';

export default createPublicHandler(
  async (req, res) => {
    try {
      // Log the callback parameters
      logApiInfo('Auth/Callback', 'Auth callback received', null, {
        hasCode: !!req.query.code,
        hasToken: !!req.query.token,
        type: req.query.type || null,
        queryParams: req.query
      });
      
      // If this is a direct access without query parameters, redirect to homepage
      if (!req.query.code && !req.query.token && !req.query.type) {
        return res.redirect('/');
      }
      
      // Get origin for client redirect
      const origin = process.env.NEXT_PUBLIC_SITE_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
      
      // Handle PKCE callback (OAuth)
      if (req.query.code) {
        // This is a PKCE callback with an authorization code
        const code = req.query.code as string;
        
        // Exchange the code for a session, this is best handled on client side
        return res.redirect(`${origin}/login-callback?code=${encodeURIComponent(code)}`);
      }
      
      // Handle magic link or OTP token
      if (req.query.token) {
        const token = req.query.token as string;
        let type = (req.query.type as string) || 'signup';
        
        // If we have an error in the URL
        if (req.query.error_description) {
          return res.redirect(
            `${origin}/login-callback?error_description=${encodeURIComponent(req.query.error_description as string)}`
          );
        }
        
        // Special handling for magic links (they come with email param)
        if (req.query.email) {
          const email = req.query.email as string;
          return res.redirect(
            `${origin}/login-callback?token=${encodeURIComponent(token)}&type=${type}&email=${encodeURIComponent(email)}`
          );
        }
        
        // Redirect to client-side page to handle the token
        return res.redirect(`${origin}/login-callback?token=${encodeURIComponent(token)}&type=${type}`);
      }
      
      // Handle magic link flow (access_token/refresh_token in the fragment)
      if (req.query.access_token || req.query.refresh_token) {
        // Redirect to login-callback with fragment preserved
        const redirectUrl = `${origin}/login-callback`;
        const fragmentParams = new URLSearchParams();
        
        if (req.query.access_token) fragmentParams.set('access_token', req.query.access_token as string);
        if (req.query.refresh_token) fragmentParams.set('refresh_token', req.query.refresh_token as string);
        if (req.query.expires_in) fragmentParams.set('expires_in', req.query.expires_in as string);
        
        return res.redirect(`${redirectUrl}#${fragmentParams.toString()}`);
      }
      
      // Default fallback - redirect to homepage
      return res.redirect('/');
    } catch (error) {
      logApiInfo('Auth/Callback', 'Error in auth callback', null, { error });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('An error occurred processing the authentication callback')
      );
    }
  },
  {
    methods: ['GET'],
    context: 'Auth/Callback'
  }
);