# Stripe Testing Guide

This guide explains how to thoroughly test the Stripe subscription integration for the Zenjin Maths application.

## Setting Up Stripe Test Environment

### 1. Use Stripe Test Mode

Ensure that you're using Stripe's test mode for all development and testing. In test mode:
- No real charges are made
- Test credit cards can be used
- Webhooks can be tested locally

Log into your Stripe Dashboard and make sure you're in "Test Mode" (look for the "Test Mode" label in the dashboard).

### 2. Configure Test API Keys

Use Stripe's test API keys in your environment:

```env
# .env.local
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Create Test Products and Prices

In the Stripe Dashboard:
1. Go to Products > + Add Product
2. Create a "Monthly Subscription" product
   - Name: "Zenjin Maths Monthly"
   - Price: $9.99 per month recurring
   - Copy the `price_id` after creation
3. Create an "Annual Subscription" product
   - Name: "Zenjin Maths Annual"
   - Price: $99.99 per year recurring
   - Copy the `price_id` after creation
4. Add these price IDs to your environment variables:

```env
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...
```

## Setting Up Webhook Testing

### 1. Install Stripe CLI

The Stripe CLI allows you to forward webhook events to your local development server:

```bash
# macOS with Homebrew
brew install stripe/stripe-cli/stripe

# Windows with Scoop
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Login to your Stripe account
stripe login
```

### 2. Forward Webhooks to Your Local Server

```bash
# Start your Next.js app
npm run dev

# In a separate terminal, forward webhooks
stripe listen --forward-to localhost:3000/api/payments/webhook
```

The CLI will display a webhook signing secret. Add this to your `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Test Cards

Use these test card numbers for different scenarios:

| Card Number         | Scenario                 |
|---------------------|--------------------------|
| 4242 4242 4242 4242 | Successful payment       |
| 4000 0000 0000 0341 | Failed payment           |
| 4000 0027 6000 3184 | Requires authentication  |
| 4000 0000 0000 9995 | Insufficient funds       |

For all test cards, use:
- Any future expiration date (e.g., 12/34)
- Any 3-digit CVC code (e.g., 123)
- Any postal code (e.g., 12345)

## Testing Scenarios

### 1. Basic Subscription Flow Test

1. **Free Tier Access:**
   - Create a new account or use an existing one without subscription
   - Verify only the first 10 stitches in each tube are accessible
   - Verify you see teasers for premium content

2. **Subscription Purchase:**
   - Click "Subscribe" on the paywall or subscription page
   - Select the monthly plan
   - Complete checkout with card number 4242 4242 4242 4242
   - Verify you're redirected to the success page
   - Verify you now have access to all content

3. **Subscription Cancellation:**
   - Go to the subscription management page
   - Click "Cancel Subscription"
   - Confirm cancellation
   - Verify your subscription is marked for cancellation but still active
   - Verify you still have access to premium content

### 2. Testing Error Handling

1. **Failed Payment:**
   - Try subscribing with card number 4000 0000 0000 0341
   - Verify appropriate error message is shown
   - Verify user remains on free tier

2. **Authentication Required:**
   - Try subscribing with card number 4000 0027 6000 3184
   - Complete the 3D Secure authentication
   - Verify successful subscription after authentication

3. **Insufficient Funds:**
   - Try subscribing with card number 4000 0000 0000 9995
   - Verify appropriate error message is shown
   - Verify user remains on free tier

### 3. Testing Webhook Events

Use the Stripe CLI to trigger webhook events:

```bash
# Simulate a successful subscription creation
stripe trigger customer.subscription.created

# Simulate a subscription update
stripe trigger customer.subscription.updated

# Simulate a subscription cancellation
stripe trigger customer.subscription.deleted

# Simulate a payment failure
stripe trigger invoice.payment_failed
```

After each event:
1. Check your application logs for webhook processing
2. Verify the database has been updated correctly
3. Verify the UI reflects the correct subscription status

### 4. Testing Subscription Lifecycle

1. **Initial Subscription:**
   - Subscribe with a test card
   - Verify subscription is active

2. **Simulate Renewal:**
   ```bash
   # Get the subscription ID from your database
   stripe subscriptions update sub_xxx --cancel-at-period-end=false
   
   # Trigger a successful invoice payment
   stripe trigger invoice.payment_succeeded
   ```
   - Verify subscription remains active

3. **Simulate Failed Renewal:**
   ```bash
   # Trigger a failed invoice payment
   stripe trigger invoice.payment_failed
   ```
   - Verify subscription is marked as past_due
   - Check that user is notified of payment issue

4. **Simulate Payment Recovery:**
   ```bash
   # Trigger a successful invoice payment after failure
   stripe trigger invoice.payment_succeeded
   ```
   - Verify subscription is marked as active again

### 5. Testing Free Tier Limitations

1. **Content Access by Position:**
   - Verify access is granted to stitches with position < 10
   - Verify access is denied for stitches with position >= 10
   - Check edge cases like position = 9, 10, 11

2. **Teaser Content:**
   - Verify premium stitches show appropriate teaser content
   - Check that paywall appears when attempting to interact fully

3. **Admin Override:**
   - Test with an admin user account
   - Verify all content is accessible regardless of position

## Automated Testing

### 1. Unit Tests for Access Control

Create tests for the `freeTierAccess.ts` module:

