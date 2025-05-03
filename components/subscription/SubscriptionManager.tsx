/**
 * Subscription Manager Component
 *
 * This component handles displaying subscription status and managing subscriptions.
 */
import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { getSubscriptionStatus, cancelSubscription, subscribeToPlay, SubscriptionStatusResponse } from '../../lib/client/payments';
import { formatCurrency } from '../../lib/stripe';

interface SubscriptionManagerProps {
  redirectToSuccess?: string;
  redirectToCancel?: string;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  redirectToSuccess,
  redirectToCancel
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatusResponse | null>(null);
  const [cancelInProgress, setCancelInProgress] = useState(false);
  
  const supabaseClient = useSupabaseClient();
  const user = useUser();

  // Fetch the subscription status when the component mounts
  useEffect(() => {
    if (user) {
      fetchSubscriptionStatus();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Function to fetch subscription status
  const fetchSubscriptionStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await getSubscriptionStatus();
      setSubscription(status);
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription status');
    } finally {
      setLoading(false);
    }
  };

  // Function to handle subscription checkout
  const handleSubscribe = async (plan: 'MONTHLY' | 'ANNUAL' | 'LIFETIME') => {
    try {
      setLoading(true);
      setError(null);
      await subscribeToPlay(
        plan,
        redirectToSuccess || `${window.location.origin}/subscription/success`,
        redirectToCancel || `${window.location.origin}/subscription/canceled`
      );
    } catch (err: any) {
      setError(err.message || 'Failed to start subscription process');
      setLoading(false);
    }
  };

  // Function to handle subscription cancellation
  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will still have access until the end of the current billing period.')) {
      return;
    }
    
    try {
      setCancelInProgress(true);
      setError(null);
      await cancelSubscription();
      // Refresh subscription status
      await fetchSubscriptionStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription');
    } finally {
      setCancelInProgress(false);
    }
  };

  // Handle loading state
  if (loading && !subscription) {
    return <div className="p-4 text-center">Loading subscription information...</div>;
  }

  // Handle error state
  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>Error: {error}</p>
        <button 
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          onClick={fetchSubscriptionStatus}
        >
          Retry
        </button>
      </div>
    );
  }

  // If user is not logged in
  if (!user) {
    return (
      <div className="p-4 text-center">
        <p>Please log in to manage your subscription.</p>
      </div>
    );
  }

  // Display subscription status and management options
  return (
    <div className="max-w-lg mx-auto p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Subscription Status</h2>
      
      {/* Active subscription */}
      {subscription?.active && subscription.subscription && (
        <div className="mb-4">
          <div className="p-4 bg-green-100 rounded mb-4">
            <p className="font-semibold text-green-800">
              Your subscription is active
            </p>
            {subscription.subscription.plan && (
              <p className="text-sm text-green-700 mt-1">
                {subscription.subscription.plan.nickname || 'Plan'}: {formatCurrency(subscription.subscription.plan.amount || 0, subscription.subscription.plan.currency)}
                {subscription.subscription.plan.interval && ` / ${subscription.subscription.plan.interval}`}
              </p>
            )}
            {subscription.subscription.currentPeriodEnd && (
              <p className="text-sm text-green-700 mt-1">
                Current period ends: {new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
            {subscription.subscription.cancelAtPeriodEnd && (
              <p className="text-sm font-medium text-orange-700 mt-2">
                Your subscription will end after the current billing period
              </p>
            )}
          </div>

          {/* Cancel subscription button - only show if not already canceled */}
          {!subscription.subscription.cancelAtPeriodEnd && (
            <button
              className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
              onClick={handleCancelSubscription}
              disabled={cancelInProgress}
            >
              {cancelInProgress ? 'Canceling...' : 'Cancel Subscription'}
            </button>
          )}
        </div>
      )}

      {/* No active subscription */}
      {(!subscription?.active || !subscription?.subscription) && (
        <div className="mb-4">
          <div className="p-4 bg-gray-100 rounded mb-4">
            <p className="font-semibold">
              You don't have an active subscription
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Subscribe to get full access to all content
            </p>
          </div>

          {/* Subscription options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="p-4 border rounded">
              <h3 className="font-bold">Monthly</h3>
              <p className="text-2xl font-bold my-2">$9.99/mo</p>
              <button
                className="w-full mt-2 px-4 py-2 bg-blue-500 text-white rounded"
                onClick={() => handleSubscribe('MONTHLY')}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Subscribe Monthly'}
              </button>
            </div>
            
            <div className="p-4 border rounded border-blue-500">
              <h3 className="font-bold">Annual <span className="text-sm text-green-600">(Save 16%)</span></h3>
              <p className="text-2xl font-bold my-2">$99.99/yr</p>
              <button
                className="w-full mt-2 px-4 py-2 bg-blue-500 text-white rounded"
                onClick={() => handleSubscribe('ANNUAL')}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Subscribe Annually'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refresh button */}
      <div className="mt-6 text-center">
        <button
          className="text-sm text-blue-500 hover:underline"
          onClick={fetchSubscriptionStatus}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh subscription status'}
        </button>
      </div>
    </div>
  );
};

export default SubscriptionManager;