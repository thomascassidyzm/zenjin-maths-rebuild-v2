import {
  getUserAccessProfile,
  getAnonymousAccessProfile,
  getFreeUserAccessProfile,
  filterContentByAccess,
  hasReachedTierLimit,
  getTierLimitMessage,
  ContentAccessLevel
} from '../../lib/tier-manager';
import { FREE_TIER_THREAD_IDS, FREE_TIER_STITCH_LIMIT } from '../../lib/constants/free-tier';

describe('User Tier Manager', () => {
  describe('Access Profiles', () => {
    it('should provide anonymous access profile for unauthenticated users', () => {
      const profile = getUserAccessProfile(false);
      
      expect(profile.tier).toBe('anonymous');
      expect(profile.hasAccessToThreads).toEqual(FREE_TIER_THREAD_IDS);
      expect(profile.maxPoints).toBe(10000);
      
      // Verify thread access is LIMITED
      FREE_TIER_THREAD_IDS.forEach(threadId => {
        expect(profile.threadAccessMap[threadId].accessLevel).toBe(ContentAccessLevel.LIMITED);
        expect(profile.threadAccessMap[threadId].maxStitches).toBe(FREE_TIER_STITCH_LIMIT);
      });
    });
    
    it('should provide free tier access profile for authenticated users', () => {
      const profile = getUserAccessProfile(true);
      
      expect(profile.tier).toBe('free');
      expect(profile.hasAccessToThreads).toEqual(FREE_TIER_THREAD_IDS);
      expect(profile.maxPoints).toBeNull(); // No points limit
      
      // Verify thread access is FULL
      FREE_TIER_THREAD_IDS.forEach(threadId => {
        expect(profile.threadAccessMap[threadId].accessLevel).toBe(ContentAccessLevel.FULL);
        expect(profile.threadAccessMap[threadId].maxStitches).toBeUndefined(); // No stitch limit
      });
    });
  });
  
  describe('Content Filtering', () => {
    const sampleThreadData = [
      {
        id: 'thread-A',
        name: 'Thread A',
        stitches: Array.from({ length: 10 }, (_, i) => ({
          id: `stitch-A-${i}`,
          position: i
        }))
      },
      {
        id: 'thread-B',
        name: 'Thread B',
        stitches: Array.from({ length: 10 }, (_, i) => ({
          id: `stitch-B-${i}`,
          position: i
        }))
      },
      {
        id: 'thread-X', // Not in free tier
        name: 'Thread X',
        stitches: Array.from({ length: 10 }, (_, i) => ({
          id: `stitch-X-${i}`,
          position: i
        }))
      }
    ];
    
    it('should limit content for anonymous users', () => {
      const anonymousProfile = getAnonymousAccessProfile();
      const filteredContent = filterContentByAccess(sampleThreadData, anonymousProfile);
      
      // Should only include free tier threads
      expect(filteredContent.length).toBe(2); // thread-A and thread-B
      expect(filteredContent.map(t => t.id)).toEqual(['thread-A', 'thread-B']);
      
      // Each thread should have limited stitches
      filteredContent.forEach(thread => {
        expect(thread.stitches.length).toBe(FREE_TIER_STITCH_LIMIT);
      });
    });
    
    it('should provide full free tier content for free users', () => {
      const freeProfile = getFreeUserAccessProfile();
      const filteredContent = filterContentByAccess(sampleThreadData, freeProfile);
      
      // Should only include free tier threads
      expect(filteredContent.length).toBe(2); // thread-A and thread-B
      expect(filteredContent.map(t => t.id)).toEqual(['thread-A', 'thread-B']);
      
      // Each thread should have all stitches
      filteredContent.forEach(thread => {
        expect(thread.stitches.length).toBe(10); // All stitches
      });
    });
  });
  
  describe('Tier Limits', () => {
    it('should identify when anonymous users reach content limits', () => {
      const anonymousProfile = getAnonymousAccessProfile();
      
      // Points limit
      expect(hasReachedTierLimit(5, 10001, anonymousProfile)).toBe(true);
      
      // Stitch limit (assuming 3 free tier threads with 5 stitches each = 15 total)
      expect(hasReachedTierLimit(15, 5000, anonymousProfile)).toBe(true);
      
      // Below limits
      expect(hasReachedTierLimit(10, 5000, anonymousProfile)).toBe(false);
    });
    
    it('should never indicate limits for free users', () => {
      const freeProfile = getFreeUserAccessProfile();
      
      // Free users don't have limits
      expect(hasReachedTierLimit(100, 50000, freeProfile)).toBe(false);
    });
  });
  
  describe('Limit Messages', () => {
    it('should provide appropriate messages for anonymous users', () => {
      const anonymousProfile = getAnonymousAccessProfile();
      
      // Near points limit
      const pointsMessage = getTierLimitMessage(5, 9000, anonymousProfile);
      expect(pointsMessage).toContain("You've earned 9000 points");
      
      // Near stitch limit
      const stitchMessage = getTierLimitMessage(12, 5000, anonymousProfile);
      expect(stitchMessage).toContain("You're making great progress");
      
      // Default message
      const defaultMessage = getTierLimitMessage(5, 3000, anonymousProfile);
      expect(defaultMessage).toContain("Create an account to save your progress");
    });
    
    it('should not provide limit messages for free users', () => {
      const freeProfile = getFreeUserAccessProfile();
      
      // Free users don't get limit messages
      expect(getTierLimitMessage(100, 50000, freeProfile)).toBeNull();
    });
  });
});