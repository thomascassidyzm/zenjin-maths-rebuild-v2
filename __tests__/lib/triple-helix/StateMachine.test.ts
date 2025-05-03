/**
 * StateMachine Unit Tests
 * 
 * Tests the core state machine functionality for the Triple Helix system.
 */

import StateMachine from '../../../lib/triple-helix/StateMachine';

describe('StateMachine', () => {
  // Initial state for testing
  const initialState = {
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
            position: 0, // Active stitch
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
          },
          {
            id: 'stitch-T1-001-03',
            threadId: 'thread-T1-001',
            position: 2,
            skipNumber: 3,
            distractorLevel: 'L1',
            content: 'Content for stitch T1-001-03'
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
            position: 0, // Active stitch
            skipNumber: 3,
            distractorLevel: 'L1',
            content: 'Content for stitch T2-001-01'
          },
          {
            id: 'stitch-T2-001-02',
            threadId: 'thread-T2-001',
            position: 1,
            skipNumber: 3,
            distractorLevel: 'L1',
            content: 'Content for stitch T2-001-02'
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
            position: 0, // Active stitch
            skipNumber: 3,
            distractorLevel: 'L1',
            content: 'Content for stitch T3-001-01'
          },
          {
            id: 'stitch-T3-001-02',
            threadId: 'thread-T3-001',
            position: 1,
            skipNumber: 3,
            distractorLevel: 'L1',
            content: 'Content for stitch T3-001-02'
          }
        ]
      }
    }
  };

  // Create a new StateMachine instance for each test
  let stateMachine: any;

  beforeEach(() => {
    stateMachine = new StateMachine(initialState);
  });

  test('should initialize with the provided state', () => {
    // Verify initial state
    const state = stateMachine.getState();
    
    expect(state.userId).toBe('test-user');
    expect(state.activeTubeNumber).toBe(1);
    expect(state.cycleCount).toBe(0);
    expect(state.tubes[1].threadId).toBe('thread-T1-001');
    expect(state.tubes[1].currentStitchId).toBe('stitch-T1-001-01');
  });

  test('should get the current tube number correctly', () => {
    expect(stateMachine.getCurrentTubeNumber()).toBe(1);
  });

  test('should get the current stitch correctly', () => {
    const currentStitch = stateMachine.getCurrentStitch();
    
    expect(currentStitch).toBeDefined();
    expect(currentStitch.id).toBe('stitch-T1-001-01');
    expect(currentStitch.threadId).toBe('thread-T1-001');
    expect(currentStitch.tubeNumber).toBe(1);
  });

  test('should get current tube stitches correctly', () => {
    const stitches = stateMachine.getCurrentTubeStitches();
    
    expect(stitches).toHaveLength(3);
    expect(stitches[0].id).toBe('stitch-T1-001-01');
    expect(stitches[1].id).toBe('stitch-T1-001-02');
    expect(stitches[2].id).toBe('stitch-T1-001-03');
  });

  test('should cycle tubes correctly', () => {
    // Start with tube 1
    expect(stateMachine.getCurrentTubeNumber()).toBe(1);
    
    // Cycle to tube 2
    stateMachine.cycleTubes();
    expect(stateMachine.getCurrentTubeNumber()).toBe(2);
    
    // Cycle to tube 3
    stateMachine.cycleTubes();
    expect(stateMachine.getCurrentTubeNumber()).toBe(3);
    
    // Cycle back to tube 1 and increment cycle count
    stateMachine.cycleTubes();
    expect(stateMachine.getCurrentTubeNumber()).toBe(1);
    expect(stateMachine.getCycleCount()).toBe(1);
  });

  test('should handle stitch completion', () => {
    // Stitch that's being completed
    const stitchId = 'stitch-T1-001-01';
    const threadId = 'thread-T1-001';
    
    // Before completion
    const beforeStitch = stateMachine.getCurrentStitch();
    expect(beforeStitch.id).toBe(stitchId);
    
    // Handle stitch completion with perfect score
    stateMachine.handleStitchCompletion(threadId, stitchId, 10, 10);
    
    // After completion, the stitch should be moved back and next stitch becomes active
    const afterStitch = stateMachine.getCurrentStitch();
    expect(afterStitch.id).toBe('stitch-T1-001-02');
    
    // The completed stitch should now be at its skip position
    const tube = stateMachine.getTube(1);
    const completedStitch = tube.stitches.find((s: any) => s.id === stitchId);
    expect(completedStitch.position).toBe(3); // Based on skipNumber of 3
  });

  test('should handle stitch completion with imperfect score', () => {
    // Stitch that's being completed
    const stitchId = 'stitch-T1-001-01';
    const threadId = 'thread-T1-001';
    
    // Handle stitch completion with imperfect score
    stateMachine.handleStitchCompletion(threadId, stitchId, 7, 10);
    
    // With an imperfect score, the stitch should remain at position 0
    const afterStitch = stateMachine.getCurrentStitch();
    expect(afterStitch.id).toBe(stitchId);
  });

  test('should select a tube correctly', () => {
    // Start with tube 1
    expect(stateMachine.getCurrentTubeNumber()).toBe(1);
    
    // Select tube 3
    const success = stateMachine.selectTube(3);
    
    expect(success).toBe(true);
    expect(stateMachine.getCurrentTubeNumber()).toBe(3);
    
    // Current stitch should be from tube 3
    const currentStitch = stateMachine.getCurrentStitch();
    expect(currentStitch.id).toBe('stitch-T3-001-01');
    expect(currentStitch.tubeNumber).toBe(3);
  });

  test('should handle invalid tube selection gracefully', () => {
    // Try to select an invalid tube number
    const success = stateMachine.selectTube(5);
    
    // Should fail and stay on current tube
    expect(success).toBe(false);
    expect(stateMachine.getCurrentTubeNumber()).toBe(1);
  });

  test('should get the thread for a tube correctly', () => {
    const threadId = stateMachine.getThreadForTube(2);
    expect(threadId).toBe('thread-T2-001');
  });

  test('should get cycle count correctly', () => {
    expect(stateMachine.getCycleCount()).toBe(0);
    
    // Complete a full cycle
    stateMachine.cycleTubes(); // Tube 1 to 2
    stateMachine.cycleTubes(); // Tube 2 to 3
    stateMachine.cycleTubes(); // Tube 3 back to 1, increment cycle count
    
    expect(stateMachine.getCycleCount()).toBe(1);
  });

  test('should handle position conflicts in the state', () => {
    // Create a state with position conflicts
    const conflictState = {
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
              position: 0, // Conflict 1
              skipNumber: 3,
              distractorLevel: 'L1'
            },
            {
              id: 'stitch-T1-001-02',
              threadId: 'thread-T1-001',
              position: 0, // Conflict 1
              skipNumber: 3,
              distractorLevel: 'L1'
            },
            {
              id: 'stitch-T1-001-03',
              threadId: 'thread-T1-001',
              position: 1, // Conflict 2
              skipNumber: 3,
              distractorLevel: 'L1'
            },
            {
              id: 'stitch-T1-001-04',
              threadId: 'thread-T1-001',
              position: 1, // Conflict 2
              skipNumber: 3,
              distractorLevel: 'L1'
            }
          ]
        }
      }
    };
    
    // Create a new state machine with conflicts
    const conflictStateMachine = new StateMachine(conflictState);
    
    // Get the normalized state
    const normalizedState = conflictStateMachine.getState();
    
    // Verify position conflicts are resolved
    const tube1Stitches = normalizedState.tubes[1].stitches;
    
    // Track each position to ensure no duplicates
    const positions = new Set();
    tube1Stitches.forEach((stitch: any) => {
      // Each position should be unique
      expect(positions.has(stitch.position)).toBe(false);
      positions.add(stitch.position);
    });
    
    // Verify currentStitchId corresponds to position 0
    const activeStitch = tube1Stitches.find((s: any) => s.position === 0);
    expect(normalizedState.tubes[1].currentStitchId).toBe(activeStitch.id);
  });
});