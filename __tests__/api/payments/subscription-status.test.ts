import { createMocks } from 'node-mocks-http';
import subscriptionStatusHandler from '../../../pages/api/payments/subscription-status';
import { stripe } from '../../../lib/stripe';
import { createAuthHandler } from '../../../lib/api/handlers';
import { logError } from '../../../lib/api/logging';

// Mock dependencies
jest.mock('../../../lib/stripe', () => ({
  stripe: {
    subscriptions: {
      retrieve: jest.fn()
    }
  }
}));

jest.mock('../../../lib/api/handlers', () => ({
  createAuthHandler: jest.fn((handler) => handler)
}));

jest.mock('../../../lib/api/logging', () => ({
  logError: jest.fn()
}));

describe('/api/payments/subscription-status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns status when user has an active subscription', async () => {
    // Mock DB responses
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          subscription_id: 'sub_123',
          subscription_status: 'active',
          has_subscription: true,
          stripe_customer_id: 'cus_123',
          subscription_updated_at: '2023-01-01T00:00:00.000Z'
        },
        error: null
      })
    };

    // Mock Stripe subscription retrieval
    const mockSubscription = {
      id: 'sub_123',
      status: 'active',
      current_period_end: 1672531200, // 2023-01-01
      cancel_at_period_end: false,
      items: {
        data: [
          {
            price: {
              id: 'price_123',
              nickname: 'Monthly Plan',
              recurring: { interval: 'month' },
              unit_amount: 999,
              currency: 'usd'
            }
          }
        ]
      }
    };
    (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValueOnce(mockSubscription);
    
    const { req, res } = createMocks({
      method: 'GET'
    });

    await subscriptionStatusHandler(req, res, 'user123', mockDb);

    // Check if user was retrieved
    expect(mockDb.from).toHaveBeenCalledWith('profiles');
    expect(mockDb.select).toHaveBeenCalledWith('subscription_id, subscription_status, has_subscription, stripe_customer_id, subscription_updated_at');
    expect(mockDb.eq).toHaveBeenCalledWith('id', 'user123');
    
    // Check if Stripe subscription was retrieved
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
    
    // Check response
    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData()).data;
    expect(responseData).toEqual({
      active: true,
      status: 'active',
      subscription: {
        id: 'sub_123',
        status: 'active',
        currentPeriodEnd: '2023-01-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
        plan: {
          id: 'price_123',
          nickname: 'Monthly Plan',
          interval: 'month',
          amount: 999,
          currency: 'usd'
        }
      },
      updatedAt: '2023-01-01T00:00:00.000Z'
    });
  });

  it('returns inactive status when user has no subscription', async () => {
    // Mock DB responses
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          subscription_id: null,
          subscription_status: 'none',
          has_subscription: false,
          stripe_customer_id: 'cus_123',
          subscription_updated_at: null
        },
        error: null
      })
    };
    
    const { req, res } = createMocks({
      method: 'GET'
    });

    await subscriptionStatusHandler(req, res, 'user123', mockDb);

    // Check if user was retrieved
    expect(mockDb.from).toHaveBeenCalledWith('profiles');
    expect(mockDb.select).toHaveBeenCalledWith('subscription_id, subscription_status, has_subscription, stripe_customer_id, subscription_updated_at');
    expect(mockDb.eq).toHaveBeenCalledWith('id', 'user123');
    
    // Check that Stripe subscription was NOT retrieved
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    
    // Check response
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      data: {
        active: false,
        status: 'none',
        subscription: null,
        updatedAt: null
      }
    });
  });

  it('returns local data when Stripe API fails', async () => {
    // Mock DB responses
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          subscription_id: 'sub_123',
          subscription_status: 'active',
          has_subscription: true,
          stripe_customer_id: 'cus_123',
          subscription_updated_at: '2023-01-01T00:00:00.000Z'
        },
        error: null
      })
    };

    // Mock Stripe API error
    (stripe.subscriptions.retrieve as jest.Mock).mockRejectedValueOnce(new Error('Stripe API error'));
    
    const { req, res } = createMocks({
      method: 'GET'
    });

    await subscriptionStatusHandler(req, res, 'user123', mockDb);
    
    // Check error logging
    expect(logError).toHaveBeenCalledWith('Payments/SubscriptionStatus', 'Failed to retrieve subscription from Stripe', expect.any(Object));
    
    // Check response - should include local data with a warning
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      data: {
        active: true,
        status: 'active',
        subscription: {
          id: 'sub_123',
          warning: 'Could not retrieve latest details from Stripe'
        },
        updatedAt: '2023-01-01T00:00:00.000Z'
      }
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
      method: 'GET'
    });

    await subscriptionStatusHandler(req, res, 'user123', mockDb);

    // Check error logging
    expect(logError).toHaveBeenCalledWith('Payments/SubscriptionStatus', 'Failed to retrieve user profile', expect.any(Object));
    
    // Check response
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Failed to retrieve user profile'
    });
  });

  it('handles unexpected errors', async () => {
    // Mock DB to throw an unexpected error
    const mockDb = {
      from: jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      })
    };

    const { req, res } = createMocks({
      method: 'GET'
    });

    await subscriptionStatusHandler(req, res, 'user123', mockDb);
    
    // Check error logging
    expect(logError).toHaveBeenCalledWith('Payments/SubscriptionStatus', 'Failed to retrieve subscription status', expect.any(Object));
    
    // Check response
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Failed to retrieve subscription status'
    });
  });
});