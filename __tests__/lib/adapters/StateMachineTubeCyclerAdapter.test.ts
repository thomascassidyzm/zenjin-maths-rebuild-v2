/**
 * StateMachineTubeCyclerAdapter Unit Tests
 * 
 * Tests the adapter that bridges the StateMachine to the TubeCycler interface.
 */

// First mock the StateMachine to isolate adapter testing
jest.mock('../../../lib/triple-helix/StateMachine', () => {
  return jest.fn().mockImplementation((initialState) => {
    return {
      // Track calls for verification
      mockCalls: {
        cycleTubes: 0,
        handleStitchCompletion: 0,
        selectTube: 0
      },
      
      // State management
      _state: initialState || {
        userId: 'default-user',
        activeTubeNumber: 1,
        cycleCount: 0,
        tubes: {}
      },
      getState: jest.fn().mockImplementation(function() {
        return this._state;
      }),
      
      // Tube operations
      getCurrentTubeNumber: jest.fn().mockImplementation(function() {
        return this._state.activeTubeNumber;
      }),
      cycleTubes: jest.fn().mockImplementation(function() {
        this.mockCalls.cycleTubes++;
        this._state.activeTubeNumber = (this._state.activeTubeNumber % 3) + 1;
        if (this._state.activeTubeNumber === 1) {
          this._state.cycleCount++;
        }
        return this._state.tubes[this._state.activeTubeNumber]?.currentStitchId;
      }),
      selectTube: jest.fn().mockImplementation(function(tubeNumber) {
        this.mockCalls.selectTube++;
        if (tubeNumber < 1 || tubeNumber > 3) return false;
        this._state.activeTubeNumber = tubeNumber;
        return true;
      }),
      
      // Stitch operations
      getCurrentStitch: jest.fn().mockImplementation(function() {
        const tubeNumber = this._state.activeTubeNumber;
        const tube = this._state.tubes[tubeNumber];
        if (!tube) return null;
        
        const stitchId = tube.currentStitchId;
        const stitch = tube.stitches?.find(s => s.id === stitchId);
        if (!stitch) return null;
        
        return {
          ...stitch,
          tubeNumber
        };
      }),
      handleStitchCompletion: jest.fn().mockImplementation(function(threadId, stitchId, score, totalQuestions) {
        this.mockCalls.handleStitchCompletion++;
        
        // If perfect score, advance to next stitch
        if (score === totalQuestions) {
          const tube = this._state.tubes[this._state.activeTubeNumber];
          if (tube && tube.stitches && tube.stitches.length > 1) {
            const currentIndex = tube.stitches.findIndex(s => s.id === stitchId);
            if (currentIndex >= 0 && currentIndex < tube.stitches.length - 1) {
              tube.currentStitchId = tube.stitches[currentIndex + 1].id;
            }
          }
        }
        
        return true;
      }),
      getCycleCount: jest.fn().mockImplementation(function() {
        return this._state.cycleCount;
      }),
      
      // Tube and thread operations
      getCurrentTubeStitches: jest.fn().mockImplementation(function() {
        const tubeNumber = this._state.activeTubeNumber;
        return this._state.tubes[tubeNumber]?.stitches || [];
      }),
      getStitchesForTube: jest.fn().mockImplementation(function(tubeNumber) {
        return this._state.tubes[tubeNumber]?.stitches || [];
      }),
      getThreadForTube: jest.fn().mockImplementation(function(tubeNumber) {
        return this._state.tubes[tubeNumber]?.threadId;
      }),
      getTube: jest.fn().mockImplementation(function(tubeNumber) {
        return this._state.tubes[tubeNumber] || null;
      })
    };
  });
});

// Import the adapter
const StateMachineTubeCyclerAdapter = require('../../../lib/adapters/StateMachineTubeCyclerAdapter');

