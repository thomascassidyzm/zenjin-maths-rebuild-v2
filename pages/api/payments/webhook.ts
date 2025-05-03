/**
 * Stripe Webhook Handler
 *
 * This endpoint processes Stripe webhook events to update subscription status
 * and handle payment events.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import { stripe } from '../../../lib/stripe';
import { createServiceRoleClient } from '../../../lib/supabase/admin';
import { logApiError as logError, logApiInfo as logInfo } from '../../../lib/api/logging';

// Disable body parsing, we need the raw body to verify signatures
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = await buffer(req);
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    // Verify the event came from Stripe
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody.toString(),
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      logError('Payments/Webhook', 'Invalid signature', { error: err.message });
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    // Get database client using service role
    const supabase = createServiceRoleClient();

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (userId && customerId && subscriptionId) {
          // Update the user's subscription information
          const { error } = await supabase
            .from('profiles')
            .update({
              subscription_id: subscriptionId,
              subscription_status: 'active',
              has_subscription: true,
              subscription_updated_at: new Date().toISOString()
            })
            .eq('id', userId);

          if (error) {
            logError('Payments/Webhook', 'Failed to update subscription status', {
              userId,
              subscriptionId,
              error
            });
          } else {
            logInfo('Payments/Webhook', 'Subscription activated', {
              userId,
              subscriptionId
            });
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        
        // Find the user with this customer ID
        const { data: users, error: findError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId);

        if (findError || users.length === 0) {
          logError('Payments/Webhook', 'User not found for subscription update', {
            customerId,
            subscriptionId: subscription.id,
            error: findError
          });
          break;
        }

        const userId = users[0].id;
        const status = subscription.status;
        
        // Update the user's subscription status
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: status,
            has_subscription: status === 'active',
            subscription_updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (updateError) {
          logError('Payments/Webhook', 'Failed to update subscription status', {
            userId,
            subscriptionId: subscription.id,
            status,
            error: updateError
          });
        } else {
          logInfo('Payments/Webhook', 'Subscription status updated', {
            userId,
            subscriptionId: subscription.id,
            status
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        
        // Find the user with this customer ID
        const { data: users, error: findError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId);

        if (findError || users.length === 0) {
          logError('Payments/Webhook', 'User not found for subscription deletion', {
            customerId,
            subscriptionId: subscription.id,
            error: findError
          });
          break;
        }

        const userId = users[0].id;
        
        // Update the user's subscription status
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'canceled',
            has_subscription: false,
            subscription_id: null,
            subscription_updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (updateError) {
          logError('Payments/Webhook', 'Failed to update subscription after deletion', {
            userId,
            subscriptionId: subscription.id,
            error: updateError
          });
        } else {
          logInfo('Payments/Webhook', 'Subscription canceled', {
            userId,
            subscriptionId: subscription.id
          });
        }
        break;
      }

      default:
        // Ignore other event types
        logInfo('Payments/Webhook', `Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logError('Payments/Webhook', 'Error processing webhook', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}