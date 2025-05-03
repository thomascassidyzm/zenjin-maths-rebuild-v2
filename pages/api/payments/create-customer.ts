/**
 * Create Stripe Customer API Endpoint
 *
 * This endpoint creates a Stripe customer for the authenticated user 
 * and stores the customer ID in the user profile.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createAuthHandler } from '../../../lib/api/handlers';
import { stripe } from '../../../lib/stripe';
import { formatSuccessResponse, formatErrorResponse } from '../../../lib/api/responses';
import { logError } from '../../../lib/api/logging';

export default createAuthHandler(
  async (req: NextApiRequest, res: NextApiResponse, userId: string, db: any) => {
    try {
      // Get user's email from database
      const { data: userData, error: userError } = await db
        .from('profiles')
        .select('email, stripe_customer_id')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        const errorMessage = 'Failed to retrieve user profile';
        logError('Payments/CreateCustomer', errorMessage, {
          userId,
          error: userError
        });
        return formatErrorResponse(res, 400, errorMessage);
      }

      // Check if user already has a Stripe customer ID
      if (userData.stripe_customer_id) {
        return formatSuccessResponse(res, {
          customerId: userData.stripe_customer_id,
          message: 'Customer already exists'
        });
      }

      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: userData.email,
        metadata: {
          userId
        }
      });

      // Store the customer ID in the user profile
      const { error: updateError } = await db
        .from('profiles')
        .update({ stripe_customer_id: customer.id })
        .eq('id', userId);

      if (updateError) {
        logError('Payments/CreateCustomer', 'Failed to update user profile with customer ID', {
          userId,
          customerId: customer.id,
          error: updateError
        });
        
        // We created the customer but couldn't save the ID
        // We'll still return success but log the error
        return formatSuccessResponse(res, {
          customerId: customer.id,
          message: 'Customer created but ID storage failed'
        });
      }

      return formatSuccessResponse(res, {
        customerId: customer.id,
        message: 'Customer created successfully'
      });
    } catch (error) {
      logError('Payments/CreateCustomer', 'Failed to create Stripe customer', {
        userId,
        error
      });
      return formatErrorResponse(res, 500, 'Failed to create Stripe customer');
    }
  },
  {
    methods: ['POST'],
    context: 'Payments/CreateCustomer'
  }
);