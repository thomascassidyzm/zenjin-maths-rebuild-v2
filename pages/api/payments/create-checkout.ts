/**
 * Create Checkout Session API Endpoint
 *
 * This endpoint creates a Stripe checkout session for the authenticated user
 * with the specified subscription plan.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createAuthHandler } from '../../../lib/api/handlers';
import { stripe, SUBSCRIPTION_PRICES } from '../../../lib/stripe';
import { formatSuccessResponse, formatErrorResponse } from '../../../lib/api/responses';
import { logError } from '../../../lib/api/logging';

export default createAuthHandler(
  async (req: NextApiRequest, res: NextApiResponse, userId: string, db: any) => {
    try {
      const { priceId, successUrl, cancelUrl } = req.body;

      // Validate required fields
      if (!priceId || !successUrl || !cancelUrl) {
        return formatErrorResponse(res, 400, 'Missing required fields: priceId, successUrl, or cancelUrl');
      }

      // Validate the price ID is one we support
      const validPriceIds = Object.values(SUBSCRIPTION_PRICES).filter(Boolean);
      if (!validPriceIds.includes(priceId)) {
        return formatErrorResponse(res, 400, 'Invalid price ID');
      }

      // Get the user's Stripe customer ID
      const { data: userData, error: userError } = await db
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        const errorMessage = 'Failed to retrieve user profile';
        logError('Payments/CreateCheckout', errorMessage, {
          userId,
          error: userError
        });
        return formatErrorResponse(res, 400, errorMessage);
      }

      // Make sure the user has a Stripe customer ID
      if (!userData.stripe_customer_id) {
        return formatErrorResponse(res, 400, 'User does not have a Stripe customer ID. Please create a customer first.');
      }

      // Create the checkout session
      const session = await stripe.checkout.sessions.create({
        customer: userData.stripe_customer_id,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId,
        },
      });

      return formatSuccessResponse(res, {
        sessionId: session.id,
        url: session.url
      });
    } catch (error) {
      logError('Payments/CreateCheckout', 'Failed to create checkout session', {
        userId,
        error
      });
      return formatErrorResponse(res, 500, 'Failed to create checkout session');
    }
  },
  {
    methods: ['POST'],
    context: 'Payments/CreateCheckout'
  }
);