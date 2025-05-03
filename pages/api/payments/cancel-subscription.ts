/**
 * Cancel Subscription API Endpoint
 *
 * This endpoint cancels the user's Stripe subscription at the end of the current billing period.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createAuthHandler } from '../../../lib/api/handlers';
import { stripe } from '../../../lib/stripe';
import { formatSuccessResponse, formatErrorResponse } from '../../../lib/api/responses';
import { logError, logInfo } from '../../../lib/api/logging';

export default createAuthHandler(
  async (req: NextApiRequest, res: NextApiResponse, userId: string, db: any) => {
    try {
      // Get user's subscription ID from the database
      const { data: userData, error: userError } = await db
        .from('profiles')
        .select('subscription_id, subscription_status')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        const errorMessage = 'Failed to retrieve user profile';
        logError('Payments/CancelSubscription', errorMessage, {
          userId,
          error: userError
        });
        return formatErrorResponse(res, 400, errorMessage);
      }

      // Check if user has an active subscription
      if (!userData.subscription_id || userData.subscription_status !== 'active') {
        return formatErrorResponse(res, 400, 'No active subscription found');
      }

      // Get the subscription from Stripe
      const subscription = await stripe.subscriptions.retrieve(userData.subscription_id);
      
      // Check if the subscription is already set to cancel
      if (subscription.cancel_at_period_end) {
        return formatSuccessResponse(res, {
          message: 'Subscription is already scheduled to cancel at the end of the billing period',
          subscription: {
            id: subscription.id,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            cancelAtPeriodEnd: true
          }
        });
      }

      // Update the subscription to cancel at period end
      const updatedSubscription = await stripe.subscriptions.update(userData.subscription_id, {
        cancel_at_period_end: true
      });

      // Update the database to reflect the pending cancellation
      const { error: updateError } = await db
        .from('profiles')
        .update({
          subscription_status: 'active_until_period_end',
          subscription_updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        logError('Payments/CancelSubscription', 'Failed to update subscription status in database', {
          userId,
          subscriptionId: userData.subscription_id,
          error: updateError
        });
        // Continue despite the database update error - the webhook will eventually update it
      } else {
        logInfo('Payments/CancelSubscription', 'Subscription marked for cancellation in database', {
          userId,
          subscriptionId: userData.subscription_id
        });
      }

      return formatSuccessResponse(res, {
        message: 'Subscription will be canceled at the end of the current billing period',
        subscription: {
          id: updatedSubscription.id,
          currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end
        }
      });
    } catch (error) {
      logError('Payments/CancelSubscription', 'Failed to cancel subscription', {
        userId,
        error
      });
      return formatErrorResponse(res, 500, 'Failed to cancel subscription');
    }
  },
  {
    methods: ['POST'],
    context: 'Payments/CancelSubscription'
  }
);