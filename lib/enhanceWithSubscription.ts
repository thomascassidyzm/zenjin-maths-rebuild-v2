/**
 * Enhance User State with Subscription
 * 
 * This module provides utilities for enhancing user state data with subscription
 * information and controlling access to premium content.
 */

import { SubscriptionStatusResponse, getSubscriptionStatus } from './client/payments';
import { hasActiveSubscription, filterAccessibleStitches, AccessLevel } from './freeTierAccess';
import { logError } from './api/logging';

/**
 * User state with subscription information
 */
export interface UserStateWithSubscription {
  /**
   * Whether the user has an active subscription
   */
  hasSubscription: boolean;
  
  /**
   * The user's access level
   */
  accessLevel: AccessLevel;
  
  /**
   * The complete subscription status data
   */
  subscriptionData: SubscriptionStatusResponse | null;
  
  /**
   * When the subscription data was last fetched
   */
  subscriptionFetchedAt: number;
}

/**
 * Enhanced triple-helix state with subscription information
 */
export interface EnhancedTripleHelixState extends UserStateWithSubscription {
  userId: string;
  activeTubeNumber: number;
  tubes: {
    [tubeNumber: string]: {
      threadId: string;
      currentStitchId: string;
      stitches: any[];
      accessibleStitches?: any[];
    };
  };
}

/**
 * Cache for subscription status to avoid excessive API calls
 */
const subscriptionCache = new Map<string, {
  data: SubscriptionStatusResponse | null;
  timestamp: number;
}>();

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Fetch and cache subscription status for a user
 * 
 * @param userId - The user ID
 * @param forceRefresh - Whether to bypass cache and force refresh
 * @returns The subscription status
 */
export async function fetchUserSubscriptionStatus(
  userId: string,
  forceRefresh = false
): Promise<SubscriptionStatusResponse | null> {
  // Check cache first if not forcing refresh
  if (!forceRefresh) {
    const cached = subscriptionCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.data;
    }
  }
  
  try {
    // Fetch fresh subscription status
    const status = await getSubscriptionStatus();
    
    // Update cache
    subscriptionCache.set(userId, {
      data: status,
      timestamp: Date.now()
    });
    
    return status;
  } catch (error) {
    logError('EnhanceWithSubscription', 'Failed to fetch subscription status', {
      userId,
      error
    });
    
    // If we have a cached value, return it despite the error
    const cached = subscriptionCache.get(userId);
    if (cached) {
      return cached.data;
    }
    
    return null;
  }
}

/**
 * Clear subscription cache for a user
 * 
 * @param userId - The user ID to clear cache for
 */
export function clearSubscriptionCache(userId?: string): void {
  if (userId) {
    subscriptionCache.delete(userId);
  } else {
    subscriptionCache.clear();
  }
}

/**
 * Enhance user state with subscription information
 * 
 * @param state - The triple-helix state to enhance
 * @param subscriptionStatus - The user's subscription status
 * @returns Enhanced state with subscription information
 */
export function enhanceStateWithSubscription(
  state: any,
  subscriptionStatus: SubscriptionStatusResponse | null
): EnhancedTripleHelixState {
  const hasSubscription = hasActiveSubscription(subscriptionStatus);
  
  // Determine access level
  let accessLevel = AccessLevel.FREE;
  if (subscriptionStatus?.status === 'admin') {
    accessLevel = AccessLevel.ADMIN;
  } else if (hasSubscription) {
    accessLevel = AccessLevel.PAID;
  }
  
  // Copy state and add subscription info
  const enhancedState: EnhancedTripleHelixState = {
    ...state,
    hasSubscription,
    accessLevel,
    subscriptionData: subscriptionStatus,
    subscriptionFetchedAt: Date.now()
  };
  
  // For free tier users, filter accessible stitches
  if (!hasSubscription && accessLevel !== AccessLevel.ADMIN) {
    // Process each tube
    Object.keys(enhancedState.tubes).forEach(tubeKey => {
      const tube = enhancedState.tubes[tubeKey];
      if (tube && Array.isArray(tube.stitches)) {
        // Filter stitches based on access rules
        tube.accessibleStitches = filterAccessibleStitches(
          tube.stitches,
          subscriptionStatus
        );
      }
    });
  }
  
  return enhancedState;
}

/**
 * Check if a user's subscription status needs refresh
 * 
 * @param state - The triple-helix state
 * @returns Whether subscription status needs refresh
 */
export function needsSubscriptionRefresh(state: EnhancedTripleHelixState): boolean {
  // Check if we have subscription data and it's recent
  if (!state.subscriptionFetchedAt) {
    return true;
  }
  
  // Refresh if more than 5 minutes old
  const ageInMs = Date.now() - state.subscriptionFetchedAt;
  return ageInMs > CACHE_TTL;
}