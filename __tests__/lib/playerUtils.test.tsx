/**
 * Player Utilities Tests
 * 
 * Tests for the useTripleHelixPlayer hook that manages the state and
 * behavior of the triple-helix learning system.
 */

import { renderHook, act } from '@testing-library/react';
import { useTripleHelixPlayer } from '../../lib/playerUtils';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn()
}));

// Mock AuthContext
jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn()
}));

// Mock StateMachineTubeCyclerAdapter
jest.mock('../../lib/adapters/StateMachineTubeCyclerAdapter', () => {
  // Create a mock implementation of the adapter
  return jest.fn().mockImplementation(({ initialState, onStateChange, onTubeChange }) => {
    let state = { ...initialState };
    let activeTube = state.activeTubeNumber || 1;
    
    const adapter = {
      getCurrentTube: jest.fn().mockImplementation(() => activeTube),
      
      getCurrentStitch: jest.fn().mockImplementation(() => {
        const tube = state.tubes[activeTube];
        if (!tube) return null;
        
        const stitchId = tube.currentStitchId;
        return tube.stitches.find(s => s.id === stitchId) || null;
      }),
      
      getCurrentTubeStitches: jest.fn().mockImplementation(() => {
        const tube = state.tubes[activeTube];
        return tube ? [...tube.stitches].sort((a, b) => a.position - b.position) : [];
      }),
      
      getState: jest.fn().mockImplementation(() => state),
      
      selectTube: jest.fn().mockImplementation((tubeNumber) => {
        if (tubeNumber !== activeTube) {
          const oldTube = activeTube;
          activeTube = tubeNumber;
          
          // First trigger tube change
          if (onTubeChange) onTubeChange(tubeNumber);
          
          // Then trigger state change with the new active tube
          state = {
            ...state,
            activeTubeNumber: tubeNumber
          };
          
          if (onStateChange) onStateChange(state);
          
          // Log the tube change for debugging
          console.log(`Mock adapter changing tube from ${oldTube} to ${tubeNumber}`);
        }
        return activeTube;
      }),
      
      handleStitchCompletion: jest.fn().mockImplementation((threadId, stitchId, score, totalQuestions) => {
        // Find the tube and stitch
        let tubeNumber = null;
        for (const [tubeName, tube] of Object.entries(state.tubes)) {
          if (tube.stitches.some(s => s.id === stitchId)) {
            tubeNumber = parseInt(tubeName);
            break;
          }
        }
        
        if (!tubeNumber) return;
        
        // Update the stitch
        const tube = state.tubes[tubeNumber];
        const stitchIndex = tube.stitches.findIndex(s => s.id === stitchId);
        
        if (stitchIndex >= 0) {
          const stitch = tube.stitches[stitchIndex];
          
          // Mark as completed and update score
          tube.stitches[stitchIndex] = {
            ...stitch,
            completed: true,
            score: score
          };
          
          // If perfect score, move this stitch to the end
          if (score === totalQuestions) {
            // Find the highest position
            const maxPosition = Math.max(...tube.stitches.map(s => s.position));
            
            // Move this stitch to the end
            tube.stitches[stitchIndex].position = maxPosition + 1;
            
            // Find the next stitch to be active
            const nextStitch = tube.stitches
              .filter(s => !s.completed)
              .sort((a, b) => a.position - b.position)[0];
            
            if (nextStitch) {
              tube.currentStitchId = nextStitch.id;
            }
          }
          
          // Update state
          state = {
            ...state,
            tubes: {
              ...state.tubes,
              [tubeNumber]: tube
            }
          };
          
          // Notify state change
          if (onStateChange) onStateChange(state);
        }
      }),
      
      getStats: jest.fn().mockImplementation(() => ({
        pendingChanges: 0,
        completedStitches: 0,
        totalStitches: 0
      })),
      
      destroy: jest.fn(),
      
      getStitchesForTube: jest.fn().mockImplementation((tubeNum) => {
        const tube = state.tubes[tubeNum];
        return tube ? [...tube.stitches].sort((a, b) => a.position - b.position) : [];
      })
    };
    
    return adapter;
  });
});

