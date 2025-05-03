/**
 * Tier Manager
 * 
 * Handles user tier/entitlement logic for anonymous, free, and paid users.
 * Currently, anonymous users have limited access, while all registered users
 * have full access to free tier content.
 */

import { FREE_TIER_THREAD_IDS, FREE_TIER_STITCH_LIMIT } from './constants/free-tier';

// Re-export the constants so other modules can import from here
export { FREE_TIER_STITCH_LIMIT };

// User tier types
export type UserTier = 'anonymous' | 'free' | 'premium';

// Content access levels
export enum ContentAccessLevel {
  NONE = 'none',
  LIMITED = 'limited',
  FULL = 'full'
}

// Thread access configuration
export interface ThreadAccess {
  threadId: string;
  accessLevel: ContentAccessLevel;
  maxStitches?: number;
}

// User access profile
export interface UserAccessProfile {
  tier: UserTier;
  hasAccessToThreads: string[];
  threadAccessMap: Record<string, ThreadAccess>;
  maxPoints: number | null;
}

/**
 * Get access profile for anonymous users
 * Anonymous users have limited access to free tier threads
 */
export const getAnonymousAccessProfile = (): UserAccessProfile => {
  const threadAccessMap: Record<string, ThreadAccess> = {};
  
  // Set up limited access to each free tier thread
  FREE_TIER_THREAD_IDS.forEach(threadId => {
    threadAccessMap[threadId] = {
      threadId,
      accessLevel: ContentAccessLevel.LIMITED,
      maxStitches: FREE_TIER_STITCH_LIMIT
    };
  });
  
  return {
    tier: 'anonymous',
    hasAccessToThreads: FREE_TIER_THREAD_IDS,
    threadAccessMap,
    maxPoints: 10000 // Same as FREE_TIER_POINT_LIMIT
  };
};

/**
 * Get access profile for free tier users
 * Free users have full access to free tier threads
 */
export const getFreeUserAccessProfile = (): UserAccessProfile => {
  const threadAccessMap: Record<string, ThreadAccess> = {};
  
  // Set up full access to each free tier thread
  FREE_TIER_THREAD_IDS.forEach(threadId => {
    threadAccessMap[threadId] = {
      threadId,
      accessLevel: ContentAccessLevel.FULL,
      maxStitches: undefined // No limit
    };
  });
  
  return {
    tier: 'free',
    hasAccessToThreads: FREE_TIER_THREAD_IDS,
    threadAccessMap,
    maxPoints: null // No limit
  };
};

/**
 * Get access profile for premium subscription users
 * Premium users have full access to all threads and content
 */
export const getPremiumUserAccessProfile = (): UserAccessProfile => {
  // Premium users have access to all threads without limitations
  const threadAccessMap: Record<string, ThreadAccess> = {};
  
  // Set up full access to each free tier thread (and in the future, all threads)
  FREE_TIER_THREAD_IDS.forEach(threadId => {
    threadAccessMap[threadId] = {
      threadId,
      accessLevel: ContentAccessLevel.FULL,
      maxStitches: undefined // No limit
    };
  });
  
  return {
    tier: 'premium',
    hasAccessToThreads: FREE_TIER_THREAD_IDS, // In future, will include premium threads too
    threadAccessMap,
    maxPoints: null // No limit
  };
};

/**
 * Check if a user has premium subscription access
 * @param userId - The user's ID
 * @returns Promise<boolean> - True if the user has premium access
 */
export const hasPremiumAccess = async (userId: string | null): Promise<boolean> => {
  // Non-authenticated users never have premium access
  if (!userId) {
    return false;
  }
  
  try {
    // Import dynamically to avoid circular dependencies
    const { getSubscriptionStatus } = await import('./client/payments');
    const status = await getSubscriptionStatus();
    return status.active;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return false;
  }
};

/**
 * Get user access profile based on authentication status and subscription tier
 * @param isAuthenticated - Whether the user is authenticated
 * @param isPremium - Whether the user has premium subscription access
 */
export const getUserAccessProfile = (
  isAuthenticated: boolean,
  isPremium: boolean = false
): UserAccessProfile => {
  if (!isAuthenticated) {
    return getAnonymousAccessProfile();
  }
  
  if (isPremium) {
    return getPremiumUserAccessProfile();
  }
  
  // Authenticated but non-premium users get free tier access
  return getFreeUserAccessProfile();
};

