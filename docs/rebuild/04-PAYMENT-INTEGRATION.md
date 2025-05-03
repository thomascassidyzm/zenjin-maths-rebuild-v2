# Payment Integration

This document outlines the payment integration in the Zenjin Maths application, covering the flow from free user to paid subscription.

## Payment Flow

1. **Free User**: User starts with basic access
2. **Subscription Offer**: User is presented with paid subscription option
3. **Checkout Process**: User completes Stripe checkout
4. **Subscription Active**: User gains access to premium features
5. **Subscription Management**: User can manage subscription

## Stripe Integration Setup

### 1. Stripe Configuration

```typescript
// lib/stripe.ts
import Stripe from 'stripe';

/**
 * Initialize the Stripe client
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16', // Use the latest available version
});

/**
 * Define subscription price IDs
 */
export const SUBSCRIPTION_PRICES = {
  MONTHLY: process.env.STRIPE_PRICE_MONTHLY,
  ANNUAL: process.env.STRIPE_PRICE_ANNUAL,
  LIFETIME: process.env.STRIPE_PRICE_LIFETIME
};

/**
 * Format amount for display
 */
export function formatCurrency(amount: number, currency: string = 'usd'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2
  });
  
  return formatter.format(amount / 100);
}
```

### 2. Create Customer

```typescript
// pages/api/payments/create-customer.ts
import { createAuthHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse } from '../../../lib/api/responses';
import { logApiError } from '../../../lib/api/logging';
import { stripe } from '../../../lib/stripe';

/**
 * Create a Stripe customer for the authenticated user
 */
async function createCustomer(req, res, userId, db) {
  if (req.method !== 'POST') {
    return res.status(405).json(
      errorResponse('Method not allowed')
    );
  }
  
  try {
    // 1. Check if user already has a customer ID
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('stripe_customer_id, display_name')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      logApiError('Customer Profile Fetch', profileError, userId);
      return res.status(500).json(
        errorResponse('Failed to fetch user profile')
      );
    }
    
    // 2. If customer already exists, return it
    if (profile.stripe_customer_id) {
      return res.status(200).json(
        successResponse({
          customerId: profile.stripe_customer_id,
          isExisting: true
        }, 'Customer already exists')
      );
    }
    
    // 3. Get user email from auth
    const { data: user, error: userError } = await db.auth.admin.getUserById(userId);
    
    if (userError) {
      logApiError('Customer User Fetch', userError, userId);
      return res.status(500).json(
        errorResponse('Failed to fetch user details')
      );
    }
    
    // 4. Create Stripe customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: profile.display_name || user.email.split('@')[0],
      metadata: {
        userId: userId
      }
    });
    
    // 5. Store customer ID in profile
    const { error: updateError } = await db
      .from('profiles')
      .update({
        stripe_customer_id: customer.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (updateError) {
      logApiError('Customer Profile Update', updateError, userId);
      return res.status(500).json(
        errorResponse('Failed to update profile with customer ID')
      );
    }
    
    // 6. Return success
    return res.status(200).json(
      successResponse({
        customerId: customer.id,
        isExisting: false
      }, 'Customer created successfully')
    );
  } catch (error) {
    logApiError('Create Customer Exception', error, userId);
    return res.status(500).json(
      errorResponse('Failed to create customer')
    );
  }
}

// Use our handler factory
export default createAuthHandler(createCustomer, {
  methods: ['POST'],
  context: 'Create Stripe Customer'
});
```

### 3. Create Checkout Session

