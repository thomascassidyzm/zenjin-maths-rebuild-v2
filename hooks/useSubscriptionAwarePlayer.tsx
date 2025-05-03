/**
 * Subscription-Aware Player Hook
 * 
 * This hook enhances the useTripleHelixPlayer hook with subscription awareness,
 * enforcing free tier limitations and handling premium content access.
 */
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useTripleHelixPlayer } from '../lib/playerUtils';
import { getSubscriptionStatus, SubscriptionStatusResponse } from '../lib/client/payments';
import { canAccessStitch, AccessCheckResult, AccessLevel } from '../lib/freeTierAccess';
import { enhanceStateWithSubscription, needsSubscriptionRefresh } from '../lib/enhanceWithSubscription';

// Frequency to refresh subscription status (in milliseconds)
const SUBSCRIPTION_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useSubscriptionAwarePlayer(options: any = {}) {
  // Get base player hooks
  const player = useTripleHelixPlayer(options);
  const router = useRouter();
  
  // Additional state for subscription and premium content
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatusResponse | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallStitch, setPaywallStitch] = useState<any>(null);
  const [accessResult, setAccessResult] = useState<AccessCheckResult | null>(null);
  const [enhancedState, setEnhancedState] = useState<any>(null);
  
  // Load subscription status on mount or user change
  useEffect(() => {
    if (player.isLoading) return;
    
    const loadSubscription = async () => {
      try {
        setIsLoadingSubscription(true);
        setSubscriptionError(null);
        
        const status = await getSubscriptionStatus();
        setSubscriptionStatus(status);
        
        // Enhance state with subscription data
        if (player.state) {
          const enhanced = enhanceStateWithSubscription(player.state, status);
          setEnhancedState(enhanced);
        }
      } catch (error: any) {
        console.error('Failed to load subscription status:', error);
        setSubscriptionError(error.message || 'Failed to load subscription status');
      } finally {
        setIsLoadingSubscription(false);
      }
    };
    
    loadSubscription();
    
    // Set up periodic refresh of subscription status
    const refreshInterval = setInterval(() => {
      if (enhancedState && needsSubscriptionRefresh(enhancedState)) {
        loadSubscription();
      }
    }, SUBSCRIPTION_REFRESH_INTERVAL);
    
    return () => clearInterval(refreshInterval);
  }, [player.isLoading, player.state]);
  
  // Update enhanced state when player state changes
  useEffect(() => {
    if (player.state && subscriptionStatus) {
      const enhanced = enhanceStateWithSubscription(player.state, subscriptionStatus);
      setEnhancedState(enhanced);
    }
  }, [player.state, subscriptionStatus]);
  
  // Handle stitch completion with subscription awareness
  const handleSessionComplete = useCallback((results: any, isEndSession = false) => {
    // Pass through to original handler
    player.handleSessionComplete(results, isEndSession);
  }, [player.handleSessionComplete]);
  
  // Check if a stitch requires subscription
  const checkStitchAccess = useCallback((stitch: any): AccessCheckResult => {
    if (!stitch) {
      return {
        hasAccess: true,
        accessLevel: AccessLevel.FREE
      };
    }
    
    // Get the stitch position (defaulting to the order_number property if available)
    const position = typeof stitch.position === 'number' 
      ? stitch.position 
      : (stitch.order_number || 0);
    
    // Check if this is a premium-flagged stitch
    if (stitch.is_premium) {
      return {
        hasAccess: false,
        accessLevel: AccessLevel.FREE,
        reason: 'This content requires a subscription'
      };
    }
    
    return canAccessStitch(
      stitch.id,
      position,
      subscriptionStatus
    );
  }, [subscriptionStatus]);
  
  // Override current stitch getter to handle premium content
  const getCurrentStitch = useCallback(() => {
    const stitch = player.currentStitch;
    
    if (!stitch) return null;
    
    // Check access to this stitch
    const access = checkStitchAccess(stitch);
    setAccessResult(access);
    
    // If no access, store for paywall and return null
    if (!access.hasAccess) {
      setPaywallStitch(stitch);
      setShowPaywall(true);
      return null;
    }
    
    return stitch;
  }, [player.currentStitch, checkStitchAccess]);
  
  // Function to navigate to subscription page
  const goToSubscriptionPage = useCallback(() => {
    router.push('/subscription');
  }, [router]);
  
  // Function to close paywall
  const closePaywall = useCallback(() => {
    setShowPaywall(false);
  }, []);
  
  // Function to refresh subscription status manually
  const refreshSubscriptionStatus = useCallback(async () => {
    try {
      setIsLoadingSubscription(true);
      setSubscriptionError(null);
      
      const status = await getSubscriptionStatus();
      setSubscriptionStatus(status);
      
      // After refreshing, check again the current stitch
      if (paywallStitch) {
        const access = canAccessStitch(
          paywallStitch.id,
          paywallStitch.position || paywallStitch.order_number || 0,
          status
        );
        
        // If user now has access, close paywall and reset
        if (access.hasAccess) {
          setShowPaywall(false);
          setPaywallStitch(null);
        }
        
        setAccessResult(access);
      }
      
      return status;
    } catch (error: any) {
      console.error('Failed to refresh subscription status:', error);
      setSubscriptionError(error.message || 'Failed to refresh subscription status');
      return null;
    } finally {
      setIsLoadingSubscription(false);
    }
  }, [paywallStitch]);
  
  return {
    // Original player functions
    ...player,
    
    // Override functions
    handleSessionComplete,
    getCurrentStitch,
    
    // Enhanced state
    enhancedState,
    
    // Subscription-specific properties
    subscriptionStatus,
    isLoadingSubscription,
    subscriptionError,
    showPaywall,
    paywallStitch,
    accessResult,
    
    // Subscription-specific functions
    checkStitchAccess,
    goToSubscriptionPage,
    closePaywall,
    refreshSubscriptionStatus
  };
}