// Mock fetch
global.fetch = jest.fn();

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

// Mock console methods
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
});

// Mock axios for API calls
jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ status: 200, statusText: 'OK' })
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);

// Helper function to create test wrapper for the hook
const createHookWrapper = () => {
  // Reset all mocks
  jest.clearAllMocks();
  localStorageMock.clear();
  (global.fetch as jest.Mock).mockReset();
  
  // Test data
  const mockUserId = 'test-user-123';
  const mockAnonymousId = 'anonymous-123456';
  
  // Create mock tube data
  const createTubeData = (tubeNumber) => ({
    threadId: `thread-T${tubeNumber}-001`,
    currentStitchId: `stitch-T${tubeNumber}-001-01`,
    stitches: [
      {
        id: `stitch-T${tubeNumber}-001-01`,
        threadId: `thread-T${tubeNumber}-001`,
        content: `Content for stitch T${tubeNumber}-001-01`,
        position: 0,
        skipNumber: 3,
        distractorLevel: 'L1',
        tubeNumber,
        questions: [
          {
            id: `stitch-T${tubeNumber}-001-01-q01`,
            text: `Question 1 for tube ${tubeNumber}`,
            correctAnswer: 'Correct',
            distractors: { L1: 'Wrong1', L2: 'Wrong2', L3: 'Wrong3' }
          }
        ]
      },
      {
        id: `stitch-T${tubeNumber}-001-02`,
        threadId: `thread-T${tubeNumber}-001`,
        content: `Content for stitch T${tubeNumber}-001-02`,
        position: 1,
        skipNumber: 3,
        distractorLevel: 'L1',
        tubeNumber,
        questions: [
          {
            id: `stitch-T${tubeNumber}-001-02-q01`,
            text: `Question 1 for tube ${tubeNumber} stitch 2`,
            correctAnswer: 'Correct',
            distractors: { L1: 'Wrong1', L2: 'Wrong2', L3: 'Wrong3' }
          }
        ]
      }
    ]
  });
  
  // Mock API response
  const mockApiResponse = {
    success: true,
    data: [
      {
        thread_id: 'thread-T1-001',
        tube_number: 1,
        stitches: [
          {
            id: 'stitch-T1-001-01',
            order_number: 0,
            skip_number: 3,
            distractor_level: 'L1',
            content: 'Content for tube 1, stitch 1',
            questions: [
              {
                id: 'stitch-T1-001-01-q01',
                question: 'Question 1 for tube 1',
                options: ['Option A', 'Option B', 'Option C', 'Option D'],
                answer: 'Option A',
                distractors: { L1: 'Option B', L2: 'Option C', L3: 'Option D' }
              }
            ]
          }
        ],
        orderMap: [{ stitch_id: 'stitch-T1-001-01', order_number: 0 }]
      }
    ],
    tubePosition: { tubeNumber: 1, threadId: 'thread-T1-001' },
    isFreeTier: false
  };
  
  // Set up auth mock
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: mockUserId },
    isAuthenticated: true
  });
  
  // Set up router mock - making sure to make it more consistent
  (useRouter as jest.Mock).mockReturnValue({
    query: {},
    push: jest.fn(),
    pathname: '/',
    asPath: '/',
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    },
    isFallback: false,
    isReady: true
  });
  
  // Set up fetch mock for successful API responses
  (global.fetch as jest.Mock).mockImplementation(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockApiResponse)
    })
  );
  
  return {
    mockUserId,
    mockAnonymousId,
    createTubeData,
    mockApiResponse
  };
};

