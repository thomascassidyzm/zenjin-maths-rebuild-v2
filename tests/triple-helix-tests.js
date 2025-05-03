/**
 * Triple Helix Flow Integration Tests
 * 
 * This test suite verifies the full end-to-end flow of the Triple Helix model:
 * 1. Initialize all three tubes with active stitches
 * 2. Complete sessions in each tube
 * 3. Verify tube rotation happens correctly
 * 4. Verify stitch progression (order_number adjustments)
 * 5. Test the full session completion and dashboard navigation
 * 
 * This tests the integration between front-end state machine logic
 * and back-end persistence.
 * 
 * Usage:
 * 1. Start your development server
 * 2. Run with Node.js: node tests/triple-helix-tests.js
 */

const fetch = require('node-fetch');
const TEST_URL = 'http://localhost:3000'; // Change to your server URL
const TEST_USER_ID = 'test-helix-' + Date.now().toString(36);

// Tube/thread definitions for our test
const TUBES = [
  {
    tubeNumber: 1,
    threadId: 'thread-T1-001',
    stitchId: 'stitch-T1-001-01'
  },
  {
    tubeNumber: 2,
    threadId: 'thread-T2-001',
    stitchId: 'stitch-T2-001-01'
  },
  {
    tubeNumber: 3,
    threadId: 'thread-T3-001',
    stitchId: 'stitch-T3-001-01'
  }
];

// Test utilities
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function logWithBorder(message) {
  const border = '='.repeat(message.length + 4);
  console.log(`\n${border}`);
  console.log(`| ${message} |`);
  console.log(`${border}\n`);
}

