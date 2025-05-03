import { createMocks } from 'node-mocks-http';
import cancelSubscriptionHandler from '../../../pages/api/payments/cancel-subscription';
import { stripe } from '../../../lib/stripe';
import { createAuthHandler } from '../../../lib/api/handlers';
import { logError, logInfo } from '../../../lib/api/logging';

// Mock dependencies
jest.mock('../../../lib/stripe', () => ({
  stripe: {
    subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn()
    }
  }
}));

jest.mock('../../../lib/api/handlers', () => ({
  createAuthHandler: jest.fn((handler) => handler)
}));

jest.mock('../../../lib/api/logging', () => ({
  logError: jest.fn(),
  logInfo: jest.fn()
}));

describe('/api/payments/cancel-subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancels subscription at period end', async () => {
    // Mock DB responses
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          subscription_id: 'sub_123',
          subscription_status: 'active'
        },
        error: null
      }),
      update: jest.fn().mockReturnThis()
    };

    // Mock Stripe subscription retrieval
    const mockSubscription = {
      id: 'sub_123',
      cancel_at_period_end: false,
      current_period_end: 1672531200 // 2023-01-01
    };
    (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValueOnce(mockSubscription);
    
    // Mock Stripe subscription update
    const mockUpdatedSubscription = {
      id: 'sub_123',
      cancel_at_period_end: true,
      current_period_end: 1672531200 // 2023-01-01
    };
    (stripe.subscriptions.update as jest.Mock).mockResolvedValueOnce(mockUpdatedSubscription);

    // Mock DB update
    mockDb.update.mockImplementationOnce(() => ({
      eq: jest.fn().mockResolvedValue({
        error: null
      })
    }));
    
    const { req, res } = createMocks({
      method: 'POST'
    });

    await cancelSubscriptionHandler(req, res, 'user123', mockDb);

    // Check if user was retrieved
    expect(mockDb.from).toHaveBeenCalledWith('profiles');
    expect(mockDb.select).toHaveBeenCalledWith('subscription_id, subscription_status');
    expect(mockDb.eq).toHaveBeenCalledWith('id', 'user123');
    
    // Check if Stripe subscription was retrieved
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
    
    // Check if Stripe subscription was updated
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
      cancel_at_period_end: true
    });
    
    // Check if DB was updated
    expect(mockDb.update).toHaveBeenCalledWith({
      subscription_status: 'active_until_period_end',
      subscription_updated_at: expect.any(String)
    });
    
    // Check response
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      data: {
        message: 'Subscription will be canceled at the end of the current billing period',
        subscription: {
          id: 'sub_123',
          currentPeriodEnd: '2023-01-01T00:00:00.000Z',
          cancelAtPeriodEnd: true
        }
      }
    });
  });

  it('returns early if subscription is already set to cancel', async () => {
    // Mock DB responses
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          subscription_id: 'sub_123',
          subscription_status: 'active'
        },
        error: null
      })
    };

    // Mock Stripe subscription retrieval - already set to cancel
    const mockSubscription = {
      id: 'sub_123',
      cancel_at_period_end: true,
      current_period_end: 1672531200 // 2023-01-01
    };
    (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValueOnce(mockSubscription);
    
    const { req, res } = createMocks({
      method: 'POST'
    });

    await cancelSubscriptionHandler(req, res, 'user123', mockDb);

    // Check if Stripe subscription was NOT updated
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    
    // Check response
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      data: {
        message: 'Subscription is already scheduled to cancel at the end of the billing period',
        subscription: {
          id: 'sub_123',
          currentPeriodEnd: '2023-01-01T00:00:00.000Z',
          cancelAtPeriodEnd: true
        }
      }
    });
  });

  it('returns error when user has no active subscription', async () => {
    // Mock DB responses
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          subscription_id: null,
          subscription_status: 'none'
        },
        error: null
      })
    };
    
    const { req, res } = createMocks({
      method: 'POST'
    });

    await cancelSubscriptionHandler(req, res, 'user123', mockDb);
    
    // Check that Stripe subscription was NOT retrieved
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    
    // Check response
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'No active subscription found'
    });
  });

  it('still succeeds if database update fails', async () => {
    // Mock DB responses
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          subscription_id: 'sub_123',
          subscription_status: 'active'
        },
        error: null
      }),
      update: jest.fn().mockReturnThis()
    };

    // Mock Stripe subscription retrieval
    const mockSubscription = {
      id: 'sub_123',
      cancel_at_period_end: false,
      current_period_end: 1672531200 // 2023-01-01
    };
    (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValueOnce(mockSubscription);
    
    // Mock Stripe subscription update
    const mockUpdatedSubscription = {
      id: 'sub_123',
      cancel_at_period_end: true,
      current_period_end: 1672531200 // 2023-01-01
    };
    (stripe.subscriptions.update as jest.Mock).mockResolvedValueOnce(mockUpdatedSubscription);

    // Mock DB update error
    mockDb.update.mockImplementationOnce(() => ({
      eq: jest.fn().mockResolvedValue({
        error: new Error('Update error')
      })
    }));
    
    const { req, res } = createMocks({
      method: 'POST'
    });

    await cancelSubscriptionHandler(req, res, 'user123', mockDb);
    
    // Check error logging
    expect(logError).toHaveBeenCalledWith('Payments/CancelSubscription', 'Failed to update subscription status in database', expect.any(Object));
    
    // Check that we still return success
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      data: {
        message: 'Subscription will be canceled at the end of the current billing period',
        subscription: {
          id: 'sub_123',
          currentPeriodEnd: '2023-01-01T00:00:00.000Z',
          cancelAtPeriodEnd: true
        }
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
      method: 'POST'
    });

    await cancelSubscriptionHandler(req, res, 'user123', mockDb);

    // Check error logging
    expect(logError).toHaveBeenCalledWith('Payments/CancelSubscription', 'Failed to retrieve user profile', expect.any(Object));
    
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
          subscription_id: 'sub_123',
          subscription_status: 'active'
        },
        error: null
      })
    };

    // Mock Stripe API error
    (stripe.subscriptions.retrieve as jest.Mock).mockRejectedValueOnce(new Error('Stripe API error'));

    const { req, res } = createMocks({
      method: 'POST'
    });

    await cancelSubscriptionHandler(req, res, 'user123', mockDb);
    
    // Check error logging
    expect(logError).toHaveBeenCalledWith('Payments/CancelSubscription', 'Failed to cancel subscription', expect.any(Object));
    
    // Check response
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Failed to cancel subscription'
    });
  });
});