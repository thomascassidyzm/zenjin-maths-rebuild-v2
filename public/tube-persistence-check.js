// Simple script to check tube persistence and provide debugging functionality
(function() {
  // Only run once
  if (window.__tubeDebugActive) return;
  window.__tubeDebugActive = true;
  
  console.log('🔍 TUBE-STATE-CHECK: Initializing tube state checker...');
  
  // Create a container for debug info
  const debugDiv = document.createElement('div');
  debugDiv.style.position = 'fixed';
  debugDiv.style.top = '10px';
  debugDiv.style.right = '10px';
  debugDiv.style.padding = '8px';
  debugDiv.style.background = '#00000080';
  debugDiv.style.color = 'white';
  debugDiv.style.borderRadius = '4px';
  debugDiv.style.zIndex = '10000';
  debugDiv.style.fontSize = '12px';
  debugDiv.style.fontFamily = 'monospace';
  debugDiv.style.maxWidth = '400px';
  debugDiv.style.backdropFilter = 'blur(4px)';
  
  // State storage
  let checkCount = 0;
  let tubeStates = {};
  
  // Function to check all storage locations
  function checkAllStorageLocations() {
    checkCount++;
    const locations = {};
    
    // Get user ID
    const uid = localStorage.getItem('zenjin_user_id') ||
                localStorage.getItem('zenjin_anonymous_id') ||
                'anonymous';
    
    // Check main state
    try {
      const mainState = localStorage.getItem(`zenjin_state_${uid}`);
      if (mainState) {
        const parsed = JSON.parse(mainState);
        locations.main = {
          activeTube: parsed.activeTube || parsed.activeTubeNumber || '?',
          lastUpdated: parsed.lastUpdated || 'unknown'
        };
      }
    } catch (e) {
      locations.main = { error: e.message };
    }
    
    // Check anonymous state
    try {
      const anonState = localStorage.getItem('zenjin_anonymous_state');
      if (anonState) {
        const parsed = JSON.parse(anonState);
        if (parsed.state) {
          locations.anon = {
            activeTube: parsed.state.activeTube || parsed.state.activeTubeNumber || '?',
            lastUpdated: parsed.state.lastUpdated || 'unknown'
          };
        }
      }
    } catch (e) {
      locations.anon = { error: e.message };
    }
    
    // Check triple helix state
    try {
      const triplexState = localStorage.getItem(`triple_helix_state_${uid}`);
      if (triplexState) {
        const parsed = JSON.parse(triplexState);
        locations.triplex = {
          activeTube: parsed.activeTube || parsed.activeTubeNumber || '?',
          lastUpdated: parsed.lastUpdated || 'unknown'
        };
      }
    } catch (e) {
      locations.triplex = { error: e.message };
    }
    
    // Check continue flag
    locations.continueFlag = localStorage.getItem('zenjin_continue_previous_state') === 'true';
    
    // Add adapter info if available
    locations.adapter = window.__stateMachineTubeCyclerAdapter ? 
      { activeTube: window.__stateMachineTubeCyclerAdapter.getCurrentTube() || '?' } : 
      { error: "Adapter not found" };
    
    // Update display
    const allSame = areTubesConsistent(locations);
    
    let html = `<div style="display:flex;justify-content:space-between;margin-bottom:5px">
      <strong>Tube State Check #${checkCount}</strong>
      <span style="cursor:pointer" onclick="window.__refreshTubeStates()">🔄</span>
    </div>`;
    
    html += `<div style="margin-bottom: 8px">
      <strong>User:</strong> ${uid.substring(0, 10)}...
      <strong style="margin-left: 8px">Continue:</strong> 
      <span style="color:${locations.continueFlag ? '#4ADE80' : '#ccc'}">
        ${locations.continueFlag ? 'True' : 'False'}
      </span>
    </div>`;
    
    html += `<div style="margin-bottom: 5px">
      <strong>Status:</strong> 
      <span style="color:${allSame ? '#4ADE80' : '#EF4444'}">
        ${allSame ? '✓ Consistent' : '⚠️ INCONSISTENT'}
      </span>
    </div>`;
    
    html += '<div style="margin-bottom: 8px">';
    
    // Show all locations
    Object.entries(locations).forEach(([key, value]) => {
      if (key !== 'continueFlag') {
        const color = value.error ? '#EF4444' : 
          (value.activeTube === locations.adapter.activeTube ? '#4ADE80' : '#F59E0B');
        
        html += `<div>
          <strong>${key}:</strong> 
          <span style="color:${color}">
            ${value.error ? `Error: ${value.error}` : `Tube ${value.activeTube}`}
          </span>
        </div>`;
      }
    });
    
    html += '</div>';
    
    // Add buttons
    html += `<div style="display:flex;gap:4px;margin-bottom:4px">
      <button onclick="window.__switchTube(1)" style="flex:1;padding:4px;background:#3B82F6;border:none;color:white;border-radius:2px;cursor:pointer">Tube 1</button>
      <button onclick="window.__switchTube(2)" style="flex:1;padding:4px;background:#10B981;border:none;color:white;border-radius:2px;cursor:pointer">Tube 2</button>
      <button onclick="window.__switchTube(3)" style="flex:1;padding:4px;background:#8B5CF6;border:none;color:white;border-radius:2px;cursor:pointer">Tube 3</button>
    </div>`;
    
    html += `<div style="display:flex;gap:4px">
      <button onclick="window.__complete2020()" style="flex:1;padding:4px;background:#22C55E;border:none;color:white;border-radius:2px;cursor:pointer">20/20</button>
      <button onclick="window.__complete1020()" style="flex:1;padding:4px;background:#F97316;border:none;color:white;border-radius:2px;cursor:pointer">10/20</button>
      <button onclick="window.__endAndDashboard()" style="flex:1;padding:4px;background:#EC4899;border:none;color:white;border-radius:2px;cursor:pointer">End+Go</button>
    </div>`;
    
    debugDiv.innerHTML = html;
    tubeStates = locations;
    
    return locations;
  }
  
  // Check if all tube references are the same
  function areTubesConsistent(locations) {
    const tubes = [];
    
    if (locations.main && !locations.main.error) tubes.push(locations.main.activeTube);
    if (locations.anon && !locations.anon.error) tubes.push(locations.anon.activeTube);
    if (locations.triplex && !locations.triplex.error) tubes.push(locations.triplex.activeTube);
    if (locations.adapter && !locations.adapter.error) tubes.push(locations.adapter.activeTube);
    
    // If we have at least 2 locations to compare
    if (tubes.length >= 2) {
      const first = tubes[0];
      return tubes.every(tube => tube === first);
    }
    
    return true; // If only one location, it's consistent with itself
  }
  
  // Set a specific tube in all storage locations
  function setAllTubes(tubeNumber) {
    if (![1, 2, 3].includes(tubeNumber)) {
      console.error(`Invalid tube number: ${tubeNumber}`);
      return false;
    }
    
    // Get user ID
    const uid = localStorage.getItem('zenjin_user_id') ||
                localStorage.getItem('zenjin_anonymous_id') ||
                'anonymous';
    
    // Try adapter first
    if (window.__stateMachineTubeCyclerAdapter && 
        typeof window.__stateMachineTubeCyclerAdapter.setActiveTube === 'function') {
      try {
        window.__stateMachineTubeCyclerAdapter.setActiveTube(tubeNumber);
        console.log(`🔍 TUBE-STATE-CHECK: Set tube ${tubeNumber} using adapter`);
      } catch (e) {
        console.error(`Error using adapter to set tube ${tubeNumber}:`, e);
      }
    }
    
    // Also update all storage locations directly for redundancy
    try {
      // Update main state
      const mainStateKey = `zenjin_state_${uid}`;
      const mainState = localStorage.getItem(mainStateKey);
      if (mainState) {
        const parsed = JSON.parse(mainState);
        parsed.activeTube = tubeNumber;
        parsed.activeTubeNumber = tubeNumber;
        parsed.lastUpdated = new Date().toISOString();
        localStorage.setItem(mainStateKey, JSON.stringify(parsed));
      }
      
      // Update anonymous state
      const anonState = localStorage.getItem('zenjin_anonymous_state');
      if (anonState) {
        const parsed = JSON.parse(anonState);
        if (parsed.state) {
          parsed.state.activeTube = tubeNumber;
          parsed.state.activeTubeNumber = tubeNumber;
          parsed.state.lastUpdated = new Date().toISOString();
          localStorage.setItem('zenjin_anonymous_state', JSON.stringify(parsed));
        }
      }
      
      // Update triple helix state
      const triplexKey = `triple_helix_state_${uid}`;
      const triplexState = localStorage.getItem(triplexKey);
      if (triplexState) {
        const parsed = JSON.parse(triplexState);
        parsed.activeTube = tubeNumber;
        parsed.activeTubeNumber = tubeNumber;
        parsed.lastUpdated = new Date().toISOString();
        localStorage.setItem(triplexKey, JSON.stringify(parsed));
      }
      
      console.log(`🔍 TUBE-STATE-CHECK: Set tube ${tubeNumber} in all storage locations`);
      return true;
    } catch (e) {
      console.error('Error updating tube state:', e);
      return false;
    }
  }
  
  // Complete current stitch with 20/20 score
  function complete2020() {
    if (window.__stateMachineTubeCyclerAdapter && 
        typeof window.__stateMachineTubeCyclerAdapter.handleStitchCompletion === 'function' &&
        typeof window.__stateMachineTubeCyclerAdapter.getCurrentStitch === 'function') {
      try {
        const stitch = window.__stateMachineTubeCyclerAdapter.getCurrentStitch();
        if (stitch) {
          window.__stateMachineTubeCyclerAdapter.handleStitchCompletion(
            stitch.threadId,
            stitch.id,
            20, // Perfect score
            20  // Total questions
          );
          console.log(`🔍 TUBE-STATE-CHECK: Completed stitch ${stitch.id} with 20/20 score`);
          alert('Completed stitch with 20/20 score. Page will reload.');
          window.location.reload();
          return true;
        } else {
          console.error('No current stitch found');
          alert('No current stitch found');
          return false;
        }
      } catch (e) {
        console.error('Error completing stitch:', e);
        alert(`Error completing stitch: ${e.message}`);
        return false;
      }
    } else {
      alert('Adapter not available for stitch completion');
      return false;
    }
  }
  
  // Complete current stitch with 10/20 score
  function complete1020() {
    if (window.__stateMachineTubeCyclerAdapter && 
        typeof window.__stateMachineTubeCyclerAdapter.handleStitchCompletion === 'function' &&
        typeof window.__stateMachineTubeCyclerAdapter.getCurrentStitch === 'function') {
      try {
        const stitch = window.__stateMachineTubeCyclerAdapter.getCurrentStitch();
        if (stitch) {
          window.__stateMachineTubeCyclerAdapter.handleStitchCompletion(
            stitch.threadId,
            stitch.id,
            10, // Partial score
            20  // Total questions
          );
          console.log(`🔍 TUBE-STATE-CHECK: Completed stitch ${stitch.id} with 10/20 score`);
          alert('Completed stitch with 10/20 score. Page will reload.');
          window.location.reload();
          return true;
        } else {
          console.error('No current stitch found');
          alert('No current stitch found');
          return false;
        }
      } catch (e) {
        console.error('Error completing stitch:', e);
        alert(`Error completing stitch: ${e.message}`);
        return false;
      }
    } else {
      alert('Adapter not available for stitch completion');
      return false;
    }
  }
  
  // End session and go to dashboard
  function endAndGoDashboard() {
    try {
      // Set continue flag
      localStorage.setItem('zenjin_continue_previous_state', 'true');
      console.log('🔍 TUBE-STATE-CHECK: Set continue flag and navigating to dashboard');
      
      // Navigate to dashboard
      window.location.href = '/dashboard';
      return true;
    } catch (e) {
      console.error('Error ending session:', e);
      return false;
    }
  }
  
  // Set global functions for button access
  window.__refreshTubeStates = function() {
    console.log('🔍 TUBE-STATE-CHECK: Manual refresh requested');
    checkAllStorageLocations();
  };
  
  window.__switchTube = function(tubeNumber) {
    console.log(`🔍 TUBE-STATE-CHECK: Manual switch to tube ${tubeNumber} requested`);
    if (setAllTubes(tubeNumber)) {
      alert(`Switched to Tube ${tubeNumber}. Page will reload.`);
      window.location.reload();
    } else {
      alert(`Failed to switch to Tube ${tubeNumber}`);
    }
  };
  
  window.__complete2020 = complete2020;
  window.__complete1020 = complete1020;
  window.__endAndDashboard = endAndGoDashboard;
  
  // Try to find the adapter in global scope
  const tryFindAdapter = function() {
    console.log('🔍 TUBE-STATE-CHECK: Searching for adapter...');
    
    // Check if adapter is already exposed
    if (window.__stateMachineTubeCyclerAdapter) {
      console.log('🔍 TUBE-STATE-CHECK: Adapter already found in global scope');
      checkAllStorageLocations();
      return;
    }
    
    // Try to find the adapter in React component props using a common approach
    // This is a simplified approach that may not work in all cases
    try {
      // Find StateMachine instance in React fiber
      Object.keys(window).forEach(key => {
        if (key.startsWith('__REACT_DEVTOOLS') || key.startsWith('__REACT')) {
          return; // Skip React DevTools keys
        }
        
        // Look for tubeCycler property in global objects
        if (window[key] && 
            typeof window[key] === 'object' && 
            window[key].tubeCycler && 
            typeof window[key].tubeCycler.getCurrentTube === 'function') {
          console.log(`🔍 TUBE-STATE-CHECK: Found adapter in global.${key}.tubeCycler`);
          window.__stateMachineTubeCyclerAdapter = window[key].tubeCycler;
        }
      });
    } catch (e) {
      console.error('Error finding adapter:', e);
    }
    
    // Final check
    if (window.__stateMachineTubeCyclerAdapter) {
      console.log('🔍 TUBE-STATE-CHECK: Successfully exposed adapter to global scope');
    } else {
      console.log('🔍 TUBE-STATE-CHECK: Could not find adapter in global scope, only storage info available');
    }
    
    // Run initial check
    checkAllStorageLocations();
  };
  
  // Add to document and run initial check
  document.body.appendChild(debugDiv);
  
  // Wait a bit for everything to initialize
  setTimeout(tryFindAdapter, 2000);
  
  // Set a timer to check state periodically
  setInterval(checkAllStorageLocations, 5000);
  
  console.log('🔍 TUBE-STATE-CHECK: Initialization complete. Debug panel added.');
})();