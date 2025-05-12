/**
 * Simple Debug Controls
 * 
 * Adds simple, practical debug buttons to assist testing:
 * - Complete stitch with 20/20 score
 * - Cycle to next tube
 * - Toggle continue flag
 */
(function() {
  // Check if already initialized
  if (window.__SIMPLE_DEBUG_INITIALIZED) return;
  window.__SIMPLE_DEBUG_INITIALIZED = true;
  
  console.log('[Simple Debug] Initializing...');
  
  // Create the debug panel
  const debugPanel = document.createElement('div');
  debugPanel.id = 'simple-debug-controls';
  debugPanel.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background-color: rgba(0, 0, 0, 0.7);
    padding: 10px;
    border-radius: 5px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  `;
  
  // Create control buttons
  const completeBtn = document.createElement('button');
  completeBtn.textContent = '✅ Complete Stitch (20/20)';
  completeBtn.style.cssText = `
    background-color: #2c6e2c;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    font-family: system-ui, sans-serif;
    font-size: 14px;
  `;
  
  const cycleTubeBtn = document.createElement('button');
  cycleTubeBtn.textContent = '🔄 Cycle to Next Tube';
  cycleTubeBtn.style.cssText = `
    background-color: #2c5a8c;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    font-family: system-ui, sans-serif;
    font-size: 14px;
  `;
  
  const continueFlagBtn = document.createElement('button');
  continueFlagBtn.textContent = '🚩 Toggle Continue Flag';
  continueFlagBtn.style.cssText = `
    background-color: #8c2c5a;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    font-family: system-ui, sans-serif;
    font-size: 14px;
  `;
  
  const statusDisplay = document.createElement('div');
  statusDisplay.style.cssText = `
    color: white;
    font-family: system-ui, sans-serif;
    font-size: 12px;
    margin-top: 4px;
  `;
  statusDisplay.textContent = 'Debug controls ready';
  
  // Add buttons to panel
  debugPanel.appendChild(completeBtn);
  debugPanel.appendChild(cycleTubeBtn);
  debugPanel.appendChild(continueFlagBtn);
  debugPanel.appendChild(statusDisplay);
  
  // Add panel to DOM
  document.body.appendChild(debugPanel);
  
  // Function to get the adapter
  function getAdapter() {
    // Try to find the adapter in window state
    if (window.__PLAYER_STATE__?.adapter) {
      return window.__PLAYER_STATE__.adapter;
    }
    
    // Try to find the adapter in React component props
    try {
      // Look for known element IDs that might contain the player
      const possibleContainers = [
        document.getElementById('__next'),
        document.querySelector('.player-container'),
        document.querySelector('.minimal-player')
      ];
      
      for (const container of possibleContainers) {
        if (!container) continue;
        
        // Look for any elements with _reactProps
        const allElements = container.querySelectorAll('*');
        for (const element of allElements) {
          // Check if this element has React props with player or adapter
          const reactProps = element._reactProps || element.__reactProps;
          if (reactProps) {
            if (reactProps.player?.tubeCycler) {
              return reactProps.player.tubeCycler;
            }
            if (reactProps.tubeCycler) {
              return reactProps.tubeCycler;
            }
            if (reactProps.adapter) {
              return reactProps.adapter;
            }
          }
        }
      }
    } catch (e) {
      console.log('[Simple Debug] Error finding adapter in React components:', e);
    }
    
    // As a fallback, try to find window.player
    return window.player?.tubeCycler || null;
  }
  
  // Function to complete stitch with perfect score
  function completeStitchPerfect() {
    try {
      statusDisplay.textContent = 'Attempting to complete stitch...';
      
      // Try to get the adapter
      const adapter = getAdapter();
      
      if (adapter) {
        console.log('[Simple Debug] Using adapter to complete stitch');
        
        // Try different methods that might be available
        if (typeof adapter.completeStitchWithPerfectScore === 'function') {
          adapter.completeStitchWithPerfectScore();
          statusDisplay.textContent = 'Stitch completed with perfect score via adapter!';
          return true;
        }
        
        if (typeof adapter.completeCurrentStitch === 'function') {
          adapter.completeCurrentStitch({ 
            totalPoints: 200, 
            score: 20, 
            totalQuestions: 20 
          });
          statusDisplay.textContent = 'Stitch completed with perfect score via adapter!';
          return true;
        }
      }
      
      // Fallback to simulating a perfect score using localStorage
      console.log('[Simple Debug] No adapter found, trying localStorage update');
      
      // Find all tube states in localStorage
      const stores = [
        { key: 'zenjin_state', state: getStateFromLocalStorage('zenjin_state') },
        { key: 'zenjin_triple_helix_state', state: getStateFromLocalStorage('zenjin_triple_helix_state') },
        { key: 'zenjin_anonymous_state', state: getStateFromLocalStorage('zenjin_anonymous_state') }
      ].filter(store => store.state);
      
      if (stores.length === 0) {
        statusDisplay.textContent = 'No state found in localStorage!';
        return false;
      }
      
      // Update each state store
      let updated = false;
      for (const store of stores) {
        // Get the active tube and its current stitch
        const activeTubeNumber = store.state.activeTubeNumber;
        const activeTube = store.state.tubes[activeTubeNumber];
        
        if (!activeTube || !activeTube.currentStitchId) {
          console.log(`[Simple Debug] No current stitch in ${store.key}`);
          continue;
        }
        
        // Find the current stitch
        const currentStitchId = activeTube.currentStitchId;
        const stitches = activeTube.stitches || [];
        const currentStitchIndex = stitches.findIndex(s => s.id === currentStitchId);
        
        if (currentStitchIndex === -1) {
          console.log(`[Simple Debug] Stitch ${currentStitchId} not found in ${store.key}`);
          continue;
        }
        
        // Mark the stitch as completed
        const currentStitch = stitches[currentStitchIndex];
        currentStitch.completed = true;
        
        // Update skip number (follow the progression: 1→3→5→10→25→100)
        if (currentStitch.skipNumber !== undefined) {
          currentStitch.skipNumber = 
            currentStitch.skipNumber === 1 ? 3 :
            currentStitch.skipNumber === 3 ? 5 :
            currentStitch.skipNumber === 5 ? 10 :
            currentStitch.skipNumber === 10 ? 25 :
            currentStitch.skipNumber === 25 ? 100 : 
            currentStitch.skipNumber;
        }
        
        // Get the next stitch (which should be at position 1)
        const nextStitch = stitches.find(s => s.position === 1);
        if (nextStitch) {
          // Update active stitch to the next one
          activeTube.currentStitchId = nextStitch.id;
        }
        
        // Update timestamp
        store.state.lastUpdated = new Date().toISOString();
        
        // Save back to localStorage
        localStorage.setItem(store.key, JSON.stringify(store.state));
        updated = true;
      }
      
      if (updated) {
        statusDisplay.textContent = 'Stitch completed via localStorage! Reloading...';
        // Force reload to apply changes
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        return true;
      } else {
        statusDisplay.textContent = 'Failed to complete stitch - no valid state found';
        return false;
      }
    } catch (e) {
      console.error('[Simple Debug] Error completing stitch:', e);
      statusDisplay.textContent = 'Error completing stitch: ' + e.message;
      return false;
    }
  }
  
  // Function to cycle to next tube
  function cycleTube() {
    try {
      statusDisplay.textContent = 'Attempting to cycle tube...';
      
      // Try to get the adapter
      const adapter = getAdapter();
      
      if (adapter) {
        console.log('[Simple Debug] Using adapter to cycle tube');
        
        // Try different methods that might be available
        if (typeof adapter.cycleToNextTube === 'function') {
          adapter.cycleToNextTube();
          statusDisplay.textContent = 'Cycled to next tube via adapter!';
          return true;
        }
      }
      
      // Fallback to changing tube number in localStorage
      console.log('[Simple Debug] No adapter found, trying localStorage update');
      
      // Find all tube states in localStorage
      const stores = [
        { key: 'zenjin_state', state: getStateFromLocalStorage('zenjin_state') },
        { key: 'zenjin_triple_helix_state', state: getStateFromLocalStorage('zenjin_triple_helix_state') },
        { key: 'zenjin_anonymous_state', state: getStateFromLocalStorage('zenjin_anonymous_state') }
      ].filter(store => store.state);
      
      if (stores.length === 0) {
        statusDisplay.textContent = 'No state found in localStorage!';
        return false;
      }
      
      // Update each state store
      let updated = false;
      for (const store of stores) {
        // Get current tube number
        const currentTube = store.state.activeTubeNumber || 1;
        
        // Calculate next tube (1→2→3→1)
        const nextTube = currentTube >= 3 ? 1 : currentTube + 1;
        
        // Update active tube number
        store.state.activeTubeNumber = nextTube;
        
        // Update timestamp
        store.state.lastUpdated = new Date().toISOString();
        
        // Save back to localStorage
        localStorage.setItem(store.key, JSON.stringify(store.state));
        updated = true;
      }
      
      if (updated) {
        statusDisplay.textContent = `Cycled to tube ${stores[0].state.activeTubeNumber}! Reloading...`;
        // Force reload to apply changes
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        return true;
      } else {
        statusDisplay.textContent = 'Failed to cycle tube - no valid state found';
        return false;
      }
    } catch (e) {
      console.error('[Simple Debug] Error cycling tube:', e);
      statusDisplay.textContent = 'Error cycling tube: ' + e.message;
      return false;
    }
  }
  
  // Function to toggle continue flag
  function toggleContinueFlag() {
    try {
      // Get current value
      const currentValue = localStorage.getItem('zenjin_continue_previous_state') === 'true';
      const newValue = !currentValue;
      
      // Set new value
      localStorage.setItem('zenjin_continue_previous_state', newValue.toString());
      
      statusDisplay.textContent = `Continue flag set to ${newValue ? 'ON' : 'OFF'}`;
      return true;
    } catch (e) {
      console.error('[Simple Debug] Error toggling continue flag:', e);
      statusDisplay.textContent = 'Error toggling continue flag: ' + e.message;
      return false;
    }
  }
  
  // Helper to safely get state from localStorage
  function getStateFromLocalStorage(key) {
    const value = localStorage.getItem(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error(`[Simple Debug] Error parsing ${key}:`, e);
      return null;
    }
  }
  
  // Add event listeners to buttons
  completeBtn.addEventListener('click', completeStitchPerfect);
  cycleTubeBtn.addEventListener('click', cycleTube);
  continueFlagBtn.addEventListener('click', toggleContinueFlag);
  
  // Make the panel draggable
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  
  debugPanel.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragOffsetX = e.clientX - debugPanel.getBoundingClientRect().left;
    dragOffsetY = e.clientY - debugPanel.getBoundingClientRect().top;
    debugPanel.style.cursor = 'grabbing';
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    debugPanel.style.left = (e.clientX - dragOffsetX) + 'px';
    debugPanel.style.top = (e.clientY - dragOffsetY) + 'px';
    debugPanel.style.bottom = 'auto';
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    debugPanel.style.cursor = 'grab';
  });
  
  // Check existence of debug controls periodically
  const checkInterval = setInterval(() => {
    if (!document.body.contains(debugPanel)) {
      clearInterval(checkInterval);
      console.log('[Simple Debug] Controls removed from DOM, reinitializing...');
      window.__SIMPLE_DEBUG_INITIALIZED = false;
      
      // Re-add the script to reinitialize
      const script = document.createElement('script');
      script.src = '/simple-debug-controls.js';
      document.head.appendChild(script);
    }
  }, 5000);
  
  console.log('[Simple Debug] Initialization complete');
})();