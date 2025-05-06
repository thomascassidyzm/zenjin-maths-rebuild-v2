/**
 * Debug User State Persistence
 * 
 * This script provides a direct way to verify user state saving and retrieval
 * without going through the UI. It will help diagnose the issue with state
 * not being properly saved between sessions.
 * 
 * To use:
 * 1. Run this with Node.js: node debug-user-state.js
 * 2. Check console output for detailed diagnosis
 */

const fetch = require('node-fetch');
const fs = require('fs');

// Configuration - CHANGE THESE VALUES AS NEEDED
const API_URL = 'http://localhost:3000'; // URL of your running app
const TEST_USER_ID = 'e45b377a-9d72-4b6b-9b9e-ee8efb26b916'; // Test user ID
const AUTH_TOKEN = ''; // Get this from localStorage in browser if needed

// Sample user state - this simulates what would be stored
const TEST_STATE = {
  userId: TEST_USER_ID,
  tubes: {
    1: { 
      threadId: 'thread-T1-001',
      currentStitchId: 'stitch-T1-001-03', // Deliberately different from default
      position: 2, 
      stitches: [
        { id: 'stitch-T1-001-01', position: 0, threadId: 'thread-T1-001' },
        { id: 'stitch-T1-001-02', position: 1, threadId: 'thread-T1-001' },
        { id: 'stitch-T1-001-03', position: 2, threadId: 'thread-T1-001' }
      ]
    },
    2: { 
      threadId: 'thread-T2-001',
      currentStitchId: 'stitch-T2-001-01',
      position: 0,
      stitches: [
        { id: 'stitch-T2-001-01', position: 0, threadId: 'thread-T2-001' }
      ]
    },
    3: { 
      threadId: 'thread-T3-001',
      currentStitchId: 'stitch-T3-001-01',
      position: 0,
      stitches: [
        { id: 'stitch-T3-001-01', position: 0, threadId: 'thread-T3-001' }
      ]
    }
  },
  activeTube: 1, // Start with tube 1
  cycleCount: 0,
  points: {
    session: 60,
    lifetime: 120
  },
  lastUpdated: new Date().toISOString()
};

/**
 * Save user state via the API
 */
async function saveUserState() {
  console.log('1. Attempting to save user state...');
  console.log(`   User ID: ${TEST_USER_ID}`);
  
  try {
    const response = await fetch(`${API_URL}/api/user-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {})
      },
      body: JSON.stringify({ state: TEST_STATE })
    });
    
    if (!response.ok) {
      console.error(`❌ API returned error: ${response.status} ${response.statusText}`);
      try {
        const errorText = await response.text();
        console.error(`   Error details: ${errorText}`);
      } catch (e) {
        console.error('   Could not read error response');
      }
      return false;
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Successfully saved user state via API');
      return true;
    } else {
      console.error(`❌ API returned success=false: ${data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error saving user state: ${error.message}`);
    console.error(error);
    return false;
  }
}

/**
 * Save user state via the update-state API
 */
async function saveViaUpdateState() {
  console.log('\n2. Trying alternative endpoint (update-state)...');
  console.log(`   User ID: ${TEST_USER_ID}`);
  
  try {
    const response = await fetch(`${API_URL}/api/update-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {})
      },
      body: JSON.stringify({ state: TEST_STATE })
    });
    
    if (!response.ok) {
      console.error(`❌ API returned error: ${response.status} ${response.statusText}`);
      try {
        const errorText = await response.text();
        console.error(`   Error details: ${errorText}`);
      } catch (e) {
        console.error('   Could not read error response');
      }
      return false;
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Successfully saved user state via update-state API');
      return true;
    } else {
      console.error(`❌ API returned success=false: ${data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error saving state via update-state: ${error.message}`);
    console.error(error);
    return false;
  }
}

/**
 * Retrieve user state via the API
 */
async function retrieveUserState() {
  console.log('\n3. Retrieving user state to check if it saved...');
  
  try {
    const response = await fetch(`${API_URL}/api/user-state?userId=${TEST_USER_ID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {})
      }
    });
    
    if (!response.ok) {
      console.error(`❌ API returned error: ${response.status} ${response.statusText}`);
      try {
        const errorText = await response.text();
        console.error(`   Error details: ${errorText}`);
      } catch (e) {
        console.error('   Could not read error response');
      }
      return null;
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Successfully retrieved user state');
      console.log(`   Data source: ${data.source}`);
      
      if (data.state) {
        const state = data.state;
        
        console.log('\nVerifying state content:');
        console.log(`   User ID: ${state.userId}`);
        console.log(`   Active Tube: ${state.activeTube}`);
        console.log(`   Last Updated: ${state.lastUpdated}`);
        
        // Check tubes
        console.log('   Tubes:');
        Object.entries(state.tubes || {}).forEach(([tubeNum, tube]) => {
          console.log(`     Tube ${tubeNum}:`);
          console.log(`       Thread ID: ${tube.threadId}`);
          console.log(`       Current Stitch ID: ${tube.currentStitchId}`);
          console.log(`       Position: ${tube.position}`);
          
          // Compare to the test state to make sure it matches
          if (TEST_STATE.tubes[tubeNum]) {
            const testTube = TEST_STATE.tubes[tubeNum];
            if (tube.currentStitchId !== testTube.currentStitchId) {
              console.error(`❌ MISMATCH: Tube ${tubeNum} currentStitchId differs - expected ${testTube.currentStitchId}, got ${tube.currentStitchId}`);
            }
            if (tube.position !== testTube.position && testTube.position !== undefined) {
              console.error(`❌ MISMATCH: Tube ${tubeNum} position differs - expected ${testTube.position}, got ${tube.position}`);
            }
          }
        });
        
        return state;
      } else {
        console.error('❌ No state found in response, even though API returned success=true');
        return null;
      }
    } else {
      console.error(`❌ API returned success=false: ${data.error || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error retrieving user state: ${error.message}`);
    console.error(error);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== DEBUGGING USER STATE PERSISTENCE ===');
  console.log('This script will attempt to save and retrieve user state\n');
  
  // Save and retrieve user state
  let success = await saveUserState();
  
  // Try alternative endpoint if first one fails
  if (!success) {
    success = await saveViaUpdateState();
  }
  
  // Retrieve user state
  const state = await retrieveUserState();
  
  console.log('\n=== SUMMARY ===');
  if (success) {
    console.log('✅ State save operation reported success');
  } else {
    console.log('❌ Failed to save state via both endpoints');
  }
  
  if (state) {
    console.log('✅ Successfully retrieved state');
    
    // Save response to a file for inspection
    try {
      fs.writeFileSync('user-state-debug-result.json', JSON.stringify(state, null, 2));
      console.log('✅ Saved state to user-state-debug-result.json for inspection');
    } catch (e) {
      console.error(`❌ Could not save state to file: ${e.message}`);
    }
  } else {
    console.log('❌ Failed to retrieve state');
  }
  
  console.log('\nNext steps:');
  console.log('1. If both save and retrieve failed, check server logs for API errors');
  console.log('2. If save succeeded but retrieve failed, check the user_state table in the database');
  console.log('3. If both succeeded but state doesn\'t match, check state transformation in the API');
  console.log('4. Try logging into the app and see if "Continue Learning" now works');
}

// Run main function
main().catch(error => {
  console.error('Uncaught error in main function:');
  console.error(error);
});