/**
 * Emergency Fix: Disable Direct API Calls
 * 
 * This file contains monkey patches to disable unnecessary direct API calls
 * that should be going through Zustand instead.
 * 
 * IMPORTANT: This is a temporary fix. The proper solution is to refactor the code
 * to use Zustand exclusively for state management.
 */

// Function to apply the patches when imported
export function applyApiCallPatches() {
  console.log('Applying emergency patches to disable unnecessary API calls');
  
  // Attempt to patch playerUtils.ts functions
  try {
    // Get the module
    const playerUtils = require('./playerUtils');
    
    // Save original for debugging
    const originalPersistStateToServer = playerUtils.persistStateToServer;
    
    // Replace with no-op version
    playerUtils.persistStateToServer = function(userId: string, score = 0, questions = 0) {
      console.log('NOOP: persistStateToServer called but disabled (use Zustand instead)');
      console.log(`Would have saved state for user ${userId} with score=${score}, questions=${questions}`);
      
      // Still save to localStorage for data persistence
      if (typeof localStorage !== 'undefined' && userId) {
        try {
          // Extract the current state from localStorage
          const stateKey = `zenjin_state_${userId}`;
          const existingState = localStorage.getItem(stateKey);
          
          if (existingState) {
            console.log(`Saving state to localStorage only for user ${userId}`);
            
            // Update timestamp to mark it as "fresh"
            const state = JSON.parse(existingState);
            state.lastUpdated = Date.now();
            
            localStorage.setItem(stateKey, JSON.stringify(state));
            console.log('State saved to localStorage (API call disabled)');
          }
        } catch (e) {
          console.error('Error saving to localStorage:', e);
        }
      }
      
      // Return a successful result to prevent errors
      return Promise.resolve({
        success: true,
        message: 'API call disabled - state saved to localStorage only'
      });
    };
    
    console.log('Successfully patched persistStateToServer');
    
    // Patch other functions as needed
    // ...
    
    return true;
  } catch (error) {
    console.error('Failed to apply API call patches:', error);
    return false;
  }
}

// Apply patches immediately when imported
if (typeof window !== 'undefined') {
  // Only run in browser
  window.setTimeout(() => {
    applyApiCallPatches();
  }, 0);
}