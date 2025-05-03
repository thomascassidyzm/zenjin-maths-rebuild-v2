/**
 * Free Tier Content Constants
 * 
 * This file defines the limits and configuration for anonymous users
 * who are playing without an account.
 */

// Maximum number of stitches per tube for free tier
export const FREE_TIER_STITCH_LIMIT = 5;

// Maximum points that can be accumulated in free tier
export const FREE_TIER_POINT_LIMIT = 10000;

// Thread IDs that are included in free tier
export const FREE_TIER_THREAD_IDS = [
  'thread-A',  // Number facts
  'thread-B',  // Basic operations
  'thread-C'   // Simple problem solving
];

// Whether to enforce strict content limits for free tier
export const ENFORCE_FREE_TIER_LIMITS = false;

// Helper function to check if a thread is in the free tier
export const isThreadInFreeTier = (threadId: string): boolean => {
  return FREE_TIER_THREAD_IDS.includes(threadId);
};

// Helper function to check if a stitch is in the free tier based on its index/position
export const isStitchInFreeTier = (stitchPosition: number): boolean => {
  return stitchPosition < FREE_TIER_STITCH_LIMIT;
};

// Helper function to filter thread data to only include free tier content
export const filterToFreeTierContent = (threadData: any[]): any[] => {
  if (!ENFORCE_FREE_TIER_LIMITS) {
    return threadData; // Return all content if limits aren't enforced
  }

  return threadData
    // Only include threads in the free tier
    .filter(thread => isThreadInFreeTier(thread.id))
    // For each thread, limit the number of stitches
    .map(thread => ({
      ...thread,
      stitches: (thread.stitches || [])
        // Sort by position to ensure we get the first N
        .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
        // Take only the first N stitches
        .slice(0, FREE_TIER_STITCH_LIMIT)
    }));
};