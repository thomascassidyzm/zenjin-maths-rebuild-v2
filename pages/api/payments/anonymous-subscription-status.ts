/**
 * Anonymous Subscription Status API Endpoint
 *
 * This endpoint provides subscription status information for anonymous users.
 * It always returns a status indicating free tier access.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createPublicHandler } from '../../../lib/api/handlers';
import { formatSuccessResponse } from '../../../lib/api/responses';

export default createPublicHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
    // Get anonymous ID from body or query
    const anonymousId = req.query.anonymousId || req.body.anonymousId || 'anonymous';

    // For anonymous users, always return free tier status
    return formatSuccessResponse(res, {
      active: false,
      status: 'free',
      subscription: null,
      updatedAt: new Date().toISOString(),
      isAnonymous: true,
      anonymousId
    });
  },
  {
    methods: ['GET', 'POST'],
    context: 'Payments/AnonymousSubscriptionStatus'
  }
);