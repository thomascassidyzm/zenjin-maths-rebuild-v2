/**
 * Simple test script to verify user state saving and retrieving
 * 
 * Run this with:
 * node test-user-state.js
 */
const fetch = require('node-fetch');

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'e45b377a-9d72-4b6b-9b9e-ee8efb26b916'; // Use your test user ID
const DEBUG = true;

/**
 * Test saving user state
 */
async function testSaveUserState() {
  console.log('\n--- TESTING SAVE USER STATE ---');
  
  // Create a test state
  const testState = {
    userId: TEST_USER_ID,
    lastUpdated: new Date().toISOString(),
    activeTube: 1,
    tubes: {
      1: {
        threadId: 'thread-T1-001',
        currentStitchId: 'stitch-T1-001-01',
        position: 0
      }
    },
    stats: {
      lastActive: new Date().toISOString(),
      totalPoints: 120,
      sessionsCompleted: 3
    }
  };
  
  try {
    // Call the update-state API
    const response = await fetch(`${BASE_URL}/api/update-state${DEBUG ? '?debug=true' : ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state: testState
      })
    });
    
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    if (response.ok && data.success) {
      console.log('✅ Successfully saved user state');
    } else {
      console.log('❌ Failed to save user state');
    }
  } catch (error) {
    console.error('Error during save test:', error);
  }
}

/**
 * Test retrieving user state
 */
async function testGetUserState() {
  console.log('\n--- TESTING GET USER STATE ---');
  
  try {
    // Call the user-state API
    const response = await fetch(`${BASE_URL}/api/user-state?userId=${TEST_USER_ID}${DEBUG ? '&debug=true' : ''}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Success:', data.success);
    console.log('Source:', data.source);
    
    if (response.ok && data.success) {
      console.log('✅ Successfully retrieved user state');
      
      // Print some state info for verification
      if (data.state) {
        console.log('State userId:', data.state.userId);
        console.log('State lastUpdated:', data.state.lastUpdated);
        console.log('State activeTube:', data.state.activeTube);
        console.log('State tubes:', Object.keys(data.state.tubes || {}).length, 'tubes');
        console.log('State stats:', data.state.stats);
      } else {
        console.log('❌ No state data in response');
      }
    } else {
      console.log('❌ Failed to retrieve user state');
    }
  } catch (error) {
    console.error('Error during get test:', error);
  }
}

/**
 * Run tests
 */
async function runTests() {
  console.log('STARTING USER STATE TESTS');
  console.log('========================');
  
  // First test saving state
  await testSaveUserState();
  
  // Wait a moment to ensure data is saved
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Then test retrieving state
  await testGetUserState();
  
  console.log('\nTESTS COMPLETED');
}

// Run the tests
runTests();