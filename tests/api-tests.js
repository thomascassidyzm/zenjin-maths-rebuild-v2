/**
 * API Tests for Zenjin Maths
 * 
 * This test script verifies that all API endpoints for data persistence work correctly.
 * It tests:
 * 1. Tube position saving and retrieval
 * 2. Session recording
 * 3. End session handling
 * 4. Stitch progress updates
 * 5. User state persistence
 * 
 * Usage:
 * 1. Start your development server
 * 2. Run this file with Node.js: node tests/api-tests.js
 * 3. Check the console output for test results
 */

const fetch = require('node-fetch');
const TEST_URL = 'http://localhost:3000'; // Change this to your test server URL
const TEST_USER_ID = 'test-user-' + Date.now().toString(36); // Generate a unique test user ID
let sessionId;

// Test utilities
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTest(name, testFn) {
  console.log(`\n📋 Running test: ${name}`);
  try {
    await testFn();
    console.log(`✅ Test passed: ${name}`);
    return true;
  } catch (error) {
    console.error(`❌ Test failed: ${name}`);
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      try {
        const text = await error.response.text();
        console.error(`   Response: ${text}`);
      } catch (e) {
        console.error(`   Could not read response body`);
      }
    }
    return false;
  }
}

async function callApi(path, method = 'GET', body = null) {
  const url = `${TEST_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': TEST_USER_ID // Add test user ID for API endpoints that check headers
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  console.log(`📡 ${method} ${url}`);
  if (body) {
    console.log(`📦 Body: ${JSON.stringify(body, null, 2)}`);
  }
  
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type');
  
  if (!response.ok) {
    const error = new Error(`API call failed with status ${response.status}`);
    error.response = response;
    throw error;
  }
  
  // Parse response based on content type
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  } else {
    return await response.text();
  }
}

// Test 1: Save tube position
async function testSaveTubePosition() {
  const data = {
    userId: TEST_USER_ID,
    tubeNumber: 2,
    threadId: 'thread-T2-001'
  };
  
  const result = await callApi('/api/save-tube-position', 'POST', data);
  
  if (!result.success) {
    throw new Error('Expected success: true, got: ' + JSON.stringify(result));
  }
  
  console.log('Tube position saved successfully:', result);
  return result;
}

// Test 2: Get user stitches (verify tube position retrieval)
async function testGetUserStitches() {
  // Add a small delay to ensure the previous save is processed
  await delay(500);
  
  const result = await callApi(`/api/user-stitches?userId=${TEST_USER_ID}`);
  
  if (!result.success) {
    throw new Error('Expected success: true, got: ' + JSON.stringify(result));
  }
  
  if (!result.tubePosition) {
    throw new Error('Expected tubePosition in result, but it was missing');
  }
  
  if (result.tubePosition.tubeNumber !== 2) {
    throw new Error(`Expected tubeNumber: 2, got: ${result.tubePosition.tubeNumber}`);
  }
  
  console.log('User stitches retrieved successfully with correct tube position:', result.tubePosition);
  return result;
}

// Test 3: Record a session
async function testRecordSession() {
  const data = {
    userId: TEST_USER_ID,
    threadId: 'thread-T2-001',
    stitchId: 'stitch-T2-001-01',
    questionResults: [
      {
        questionId: 'q1',
        correct: true,
        timeToAnswer: 1500,
        firstTimeCorrect: true
      },
      {
        questionId: 'q2',
        correct: true,
        timeToAnswer: 2000,
        firstTimeCorrect: true
      },
      {
        questionId: 'q3',
        correct: false,
        timeToAnswer: 3000,
        firstTimeCorrect: false
      }
    ],
    sessionDuration: 60 // 60 seconds
  };
  
  const result = await callApi('/api/record-session', 'POST', data);
  
  // Check if the response contains expected fields
  if (!result.sessionId || !result.totalPoints) {
    throw new Error(`Missing expected fields in response: ${JSON.stringify(result)}`);
  }
  
  console.log('Session recorded successfully:', result);
  sessionId = result.sessionId;
  return result;
}

// Test 4: End session
async function testEndSession() {
  const data = {
    userId: TEST_USER_ID,
    threadId: 'thread-T2-001',
    stitchId: 'stitch-T2-001-01',
    questionResults: [
      {
        questionId: 'q1',
        correct: true,
        timeToAnswer: 1500,
        firstTimeCorrect: true
      },
      {
        questionId: 'q2',
        correct: true,
        timeToAnswer: 2000,
        firstTimeCorrect: true
      }
    ],
    correctAnswers: 2,
    totalQuestions: 2,
    points: 10,
    tubeUpdates: [
      {
        tubeNumber: 2,
        threadId: 'thread-T2-001'
      }
    ],
    stitchUpdates: [
      {
        threadId: 'thread-T2-001',
        stitchId: 'stitch-T2-001-01',
        orderNumber: 0,
        skipNumber: 3,
        distractorLevel: 'L1'
      }
    ]
  };
  
  const result = await callApi('/api/end-session', 'POST', data);
  
  if (!result.success) {
    throw new Error('Expected success: true, got: ' + JSON.stringify(result));
  }
  
  if (!result.summary) {
    throw new Error('Expected summary in result, but it was missing');
  }
  
  console.log('Session ended successfully with summary:', result.summary);
  return result;
}

// Test 5: Update stitch positions
async function testUpdateStitchPositions() {
  const data = {
    userId: TEST_USER_ID,
    threadId: 'thread-T2-001',
    stitchUpdates: [
      {
        stitchId: 'stitch-T2-001-01',
        orderNumber: 3,  // Move back in the queue
        skipNumber: 2,
        distractorLevel: 'L2'
      },
      {
        stitchId: 'stitch-T2-001-02',
        orderNumber: 0,  // Make this the active stitch
        skipNumber: 3,
        distractorLevel: 'L1'
      }
    ]
  };
  
  const result = await callApi('/api/update-stitch-positions', 'POST', data);
  
  if (!result.success) {
    throw new Error('Expected success: true, got: ' + JSON.stringify(result));
  }
  
  console.log('Stitch positions updated successfully:', result);
  return result;
}

// Test 6: Reset user progress
async function testResetUserProgress() {
  const data = {
    userId: TEST_USER_ID
  };
  
  const result = await callApi('/api/reset-user-progress', 'POST', data);
  
  if (!result.success) {
    throw new Error('Expected success: true, got: ' + JSON.stringify(result));
  }
  
  console.log('User progress reset successfully:', result);
  return result;
}

// Test 7: Verify reset (check if tube position is back to default)
async function testVerifyReset() {
  await delay(500);
  
  const result = await callApi(`/api/user-stitches?userId=${TEST_USER_ID}`);
  
  if (!result.success) {
    throw new Error('Expected success: true, got: ' + JSON.stringify(result));
  }
  
  if (!result.tubePosition) {
    throw new Error('Expected tubePosition in result, but it was missing');
  }
  
  if (result.tubePosition.tubeNumber !== 1) {
    throw new Error(`Expected tubeNumber: 1 after reset, got: ${result.tubePosition.tubeNumber}`);
  }
  
  console.log('Reset verification successful - tube position reset to Tube 1');
  return result;
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Starting API Tests');
  console.log('====================');
  console.log(`Test user ID: ${TEST_USER_ID}`);
  console.log(`Test server: ${TEST_URL}`);
  console.log('====================\n');
  
  const testResults = [];
  
  // Run each test and track results
  testResults.push(await runTest('Save tube position', testSaveTubePosition));
  testResults.push(await runTest('Get user stitches', testGetUserStitches));
  testResults.push(await runTest('Record session', testRecordSession));
  testResults.push(await runTest('End session', testEndSession));
  testResults.push(await runTest('Update stitch positions', testUpdateStitchPositions));
  testResults.push(await runTest('Reset user progress', testResetUserProgress));
  testResults.push(await runTest('Verify reset', testVerifyReset));
  
  // Summary
  const passedCount = testResults.filter(result => result).length;
  const failedCount = testResults.length - passedCount;
  
  console.log('\n====================');
  console.log('📊 Test Summary');
  console.log('====================');
  console.log(`Total tests: ${testResults.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log('====================');
  
  if (failedCount === 0) {
    console.log('🎉 All tests passed! Ready for deployment.');
  } else {
    console.log('❌ Some tests failed. Fix issues before deploying.');
    process.exit(1); // Exit with error code for CI/CD pipelines
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});