```typescript
// pages/api/payments/create-checkout.ts
import { createAuthHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse } from '../../../lib/api/responses';
import { logApiError } from '../../../lib/api/logging';
import { stripe } from '../../../lib/stripe';

/**
 * Create a Stripe checkout session for subscription
 */
async function createCheckout(req, res, userId, db) {
  if (req.method !== 'POST') {
    return res.status(405).json(
      errorResponse('Method not allowed')
    );
  }
  
  const { priceId, successUrl, cancelUrl } = req.body;
  
  if (!priceId) {
    return res.status(400).json(
      errorResponse('Missing required parameter: priceId')
    );
  }
  
  try {
    // 1. Get or create customer ID
    let customerId;
    
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      logApiError('Checkout Profile Fetch', profileError, userId);
      return res.status(500).json(
        errorResponse('Failed to fetch user profile')
      );
    }
    
    if (profile.stripe_customer_id) {
      customerId = profile.stripe_customer_id;
    } else {
      // Create customer via the dedicated endpoint
      const createCustomerResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/payments/create-customer`, {
        method: 'POST',
        headers: {
          'Cookie': req.headers.cookie || ''
        }
      });
      
      if (!createCustomerResponse.ok) {
        return res.status(500).json(
          errorResponse('Failed to create customer')
        );
      }
      
      const customerData = await createCustomerResponse.json();
      customerId = customerData.customerId;
    }
    
    // 2. Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/payment-cancel`,
      metadata: {
        userId
      },
      allow_promotion_codes: true
    });
    
    // 3. Return checkout session details
    return res.status(200).json(
      successResponse({
        sessionId: session.id,
        checkoutUrl: session.url
      }, 'Checkout session created')
    );
  } catch (error) {
    logApiError('Create Checkout Exception', error, userId);
    return res.status(500).json(
      errorResponse('Failed to create checkout session')
    );
  }
}

// Use our handler factory
export default createAuthHandler(createCheckout, {
  methods: ['POST'],
  context: 'Create Checkout Session'
});
```

### 4. Handle Stripe Webhooks

```typescript
// pages/api/payments/webhook.ts
import { buffer } from 'micro';
import { stripe } from '../../../lib/stripe';
import { logApiError } from '../../../lib/api/logging';
import { supabaseAdmin } from '../../../lib/api/auth';

export const config = {
  api: {
    bodyParser: false
  }
};

/**
 * Handle Stripe webhook events
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }
  
  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (error) {
    logApiError('Webhook Signature', error);
    return res.status(400).json({
      success: false,
      error: `Webhook signature verification failed: ${error.message}`
    });
  }
  
  try {
    switch (event.type) {
      // Handle successful checkout
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        
        console.log(`Checkout completed for user ${userId}, subscription ${subscriptionId}`);
        
        // Update user profile with subscription status
        if (userId) {
          await supabaseAdmin
            .from('profiles')
            .update({
              is_subscribed: true,
              subscription_id: subscriptionId,
              subscription_status: 'active',
              stripe_customer_id: customerId,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);
          
          // Also log subscription event
          await supabaseAdmin
            .from('subscription_events')
            .insert({
              user_id: userId,
              event_type: 'subscription_created',
              stripe_event_id: event.id,
              subscription_id: subscriptionId,
              customer_id: customerId,
              created_at: new Date().toISOString()
            });
        }
        break;
      }
      
      // Handle subscription updates
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        // Find user with this subscription ID
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('subscription_id', subscription.id);
        
        if (profiles && profiles.length > 0) {
          const userId = profiles[0].id;
          
          await supabaseAdmin
            .from('profiles')
            .update({
              is_subscribed: subscription.status === 'active',
              subscription_status: subscription.status,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);
          
          // Log subscription event
          await supabaseAdmin
            .from('subscription_events')
            .insert({
              user_id: userId,
              event_type: 'subscription_updated',
              stripe_event_id: event.id,
              subscription_id: subscription.id,
              customer_id: subscription.customer,
              created_at: new Date().toISOString()
            });
        }
        break;
      }
      
      // Handle subscription cancellations
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        // Find user with this subscription ID
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('subscription_id', subscription.id);
        
        if (profiles && profiles.length > 0) {
          const userId = profiles[0].id;
          
          await supabaseAdmin
            .from('profiles')
            .update({
              is_subscribed: false,
              subscription_status: 'canceled',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);
          
          // Log subscription event
          await supabaseAdmin
            .from('subscription_events')
            .insert({
              user_id: userId,
              event_type: 'subscription_canceled',
              stripe_event_id: event.id,
              subscription_id: subscription.id,
              customer_id: subscription.customer,
              created_at: new Date().toISOString()
            });
        }
        break;
      }
      
      // Handle invoice payment failures
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        // Find user with this customer ID
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId);
        
        if (profiles && profiles.length > 0) {
          const userId = profiles[0].id;
          
          // Log payment failure
          await supabaseAdmin
            .from('subscription_events')
            .insert({
              user_id: userId,
              event_type: 'payment_failed',
              stripe_event_id: event.id,
              invoice_id: invoice.id,
              customer_id: customerId,
              created_at: new Date().toISOString()
            });
        }
        break;
      }
    }
    
    return res.status(200).json({ received: true });
  } catch (error) {
    logApiError('Webhook Handler', error);
    return res.status(500).json({
      success: false,
      error: 'Webhook handler failed'
    });
  }
}
```

### 5. Get Subscription Status

```typescript
// pages/api/payments/subscription-status.ts
import { createAuthHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse } from '../../../lib/api/responses';
import { logApiError } from '../../../lib/api/logging';
import { stripe } from '../../../lib/stripe';

/**
 * Get the user's subscription status
 */
