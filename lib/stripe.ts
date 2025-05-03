/**
 * Stripe Integration Utilities
 * 
 * This file provides utilities for working with Stripe for payment processing.
 */
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
 * 
 * @param amount - The amount in cents
 * @param currency - The currency code (default: usd)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'usd'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2
  });
  
  return formatter.format(amount / 100);
}