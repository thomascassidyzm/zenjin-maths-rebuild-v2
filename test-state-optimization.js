/**
 * State Payload Optimization Test Script
 * 
 * This script tests the state payload optimization to ensure
 * it properly reduces the API payload size without losing critical data.
 */

// Mock the Zustand store state with a full test payload
const fullState = {
  userInformation: {
    userId: 'test-user-1234',
    isAnonymous: false,
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  },
  tubeState: {
    activeTube: 2,
    activeTubeNumber: 2,
    cycleCount: 3,
    tubes: {
      '1': {
        currentStitchId: 'stitch-T1-001-02',
        threadId: 'thread-T1-001',
        stitches: Array(10).fill(null).map((_, i) => ({
          id: `stitch-T1-001-${String(i+1).padStart(2, '0')}`,
          threadId: 'thread-T1-001',
          content: `Stitch content ${i+1} with lots of text that isn't needed for position data`,
          position: i,
          skipNumber: 3,
          distractorLevel: 'L1',
          questions: Array(20).fill(null).map((_, q) => ({
            id: `q-${i}-${q}`,
            text: `Question ${q+1} for stitch ${i+1}`,
            answers: ['Option 1', 'Option 2', 'Option 3', 'Option 4']
          }))
        }))
      },
      '2': {
        currentStitchId: 'stitch-T2-001-01',
        threadId: 'thread-T2-001',
        stitches: Array(10).fill(null).map((_, i) => ({
          id: `stitch-T2-001-${String(i+1).padStart(2, '0')}`,
          threadId: 'thread-T2-001',
          content: `Stitch content ${i+1} with lots of text that isn't needed for position data`,
          position: i,
          skipNumber: 3,
          distractorLevel: 'L1',
          questions: Array(20).fill(null).map((_, q) => ({
            id: `q-${i}-${q}`,
            text: `Question ${q+1} for stitch ${i+1}`,
            answers: ['Option 1', 'Option 2', 'Option 3', 'Option 4']
          }))
        }))
      },
      '3': {
        currentStitchId: 'stitch-T3-001-01',
        threadId: 'thread-T3-001',
        stitches: Array(10).fill(null).map((_, i) => ({
          id: `stitch-T3-001-${String(i+1).padStart(2, '0')}`,
          threadId: 'thread-T3-001',
          content: `Stitch content ${i+1} with lots of text that isn't needed for position data`,
          position: i,
          skipNumber: 3,
          distractorLevel: 'L1',
          questions: Array(20).fill(null).map((_, q) => ({
            id: `q-${i}-${q}`,
            text: `Question ${q+1} for stitch ${i+1}`,
            answers: ['Option 1', 'Option 2', 'Option 3', 'Option 4']
          }))
        }))
      }
    }
  },
  learningProgress: {
    evoPoints: 120,
    evolutionLevel: 3,
    blinkSpeed: 1.5,
    totalStitchesCompleted: 5,
    perfectScores: 2
  },
  lastUpdated: new Date().toISOString(),
  isInitialized: true
};

// Define the extract minimal state function (copied from our implementation)
function extractStitchPositions(stitches = []) {
  if (!Array.isArray(stitches)) return {};
  
  return stitches.reduce((acc, stitch) => {
    if (stitch && stitch.id) {
      acc[stitch.id] = {
        position: stitch.position || 0,
        skipNumber: stitch.skipNumber || 3,
        distractorLevel: stitch.distractorLevel || 'L1'
      };
    }
    return acc;
  }, {});
}

// Define the minimal state extraction function
function extractMinimalState(state) {
  const minimalState = {
    userId: state.userInformation?.userId,
    activeTube: state.tubeState?.activeTube || 1,
    activeTubeNumber: state.tubeState?.activeTubeNumber || 1,
    tubes: {},
    points: {
      session: state.learningProgress?.evoPoints || 0,
      lifetime: state.learningProgress?.evoPoints || 0
    },
    cycleCount: state.tubeState?.cycleCount || 0,
    lastUpdated: state.lastUpdated
  };
  
  // Include only essential tube data
  if (state.tubeState?.tubes) {
    Object.entries(state.tubeState.tubes).forEach(([tubeKey, tube]) => {
      if (tube) {
        minimalState.tubes[tubeKey] = {
          currentStitchId: tube.currentStitchId,
          threadId: tube.threadId,
          // Only essential position data for stitches
          stitchPositions: extractStitchPositions(tube.stitches)
        };
      }
    });
  }
  
  return minimalState;
}

