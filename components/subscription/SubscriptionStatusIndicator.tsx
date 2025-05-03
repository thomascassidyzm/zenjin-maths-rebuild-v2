/**
 * Subscription Status Indicator Component
 * 
 * A lightweight component to display the user's subscription status,
 * suitable for display in header/navigation areas.
 */
import React, { useState, useEffect } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { getSubscriptionStatus } from '../../lib/client/payments';

interface SubscriptionStatusIndicatorProps {
  variant?: 'badge' | 'text' | 'icon';
  className?: string;
}

const SubscriptionStatusIndicator: React.FC<SubscriptionStatusIndicatorProps> = ({
  variant = 'badge',
  className = ''
}) => {
  const [status, setStatus] = useState<'loading' | 'active' | 'ending' | 'none'>('loading');
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const user = useUser();

  useEffect(() => {
    // Only fetch if user is logged in
    if (!user) {
      setStatus('none');
      return;
    }

    const fetchSubscriptionStatus = async () => {
      try {
        setStatus('loading');
        const subscriptionData = await getSubscriptionStatus();
        
        if (subscriptionData.active) {
          if (subscriptionData.subscription?.cancelAtPeriodEnd) {
            setStatus('ending');
          } else {
            setStatus('active');
          }
          setDetails(subscriptionData.subscription);
        } else {
          setStatus('none');
        }
      } catch (err: any) {
        console.error('Error fetching subscription status:', err);
        setError(err.message || 'Failed to load subscription status');
        setStatus('none');
      }
    };

    fetchSubscriptionStatus();
  }, [user]);

  // If user is not logged in, don't show anything
  if (!user) {
    return null;
  }

  // Handle loading state
  if (status === 'loading') {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <div className="w-3 h-3 rounded-full bg-gray-300 animate-pulse mr-2"></div>
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
        <span className="text-sm text-red-500">Error</span>
      </div>
    );
  }

  // Badge variant (default)
  if (variant === 'badge') {
    return (
      <div 
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${className} ${
          status === 'active' 
            ? 'bg-green-100 text-green-800' 
            : status === 'ending' 
            ? 'bg-yellow-100 text-yellow-800' 
            : 'bg-gray-100 text-gray-800'
        }`}
        title={
          status === 'active' 
            ? 'Active subscription' 
            : status === 'ending' 
            ? `Subscription ends on ${new Date(details?.currentPeriodEnd).toLocaleDateString()}` 
            : 'No active subscription'
        }
      >
        <div 
          className={`w-2 h-2 rounded-full mr-1 ${
            status === 'active' 
              ? 'bg-green-500' 
              : status === 'ending' 
              ? 'bg-yellow-500' 
              : 'bg-gray-500'
          }`}
        ></div>
        {status === 'active' && 'Premium'}
        {status === 'ending' && 'Premium (Ending)'}
        {status === 'none' && 'Free'}
      </div>
    );
  }

  // Text variant
  if (variant === 'text') {
    return (
      <span 
        className={`text-sm ${className} ${
          status === 'active' 
            ? 'text-green-600' 
            : status === 'ending' 
            ? 'text-yellow-600' 
            : 'text-gray-600'
        }`}
        title={
          status === 'ending' 
            ? `Subscription ends on ${new Date(details?.currentPeriodEnd).toLocaleDateString()}` 
            : undefined
        }
      >
        {status === 'active' && 'Premium Subscription'}
        {status === 'ending' && 'Premium (Ends Soon)'}
        {status === 'none' && 'Free Account'}
      </span>
    );
  }

  // Icon variant
  if (variant === 'icon') {
    return (
      <div 
        className={`inline-block ${className}`}
        title={
          status === 'active' 
            ? 'Premium Subscription' 
            : status === 'ending' 
            ? `Premium subscription ending on ${new Date(details?.currentPeriodEnd).toLocaleDateString()}` 
            : 'Free Account'
        }
      >
        {status === 'active' && (
          <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
        {status === 'ending' && (
          <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        )}
        {status === 'none' && (
          <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    );
  }

  return null;
};

export default SubscriptionStatusIndicator;