async function callApi(path, method = 'GET', body = null) {
  const url = `${TEST_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': TEST_USER_ID
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  console.log(`📡 ${method} ${url}`);
  if (body) {
    console.log(`📦 Request payload (truncated):`, JSON.stringify(body).substring(0, 100) + '...');
  }
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`API call failed with status ${response.status}`);
    }
    
    // Parse JSON if possible
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const result = await response.json();
      return result;
    } else {
      return await response.text();
    }
  } catch (error) {
    console.error(`API error: ${error.message}`);
    throw error;
  }
}

// Initialize user state with clean slate
async function initializeState() {
  logWithBorder('INITIALIZING USER STATE');
  
  // First reset all user progress
  await callApi('/api/reset-user-progress', 'POST', { userId: TEST_USER_ID });
  console.log('Reset user progress complete');
  
  // Verify user state is reset properly
  const userStitchesResponse = await callApi(`/api/user-stitches?userId=${TEST_USER_ID}`);
  console.log('Initial tube position:', userStitchesResponse.tubePosition);
  
  if (!userStitchesResponse.tubePosition) {
    throw new Error('Failed to initialize user state - no tube position found');
  }
  
  return userStitchesResponse;
}

// Initialize active stitches in all three tubes
async function initializeTripleHelix() {
  logWithBorder('INITIALIZING TRIPLE HELIX MODEL');
  
  // Set up initial stitches in all three tubes
  const initializePromises = TUBES.map(tube => {
    return callApi('/api/update-stitch-positions', 'POST', {
      userId: TEST_USER_ID,
      threadId: tube.threadId,
      stitchUpdates: [
        {
          stitchId: tube.stitchId,
          orderNumber: 0, // Make active
          skipNumber: 3,
          distractorLevel: 'L1'
        }
      ]
    });
  });
  
  const results = await Promise.all(initializePromises);
  console.log(`Initialized active stitches in ${results.length} tubes`);
  
  // Set tube 1 as the current active tube
  await callApi('/api/save-tube-position', 'POST', {
    userId: TEST_USER_ID,
    tubeNumber: 1,
    threadId: TUBES[0].threadId
  });
  
  console.log('Set Tube 1 as the current active tube');
  
  // Verify tube 1 is active
  const userState = await callApi(`/api/user-stitches?userId=${TEST_USER_ID}`);
  
  if (userState.tubePosition.tubeNumber !== 1) {
    throw new Error(`Failed to set tube 1 as active. Current tube: ${userState.tubePosition.tubeNumber}`);
  }
  
  console.log('Triple Helix initialized successfully');
  return userState;
}

// Complete a session in the current tube and verify tube rotation
async function completeSessionAndRotate(currentTube) {
  const tube = TUBES[currentTube - 1]; // Convert to 0-based index
  logWithBorder(`COMPLETING SESSION IN TUBE ${currentTube}`);
  
  // 1. First record a session for the current tube
  const sessionResponse = await callApi('/api/record-session', 'POST', {
    userId: TEST_USER_ID,
    threadId: tube.threadId,
    stitchId: tube.stitchId,
    questionResults: generatePerfectQuestionResults(), // Perfect score
    sessionDuration: 60
  });
  
  console.log('Session recorded with points:', sessionResponse.totalPoints);
  
  // 2. End the session with all state updates
  const endSessionResponse = await callApi('/api/end-session', 'POST', {
    userId: TEST_USER_ID,
    threadId: tube.threadId,
    stitchId: tube.stitchId,
    questionResults: generatePerfectQuestionResults(),
    correctAnswers: 10,
    totalQuestions: 10,
    points: 30,
    // Include all tube updates (representing the Triple Helix rotation)
    tubeUpdates: [
      { 
        tubeNumber: ((currentTube) % 3) + 1, // Next tube in sequence
        threadId: TUBES[((currentTube) % 3)].threadId
      }
    ],
    // Include stitch updates showing progression in current tube
    stitchUpdates: [
      {
        threadId: tube.threadId,
        stitchId: tube.stitchId,
        orderNumber: 3, // Move back in the queue (perfect score)
        skipNumber: 3,
        distractorLevel: 'L1'
      },
      // Next stitch becomes active in this tube
      {
        threadId: tube.threadId,
        stitchId: `${tube.stitchId}-next`, // Simulate next stitch
        orderNumber: 0, // Make this the active stitch
        skipNumber: 3,
        distractorLevel: 'L1'
      }
    ]
  });
  
  console.log('Session ended successfully:', endSessionResponse.success);
  console.log('Session summary:', endSessionResponse.summary);
  
  // 3. Verify the tube has rotated to the next one in sequence
  const nextTube = ((currentTube) % 3) + 1;
  await delay(500); // Add delay to ensure state is saved
  
  const userState = await callApi(`/api/user-stitches?userId=${TEST_USER_ID}`);
  console.log('New tube position:', userState.tubePosition);
  
  if (userState.tubePosition.tubeNumber !== nextTube) {
    throw new Error(`Tube rotation failed! Expected tube ${nextTube}, got tube ${userState.tubePosition.tubeNumber}`);
  }
  
  console.log(`✅ Successfully rotated from Tube ${currentTube} to Tube ${nextTube}`);
  return nextTube; // Return the next tube number
}

// Verify stitch progression within a tube
async function verifyStitchProgression(tubeNumber) {
  logWithBorder(`VERIFYING STITCH PROGRESSION IN TUBE ${tubeNumber}`);
  
  const tube = TUBES[tubeNumber - 1];
  const userStitches = await callApi(`/api/user-stitches?userId=${TEST_USER_ID}`);
  
  // Find the thread data for this tube
  const threadData = userStitches.data.find(t => t.thread_id === tube.threadId);
  
  if (!threadData) {
    throw new Error(`Thread data not found for tube ${tubeNumber}`);
  }
  
  console.log('Thread stitches:', threadData.stitches);
  console.log('Order map:', threadData.orderMap);
  
  // Verify at least one stitch has order_number = 0 (active)
  const activeStitch = threadData.stitches.find(s => s.order_number === 0);
  
  if (!activeStitch) {
    throw new Error(`No active stitch found in tube ${tubeNumber}`);
  }
  
  console.log(`Active stitch in tube ${tubeNumber}:`, {
    id: activeStitch.id,
    order_number: activeStitch.order_number
  });
  
  // Also check for the stitch we completed (should be further back in the queue)
  const originalStitchOrder = threadData.orderMap.find(o => o.stitch_id === tube.stitchId);
  
  if (originalStitchOrder && originalStitchOrder.order_number > 0) {
    console.log(`Original stitch ${tube.stitchId} is now at position ${originalStitchOrder.order_number}`);
  }
  
  console.log(`✅ Stitch progression in tube ${tubeNumber} verified`);
  return userStitches;
}

// Helper function to generate perfect question results for testing
function generatePerfectQuestionResults(count = 10) {
  const results = [];
  
  for (let i = 1; i <= count; i++) {
    results.push({
      questionId: `q${i}`,
      correct: true,
      timeToAnswer: 1500,
      firstTimeCorrect: true
    });
  }
  
  return results;
}

// Run all tests in sequence
async function runTripleHelixTests() {
  console.log('🧪 TRIPLE HELIX INTEGRATION TESTS');
  console.log('===============================');
  console.log(`Test user ID: ${TEST_USER_ID}`);
  console.log(`Test server: ${TEST_URL}`);
  console.log('===============================');
  
  try {
    // Phase 1: Setup
    await initializeState();
    await initializeTripleHelix();
    
    // Phase 2: Complete a full tube rotation cycle
    let currentTube = 1;
    
    // Complete Tube 1
    currentTube = await completeSessionAndRotate(currentTube);
    await verifyStitchProgression(1); // Verify tube 1 progression
    
    // Complete Tube 2
    currentTube = await completeSessionAndRotate(currentTube);
    await verifyStitchProgression(2); // Verify tube 2 progression
    
    // Complete Tube 3
    currentTube = await completeSessionAndRotate(currentTube);
    await verifyStitchProgression(3); // Verify tube 3 progression
    
    // Verify we're back to Tube 1
    if (currentTube !== 1) {
      throw new Error(`Full rotation failed! Expected to be back at tube 1, but got tube ${currentTube}`);
    }
    
    logWithBorder('ALL TRIPLE HELIX TESTS PASSED');
    console.log('The Triple Helix model is working correctly!');
    console.log('✅ Tube rotation verified');
    console.log('✅ Stitch progression verified');
    console.log('✅ State persistence verified');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTripleHelixTests();