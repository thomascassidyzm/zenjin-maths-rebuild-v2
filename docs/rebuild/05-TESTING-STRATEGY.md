# Testing Strategy

This document outlines the testing strategy for the Zenjin Maths API rebuild.

## Testing Objectives

1. **Verify Core Functionality**: Ensure all API endpoints work as expected
2. **Validate Error Handling**: Confirm errors are properly caught and reported
3. **Test Authentication Flow**: Verify the complete authentication lifecycle
4. **Ensure Data Persistence**: Validate that user data is properly saved
5. **Verify Offline Sync**: Test synchronization of offline data
6. **Validate Payment Flow**: Test the complete subscription process

## Testing Layers

### 1. Unit Tests

Unit tests focus on individual functions and utilities:

```typescript
// tests/unit/api-utils.test.ts
import { successResponse, errorResponse } from '../../lib/api/responses';

describe('API Response Utilities', () => {
  test('successResponse should format correctly', () => {
    const response = successResponse({ test: 'data' }, 'Test message');
    expect(response).toEqual({
      success: true,
      message: 'Test message',
      test: 'data'
    });
  });
  
  test('errorResponse should format correctly', () => {
    const response = errorResponse('Test error', { detail: 'info' });
    expect(response).toEqual({
      success: false,
      error: 'Test error',
      details: { detail: 'info' }
    });
  });
});
```

### 2. API Integration Tests

API integration tests validate the complete request/response cycle:

```typescript
// tests/integration/api/auth.test.ts
import { createServer } from 'http';
import { apiResolver } from 'next/dist/server/api-utils';
import fetchMock from 'fetch-mock';
import handler from '../../../pages/api/auth/magic-link';

describe('Magic Link API', () => {
  beforeAll(() => {
    // Mock Supabase responses
    fetchMock.post('https://ggwoupzaruiaaliylxga.supabase.co/auth/v1/otp', {
      status: 200,
      body: { success: true }
    });
  });
  
  afterAll(() => {
    fetchMock.restore();
  });
  
  test('should return 405 for non-POST requests', async () => {
    const req = { method: 'GET' };
    const res = {
      status: jest.fn(() => res),
      json: jest.fn()
    };
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Method not allowed'
    }));
  });
  
  test('should return 400 if email is missing', async () => {
    const req = { 
      method: 'POST',
      body: {}
    };
    const res = {
      status: jest.fn(() => res),
      json: jest.fn()
    };
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Email required'
    }));
  });
  
  test('should return 200 for successful magic link', async () => {
    const req = { 
      method: 'POST',
      body: { email: 'test@example.com' }
    };
    const res = {
      status: jest.fn(() => res),
      json: jest.fn()
    };
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true
    }));
  });
});
```

### 3. End-to-End Tests

End-to-end tests validate complete user flows:

```typescript
// tests/e2e/auth-flow.test.ts
import { chromium, Browser, Page } from 'playwright';

describe('Authentication Flow', () => {
  let browser: Browser;
  let page: Page;
  
  beforeAll(async () => {
    browser = await chromium.launch();
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  beforeEach(async () => {
    page = await browser.newPage();
  });
  
  afterEach(async () => {
    await page.close();
  });
  
  test('User can sign in with email verification', async () => {
    // Visit sign-in page
    await page.goto('http://localhost:3000/signin');
    
    // Fill email
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Click send verification code
    await page.click('button:has-text("Send Verification Code")');
    
    // Wait for verification code screen
    await page.waitForSelector('text=We\'ve sent a verification code');
    
    // Check if the email is displayed
    const emailText = await page.textContent('p');
    expect(emailText).toContain('test@example.com');
    
    // Mock verification code entry
    await page.fill('input[type="text"]', '123456');
    
    // Submit verification form
    await page.click('button:has-text("Verify Code")');
    
    // Expect to be redirected to dashboard
    await page.waitForURL('http://localhost:3000/dashboard');
    
    // Verify authentication state
    const isAuthenticated = await page.evaluate(() => {
      return localStorage.getItem('supabase.auth.token') !== null;
    });
    
    expect(isAuthenticated).toBe(true);
  });
  
  test('Anonymous user can transition to authenticated', async () => {
    // First use as anonymous
    await page.goto('http://localhost:3000/minimal-player');
    
    // Complete a session
    // ... interaction steps for completing a session
    
    // Sign up from prompt
    await page.click('text=Sign Up');
    
    // Fill email and verify
    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button:has-text("Send Verification Code")');
    await page.fill('input[type="text"]', '123456');
    await page.click('button:has-text("Verify Code")');
    
    // Check dashboard for data migration
    await page.goto('http://localhost:3000/dashboard');
    
    // Verify previous anonymous data was linked
    const pointsText = await page.textContent('text=Total Points');
    expect(parseInt(pointsText.replace(/\D/g, ''))).toBeGreaterThan(0);
  });
});
```

### 4. API Load Tests

API load tests verify performance under load:

