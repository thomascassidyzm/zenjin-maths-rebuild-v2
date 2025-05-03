import { createMocks } from 'node-mocks-http';
import createCheckoutHandler from '../../../pages/api/payments/create-checkout';
import { stripe, SUBSCRIPTION_PRICES } from '../../../lib/stripe';
import { createAuthHandler } from '../../../lib/api/handlers';
import { logError } from '../../../lib/api/logging';

// Mock dependencies
jest.mock('../../../lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: jest.fn()
      }
    }
  },
  SUBSCRIPTION_PRICES: {
    MONTHLY: 'price_monthly_123',
    ANNUAL: 'price_annual_456',
    LIFETIME: 'price_lifetime_789'
  }
}));

jest.mock('../../../lib/api/handlers', () => ({
  createAuthHandler: jest.fn((handler) => handler)
}));

jest.mock('../../../lib/api/logging', () => ({
  logError: jest.fn()
}));

describe('/api/payments/create-checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a checkout session with valid parameters', async () => {
    // Mock DB responses
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          stripe_customer_id: 'cus_123456'
        },
        error: null
      })
    };

    // Mock Stripe checkout session creation
    const mockSession = {
      id: 'cs_123456',
      url: 'https://checkout.stripe.com/pay/cs_123456'
    };
    (stripe.checkout.sessions.create as jest.Mock).mockResolvedValueOnce(mockSession);
    
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        priceId: SUBSCRIPTION_PRICES.MONTHLY,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      }
    });

    await createCheckoutHandler(req, res, 'user123', mockDb);

    // Check if user was retrieved
    expect(mockDb.from).toHaveBeenCalledWith('profiles');
    expect(mockDb.select).toHaveBeenCalledWith('stripe_customer_id');
    expect(mockDb.eq).toHaveBeenCalledWith('id', 'user123');
    
    // Check if Stripe checkout session was created
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_123456',
      payment_method_types: ['card'],
      line_items: [
        {
          price: SUBSCRIPTION_PRICES.MONTHLY,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      metadata: {
        userId: 'user123',
      },
    });
    
    // Check response
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      data: {
        sessionId: 'cs_123456',
        url: 'https://checkout.stripe.com/pay/cs_123456'
      }
    });
  });

  it('returns error when required parameters are missing', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        // Missing priceId
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      }
    });

    await createCheckoutHandler(req, res, 'user123', {});
    
    // Check response
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Missing required fields: priceId, successUrl, or cancelUrl'
    });
  });

  it('returns error when price ID is invalid', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        priceId: 'invalid_price_id',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      }
    });

    await createCheckoutHandler(req, res, 'user123', {});
    
    // Check response
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Invalid price ID'
    });
  });

  it('returns error when user does not have a Stripe customer ID', async () => {
    // Mock DB responses
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          stripe_customer_id: null
        },
        error: null
      })
    };
    
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        priceId: SUBSCRIPTION_PRICES.MONTHLY,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      }
    });

    await createCheckoutHandler(req, res, 'user123', mockDb);
    
    // Check response
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'User does not have a Stripe customer ID. Please create a customer first.'
    });
  });

  it('handles errors when retrieving user profile', async () => {
    // Mock DB responses
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error')
      })
    };

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        priceId: SUBSCRIPTION_PRICES.MONTHLY,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      }
    });

    await createCheckoutHandler(req, res, 'user123', mockDb);

    // Check error logging
    expect(logError).toHaveBeenCalledWith('Payments/CreateCheckout', 'Failed to retrieve user profile', expect.any(Object));
    
    // Check response
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Failed to retrieve user profile'
    });
  });

  it('handles Stripe API errors', async () => {
    // Mock DB responses
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          stripe_customer_id: 'cus_123456'
        },
        error: null
      })
    };

    // Mock Stripe checkout session creation error
    (stripe.checkout.sessions.create as jest.Mock).mockRejectedValueOnce(new Error('Stripe API error'));

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        priceId: SUBSCRIPTION_PRICES.MONTHLY,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      }
    });

    await createCheckoutHandler(req, res, 'user123', mockDb);
    
    // Check error logging
    expect(logError).toHaveBeenCalledWith('Payments/CreateCheckout', 'Failed to create checkout session', expect.any(Object));
    
    // Check response
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Failed to create checkout session'
    });
  });
});