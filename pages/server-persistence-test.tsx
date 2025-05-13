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
      // Call Zustand store's syncToServer method
      const result = await useZenjinStore.getState().syncToServer();
      
      if (result) {
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
      
      // Call Zustand store's loadFromServer method
      const result = await useZenjinStore.getState().loadFromServer(userId);
      
      if (result) {
        setStatus(`Successfully loaded state from server for user ${userId}`);
      } else {
        setStatus(`Failed to load state from server for user ${userId}`);
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
      
      // Update the stitch properties
      const updatedStitch = {
        ...stitch,
        skipNumber: 5,  // Increase skip number
        perfectCompletions: (stitch.perfectCompletions || 0) + 1 // Add a perfect completion
      };
      
      // First move the stitch
      useZenjinStore.getState().moveStitch(1, 0, 5);
      
      // Then update its properties
      useZenjinStore.getState().updateStitchPosition(1, 5, updatedStitch);
      
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
    const positionsText = Object.entries(positions)
      .map(([pos, data]) => `Pos ${pos}: ${data.stitchId} (Skip: ${data.skipNumber}, Perfect: ${data.perfectCompletions || 0})`)
      .join('\n');

    if (!positionsText) {
      return 'No position data in tube 1';
    }

    return positionsText;
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