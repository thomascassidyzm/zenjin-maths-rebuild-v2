# Testing Guidelines for Zenjin Maths

This document outlines our testing strategy and provides guidance on creating and running tests.

## Running Tests

### Unit Tests

To run all unit tests:
```bash
npm test
```

To run tests in watch mode (watches for file changes):
```bash
npm run test:watch
```

To run a specific test file:
```bash
npm test -- -t "record-session"
```

### Integration Tests

These tests are provided for when a development environment is set up. For now, we're using the Vercel deployment pipeline for testing.

```bash
# Future use: Run basic API endpoint tests
npm run test:api

# Future use: Run Triple Helix model integration tests
npm run test:helix

# Future use: Run tube position management tests
npm run test:tube

# Future use: Run all integration tests
npm run test:all
```

> **Note**: Integration tests require a local development server which is not currently part of our workflow. These scripts are included for future development phases.

## Test Structure

Tests are organized into these main categories:

1. **Unit Tests**:
   - **API Tests** (`__tests__/api/`): Unit tests for API endpoints
   - **Utility Tests** (`__tests__/utils/`): Tests for utility functions and helpers
   - **Component Tests** (`__tests__/components/`): Tests for React components 

2. **Integration Tests**:
   - **API Integration Tests** (`tests/api-tests.js`): End-to-end tests for API endpoints
   - **Triple Helix Tests** (`tests/triple-helix-tests.js`): Tests for the Triple Helix model flow
   - **Tube Position Tests** (`tests/tube-position-test.js`): Tests for tube position handling

## Writing Tests

### API Tests

When testing API endpoints:
- Mock the authentication context
- Mock database responses as needed
- Test error handling paths
- Verify the response format and status codes

Example:
```typescript
test('returns 405 for non-POST requests', async () => {
  req.method = 'GET';
  await handler(req as NextApiRequest, res as NextApiResponse);
  expect(res.status).toHaveBeenCalledWith(405);
});
```

### Utility Tests

For utility functions:
- Test edge cases (null/undefined values, etc.)
- Test typical use cases
- Verify output format

Example:
```typescript
test('calculates level 1 for new user with no points', () => {
  const level = calculateEvolutionLevel(0, 0, 1);
  expect(level).toBe(1);
});
```

### Component Tests

For React components:
- Test user interactions
- Test state changes
- Verify renders correctly with different props

## Mocking Strategy

We use Jest's mocking capabilities:

1. **API Mocks**: Use `jest.mock()` to mock API responses
2. **Database Mocks**: Mock Supabase client calls
3. **Component Mocks**: Use React Testing Library to mock component behavior

## Test Coverage

Run the coverage report to see test coverage:
```bash
npm test -- --coverage
```

## Continuous Integration

Tests run automatically on pull requests in the CI pipeline.

## Testing the Data Persistence Fixes

To test the data persistence fixes we've implemented in the Vercel deployment:

1. Push changes to GitHub using GitHub Desktop
2. Wait for Vercel to create the preview deployment
3. Test against the preview URL
4. Once verified, merge to main for production deployment

### Manual Testing Checklist

Additionally, manually verify these critical paths:

1. **Tube Position Storage**:
   - Complete a session in Tube 1
   - Verify the app rotates to Tube 2
   - Refresh the page and verify it remembers Tube 2 is active

2. **Session Recording**:
   - Complete a session and click "Finish"
   - Verify the session summary appears with correct points
   - Navigate to Dashboard and check points were accumulated

3. **Triple Helix Flow**:
   - Complete a full cycle of Tube 1 → Tube 2 → Tube 3 → Tube 1
   - Verify the app correctly rotates through tubes
   - Verify each tube preserves its active stitch between sessions

### Common Issues

If you encounter test failures, check:

1. Database table structure matches expected schema
2. API endpoints have correct error handling
3. Authorization is working properly
4. End-session flow is completed entirely

See `DATA-PERSISTENCE-FIX-SUMMARY.md` for details on all the fixes implemented.