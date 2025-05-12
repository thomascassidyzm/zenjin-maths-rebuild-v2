// Keyboard-activated debug panel for tube state testing
// Activated with Alt+T keyboard shortcut
(function() {
  // Avoid double initialization
  if (window.__tubeDebugActive) {
    console.log('[DEBUG] Tube debug panel already active');
    return;
  }

  console.log('[DEBUG] Initializing keyboard-activated tube debugging controls...');

  // Create the debug panel but start hidden
  function createDebugPanel() {
    // Create panel container
    const debugPanel = document.createElement('div');
    debugPanel.id = 'keyboard-tube-debug';
    debugPanel.style.position = 'fixed';
    debugPanel.style.top = '20px';
    debugPanel.style.right = '20px';
    debugPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    debugPanel.style.borderRadius = '8px';
    debugPanel.style.padding = '12px';
    debugPanel.style.color = 'white';
    debugPanel.style.fontSize = '14px';
    debugPanel.style.maxWidth = '300px';
    debugPanel.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.3)';
    debugPanel.style.zIndex = '9999';
    debugPanel.style.display = 'none'; // Start hidden
    debugPanel.style.transition = 'opacity 0.3s';
    debugPanel.style.opacity = '0';

    // Add title and content
    debugPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.2); padding-bottom: 5px;">
        <h3 style="margin: 0; font-size: 16px;">Tube State Debugger</h3>
        <button id="debug-hide" style="background: none; border: none; color: #aaa; cursor: pointer;">✕</button>
      </div>
      <div id="debug-content">
        <div id="tube-state-info" style="margin-bottom: 10px;">Loading state info...</div>

        <div style="display: grid; gap: 8px; margin-bottom: 10px;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
            <button id="debug-tube-1" style="background-color: #2563eb; color: white; border: none; border-radius: 4px; padding: 4px 0; cursor: pointer;">Tube 1</button>
            <button id="debug-tube-2" style="background-color: #10b981; color: white; border: none; border-radius: 4px; padding: 4px 0; cursor: pointer;">Tube 2</button>
            <button id="debug-tube-3" style="background-color: #8b5cf6; color: white; border: none; border-radius: 4px; padding: 4px 0; cursor: pointer;">Tube 3</button>
          </div>
          
          <button id="debug-complete-perfect" style="background-color: #22c55e; color: white; border: none; border-radius: 4px; padding: 8px 0; cursor: pointer;">
            Complete Stitch 20/20
          </button>

          <button id="debug-end-session" style="background-color: #ef4444; color: white; border: none; border-radius: 4px; padding: 8px 0; cursor: pointer;">
            End Session & Set Continue
          </button>

          <button id="debug-dashboard" style="background-color: #f59e0b; color: white; border: none; border-radius: 4px; padding: 8px 0; cursor: pointer;">
            Go to Dashboard
          </button>
        </div>

        <div id="debug-log" style="max-height: 120px; overflow-y: auto; font-family: monospace; font-size: 11px; background-color: rgba(0, 0, 0, 0.3); padding: 5px; border-radius: 4px; margin-top: 8px;">
          Debug panel initialized
        </div>
      </div>
    `;

    // Add to body
    document.body.appendChild(debugPanel);

    // Add event listeners
    document.getElementById('debug-hide').addEventListener('click', () => {
      hideDebugPanel();
    });

    // Tube switching buttons
    for (let i = 1; i <= 3; i++) {
      document.getElementById(`debug-tube-${i}`).addEventListener('click', () => {
        switchToTube(i);
      });
    }

    // Complete stitch with perfect score
    document.getElementById('debug-complete-perfect').addEventListener('click', () => {
      completeStitchPerfect();
    });

    // End session and set continue flag
    document.getElementById('debug-end-session').addEventListener('click', () => {
      endSessionAndSetContinue();
    });

    // Go to dashboard
    document.getElementById('debug-dashboard').addEventListener('click', () => {
      window.location.href = '/dashboard';
    });

    return debugPanel;
  }

  // Show the debug panel
  function showDebugPanel() {
    const panel = document.getElementById('keyboard-tube-debug') || createDebugPanel();
    panel.style.display = 'block';
    
    // Trigger reflow
    void panel.offsetWidth;
    
    panel.style.opacity = '1';
    updateStateInfo();
    addLog('Debug panel activated');
  }

  // Hide the debug panel
  function hideDebugPanel() {
    const panel = document.getElementById('keyboard-tube-debug');
    if (panel) {
      panel.style.opacity = '0';
      setTimeout(() => {
        panel.style.display = 'none';
      }, 300);
    }
  }

  // Update state info display
  function updateStateInfo() {
    const stateElement = document.getElementById('tube-state-info');
    if (!stateElement) return;

    // Get user ID
    const uid = localStorage.getItem('zenjin_user_id') ||
                localStorage.getItem('zenjin_anonymous_id') ||
                localStorage.getItem('anonymousId') || 'anonymous';

    // Get all states
    const states = {};
    
    // Main state
    try {
      const stateKey = `zenjin_state_${uid}`;
      const stateJson = localStorage.getItem(stateKey);
      if (stateJson) {
        const parsed = JSON.parse(stateJson);
        states.main = {
          activeTube: parsed.activeTube || parsed.activeTubeNumber || 1,
          lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated).toLocaleTimeString() : 'unknown'
        };
      }
    } catch (e) {
      console.error('Error reading main state:', e);
    }
    
    // Anonymous state
    try {
      const anonStateJson = localStorage.getItem('zenjin_anonymous_state');
      if (anonStateJson) {
        const anonState = JSON.parse(anonStateJson);
        if (anonState.state) {
          states.anonymous = {
            activeTube: anonState.state.activeTube || anonState.state.activeTubeNumber || 1,
            lastUpdated: anonState.state.lastUpdated ? new Date(anonState.state.lastUpdated).toLocaleTimeString() : 'unknown'
          };
        }
      }
    } catch (e) {
      console.error('Error reading anonymous state:', e);
    }
    
    // Triple helix state
    try {
      const tripleHelixJson = localStorage.getItem(`triple_helix_state_${uid}`);
      if (tripleHelixJson) {
        const parsed = JSON.parse(tripleHelixJson);
        states.tripleHelix = {
          activeTube: parsed.activeTube || parsed.activeTubeNumber || 1,
          lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated).toLocaleTimeString() : 'unknown'
        };
      }
    } catch (e) {
      console.error('Error reading triple helix state:', e);
    }
    
    // Build HTML
    let html = `<div style="margin-bottom: 8px;"><strong>User ID:</strong> ${uid.substring(0, 10)}...</div>`;
    
    // Add continue flag status
    const continueFlag = localStorage.getItem('zenjin_continue_previous_state') === 'true';
    html += `<div style="margin-bottom: 8px;"><strong>Continue Flag:</strong> <span style="color: ${continueFlag ? '#4ade80' : '#888'};">${continueFlag ? 'Enabled' : 'Disabled'}</span></div>`;
    
    // Add states
    html += '<div style="margin-bottom: 8px;"><strong>Active Tubes:</strong></div>';
    html += '<div style="font-size: 12px;">';
    
    const activeTubes = [];
    
    if (states.main) {
      html += `<div>Main: <span style="color: ${getTubeColor(states.main.activeTube)};">Tube ${states.main.activeTube}</span> (${states.main.lastUpdated})</div>`;
      activeTubes.push(states.main.activeTube);
    }
    
    if (states.anonymous) {
      html += `<div>Anonymous: <span style="color: ${getTubeColor(states.anonymous.activeTube)};">Tube ${states.anonymous.activeTube}</span> (${states.anonymous.lastUpdated})</div>`;
      activeTubes.push(states.anonymous.activeTube);
    }
    
    if (states.tripleHelix) {
      html += `<div>Triple Helix: <span style="color: ${getTubeColor(states.tripleHelix.activeTube)};">Tube ${states.tripleHelix.activeTube}</span> (${states.tripleHelix.lastUpdated})</div>`;
      activeTubes.push(states.tripleHelix.activeTube);
    }
    html += '</div>';
    
    // Check for mismatched tubes
    if (activeTubes.length > 1 && new Set(activeTubes).size > 1) {
      html += `<div style="color: #ef4444; margin-top: 8px; font-weight: bold;">⚠️ WARNING: Tube mismatch detected!</div>`;
    }
    
    stateElement.innerHTML = html;
  }

  // Get color for tube number
  function getTubeColor(tubeNumber) {
    if (tubeNumber === 1) return '#3b82f6';
    if (tubeNumber === 2) return '#10b981';
    if (tubeNumber === 3) return '#8b5cf6';
    return '#888';
  }

  // Add log message
  function addLog(message) {
    const logElement = document.getElementById('debug-log');
    if (!logElement) return;
    
    const now = new Date().toLocaleTimeString();
    const logItem = document.createElement('div');
    logItem.textContent = `[${now}] ${message}`;
    logElement.prepend(logItem);
    
    // Trim log to 15 items
    const items = logElement.children;
    if (items.length > 15) {
      for (let i = 15; i < items.length; i++) {
        items[i].remove();
      }
    }
  }

  // Switch to a specific tube
  function switchToTube(tubeNumber) {
    addLog(`Switching to Tube ${tubeNumber}...`);
    
    // Try to find the adapter in global scope
    const adapter = window.__stateMachineTubeCyclerAdapter;
    
    if (adapter && typeof adapter.setActiveTube === 'function') {
      try {
        adapter.setActiveTube(tubeNumber);
        addLog(`Successfully switched to Tube ${tubeNumber} using adapter`);
        updateStateInfo();
        return;
      } catch (e) {
        console.error('Error using adapter:', e);
        addLog(`Adapter error: ${e.message}`);
      }
    }
    
    // Fallback to direct localStorage manipulation
    try {
      const uid = localStorage.getItem('zenjin_user_id') ||
                  localStorage.getItem('zenjin_anonymous_id') ||
                  localStorage.getItem('anonymousId') || 'anonymous';
      
      const stateKey = `zenjin_state_${uid}`;
      const stateJson = localStorage.getItem(stateKey);
      
      if (stateJson) {
        const state = JSON.parse(stateJson);
        
        // Update tube number
        state.activeTube = tubeNumber;
        state.activeTubeNumber = tubeNumber;
        state.lastUpdated = new Date().toISOString();
        
        // Save back to localStorage
        localStorage.setItem(stateKey, JSON.stringify(state));
        
        // Also update anonymous state if it exists
        const anonStateJson = localStorage.getItem('zenjin_anonymous_state');
        if (anonStateJson) {
          try {
            const anonState = JSON.parse(anonStateJson);
            if (anonState.state) {
              anonState.state.activeTube = tubeNumber;
              anonState.state.activeTubeNumber = tubeNumber;
              anonState.state.lastUpdated = new Date().toISOString();
              localStorage.setItem('zenjin_anonymous_state', JSON.stringify(anonState));
            }
          } catch (e) {
            console.error('Error updating anonymous state:', e);
          }
        }
        
        // Also update triple helix state
        const tripleHelixJson = localStorage.getItem(`triple_helix_state_${uid}`);
        if (tripleHelixJson) {
          try {
            const tripleHelix = JSON.parse(tripleHelixJson);
            tripleHelix.activeTube = tubeNumber;
            tripleHelix.activeTubeNumber = tubeNumber;
            tripleHelix.lastUpdated = new Date().toISOString();
            localStorage.setItem(`triple_helix_state_${uid}`, JSON.stringify(tripleHelix));
          } catch (e) {
            console.error('Error updating triple helix state:', e);
          }
        }
        
        addLog(`Switched to Tube ${tubeNumber} using localStorage`);
        updateStateInfo();
        
        // Forced reload - only if necessary for testing
        if (confirm(`Switched to Tube ${tubeNumber}. Reload to see changes?`)) {
          window.location.reload();
        }
      } else {
        addLog('No state found to update');
      }
    } catch (e) {
      console.error('Error manipulating localStorage:', e);
      addLog(`Error: ${e.message}`);
    }
  }

  // Complete current stitch with perfect score
  function completeStitchPerfect() {
    addLog('Attempting to complete stitch with 20/20 score...');
    
    // Try to find the adapter in global scope
    const adapter = window.__stateMachineTubeCyclerAdapter;
    
    if (adapter && typeof adapter.handleStitchCompletion === 'function') {
      try {
        const currentStitch = adapter.getCurrentStitch();
        if (!currentStitch) {
          addLog('No current stitch found');
          return;
        }
        
        adapter.handleStitchCompletion(
          currentStitch.threadId,
          currentStitch.id,
          20, // Perfect score
          20  // Total questions
        );
        
        addLog(`Completed stitch ${currentStitch.id.substring(0, 12)}... with perfect score`);
        updateStateInfo();
      } catch (e) {
        console.error('Error completing stitch:', e);
        addLog(`Error: ${e.message}`);
      }
    } else {
      addLog('No adapter found to complete stitch');
    }
  }

  // End session and set continue flag
  function endSessionAndSetContinue() {
    addLog('Ending session and setting continue flag...');
    
    // Get current tube info for reference later
    const uid = localStorage.getItem('zenjin_user_id') ||
                localStorage.getItem('zenjin_anonymous_id') ||
                localStorage.getItem('anonymousId') || 'anonymous';
    
    let currentTube = 1;
    const stateKey = `zenjin_state_${uid}`;
    const stateJson = localStorage.getItem(stateKey);
    
    if (stateJson) {
      try {
        const state = JSON.parse(stateJson);
        currentTube = state.activeTube || state.activeTubeNumber || 1;
      } catch (e) {
        console.error('Error reading current tube:', e);
      }
    }
    
    // Set continue flag
    localStorage.setItem('zenjin_continue_previous_state', 'true');
    addLog(`Set continue flag to true (currently in Tube ${currentTube})`);
    updateStateInfo();
  }

  // Register keyboard shortcut (Alt+T to toggle debug panel)
  document.addEventListener('keydown', function(event) {
    // Alt+T
    if (event.altKey && event.key === 't') {
      const panel = document.getElementById('keyboard-tube-debug');
      if (panel && panel.style.display !== 'none') {
        hideDebugPanel();
      } else {
        showDebugPanel();
      }
    }
  });

  // Try to find adapter after page load
  window.addEventListener('load', function() {
    setTimeout(() => {
      if (window.__stateMachineTubeCyclerAdapter) {
        console.log('[DEBUG] Found StateMachineTubeCyclerAdapter in global scope');
      } else {
        // Attempt to expose adapter to global scope
        const component = Array.from(document.querySelectorAll('*')).find(el => 
          el.__reactFiber$ && el.__reactProps$ && el.__reactProps$.tubeCycler);
        
        if (component && component.__reactProps$.tubeCycler) {
          window.__stateMachineTubeCyclerAdapter = component.__reactProps$.tubeCycler;
          console.log('[DEBUG] Exposed StateMachineTubeCyclerAdapter to global scope');
        }
      }
    }, 2000);
  });

  console.log('[DEBUG] Tube debugging initialized. Press Alt+T to toggle debug panel');
  window.__tubeDebugActive = true;
})();