/**
 * Custom hook for checking subscription status
 * 
 * Provides subscription status information and handles loading states.
 */
import { useState, useEffect } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { getSubscriptionStatus } from '../lib/client/payments';
import { UserTier } from '../lib/tier-manager';

interface UseSubscriptionStatusResult {
  /**
   * Whether the user has an active premium subscription
   */
  isSubscribed: boolean;
  
  /**
   * User tier based on authentication and subscription status
   */
  tier: UserTier;
  
  /**
   * Whether the subscription status is being loaded
   */
  isLoading: boolean;
  
  /**
   * Error message if subscription check failed
   */
  error: string | null;
  
  /**
   * Force a refresh of the subscription status
   */
  refreshStatus: () => Promise<void>;
  
  /**
   * Subscription details if user is subscribed
   */
  subscriptionDetails: any | null;
}

/**
 * Hook to get and manage subscription status
 */
export function useSubscriptionStatus(): UseSubscriptionStatusResult {
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any | null>(null);
  
  const user = useUser();
  
  // Determine user tier based on auth and subscription status
  const tier: UserTier = !user 
    ? 'anonymous' 
    : isSubscribed 
      ? 'premium' 
      : 'free';

  // Check subscription status when user changes
  useEffect(() => {
    // Skip check for non-authenticated users
    if (!user) {
      setIsSubscribed(false);
      setIsLoading(false);
      setError(null);
      setSubscriptionDetails(null);
      return;
    }
    
    checkSubscription();
  }, [user]);

  // Function to check subscription status
  const checkSubscription = async () => {
    if (!user) {
      setIsSubscribed(false);
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const status = await getSubscriptionStatus();
      setIsSubscribed(status.active);
      setSubscriptionDetails(status.subscription);
    } catch (err: any) {
      console.error('Error checking subscription status:', err);
      setError(err.message || 'Failed to check subscription status');
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSubscribed,
    tier,
    isLoading,
    error,
    refreshStatus: checkSubscription,
    subscriptionDetails
  };
}