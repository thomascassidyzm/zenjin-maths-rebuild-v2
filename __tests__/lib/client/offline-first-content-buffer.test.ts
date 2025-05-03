/**
 * Offline-First Content Buffer Tests
 * 
 * Tests the offline-first content buffer implementation that handles bundled content
 * and provides immediate startup without loading screens.
 */

import { OfflineFirstContentBuffer } from '../../../lib/client/offline-first-content-buffer';
import { BUNDLED_FULL_CONTENT } from '../../../lib/expanded-bundled-content';

// Mock feature flags
jest.mock('../../../lib/feature-flags', () => ({
  getFeatureFlags: jest.fn().mockReturnValue({
    offlineFirstStartup: true,
    useBundledContentForFreeUsers: true,
    useBundledContentForAnonymous: true
  })
}));

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key]),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    _getStore: () => store
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch
global.fetch = jest.fn();

// Mock bundled content
jest.mock('../../../lib/expanded-bundled-content', () => {
  // Create mock bundled content
  const mockStitches = {};
  
  // Generate 30 mock stitches (10 per tube)
  for (let tube = 1; tube <= 3; tube++) {
    for (let i = 1; i <= 10; i++) {
      const paddedNumber = i.toString().padStart(2, '0');
      const stitchId = `stitch-T${tube}-001-${paddedNumber}`;
      
      mockStitches[stitchId] = {
        id: stitchId,
        threadId: `thread-T${tube}-001`,
        title: `Test Stitch ${tube}-${paddedNumber}`,
        content: `Content for stitch ${tube}-${paddedNumber}`,
        tubeNumber: tube,
        questions: [
          {
            id: `${stitchId}-q1`,
            text: `Question 1 for ${stitchId}`,
            correctAnswer: 'Correct',
            distractors: { L1: 'Wrong1', L2: 'Wrong2', L3: 'Wrong3' }
          },
          {
            id: `${stitchId}-q2`,
            text: `Question 2 for ${stitchId}`,
            correctAnswer: 'Correct',
            distractors: { L1: 'Wrong1', L2: 'Wrong2', L3: 'Wrong3' }
          }
        ]
      };
    }
  }
  
  return {
    BUNDLED_FULL_CONTENT: mockStitches
  };
});

