# Payment Integration with Stripe

This document outlines the payment integration for Zenjin Maths using Stripe.

## Overview

The payment integration consists of the following components:

1. **Stripe Configuration**: Setup for Stripe client and subscription price constants
2. **API Endpoints**: Server-side API endpoints for payment processing
3. **Client Utilities**: Client-side functions for interacting with payment endpoints
4. **UI Components**: User interface for subscription management

## Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Product/Price IDs
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...
STRIPE_PRICE_LIFETIME=price_...
```

## API Endpoints

### 1. Create Stripe Customer

**Endpoint**: `/api/payments/create-customer`
**Method**: POST
**Description**: Creates a Stripe customer for the authenticated user

### 2. Create Checkout Session

**Endpoint**: `/api/payments/create-checkout`
**Method**: POST
**Description**: Creates a Stripe checkout session for subscription purchase
**Parameters**:
- `priceId`: The Stripe price ID for the selected subscription plan
- `successUrl`: URL to redirect after successful payment
- `cancelUrl`: URL to redirect if payment is canceled

### 3. Stripe Webhook Handler

**Endpoint**: `/api/payments/webhook`
**Method**: POST
**Description**: Handles Stripe webhook events (subscription created, updated, etc.)

### 4. Subscription Status

**Endpoint**: `/api/payments/subscription-status`
**Method**: GET
**Description**: Gets the current subscription status for the authenticated user

### 5. Cancel Subscription

**Endpoint**: `/api/payments/cancel-subscription`
**Method**: POST
**Description**: Cancels the user's subscription at the end of the current billing period

## Database Schema

The subscription information is stored in the user's profile table:

```sql
ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN subscription_id TEXT;
ALTER TABLE profiles ADD COLUMN subscription_status TEXT;
ALTER TABLE profiles ADD COLUMN has_subscription BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN subscription_updated_at TIMESTAMPTZ;
```

## Client Usage

### Check Subscription Status

```typescript
import { getSubscriptionStatus } from '../lib/client/payments';

const status = await getSubscriptionStatus();
console.log(status.active); // true if user has active subscription
```

### Subscribe User

```typescript
import { subscribeToPlay } from '../lib/client/payments';

// Redirect to Stripe checkout for monthly subscription
await subscribeToPlay('MONTHLY');
```

### Cancel Subscription

```typescript
import { cancelSubscription } from '../lib/client/payments';

// Cancel the user's subscription at the end of the current billing period
await cancelSubscription();
```

## Subscription UI Component

The subscription UI component (`SubscriptionManager.tsx`) can be included on any page to display the user's subscription status and management options:

```tsx
import SubscriptionManager from '../components/subscription/SubscriptionManager';

export default function SubscriptionPage() {
  return (
    <div>
      <h1>Manage Your Subscription</h1>
      <SubscriptionManager />
    </div>
  );
}
```

## Webhook Setup

To handle Stripe webhooks, you need to:

1. Create a webhook in the Stripe dashboard pointing to your webhook endpoint (`/api/payments/webhook`)
2. Add the webhook secret to your environment variables (`STRIPE_WEBHOOK_SECRET`)
3. Configure the webhook to listen for the following events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

## Testing

For testing, use Stripe's test mode and test cards:

- **Test Card Success**: 4242 4242 4242 4242
- **Test Card Failure**: 4000 0000 0000 0002

See Stripe's documentation for more test cards and scenarios.

## Production Deployment

Before deploying to production:

1. Update environment variables with production Stripe keys
2. Update webhook endpoints in the Stripe dashboard
3. Test the complete payment flow in a staging environment

## Troubleshooting

### Common Issues

1. **Webhook Errors**: Ensure the webhook secret is correctly set and matches the one in the Stripe dashboard
2. **Missing Customer ID**: Make sure to create a customer before attempting to create a checkout session
3. **Invalid Price IDs**: Verify that the price IDs in your environment variables are correct and exist in your Stripe account

### Debugging

Use the Stripe Dashboard Events log to track webhook deliveries and responses.