describe('StateMachineTubeCyclerAdapter', () => {
  // Test state
  const testState = {
    userId: 'test-user',
    activeTubeNumber: 1,
    cycleCount: 0,
    tubes: {
      1: {
        threadId: 'thread-T1-001',
        currentStitchId: 'stitch-T1-001-01',
        stitches: [
          {
            id: 'stitch-T1-001-01',
            threadId: 'thread-T1-001',
            position: 0,
            skipNumber: 3,
            distractorLevel: 'L1',
            content: 'Content for stitch T1-001-01'
          },
          {
            id: 'stitch-T1-001-02',
            threadId: 'thread-T1-001',
            position: 1,
            skipNumber: 3,
            distractorLevel: 'L1',
            content: 'Content for stitch T1-001-02'
          }
        ]
      },
      2: {
        threadId: 'thread-T2-001',
        currentStitchId: 'stitch-T2-001-01',
        stitches: [
          {
            id: 'stitch-T2-001-01',
            threadId: 'thread-T2-001',
            position: 0,
            skipNumber: 3,
            distractorLevel: 'L1',
            content: 'Content for stitch T2-001-01'
          }
        ]
      },
      3: {
        threadId: 'thread-T3-001',
        currentStitchId: 'stitch-T3-001-01',
        stitches: [
          {
            id: 'stitch-T3-001-01',
            threadId: 'thread-T3-001',
            position: 0,
            skipNumber: 3,
            distractorLevel: 'L1',
            content: 'Content for stitch T3-001-01'
          }
        ]
      }
    }
  };

  // Variables for tests
  let adapter;
  let stateChangeMock;
  let tubeChangeMock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mocks for callbacks
    stateChangeMock = jest.fn();
    tubeChangeMock = jest.fn();
    
    // Create adapter instance
    adapter = new StateMachineTubeCyclerAdapter({
      userId: 'test-user',
      initialState: testState,
      onStateChange: stateChangeMock,
      onTubeChange: tubeChangeMock
    });
  });

  test('should initialize correctly', () => {
    expect(adapter).toBeDefined();
    expect(adapter.getCurrentTube()).toBe(1);
    
    // Callbacks should be called once during initialization
    expect(stateChangeMock).toHaveBeenCalledTimes(1);
    expect(tubeChangeMock).toHaveBeenCalledTimes(1);
  });

  test('should get current tube name in expected format', () => {
    expect(adapter.getCurrentTubeName()).toBe('Tube-1');
  });

  test('should get current stitch correctly', () => {
    const stitch = adapter.getCurrentStitch();
    expect(stitch).toBeDefined();
    expect(stitch.id).toBe('stitch-T1-001-01');
    expect(stitch.tubeNumber).toBe(1);
  });

  test('should get current tube stitches correctly', () => {
    const stitches = adapter.getCurrentTubeStitches();
    expect(stitches).toHaveLength(2);
    expect(stitches[0].id).toBe('stitch-T1-001-01');
  });

  test('should handle nextTube with rotation lock', () => {
    // First call should work
    const nextStitch = adapter.nextTube();
    
    // State machine should have been called
    expect(adapter.stateMachine.mockCalls.cycleTubes).toBe(1);
    
    // Callbacks should have been called
    expect(stateChangeMock).toHaveBeenCalledTimes(2); // 1 for init, 1 for rotation
    expect(tubeChangeMock).toHaveBeenCalledTimes(2); // 1 for init, 1 for rotation
    
    // Second immediate call should be blocked by rotation lock
    adapter.nextTube();
    
    // State machine should not be called again
    expect(adapter.stateMachine.mockCalls.cycleTubes).toBe(1);
  });

  test('should correctly handle stitch completion', () => {
    // Handle stitch completion
    const threadId = 'thread-T1-001';
    const stitchId = 'stitch-T1-001-01';
    
    adapter.handleStitchCompletion(threadId, stitchId, 10, 10);
    
    // StateMachine method should be called
    expect(adapter.stateMachine.mockCalls.handleStitchCompletion).toBe(1);
    
    // Callbacks should be called
    expect(stateChangeMock).toHaveBeenCalledTimes(2); // 1 for init, 1 for completion
    
    // Second immediate call should be blocked by rotation lock
    adapter.handleStitchCompletion(threadId, stitchId, 10, 10);
    
    // Should not call StateMachine again
    expect(adapter.stateMachine.mockCalls.handleStitchCompletion).toBe(1);
  });

  test('should manually select tube correctly', () => {
    // Select tube 3
    const success = adapter.selectTube(3);
    
    // Should succeed
    expect(success).toBe(true);
    
    // StateMachine method should be called
    expect(adapter.stateMachine.mockCalls.selectTube).toBe(1);
    
    // Callbacks should be called
    expect(stateChangeMock).toHaveBeenCalledTimes(2); // 1 for init, 1 for selection
    expect(tubeChangeMock).toHaveBeenCalledTimes(2); // 1 for init, 1 for selection
    
    // Current tube should be updated
    expect(adapter.getCurrentTube()).toBe(3);
  });

  test('should handle invalid tube selection gracefully', () => {
    // Try to select an invalid tube
    const success = adapter.selectTube(5);
    
    // Should fail
    expect(success).toBe(false);
    
    // StateMachine method should be called
    expect(adapter.stateMachine.mockCalls.selectTube).toBe(1);
    
    // Current tube should remain the same
    expect(adapter.getCurrentTube()).toBe(1);
  });

  test('should convert to thread data format correctly', () => {
    const threads = adapter.getSortedThreads();
    
    // Should have one thread for each tube
    expect(threads).toHaveLength(3);
    
    // Threads should be sorted by tube number
    expect(threads[0].tube_number).toBe(1);
    expect(threads[1].tube_number).toBe(2);
    expect(threads[2].tube_number).toBe(3);
    
    // Threads should have the correct properties
    expect(threads[0].thread_id).toBe('thread-T1-001');
    expect(threads[0].stitches).toBeDefined();
    expect(threads[0].stitches).toHaveLength(2);
  });

  test('should provide current thread correctly', () => {
    const threadId = adapter.getCurrentThread();
    expect(threadId).toBe('thread-T1-001');
  });

  test('should provide stitches for a specific tube', () => {
    const stitches = adapter.getStitchesForTube(2);
    expect(stitches).toHaveLength(1);
    expect(stitches[0].id).toBe('stitch-T2-001-01');
  });

  test('should provide thread ID for a specific tube', () => {
    const threadId = adapter.getThreadForTube(3);
    expect(threadId).toBe('thread-T3-001');
  });

  test('should get cycle count correctly', () => {
    expect(adapter.getCycleCount()).toBe(0);
  });

  test('should handle persistCurrentState method', async () => {
    // Mock global fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true })
    });
    
    const result = await adapter.persistCurrentState();
    
    // Method should return true
    expect(result).toBe(true);
  });

  test('should handle destroy method', () => {
    adapter.destroy();
    // Primarily tests that the method exists and doesn't throw
  });
});