describe('OfflineFirstContentBuffer', () => {
  let contentBuffer: OfflineFirstContentBuffer;
  
  // Mock user state for testing
  const mockUserState = {
    userId: 'test-user',
    activeTubeNumber: 1,
    tubes: {
      1: {
        threadId: 'thread-T1-001',
        currentStitchId: 'stitch-T1-001-01',
        stitches: [
          { id: 'stitch-T1-001-01', position: 0 },
          { id: 'stitch-T1-001-02', position: 1 }
        ]
      },
      2: {
        threadId: 'thread-T2-001',
        currentStitchId: 'stitch-T2-001-01',
        stitches: [
          { id: 'stitch-T2-001-01', position: 0 }
        ]
      },
      3: {
        threadId: 'thread-T3-001',
        currentStitchId: 'stitch-T3-001-01',
        stitches: [
          { id: 'stitch-T3-001-01', position: 0 }
        ]
      }
    }
  };
  
  // Mock manifest for testing
  const mockManifest = {
    version: 1,
    generated: '2025-05-02T12:00:00Z',
    tubes: {
      1: {
        threads: {
          'thread-T1-001': {
            title: 'Test Thread 1',
            stitches: Array.from({ length: 20 }, (_, i) => ({
              id: `stitch-T1-001-${(i + 1).toString().padStart(2, '0')}`,
              order: i + 1,
              title: `Test Stitch 1-${i + 1}`
            }))
          }
        }
      },
      2: {
        threads: {
          'thread-T2-001': {
            title: 'Test Thread 2',
            stitches: Array.from({ length: 20 }, (_, i) => ({
              id: `stitch-T2-001-${(i + 1).toString().padStart(2, '0')}`,
              order: i + 1,
              title: `Test Stitch 2-${i + 1}`
            }))
          }
        }
      },
      3: {
        threads: {
          'thread-T3-001': {
            title: 'Test Thread 3',
            stitches: Array.from({ length: 20 }, (_, i) => ({
              id: `stitch-T3-001-${(i + 1).toString().padStart(2, '0')}`,
              order: i + 1,
              title: `Test Stitch 3-${i + 1}`
            }))
          }
        }
      }
    },
    stats: {
      tubeCount: 3,
      threadCount: 3,
      stitchCount: 60
    }
  };
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    localStorageMock.clear();
    
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
    
    // Mock successful loading of manifest
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, manifest: mockManifest })
      })
    );
    
    // Create a new instance for each test
    contentBuffer = new OfflineFirstContentBuffer();
  });
  
  test('should initialize with bundled content immediately', () => {
    // Bundled content should be loaded in constructor
    expect(contentBuffer.getBundledContentCount()).toBeGreaterThan(0);
    
    // No fetch calls should happen during initialization
    expect(global.fetch).not.toHaveBeenCalled();
  });
  
  test('initialize should load the manifest', async () => {
    // Call initialize
    const result = await contentBuffer.initialize();
    
    // Should return true
    expect(result).toBe(true);
    
    // Should call fetch once with the manifest URL
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/content/manifest');
    
    // Manifest should be loaded
    expect(contentBuffer.getManifest()).toEqual(mockManifest);
  });
  
  test('should load bundled content without fetch', async () => {
    // Get a stitch that's in the bundled content
    const stitch = await contentBuffer.getStitch('stitch-T1-001-01');
    
    // Should return the stitch from bundled content
    expect(stitch).toBeDefined();
    expect(stitch?.id).toBe('stitch-T1-001-01');
    
    // Should not call fetch
    expect(global.fetch).not.toHaveBeenCalled();
  });
  
  test('should return in-play stitch immediately', async () => {
    // Get the in-play stitch
    const stitch = await contentBuffer.getInPlayStitch(mockUserState);
    
    // Should return the stitch from bundled content
    expect(stitch).toBeDefined();
    expect(stitch?.id).toBe('stitch-T1-001-01');
    
    // Should not call fetch
    expect(global.fetch).not.toHaveBeenCalled();
  });
  
  test('should fall back to API for non-bundled content', async () => {
    // Mock fetch response for a non-bundled stitch
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          stitches: [{
            id: 'stitch-T1-001-20',
            threadId: 'thread-T1-001',
            title: 'Non-bundled stitch',
            content: 'This stitch is not in the bundled content',
            questions: []
          }] 
        })
      })
    );
    
    // Get a stitch that's not in the bundled content
    const stitch = await contentBuffer.getStitch('stitch-T1-001-20');
    
    // Should fetch from API for non-bundled content
    expect(global.fetch).toHaveBeenCalledTimes(1);
    
    // Should return the stitch from API
    expect(stitch).toBeDefined();
    expect(stitch?.id).toBe('stitch-T1-001-20');
  });
  
  test('should update buffer with optimized batching', async () => {
    // Initialize the buffer
    await contentBuffer.initialize();
    
    // Mock fetch response for batch API
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          stitches: [
            {
              id: 'stitch-T1-001-11',
              threadId: 'thread-T1-001',
              title: 'Non-bundled stitch 11',
              content: 'This stitch is not in the bundled content',
              questions: []
            },
            {
              id: 'stitch-T1-001-12',
              threadId: 'thread-T1-001',
              title: 'Non-bundled stitch 12',
              content: 'This stitch is not in the bundled content',
              questions: []
            }
          ] 
        })
      })
    );
    
    // Create a user state with non-bundled stitches
    const testState = {
      ...mockUserState,
      tubes: {
        ...mockUserState.tubes,
        1: {
          ...mockUserState.tubes[1],
          currentStitchId: 'stitch-T1-001-11',
          stitches: [
            { id: 'stitch-T1-001-11', position: 0 },
            { id: 'stitch-T1-001-12', position: 1 }
          ]
        }
      }
    };
    
    // Update the buffer
    await contentBuffer.updateBuffer(testState);
    
    // Should fetch only non-bundled stitches
    expect(global.fetch).toHaveBeenCalledTimes(1);
    
    // Should make a batch request
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    expect(fetchCall[0]).toBe('/api/content/batch');
    
    // Call body should include the missing stitch IDs
    const requestBody = JSON.parse(fetchCall[1].body);
    expect(requestBody.stitchIds).toContain('stitch-T1-001-11');
    expect(requestBody.stitchIds).toContain('stitch-T1-001-12');
    
    // Bundled stitches should not be fetched
    expect(requestBody.stitchIds).not.toContain('stitch-T1-001-01');
  });
  
  test('should generate fallback stitch when content not available', async () => {
    // Mock fetch failure
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ success: false })
      })
    );
    
    // Get a stitch that doesn't exist
    const stitch = await contentBuffer.getStitch('non-existent-stitch');
    
    // Should return a fallback stitch
    expect(stitch).toBeDefined();
    expect(stitch?.id).toBe('non-existent-stitch');
    expect(stitch?.title).toContain('Missing Content');
    expect(stitch?.questions?.length).toBeGreaterThan(0);
  });
  
  test('should handle anonymous user state correctly', async () => {
    // Set user state as anonymous
    contentBuffer.setUserType('anonymous');
    
    // Mock fetch for this test to ensure it doesn't get called
    const fetchSpy = jest.spyOn(global, 'fetch');
    
    // Get a non-bundled stitch (would normally require API call)
    const stitch = await contentBuffer.getStitch('stitch-T1-001-20');
    
    // For anonymous users with flag enabled, should generate fallback content
    // rather than making API calls
    expect(fetchSpy).not.toHaveBeenCalled();
    
    // Should return a fallback stitch
    expect(stitch).toBeDefined();
    expect(stitch?.id).toBe('stitch-T1-001-20');
    expect(stitch?.questions?.length).toBeGreaterThan(0);
  });
  
  test('should persist upcoming stitches to localStorage', async () => {
    // Initialize the buffer
    await contentBuffer.initialize();
    
    // Update buffer for user state
    await contentBuffer.updateBuffer(mockUserState);
    
    // Should save to localStorage
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'zenjin_content_cache',
      expect.any(String)
    );
    
    // Check that cached data includes the needed stitches
    const cachedData = JSON.parse(localStorageMock._getStore().zenjin_content_cache || '{}');
    expect(cachedData.stitches).toBeDefined();
    expect(Object.keys(cachedData.stitches).length).toBeGreaterThan(0);
  });
  
  test('should load cached stitches from localStorage on initialization', () => {
    // Set up mock cached data in localStorage
    const mockCachedData = {
      timestamp: Date.now(),
      stitches: {
        'cached-stitch-1': {
          id: 'cached-stitch-1',
          threadId: 'thread-T1-001',
          title: 'Cached Stitch 1',
          content: 'This stitch was cached in localStorage',
          questions: []
        }
      }
    };
    
    localStorageMock.setItem('zenjin_content_cache', JSON.stringify(mockCachedData));
    
    // Create a new content buffer which should load from localStorage
    const newBuffer = new OfflineFirstContentBuffer();
    
    // Get the cached stitch
    newBuffer.getStitch('cached-stitch-1').then(stitch => {
      // Should return the stitch from localStorage cache
      expect(stitch).toBeDefined();
      expect(stitch?.id).toBe('cached-stitch-1');
      expect(stitch?.title).toBe('Cached Stitch 1');
      
      // Should not call fetch
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
  
  test('should clear cache when requested', async () => {
    // Initialize the buffer and load a stitch
    await contentBuffer.initialize();
    const stitch = await contentBuffer.getStitch('stitch-T1-001-01');
    
    // Clear the cache
    contentBuffer.clearCache();
    
    // Set up fetch mock for the next request
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          stitches: [{
            id: 'stitch-T1-001-01',
            threadId: 'thread-T1-001',
            title: 'Reloaded stitch',
            content: 'This stitch was reloaded after cache clear',
            questions: []
          }] 
        })
      })
    );
    
    // Try to get the same stitch again - should use bundled content, not fetch
    const reloadedStitch = await contentBuffer.getStitch('stitch-T1-001-01');
    
    // Should still return from bundled content, not make a fetch call
    expect(reloadedStitch).toBeDefined();
    expect(reloadedStitch?.id).toBe('stitch-T1-001-01');
    expect(global.fetch).not.toHaveBeenCalled();
    
    // But localStorage cache should be cleared
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('zenjin_content_cache');
  });
});