```tsx
// __tests__/lib/freeTierAccess.test.ts
import { 
  canAccessStitch, 
  hasActiveSubscription,
  getFreeTierPositionLimit
} from '../../lib/freeTierAccess';

describe('Free Tier Access Control', () => {
  // Mock subscription status
  const activeSubscription = {
    active: true,
    status: 'active',
    subscription: { id: 'sub_123' }
  };
  
  const freeUser = {
    active: false,
    status: 'none',
    subscription: null
  };
  
  const adminUser = {
    active: false,
    status: 'admin',
    subscription: null
  };
  
  test('canAccessStitch grants access to paid users', () => {
    const result = canAccessStitch('stitch-1', 15, activeSubscription);
    expect(result.hasAccess).toBe(true);
    expect(result.accessLevel).toBe('paid');
  });
  
  test('canAccessStitch limits free users to first 10 stitches', () => {
    // Position 9 (within free tier)
    const freeResult = canAccessStitch('stitch-1', 9, freeUser);
    expect(freeResult.hasAccess).toBe(true);
    expect(freeResult.accessLevel).toBe('free');
    
    // Position 10 (outside free tier)
    const paidResult = canAccessStitch('stitch-1', 10, freeUser);
    expect(paidResult.hasAccess).toBe(false);
    expect(paidResult.accessLevel).toBe('free');
  });
  
  test('canAccessStitch allows admin access to all content', () => {
    const result = canAccessStitch('stitch-1', 50, adminUser);
    expect(result.hasAccess).toBe(true);
    expect(result.accessLevel).toBe('admin');
  });
  
  // More tests...
});
```

### 2. Integration Tests for API Endpoints

Test the API endpoints that enforce access control:

```tsx
// __tests__/api/user-stitches.test.ts
import { createMocks } from 'node-mocks-http';
import userStitchesHandler from '../../pages/api/user-stitches';

// Mock database client
jest.mock('../../lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { /* mock data */ },
      error: null
    })
  }))
}));

describe('User Stitches API', () => {
  test('returns limited content for free users', async () => {
    // Setup mock request/response
    const { req, res } = createMocks({
      method: 'GET',
      query: {},
    });
    
    // Mock authentication context
    req.user = { id: 'test-user' };
    req.isAuthenticated = true;
    
    // Mock profile data with no subscription
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { has_subscription: false },
        error: null
      })
    };
    
    // Call the handler
    await userStitchesHandler(req, res, { db: mockDb });
    
    // Assert limited content
    expect(res._getStatusCode()).toBe(200);
    
    const responseData = JSON.parse(res._getData());
    expect(responseData.data.isFreeTier).toBe(true);
    
    // Check that content filtering is applied
    // More assertions...
  });
  
  // More tests...
});
```

## E2E Testing with Cypress

Create end-to-end tests for the complete subscription flow:

```js
// cypress/integration/subscription.spec.js
describe('Subscription Flow', () => {
  before(() => {
    // Log in as a test user
    cy.login('test@example.com', 'password');
  });
  
  it('shows paywall for premium content', () => {
    // Navigate to a premium stitch (beyond position 10)
    cy.visit('/player?tube=1&stitch=11');
    
    // Check that paywall is displayed
    cy.get('.premium-content-paywall').should('be.visible');
    cy.contains('Upgrade to Unlock').should('be.visible');
  });
  
  it('allows subscription purchase', () => {
    // Visit subscription page
    cy.visit('/subscription');
    
    // Select monthly plan and click subscribe
    cy.contains('Subscribe Monthly').click();
    
    // Fill in test card details in Stripe checkout
    cy.get('#cardNumber').type('4242424242424242');
    cy.get('#cardExpiry').type('1234');
    cy.get('#cardCvc').type('123');
    cy.get('#billingName').type('Test User');
    cy.get('#billingPostalCode').type('12345');
    
    // Submit payment
    cy.contains('Subscribe').click();
    
    // Verify redirect to success page
    cy.url().should('include', 'success=true');
    cy.contains('Thank you for subscribing!').should('be.visible');
  });
  
  it('grants access to premium content after subscription', () => {
    // Navigate to a premium stitch
    cy.visit('/player?tube=1&stitch=11');
    
    // Verify content is accessible (no paywall)
    cy.get('.premium-content-paywall').should('not.exist');
    cy.get('.stitch-content').should('be.visible');
  });
});
```

## Common Testing Issues and Solutions

### 1. Webhook Failures

**Issue**: Webhooks aren't being processed correctly.

**Solution**:
- Verify webhook URL is correct in Stripe Dashboard
- Check that webhook secret matches the one in your environment
- Look for error messages in your server logs
- Use `stripe listen` to debug locally

### 2. Cached Subscription Status

**Issue**: UI doesn't update after subscription changes.

**Solution**:
- Implement manual refresh button for subscription status
- Clear localStorage cache when subscription status changes
- Add proper cache invalidation in subscription hooks

### 3. Test Mode vs. Live Mode Confusion

**Issue**: Test data appearing in live environment.

**Solution**:
- Use different API keys and environments for test and production
- Add visual indicators in the UI for test mode
- Set up separate database tables/schemas for test data

## Monitoring and Debugging

### 1. Webhook Logs

Monitor webhook events in the Stripe Dashboard:
1. Go to Developers > Webhooks
2. Click on your webhook endpoint
3. View recent webhook events and their status

### 2. Payment Logs

Track payment attempts and failures:
1. Go to Payments > All Payments
2. Filter by status (succeeded, failed, etc.)
3. Click on individual payments to see details

### 3. Subscription Logs

Monitor subscription lifecycle events:
1. Go to Billing > Subscriptions
2. View active, past due, and canceled subscriptions
3. Click on individual subscriptions to see billing history

## Moving to Production

When ready to move to production:

1. Switch to live Stripe API keys
2. Set up proper webhook endpoints for production
3. Configure real products and prices in the Stripe Dashboard
4. Implement proper error handling and recovery
5. Set up monitoring and alerts for payment failures
6. Test the complete flow in a staging environment

Remember that in production mode, real credit cards and real charges will be processed!