```typescript
// tests/load/api-load.test.ts
import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function() {
  // Test dashboard API
  const dashboardRes = http.get('http://localhost:3000/api/dashboard', {
    headers: {
      Authorization: `Bearer ${__ENV.TEST_TOKEN}`,
    },
  });
  
  check(dashboardRes, {
    'dashboard status is 200': (r) => r.status === 200,
    'dashboard response time is acceptable': (r) => r.timings.duration < 1000,
  });
  
  sleep(1);
  
  // Test session recording API
  const sessionData = {
    threadId: 'test-thread',
    stitchId: 'test-stitch',
    totalQuestions: 10,
    correctAnswers: 8,
    totalPoints: 25
  };
  
  const sessionRes = http.post('http://localhost:3000/api/sessions/record', 
    JSON.stringify(sessionData),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${__ENV.TEST_TOKEN}`,
      },
    }
  );
  
  check(sessionRes, {
    'session record status is 200': (r) => r.status === 200,
    'session response time is acceptable': (r) => r.timings.duration < 1000,
  });
  
  sleep(1);
}
```

## Test Environment Setup

### 1. Test Database Setup

```typescript
// tests/setup/database.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.TEST_SUPABASE_URL;
const supabaseKey = process.env.TEST_SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Set up a clean test database
 */
export async function setupTestDatabase() {
  // Create test tables
  await createTestTables();
  
  // Create test users
  await createTestUsers();
  
  // Create test data
  await createTestData();
}

/**
 * Create required test tables
 */
async function createTestTables() {
  // Create profiles table
  await supabase.rpc('create_test_profiles_table');
  
  // Create session_results table
  await supabase.rpc('create_test_session_results_table');
  
  // Create user_stitch_progress table
  await supabase.rpc('create_test_stitch_progress_table');
}

/**
 * Create test users
 */
async function createTestUsers() {
  // Create test users
  await supabase.auth.admin.createUser({
    email: 'test@example.com',
    password: 'password123',
    email_confirm: true
  });
  
  // Create test profiles
  await supabase.from('profiles').insert({
    id: 'test-user-id',
    display_name: 'Test User',
    total_points: 100,
    avg_blink_speed: 2.3,
    evolution_level: 2
  });
}

/**
 * Create test data
 */
async function createTestData() {
  // Create test sessions
  await supabase.from('session_results').insert([
    {
      id: 'test-session-1',
      user_id: 'test-user-id',
      thread_id: 'thread-1',
      stitch_id: 'stitch-1',
      total_questions: 10,
      correct_answers: 8,
      total_points: 25,
      completed_at: new Date().toISOString()
    }
  ]);
  
  // Create test progress
  await supabase.from('user_stitch_progress').insert([
    {
      user_id: 'test-user-id',
      thread_id: 'thread-1',
      stitch_id: 'stitch-1',
      order_number: 1,
      skip_number: 5,
      distractor_level: 'L1'
    }
  ]);
}

/**
 * Clean up test database
 */
export async function cleanupTestDatabase() {
  // Delete test data
  await supabase.from('user_stitch_progress').delete().match({ user_id: 'test-user-id' });
  await supabase.from('session_results').delete().match({ user_id: 'test-user-id' });
  await supabase.from('profiles').delete().match({ id: 'test-user-id' });
  
  // Delete test user
  await supabase.auth.admin.deleteUser('test-user-id');
}
```

### 2. Test Utilities

```typescript
// tests/utils/mock-request.ts
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Create a mock Next.js API request
 */
export function createMockRequest(options): NextApiRequest {
  const {
    method = 'GET',
    body = {},
    query = {},
    headers = {},
    cookies = {}
  } = options;
  
  return {
    method,
    body,
    query,
    headers,
    cookies
  } as NextApiRequest;
}

/**
 * Create a mock Next.js API response
 */
export function createMockResponse(): NextApiResponse {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    send: jest.fn(() => res),
    setHeader: jest.fn(() => res),
    headers: {},
    getHeader: jest.fn((name) => res.headers[name]),
    statusCode: 200,
    _status: 200,
    _json: null
  };
  
  res.status = jest.fn(function(statusCode) {
    this._status = statusCode;
    return this;
  });
  
  res.json = jest.fn(function(jsonBody) {
    this._json = jsonBody;
    return this;
  });
  
  return res as unknown as NextApiResponse;
}
```

## Test Execution

### 1. Test Scripts

Add the following scripts to package.json:

```json
"scripts": {
  "test": "jest",
  "test:unit": "jest --testPathPattern=tests/unit",
  "test:integration": "jest --testPathPattern=tests/integration",
  "test:e2e": "playwright test tests/e2e",
  "test:api": "ts-node tests/api-test-runner.ts",
  "test:load": "k6 run tests/load/api-load.test.ts"
}
```

### 2. GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm run test:unit
  
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Setup test database
        run: npm run setup:test-db
        env:
          TEST_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          TEST_SUPABASE_SERVICE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_KEY }}
      - name: Run integration tests
        run: npm run test:integration
        env:
          TEST_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          TEST_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
  
  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Build app
        run: npm run build
      - name: Start app
        run: npm run start & npx wait-on http://localhost:3000
      - name: Run E2E tests
        run: npm run test:e2e
```

