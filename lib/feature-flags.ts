/**
 * Feature Flags
 * 
 * Central location for all feature flags used in the application.
 * This allows for easy toggling of features during development and rollout.
 */

// Feature flag types
export interface FeatureFlags {
  // Content delivery features
  useBundledContentForFreeUsers: boolean;  // Use bundled content for free users
  useInfinitePlayMode: boolean;            // Enable infinite play mode cycling
  
  // Authentication features
  allowAnonymousUsers: boolean;            // Allow anonymous usage
  
  // Player features
  showDebugInfo: boolean;                 // Show debug information in the player
}

// Default feature flags
const defaultFlags: FeatureFlags = {
  // Content delivery - default to ON
  useBundledContentForFreeUsers: true,
  useInfinitePlayMode: true,
  
  // Authentication - default to ON
  allowAnonymousUsers: true,
  
  // Player - default to OFF in production, ON in development
  showDebugInfo: process.env.NODE_ENV !== 'production'
};

// Environment-specific overrides
// These can be driven by environment variables or build configuration
const environmentOverrides: Partial<FeatureFlags> = {
  // Override any default flags based on environment variables
  // For example:
  useBundledContentForFreeUsers: process.env.USE_BUNDLED_CONTENT !== 'false',
  useInfinitePlayMode: process.env.USE_INFINITE_PLAY !== 'false'
};

// User-specific overrides
// These can be used to enable features for specific users
const userOverrides: Record<string, Partial<FeatureFlags>> = {
  // Example: Enable debug info for a specific user
  'admin@example.com': {
    showDebugInfo: true
  }
};

/**
 * Get feature flags for a specific user
 * @param user The user object (or null for anonymous)
 * @returns The feature flags applicable to this user
 */
export function getFeatureFlags(user: any = null): FeatureFlags {
  // Start with default flags
  const flags = { ...defaultFlags };
  
  // Apply environment overrides
  Object.assign(flags, environmentOverrides);
  
  // Apply user-specific overrides if available
  if (user?.email && userOverrides[user.email]) {
    Object.assign(flags, userOverrides[user.email]);
  }
  
  // Apply role-based overrides
  if (user?.role === 'admin' || user?.isAdmin) {
    flags.showDebugInfo = true;
  }
  
  return flags;
}

/**
 * Check if a specific feature is enabled for a user
 * @param feature The feature to check
 * @param user The user object (or null for anonymous)
 * @returns True if the feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags, user: any = null): boolean {
  return getFeatureFlags(user)[feature];
}