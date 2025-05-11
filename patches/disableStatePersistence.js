// This file overrides the persistStateToServer function to prevent unnecessary API calls

/**
 * Run this patch when the page loads to disable direct API calls to /api/user-state
 */
function applyStatePersistencePatch() {
  console.log('APPLYING CRITICAL PATCH: Disabling direct API calls to /api/user-state');
  
  if (typeof window === 'undefined') {
    console.log('Cannot apply patch in server-side rendering context');
    return;
  }
  
  // Wait for the page to load
  setTimeout(() => {
    try {
      // Find playerUtils in the global context (depending on how it's included)
      const playerUtils = window.playerUtils || 
        window.zenjin?.playerUtils || 
        require('../lib/playerUtils');
      
      if (!playerUtils) {
        console.warn('Could not find playerUtils module to patch');
        return;
      }
      
      // Check if the function exists
      if (typeof playerUtils.persistStateToServer === 'function') {
        console.log('Found persistStateToServer function - disabling it');
        
        // Save original for debugging
        const originalFn = playerUtils.persistStateToServer;
        
        // Replace with no-op version
        playerUtils.persistStateToServer = function(...args) {
          console.log('DISABLED: persistStateToServer called with args:', args);
          console.log('Direct API calls to /api/user-state are disabled - use Zustand instead');
          
          // Just return a successful promise
          return Promise.resolve({
            success: true,
            message: 'API call disabled - state NOT persisted to server'
          });
        };
        
        console.log('Successfully disabled persistStateToServer');
      } else {
        console.warn('persistStateToServer function not found - nothing to disable');
      }
      
      // Handle other functions that might call the API
      ['saveStateToServer', 'syncStateToServer', 'updateUserState'].forEach(fnName => {
        if (typeof playerUtils[fnName] === 'function') {
          console.log(`Found ${fnName} - disabling it`);
          playerUtils[fnName] = function(...args) {
            console.log(`DISABLED: ${fnName} called with args:`, args);
            return Promise.resolve({ success: true, disabled: true });
          };
        }
      });
      
      // Also patch any module exports
      if (typeof window.module !== 'undefined' && 
          typeof window.module.exports !== 'undefined' && 
          typeof window.module.exports.persistStateToServer === 'function') {
        window.module.exports.persistStateToServer = playerUtils.persistStateToServer;
      }
      
      console.log('STATE PERSISTENCE PATCH APPLIED SUCCESSFULLY');
    } catch (error) {
      console.error('Failed to apply state persistence patch:', error);
    }
  }, 500); // Delay to ensure modules are loaded
}

// Apply the patch
applyStatePersistencePatch();

// Export for explicit imports
export { applyStatePersistencePatch };