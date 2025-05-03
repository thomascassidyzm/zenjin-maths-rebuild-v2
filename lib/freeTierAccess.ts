/**
 * Free Tier Access Control
 * 
 * This module provides utilities for controlling access to premium content
 * and enforcing the free tier limitations (first 10 stitches in each tube).
 */

import { SubscriptionStatusResponse } from './client/payments';

/**
 * User access level types
 */
export enum AccessLevel {
  FREE = 'free',
  PAID = 'paid',
  ADMIN = 'admin'
}

/**
 * Options for content access evaluation
 */
export interface ContentAccessOptions {
  /**
   * Maximum number of stitches available in each tube for free tier users
   * Default: 10
   */
  freeTierStitchLimit?: number;
  
  /**
   * Whether to show teaser content for premium stitches to free users
   * Default: true
   */
  showTeasers?: boolean;
}

/**
 * Response from access check
 */
export interface AccessCheckResult {
  /**
   * Whether the user has access to the content
   */
  hasAccess: boolean;
  
  /**
   * The user's current access level
   */
  accessLevel: AccessLevel;
  
  /**
   * If access is denied, the reason why
   */
  reason?: string;
  
  /**
   * Whether this is teaser content (free tier preview of premium content)
   */
  isTeaser?: boolean;
}

/**
 * Check if a stitch is accessible based on subscription status
 * 
 * @param stitchId - The ID of the stitch to check
 * @param positionInTube - The position of the stitch in its tube (0-based)
 * @param subscriptionStatus - The user's subscription status
 * @param options - Access control options
 * @returns Access check result
 */
export function canAccessStitch(
  stitchId: string,
  positionInTube: number,
  subscriptionStatus: SubscriptionStatusResponse | null,
  options: ContentAccessOptions = {}
): AccessCheckResult {
  // Default options
  const freeTierLimit = options.freeTierStitchLimit ?? 10;
  const showTeasers = options.showTeasers ?? true;
  
  // Admin users always have access
  if (subscriptionStatus?.status === 'admin') {
    return {
      hasAccess: true,
      accessLevel: AccessLevel.ADMIN
    };
  }
  
  // Subscription is active - full access
  if (subscriptionStatus?.active && subscriptionStatus.subscription) {
    return {
      hasAccess: true,
      accessLevel: AccessLevel.PAID
    };
  }
  
  // Free tier access - limited to first 10 stitches in each tube
  if (positionInTube < freeTierLimit) {
    return {
      hasAccess: true,
      accessLevel: AccessLevel.FREE
    };
  }
  
  // Teaser access for premium stitches
  if (showTeasers) {
    return {
      hasAccess: true,
      accessLevel: AccessLevel.FREE,
      isTeaser: true,
      reason: 'This is a preview of premium content'
    };
  }
  
  // Access denied
  return {
    hasAccess: false,
    accessLevel: AccessLevel.FREE,
    reason: 'This content requires a subscription'
  };
}

/**
 * Check if a tube has free tier content available
 * 
 * @param tubeNumber - The tube number
 * @param stitchCount - The number of stitches in the tube
 * @param options - Access control options
 * @returns Whether the tube has free content
 */
export function tubeHasFreeContent(
  tubeNumber: number,
  stitchCount: number,
  options: ContentAccessOptions = {}
): boolean {
  const freeTierLimit = options.freeTierStitchLimit ?? 10;
  return stitchCount > 0 && freeTierLimit > 0;
}

/**
 * Filter a list of stitches based on subscription status
 * 
 * @param stitches - Array of stitches
 * @param subscriptionStatus - The user's subscription status
 * @param options - Access control options
 * @returns Filtered stitches with access information
 */
export function filterAccessibleStitches<T extends { id: string; position: number }>(
  stitches: T[],
  subscriptionStatus: SubscriptionStatusResponse | null,
  options: ContentAccessOptions = {}
): (T & { accessInfo: AccessCheckResult })[] {
  return stitches.map(stitch => {
    const accessInfo = canAccessStitch(
      stitch.id,
      stitch.position,
      subscriptionStatus,
      options
    );
    
    return {
      ...stitch,
      accessInfo
    };
  }).filter(stitch => stitch.accessInfo.hasAccess);
}

/**
 * Check if user has an active subscription
 * 
 * @param subscriptionStatus - The user's subscription status
 * @returns Whether the user has an active subscription
 */
export function hasActiveSubscription(
  subscriptionStatus: SubscriptionStatusResponse | null
): boolean {
  return !!(
    subscriptionStatus?.active && 
    subscriptionStatus.subscription &&
    subscriptionStatus.status === 'active'
  );
}

/**
 * Get the position-based free tier limit for a specific tube
 * 
 * @param tubeNumber - The tube number
 * @param options - Access control options
 * @returns The maximum position accessible in free tier
 */
export function getFreeTierPositionLimit(
  tubeNumber: number,
  options: ContentAccessOptions = {}
): number {
  const freeTierLimit = options.freeTierStitchLimit ?? 10;
  return freeTierLimit - 1; // Convert to 0-based position
}

/**
 * Get an explanation message for why content is restricted
 * 
 * @param accessResult - The result of an access check
 * @returns User-friendly explanation message
 */
export function getAccessRestrictionMessage(
  accessResult: AccessCheckResult
): string {
  if (accessResult.hasAccess) {
    if (accessResult.isTeaser) {
      return 'You are viewing a preview of this premium content. Subscribe to unlock the full experience.';
    }
    return ''; // No message needed for accessible content
  }
  
  return accessResult.reason || 'This content requires a subscription. Subscribe to unlock all content.';
}