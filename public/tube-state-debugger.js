// tube-state-debugger.js - Injectable debugging tool for Zenjin Maths tube state
(function() {
  // Check if debugger is already initialized to prevent multiple instances
  if (window.__TUBE_STATE_DEBUGGER_INITIALIZED) return;
  window.__TUBE_STATE_DEBUGGER_INITIALIZED = true;
  
  console.log('[Tube State Debugger] Initializing...');
  
  // Create debugger panel
  const debuggerPanel = document.createElement('div');
  debuggerPanel.id = 'tube-state-debugger';
  debuggerPanel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 350px;
    padding: 15px;
    background-color: rgba(0, 0, 0, 0.85);
    color: white;
    border-radius: 8px;
    font-family: monospace;
    z-index: 9999;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 90vh;
    overflow-y: auto;
  `;
  
  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
    padding-bottom: 8px;
    margin-bottom: 8px;
  `;
  
  const title = document.createElement('div');
  title.textContent = 'Tube State Debugger';
  title.style.fontWeight = 'bold';
  header.appendChild(title);
  
  const buttons = document.createElement('div');
  buttons.style.display = 'flex';
  buttons.style.gap = '5px';
  
  const collapseBtn = document.createElement('button');
  collapseBtn.textContent = '_';
  collapseBtn.style.cssText = `
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    border-radius: 4px;
    padding: 2px 6px;
    cursor: pointer;
  `;
  collapseBtn.title = 'Collapse';
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'X';
  closeBtn.style.cssText = `
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    border-radius: 4px;
    padding: 2px 6px;
    cursor: pointer;
  `;
  closeBtn.title = 'Close';
  
  buttons.appendChild(collapseBtn);
  buttons.appendChild(closeBtn);
  header.appendChild(buttons);
  debuggerPanel.appendChild(header);
  
  // Create content container
  const content = document.createElement('div');
  content.id = 'debug-content';
  debuggerPanel.appendChild(content);
  
  // Create state info display
  const stateInfo = document.createElement('div');
  stateInfo.id = 'debug-state-info';
  stateInfo.style.cssText = `
    margin-bottom: 12px;
    font-size: 12px;
    line-height: 1.4;
  `;
  content.appendChild(stateInfo);
  
  // Create controls container
  const controls = document.createElement('div');
  controls.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;
  content.appendChild(controls);
  
  // Create control buttons
  const createButton = (id, text, color = 'teal') => {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = text;
    button.style.cssText = `
      background-color: ${color};
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      cursor: pointer;
      font-family: monospace;
      margin-bottom: 4px;
    `;
    return button;
  };
  
  const completeStitchPerfectBtn = createButton('debug-complete-stitch-perfect', 'Complete Stitch (Perfect 20/20)');
  const completeStitchPartialBtn = createButton('debug-complete-stitch-partial', 'Complete Stitch (Partial 10/20)');
  const cycleTubeBtn = createButton('debug-cycle-tube', 'Cycle to Next Tube');
  const endSessionBtn = createButton('debug-end-session', 'End Session (Save State)', '#FF5722');
  const resumeSessionBtn = createButton('debug-resume-session', 'Resume Session (Load State)', '#2196F3');
  const toggleContinueFlagBtn = createButton('debug-toggle-continue', 'Toggle Continue Flag', '#9C27B0');
  
  controls.appendChild(completeStitchPerfectBtn);
  controls.appendChild(completeStitchPartialBtn);
  controls.appendChild(cycleTubeBtn);
  controls.appendChild(endSessionBtn);
  controls.appendChild(resumeSessionBtn);
  controls.appendChild(toggleContinueFlagBtn);
  
  // Add panel to DOM
  document.body.appendChild(debuggerPanel);
  
  // States for tracking persistence testing
  let savedState = null;
  let savedTubeNumber = null;
  let sessionEndedManually = false;
  
  // Update state info display
  function updateStateInfo() {
    // Get state from localStorage
    let tripleHelixState = null;
    let mainState = null;
    let anonymousState = null;
    let continueFlag = false;
    let activeTube = '';
    let currentStitchInfo = '';
    let timestamp = '';
    let storage = '';
    
    try {
      // Try to get data from all possible storage locations
      if (localStorage.getItem('zenjin_triple_helix_state')) {
        tripleHelixState = JSON.parse(localStorage.getItem('zenjin_triple_helix_state'));
        storage = 'triple-helix';
      }
      
      if (localStorage.getItem('zenjin_state')) {
        mainState = JSON.parse(localStorage.getItem('zenjin_state'));
        storage = 'main';
      }
      
      if (localStorage.getItem('zenjin_anonymous_state')) {
        anonymousState = JSON.parse(localStorage.getItem('zenjin_anonymous_state'));
        storage = 'anonymous';
      }
      
      continueFlag = localStorage.getItem('zenjin_continue_previous_state') === 'true';
      
      // Determine active tube and current stitch
      let state = tripleHelixState || mainState || anonymousState;
      if (state) {
        if (state.currentTube) {
          activeTube = `Tube ${state.currentTube.number} (${state.currentTube.id})`;
        }
        
        if (state.currentStitch) {
          currentStitchInfo = `Stitch: ${state.currentStitch.id}`;
          if (state.currentStitch.position !== undefined) {
            currentStitchInfo += ` (pos: ${state.currentStitch.position})`;
          }
        }
        
        if (state.lastUpdated) {
          timestamp = new Date(state.lastUpdated).toLocaleTimeString();
        }
      }
    } catch (error) {
      console.error('[Tube State Debugger] Error parsing state:', error);
    }
    
    // Build HTML for state info
    const getTubeColorClass = (tubeNumber) => {
      const tubeColor = tubeNumber?.toString().match(/Tube 1|1/) ? '#4CAF50' : 
                        tubeNumber?.toString().match(/Tube 2|2/) ? '#2196F3' : 
                        tubeNumber?.toString().match(/Tube 3|3/) ? '#FF9800' : '#9C27B0';
      return tubeColor;
    };
    
    const html = `
      <div style="margin-bottom: 8px;">
        <div style="font-weight: bold; color: ${getTubeColorClass(activeTube)};">
          ${activeTube || 'No active tube'}
        </div>
        <div>${currentStitchInfo || 'No current stitch'}</div>
        <div>Storage: ${storage || 'None'}</div>
        <div>Continue Flag: <span style="color: ${continueFlag ? '#4CAF50' : '#F44336'}">
          ${continueFlag ? 'ON' : 'OFF'}
        </span></div>
        ${timestamp ? `<div>Last Updated: ${timestamp}</div>` : ''}
        ${sessionEndedManually ? '<div style="color: #FF9800">Session manually ended</div>' : ''}
      </div>
    `;
    
    stateInfo.innerHTML = html;
  }
  
  // Initialize state display
  updateStateInfo();
  setInterval(updateStateInfo, 2000); // Update every 2 seconds
  
  // Get StateMachineTubeCyclerAdapter instance
  function getAdapter() {
    // Look in window for the player state
    if (window.__PLAYER_STATE__?.adapter) {
      return window.__PLAYER_STATE__.adapter;
    }
    
    // Look for the adapter in React component props
    let adapter = null;
    try {
      // Try to find the adapter in React's fiber node tree
      const findAdapterInReactComponent = (fiber) => {
        if (!fiber) return null;
        
        // Check if this component has props and might have our adapter
        if (fiber.memoizedProps && 
            (fiber.memoizedProps.player || 
             fiber.memoizedProps.tubeCycler || 
             fiber.memoizedProps.adapter)) {
          if (fiber.memoizedProps.player?.tubeCycler) {
            return fiber.memoizedProps.player.tubeCycler;
          }
          if (fiber.memoizedProps.tubeCycler) {
            return fiber.memoizedProps.tubeCycler;
          }
          if (fiber.memoizedProps.adapter) {
            return fiber.memoizedProps.adapter;
          }
        }
        
        // Not found in this component, try in children
        if (fiber.child) {
          const childResult = findAdapterInReactComponent(fiber.child);
          if (childResult) return childResult;
        }
        
        // Try sibling components
        if (fiber.sibling) {
          const siblingResult = findAdapterInReactComponent(fiber.sibling);
          if (siblingResult) return siblingResult;
        }
        
        return null;
      };
      
      // Start searching from the root fiber node
      const rootNode = document.querySelector('#__next')?._reactRootContainer?._internalRoot?.current;
      if (rootNode) {
        adapter = findAdapterInReactComponent(rootNode);
      }
    } catch (error) {
      console.error('[Tube State Debugger] Error finding adapter in React components:', error);
    }
    
    return adapter;
  }
  
  // Helper function to handle state modification with adapter if available
  function handleWithAdapter(action, score) {
    const adapter = getAdapter();
    
    if (adapter) {
      console.log('[Tube State Debugger] Using adapter for action:', action);
      
      switch (action) {
        case 'complete-perfect':
          if (adapter.completeStitchWithPerfectScore) {
            adapter.completeStitchWithPerfectScore();
            return true;
          } else if (adapter.completeCurrentStitch) {
            adapter.completeCurrentStitch({ totalPoints: 200, score: 20, totalQuestions: 20 });
            return true;
          }
          break;
        
        case 'complete-partial':
          if (adapter.completeCurrentStitch) {
            adapter.completeCurrentStitch({ totalPoints: 100, score: 10, totalQuestions: 20 });
            return true;
          }
          break;
        
        case 'cycle-tube':
          if (adapter.cycleToNextTube) {
            adapter.cycleToNextTube();
            return true;
          }
          break;
      }
    }
    
    return false;
  }
  
  // Fallback: Complete stitch by modifying localStorage directly
  function completeWithStateModification(score) {
    // Score should be 10 (partial) or 20 (perfect)
    const totalPoints = score === 20 ? 200 : 100;
    
    // Find all relevant state objects in localStorage
    let states = [];
    
    if (localStorage.getItem('zenjin_triple_helix_state')) {
      try {
        const state = JSON.parse(localStorage.getItem('zenjin_triple_helix_state'));
        states.push({ key: 'zenjin_triple_helix_state', state });
      } catch (error) {
        console.error('[Tube State Debugger] Error parsing triple helix state:', error);
      }
    }
    
    if (localStorage.getItem('zenjin_state')) {
      try {
        const state = JSON.parse(localStorage.getItem('zenjin_state'));
        states.push({ key: 'zenjin_state', state });
      } catch (error) {
        console.error('[Tube State Debugger] Error parsing main state:', error);
      }
    }
    
    if (localStorage.getItem('zenjin_anonymous_state')) {
      try {
        const state = JSON.parse(localStorage.getItem('zenjin_anonymous_state'));
        states.push({ key: 'zenjin_anonymous_state', state });
      } catch (error) {
        console.error('[Tube State Debugger] Error parsing anonymous state:', error);
      }
    }
    
    // Apply simulation of completing stitch with given score
    states.forEach(({ key, state }) => {
      if (state.currentStitch) {
        // Increment position to simulate advancement
        if (state.currentStitch.position !== undefined) {
          state.currentStitch.position += 1;
        }
        
        // Update skip number for perfect scores
        if (score === 20 && state.currentStitch.skipNumber !== undefined) {
          // Apply skip number evolution logic: 1→3→5→10→25→100
          state.currentStitch.skipNumber = 
            state.currentStitch.skipNumber === 1 ? 3 :
            state.currentStitch.skipNumber === 3 ? 5 :
            state.currentStitch.skipNumber === 5 ? 10 :
            state.currentStitch.skipNumber === 10 ? 25 :
            state.currentStitch.skipNumber === 25 ? 100 : 
            state.currentStitch.skipNumber;
        }
        
        // Mark as completed
        state.currentStitch.completed = true;
        
        // Update state
        state.lastUpdated = new Date().getTime();
        localStorage.setItem(key, JSON.stringify(state));
      }
    });
    
    // Force reload after state modification
    window.location.reload();
  }
  
  // Add event listeners to control buttons
  completeStitchPerfectBtn.addEventListener('click', () => {
    console.log('[Tube State Debugger] Completing stitch with perfect score');
    if (!handleWithAdapter('complete-perfect', 20)) {
      completeWithStateModification(20);
    }
    updateStateInfo();
  });
  
  completeStitchPartialBtn.addEventListener('click', () => {
    console.log('[Tube State Debugger] Completing stitch with partial score');
    if (!handleWithAdapter('complete-partial', 10)) {
      completeWithStateModification(10);
    }
    updateStateInfo();
  });
  
  cycleTubeBtn.addEventListener('click', () => {
    console.log('[Tube State Debugger] Cycling to next tube');
    if (!handleWithAdapter('cycle-tube')) {
      // Fallback: attempt to find and use the state machine adapter
      alert('Could not find tube cycler adapter. Please reload the page or try the end/resume session approach.');
    }
    updateStateInfo();
  });
  
  // End session (save current state)
  endSessionBtn.addEventListener('click', () => {
    console.log('[Tube State Debugger] Ending session (saving state)');
    
    // Save current state
    let state = null;
    try {
      // Try to get state from triple helix, main, or anonymous storage
      if (localStorage.getItem('zenjin_triple_helix_state')) {
        state = JSON.parse(localStorage.getItem('zenjin_triple_helix_state'));
      } else if (localStorage.getItem('zenjin_state')) {
        state = JSON.parse(localStorage.getItem('zenjin_state'));
      } else if (localStorage.getItem('zenjin_anonymous_state')) {
        state = JSON.parse(localStorage.getItem('zenjin_anonymous_state'));
      }
      
      // Save the state and current tube number
      if (state) {
        savedState = state;
        savedTubeNumber = state.currentTube?.number || null;
        sessionEndedManually = true;
        
        alert(`Session ended. State saved with Tube ${savedTubeNumber}. Click "Resume Session" to restore this state.`);
      } else {
        alert('No state found to save. Please play at least one question first.');
      }
    } catch (error) {
      console.error('[Tube State Debugger] Error saving state:', error);
      alert('Error saving state. See console for details.');
    }
    
    updateStateInfo();
  });
  
  // Resume session (simulate returning to the app)
  resumeSessionBtn.addEventListener('click', () => {
    console.log('[Tube State Debugger] Resuming session (loading state)');
    
    if (!savedState) {
      alert('No saved state found. Click "End Session" first to save the state.');
      return;
    }
    
    try {
      // Set continue flag to simulate "continue learning" behavior
      localStorage.setItem('zenjin_continue_previous_state', 'true');
      
      // Restore the saved state to all possible storage locations
      if (localStorage.getItem('zenjin_triple_helix_state')) {
        localStorage.setItem('zenjin_triple_helix_state', JSON.stringify(savedState));
      }
      
      if (localStorage.getItem('zenjin_state')) {
        localStorage.setItem('zenjin_state', JSON.stringify(savedState));
      }
      
      if (localStorage.getItem('zenjin_anonymous_state')) {
        localStorage.setItem('zenjin_anonymous_state', JSON.stringify(savedState));
      }
      
      sessionEndedManually = false;
      alert(`Session resumed. State restored with Tube ${savedTubeNumber}.`);
      
      // Force reload to apply the restored state
      window.location.reload();
    } catch (error) {
      console.error('[Tube State Debugger] Error restoring state:', error);
      alert('Error restoring state. See console for details.');
    }
  });
  
  // Toggle continue flag
  toggleContinueFlagBtn.addEventListener('click', () => {
    const currentValue = localStorage.getItem('zenjin_continue_previous_state') === 'true';
    const newValue = !currentValue;
    
    localStorage.setItem('zenjin_continue_previous_state', newValue.toString());
    console.log(`[Tube State Debugger] Continue flag set to: ${newValue}`);
    
    updateStateInfo();
    alert(`Continue flag set to: ${newValue}`);
  });
  
  // Implement collapse/expand functionality
  let isPanelCollapsed = false;
  collapseBtn.addEventListener('click', () => {
    if (isPanelCollapsed) {
      // Expand
      content.style.display = 'block';
      collapseBtn.textContent = '_';
      isPanelCollapsed = false;
    } else {
      // Collapse
      content.style.display = 'none';
      collapseBtn.textContent = '□';
      isPanelCollapsed = true;
    }
  });
  
  // Implement close functionality
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(debuggerPanel);
    window.__TUBE_STATE_DEBUGGER_INITIALIZED = false;
    
    // Remove script element if it was dynamically added
    const scriptElement = document.getElementById('tube-state-debugger-script');
    if (scriptElement) {
      scriptElement.parentNode.removeChild(scriptElement);
    }
  });
  
  // Make panel draggable
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  
  header.addEventListener('mousedown', (e) => {
    // Don't start drag if clicking on buttons
    if (e.target === collapseBtn || e.target === closeBtn) return;
    
    isDragging = true;
    dragOffsetX = e.clientX - debuggerPanel.getBoundingClientRect().left;
    dragOffsetY = e.clientY - debuggerPanel.getBoundingClientRect().top;
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    debuggerPanel.style.left = (e.clientX - dragOffsetX) + 'px';
    debuggerPanel.style.top = (e.clientY - dragOffsetY) + 'px';
    debuggerPanel.style.right = 'auto';
    debuggerPanel.style.bottom = 'auto';
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });
  
  console.log('[Tube State Debugger] Initialization complete');
})();