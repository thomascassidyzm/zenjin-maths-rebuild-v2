/**
 * Client-side payment utilities
 *
 * This module provides functions for interacting with the payment API endpoints.
 */
import { SUBSCRIPTION_PRICES } from '../stripe';

// Subscription plan type
export type SubscriptionPlan = 'MONTHLY' | 'ANNUAL' | 'LIFETIME';

// Subscription status response type
export interface SubscriptionStatusResponse {
  active: boolean;
  status: string;
  subscription: {
    id: string;
    status?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    plan?: {
      id: string;
      nickname: string | null;
      interval: string | null;
      amount: number | null;
      currency: string;
    };
    warning?: string;
  } | null;
  updatedAt: string | null;
}

/**
 * Create a Stripe customer for the current user
 * 
 * @returns Promise with customer ID
 */
export async function createCustomer(): Promise<string> {
  const response = await fetch('/api/payments/create-customer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create customer');
  }

  const data = await response.json();
  return data.data.customerId;
}

/**
 * Create a checkout session for the selected subscription plan
 * 
 * @param plan - The subscription plan to checkout
 * @param successUrl - URL to redirect after successful payment
 * @param cancelUrl - URL to redirect if user cancels
 * @returns Checkout session URL
 */
export async function createCheckoutSession(
  plan: SubscriptionPlan,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const priceId = SUBSCRIPTION_PRICES[plan];
  
  if (!priceId) {
    throw new Error(`Invalid subscription plan: ${plan}`);
  }

  const response = await fetch('/api/payments/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      priceId,
      successUrl,
      cancelUrl
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create checkout session');
  }

  const data = await response.json();
  return data.data.url;
}

/**
 * Get current subscription status
 * 
 * @returns Subscription status information
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatusResponse> {
  const response = await fetch('/api/payments/subscription-status');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get subscription status');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Cancel the current subscription at the end of the billing period
 * 
 * @returns Information about the canceled subscription
 */
export async function cancelSubscription(): Promise<any> {
  const response = await fetch('/api/payments/cancel-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to cancel subscription');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Redirect to Stripe checkout for the selected plan
 * 
 * This is a convenience function that creates a customer if needed,
 * then creates a checkout session and redirects the browser.
 * 
 * @param plan - The subscription plan to checkout
 * @param successUrl - URL to redirect after successful payment
 * @param cancelUrl - URL to redirect if user cancels
 */
export async function subscribeToPlay(
  plan: SubscriptionPlan,
  successUrl: string = `/subscription/success`,
  cancelUrl: string = `/subscription/canceled`
): Promise<void> {
  try {
    // Try to create checkout directly, this will fail if user has no customer ID
    const checkoutUrl = await createCheckoutSession(plan, successUrl, cancelUrl);
    window.location.href = checkoutUrl;
  } catch (error) {
    // If it fails, try to create a customer first
    try {
      await createCustomer();
      // Then try checkout again
      const checkoutUrl = await createCheckoutSession(plan, successUrl, cancelUrl);
      window.location.href = checkoutUrl;
    } catch (customerError) {
      console.error('Failed to create customer or checkout session', customerError);
      throw customerError;
    }
  }
}