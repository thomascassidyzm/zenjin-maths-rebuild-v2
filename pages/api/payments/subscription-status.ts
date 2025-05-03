/**
 * Subscription Status API Endpoint
 *
 * This endpoint retrieves the current subscription status for the authenticated user.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createAuthHandler } from '../../../lib/api/handlers';
import { stripe } from '../../../lib/stripe';
import { formatSuccessResponse, formatErrorResponse } from '../../../lib/api/responses';
import { logError } from '../../../lib/api/logging';

export default createAuthHandler(
  async (req: NextApiRequest, res: NextApiResponse, userId: string, db: any) => {
    try {
      // Get user's subscription info from the database
      const { data: userData, error: userError } = await db
        .from('profiles')
        .select('subscription_id, subscription_status, has_subscription, stripe_customer_id, subscription_updated_at')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        const errorMessage = 'Failed to retrieve user profile';
        logError('Payments/SubscriptionStatus', errorMessage, {
          userId,
          error: userError
        });
        return formatErrorResponse(res, 400, errorMessage);
      }

      // If user has no subscription or customer ID, return empty status
      if (!userData.subscription_id || !userData.stripe_customer_id) {
        return formatSuccessResponse(res, {
          active: false,
          status: userData.subscription_status || 'none',
          subscription: null,
          updatedAt: userData.subscription_updated_at || null
        });
      }

      try {
        // Get the latest subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(userData.subscription_id);
        
        // Get the price information
        const plan = subscription.items.data[0].price;
        
        // Format subscription details for response
        const subscriptionDetails = {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          plan: {
            id: plan.id,
            nickname: plan.nickname || null,
            interval: plan.recurring?.interval || null,
            amount: plan.unit_amount,
            currency: plan.currency
          }
        };

        return formatSuccessResponse(res, {
          active: subscription.status === 'active',
          status: subscription.status,
          subscription: subscriptionDetails,
          updatedAt: userData.subscription_updated_at
        });
      } catch (stripeError: any) {
        // If there's an error retrieving from Stripe but we have local data,
        // return the local data with a warning
        logError('Payments/SubscriptionStatus', 'Failed to retrieve subscription from Stripe', {
          userId,
          subscriptionId: userData.subscription_id,
          error: stripeError
        });
        
        return formatSuccessResponse(res, {
          active: userData.has_subscription,
          status: userData.subscription_status,
          subscription: {
            id: userData.subscription_id,
            warning: 'Could not retrieve latest details from Stripe'
          },
          updatedAt: userData.subscription_updated_at
        });
      }
    } catch (error) {
      logError('Payments/SubscriptionStatus', 'Failed to retrieve subscription status', {
        userId,
        error
      });
      return formatErrorResponse(res, 500, 'Failed to retrieve subscription status');
    }
  },
  {
    methods: ['GET'],
    context: 'Payments/SubscriptionStatus'
  }
);