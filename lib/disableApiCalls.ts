/**
 * API Calls Handler - Modified to allow server persistence
 *
 * This file was previously disabling API calls, but has been modified to allow
 * Zustand store server persistence to function correctly for testing the position-based model.
 */

// Modified function that no longer disables API calls
export function applyApiCallPatches() {
  console.log('API call patching has been DISABLED to allow server persistence');
  return true;
}

// Don't apply any patches
if (typeof window !== 'undefined') {
  // Only run in browser
  window.setTimeout(() => {
    console.log('Server persistence patches have been disabled - allowing all Zustand API calls');
  }, 0);
}