## Test Coverage

Add coverage reporting to jest.config.js:

```javascript
module.exports = {
  // ... other config
  collectCoverage: true,
  collectCoverageFrom: [
    'lib/**/*.{js,jsx,ts,tsx}',
    'pages/api/**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/.next/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

## Error Scenario Testing

Specifically test error scenarios to ensure proper handling:

```typescript
// tests/error-scenarios.test.ts
import handler from '../../pages/api/sessions/record';
import { createMockRequest, createMockResponse } from '../utils/mock-request';

describe('Error Scenarios', () => {
  test('Should handle database connection errors', async () => {
    // Mock request with valid data
    const req = createMockRequest({
      method: 'POST',
      body: {
        threadId: 'test-thread',
        stitchId: 'test-stitch',
        totalQuestions: 10,
        correctAnswers: 8,
        totalPoints: 25
      }
    });
    
    const res = createMockResponse();
    
    // Mock Supabase to throw connection error
    jest.mock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => {
          throw new Error('Database connection lost');
        },
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: 'test-user' } } }
          })
        }
      })
    }));
    
    // Call API handler
    await handler(req, res);
    
    // Verify error response
    expect(res._status).toBe(500);
    expect(res._json).toEqual(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Failed to record session')
    }));
  });
  
  test('Should handle authentication errors', async () => {
    // Mock request with valid data
    const req = createMockRequest({
      method: 'POST',
      body: {
        threadId: 'test-thread',
        stitchId: 'test-stitch'
      }
    });
    
    const res = createMockResponse();
    
    // Mock Supabase to return no session
    jest.mock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null }
          })
        }
      })
    }));
    
    // Call API handler
    await handler(req, res);
    
    // Verify error response
    expect(res._status).toBe(401);
    expect(res._json).toEqual(expect.objectContaining({
      success: false,
      error: 'Authentication required'
    }));
  });
});
```

## Payment Flow Testing

For payment testing, use Stripe's test mode and webhook events:

```typescript
// tests/integration/payment-flow.test.ts
import handler from '../../../pages/api/payments/webhook';
import { createMockRequest, createMockResponse } from '../../utils/mock-request';
import { stripe } from '../../../lib/stripe';

// Mock webhook signature verification
jest.mock('stripe', () => {
  return {
    Stripe: jest.fn().mockImplementation(() => ({
      webhooks: {
        constructEvent: jest.fn().mockImplementation(() => ({
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: { userId: 'test-user-id' },
              customer: 'cus_test123',
              subscription: 'sub_test123'
            }
          }
        }))
      }
    }))
  };
});

describe('Payment Webhook Handler', () => {
  test('Should handle checkout.session.completed event', async () => {
    // Mock request
    const req = createMockRequest({
      method: 'POST',
      headers: {
        'stripe-signature': 'test-signature'
      }
    });
    
    const res = createMockResponse();
    
    // Mock Supabase updates
    const mockUpdate = jest.fn().mockResolvedValue({ error: null });
    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    
    jest.mock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: (table) => ({
          update: mockUpdate,
          insert: mockInsert,
          eq: () => ({ update: mockUpdate, insert: mockInsert })
        })
      })
    }));
    
    // Call webhook handler
    await handler(req, res);
    
    // Verify response
    expect(res._status).toBe(200);
    expect(res._json).toEqual({ received: true });
    
    // Verify Supabase updates
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      is_subscribed: true,
      subscription_id: 'sub_test123',
      subscription_status: 'active'
    }));
    
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'test-user-id',
      event_type: 'subscription_created',
      subscription_id: 'sub_test123',
      customer_id: 'cus_test123'
    }));
  });
});
```

## Automated Testing Tools

The testing infrastructure uses the following tools:

1. **Jest**: Unit and integration testing
2. **Playwright**: End-to-end testing
3. **k6**: Load and performance testing
4. **Supertest**: API testing
5. **Stripe Testing API**: Payment flow testing

## Debugging Failed Tests

For debugging failed tests, use detailed logging:

```typescript
// tests/utils/debug.ts
/**
 * Enhanced logging for test debugging
 */
export function debugLog(message, data = {}) {
  if (process.env.DEBUG_TESTS) {
    console.log(`[TEST DEBUG] ${message}`, JSON.stringify(data, null, 2));
  }
}

/**
 * Capture API responses for debugging
 */
export function captureResponse(res) {
  if (process.env.DEBUG_TESTS) {
    const { statusCode, _json } = res;
    console.log(`[TEST RESPONSE] Status: ${statusCode}`, JSON.stringify(_json, null, 2));
  }
  return res;
}
```

Usage in tests:

```typescript
test('should record session correctly', async () => {
  debugLog('Starting session record test', { threadId: 'test-thread' });
  
  // Test implementation
  
  captureResponse(res);
  expect(res._status).toBe(200);
});
```