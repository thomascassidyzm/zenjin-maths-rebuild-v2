// This file has been modified to allow state persistence for testing the position-based model

/**
 * State persistence patch has been disabled to allow server persistence testing
 */
function applyStatePersistencePatch() {
  console.log('STATE PERSISTENCE PATCH DISABLED: Allowing server persistence for testing');

  // No patches applied - allowing normal API functionality
}

// Export but don't apply the patch
export { applyStatePersistencePatch };