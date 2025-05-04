# Testing Stripe Integration Locally

This guide explains how to set up and test the Stripe subscription system in a local development environment.

## Prerequisites

1. [Stripe account](https://dashboard.stripe.com/register) (free to create)
2. [Stripe CLI](https://stripe.com/docs/stripe-cli) (optional, for webhook testing)

## Setup Steps

### 1. Get Stripe API Keys

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Ensure you're in **Test Mode** (toggle in the top-right corner)
3. Find or create your API keys:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

### 2. Create Subscription Products and Prices

1. Go to [Products](https://dashboard.stripe.com/test/products) in your Stripe Dashboard
2. Click **Add Product**
3. Set up a product for "Zenjin Maths Premium":
   - **Name**: Zenjin Maths Premium
   - **Description**: Full access to all Zenjin Maths content
   - Under **Pricing**:
     - Create a monthly price of £12 (recurring)
     - Create an annual price of £120 (recurring) if using the annual option
4. Save the product
5. Note the **Price IDs** (starting with `price_`) for both the monthly and annual prices

### 3. Configure Environment Variables

1. Open `.env.local` in the project root
2. Update with your Stripe test API keys:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_PRICE_MONTHLY=price_...
   STRIPE_PRICE_ANNUAL=price_...
   ```

### 4. Testing Webhooks Locally (Optional)

For full subscription lifecycle testing (like successful payment confirmation), you'll need to set up webhook forwarding:

1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli#install)
2. Log in to your Stripe account via CLI:
   ```
   stripe login
   ```
3. Start webhook forwarding:
   ```
   stripe listen --forward-to http://localhost:3000/api/payments/webhook
   ```
4. The CLI will output a webhook signing secret. Copy this and add it to `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## Testing Subscription Flow

### 1. Test Cards

Stripe provides test cards for various scenarios:

- **Successful payment**: `4242 4242 4242 4242`
- **Payment requires authentication**: `4000 0025 0000 3155`
- **Payment declined**: `4000 0000 0000 9995`

For all test cards:
- Use any future expiration date
- Use any 3-digit CVC
- Use any name and postal code

### 2. Testing Process

1. Run your application locally:
   ```
   npm run dev
   ```

2. Create a test user account or sign in to an existing one

3. Navigate to `/subscribe` or click an upgrade button

4. When the Stripe Checkout opens:
   - Use a test card number
   - Complete the checkout process

5. If webhooks are set up, you should be redirected back to the success page

6. Verify subscription status in:
   - Your app's user dashboard
   - The [Stripe Dashboard](https://dashboard.stripe.com/test/subscriptions)

### 3. Testing Subscription Management

1. **Cancel a subscription**:
   - In your app: Use the subscription management interface
   - In Stripe: Go to Customers → Select the customer → Cancel subscription

2. **Update a subscription**:
   - In your app: If you have plan switching functionality
   - In Stripe: Edit the subscription directly to test different scenarios

## Troubleshooting

### Common Issues

1. **Authentication Required Errors** (401):
   - Check that your API keys are correctly set in `.env.local`
   - Verify that the environment variables are being loaded correctly
   - Make sure your app is restarted after changing environment variables

2. **Webhook Events Not Processing**:
   - Check that your webhook secret is correct
   - Verify that the Stripe CLI is running and forwarding events
   - Check server logs for any errors in webhook handlers

3. **Checkout Session Creation Fails**:
   - Verify that the price IDs exist in your Stripe account
   - Check for any validation errors in the checkout session parameters

### Viewing Logs

1. Monitor your application logs during testing
2. Check the Stripe dashboard events log at: https://dashboard.stripe.com/test/events
3. If using the Stripe CLI, watch the forwarded events in the terminal

## Additional Resources

- [Stripe Testing Documentation](https://stripe.com/docs/testing)
- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Subscriptions Documentation](https://stripe.com/docs/billing/subscriptions/overview)