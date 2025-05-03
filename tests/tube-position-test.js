/**
 * Tube Position API Test
 * 
 * This test script helps verify that the tube position API is working correctly
 * following our changes to avoid using the non-existent user_tube_position table.
 * 
 * Usage:
 * 1. Run this file with Node.js, e.g., `node tube-position-test.js`
 * 2. Check the console output for test results
 * 3. All tests should pass if the API is working correctly
 * 
 * Tests:
 * 1. Setting tube position via user_stitch_progress table
 * 2. Retrieving the active tube from user_stitches endpoint
 * 3. Resetting user progress and verifying default tube
 */

// CONFIGURATION
const API_BASE_URL = 'http://localhost:3000/api'; // Change to your local dev server
const TEST_USER_ID = 'test-tube-position-user'; // Test user ID (should not be a real user)
const TEST_TUBE_NUMBER = 2; // Test with tube 2
const TEST_THREAD_ID = 'thread-T2-001'; // Thread for tube 2

// Helper function to call APIs
async function callApi(endpoint, method, data) {
  const url = `${API_BASE_URL}/${endpoint}`;
  const options = {
    method: method || 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  };
  
  console.log(`Calling ${method} ${url}`);
  try {
    const response = await fetch(url, options);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} - ${JSON.stringify(result)}`);
    }
    
    return result;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

// Test 1: Save tube position
async function testSaveTubePosition() {
  console.log('\n=== Test 1: Save Tube Position ===');
  
  const data = {
    userId: TEST_USER_ID,
    tubeNumber: TEST_TUBE_NUMBER,
    threadId: TEST_THREAD_ID
  };
  
  try {
    const result = await callApi('save-tube-position', 'POST', data);
    console.log('Result:', result);
    console.log('✅ Test 1 passed: Tube position saved successfully');
    return result;
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
    throw error;
  }
}

// Test 2: Get tube position from user stitches
async function testGetTubePosition() {
  console.log('\n=== Test 2: Get Tube Position ===');
  
  try {
    const result = await callApi(`user-stitches?userId=${TEST_USER_ID}`, 'GET');
    
    console.log('User stitches response received');
    
    // Check if tube position exists in the response
    if (result.tubePosition) {
      console.log('Tube position:', result.tubePosition);
      
      if (result.tubePosition.tubeNumber === TEST_TUBE_NUMBER) {
        console.log(`✅ Test 2 passed: Tube position correctly set to Tube-${TEST_TUBE_NUMBER}`);
      } else {
        console.log(`❌ Test 2 failed: Expected Tube-${TEST_TUBE_NUMBER}, got Tube-${result.tubePosition.tubeNumber}`);
      }
    } else {
      console.log('❌ Test 2 failed: No tube position found in response');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
    throw error;
  }
}

// Test 3: Reset user progress and check default tube
async function testResetProgress() {
  console.log('\n=== Test 3: Reset User Progress ===');
  
  try {
    // Reset progress
    const resetResult = await callApi('reset-user-progress', 'POST', { 
      userId: TEST_USER_ID 
    });
    
    console.log('Reset result:', resetResult);
    
    // Get user stitches to check new tube position
    const stitchesResult = await callApi(`user-stitches?userId=${TEST_USER_ID}`, 'GET');
    
    console.log('User stitches response after reset received');
    
    // Check if tube position exists and is reset to tube 1
    if (stitchesResult.tubePosition) {
      console.log('Tube position after reset:', stitchesResult.tubePosition);
      
      if (stitchesResult.tubePosition.tubeNumber === 1) {
        console.log('✅ Test 3 passed: Tube position correctly reset to Tube-1');
      } else {
        console.log(`❌ Test 3 failed: Expected Tube-1, got Tube-${stitchesResult.tubePosition.tubeNumber}`);
      }
    } else {
      console.log('❌ Test 3 failed: No tube position found in response after reset');
    }
    
    return stitchesResult;
  } catch (error) {
    console.error('❌ Test 3 failed:', error);
    throw error;
  }
}

// Run all tests
async function runTests() {
  console.log('=== Starting Tube Position API Tests ===');
  
  try {
    await testSaveTubePosition();
    await testGetTubePosition();
    await testResetProgress();
    
    console.log('\n=== All Tests Complete ===');
  } catch (error) {
    console.error('\n🚨 Tests failed:', error);
  }
}

// Execute tests
runTests();