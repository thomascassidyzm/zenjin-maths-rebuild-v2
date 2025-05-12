import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Track client-side mounting
const isBrowser = typeof window !== 'undefined';

// Import adapter directly to allow stitch completion simulation
// Note: We use require() because we need this to be a late-bound import
// to avoid issues with server-side rendering
let StateMachineTubeCyclerAdapter: any = null;

interface TubeStateTestPaneProps {
  userId?: string;
  isVisible?: boolean;
  onClose?: () => void;
}

/**
 * TubeStateTestPane
 * 
 * A diagnostic UI component for testing the Triple Helix tube system
 * without requiring page reload, allowing real-time visualization of:
 * - Tube cycling behavior
 * - Stitch advancement with perfect scores
 * - State changes across tubes
 */
const TubeStateTestPane: React.FC<TubeStateTestPaneProps> = ({
  userId,
  isVisible = true,
  onClose
}) => {
  // Use conditional guard for hydration issues
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tubeCycler, setTubeCycler] = useState<any>(null);
  const [currentState, setCurrentState] = useState<any>(null);
  const [activeTube, setActiveTube] = useState<number>(1);
  const [stateLog, setStateLog] = useState<string[]>([]);
  const [mode, setMode] = useState<'view' | 'simulate'>('view');

  // Simulated question handling
  const [simulatedScore, setSimulatedScore] = useState(20);
  const [simulatedTotal, setSimulatedTotal] = useState(20);
  const [currentStitchId, setCurrentStitchId] = useState('');
  const [currentThreadId, setCurrentThreadId] = useState('');

  // Set mounted state on client side only
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Initialize the test pane
  useEffect(() => {
    if (!isVisible) return;
    
    const initializeTestPane = async () => {
      setIsLoading(true);
      
      try {
        // Dynamic import the adapter to avoid SSR issues
        if (!StateMachineTubeCyclerAdapter) {
          StateMachineTubeCyclerAdapter = require('../lib/adapters/StateMachineTubeCyclerAdapter');
        }
        
        // Get actual user ID
        const actualUserId = userId || 
                         localStorage.getItem('zenjin_user_id') ||
                         localStorage.getItem('zenjin_anonymous_id') || 
                         localStorage.getItem('anonymousId');
                         
        if (!actualUserId) {
          addToLog('❌ No user ID found');
          setIsLoading(false);
          return;
        }
        
        addToLog(`🔍 Initializing test pane for user: ${actualUserId}`);
        
        // Initialize adapter with existing state from localStorage
        let initialState = null;
        
        // Try to load state from localStorage in priority order
        const stateKeys = [
          `zenjin_state_${actualUserId}`,
          `triple_helix_state_${actualUserId}`,
          'zenjin_anonymous_state'
        ];
        
        for (const key of stateKeys) {
          try {
            const stateJson = localStorage.getItem(key);
            if (stateJson) {
              const parsed = JSON.parse(stateJson);
              
              // Handle the nested state in zenjin_anonymous_state
              if (key === 'zenjin_anonymous_state' && parsed.state) {
                initialState = parsed.state;
              } else {
                initialState = parsed;
              }
              
              addToLog(`📦 Loaded state from ${key}`);
              break;
            }
          } catch (e) {
            addToLog(`❌ Error loading state from ${key}: ${e}`);
          }
        }
        
        if (!initialState) {
          addToLog('⚠️ No existing state found, using default state');
        }
        
        // Create the tube cycler adapter
        const adapter = new StateMachineTubeCyclerAdapter({
          userId: actualUserId,
          initialState,
          onStateChange: (newState: any) => {
            setCurrentState(newState);
            refreshTubeState(newState);
            addToLog(`🔄 State updated: activeTube=${newState.activeTubeNumber}`);
          },
          onTubeChange: (tubeNumber: number) => {
            setActiveTube(tubeNumber);
            addToLog(`🔄 Active tube changed to ${tubeNumber}`);
          }
        });
        
        setTubeCycler(adapter);
        
        // Get the initial state
        const state = adapter.getState();
        setCurrentState(state);
        refreshTubeState(state);
        
        // Set the active tube
        setActiveTube(adapter.getCurrentTube());
        
        setIsLoading(false);
      } catch (error) {
        addToLog(`❌ Error initializing test pane: ${error}`);
        setIsLoading(false);
      }
    };
    
    initializeTestPane();
    
    return () => {
      // Clean up resources if needed
      if (tubeCycler) {
        tubeCycler.destroy?.();
      }
    };
  }, [isVisible, userId]);
  
  // Helper to update the current stitch info
  const refreshTubeState = (state: any) => {
    if (!state || !tubeCycler) return;
    
    try {
      const currentStitch = tubeCycler.getCurrentStitch();
      if (currentStitch) {
        setCurrentStitchId(currentStitch.id);
        setCurrentThreadId(currentStitch.threadId);
      }
    } catch (e) {
      addToLog(`❌ Error refreshing tube state: ${e}`);
    }
  };
  
  // Add log entry with timestamp
  const addToLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setStateLog(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]);
  };
  
  // Cycle to next tube
  const handleCycleTube = () => {
    if (!tubeCycler) return;
    
    try {
      addToLog(`🔄 Cycling from tube ${activeTube}...`);
      const nextStitch = tubeCycler.nextTube();
      
      if (nextStitch) {
        addToLog(`✅ Cycled to tube ${tubeCycler.getCurrentTube()}, new stitch: ${nextStitch.id}`);
        
        // Refresh state after tube cycle
        const state = tubeCycler.getState();
        setCurrentState(state);
        refreshTubeState(state);
      } else {
        addToLog(`❌ Failed to cycle tube`);
      }
    } catch (error) {
      addToLog(`❌ Error cycling tube: ${error}`);
    }
  };
  
  // Handle stitch completion with the simulated score
  const handleCompleteStitch = () => {
    if (!tubeCycler || !currentStitchId || !currentThreadId) return;
    
    try {
      const isPerfect = simulatedScore === simulatedTotal;
      
      addToLog(`🎯 Completing stitch ${currentStitchId} with score ${simulatedScore}/${simulatedTotal} (${isPerfect ? 'Perfect' : 'Not Perfect'})`);
      
      const result = tubeCycler.handleStitchCompletion(
        currentThreadId,
        currentStitchId,
        simulatedScore,
        simulatedTotal
      );
      
      if (result) {
        addToLog(`✅ Stitch completed, new stitch: ${result.id}`);
        
        // Refresh state after stitch completion
        const state = tubeCycler.getState();
        setCurrentState(state);
        refreshTubeState(state);
      } else {
        addToLog(`❌ Failed to complete stitch`);
      }
    } catch (error) {
      addToLog(`❌ Error completing stitch: ${error}`);
    }
  };
  
  // Save current state back to localStorage
  const handleSaveState = () => {
    if (!tubeCycler) return;
    
    try {
      // Get the current state
      const state = tubeCycler.getState();
      
      // Format for logging
      const formattedState = {
        activeTube: state.activeTubeNumber,
        tubes: Object.keys(state.tubes).length,
        cycleCount: state.cycleCount
      };
      
      addToLog(`💾 Saving state: ${JSON.stringify(formattedState)}`);
      
      // Get user ID
      const actualUserId = userId || 
                       localStorage.getItem('zenjin_user_id') ||
                       localStorage.getItem('zenjin_anonymous_id') || 
                       localStorage.getItem('anonymousId');
      
      if (!actualUserId) {
        addToLog(`❌ Cannot save state: No user ID found`);
        return;
      }
      
      // Save to all storage locations for consistency
      localStorage.setItem(`zenjin_state_${actualUserId}`, JSON.stringify(state));
      localStorage.setItem(`triple_helix_state_${actualUserId}`, JSON.stringify(state));
      localStorage.setItem('zenjin_anonymous_state', JSON.stringify({ state }));
      
      addToLog(`✅ State saved to all storage locations`);
    } catch (error) {
      addToLog(`❌ Error saving state: ${error}`);
    }
  };
  
  // Render a tube's stitches
  const renderTube = (tubeNumber: number) => {
    if (!currentState || !currentState.tubes || !currentState.tubes[tubeNumber]) {
      return (
        <div className="bg-gray-800 p-3 rounded-lg">
          <div className="text-gray-400">No data for Tube {tubeNumber}</div>
        </div>
      );
    }
    
    const tube = currentState.tubes[tubeNumber];
    const isActiveTube = tubeNumber === activeTube;
    
    // Sort stitches by position
    const stitches = [...(tube.stitches || [])].sort((a, b) => a.position - b.position);
    
    return (
      <div className={`p-3 rounded-lg transition-colors ${isActiveTube ? 'bg-indigo-900/50 border border-indigo-500/50' : 'bg-gray-800'}`}>
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-semibold">
            Tube {tubeNumber}
            {isActiveTube && <span className="ml-2 text-xs bg-teal-600 px-1.5 py-0.5 rounded">Active</span>}
          </h4>
          {!isActiveTube && (
            <button
              onClick={() => {
                if (tubeCycler) tubeCycler.selectTube(tubeNumber);
              }}
              className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded"
            >
              Select
            </button>
          )}
        </div>
        
        <div className="text-xs grid grid-cols-2 gap-x-2 gap-y-1 mb-2">
          <div className="text-gray-400">Thread:</div>
          <div className="truncate font-mono">{tube.threadId || 'none'}</div>
          
          <div className="text-gray-400">Current Stitch:</div>
          <div className="truncate font-mono">{tube.currentStitchId || 'none'}</div>
          
          <div className="text-gray-400">Position:</div>
          <div>{tube.position || 0}</div>
          
          <div className="text-gray-400">Stitches:</div>
          <div>{stitches.length}</div>
        </div>
        
        {stitches.length > 0 && (
          <div className="mt-2">
            <div className="text-xs font-medium mb-1">Stitch Positions:</div>
            <div className="text-xs h-28 overflow-y-auto bg-gray-900 rounded p-1">
              {stitches.map((stitch, idx) => (
                <div 
                  key={idx}
                  className={`
                    py-0.5 px-1 
                    ${stitch.id === tube.currentStitchId ? 'bg-teal-900 border-l-2 border-teal-500' : 'border-l border-gray-700'}
                    ${idx % 2 === 0 ? 'bg-gray-800/50' : ''}
                  `}
                >
                  <div className="flex justify-between items-center">
                    <span>Pos {stitch.position}:</span> 
                    <span className="text-xs font-mono truncate">{stitch.id.split('-').pop()}</span>
                  </div>
                  <div className="text-xs text-gray-400 flex justify-between">
                    <span>Skip: {stitch.skipNumber}</span>
                    <span>{stitch.distractorLevel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Don't render anything if not visible or not mounted (client-side)
  if (!isVisible || !isMounted) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-4 right-4 z-50 w-[600px] bg-gray-900 shadow-xl rounded-lg border border-gray-700 text-white"
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gradient-to-r from-indigo-900 to-violet-900 rounded-t-lg">
        <div>
          <h3 className="font-bold text-lg">Tube State Test Pane</h3>
          <div className="text-xs text-gray-300">
            {isLoading ? 'Loading...' : `User: ${(userId || 'current user')}`}
          </div>
        </div>
        
        <div className="flex gap-2">
          <div className="flex rounded overflow-hidden">
            <button
              onClick={() => setMode('view')}
              className={`text-xs px-3 py-1 ${mode === 'view' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              View
            </button>
            <button
              onClick={() => setMode('simulate')}
              className={`text-xs px-3 py-1 ${mode === 'simulate' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              Simulate
            </button>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-700 rounded"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-3">
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            {/* Current state summary */}
            <div className="mb-3 bg-gray-800 rounded-lg p-3">
              <div className="text-sm font-medium mb-2">Current State:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-gray-400">Active Tube:</div>
                <div>{activeTube}</div>
                
                <div className="text-gray-400">Cycle Count:</div>
                <div>{currentState?.cycleCount || 0}</div>
                
                <div className="text-gray-400">Current Stitch:</div>
                <div className="font-mono truncate">{currentStitchId || 'none'}</div>
                
                <div className="text-gray-400">Thread ID:</div>
                <div className="font-mono truncate">{currentThreadId || 'none'}</div>
              </div>
            </div>
            
            {/* Tube visualization */}
            <div className="mb-4">
              <div className="text-sm font-medium mb-2">Tube Status:</div>
              <div className="grid grid-cols-3 gap-3">
                {renderTube(1)}
                {renderTube(2)}
                {renderTube(3)}
              </div>
            </div>
            
            {/* Action panel */}
            {mode === 'simulate' ? (
              <div className="mb-4 bg-gray-800 rounded-lg p-3">
                <div className="text-sm font-medium mb-2">Simulate Stitch Completion:</div>
                <div className="flex gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Score:</label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={simulatedScore}
                      onChange={(e) => setSimulatedScore(parseInt(e.target.value) || 0)}
                      className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Total:</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={simulatedTotal}
                      onChange={(e) => setSimulatedTotal(parseInt(e.target.value) || 1)}
                      className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleCompleteStitch}
                      disabled={!currentStitchId}
                      className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 px-3 py-1 rounded text-sm"
                    >
                      Complete Stitch
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {simulatedScore === simulatedTotal ? (
                    <span className="text-green-400">⚠️ Perfect score will advance to next stitch</span>
                  ) : (
                    <span>Non-perfect score will NOT advance stitch</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-4 bg-gray-800 rounded-lg p-3">
                <div className="text-sm font-medium mb-2">Key Details:</div>
                <div className="text-xs space-y-1 text-gray-300">
                  <p>• Current tube is Tube {activeTube}</p>
                  <p>• Active stitch is at position 0 in each tube</p>
                  <p>• Perfect score (20/20) advances to next stitch</p>
                  <p>• Non-perfect scores don't advance</p>
                  <p>• Cycle tubes: Tube 1 → 2 → 3 → 1</p>
                </div>
              </div>
            )}
            
            {/* Control buttons */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleCycleTube}
                className="flex-1 bg-teal-700 hover:bg-teal-600 rounded px-3 py-2 text-sm"
              >
                Cycle to Next Tube
              </button>
              <button
                onClick={handleSaveState}
                className="flex-1 bg-violet-700 hover:bg-violet-600 rounded px-3 py-2 text-sm"
              >
                Save State
              </button>
            </div>
            
            {/* Log panel */}
            <div>
              <div className="text-sm font-medium mb-1 flex justify-between items-center">
                <span>Event Log:</span>
                <button
                  onClick={() => setStateLog([])}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Clear
                </button>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded h-24 overflow-y-auto p-2 text-xs font-mono">
                {stateLog.length === 0 ? (
                  <div className="text-gray-500 italic">No log entries</div>
                ) : (
                  stateLog.map((entry, idx) => (
                    <div key={idx} className="pb-0.5">{entry}</div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default TubeStateTestPane;