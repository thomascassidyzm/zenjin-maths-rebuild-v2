# Payment Integration Testing

This document outlines the testing approach for the Stripe payment integration in the Zenjin Maths application.

## Testing Overview

The payment integration tests cover:

1. **Utility Functions**:
   - Currency formatting
   - Client-side payment utilities

2. **API Endpoints**:
   - Customer creation
   - Checkout session creation
   - Subscription status retrieval
   - Subscription cancellation

3. **UI Components**:
   - Subscription manager component
   - Subscription display states

## Running the Tests

To run all payment-related tests:

```bash
npm run test:payments
```

This will run all tests that match the pattern `__tests__/(lib|api|components)/.*payments.*`

To run a specific test file:

```bash
npx jest __tests__/api/payments/create-customer.test.ts
```

## Test Files Structure

```
__tests__/
├── api/
│   └── payments/
│       ├── cancel-subscription.test.ts
│       ├── create-checkout.test.ts
│       ├── create-customer.test.ts
│       └── subscription-status.test.ts
├── components/
│   └── subscription/
│       └── SubscriptionManager.test.tsx
└── lib/
    ├── client/
    │   └── payments.test.ts
    └── stripe.test.ts
```

## Testing Approach

### API Tests

The API tests use `node-mocks-http` to mock the request and response objects for Next.js API routes. Key aspects of the testing approach include:

- Mocking Stripe API calls to avoid actual Stripe requests
- Testing both successful and error paths
- Verifying correct error handling and logging
- Checking database interactions

### Client Utility Tests

The client utility tests focus on:

- Verifying correct API calls are made with the right parameters
- Testing error handling for failed requests
- Validating the processing of API responses

### Component Tests

The component tests use React Testing Library to:

- Verify correct rendering of different subscription states
- Test user interactions (subscribing, canceling, etc.)
- Validate loading and error states
- Ensure proper integration with the client utilities

## Mocked Dependencies

These tests use Jest to mock several dependencies:

- **Stripe**: All Stripe API calls are mocked to avoid actual API requests
- **Supabase**: Database interactions are mocked
- **Fetch API**: Network requests are mocked to test client utilities
- **Browser APIs**: `window.location` and other browser APIs are mocked as needed

## Manual Testing

While unit tests cover most functionality, some aspects require manual testing:

1. **Stripe Webhooks**: Test with Stripe's webhook testing tools
2. **Checkout Flow**: Verify the full checkout flow in test mode
3. **User Experience**: Verify the UI behaves correctly in different states
4. **Error Handling**: Test recovery from system failures

## Testing Best Practices

1. Keep tests focused on a single unit of functionality
2. Mock external dependencies to maintain test isolation
3. Test both successful and error paths
4. Ensure complete coverage of edge cases
5. Use descriptive test names that serve as documentation

## Common Testing Issues

- **Webhook Testing**: Use Stripe's webhook testing tools or mock the webhook events
- **Stripe API Changes**: Keep mocks up to date with Stripe API changes
- **Environment Variables**: Ensure tests don't depend on actual environment variables