describe('useTripleHelixPlayer', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    localStorageMock.clear();
  });
  
  test('initializes with authenticated user', async () => {
    const { mockUserId } = createHookWrapper();
    
    let hook;
    await act(async () => {
      const { result } = renderHook(() => useTripleHelixPlayer({ mode: 'default' }));
      hook = result;
    });
    
    // Check that user ID is set correctly
    expect(hook.current.isAnonymous).toBe(false);
    
    // Check initial loading state
    expect(hook.current.isLoading).toBe(false);
    expect(hook.current.loadError).toBeNull();
    
    // Should start with tube 1
    expect(hook.current.currentTube).toBe(1);
    
    // Should have a current stitch
    expect(hook.current.currentStitch).toBeDefined();
    
    // Should have tube cycler initialized
    expect(hook.current.tubeCycler).toBeDefined();
    
    // API should have been called
    expect(global.fetch).toHaveBeenCalled();
  });
  
  test('initializes with anonymous user', async () => {
    const { mockAnonymousId } = createHookWrapper();
    
    // Override auth mock for anonymous user
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isAuthenticated: false
    });
    
    let hook;
    await act(async () => {
      const { result } = renderHook(() => useTripleHelixPlayer({ mode: 'anonymous' }));
      hook = result;
    });
    
    // Check that anonymous mode is set
    expect(hook.current.isAnonymous).toBe(true);
    
    // Should start with tube 1
    expect(hook.current.currentTube).toBe(1);
    
    // Should have a current stitch
    expect(hook.current.currentStitch).toBeDefined();
    
    // Should have tube cycler initialized
    expect(hook.current.tubeCycler).toBeDefined();
    
    // Should be using pre-embedded anonymous data before API call completes
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/user-stitches'),
      expect.anything()
    );
    
    // Verify that isAnonymous=true is in the URL
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('isAnonymous=true'),
      expect.anything()
    );
  });
  
  test('handles session completion and tube rotation', async () => {
    const { createTubeData } = createHookWrapper();
    
    // Set up initial state for testing tube rotation
    const initialState = {
      userId: 'test-user-123',
      activeTubeNumber: 1,
      tubes: {
        1: createTubeData(1),
        2: createTubeData(2),
        3: createTubeData(3)
      }
    };
    
    // Mock fetch response
    (global.fetch as jest.Mock).mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [
            {
              thread_id: 'thread-T1-001',
              tube_number: 1,
              stitches: initialState.tubes[1].stitches.map(s => ({
                id: s.id,
                order_number: s.position,
                skip_number: s.skipNumber,
                distractor_level: s.distractorLevel,
                content: s.content,
                questions: s.questions
              }))
            }
          ],
          tubePosition: { tubeNumber: 1, threadId: 'thread-T1-001' }
        })
      })
    );
    
    let hook;
    await act(async () => {
      const { result } = renderHook(() => useTripleHelixPlayer({ mode: 'default' }));
      hook = result;
    });
    
    // Save initial tube number for verification
    const initialTube = hook.current.currentTube;
    expect(initialTube).toBe(1);
    
    // Create session completion results
    const sessionResults = {
      correctAnswers: 20,
      totalQuestions: 20,
      totalPoints: 60,
      sessionDuration: 300,
      firstTimeCorrect: 20,
      totalAttempts: 20,
      questionResults: []
    };
    
    // Complete the session with perfect score
    await act(async () => {
      hook.current.handleSessionComplete(sessionResults);
      
      // Let the transition settle
      await new Promise(resolve => setTimeout(resolve, 500));
    });
    
    // Should rotate to tube 2
    expect(hook.current.currentTube).toBe(2);
    
    // Should update accumulated session data
    expect(hook.current.accumulatedSessionData.totalPoints).toBe(60);
    expect(hook.current.accumulatedSessionData.correctAnswers).toBe(20);
    
    // The tubeCycler's handleStitchCompletion should have been called
    const StateMachineTubeCyclerAdapter = require('../../lib/adapters/StateMachineTubeCyclerAdapter');
    const mockAdapter = StateMachineTubeCyclerAdapter.mock.results[0].value;
    expect(mockAdapter.handleStitchCompletion).toHaveBeenCalledWith(
      expect.any(String), // threadId
      expect.any(String), // stitchId
      20, // score
      20  // totalQuestions
    );
    
    // selectTube should have been called with tube 2
    expect(mockAdapter.selectTube).toHaveBeenCalledWith(2);
  });
  
  test('persists state to server for authenticated users', async () => {
    createHookWrapper();
    
    let hook;
    await act(async () => {
      const { result } = renderHook(() => useTripleHelixPlayer({ mode: 'default' }));
      hook = result;
    });
    
    // Reset fetch mock to track server calls
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true })
      })
    );
    
    // Call persist state method
    await act(async () => {
      await hook.current.persistStateToServer(10, 10);
    });
    
    // Should make API calls to persist state
    expect(global.fetch).toHaveBeenCalledTimes(3); // user-state, save-tube-position, update-stitch-positions
    
    // Should have called the first endpoint to save complete state
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/user-state',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    );
  });
  
  test('persists state to localStorage for anonymous users', async () => {
    // Override auth mock for anonymous user
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isAuthenticated: false
    });
    
    let hook;
    await act(async () => {
      const { result } = renderHook(() => useTripleHelixPlayer({ mode: 'anonymous' }));
      hook = result;
    });
    
    // Reset localStorage mock
    (localStorageMock.setItem as jest.Mock).mockClear();
    
    // Call persist anonymous state method
    await act(async () => {
      hook.current.persistAnonymousState();
    });
    
    // Should save to localStorage
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'zenjin_anonymous_state',
      expect.stringContaining('state')
    );
    
    // Should not make API calls
    expect(global.fetch).not.toHaveBeenCalledWith('/api/user-state', expect.anything());
  });
  
  test('handles perfect score with handlePerfectScore method', async () => {
    const { createTubeData } = createHookWrapper();
    
    // Set up initial state for testing
    const initialState = {
      userId: 'test-user-123',
      activeTubeNumber: 1,
      tubes: {
        1: createTubeData(1),
        2: createTubeData(2),
        3: createTubeData(3)
      }
    };
    
    let hook;
    await act(async () => {
      const { result } = renderHook(() => useTripleHelixPlayer({ mode: 'default' }));
      hook = result;
    });
    
    // Save initial tube number for verification
    const initialTube = hook.current.currentTube;
    expect(initialTube).toBe(1);
    
    // Call handlePerfectScore method
    await act(async () => {
      hook.current.handlePerfectScore();
      
      // Let the transition settle
      await new Promise(resolve => setTimeout(resolve, 500));
    });
    
    // Should rotate to tube 2
    expect(hook.current.currentTube).toBe(2);
    
    // Should update accumulated session data
    expect(hook.current.accumulatedSessionData.totalPoints).toBeGreaterThan(0);
    
    // Should show celebration effect
    expect(hook.current.showCelebration).toBe(true);
  });
  
  test('handles manual tube selection', async () => {
    const { createTubeData } = createHookWrapper();
    
    // Set up initial state for testing
    const initialState = {
      userId: 'test-user-123',
      activeTubeNumber: 1,
      tubes: {
        1: createTubeData(1),
        2: createTubeData(2),
        3: createTubeData(3)
      }
    };
    
    let hook;
    await act(async () => {
      const { result } = renderHook(() => useTripleHelixPlayer({ mode: 'default' }));
      hook = result;
    });
    
    // Save initial tube number for verification
    const initialTube = hook.current.currentTube;
    expect(initialTube).toBe(1);
    
    // Call manual tube selection
    await act(async () => {
      hook.current.handleManualTubeSelect(3);
      
      // Let the transition settle
      await new Promise(resolve => setTimeout(resolve, 500));
    });
    
    // Should change to tube 3
    expect(hook.current.currentTube).toBe(3);
    
    // Should update current stitch
    expect(hook.current.currentStitch).toBeDefined();
    expect(hook.current.currentStitch?.tubeNumber).toBe(3);
  });
  
  test('loads data from URL parameters when available', async () => {
    createHookWrapper();
    
    // Override router mock to include userId in query
    (useRouter as jest.Mock).mockReturnValue({
      query: { userId: 'url-param-user-123' },
      push: jest.fn()
    });
    
    let hook;
    await act(async () => {
      const { result } = renderHook(() => useTripleHelixPlayer({ mode: 'default' }));
      hook = result;
    });
    
    // API should be called with the userId from URL
    // Verify that it's included in at least one of the calls
    const fetchCalls = (global.fetch as jest.Mock).mock.calls;
    const hasUrlParamCall = fetchCalls.some(call => 
      call[0].includes('userId=url-param-user-123')
    );
    expect(hasUrlParamCall).toBe(true);
  });
  
  test('handles end session request for authenticated users', async () => {
    createHookWrapper();
    
    // Mock window.location.href
    const originalLocation = window.location;
    delete window.location;
    window.location = { href: '' } as Location;
    
    let hook;
    await act(async () => {
      const { result } = renderHook(() => useTripleHelixPlayer({ mode: 'default' }));
      hook = result;
    });
    
    // Reset fetch mocks
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true })
      })
    );
    
    // Call end session
    await act(async () => {
      const sessionResults = {
        correctAnswers: 20,
        totalQuestions: 20,
        totalPoints: 60,
        questionResults: [],
        sessionDuration: 300
      };
      
      hook.current.handleSessionComplete(sessionResults, true);
      
      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    });
    
    // Should make API calls for session end
    expect(global.fetch).toHaveBeenCalledWith('/api/end-session', expect.anything());
    
    // Restore window.location
    window.location = originalLocation;
  });
  
  test('handles error loading tube configuration', async () => {
    createHookWrapper();
    
    // Mock fetch to fail for tube configuration
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' })
      })
    );
    
    let hook;
    await act(async () => {
      const { result } = renderHook(() => useTripleHelixPlayer({ mode: 'default' }));
      hook = result;
    });
    
    // Should set error state
    expect(hook.current.loadError).toBeDefined();
    expect(hook.current.isLoading).toBe(false);
  });
  
  test('preloads next tube data for seamless transitions', async () => {
    const { createTubeData } = createHookWrapper();
    
    // Set up initial state for testing
    const initialState = {
      userId: 'test-user-123',
      activeTubeNumber: 1,
      tubes: {
        1: createTubeData(1),
        2: createTubeData(2),
        3: createTubeData(3)
      }
    };
    
    let hook;
    await act(async () => {
      const { result } = renderHook(() => useTripleHelixPlayer({ mode: 'default' }));
      hook = result;
    });
    
    // Call preload method
    await act(async () => {
      hook.current.preloadNextTube();
    });
    
    // The adapter's getCurrentTube method should be called
    const StateMachineTubeCyclerAdapter = require('../../lib/adapters/StateMachineTubeCyclerAdapter');
    const mockAdapter = StateMachineTubeCyclerAdapter.mock.results[0].value;
    expect(mockAdapter.getCurrentTube).toHaveBeenCalled();
    
    // The adapter's getState method should be called
    expect(mockAdapter.getState).toHaveBeenCalled();
  });
  
  test('resets points when resetPoints is true', async () => {
    createHookWrapper();
    
    let hook;
    await act(async () => {
      const { result } = renderHook(() => useTripleHelixPlayer({ 
        mode: 'default',
        resetPoints: true 
      }));
      hook = result;
    });
    
    // Initial points should be 0
    expect(hook.current.accumulatedSessionData.totalPoints).toBe(0);
    
    // Complete a session with points
    await act(async () => {
      const sessionResults = {
        correctAnswers: 20,
        totalQuestions: 20,
        totalPoints: 60
      };
      
      hook.current.handleSessionComplete(sessionResults);
      
      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    // Should have only the points from this session (not accumulated from localStorage)
    expect(hook.current.accumulatedSessionData.totalPoints).toBe(60);
  });
});