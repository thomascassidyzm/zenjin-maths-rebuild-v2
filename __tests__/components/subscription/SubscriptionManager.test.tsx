import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SubscriptionManager from '../../../components/subscription/SubscriptionManager';
import * as paymentUtils from '../../../lib/client/payments';

// Mock the payment utilities
jest.mock('../../../lib/client/payments', () => ({
  getSubscriptionStatus: jest.fn(),
  cancelSubscription: jest.fn(),
  subscribeToPlay: jest.fn()
}));

// Mock Supabase auth hooks
jest.mock('@supabase/auth-helpers-react', () => ({
  useSupabaseClient: jest.fn(),
  useUser: jest.fn().mockReturnValue({ id: 'user123', email: 'test@example.com' })
}));

describe('SubscriptionManager Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays loading state initially', () => {
    // Mock loading state by not resolving the promise
    (paymentUtils.getSubscriptionStatus as jest.Mock).mockReturnValue(new Promise(() => {}));
    
    render(<SubscriptionManager />);
    
    expect(screen.getByText('Loading subscription information...')).toBeInTheDocument();
  });

  it('displays error state when fetching fails', async () => {
    (paymentUtils.getSubscriptionStatus as jest.Mock).mockRejectedValueOnce(new Error('Failed to load'));
    
    render(<SubscriptionManager />);
    
    await waitFor(() => {
      expect(screen.getByText(/Error: Failed to load/)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('shows subscription options when user has no active subscription', async () => {
    (paymentUtils.getSubscriptionStatus as jest.Mock).mockResolvedValueOnce({
      active: false,
      status: 'none',
      subscription: null,
      updatedAt: null
    });
    
    render(<SubscriptionManager />);
    
    await waitFor(() => {
      expect(screen.getByText("You don't have an active subscription")).toBeInTheDocument();
      expect(screen.getByText('Monthly')).toBeInTheDocument();
      expect(screen.getByText('Annual')).toBeInTheDocument();
      expect(screen.getByText('$9.99/mo')).toBeInTheDocument();
      expect(screen.getByText('$99.99/yr')).toBeInTheDocument();
      expect(screen.getByText('Subscribe Monthly')).toBeInTheDocument();
      expect(screen.getByText('Subscribe Annually')).toBeInTheDocument();
    });
  });

  it('shows active subscription details', async () => {
    const mockSubscription = {
      active: true,
      status: 'active',
      subscription: {
        id: 'sub_123',
        status: 'active',
        currentPeriodEnd: '2023-12-31T00:00:00.000Z',
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
    };
    
    (paymentUtils.getSubscriptionStatus as jest.Mock).mockResolvedValueOnce(mockSubscription);
    
    render(<SubscriptionManager />);
    
    await waitFor(() => {
      expect(screen.getByText('Your subscription is active')).toBeInTheDocument();
      expect(screen.getByText(/Monthly Plan/)).toBeInTheDocument();
      expect(screen.getByText(/Current period ends/)).toBeInTheDocument();
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });
  });

  it('shows pending cancellation when subscription is set to cancel', async () => {
    const mockSubscription = {
      active: true,
      status: 'active',
      subscription: {
        id: 'sub_123',
        status: 'active',
        currentPeriodEnd: '2023-12-31T00:00:00.000Z',
        cancelAtPeriodEnd: true,
        plan: {
          id: 'price_123',
          nickname: 'Monthly Plan',
          interval: 'month',
          amount: 999,
          currency: 'usd'
        }
      },
      updatedAt: '2023-01-01T00:00:00.000Z'
    };
    
    (paymentUtils.getSubscriptionStatus as jest.Mock).mockResolvedValueOnce(mockSubscription);
    
    render(<SubscriptionManager />);
    
    await waitFor(() => {
      expect(screen.getByText('Your subscription is active')).toBeInTheDocument();
      expect(screen.getByText('Your subscription will end after the current billing period')).toBeInTheDocument();
      // Cancel button should not be visible
      expect(screen.queryByText('Cancel Subscription')).not.toBeInTheDocument();
    });
  });

  it('calls subscribeToPlay when subscribe button is clicked', async () => {
    (paymentUtils.getSubscriptionStatus as jest.Mock).mockResolvedValueOnce({
      active: false,
      status: 'none',
      subscription: null,
      updatedAt: null
    });
    
    render(<SubscriptionManager />);
    
    await waitFor(() => {
      expect(screen.getByText("You don't have an active subscription")).toBeInTheDocument();
    });
    
    // Click the Monthly subscribe button
    fireEvent.click(screen.getByText('Subscribe Monthly'));
    
    expect(paymentUtils.subscribeToPlay).toHaveBeenCalledWith(
      'MONTHLY',
      expect.any(String),
      expect.any(String)
    );
  });

  it('shows confirmation before canceling subscription', async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn().mockReturnValue(true);
    
    const mockSubscription = {
      active: true,
      status: 'active',
      subscription: {
        id: 'sub_123',
        status: 'active',
        currentPeriodEnd: '2023-12-31T00:00:00.000Z',
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
    };
    
    (paymentUtils.getSubscriptionStatus as jest.Mock).mockResolvedValueOnce(mockSubscription);
    (paymentUtils.cancelSubscription as jest.Mock).mockResolvedValueOnce({
      message: 'Subscription will be canceled at the end of the current billing period'
    });
    
    render(<SubscriptionManager />);
    
    await waitFor(() => {
      expect(screen.getByText('Your subscription is active')).toBeInTheDocument();
    });
    
    // Click the Cancel button
    fireEvent.click(screen.getByText('Cancel Subscription'));
    
    expect(window.confirm).toHaveBeenCalled();
    expect(paymentUtils.cancelSubscription).toHaveBeenCalled();
    
    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('refreshes subscription data when refresh button is clicked', async () => {
    (paymentUtils.getSubscriptionStatus as jest.Mock).mockResolvedValueOnce({
      active: false,
      status: 'none',
      subscription: null,
      updatedAt: null
    });
    
    render(<SubscriptionManager />);
    
    await waitFor(() => {
      expect(screen.getByText("You don't have an active subscription")).toBeInTheDocument();
    });
    
    // Clear mock call count
    (paymentUtils.getSubscriptionStatus as jest.Mock).mockClear();
    
    // Mock the response for the refresh
    (paymentUtils.getSubscriptionStatus as jest.Mock).mockResolvedValueOnce({
      active: false,
      status: 'none',
      subscription: null,
      updatedAt: null
    });
    
    // Click refresh button
    fireEvent.click(screen.getByText('Refresh subscription status'));
    
    expect(paymentUtils.getSubscriptionStatus).toHaveBeenCalled();
  });
});