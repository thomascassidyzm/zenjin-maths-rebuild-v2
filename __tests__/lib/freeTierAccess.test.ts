/**
 * Free Tier Access Control Tests
 * 
 * This file contains tests for the freeTierAccess module which controls
 * access to premium content based on subscription status.
 */

import { 
  canAccessStitch, 
  hasActiveSubscription,
  getFreeTierPositionLimit,
  filterAccessibleStitches,
  tubeHasFreeContent,
  getAccessRestrictionMessage,
  AccessLevel
} from '../../lib/freeTierAccess';

describe('Free Tier Access Control', () => {
  // Mock subscription status objects
  const activeSubscription = {
    active: true,
    status: 'active',
    subscription: { 
      id: 'sub_123',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    updatedAt: new Date().toISOString()
  };
  
  const freeUser = {
    active: false,
    status: 'none',
    subscription: null,
    updatedAt: null
  };
  
  const adminUser = {
    active: false,
    status: 'admin',
    subscription: null,
    updatedAt: null
  };
  
  const canceledSubscription = {
    active: false,
    status: 'canceled',
    subscription: {
      id: 'sub_123',
      status: 'canceled',
      currentPeriodEnd: new Date().toISOString()
    },
    updatedAt: new Date().toISOString()
  };
  
  describe('canAccessStitch', () => {
    test('grants access to paid users for all content', () => {
      // Test with position within free tier
      const result1 = canAccessStitch('stitch-1', 5, activeSubscription);
      expect(result1.hasAccess).toBe(true);
      expect(result1.accessLevel).toBe(AccessLevel.PAID);
      
      // Test with position outside free tier
      const result2 = canAccessStitch('stitch-2', 15, activeSubscription);
      expect(result2.hasAccess).toBe(true);
      expect(result2.accessLevel).toBe(AccessLevel.PAID);
      
      // Test with very high position
      const result3 = canAccessStitch('stitch-3', 100, activeSubscription);
      expect(result3.hasAccess).toBe(true);
      expect(result3.accessLevel).toBe(AccessLevel.PAID);
    });
    
    test('limits free users to first N stitches based on freeTierStitchLimit', () => {
      // Test with default limit (10)
      
      // Position 0 (first stitch, within free tier)
      const result1 = canAccessStitch('stitch-1', 0, freeUser);
      expect(result1.hasAccess).toBe(true);
      expect(result1.accessLevel).toBe(AccessLevel.FREE);
      expect(result1.isTeaser).toBeUndefined();
      
      // Position 9 (last stitch within free tier)
      const result2 = canAccessStitch('stitch-2', 9, freeUser);
      expect(result2.hasAccess).toBe(true);
      expect(result2.accessLevel).toBe(AccessLevel.FREE);
      expect(result2.isTeaser).toBeUndefined();
      
      // Position 10 (first stitch outside free tier)
      const result3 = canAccessStitch('stitch-3', 10, freeUser, { showTeasers: false });
      expect(result3.hasAccess).toBe(false);
      expect(result3.accessLevel).toBe(AccessLevel.FREE);
      expect(result3.reason).toBeDefined();
      
      // Test with custom limit (5)
      const options = { freeTierStitchLimit: 5 };
      
      // Position 4 (within custom free tier)
      const result4 = canAccessStitch('stitch-4', 4, freeUser, options);
      expect(result4.hasAccess).toBe(true);
      expect(result4.accessLevel).toBe(AccessLevel.FREE);
      
      // Position 5 (outside custom free tier)
      const result5 = canAccessStitch('stitch-5', 5, freeUser, options);
      expect(result5.hasAccess).toBe(true); // True because showTeasers defaults to true
      expect(result5.isTeaser).toBe(true);
      
      // Position 5 with teasers disabled
      const result6 = canAccessStitch('stitch-5', 5, freeUser, { ...options, showTeasers: false });
      expect(result6.hasAccess).toBe(false);
      expect(result6.accessLevel).toBe(AccessLevel.FREE);
    });
    
    test('allows admin access to all content', () => {
      // Test with various positions
      const result1 = canAccessStitch('stitch-1', 5, adminUser);
      expect(result1.hasAccess).toBe(true);
      expect(result1.accessLevel).toBe(AccessLevel.ADMIN);
      
      const result2 = canAccessStitch('stitch-2', 50, adminUser);
      expect(result2.hasAccess).toBe(true);
      expect(result2.accessLevel).toBe(AccessLevel.ADMIN);
      
      const result3 = canAccessStitch('stitch-3', 1000, adminUser);
      expect(result3.hasAccess).toBe(true);
      expect(result3.accessLevel).toBe(AccessLevel.ADMIN);
    });
    
    test('properly handles teaser content based on showTeasers option', () => {
      // Position outside free tier
      const position = 15;
      
      // With teasers enabled (default)
      const result1 = canAccessStitch('stitch-1', position, freeUser);
      expect(result1.hasAccess).toBe(true);
      expect(result1.isTeaser).toBe(true);
      expect(result1.reason).toBeDefined();
      
      // With teasers explicitly enabled
      const result2 = canAccessStitch('stitch-2', position, freeUser, { showTeasers: true });
      expect(result2.hasAccess).toBe(true);
      expect(result2.isTeaser).toBe(true);
      
      // With teasers disabled
      const result3 = canAccessStitch('stitch-3', position, freeUser, { showTeasers: false });
      expect(result3.hasAccess).toBe(false);
      expect(result3.isTeaser).toBeUndefined();
    });
    
    test('handles canceled subscriptions correctly', () => {
      // Users with canceled subscriptions should be treated as free users
      const result = canAccessStitch('stitch-1', 15, canceledSubscription, { showTeasers: false });
      expect(result.hasAccess).toBe(false);
      expect(result.accessLevel).toBe(AccessLevel.FREE);
    });
  });
  
  describe('hasActiveSubscription', () => {
    test('returns true for active subscriptions', () => {
      expect(hasActiveSubscription(activeSubscription)).toBe(true);
    });
    
    test('returns false for free users', () => {
      expect(hasActiveSubscription(freeUser)).toBe(false);
    });
    
    test('returns false for admin users without subscription', () => {
      expect(hasActiveSubscription(adminUser)).toBe(false);
    });
    
    test('returns false for canceled subscriptions', () => {
      expect(hasActiveSubscription(canceledSubscription)).toBe(false);
    });
    
    test('handles null subscription status', () => {
      expect(hasActiveSubscription(null)).toBe(false);
    });
  });
  
  describe('getFreeTierPositionLimit', () => {
    test('returns correct position limit for default settings', () => {
      // Default limit is 10, so position limit is 9 (0-based)
      expect(getFreeTierPositionLimit(1)).toBe(9);
      expect(getFreeTierPositionLimit(2)).toBe(9);
      expect(getFreeTierPositionLimit(3)).toBe(9);
    });
    
    test('returns correct position limit for custom settings', () => {
      const options = { freeTierStitchLimit: 5 };
      expect(getFreeTierPositionLimit(1, options)).toBe(4); // 5 stitches = positions 0-4
      
      const options2 = { freeTierStitchLimit: 1 };
      expect(getFreeTierPositionLimit(1, options2)).toBe(0); // 1 stitch = position 0 only
      
      const options3 = { freeTierStitchLimit: 0 };
      expect(getFreeTierPositionLimit(1, options3)).toBe(-1); // No free stitches
    });
    
    test('works with different tube numbers', () => {
      // The tube number shouldn't affect the limit, but test to make sure
      expect(getFreeTierPositionLimit(1)).toBe(9);
      expect(getFreeTierPositionLimit(2)).toBe(9);
      expect(getFreeTierPositionLimit(3)).toBe(9);
    });
  });
  
  describe('filterAccessibleStitches', () => {
    // Create test stitches
    const stitches = [
      { id: 'stitch-1', position: 0 },
      { id: 'stitch-2', position: 5 },
      { id: 'stitch-3', position: 9 },
      { id: 'stitch-4', position: 10 },
      { id: 'stitch-5', position: 15 }
    ];
    
    test('filters stitches correctly for paid users', () => {
      const result = filterAccessibleStitches(stitches, activeSubscription);
      
      // All stitches should be accessible
      expect(result.length).toBe(5);
      
      // All should have access info
      result.forEach(stitch => {
        expect(stitch.accessInfo).toBeDefined();
        expect(stitch.accessInfo.hasAccess).toBe(true);
        expect(stitch.accessInfo.accessLevel).toBe(AccessLevel.PAID);
      });
    });
    
    test('filters stitches correctly for free users', () => {
      // With teasers disabled
      const result1 = filterAccessibleStitches(stitches, freeUser, { showTeasers: false });
      
      // Only first 3 stitches should be accessible (positions 0, 5, 9)
      expect(result1.length).toBe(3);
      
      // Check specific stitches
      expect(result1[0].id).toBe('stitch-1');
      expect(result1[1].id).toBe('stitch-2');
      expect(result1[2].id).toBe('stitch-3');
      
      // All returned stitches should have access info
      result1.forEach(stitch => {
        expect(stitch.accessInfo).toBeDefined();
        expect(stitch.accessInfo.hasAccess).toBe(true);
        expect(stitch.accessInfo.accessLevel).toBe(AccessLevel.FREE);
      });
      
      // With teasers enabled
      const result2 = filterAccessibleStitches(stitches, freeUser, { showTeasers: true });
      
      // All stitches should be accessible
      expect(result2.length).toBe(5);
      
      // First 3 should be regular content
      expect(result2[0].accessInfo.isTeaser).toBeUndefined();
      expect(result2[1].accessInfo.isTeaser).toBeUndefined();
      expect(result2[2].accessInfo.isTeaser).toBeUndefined();
      
      // Last 2 should be teasers
      expect(result2[3].accessInfo.isTeaser).toBe(true);
      expect(result2[4].accessInfo.isTeaser).toBe(true);
    });
    
    test('filters stitches correctly for custom free tier limit', () => {
      const options = { freeTierStitchLimit: 2, showTeasers: false };
      const result = filterAccessibleStitches(stitches, freeUser, options);
      
      // Only 1 stitch should be accessible (position 0)
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('stitch-1');
    });
    
    test('filters stitches correctly for admins', () => {
      const result = filterAccessibleStitches(stitches, adminUser);
      
      // All stitches should be accessible
      expect(result.length).toBe(5);
      
      // All should have admin access level
      result.forEach(stitch => {
        expect(stitch.accessInfo.accessLevel).toBe(AccessLevel.ADMIN);
      });
    });
  });
  
  describe('tubeHasFreeContent', () => {
    test('returns true when tube has stitches and free tier limit > 0', () => {
      expect(tubeHasFreeContent(1, 20)).toBe(true);
      expect(tubeHasFreeContent(2, 5)).toBe(true);
      expect(tubeHasFreeContent(3, 1)).toBe(true);
    });
    
    test('returns false when tube has no stitches', () => {
      expect(tubeHasFreeContent(1, 0)).toBe(false);
    });
    
    test('returns false when free tier limit is 0', () => {
      expect(tubeHasFreeContent(1, 20, { freeTierStitchLimit: 0 })).toBe(false);
    });
    
    test('handles different tube numbers correctly', () => {
      expect(tubeHasFreeContent(1, 20)).toBe(true);
      expect(tubeHasFreeContent(2, 20)).toBe(true);
      expect(tubeHasFreeContent(3, 20)).toBe(true);
    });
  });
  
  describe('getAccessRestrictionMessage', () => {
    test('returns empty string for accessible non-teaser content', () => {
      const result = {
        hasAccess: true,
        accessLevel: AccessLevel.FREE
      };
      
      expect(getAccessRestrictionMessage(result)).toBe('');
    });
    
    test('returns teaser message for teaser content', () => {
      const result = {
        hasAccess: true,
        accessLevel: AccessLevel.FREE,
        isTeaser: true,
        reason: 'This is a preview of premium content'
      };
      
      expect(getAccessRestrictionMessage(result)).toContain('preview');
      expect(getAccessRestrictionMessage(result)).toContain('Subscribe');
    });
    
    test('returns restriction reason for inaccessible content', () => {
      const result = {
        hasAccess: false,
        accessLevel: AccessLevel.FREE,
        reason: 'This content requires a subscription'
      };
      
      expect(getAccessRestrictionMessage(result)).toBe('This content requires a subscription');
    });
    
    test('returns default message when no reason provided', () => {
      const result = {
        hasAccess: false,
        accessLevel: AccessLevel.FREE
      };
      
      expect(getAccessRestrictionMessage(result)).toContain('subscription');
      expect(getAccessRestrictionMessage(result)).toContain('unlock');
    });
  });
});