/**
 * Filter content based on user's access profile
 */
export const filterContentByAccess = (
  threadData: any[],
  accessProfile: UserAccessProfile
): any[] => {
  if (accessProfile.tier === 'anonymous') {
    // Anonymous users get limited content
    return threadData
      // Only include threads in the allowed threads list
      .filter(thread => accessProfile.hasAccessToThreads.includes(thread.id))
      // For each thread, limit the number of stitches if needed
      .map(thread => {
        const threadAccess = accessProfile.threadAccessMap[thread.id];
        
        if (!threadAccess || threadAccess.accessLevel === ContentAccessLevel.NONE) {
          return null; // Skip threads with no access
        }
        
        // If limited access, slice the stitches
        if (threadAccess.accessLevel === ContentAccessLevel.LIMITED && 
            threadAccess.maxStitches !== undefined && 
            thread.stitches) {
          return {
            ...thread,
            stitches: (thread.stitches || [])
              // Sort by position to ensure we get the first N
              .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
              // Take only the allowed number of stitches
              .slice(0, threadAccess.maxStitches)
          };
        }
        
        // Full access - return unchanged
        return thread;
      })
      .filter(Boolean); // Remove null entries
  }
  
  // Free and paid users receive all free tier content without limits
  return threadData.filter(thread => accessProfile.hasAccessToThreads.includes(thread.id));
};

/**
 * Check if a user has reached their tier content limit
 */
export const hasReachedTierLimit = (
  completedStitches: number, 
  totalPoints: number,
  accessProfile: UserAccessProfile
): boolean => {
  // For anonymous users, check both stitch and point limits
  if (accessProfile.tier === 'anonymous') {
    // Check points limit
    if (accessProfile.maxPoints !== null && totalPoints >= accessProfile.maxPoints) {
      return true;
    }
    
    // For anonymous, check if they've completed all available stitches across tubes
    const totalAvailableStitches = FREE_TIER_THREAD_IDS.length * FREE_TIER_STITCH_LIMIT;
    return completedStitches >= totalAvailableStitches;
  }
  
  // Free and paid users don't have content limits
  return false;
};

/**
 * Get content limit message based on user tier and progress
 */
export const getTierLimitMessage = (
  completedStitches: number, 
  totalPoints: number,
  accessProfile: UserAccessProfile
): string | null => {
  // Messages based on user tier
  if (accessProfile.tier === 'anonymous') {
    // Create appropriate message based on progress for anonymous users
    if (accessProfile.maxPoints !== null && totalPoints > accessProfile.maxPoints * 0.8) {
      return `You've earned ${totalPoints} points! Create an account to unlock more content and save your progress.`;
    }
    
    const totalStitchLimit = FREE_TIER_THREAD_IDS.length * FREE_TIER_STITCH_LIMIT;
    if (completedStitches > totalStitchLimit * 0.7) {
      return "You're making great progress! Create an account to unlock the full learning journey.";
    }
    
    return "Create an account to save your progress and access more content.";
  } 
  else if (accessProfile.tier === 'free') {
    // Messages for free users encouraging subscription
    const totalStitchLimit = FREE_TIER_THREAD_IDS.length * FREE_TIER_STITCH_LIMIT;
    
    if (completedStitches > totalStitchLimit * 0.7) {
      return "You're making great progress! Upgrade to Premium to unlock the full learning journey with unlimited stitches.";
    }
    
    return "Upgrade to Premium to unlock all stitches and access advanced content.";
  }
  
  // Premium users don't get limit messages
  return null;
};

/**
 * Get subscription upgrade message for specific content display
 * @param tier - The user's current tier
 * @returns Object with message and action text
 */
export const getUpgradeMessage = (tier: UserTier): { message: string; actionText: string } => {
  if (tier === 'anonymous') {
    return {
      message: `Create an account to save your progress and access more content.`,
      actionText: 'Create Account'
    };
  }
  
  if (tier === 'free') {
    return {
      message: `Unlock all stitches with a premium subscription. 
        Free tier limited to ${FREE_TIER_STITCH_LIMIT} stitches per tube.`,
      actionText: 'Upgrade to Premium'
    };
  }
  
  // Default for premium users (should rarely be shown)
  return {
    message: 'You have full access to all content.',
    actionText: 'View Subscription'
  };
};