async function getSubscriptionStatus(req, res, userId, db) {
  if (req.method !== 'GET') {
    return res.status(405).json(
      errorResponse('Method not allowed')
    );
  }
  
  try {
    // 1. Check user profile for subscription details
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('is_subscribed, subscription_id, subscription_status, stripe_customer_id')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      logApiError('Subscription Profile Fetch', profileError, userId);
      return res.status(500).json(
        errorResponse('Failed to fetch user profile')
      );
    }
    
    // 2. If not subscribed, return basic status
    if (!profile.is_subscribed || !profile.subscription_id) {
      return res.status(200).json(
        successResponse({
          isSubscribed: false,
          status: profile.subscription_status || 'no_subscription',
          customerId: profile.stripe_customer_id || null
        })
      );
    }
    
    // 3. For subscribers, fetch detailed info from Stripe
    const subscription = await stripe.subscriptions.retrieve(profile.subscription_id);
    
    // 4. Process subscription details
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    const cancelAtPeriodEnd = subscription.cancel_at_period_end;
    const status = subscription.status;
    
    // 5. Get price details
    const priceId = subscription.items.data[0].price.id;
    const priceNickname = subscription.items.data[0].price.nickname;
    const interval = subscription.items.data[0].price.recurring?.interval || 'month';
    const amount = subscription.items.data[0].price.unit_amount || 0;
    
    // 6. Return complete subscription info
    return res.status(200).json(
      successResponse({
        isSubscribed: status === 'active',
        status,
        subscriptionId: profile.subscription_id,
        customerId: profile.stripe_customer_id,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        pricing: {
          priceId,
          name: priceNickname,
          interval,
          amount
        }
      })
    );
  } catch (error) {
    logApiError('Subscription Status Exception', error, userId);
    return res.status(500).json(
      errorResponse('Failed to fetch subscription status')
    );
  }
}

// Use our handler factory
export default createAuthHandler(getSubscriptionStatus, {
  methods: ['GET'],
  context: 'Subscription Status'
});
```

### 6. Cancel Subscription

```typescript
// pages/api/payments/cancel-subscription.ts
import { createAuthHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse } from '../../../lib/api/responses';
import { logApiError } from '../../../lib/api/logging';
import { stripe } from '../../../lib/stripe';

/**
 * Cancel the user's subscription
 */
