/**
 * Sign Out Endpoint
 * 
 * Ends the user's session and clears authentication cookies.
 */
import { createPublicHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { createRouteHandlerClient } from '../../../lib/supabase/route';
import { logApiInfo } from '../../../lib/api/logging';

export default createPublicHandler(
  async (req, res) => {
    try {
      // Create Supabase client with cookie handling
      const supabaseClient = createRouteHandlerClient(req, res);
      
      // Check if there's an active session
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      // Perform sign out
      const { error } = await supabaseClient.auth.signOut();
      
      if (error) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
          errorResponse(error.message)
        );
      }
      
      // Log sign out if there was an active session
      if (session) {
        logApiInfo('Auth/SignOut', 'User signed out', session.user.id);
      }
      
      return res.status(HTTP_STATUS.OK).json(
        successResponse({}, 'Successfully signed out')
      );
    } catch (error) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('Failed to sign out')
      );
    }
  },
  {
    methods: ['POST'],
    context: 'Auth/SignOut'
  }
);