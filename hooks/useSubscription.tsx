/**
 * Subscription Hook
 * 
 * This hook provides a clean interface for handling subscription-related 
 * functionality throughout the application.
 */
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { getSubscriptionStatus, subscribeToPlay, cancelSubscription } from '../lib/client/payments';

export interface UseSubscriptionOptions {
  /**
   * Whether to check subscription status on mount
   */
  checkOnMount?: boolean;
  
  /**
   * Refresh interval in milliseconds (0 to disable auto-refresh)
   */
  refreshInterval?: number;
  
  /**
   * URL to redirect to after successful subscription
   */
  successUrl?: string;
  
  /**
   * URL to redirect to if subscription is canceled
   */
  cancelUrl?: string;
}

export interface SubscriptionState {
  /**
   * Whether subscription data is currently loading
   */
  isLoading: boolean;
  
  /**
   * Whether user has an active subscription
   */
  isSubscribed: boolean;
  
  /**
   * The complete subscription status data
   */
  subscriptionData: any | null;
  
  /**
   * Error message if subscription check fails
   */
  error: string | null;
  
  /**
   * Whether subscription is currently being processed
   */
  isProcessing: boolean;
  
  /**
   * When subscription data was last refreshed
   */
  lastRefreshed: number | null;
}

export function useSubscription(options: UseSubscriptionOptions = {}) {
  const {
    checkOnMount = true,
    refreshInterval = 0,
    successUrl: propSuccessUrl,
    cancelUrl: propCancelUrl
  } = options;
  
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  
  // Subscription state
  const [state, setState] = useState<SubscriptionState>({
    isLoading: false,
    isSubscribed: false,
    subscriptionData: null,
    error: null,
    isProcessing: false,
    lastRefreshed: null
  });
  
  /**
   * Check subscription status
   */
  const checkSubscription = useCallback(async () => {
    // Skip if user is not authenticated or still loading
    if (!user || isAuthLoading) return null;
    
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const subscriptionStatus = await getSubscriptionStatus();
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isSubscribed: subscriptionStatus.active,
        subscriptionData: subscriptionStatus,
        lastRefreshed: Date.now()
      }));
      
      return subscriptionStatus;
    } catch (err: any) {
      console.error('Error checking subscription:', err);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Failed to check subscription status'
      }));
      
      return null;
    }
  }, [user, isAuthLoading]);
  
  /**
   * Subscribe to premium plan
   */
  const subscribe = useCallback(async () => {
    // Get current URL components for redirect
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/subscribe';
    
    // Use provided URLs or construct defaults
    const successUrl = propSuccessUrl || `${origin}${currentPath}?success=true`;
    const cancelUrl = propCancelUrl || `${origin}${currentPath}?canceled=true`;
    
    try {
      setState(prev => ({ ...prev, isProcessing: true, error: null }));
      
      // Start subscription process
      await subscribeToPlay('MONTHLY', successUrl, cancelUrl);
      
      // This line will only execute if the redirect fails
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: 'Failed to redirect to payment page'
      }));
      
      return false;
    } catch (err: any) {
      console.error('Subscription error:', err);
      
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: err.message || 'Failed to start subscription process'
      }));
      
      return false;
    }
  }, [propSuccessUrl, propCancelUrl]);
  
  /**
   * Cancel current subscription
   */
  const cancel = useCallback(async () => {
    if (!state.isSubscribed) {
      setState(prev => ({
        ...prev,
        error: 'No active subscription to cancel'
      }));
      return false;
    }
    
    try {
      setState(prev => ({ ...prev, isProcessing: true, error: null }));
      
      // Cancel subscription
      const result = await cancelSubscription();
      
      // Refresh subscription status
      await checkSubscription();
      
      setState(prev => ({
        ...prev,
        isProcessing: false
      }));
      
      return true;
    } catch (err: any) {
      console.error('Subscription cancellation error:', err);
      
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: err.message || 'Failed to cancel subscription'
      }));
      
      return false;
    }
  }, [state.isSubscribed, checkSubscription]);
  
  // Check subscription on mount if enabled
  useEffect(() => {
    if (checkOnMount && user && !isAuthLoading) {
      checkSubscription();
    }
  }, [checkOnMount, user, isAuthLoading, checkSubscription]);
  
  // Set up auto-refresh interval if enabled
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(() => {
        if (user && !isAuthLoading) {
          checkSubscription();
        }
      }, refreshInterval);
      
      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, user, isAuthLoading, checkSubscription]);
  
  // Check for subscription status in query parameters
  useEffect(() => {
    const { success, canceled } = router.query;
    
    if (success === 'true' && user) {
      // If success query param is present, check subscription status
      checkSubscription();
    }
  }, [router.query, user, checkSubscription]);
  
  return {
    // State
    ...state,
    
    // Actions
    subscribe,
    cancel,
    refresh: checkSubscription,
    
    // Helper methods
    goToManage: () => router.push('/subscribe'),
    isPremiumReady: !state.isLoading && state.isSubscribed,
    isFreeTier: !state.isLoading && !state.isSubscribed
  };
}