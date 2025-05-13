import React, { useState, useEffect } from 'react';
import { useZenjinStore } from '../lib/store/zenjinStore';

// Simple server persistence test page
// This only tests saving to server and loading from server
// with a very simple UI to avoid build issues
export default function ServerPersistenceTest() {
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Get state from Zustand
  const tubeState = useZenjinStore(state => state.tubeState);
  const userInfo = useZenjinStore(state => state.userInformation);
  
  // Generate a random user ID
  const generateUserId = () => {
    const newId = `test-user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setUserId(newId);
    return newId;
  };
  
  // Initialize state for testing
  const initializeState = async () => {
    const newId = generateUserId();
    
    // Simple test state initialization
    useZenjinStore.getState().initializeState({
      userInformation: {
        userId: newId,
        isAnonymous: false,
        displayName: `Test User ${newId.substring(0, 6)}`,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      },
      tubeState: {
        activeTube: 1,
        tubes: {
          1: {
            threadId: 'thread-T1-001',
            currentStitchId: 'stitch-T1-001-01',
            positions: {
              0: { 
                stitchId: 'stitch-T1-001-01', 
                skipNumber: 3, 
                distractorLevel: 1,
                perfectCompletions: 0 
              },
              1: { 
                stitchId: 'stitch-T1-001-02', 
                skipNumber: 3, 
                distractorLevel: 1,
                perfectCompletions: 0 
              }
            },
            stitchOrder: ['stitch-T1-001-01', 'stitch-T1-001-02']
          },
          2: {
            threadId: 'thread-T2-001',
            currentStitchId: 'stitch-T2-001-01',
            positions: {
              0: { 
                stitchId: 'stitch-T2-001-01', 
                skipNumber: 3, 
                distractorLevel: 1,
                perfectCompletions: 0 
              }
            },
            stitchOrder: ['stitch-T2-001-01']
          },
          3: {
            threadId: 'thread-T3-001',
            currentStitchId: 'stitch-T3-001-01',
            positions: {
              0: { 
                stitchId: 'stitch-T3-001-01', 
                skipNumber: 3, 
                distractorLevel: 1,
                perfectCompletions: 0 
              }
            },
            stitchOrder: ['stitch-T3-001-01']
          }
        }
      },
      learningProgress: {
        userId: newId,
        totalTimeSpentLearning: 0,
        evoPoints: 0,
        evolutionLevel: 1,
        currentBlinkSpeed: 1,
        previousSessionBlinkSpeeds: [],
        completedStitchesCount: 0,
        perfectScoreStitchesCount: 0
      },
      isInitialized: true
    });
    
    setStatus(`Initialized state for user ${newId}`);
  };
  
  // Save state to server
  const saveToServer = async () => {
    if (!userId) {
      setStatus('Please initialize state first');
      return;
    }

    setIsLoading(true);
    setStatus('Saving to server...');

    try {
      // Log the state we're about to save
      const currentState = useZenjinStore.getState();
      console.log('BEFORE SAVE - Current state:', currentState);
      console.log('BEFORE SAVE - Tube 1 positions:',
        currentState.tubeState?.tubes?.[1]?.positions ?
        Object.keys(currentState.tubeState.tubes[1].positions) : 'No positions');

      // Force update timestamp to ensure we're saving the most recent state
      useZenjinStore.setState({
        lastUpdated: new Date().toISOString()
      });

      // Call Zustand store's syncToServer method
      const result = await useZenjinStore.getState().syncToServer();

      if (result) {
        // Mark the save in our history for troubleshooting
        const saveTime = new Date().toISOString();
        console.log(`SAVE MARKER: User ${userId} state saved at ${saveTime}`);
        useZenjinStore.setState({
          lastSaveTimestamp: saveTime
        });

        setStatus(`Successfully saved state to server for user ${userId}`);
      } else {
        setStatus(`Failed to save state to server for user ${userId}`);
      }
    } catch (error) {
      setStatus(`Error saving to server: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load state from server
  const loadFromServer = async () => {
    if (!userId) {
      setStatus('Please initialize state first');
      return;
    }

    setIsLoading(true);
    setStatus('Loading from server...');

    try {
      // Reset store first
      useZenjinStore.getState().resetStore();

      // DIRECT APPROACH: Fetch and apply the state directly to bypass conversion issues
      try {
        // Fetch directly from API
        const response = await fetch(`/api/simple-state?userId=${encodeURIComponent(userId)}`);
        const data = await response.json();

        if (!data.success || !data.state) {
          setStatus(`Failed to load state: No state data returned`);
          setIsLoading(false);
          return;
        }

        // Log what we received
        console.log('DIRECT LOAD - Received state:', data.state);

        // First find the position data in the loaded state
        let stateWithPositions = null;
        let positionPath = '';

        // Check all possible paths
        if (data.state.tubeState?.tubes?.[1]?.positions &&
            Object.keys(data.state.tubeState.tubes[1].positions).length > 0) {
          console.log('DIRECT LOAD - Found positions in tubeState.tubes path:',
            Object.keys(data.state.tubeState.tubes[1].positions).join(', '));
          stateWithPositions = data.state;
          positionPath = 'tubeState.tubes';
        } else if (data.state.tubes?.[1]?.positions &&
                  Object.keys(data.state.tubes[1].positions).length > 0) {
          console.log('DIRECT LOAD - Found positions in direct tubes path:',
            Object.keys(data.state.tubes[1].positions).join(', '));
          stateWithPositions = data.state;
          positionPath = 'tubes';
        } else if (data.state.state?.tubeState?.tubes?.[1]?.positions &&
                  Object.keys(data.state.state.tubeState.tubes[1].positions).length > 0) {
          console.log('DIRECT LOAD - Found positions in state.tubeState.tubes path:',
            Object.keys(data.state.state.tubeState.tubes[1].positions).join(', '));
          stateWithPositions = data.state.state;
          positionPath = 'state.tubeState.tubes';
        }

        if (!stateWithPositions) {
          console.log('DIRECT LOAD - Could not find positions in any path!');

          // Fall back to standard method
          setStatus('Direct load failed - falling back to standard load...');
          const result = await useZenjinStore.getState().loadFromServer(userId);
          if (result) {
            setStatus(`Successfully loaded state from server using standard loader`);
          } else {
            setStatus(`Failed to load state using standard loader`);
          }
          return;
        }

        // Create a fresh state
        const state = {
          userInformation: stateWithPositions.userInformation || {
            userId,
            isAnonymous: userId.startsWith('anonymous'),
            displayName: `Test User`,
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString()
          },
          isInitialized: true,
          lastUpdated: stateWithPositions.lastUpdated || new Date().toISOString()
        };

        // Handle tube data specially to make sure positions are preserved
        if (positionPath === 'tubeState.tubes' && stateWithPositions.tubeState) {
          state.tubeState = JSON.parse(JSON.stringify(stateWithPositions.tubeState));
          console.log('DIRECT LOAD - Using tubeState directly:', state.tubeState);

          // Verify position 5 exists
          if (state.tubeState.tubes?.[1]?.positions?.[5]) {
            console.log('DIRECT LOAD - Verified position 5 exists in state to be set');
          } else {
            console.log('DIRECT LOAD - Position 5 NOT found in state to be set');
          }

        } else if (positionPath === 'tubes' && stateWithPositions.tubes) {
          // Create tubeState from tubes
          state.tubeState = {
            activeTube: stateWithPositions.activeTube || 1,
            tubes: JSON.parse(JSON.stringify(stateWithPositions.tubes))
          };
          console.log('DIRECT LOAD - Created tubeState from tubes:', state.tubeState);
        } else if (positionPath === 'state.tubeState.tubes' && stateWithPositions.state?.tubeState) {
          state.tubeState = JSON.parse(JSON.stringify(stateWithPositions.state.tubeState));
          console.log('DIRECT LOAD - Using state.tubeState:', state.tubeState);
        }

        // Add other required fields with defaults
        state.learningProgress = stateWithPositions.learningProgress || {
          userId,
          totalTimeSpentLearning: 0,
          evoPoints: 0,
          evolutionLevel: 1,
          currentBlinkSpeed: 1,
          previousSessionBlinkSpeeds: [],
          completedStitchesCount: 0,
          perfectScoreStitchesCount: 0
        };

        // EXTRA VALIDATION before setting the state
        // Make absolutely sure position 5 exists if we found it earlier
        if (positionPath.includes('tubeState') &&
            state.tubeState?.tubes?.[1]?.positions &&
            Object.keys(state.tubeState.tubes[1].positions).includes('5')) {
          console.log('DIRECT LOAD - Confirmed position 5 exists in state to be set');
        } else {
          console.log('DIRECT LOAD - WARNING: Position 5 not found in state to be set!');
        }

        // Set entire state at once
        console.log('DIRECT LOAD - Setting state:', state);
        useZenjinStore.setState(state);

        // Verify the state was set correctly
        const verifyState = useZenjinStore.getState();
        if (verifyState.tubeState?.tubes?.[1]?.positions?.[5]) {
          console.log('DIRECT LOAD SUCCESS - Position 5 exists with stitch:',
            verifyState.tubeState.tubes[1].positions[5].stitchId);
          setStatus(`Successfully loaded state with position 5!`);
        } else {
          console.log('DIRECT LOAD FAILED - Position 5 not found after setting state');
          setStatus(`Loaded state but position 5 is still missing!`);
        }
      } catch (directError) {
        console.error('Error in direct loading approach:', directError);

        // Fall back to standard method
        setStatus('Direct load failed - falling back to standard load...');
        const result = await useZenjinStore.getState().loadFromServer(userId);
        if (result) {
          setStatus(`Successfully loaded state from server using standard loader`);
        } else {
          setStatus(`Failed to load state using standard loader`);
        }
      }
    } catch (error) {
      setStatus(`Error loading from server: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Make changes to test persistence
  const makeChanges = () => {
    if (!userId) {
      setStatus('Please initialize state first');
      return;
    }

    // Get the current tube state
    const currentState = useZenjinStore.getState();

    // Move a stitch from position 0 to position 5 in tube 1
    if (currentState.tubeState?.tubes?.[1]?.positions?.[0]) {
      const stitch = currentState.tubeState.tubes[1].positions[0];

      // Log before making changes - detailed logging
      console.log('BEFORE CHANGES - Current State:', {
        userInfo: !!currentState.userInformation,
        userId: currentState.userInformation?.userId,
        hasTubeState: !!currentState.tubeState,
        hasTubes: currentState.tubeState && !!currentState.tubeState.tubes,
        activeTube: currentState.tubeState?.activeTube || 'none'
      });

      if (currentState.tubeState?.tubes?.[1]) {
        console.log('BEFORE CHANGES - Tube 1 Details:', {
          threadId: currentState.tubeState.tubes[1].threadId,
          currentStitchId: currentState.tubeState.tubes[1].currentStitchId,
          hasPositions: !!currentState.tubeState.tubes[1].positions,
          positionsList: currentState.tubeState.tubes[1].positions ?
            Object.keys(currentState.tubeState.tubes[1].positions).join(', ') : 'none'
        });
      }

      // For each position, show the stitch ID and skip number
      if (currentState.tubeState?.tubes?.[1]?.positions) {
        const positions = currentState.tubeState.tubes[1].positions;
        Object.entries(positions).forEach(([position, data]) => {
          console.log(`Position ${position} has stitch ${data.stitchId} with skipNumber ${data.skipNumber}`);
        });
      }

      // Update the stitch properties - create a completely new stitch with updated properties
      const updatedStitch = {
        stitchId: stitch.stitchId,
        skipNumber: 5,  // Explicitly set skip number to 5
        distractorLevel: stitch.distractorLevel || 1,
        perfectCompletions: (stitch.perfectCompletions || 0) + 1, // Add a perfect completion
        lastCompleted: new Date().toISOString() // Add timestamp
      };

      console.log('MAKING CHANGE: Moving stitch from position 0 to position 5');

      // First move the stitch
      useZenjinStore.getState().moveStitch(1, 0, 5);

      console.log('MAKING CHANGE: Updating stitch at position 5 with:', updatedStitch);

      // Then update its properties
      useZenjinStore.getState().updateStitchPosition(1, 5, updatedStitch);

      // Force update the lastUpdated timestamp of the entire state
      useZenjinStore.setState({
        lastUpdated: new Date().toISOString()
      });

      // Log after changes to verify
      const updatedState = useZenjinStore.getState();
      console.log('AFTER CHANGES - Position list:',
        updatedState.tubeState?.tubes?.[1]?.positions ?
        Object.keys(updatedState.tubeState.tubes[1].positions).join(', ') : 'No positions');

      // Verify position 5 exists with the right properties
      if (updatedState.tubeState?.tubes?.[1]?.positions?.[5]) {
        const pos5 = updatedState.tubeState.tubes[1].positions[5];
        console.log('AFTER CHANGES - Position 5 details:', {
          stitchId: pos5.stitchId,
          skipNumber: pos5.skipNumber,
          distractorLevel: pos5.distractorLevel,
          perfectCompletions: pos5.perfectCompletions
        });
      } else {
        console.log('AFTER CHANGES - Position 5 does not exist!');
      }

      setStatus(`Made changes: Moved stitch ${stitch.stitchId} from position 0 to 5 in tube 1`);
    } else {
      setStatus('No stitch found at position 0 in tube 1');
    }
  };
  
  // Clear local state to test server persistence
  const clearLocalState = () => {
    useZenjinStore.getState().resetStore();
    setStatus('Cleared local state - try loading from server now to test persistence');
  };
  
  // Display current state for debugging
  const currentStateString = () => {
    const state = useZenjinStore.getState();

    // Log the full state structure for debugging
    console.log('Current state structure:', state);

    if (!state.tubeState) {
      console.error('No tubeState found in state');
      return 'No tube state found';
    }

    console.log('TubeState keys:', Object.keys(state.tubeState));
    console.log('Tubes available:', state.tubeState.tubes ? Object.keys(state.tubeState.tubes) : 'No tubes');

    const tube1 = state.tubeState.tubes && state.tubeState.tubes[1];
    if (!tube1) {
      console.error('No tube 1 data found');
      return 'No tube 1 data';
    }

    console.log('Tube 1 structure:', tube1);
    console.log('Tube 1 positions:', tube1.positions ? Object.keys(tube1.positions) : 'No positions');

    // Format positions array for display
    const positions = tube1.positions || {};

    // Add a header with general tube info
    let output = `Tube 1 - Thread: ${tube1.threadId}\nActive Stitch: ${tube1.currentStitchId}\n`;
    output += `Positions Available: ${Object.keys(positions).join(', ')}\n\n`;

    // Highlight position 5 if it exists
    const hasPosition5 = positions[5] !== undefined;
    output += hasPosition5
      ? `✅ Position 5 EXISTS - This is what we're testing for\n\n`
      : `❌ Position 5 MISSING - Server persistence issue\n\n`;

    // Format each position with detailed information
    const positionsText = Object.entries(positions)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([pos, data]) => {
        // Highlight position 5 in the list
        const highlight = pos === '5' ? '★ ' : '';
        return `${highlight}Pos ${pos}: ${data.stitchId} (Skip: ${data.skipNumber}, Perfect: ${data.perfectCompletions || 0})`;
      })
      .join('\n');

    if (!positionsText) {
      return 'No position data in tube 1';
    }

    return output + positionsText;
  };
  
  // Load script to disable API interception
  useEffect(() => {
    const disableApiCallsScript = document.createElement('script');
    disableApiCallsScript.src = '/disable-api-calls.js';
    disableApiCallsScript.async = true;
    document.body.appendChild(disableApiCallsScript);
    
    return () => {
      document.body.removeChild(disableApiCallsScript);
    };
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold mb-2">Server Persistence Test</h1>
      <p className="text-gray-300 mb-6">Simple test for position-based model server persistence</p>
      
      <div className="w-full max-w-md space-y-4">
        {/* User ID */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Test User</h2>
          <div className="mb-2">
            <span className="text-gray-400">User ID: </span>
            <span className="font-mono">{userId || 'None'}</span>
          </div>
          <button 
            onClick={initializeState}
            disabled={isLoading}
            className="w-full mt-2 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-medium"
          >
            Initialize Test State
          </button>
        </div>
        
        {/* Server Persistence */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Server Persistence</h2>
          <div className="flex gap-2">
            <button 
              onClick={saveToServer}
              disabled={isLoading || !userId}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium disabled:opacity-50"
            >
              Save to Server
            </button>
            <button 
              onClick={loadFromServer}
              disabled={isLoading || !userId}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white font-medium disabled:opacity-50"
            >
              Load from Server
            </button>
          </div>
        </div>
        
        {/* Test Controls */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Test Controls</h2>
          <div className="flex gap-2">
            <button 
              onClick={makeChanges}
              disabled={isLoading || !userId}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 rounded text-white font-medium disabled:opacity-50"
            >
              Make Changes
            </button>
            <button 
              onClick={clearLocalState}
              disabled={isLoading}
              className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded text-white font-medium disabled:opacity-50"
            >
              Clear Local State
            </button>
          </div>
        </div>
        
        {/* Status */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Status</h2>
          <div className="bg-gray-900 p-3 rounded font-mono text-sm min-h-[80px] whitespace-pre-wrap">
            {status || 'Ready'}
          </div>
        </div>
        
        {/* Current State */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Current State (Tube 1)</h2>
          <div className="bg-gray-900 p-3 rounded font-mono text-sm min-h-[150px] whitespace-pre-wrap">
            {currentStateString()}
          </div>
        </div>
      </div>
    </div>
  );
}