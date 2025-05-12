/**
 * Enhanced State Debugger
 * 
 * A robust debug tool for Zenjin Maths that:
 * - Works reliably across page reloads
 * - Focuses on localStorage state monitoring
 * - Works without requiring adapter access
 * - Provides state manipulation capabilities
 * - Tracks state changes over time
 */
(function() {
  // Prevent multiple initializations
  if (window.__ENHANCED_STATE_DEBUGGER_INITIALIZED) return;
  window.__ENHANCED_STATE_DEBUGGER_INITIALIZED = true;
  
  console.log('[Enhanced State Debugger] Initializing...');
  
  // Set up state tracking
  const STATE_KEYS = [
    'zenjin_state',
    'zenjin_triple_helix_state', 
    'zenjin_anonymous_state',
    'zenjin_continue_previous_state',
    'zenjin_user_id',
    'zenjin_auth_state'
  ];
  
  // State history tracking (up to 10 states per key)
  const stateHistory = {};
  STATE_KEYS.forEach(key => {
    stateHistory[key] = [];
  });
  
  // Track inconsistencies
  let inconsistenciesFound = 0;
  
  // Create the debug panel
  const debugPanel = document.createElement('div');
  debugPanel.id = 'enhanced-state-debugger';
  debugPanel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 400px;
    max-height: 80vh;
    overflow-y: auto;
    background-color: rgba(5, 5, 5, 0.9);
    color: white;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    padding: 10px;
    border-radius: 5px;
    z-index: 10000;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;
  
  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #666;
    padding-bottom: 8px;
    margin-bottom: 4px;
  `;
  
  // Add title
  const title = document.createElement('div');
  title.textContent = '🔍 Enhanced State Debugger';
  title.style.cssText = `
    font-weight: bold;
    color: #5ee;
  `;
  header.appendChild(title);
  
  // Add controls
  const controls = document.createElement('div');
  controls.style.cssText = `
    display: flex;
    gap: 8px;
  `;
  
  // Add refresh button
  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = '🔄';
  refreshBtn.title = 'Refresh state view';
  refreshBtn.style.cssText = `
    background: none;
    border: 1px solid #666;
    color: white;
    border-radius: 3px;
    cursor: pointer;
    font-size: 10px;
    padding: 2px 4px;
  `;
  controls.appendChild(refreshBtn);
  
  // Add minimize button
  const minimizeBtn = document.createElement('button');
  minimizeBtn.textContent = '—';
  minimizeBtn.title = 'Minimize panel';
  minimizeBtn.style.cssText = `
    background: none;
    border: 1px solid #666;
    color: white;
    border-radius: 3px;
    cursor: pointer;
    font-size: 10px;
    padding: 2px 4px;
  `;
  controls.appendChild(minimizeBtn);
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.title = 'Close debugger';
  closeBtn.style.cssText = `
    background: none;
    border: 1px solid #666;
    color: white;
    border-radius: 3px;
    cursor: pointer;
    font-size: 10px;
    padding: 2px 4px;
  `;
  controls.appendChild(closeBtn);
  
  header.appendChild(controls);
  debugPanel.appendChild(header);
  
  // Create main content area
  const content = document.createElement('div');
  content.id = 'enhanced-debug-content';
  content.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;
  debugPanel.appendChild(content);
  
  // Create status section
  const statusSection = document.createElement('div');
  statusSection.id = 'debug-status';
  content.appendChild(statusSection);
  
  // Create state info section
  const stateInfo = document.createElement('div');
  stateInfo.id = 'debug-state-info';
  content.appendChild(stateInfo);
  
  // Create actions section
  const actionsSection = document.createElement('div');
  actionsSection.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid #666;
    padding-top: 8px;
    margin-top: 4px;
  `;
  
  // Create fix button
  const fixStateBtn = document.createElement('button');
  fixStateBtn.textContent = '🔧 Fix Inconsistencies';
  fixStateBtn.style.cssText = `
    background: #2a2a2a;
    border: 1px solid #666;
    color: white;
    border-radius: 3px;
    cursor: pointer;
    padding: 6px;
  `;
  actionsSection.appendChild(fixStateBtn);
  
  // Create set continue flag button
  const setContinueFlagBtn = document.createElement('button');
  setContinueFlagBtn.textContent = '🚩 Toggle Continue Flag';
  setContinueFlagBtn.style.cssText = `
    background: #2a2a2a;
    border: 1px solid #666;
    color: white;
    border-radius: 3px;
    cursor: pointer;
    padding: 6px;
  `;
  actionsSection.appendChild(setContinueFlagBtn);
  
  // Create simulate tube change button
  const simulateTubeChangeBtn = document.createElement('button');
  simulateTubeChangeBtn.textContent = '🔄 Simulate Tube Change';
  simulateTubeChangeBtn.style.cssText = `
    background: #2a2a2a;
    border: 1px solid #666;
    color: white;
    border-radius: 3px;
    cursor: pointer;
    padding: 6px;
  `;
  actionsSection.appendChild(simulateTubeChangeBtn);
  
  // Create force tube count button
  const forceTubeBtn = document.createElement('button');
  forceTubeBtn.textContent = '🔢 Force Active Tube';
  forceTubeBtn.style.cssText = `
    background: #2a2a2a;
    border: 1px solid #666;
    color: white;
    border-radius: 3px;
    cursor: pointer;
    padding: 6px;
  `;
  actionsSection.appendChild(forceTubeBtn);
  
  content.appendChild(actionsSection);
  
  // Create history section
  const historyToggle = document.createElement('button');
  historyToggle.textContent = '📜 Show History';
  historyToggle.style.cssText = `
    background: #2a2a2a;
    border: 1px solid #666;
    color: white;
    border-radius: 3px;
    cursor: pointer;
    padding: 6px;
    margin-top: 8px;
  `;
  content.appendChild(historyToggle);
  
  const historySection = document.createElement('div');
  historySection.id = 'debug-history';
  historySection.style.cssText = `
    display: none;
    padding: 5px;
    background-color: rgba(30, 30, 30, 0.8);
    border-radius: 3px;
    margin-top: 5px;
  `;
  content.appendChild(historySection);
  
  // Add the panel to the DOM
  document.body.appendChild(debugPanel);
  
  // Helper to safely parse JSON with fallback
  function safeParseJSON(str, fallback = null) {
    if (!str) return fallback;
    try {
      return JSON.parse(str);
    } catch (e) {
      console.error('Error parsing JSON:', e);
      return fallback;
    }
  }
  
  // Get current tube info from various sources
  function getCurrentTubeInfo() {
    const result = {
      main: null,
      triplex: null,
      anonymous: null,
      userId: localStorage.getItem('zenjin_user_id'),
      continueFlag: localStorage.getItem('zenjin_continue_previous_state') === 'true',
      authState: localStorage.getItem('zenjin_auth_state') || 'unknown',
      isConsistent: true
    };
    
    // Try to get from main state
    const mainState = safeParseJSON(localStorage.getItem('zenjin_state'));
    if (mainState && mainState.activeTubeNumber) {
      result.main = {
        number: mainState.activeTubeNumber,
        id: mainState.tubes && mainState.tubes[mainState.activeTubeNumber] ? 
          mainState.tubes[mainState.activeTubeNumber].threadId : 'unknown'
      };
    }
    
    // Try to get from triple helix state
    const triplexState = safeParseJSON(localStorage.getItem('zenjin_triple_helix_state'));
    if (triplexState && triplexState.activeTubeNumber) {
      result.triplex = {
        number: triplexState.activeTubeNumber,
        id: triplexState.tubes && triplexState.tubes[triplexState.activeTubeNumber] ? 
          triplexState.tubes[triplexState.activeTubeNumber].threadId : 'unknown'
      };
    }
    
    // Try to get from anonymous state
    const anonState = safeParseJSON(localStorage.getItem('zenjin_anonymous_state'));
    if (anonState && anonState.activeTubeNumber) {
      result.anonymous = {
        number: anonState.activeTubeNumber,
        id: anonState.tubes && anonState.tubes[anonState.activeTubeNumber] ? 
          anonState.tubes[anonState.activeTubeNumber].threadId : 'unknown'
      };
    }
    
    // Check consistency
    if (result.main && result.triplex && result.main.number !== result.triplex.number) {
      result.isConsistent = false;
    }
    
    if (result.main && result.anonymous && result.main.number !== result.anonymous.number) {
      result.isConsistent = false;
    }
    
    if (result.triplex && result.anonymous && result.triplex.number !== result.anonymous.number) {
      result.isConsistent = false;
    }
    
    return result;
  }
  
  // Update the status display
  function updateStatusDisplay() {
    const tubeInfo = getCurrentTubeInfo();
    
    // Build status HTML
    let statusHTML = `
      <div style="font-weight: bold; margin-bottom: 5px; color: ${tubeInfo.isConsistent ? '#5d5' : '#f55'}">
        ${tubeInfo.isConsistent ? '✅ CONSISTENT' : '⚠️ INCONSISTENT'} 
        ${!tubeInfo.isConsistent ? `(${++inconsistenciesFound} found)` : ''}
      </div>
      <div style="display: flex; justify-content: space-between;">
        <div>User: ${tubeInfo.userId ? tubeInfo.userId.substring(0, 10) + '...' : 'None'}</div>
        <div>Auth: ${tubeInfo.authState}</div>
        <div>Continue Flag: ${tubeInfo.continueFlag ? 'ON' : 'OFF'}</div>
      </div>
    `;
    
    statusSection.innerHTML = statusHTML;
    
    // Record in history for later analysis
    STATE_KEYS.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        // Only add if different from last entry
        if (stateHistory[key].length === 0 || 
            stateHistory[key][stateHistory[key].length - 1].value !== value) {
          
          stateHistory[key].push({
            timestamp: new Date(),
            value: value
          });
          
          // Keep only last 10 states
          if (stateHistory[key].length > 10) {
            stateHistory[key].shift();
          }
        }
      }
    });
  }
  
  // Update state info display
  function updateStateInfo() {
    const tubeInfo = getCurrentTubeInfo();
    
    // Function to create tube display with appropriate color
    const getTubeDisplay = (source, tubeData) => {
      if (!tubeData) return `<div>${source}: <span style="color: #aaa;">Not found</span></div>`;
      
      const tubeColor = 
        tubeData.number === 1 ? '#5d5' : 
        tubeData.number === 2 ? '#5af' : 
        tubeData.number === 3 ? '#f95' : '#aaa';
      
      return `
        <div>
          ${source}: <span style="color: ${tubeColor};">Tube ${tubeData.number}</span>
          <span style="color: #aaa; font-size: 10px;">(${tubeData.id})</span>
        </div>
      `;
    };
    
    let stateHTML = `
      <div style="display: flex; flex-direction: column; gap: 2px;">
        ${getTubeDisplay('main', tubeInfo.main)}
        ${getTubeDisplay('triplex', tubeInfo.triplex)}
        ${getTubeDisplay('anonymous', tubeInfo.anonymous)}
      </div>
    `;
    
    // Add timestamps
    const mainState = safeParseJSON(localStorage.getItem('zenjin_state'));
    const triplexState = safeParseJSON(localStorage.getItem('zenjin_triple_helix_state'));
    
    stateHTML += `
      <div style="margin-top: 5px; font-size: 10px; color: #aaa;">
        ${mainState && mainState.lastUpdated ? 
          `main updated: ${new Date(mainState.lastUpdated).toLocaleTimeString()}` : ''}
        ${triplexState && triplexState.lastUpdated ? 
          `<br>triplex updated: ${new Date(triplexState.lastUpdated).toLocaleTimeString()}` : ''}
      </div>
    `;
    
    stateInfo.innerHTML = stateHTML;
  }
  
  // Update history section
  function updateHistorySection() {
    let historyHTML = '<div style="font-weight: bold; margin-bottom: 5px;">State Change History</div>';
    
    // Show active tube changes
    historyHTML += '<div style="margin-bottom: 8px;"><b>Active Tube Changes:</b></div>';
    
    const triplexHistory = stateHistory['zenjin_triple_helix_state'];
    if (triplexHistory.length > 0) {
      historyHTML += '<div style="max-height: 200px; overflow-y: auto;">';
      
      triplexHistory.forEach((entry, index) => {
        try {
          const state = JSON.parse(entry.value);
          const tubeNumber = state.activeTubeNumber;
          const time = entry.timestamp.toLocaleTimeString();
          const tubeColor = 
            tubeNumber === 1 ? '#5d5' : 
            tubeNumber === 2 ? '#5af' : 
            tubeNumber === 3 ? '#f95' : '#aaa';
          
          historyHTML += `
            <div style="margin-bottom: 3px; border-bottom: 1px dotted #444; padding-bottom: 2px;">
              <span style="color: #aaa;">${time}</span> -
              <span style="color: ${tubeColor};">Tube ${tubeNumber}</span>
            </div>
          `;
        } catch (e) {
          // Skip invalid entries
        }
      });
      
      historyHTML += '</div>';
    } else {
      historyHTML += '<div style="color: #aaa;">No tube changes recorded yet</div>';
    }
    
    // Show continue flag changes
    const continueFlagHistory = stateHistory['zenjin_continue_previous_state'];
    if (continueFlagHistory.length > 0) {
      historyHTML += '<div style="margin-top: 10px; margin-bottom: 5px;"><b>Continue Flag Changes:</b></div>';
      historyHTML += '<div style="max-height: 100px; overflow-y: auto;">';
      
      continueFlagHistory.forEach(entry => {
        const value = entry.value === 'true';
        const time = entry.timestamp.toLocaleTimeString();
        
        historyHTML += `
          <div style="margin-bottom: 3px;">
            <span style="color: #aaa;">${time}</span> -
            <span style="color: ${value ? '#5d5' : '#f55'};">${value ? 'ON' : 'OFF'}</span>
          </div>
        `;
      });
      
      historyHTML += '</div>';
    }
    
    historySection.innerHTML = historyHTML;
  }
  
  // Fix inconsistencies by aligning all states
  function fixInconsistencies() {
    try {
      const tubeInfo = getCurrentTubeInfo();
      
      // Determine the source of truth (prioritize triplex > main > anonymous)
      let sourceTube = null;
      if (tubeInfo.triplex) {
        sourceTube = tubeInfo.triplex;
      } else if (tubeInfo.main) {
        sourceTube = tubeInfo.main;
      } else if (tubeInfo.anonymous) {
        sourceTube = tubeInfo.anonymous;
      } else {
        alert('No valid tube state found to use as source of truth');
        return;
      }
      
      console.log(`[Enhanced State Debugger] Fixing inconsistencies. Using Tube ${sourceTube.number} as source of truth`);
      
      // Update all state stores to match the source tube
      const stores = [
        { key: 'zenjin_state', state: safeParseJSON(localStorage.getItem('zenjin_state')) },
        { key: 'zenjin_triple_helix_state', state: safeParseJSON(localStorage.getItem('zenjin_triple_helix_state')) },
        { key: 'zenjin_anonymous_state', state: safeParseJSON(localStorage.getItem('zenjin_anonymous_state')) }
      ];
      
      stores.forEach(store => {
        if (store.state) {
          // Update active tube number
          store.state.activeTubeNumber = sourceTube.number;
          
          // Save back to localStorage
          localStorage.setItem(store.key, JSON.stringify(store.state));
          console.log(`[Enhanced State Debugger] Updated ${store.key} to Tube ${sourceTube.number}`);
        }
      });
      
      alert(`All state stores updated to Tube ${sourceTube.number}`);
      updateStatusDisplay();
      updateStateInfo();
    } catch (e) {
      console.error('[Enhanced State Debugger] Error fixing inconsistencies:', e);
      alert('Error fixing inconsistencies. See console for details.');
    }
  }
  
  // Toggle continue flag
  function toggleContinueFlag() {
    const currentValue = localStorage.getItem('zenjin_continue_previous_state') === 'true';
    const newValue = !currentValue;
    
    localStorage.setItem('zenjin_continue_previous_state', newValue.toString());
    console.log(`[Enhanced State Debugger] Set continue flag to ${newValue}`);
    
    alert(`Continue flag set to ${newValue ? 'ON' : 'OFF'}`);
    updateStatusDisplay();
  }
  
  // Simulate tube change
  function simulateTubeChange() {
    try {
      const tubeInfo = getCurrentTubeInfo();
      
      // Determine current tube number from any available source
      let currentTube = 1;
      if (tubeInfo.triplex) {
        currentTube = tubeInfo.triplex.number;
      } else if (tubeInfo.main) {
        currentTube = tubeInfo.main.number;
      } else if (tubeInfo.anonymous) {
        currentTube = tubeInfo.anonymous.number;
      }
      
      // Calculate next tube (cycle 1→2→3→1)
      const nextTube = currentTube >= 3 ? 1 : currentTube + 1;
      
      // Update all state stores
      const stores = [
        { key: 'zenjin_state', state: safeParseJSON(localStorage.getItem('zenjin_state')) },
        { key: 'zenjin_triple_helix_state', state: safeParseJSON(localStorage.getItem('zenjin_triple_helix_state')) },
        { key: 'zenjin_anonymous_state', state: safeParseJSON(localStorage.getItem('zenjin_anonymous_state')) }
      ];
      
      stores.forEach(store => {
        if (store.state) {
          // Update active tube number
          store.state.activeTubeNumber = nextTube;
          
          // Set lastUpdated
          store.state.lastUpdated = new Date().toISOString();
          
          // Save back to localStorage
          localStorage.setItem(store.key, JSON.stringify(store.state));
        }
      });
      
      console.log(`[Enhanced State Debugger] Simulated tube change: ${currentTube} → ${nextTube}`);
      alert(`Tube changed: ${currentTube} → ${nextTube}`);
      
      updateStatusDisplay();
      updateStateInfo();
    } catch (e) {
      console.error('[Enhanced State Debugger] Error simulating tube change:', e);
      alert('Error simulating tube change. See console for details.');
    }
  }
  
  // Force active tube
  function forceActiveTube() {
    const tubeNumber = prompt('Enter tube number (1, 2, or 3):', '1');
    
    if (!tubeNumber || !['1', '2', '3'].includes(tubeNumber)) {
      alert('Invalid tube number. Please enter 1, 2, or 3.');
      return;
    }
    
    try {
      const numericTube = parseInt(tubeNumber, 10);
      
      // Update all state stores
      const stores = [
        { key: 'zenjin_state', state: safeParseJSON(localStorage.getItem('zenjin_state')) },
        { key: 'zenjin_triple_helix_state', state: safeParseJSON(localStorage.getItem('zenjin_triple_helix_state')) },
        { key: 'zenjin_anonymous_state', state: safeParseJSON(localStorage.getItem('zenjin_anonymous_state')) }
      ];
      
      stores.forEach(store => {
        if (store.state) {
          // Update active tube number
          store.state.activeTubeNumber = numericTube;
          
          // Set lastUpdated
          store.state.lastUpdated = new Date().toISOString();
          
          // Save back to localStorage
          localStorage.setItem(store.key, JSON.stringify(store.state));
        }
      });
      
      console.log(`[Enhanced State Debugger] Forced active tube to ${numericTube}`);
      alert(`Active tube forced to ${numericTube}`);
      
      updateStatusDisplay();
      updateStateInfo();
    } catch (e) {
      console.error('[Enhanced State Debugger] Error forcing active tube:', e);
      alert('Error forcing active tube. See console for details.');
    }
  }
  
  // Set up event listeners
  refreshBtn.addEventListener('click', () => {
    updateStatusDisplay();
    updateStateInfo();
    updateHistorySection();
  });
  
  minimizeBtn.addEventListener('click', () => {
    if (content.style.display === 'none') {
      content.style.display = 'flex';
      minimizeBtn.textContent = '—';
    } else {
      content.style.display = 'none';
      minimizeBtn.textContent = '□';
    }
  });
  
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(debugPanel);
    window.__ENHANCED_STATE_DEBUGGER_INITIALIZED = false;
    
    // Remove any script elements we created
    const scriptElement = document.getElementById('enhanced-state-debugger-script');
    if (scriptElement) {
      scriptElement.parentNode.removeChild(scriptElement);
    }
  });
  
  historyToggle.addEventListener('click', () => {
    const isVisible = historySection.style.display !== 'none';
    historySection.style.display = isVisible ? 'none' : 'block';
    historyToggle.textContent = isVisible ? '📜 Show History' : '📜 Hide History';
    
    if (!isVisible) {
      updateHistorySection();
    }
  });
  
  fixStateBtn.addEventListener('click', fixInconsistencies);
  setContinueFlagBtn.addEventListener('click', toggleContinueFlag);
  simulateTubeChangeBtn.addEventListener('click', simulateTubeChange);
  forceTubeBtn.addEventListener('click', forceActiveTube);
  
  // Make panel draggable
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  
  header.addEventListener('mousedown', (e) => {
    // Don't start drag if clicking buttons
    if (e.target === minimizeBtn || e.target === closeBtn || e.target === refreshBtn) {
      return;
    }
    
    isDragging = true;
    dragOffsetX = e.clientX - debugPanel.getBoundingClientRect().left;
    dragOffsetY = e.clientY - debugPanel.getBoundingClientRect().top;
    
    // Prevent text selection
    document.body.style.userSelect = 'none';
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    debugPanel.style.left = (e.clientX - dragOffsetX) + 'px';
    debugPanel.style.top = (e.clientY - dragOffsetY) + 'px';
    debugPanel.style.right = 'auto';
    debugPanel.style.bottom = 'auto';
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });
  
  // Add keyboard shortcut (Alt+D) to toggle the panel
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'd') {
      e.preventDefault();
      
      if (document.body.contains(debugPanel)) {
        document.body.removeChild(debugPanel);
        window.__ENHANCED_STATE_DEBUGGER_INITIALIZED = false;
      } else {
        window.__ENHANCED_STATE_DEBUGGER_INITIALIZED = false;
        const script = document.createElement('script');
        script.id = 'enhanced-state-debugger-script';
        script.src = '/enhanced-state-debugger.js';
        document.head.appendChild(script);
      }
    }
  });
  
  // Set up interval to periodically update the display
  const updateInterval = setInterval(() => {
    if (!document.body.contains(debugPanel)) {
      clearInterval(updateInterval);
      return;
    }
    
    updateStatusDisplay();
    updateStateInfo();
  }, 2000);
  
  // Initial update
  updateStatusDisplay();
  updateStateInfo();
  
  console.log('[Enhanced State Debugger] Initialization complete. Alt+D to toggle.');
})();