async function cancelSubscription(req, res, userId, db) {
  if (req.method !== 'POST') {
    return res.status(405).json(
      errorResponse('Method not allowed')
    );
  }
  
  const { cancelImmediately = false } = req.body;
  
  try {
    // 1. Get subscription ID from profile
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('subscription_id')
      .eq('id', userId)
      .single();
    
    if (profileError || !profile || !profile.subscription_id) {
      logApiError('Cancel Subscription Profile', profileError, userId);
      return res.status(400).json(
        errorResponse('No active subscription found')
      );
    }
    
    // 2. Cancel the subscription
    if (cancelImmediately) {
      // Immediate cancellation
      await stripe.subscriptions.cancel(profile.subscription_id);
      
      // Update profile
      await db
        .from('profiles')
        .update({
          is_subscribed: false,
          subscription_status: 'canceled',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    } else {
      // End at period end
      await stripe.subscriptions.update(profile.subscription_id, {
        cancel_at_period_end: true
      });
      
      // Update profile (still subscribed until period end)
      await db
        .from('profiles')
        .update({
          subscription_status: 'canceling',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    }
    
    // 3. Return success
    return res.status(200).json(
      successResponse({
        canceled: true,
        immediate: cancelImmediately
      }, cancelImmediately ? 
         'Subscription canceled immediately' : 
         'Subscription will end at the current billing period')
    );
  } catch (error) {
    logApiError('Cancel Subscription Exception', error, userId);
    return res.status(500).json(
      errorResponse('Failed to cancel subscription')
    );
  }
}

// Use our handler factory
export default createAuthHandler(cancelSubscription, {
  methods: ['POST'],
  context: 'Cancel Subscription'
});
```

## Client-Side Payment Integration

### 1. Subscription Hook

```typescript
// lib/hooks/useSubscription.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

/**
 * Hook for managing subscription status and actions
 */
export function useSubscription() {
  const { isAuthenticated } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch subscription status
  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setIsSubscribed(false);
      setSubscriptionData(null);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/payments/subscription-status', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch subscription status');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setIsSubscribed(data.isSubscribed);
        setSubscriptionData(data);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Subscription status error:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);
  
  // Start checkout process
  const startCheckout = useCallback(async (priceId) => {
    if (!isAuthenticated) {
      return { success: false, error: 'Must be signed in to subscribe' };
    }
    
    try {
      const response = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ priceId }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }
      
      const data = await response.json();
      
      if (data.success && data.checkoutUrl) {
        // Redirect to checkout
        window.location.href = data.checkoutUrl;
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Checkout error:', error);
      return { success: false, error: error.message };
    }
  }, [isAuthenticated]);
  
  // Cancel subscription
  const cancelSubscription = useCallback(async (immediate = false) => {
    if (!isAuthenticated || !isSubscribed) {
      return { success: false, error: 'No active subscription to cancel' };
    }
    
    try {
      const response = await fetch('/api/payments/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cancelImmediately: immediate }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh subscription status
        await fetchStatus();
        return { success: true, message: data.message };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Cancel subscription error:', error);
      return { success: false, error: error.message };
    }
  }, [isAuthenticated, isSubscribed, fetchStatus]);
  
  // Load subscription status on mount and auth change
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);
  
  return {
    isSubscribed,
    isLoading,
    error,
    subscriptionData,
    fetchStatus,
    startCheckout,
    cancelSubscription
  };
}
```

### 2. Pricing Component

```tsx
// components/PricingPlans.tsx
import { useState } from 'react';
import { useSubscription } from '../lib/hooks/useSubscription';
import { SUBSCRIPTION_PRICES, formatCurrency } from '../lib/stripe';

// Pricing data
const plans = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 9.99,
    priceId: SUBSCRIPTION_PRICES.MONTHLY,
    features: [
      'Full access to all content',
      'Personalized learning paths',
      'Progress tracking',
      'Cancel anytime'
    ]
  },
  {
    id: 'annual',
    name: 'Annual',
    price: 89.99,
    priceId: SUBSCRIPTION_PRICES.ANNUAL,
    features: [
      'Everything in Monthly',
      'Save 25% vs monthly',
      'Advanced analytics',
      'Priority support'
    ],
    popular: true
  }
];

