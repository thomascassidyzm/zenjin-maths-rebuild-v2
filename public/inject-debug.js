// Simple injectable script to add debugging controls to the minimal player
(function() {
  console.log('[DEBUG] Injecting tube debugging controls...');

  // States for tracking persistence testing
  let savedState = null;
  let savedTubeNumber = null;
  let sessionEndedManually = false;

  // Make sure the DOM is loaded
  function injectControls() {
    const playerContainer = document.querySelector('.player-container') || document.body;
    if (!playerContainer) {
      console.log('[DEBUG] Player container not found, retrying in 1s...');
      setTimeout(injectControls, 1000);
      return;
    }

    // Create the debug panel
    const debugPanel = document.createElement('div');
    debugPanel.id = 'simple-tube-debug';
    debugPanel.style.position = 'fixed';
    debugPanel.style.bottom = '10px';
    debugPanel.style.right = '10px';
    debugPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    debugPanel.style.color = 'white';
    debugPanel.style.padding = '10px';
    debugPanel.style.borderRadius = '8px';
    debugPanel.style.zIndex = '9999';
    debugPanel.style.maxWidth = '330px';
    debugPanel.style.fontSize = '14px';
    debugPanel.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.5)';

    // Add the controls
    debugPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <h3 style="font-weight: bold; margin: 0;">Tube Debug Controls</h3>
        <button id="debug-toggle" style="background: none; border: none; color: #aaa; cursor: pointer;">Hide</button>
      </div>
      <div id="debug-content">
        <div id="debug-state-summary" style="background-color: rgba(0, 0, 0, 0.3); padding: 8px; border-radius: 4px; margin-bottom: 10px; font-size: 12px;">
          Loading state info...
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px;">
          <button id="debug-complete-perfect" style="background-color: #22c55e; color: white; border: none; border-radius: 4px; padding: 8px 6px; cursor: pointer;">
            Complete 20/20
            <span style="display: block; font-size: 11px; opacity: 0.8;">Perfect Score</span>
          </button>
          <button id="debug-complete-partial" style="background-color: #eab308; color: white; border: none; border-radius: 4px; padding: 8px 6px; cursor: pointer;">
            Complete 10/20
            <span style="display: block; font-size: 11px; opacity: 0.8;">40 Points Total</span>
          </button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px;">
          <button id="debug-cycle-tube" style="background-color: #6366f1; color: white; border: none; border-radius: 4px; padding: 8px 6px; cursor: pointer;">
            Cycle Tube
            <span style="display: block; font-size: 11px; opacity: 0.8;">1→2→3→1</span>
          </button>
          <button id="debug-set-continue" style="background-color: #8b5cf6; color: white; border: none; border-radius: 4px; padding: 8px 6px; cursor: pointer;">
            Set Continue Flag
            <span style="display: block; font-size: 11px; opacity: 0.8;">force continue=true</span>
          </button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px;">
          <button id="debug-end-session" style="background-color: #ef4444; color: white; border: none; border-radius: 4px; padding: 8px 6px; cursor: pointer;">
            End Session
            <span style="display: block; font-size: 11px; opacity: 0.8;">Save current state</span>
          </button>
          <button id="debug-resume-session" style="background-color: #3b82f6; color: white; border: none; border-radius: 4px; padding: 8px 6px; cursor: pointer;" disabled>
            Resume Session
            <span style="display: block; font-size: 11px; opacity: 0.8;">Simulate returning</span>
          </button>
        </div>

        <div id="debug-log" style="max-height: 120px; overflow-y: auto; font-family: monospace; font-size: 12px; background-color: rgba(0, 0, 0, 0.3); padding: 5px; border-radius: 4px;">
          Debug panel initialized
        </div>
      </div>
    `;

    // Add to the DOM
    playerContainer.appendChild(debugPanel);

    // Add event listeners
    const toggleButton = document.getElementById('debug-toggle');
    const content = document.getElementById('debug-content');
    let isHidden = false;

    toggleButton.addEventListener('click', () => {
      isHidden = !isHidden;
      content.style.display = isHidden ? 'none' : 'block';
      toggleButton.textContent = isHidden ? 'Show' : 'Hide';
    });

    // Add to the log
    const logElement = document.getElementById('debug-log');

    function addLog(message) {
      const now = new Date().toLocaleTimeString();
      const logItem = document.createElement('div');
      logItem.textContent = `[${now}] ${message}`;
      logElement.prepend(logItem);

      // Trim log to last 20 items
      const items = logElement.children;
      if (items.length > 20) {
        for (let i = 20; i < items.length; i++) {
          items[i].remove();
        }
      }

      console.log(`[DEBUG] ${message}`);
    }

    // Update state summary display
    function updateStateSummary() {
      const summaryElement = document.getElementById('debug-state-summary');

      // Get current state
      const uid = localStorage.getItem('zenjin_user_id') ||
                localStorage.getItem('zenjin_anonymous_id') ||
                localStorage.getItem('anonymousId') || 'anonymous';

      let currentState = null;
      let activeTube = null;
      let stateSource = null;

      // Try to get state from main storage
      const stateKey = `zenjin_state_${uid}`;
      const stateJson = localStorage.getItem(stateKey);

      if (stateJson) {
        try {
          currentState = JSON.parse(stateJson);
          activeTube = currentState.activeTube || currentState.activeTubeNumber || 1;
          stateSource = 'main';
        } catch (e) {
          console.error('Error parsing main state:', e);
        }
      }

      // If not found, try anonymous state
      if (!currentState) {
        const anonStateJson = localStorage.getItem('zenjin_anonymous_state');
        if (anonStateJson) {
          try {
            const parsed = JSON.parse(anonStateJson);
            if (parsed.state) {
              currentState = parsed.state;
              activeTube = currentState.activeTube || currentState.activeTubeNumber || 1;
              stateSource = 'anonymous';
            }
          } catch (e) {
            console.error('Error parsing anonymous state:', e);
          }
        }
      }

      // If not found, try triple helix state
      if (!currentState) {
        const tripleHelixStateJson = localStorage.getItem(`triple_helix_state_${uid}`);
        if (tripleHelixStateJson) {
          try {
            currentState = JSON.parse(tripleHelixStateJson);
            activeTube = currentState.activeTube || currentState.activeTubeNumber || 1;
            stateSource = 'triple-helix';
          } catch (e) {
            console.error('Error parsing triple helix state:', e);
          }
        }
      }

      // Check continue flag
      const continueFlag = localStorage.getItem('zenjin_continue_previous_state');

      // Update summary
      if (currentState) {
        const currentStitch = getCurrentStitchInfo(currentState, activeTube);
        const lastUpdated = currentState.lastUpdated ?
          new Date(currentState.lastUpdated).toLocaleTimeString() : 'unknown';

        const tubeBadge =
          activeTube === 1 ? '<span style="color: #93c5fd">●</span>' :
          activeTube === 2 ? '<span style="color: #86efac">●</span>' :
          activeTube === 3 ? '<span style="color: #c4b5fd">●</span>' :
          '<span style="color: #fca5a5">●</span>';

        summaryElement.innerHTML = `
          <div><strong>Active Tube:</strong> ${tubeBadge} Tube ${activeTube}</div>
          <div><strong>Continue Flag:</strong> ${continueFlag === 'true' ? '✓ Enabled' : '✗ Disabled'}</div>
          <div><strong>Current Stitch:</strong> ${currentStitch ? currentStitch.id.substring(0, 8) + '...' : 'none'}</div>
          <div><strong>Last Updated:</strong> ${lastUpdated}</div>
          <div><strong>Source:</strong> ${stateSource} state</div>
        `;
      } else {
        summaryElement.innerHTML = `<div style="color: #fca5a5">No state found in any storage location</div>`;
      }

      // Update resume button if we have saved state
      const resumeButton = document.getElementById('debug-resume-session');
      if (savedState && savedTubeNumber) {
        resumeButton.disabled = false;
        resumeButton.style.opacity = '1';
      } else {
        resumeButton.disabled = true;
        resumeButton.style.opacity = '0.5';
      }
    }

    // Get current stitch information
    function getCurrentStitchInfo(state, activeTube) {
      if (!state || !state.tubes || !state.tubes[activeTube]) {
        return null;
      }

      const tube = state.tubes[activeTube];
      if (!tube.stitches || tube.stitches.length === 0) {
        return null;
      }

      // Find stitch at position 0
      return tube.stitches.find(s => s.position === 0);
    }

    // Complete stitch with perfect score (20/20)
    document.getElementById('debug-complete-perfect').addEventListener('click', () => {
      addLog('Completing stitch with perfect score (20/20)...');

      try {
        // First try to find the state machine adapter
        const adapter = window.__stateMachineTubeCyclerAdapter;

        if (adapter) {
          addLog('Found adapter in global scope');
          handleWithAdapter(adapter, 20);
        } else {
          // Try to find it through React DevTools
          addLog('No global adapter found, trying to access through state...');
          completeWithStateModification(20);
        }
      } catch (e) {
        addLog(`Error: ${e.message}`);
      }

      // Update the state summary
      setTimeout(updateStateSummary, 1000);
    });

    // Complete stitch with partial score (10/20)
    document.getElementById('debug-complete-partial').addEventListener('click', () => {
      addLog('Completing stitch with partial score (10/20)...');

      try {
        // First try to find the state machine adapter
        const adapter = window.__stateMachineTubeCyclerAdapter;

        if (adapter) {
          addLog('Found adapter in global scope');
          handleWithAdapter(adapter, 10);
        } else {
          // Try to find it through React DevTools
          addLog('No global adapter found, trying to access through state...');
          completeWithStateModification(10);
        }
      } catch (e) {
        addLog(`Error: ${e.message}`);
      }

      // Update the state summary
      setTimeout(updateStateSummary, 1000);
    });

    // Cycle to next tube
    document.getElementById('debug-cycle-tube').addEventListener('click', () => {
      addLog('Cycling to next tube...');

      try {
        // First try to find the state machine adapter
        const adapter = window.__stateMachineTubeCyclerAdapter;

        if (adapter) {
          addLog('Found adapter in global scope');
          adapter.nextTube();
          addLog('Tube cycled successfully');

          // Update after a short delay
          setTimeout(updateStateSummary, 1000);
        } else {
          // Try to find it through React DevTools
          addLog('No global adapter found, trying to access state directly...');

          // Let's modify localStorage directly
          const uid = localStorage.getItem('zenjin_user_id') ||
                      localStorage.getItem('zenjin_anonymous_id') ||
                      localStorage.getItem('anonymousId') || 'anonymous';

          const stateKey = `zenjin_state_${uid}`;
          const stateJson = localStorage.getItem(stateKey);

          if (stateJson) {
            const state = JSON.parse(stateJson);
            const currentTube = state.activeTube || state.activeTubeNumber || 1;
            const nextTube = (currentTube % 3) + 1; // 1->2->3->1

            // Update active tube
            state.activeTube = nextTube;
            state.activeTubeNumber = nextTube;
            state.lastUpdated = new Date().toISOString();

            // Save back to localStorage
            localStorage.setItem(stateKey, JSON.stringify(state));

            // Also update anonymous state if it exists
            const anonStateJson = localStorage.getItem('zenjin_anonymous_state');
            if (anonStateJson) {
              try {
                const anonState = JSON.parse(anonStateJson);
                if (anonState.state) {
                  anonState.state = state;
                  localStorage.setItem('zenjin_anonymous_state', JSON.stringify(anonState));
                }
              } catch (e) {
                console.error('Error updating anonymous state:', e);
              }
            }

            // Also update triple helix state if it exists
            localStorage.setItem(`triple_helix_state_${uid}`, JSON.stringify(state));

            addLog(`Cycled tube ${currentTube} -> ${nextTube}`);

            // Update the UI without reload
            updateStateSummary();

            // Only reload if explicitly requested or if we can't update the UI
            if (confirm('Tube cycled. Reload page to see changes?')) {
              window.location.reload();
            }
          }
        }
      } catch (e) {
        addLog(`Error: ${e.message}`);
      }
    });

    // End session (save current state)
    document.getElementById('debug-end-session').addEventListener('click', () => {
      addLog('Ending session and saving state...');

      try {
        // Get current state
        const uid = localStorage.getItem('zenjin_user_id') ||
                    localStorage.getItem('zenjin_anonymous_id') ||
                    localStorage.getItem('anonymousId') || 'anonymous';

        const stateKey = `zenjin_state_${uid}`;
        const stateJson = localStorage.getItem(stateKey);

        if (stateJson) {
          const state = JSON.parse(stateJson);
          const activeTube = state.activeTube || state.activeTubeNumber || 1;

          // Save the state
          savedState = JSON.parse(JSON.stringify(state)); // Deep clone
          savedTubeNumber = activeTube;

          // Set flag to indicate manual session end
          sessionEndedManually = true;

          addLog(`Session ended. Saved state with active tube ${activeTube}`);

          // Set the continue flag - this is what the dashboard would do
          localStorage.setItem('zenjin_continue_previous_state', 'true');

          // Update the UI
          updateStateSummary();

          // Enable resume button
          const resumeButton = document.getElementById('debug-resume-session');
          resumeButton.disabled = false;
          resumeButton.style.opacity = '1';
        } else {
          addLog('No state found to save');
        }
      } catch (e) {
        addLog(`Error ending session: ${e.message}`);
      }
    });

    // Resume session (simulate returning to the app)
    document.getElementById('debug-resume-session').addEventListener('click', () => {
      if (!savedState || !savedTubeNumber) {
        addLog('No saved state to resume from');
        return;
      }

      addLog(`Resuming session from saved state (Tube ${savedTubeNumber})...`);

      try {
        // This simulates what happens when a user returns to the app

        // Get current user ID
        const uid = localStorage.getItem('zenjin_user_id') ||
                    localStorage.getItem('zenjin_anonymous_id') ||
                    localStorage.getItem('anonymousId') || 'anonymous';

        // Restore state to all storage locations
        const stateKey = `zenjin_state_${uid}`;

        // Set explicit activeTube and activeTubeNumber
        savedState.activeTube = savedTubeNumber;
        savedState.activeTubeNumber = savedTubeNumber;
        savedState.lastUpdated = new Date().toISOString();

        // Save to main state
        localStorage.setItem(stateKey, JSON.stringify(savedState));

        // Also update anonymous state if it exists
        const anonStateJson = localStorage.getItem('zenjin_anonymous_state');
        if (anonStateJson) {
          try {
            const anonState = JSON.parse(anonStateJson);
            if (anonState.state) {
              anonState.state = savedState;
              localStorage.setItem('zenjin_anonymous_state', JSON.stringify(anonState));
            }
          } catch (e) {
            console.error('Error updating anonymous state:', e);
          }
        }

        // Also update triple helix state
        localStorage.setItem(`triple_helix_state_${uid}`, JSON.stringify(savedState));

        // Make sure continue flag is true
        localStorage.setItem('zenjin_continue_previous_state', 'true');

        addLog(`State restored. Active tube should be ${savedTubeNumber}`);

        // Offer to reload
        if (confirm('State restored. Reload page to simulate returning to the app?')) {
          window.location.reload();
        } else {
          // At least update the UI
          updateStateSummary();
        }
      } catch (e) {
        addLog(`Error resuming session: ${e.message}`);
      }
    });

    // Set continue flag
    document.getElementById('debug-set-continue').addEventListener('click', () => {
      localStorage.setItem('zenjin_continue_previous_state', 'true');
      addLog('Continue flag set to true');
      updateStateSummary();
    });

    // Helper function to handle stitch completion with adapter
    function handleWithAdapter(adapter, score) {
      try {
        const currentStitch = adapter.getCurrentStitch();
        if (!currentStitch) {
          addLog('No current stitch found');
          return;
        }

        adapter.handleStitchCompletion(
          currentStitch.threadId,
          currentStitch.id,
          score,
          20 // Total questions
        );

        addLog(`Stitch completed with score ${score}/20`);
      } catch (e) {
        addLog(`Error with adapter: ${e.message}`);
      }
    }

    // Helper function to update state directly
    function completeWithStateModification(score) {
      const uid = localStorage.getItem('zenjin_user_id') ||
                 localStorage.getItem('zenjin_anonymous_id') ||
                 localStorage.getItem('anonymousId') || 'anonymous';

      const stateKey = `zenjin_state_${uid}`;
      const stateJson = localStorage.getItem(stateKey);

      if (!stateJson) {
        addLog('No state found in localStorage');
        return;
      }

      const state = JSON.parse(stateJson);
      const activeTube = state.activeTube || state.activeTubeNumber || 1;

      if (!state.tubes || !state.tubes[activeTube]) {
        addLog(`No tube ${activeTube} found in state`);
        return;
      }

      const tube = state.tubes[activeTube];
      if (!tube.stitches || tube.stitches.length === 0) {
        addLog('No stitches found in current tube');
        return;
      }

      // Find current stitch (position 0)
      const currentStitchIndex = tube.stitches.findIndex(s => s.position === 0);
      if (currentStitchIndex < 0) {
        addLog('No stitch found at position 0');
        return;
      }

      const currentStitch = tube.stitches[currentStitchIndex];

      // If perfect score (20/20), update skip number and rotate positions
      if (score === 20) {
        const oldSkip = currentStitch.skipNumber || 1;
        const newSkip = oldSkip === 1 ? 3 :
                        oldSkip === 3 ? 5 :
                        oldSkip === 5 ? 10 :
                        oldSkip === 10 ? 25 :
                        oldSkip === 25 ? 100 : 100;

        addLog(`Stitch skip number updated: ${oldSkip} → ${newSkip}`);

        // Update state
        tube.stitches[currentStitchIndex].skipNumber = newSkip;

        // Rotate positions (simulating advancement)
        tube.stitches.forEach(stitch => {
          stitch.position = (stitch.position + 1) % tube.stitches.length;
        });
      }

      // Update last updated timestamp
      state.lastUpdated = new Date().toISOString();

      // Save back to localStorage
      localStorage.setItem(stateKey, JSON.stringify(state));

      // Also update anonymous state if it exists
      try {
        const anonStateJson = localStorage.getItem('zenjin_anonymous_state');
        if (anonStateJson) {
          const anonState = JSON.parse(anonStateJson);
          if (anonState.state) {
            anonState.state = state;
            localStorage.setItem('zenjin_anonymous_state', JSON.stringify(anonState));
          }
        }
      } catch (e) {
        console.error('Error updating anonymous state:', e);
      }

      // Also update triple helix state if it exists
      localStorage.setItem(`triple_helix_state_${uid}`, JSON.stringify(state));

      addLog(`Stitch completed with score ${score}/20`);

      // Update the UI
      updateStateSummary();

      // Check if we need to reload
      if (confirm('Stitch completed. Reload page to see changes?')) {
        window.location.reload();
      }
    }

    // Check for continue flag on load and then clear it
    window.addEventListener('load', () => {
      if (localStorage.getItem('zenjin_continue_previous_state') === 'true' && !sessionEndedManually) {
        addLog('⚠️ Continue flag was true on page load');

        // Clear the flag after 2 seconds
        setTimeout(() => {
          localStorage.setItem('zenjin_continue_previous_state', 'false');
          addLog('Continue flag automatically cleared');
          updateStateSummary();
        }, 2000);
      }

      // Update state summary
      updateStateSummary();

      // Find any exposed adapter
      setTimeout(() => {
        // Search all window properties for adapter
        for (const prop in window) {
          if (prop.toLowerCase().includes('adapter') && window[prop] && typeof window[prop].nextTube === 'function') {
            window.__stateMachineTubeCyclerAdapter = window[prop];
            addLog(`Found adapter: ${prop}`);
            break;
          }
        }

        if (!window.__stateMachineTubeCyclerAdapter) {
          addLog('No adapter found in global scope, will use localStorage');
        }

        // No need for interval updates - state only changes on user actions
      }, 2000);
    });

    addLog('Debug controls initialized successfully');
  }

  // Start the injection process
  injectControls();
})();