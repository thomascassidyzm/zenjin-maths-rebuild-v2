import { createMocks } from 'node-mocks-http';
import createCustomerHandler from '../../../pages/api/payments/create-customer';
import { stripe } from '../../../lib/stripe';
import { createAuthHandler } from '../../../lib/api/handlers';
import { logError } from '../../../lib/api/logging';

// Mock dependencies
jest.mock('../../../lib/stripe', () => ({
  stripe: {
    customers: {
      create: jest.fn()
    }
  }
}));

jest.mock('../../../lib/api/handlers', () => ({
  createAuthHandler: jest.fn((handler) => handler)
}));

jest.mock('../../../lib/api/logging', () => ({
  logError: jest.fn()
}));

describe('/api/payments/create-customer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new Stripe customer when user does not have one', async () => {
    // Mock DB responses
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          email: 'test@example.com',
          stripe_customer_id: null
        },
        error: null
      }),
      update: jest.fn().mockReturnThis()
    };

    // Mock Stripe customer creation
    const mockCustomer = { id: 'cus_123456' };
    (stripe.customers.create as jest.Mock).mockResolvedValueOnce(mockCustomer);
    
    // Mock update response
    mockDb.update.mockImplementationOnce(() => ({
      eq: jest.fn().mockResolvedValue({
        error: null
      })
    }));

    const { req, res } = createMocks({
      method: 'POST'
    });

    await createCustomerHandler(req, res, 'user123', mockDb);

    // Check if user was retrieved
    expect(mockDb.from).toHaveBeenCalledWith('profiles');
    expect(mockDb.select).toHaveBeenCalledWith('email, stripe_customer_id');
    expect(mockDb.eq).toHaveBeenCalledWith('id', 'user123');
    
    // Check if Stripe customer was created
    expect(stripe.customers.create).toHaveBeenCalledWith({
      email: 'test@example.com',
      metadata: {
        userId: 'user123'
      }
    });
    
    // Check if customer ID was saved to profile
    expect(mockDb.update).toHaveBeenCalledWith({ stripe_customer_id: 'cus_123456' });
    
    // Check response
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      data: {
        customerId: 'cus_123456',
        message: 'Customer created successfully'
      }
    });
  });

  it('returns existing customer ID when user already has one', async () => {
    // Mock DB responses
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          email: 'test@example.com',
          stripe_customer_id: 'existing_cus_123'
        },
        error: null
      })
    };

    const { req, res } = createMocks({
      method: 'POST'
    });

    await createCustomerHandler(req, res, 'user123', mockDb);

    // Check if user was retrieved
    expect(mockDb.from).toHaveBeenCalledWith('profiles');
    expect(mockDb.select).toHaveBeenCalledWith('email, stripe_customer_id');
    expect(mockDb.eq).toHaveBeenCalledWith('id', 'user123');
    
    // Check that Stripe customer was NOT created
    expect(stripe.customers.create).not.toHaveBeenCalled();
    
    // Check response
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      data: {
        customerId: 'existing_cus_123',
        message: 'Customer already exists'
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

    await createCustomerHandler(req, res, 'user123', mockDb);

    // Check error logging
    expect(logError).toHaveBeenCalledWith('Payments/CreateCustomer', 'Failed to retrieve user profile', expect.any(Object));
    
    // Check response
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Failed to retrieve user profile'
    });
  });

  it('handles errors when updating user profile', async () => {
    // Mock DB responses
    const mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          email: 'test@example.com',
          stripe_customer_id: null
        },
        error: null
      }),
      update: jest.fn().mockReturnThis()
    };

    // Mock Stripe customer creation
    const mockCustomer = { id: 'cus_123456' };
    (stripe.customers.create as jest.Mock).mockResolvedValueOnce(mockCustomer);
    
    // Mock update error
    mockDb.update.mockImplementationOnce(() => ({
      eq: jest.fn().mockResolvedValue({
        error: new Error('Update error')
      })
    }));

    const { req, res } = createMocks({
      method: 'POST'
    });

    await createCustomerHandler(req, res, 'user123', mockDb);
    
    // Check error logging
    expect(logError).toHaveBeenCalledWith('Payments/CreateCustomer', 'Failed to update user profile with customer ID', expect.any(Object));
    
    // Check response - should still succeed but with a different message
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      data: {
        customerId: 'cus_123456',
        message: 'Customer created but ID storage failed'
      }
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
          email: 'test@example.com',
          stripe_customer_id: null
        },
        error: null
      })
    };

    // Mock Stripe customer creation error
    (stripe.customers.create as jest.Mock).mockRejectedValueOnce(new Error('Stripe API error'));

    const { req, res } = createMocks({
      method: 'POST'
    });

    await createCustomerHandler(req, res, 'user123', mockDb);
    
    // Check error logging
    expect(logError).toHaveBeenCalledWith('Payments/CreateCustomer', 'Failed to create Stripe customer', expect.any(Object));
    
    // Check response
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Failed to create Stripe customer'
    });
  });
});