// Run the optimization test
function runTest() {
  console.log('=== State Payload Optimization Test ===');
  
  // Measure original state size
  const originalState = fullState;
  const originalJson = JSON.stringify({state: originalState});
  const originalSize = originalJson.length;
  
  console.log(`Original state size: ${originalSize} bytes`);
  
  // Generate optimized state
  const minimalState = extractMinimalState(originalState);
  const minimalJson = JSON.stringify({state: minimalState});
  const minimalSize = minimalJson.length;
  
  console.log(`Optimized state size: ${minimalSize} bytes`);
  
  // Calculate reduction percentage
  const reductionPercent = ((originalSize - minimalSize) / originalSize * 100).toFixed(2);
  console.log(`Size reduction: ${reductionPercent}%`);
  
  // Verify critical data is preserved
  console.log('\nVerifying critical data preservation:');
  
  // Check user ID
  const userIdPreserved = minimalState.userId === originalState.userInformation.userId;
  console.log(`User ID preserved: ${userIdPreserved ? '✅' : '❌'}`);
  
  // Check active tube
  const activeTubePreserved = 
    minimalState.activeTube === originalState.tubeState.activeTube &&
    minimalState.activeTubeNumber === originalState.tubeState.activeTubeNumber;
  console.log(`Active tube preserved: ${activeTubePreserved ? '✅' : '❌'}`);
  
  // Check points
  const pointsPreserved = 
    minimalState.points.lifetime === originalState.learningProgress.evoPoints;
  console.log(`Points preserved: ${pointsPreserved ? '✅' : '❌'}`);
  
  // Check tube thread IDs
  let tubeThreadsPreserved = true;
  Object.entries(originalState.tubeState.tubes).forEach(([tubeNum, tube]) => {
    if (tube.threadId !== minimalState.tubes[tubeNum].threadId) {
      tubeThreadsPreserved = false;
    }
  });
  console.log(`Tube thread IDs preserved: ${tubeThreadsPreserved ? '✅' : '❌'}`);
  
  // Check current stitch IDs
  let currentStitchesPreserved = true;
  Object.entries(originalState.tubeState.tubes).forEach(([tubeNum, tube]) => {
    if (tube.currentStitchId !== minimalState.tubes[tubeNum].currentStitchId) {
      currentStitchesPreserved = false;
    }
  });
  console.log(`Current stitch IDs preserved: ${currentStitchesPreserved ? '✅' : '❌'}`);
  
  // Check stitch positions
  let stitchPositionsPreserved = true;
  Object.entries(originalState.tubeState.tubes).forEach(([tubeNum, tube]) => {
    tube.stitches.forEach(stitch => {
      const optimizedStitchPos = minimalState.tubes[tubeNum].stitchPositions[stitch.id];
      if (!optimizedStitchPos || 
          optimizedStitchPos.position !== stitch.position || 
          optimizedStitchPos.skipNumber !== stitch.skipNumber || 
          optimizedStitchPos.distractorLevel !== stitch.distractorLevel) {
        stitchPositionsPreserved = false;
      }
    });
  });
  console.log(`Stitch positions preserved: ${stitchPositionsPreserved ? '✅' : '❌'}`);
  
  // Final test result
  const allTestsPassed = 
    userIdPreserved && 
    activeTubePreserved && 
    pointsPreserved && 
    tubeThreadsPreserved && 
    currentStitchesPreserved && 
    stitchPositionsPreserved;
    
  console.log(`\nFinal result: ${allTestsPassed ? '✅ All tests passed!' : '❌ Some tests failed'}`);
  console.log(`Optimized payload is ${reductionPercent}% smaller than original`);
  
  return {
    originalSize,
    minimalSize,
    reductionPercent,
    allTestsPassed
  };
}

// Execute the test
const result = runTest();

// Export the test result
module.exports = result;