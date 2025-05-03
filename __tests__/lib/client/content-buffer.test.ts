import { ContentBufferManager, StitchContent, ContentManifest } from '../../../lib/client/content-buffer';

// Mock fetch globally
global.fetch = jest.fn();

describe('ContentBufferManager', () => {
  let contentBuffer: ContentBufferManager;
  
  // Create a mock manifest for testing
  const mockManifest: ContentManifest = {
    version: 1,
    generated: '2025-05-02T12:00:00Z',
    tubes: {
      1: {
        threads: {
          'thread-T1-001': {
            title: 'Number Facts',
            stitches: [
              { id: 'stitch-T1-001-01', order: 1, title: 'Addition Facts' },
              { id: 'stitch-T1-001-02', order: 2, title: 'Subtraction Facts' },
              { id: 'stitch-T1-001-03', order: 3, title: 'Multiplication Facts' },
              { id: 'stitch-T1-001-04', order: 4, title: 'Division Facts' },
              { id: 'stitch-T1-001-05', order: 5, title: 'Mixed Facts' },
            ]
          }
        }
      },
      2: {
        threads: {
          'thread-T2-001': {
            title: 'Basic Operations',
            stitches: [
              { id: 'stitch-T2-001-01', order: 1, title: 'Addition' },
              { id: 'stitch-T2-001-02', order: 2, title: 'Subtraction' },
              { id: 'stitch-T2-001-03', order: 3, title: 'Multiplication' },
              { id: 'stitch-T2-001-04', order: 4, title: 'Division' },
              { id: 'stitch-T2-001-05', order: 5, title: 'Mixed Operations' },
            ]
          }
        }
      },
      3: {
        threads: {
          'thread-T3-001': {
            title: 'Problem Solving',
            stitches: [
              { id: 'stitch-T3-001-01', order: 1, title: 'Word Problems' },
              { id: 'stitch-T3-001-02', order: 2, title: 'Logic Problems' },
              { id: 'stitch-T3-001-03', order: 3, title: 'Pattern Problems' },
              { id: 'stitch-T3-001-04', order: 4, title: 'Geometry Problems' },
              { id: 'stitch-T3-001-05', order: 5, title: 'Mixed Problems' },
            ]
          }
        }
      }
    },
    stats: {
      tubeCount: 3,
      threadCount: 3,
      stitchCount: 15
    }
  };

  // Mock stitch data for testing
  const mockStitches: Record<string, StitchContent> = {
    'stitch-T1-001-01': {
      id: 'stitch-T1-001-01',
      threadId: 'thread-T1-001',
      title: 'Addition Facts',
      content: 'Learn addition facts',
      order: 1,
      questions: [
        {
          id: 'q1',
          text: 'What is 2 + 2?',
          correctAnswer: '4',
          distractors: { L1: '3', L2: '5', L3: '22' }
        }
      ]
    },
    'stitch-T1-001-02': {
      id: 'stitch-T1-001-02',
      threadId: 'thread-T1-001',
      title: 'Subtraction Facts',
      content: 'Learn subtraction facts',
      order: 2,
      questions: [
        {
          id: 'q1',
          text: 'What is 5 - 3?',
          correctAnswer: '2',
          distractors: { L1: '3', L2: '1', L3: '8' }
        }
      ]
    }
  };

  // Create a mock user state for testing
  const mockUserState = {
    userId: 'test-user',
    tubes: {
      1: {
        threadId: 'thread-T1-001',
        currentStitchId: 'stitch-T1-001-01',
        position: 0
      },
      2: {
        threadId: 'thread-T2-001',
        currentStitchId: 'stitch-T2-001-01',
        position: 0
      },
      3: {
        threadId: 'thread-T3-001',
        currentStitchId: 'stitch-T3-001-01',
        position: 0
      }
    },
    activeTube: 1,
    cycleCount: 0,
    points: {
      session: 0,
      lifetime: 0
    },
    lastUpdated: new Date().toISOString()
  };

  beforeEach(() => {
    // Reset fetch mock between tests
    (global.fetch as jest.Mock).mockClear();
    
    // Create a new instance for each test
    contentBuffer = new ContentBufferManager();
    
    // Mock successful loading of manifest
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, manifest: mockManifest })
      })
    );
  });

  test('initialize should load the manifest', async () => {
    // Call initialize
    const result = await contentBuffer.initialize();
    
    // Should return true
    expect(result).toBe(true);
    
    // Should call fetch once with the manifest URL
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/content/manifest');
  });

  test('getUpcomingStitchesFromManifest should return correct stitches', async () => {
    // Initialize the buffer first
    await contentBuffer.initialize();
    
    // Get upcoming stitches for Tube 1, Thread 1, current stitch 01
    const stitches = contentBuffer.getUpcomingStitchesFromManifest(1, 'thread-T1-001', 'stitch-T1-001-01');
    
    // Should return the next 5 stitches in order
    expect(stitches).toEqual([
      'stitch-T1-001-02',
      'stitch-T1-001-03',
      'stitch-T1-001-04',
      'stitch-T1-001-05'
    ]);
  });

  test('getStitchesToBuffer should identify stitches to load', async () => {
    // Initialize the buffer first
    await contentBuffer.initialize();
    
    // Get stitches to buffer for the mock user state
    const stitchesToLoad = contentBuffer.getStitchesToBuffer(mockUserState);
    
    // Should include the current stitch and upcoming stitches
    expect(stitchesToLoad).toContain('stitch-T1-001-01');
    expect(stitchesToLoad).toContain('stitch-T1-001-02');
  });

  test('fetchStitches should call the batch API correctly', async () => {
    // Mock successful response from batch API
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          stitches: [mockStitches['stitch-T1-001-01'], mockStitches['stitch-T1-001-02']] 
        })
      })
    );
    
    // Call fetchStitches
    const stitches = await contentBuffer.fetchStitches(['stitch-T1-001-01', 'stitch-T1-001-02']);
    
    // Should call fetch once with the batch API
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/content/batch', expect.anything());
    
    // Should return the expected stitches
    expect(stitches).toHaveLength(2);
    expect(stitches[0].id).toBe('stitch-T1-001-01');
    expect(stitches[1].id).toBe('stitch-T1-001-02');
  });

  test('getStitch should return cached stitches without fetching', async () => {
    // Initialize the buffer
    await contentBuffer.initialize();
    
    // Mock a successful response for the first fetch
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          stitches: [mockStitches['stitch-T1-001-01']] 
        })
      })
    );
    
    // First call should fetch
    const stitch1 = await contentBuffer.getStitch('stitch-T1-001-01');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(stitch1?.id).toBe('stitch-T1-001-01');
    
    // Reset the fetch mock
    (global.fetch as jest.Mock).mockClear();
    
    // Second call should use the cache
    const stitch2 = await contentBuffer.getStitch('stitch-T1-001-01');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(stitch2?.id).toBe('stitch-T1-001-01');
  });

  test('getInPlayStitch should return the active stitch', async () => {
    // Initialize the buffer
    await contentBuffer.initialize();
    
    // Mock a successful response for fetching the stitch
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          stitches: [mockStitches['stitch-T1-001-01']] 
        })
      })
    );
    
    // Get the in-play stitch
    const stitch = await contentBuffer.getInPlayStitch(mockUserState);
    
    // Should fetch the active stitch
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(stitch?.id).toBe('stitch-T1-001-01');
  });

  test('clearCache should empty the cache', async () => {
    // Initialize the buffer
    await contentBuffer.initialize();
    
    // Mock a successful response for fetching the stitch
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          stitches: [mockStitches['stitch-T1-001-01']] 
        })
      })
    );
    
    // Load a stitch into the cache
    await contentBuffer.getStitch('stitch-T1-001-01');
    
    // Clear the cache
    contentBuffer.clearCache();
    
    // Reset the fetch mock
    (global.fetch as jest.Mock).mockClear();
    
    // Mock another successful response
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          stitches: [mockStitches['stitch-T1-001-01']] 
        })
      })
    );
    
    // Getting the stitch again should cause a new fetch
    await contentBuffer.getStitch('stitch-T1-001-01');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('updateBuffer should load missing stitches', async () => {
    // Initialize the buffer
    await contentBuffer.initialize();
    
    // Mock a successful response for fetching the stitches
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          stitches: [
            mockStitches['stitch-T1-001-01'],
            mockStitches['stitch-T1-001-02']
          ] 
        })
      })
    );
    
    // Update the buffer
    await contentBuffer.updateBuffer(mockUserState);
    
    // Should have called fetch to load the missing stitches
    expect(global.fetch).toHaveBeenCalledTimes(1);
    
    // Getting a stitch that was loaded by updateBuffer should not cause a new fetch
    (global.fetch as jest.Mock).mockClear();
    const stitch = await contentBuffer.getStitch('stitch-T1-001-01');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(stitch?.id).toBe('stitch-T1-001-01');
  });
});