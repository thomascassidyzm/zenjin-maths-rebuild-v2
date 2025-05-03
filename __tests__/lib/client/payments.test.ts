import {
  createCustomer,
  createCheckoutSession,
  getSubscriptionStatus,
  cancelSubscription,
  subscribeToPlay
} from '../../../lib/client/payments';

// Mock global fetch
global.fetch = jest.fn();
// Mock window.location
const originalLocation = window.location;
delete window.location;
window.location = { ...originalLocation, href: '', origin: 'http://localhost:3000' };

describe('Client payment utilities', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Reset window.location.href
    window.location.href = '';
  });

  afterAll(() => {
    // Restore original window.location
    window.location = originalLocation;
  });

  describe('createCustomer', () => {
    it('sends a request to create a customer and returns customer ID', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            customerId: 'cus_123456'
          }
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      const customerId = await createCustomer();
      
      expect(global.fetch).toHaveBeenCalledWith('/api/payments/create-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      expect(customerId).toBe('cus_123456');
    });

    it('throws an error if the request fails', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'Failed to create customer'
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      await expect(createCustomer()).rejects.toThrow('Failed to create customer');
    });
  });

  describe('createCheckoutSession', () => {
    it('sends a request to create a checkout session and returns the URL', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            url: 'https://checkout.stripe.com/session/123'
          }
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      const url = await createCheckoutSession(
        'MONTHLY', 
        'http://success.com', 
        'http://cancel.com'
      );
      
      expect(global.fetch).toHaveBeenCalledWith('/api/payments/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          priceId: undefined, // This will be undefined in the test since SUBSCRIPTION_PRICES is not mocked
          successUrl: 'http://success.com',
          cancelUrl: 'http://cancel.com'
        })
      });
      expect(url).toBe('https://checkout.stripe.com/session/123');
    });

    it('throws an error if the request fails', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'Failed to create checkout session'
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      await expect(createCheckoutSession(
        'MONTHLY', 
        'http://success.com', 
        'http://cancel.com'
      )).rejects.toThrow('Failed to create checkout session');
    });
  });

  describe('getSubscriptionStatus', () => {
    it('fetches the current subscription status', async () => {
      const mockSubscriptionData = {
        active: true,
        status: 'active',
        subscription: {
          id: 'sub_123',
          status: 'active',
          currentPeriodEnd: '2023-12-31T00:00:00.000Z',
          cancelAtPeriodEnd: false,
          plan: {
            id: 'price_123',
            nickname: 'Monthly',
            interval: 'month',
            amount: 999,
            currency: 'usd'
          }
        },
        updatedAt: '2023-01-01T00:00:00.000Z'
      };
      
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: mockSubscriptionData
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      const status = await getSubscriptionStatus();
      
      expect(global.fetch).toHaveBeenCalledWith('/api/payments/subscription-status');
      expect(status).toEqual(mockSubscriptionData);
    });

    it('throws an error if the request fails', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'Failed to get subscription status'
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      await expect(getSubscriptionStatus()).rejects.toThrow('Failed to get subscription status');
    });
  });

  describe('cancelSubscription', () => {
    it('sends a request to cancel the subscription', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            message: 'Subscription will be canceled at the end of the current billing period',
            subscription: {
              id: 'sub_123',
              currentPeriodEnd: '2023-12-31T00:00:00.000Z',
              cancelAtPeriodEnd: true
            }
          }
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      const result = await cancelSubscription();
      
      expect(global.fetch).toHaveBeenCalledWith('/api/payments/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      expect(result).toEqual({
        message: 'Subscription will be canceled at the end of the current billing period',
        subscription: {
          id: 'sub_123',
          currentPeriodEnd: '2023-12-31T00:00:00.000Z',
          cancelAtPeriodEnd: true
        }
      });
    });

    it('throws an error if the request fails', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'Failed to cancel subscription'
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      await expect(cancelSubscription()).rejects.toThrow('Failed to cancel subscription');
    });
  });

  describe('subscribeToPlay', () => {
    it('redirects to checkout when checkout succeeds on first try', async () => {
      const checkoutUrl = 'https://checkout.stripe.com/session/123';
      
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            url: checkoutUrl
          }
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      await subscribeToPlay('MONTHLY');
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/payments/create-checkout', expect.any(Object));
      expect(window.location.href).toBe(checkoutUrl);
    });

    it('creates a customer and then redirects to checkout when initial checkout fails', async () => {
      const checkoutUrl = 'https://checkout.stripe.com/session/123';
      
      // First fetch fails (createCheckoutSession)
      const mockFirstResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'User does not have a Stripe customer ID'
        })
      };
      
      // Second fetch succeeds (createCustomer)
      const mockSecondResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            customerId: 'cus_123456'
          }
        })
      };
      
      // Third fetch succeeds (createCheckoutSession retry)
      const mockThirdResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            url: checkoutUrl
          }
        })
      };
      
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockFirstResponse)
        .mockResolvedValueOnce(mockSecondResponse)
        .mockResolvedValueOnce(mockThirdResponse);
      
      await subscribeToPlay('MONTHLY');
      
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/payments/create-checkout', expect.any(Object));
      expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/payments/create-customer', expect.any(Object));
      expect(global.fetch).toHaveBeenNthCalledWith(3, '/api/payments/create-checkout', expect.any(Object));
      expect(window.location.href).toBe(checkoutUrl);
    });

    it('throws error when both checkout and customer creation fail', async () => {
      console.error = jest.fn(); // Mock console.error to prevent test output noise
      
      // First fetch fails (createCheckoutSession)
      const mockFirstResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'User does not have a Stripe customer ID'
        })
      };
      
      // Second fetch also fails (createCustomer)
      const mockSecondResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'Failed to create customer'
        })
      };
      
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockFirstResponse)
        .mockResolvedValueOnce(mockSecondResponse);
      
      await expect(subscribeToPlay('MONTHLY')).rejects.toThrow('Failed to create customer');
      
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(window.location.href).toBe(''); // No redirect should happen
    });
  });
});