export default function PricingPlans() {
  const { isSubscribed, subscriptionData, isLoading, startCheckout } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState('annual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  // Handle subscription checkout
  const handleSubscribe = async (priceId) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await startCheckout(priceId);
      
      if (!result.success) {
        setError(result.error);
      }
      // Redirect happens in the hook
    } catch (error) {
      setError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // If already subscribed, show current plan
  if (isSubscribed && subscriptionData) {
    return (
      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-4">Your Subscription</h2>
        <div className="mb-6">
          <p className="text-white/80">
            You are currently subscribed to the{' '}
            <span className="font-medium text-teal-300">
              {subscriptionData.pricing?.name || 'Premium'}
            </span> plan.
          </p>
          <p className="text-white/80 mt-2">
            Your subscription will {subscriptionData.cancelAtPeriodEnd 
              ? 'end' 
              : 'renew'} on {new Date(subscriptionData.currentPeriodEnd).toLocaleDateString()}.
          </p>
        </div>
        
        {/* Show cancel button if active and not already canceling */}
        {!subscriptionData.cancelAtPeriodEnd && (
          <button
            onClick={() => window.location.href = '/account/subscription'}
            className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors"
          >
            Manage Subscription
          </button>
        )}
      </div>
    );
  }
  
  // Show plans for non-subscribers
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-white text-center">Choose Your Plan</h2>
      
      {/* Error display */}
      {error && (
        <div className="bg-red-500/20 border border-red-300/30 text-red-100 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}
      
      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {plans.map((plan) => (
          <div 
            key={plan.id}
            className={`bg-white/10 backdrop-blur-lg rounded-xl p-6 border-2 transition-all ${
              plan.id === selectedPlan 
                ? 'border-teal-400 shadow-lg shadow-teal-500/20' 
                : 'border-white/20'
            } ${plan.popular ? 'relative' : ''}`}
            onClick={() => setSelectedPlan(plan.id)}
          >
            {/* Popular badge */}
            {plan.popular && (
              <div className="absolute top-0 right-0 bg-teal-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                MOST POPULAR
              </div>
            )}
            
            <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
            <div className="mb-4">
              <span className="text-3xl font-bold text-white">${plan.price}</span>
              <span className="text-white/60">
                {plan.id === 'monthly' ? '/month' : '/year'}
              </span>
            </div>
            
            <ul className="space-y-2 mb-6">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-start text-white/80">
                  <svg className="h-5 w-5 text-teal-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            
            <button
              onClick={() => handleSubscribe(plan.priceId)}
              disabled={isProcessing}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                plan.id === selectedPlan
                  ? 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              {isProcessing ? 'Processing...' : 'Subscribe Now'}
            </button>
          </div>
        ))}
      </div>
      
      <div className="text-center text-white/60 text-sm">
        By subscribing, you agree to our Terms of Service and Privacy Policy.
        All plans include a 7-day money back guarantee.
      </div>
    </div>
  );
}
```

### 3. Subscription Management Component

```tsx
// components/SubscriptionManager.tsx
import { useState } from 'react';
import { useSubscription } from '../lib/hooks/useSubscription';
import { formatCurrency } from '../lib/stripe';

export default function SubscriptionManager() {
  const { isSubscribed, subscriptionData, isLoading, cancelSubscription } = useSubscription();
  const [isCanceling, setIsCanceling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  
  // Handle cancel button click
  const handleCancelClick = () => {
    setShowConfirm(true);
  };
  
  // Handle cancel confirmation
  const handleConfirmCancel = async () => {
    setIsCanceling(true);
    setError(null);
    
    try {
      const result = await cancelSubscription(false);
      
      if (result.success) {
        setMessage(result.message);
        setShowConfirm(false);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsCanceling(false);
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin h-8 w-8 border-4 border-t-blue-500 border-blue-200 rounded-full"></div>
      </div>
    );
  }
  
  // Not subscribed state
  if (!isSubscribed || !subscriptionData) {
    return (
      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-4">No Active Subscription</h2>
        <p className="text-white/80 mb-6">
          You don't currently have an active subscription. 
          Subscribe to get full access to all content.
        </p>
        <button
          onClick={() => window.location.href = '/pricing'}
          className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors"
        >
          View Plans
        </button>
      </div>
    );
  }
  
  return (
    <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-6">Manage Subscription</h2>
      
      {/* Success message */}
      {message && (
        <div className="bg-green-500/20 border border-green-300/30 text-green-100 p-4 rounded-lg mb-6">
          {message}
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="bg-red-500/20 border border-red-300/30 text-red-100 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}
      
      {/* Subscription details */}
      <div className="mb-8 space-y-4">
        <div>
          <h3 className="text-white/60 text-sm">Plan</h3>
          <p className="text-white font-medium">{subscriptionData.pricing?.name || 'Premium'}</p>
        </div>
        
        <div>
          <h3 className="text-white/60 text-sm">Price</h3>
          <p className="text-white font-medium">
            {subscriptionData.pricing?.amount 
              ? formatCurrency(subscriptionData.pricing.amount)
              : '$9.99'} / {subscriptionData.pricing?.interval || 'month'}
          </p>
        </div>
        
        <div>
          <h3 className="text-white/60 text-sm">Status</h3>
          <p className="text-white font-medium capitalize">
            {subscriptionData.cancelAtPeriodEnd 
              ? 'Canceling' 
              : subscriptionData.status || 'Active'}
          </p>
        </div>
        
        <div>
          <h3 className="text-white/60 text-sm">Renewal Date</h3>
          <p className="text-white font-medium">
            {subscriptionData.currentPeriodEnd 
              ? new Date(subscriptionData.currentPeriodEnd).toLocaleDateString() 
              : 'N/A'}
            {subscriptionData.cancelAtPeriodEnd && ' (Will not renew)'}
          </p>
        </div>
      </div>
      
      {/* Cancel subscription button */}
      {!subscriptionData.cancelAtPeriodEnd && !showConfirm && (
        <button
          onClick={handleCancelClick}
          className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
        >
          Cancel Subscription
        </button>
      )}
      
      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="bg-red-900/30 p-6 rounded-lg border border-red-400/30">
          <h3 className="text-lg font-medium text-white mb-2">Confirm Cancellation</h3>
          <p className="text-white/80 mb-4">
            Your subscription will remain active until the end of your current billing period, 
            after which it will not renew.
          </p>
          <div className="flex space-x-4">
            <button
              onClick={handleConfirmCancel}
              disabled={isCanceling}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
            >
              {isCanceling ? 'Processing...' : 'Confirm Cancel'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg transition-colors"
            >
              Keep Subscription
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Payment Flow Integration with Player

The MinimalDistinctionPlayer component will be updated to check subscription status and show upgrade prompts:

```tsx
// components/SubscriptionPrompt.tsx
import { useSubscription } from '../lib/hooks/useSubscription';

export default function SubscriptionPrompt({ onClose }) {
  const { startCheckout } = useSubscription();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleUpgrade = async () => {
    setIsProcessing(true);
    // Use first available price (monthly)
    await startCheckout(process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY);
    setIsProcessing(false);
  };
  
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md bg-black/70 backdrop-blur-xl rounded-xl shadow-xl p-6 border border-white/20 animate-fadeInUp">
      <button 
        onClick={onClose}
        className="absolute top-2 right-2 text-white/50 hover:text-white/80"
      >
        ✕
      </button>
      
      <h3 className="text-xl font-bold text-white mb-2">
        Unlock Premium Content
      </h3>
      
      <p className="text-white/80 mb-4">
        Subscribe to access all content, track your progress across devices, and advance faster.
      </p>
      
      <div className="flex space-x-4">
        <button
          onClick={handleUpgrade}
          disabled={isProcessing}
          className="flex-1 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-medium rounded-lg transition-colors"
        >
          {isProcessing ? 'Processing...' : 'Upgrade Now'}
        </button>
        
        <button
          onClick={() => window.location.href = '/pricing'}
          className="py-2 px-4 bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg transition-colors"
        >
          Learn More
        </button>
      </div>
    </div>
  );
}
```

The subscription check will be integrated into the player:

```tsx
// In MinimalDistinctionPlayer.tsx
const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
const { isSubscribed } = useSubscription();

// Show subscription prompt after completing a certain number of sessions
useEffect(() => {
  if (!isSubscribed && sessionCount >= 3) {
    const hasSeenPrompt = localStorage.getItem('hasSeenSubscriptionPrompt');
    if (!hasSeenPrompt) {
      setShowSubscriptionPrompt(true);
      localStorage.setItem('hasSeenSubscriptionPrompt', 'true');
    }
  }
}, [sessionCount, isSubscribed]);

// In the render:
{showSubscriptionPrompt && (
  <SubscriptionPrompt onClose={() => setShowSubscriptionPrompt(false)} />
)}
```

## Database Schema for Subscriptions

Additional tables for subscription management:

```sql
-- Subscription events table
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT,
  subscription_id TEXT,
  customer_id TEXT,
  invoice_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pricing plans table (can be updated via admin panel)
CREATE TABLE IF NOT EXISTS pricing_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  interval TEXT DEFAULT 'month',
  is_active BOOLEAN DEFAULT true,
  features JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial pricing plans
INSERT INTO pricing_plans (name, description, price_id, amount, interval, features)
VALUES
  ('Monthly', 'Full access with monthly billing', 'price_monthly', 999, 'month', 
   '["Full access to all content", "Personalized learning paths", "Progress tracking", "Cancel anytime"]'),
  ('Annual', 'Full access with annual billing (save 25%)', 'price_annual', 8999, 'year',
   '["Everything in Monthly", "Save 25% vs monthly", "Advanced analytics", "Priority support"]');
```

## Payment Success and Cancel Pages

```tsx
// pages/payment-success.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import BackgroundBubbles from '../components/BackgroundBubbles';

export default function PaymentSuccess() {
  const router = useRouter();
  const { session_id } = router.query;
  const [isVerifying, setIsVerifying] = useState(true);
  const [verification, setVerification] = useState({ success: false, message: '' });
  
  // Verify the session when component mounts
  useEffect(() => {
    if (session_id) {
      verifyPayment(session_id as string);
    }
  }, [session_id]);
  
  // Verify the payment session
  async function verifyPayment(sessionId: string) {
    try {
      const response = await fetch(`/api/payments/verify-session?session_id=${sessionId}`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      setVerification(data);
    } catch (error) {
      setVerification({
        success: false,
        message: 'Failed to verify payment session. Please contact support.'
      });
    } finally {
      setIsVerifying(false);
    }
  }
  
  return (
    <div className="min-h-screen player-bg relative flex flex-col">
      <BackgroundBubbles />
      
      <div className="flex-1 flex items-center justify-center p-6 z-10">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl max-w-md w-full text-center">
          {isVerifying ? (
            <>
              <div className="animate-spin h-12 w-12 border-4 border-t-teal-500 border-teal-200 rounded-full mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-white mb-2">Verifying Payment</h2>
              <p className="text-white/80">Please wait while we verify your payment...</p>
            </>
          ) : verification.success ? (
            <>
              <div className="bg-teal-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-10 w-10 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
              <p className="text-white/80 mb-6">
                Thank you for your subscription. You now have full access to all content.
              </p>
              <div className="space-y-3">
                <Link href="/minimal-player" className="block py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-medium rounded-lg transition-colors">
                  Continue Learning
                </Link>
                <Link href="/dashboard" className="block py-3 bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg transition-colors">
                  View Dashboard
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="bg-red-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Verification Failed</h2>
              <p className="text-white/80 mb-6">
                {verification.message || 'There was an issue verifying your payment. Please contact support.'}
              </p>
              <div className="space-y-3">
                <Link href="/pricing" className="block py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-medium rounded-lg transition-colors">
                  Try Again
                </Link>
                <Link href="/contact" className="block py-3 bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg transition-colors">
                  Contact Support
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

```tsx
// pages/payment-cancel.tsx
import Link from 'next/link';
import BackgroundBubbles from '../components/BackgroundBubbles';

export default function PaymentCancel() {
  return (
    <div className="min-h-screen player-bg relative flex flex-col">
      <BackgroundBubbles />
      
      <div className="flex-1 flex items-center justify-center p-6 z-10">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl max-w-md w-full text-center">
          <div className="bg-yellow-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-10 w-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Payment Cancelled</h2>
          <p className="text-white/80 mb-6">
            Your subscription process was cancelled. No payment has been taken.
          </p>
          <div className="space-y-3">
            <Link href="/pricing" className="block py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-medium rounded-lg transition-colors">
              Return to Pricing
            </Link>
            <Link href="/minimal-player" className="block py-3 bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg transition-colors">
              Continue Learning
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```