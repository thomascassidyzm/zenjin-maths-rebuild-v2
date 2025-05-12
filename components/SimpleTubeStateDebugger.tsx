import React, { useEffect, useState, useRef } from 'react';

// Track client-side mounting
const isBrowser = typeof window !== 'undefined';

// Define a minimal interface for the tube cycler adapter
interface TubeCyclerAdapter {
  getCurrentTube: () => number;
  getCurrentStitch: () => any;
  handleStitchCompletion: (threadId: string, stitchId: string, score: number, totalQuestions: number) => any;
  nextTube: () => any;
  getState: () => any;
  destroy?: () => void;
}

// Import adapter using same technique as in TubeStateTestPane
// Note: We use a let variable here and assign it later to avoid SSR issues
let StateMachineTubeCyclerAdapter: any = null;

/**
 * A simplified, production-safe version of the tube state debugger
 *
 * This component is designed to work in production environments without
 * causing hydration mismatches or React errors.
 */
const SimpleTubeStateDebugger: React.FC = () => {
  // Only render client-side
  const [isMounted, setIsMounted] = useState(false);
  const [userId, setUserId] = useState('');
  const [tubeInfo, setTubeInfo] = useState<any>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tubeCycler, setTubeCycler] = useState<TubeCyclerAdapter | null>(null);
  const [currentStitchId, setCurrentStitchId] = useState<string>('');
  const [currentThreadId, setCurrentThreadId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const lastUpdateRef = useRef<number>(Date.now());
  const intervalRef = useRef<any>(null);

  // Helper function to check tube state
  const checkTubeState = () => {
    // Get user ID from localStorage
    const uid = localStorage.getItem('zenjin_user_id') ||
                localStorage.getItem('zenjin_anonymous_id') ||
                localStorage.getItem('anonymousId') || 'unknown';

    if (userId !== uid) {
      setUserId(uid);
    }

    // Get tube info from various storage locations
    const stateInfo: any = {};
    let statesChanged = false;

    // Check main state
    try {
      const mainState = localStorage.getItem(`zenjin_state_${uid}`);
      if (mainState) {
        const parsed = JSON.parse(mainState);
        const newInfo = {
          activeTube: parsed.activeTube || parsed.activeTubeNumber,
          lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated).toLocaleTimeString() : 'unknown',
          hasData: !!parsed,
          timestamp: parsed.lastUpdated ? new Date(parsed.lastUpdated).getTime() : 0
        };

        // Check if changed
        if (!tubeInfo.main || tubeInfo.main.activeTube !== newInfo.activeTube ||
            tubeInfo.main.timestamp !== newInfo.timestamp) {
          statesChanged = true;

          // Add log message if active tube changed
          if (tubeInfo.main && tubeInfo.main.activeTube !== newInfo.activeTube) {
            const time = new Date().toLocaleTimeString();
            addLog(`[${time}] Main state tube changed: ${tubeInfo.main.activeTube} → ${newInfo.activeTube}`);
          }
        }

        stateInfo.main = newInfo;
      }
    } catch (e) {
      console.error('Error parsing main state:', e);
    }

    // Check anonymous state
    try {
      const anonState = localStorage.getItem('zenjin_anonymous_state');
      if (anonState) {
        const parsed = JSON.parse(anonState);
        if (parsed.state) {
          const newInfo = {
            activeTube: parsed.state.activeTube || parsed.state.activeTubeNumber,
            lastUpdated: parsed.state.lastUpdated ? new Date(parsed.state.lastUpdated).toLocaleTimeString() : 'unknown',
            hasData: !!parsed.state,
            timestamp: parsed.state.lastUpdated ? new Date(parsed.state.lastUpdated).getTime() : 0
          };

          // Check if changed
          if (!tubeInfo.anon || tubeInfo.anon.activeTube !== newInfo.activeTube ||
              tubeInfo.anon.timestamp !== newInfo.timestamp) {
            statesChanged = true;

            // Add log message if active tube changed
            if (tubeInfo.anon && tubeInfo.anon.activeTube !== newInfo.activeTube) {
              const time = new Date().toLocaleTimeString();
              addLog(`[${time}] Anonymous state tube changed: ${tubeInfo.anon.activeTube} → ${newInfo.activeTube}`);
            }
          }

          stateInfo.anon = newInfo;
        }
      }
    } catch (e) {
      console.error('Error parsing anonymous state:', e);
    }

    // Check triple helix state
    try {
      const tripleHelixState = localStorage.getItem(`triple_helix_state_${uid}`);
      if (tripleHelixState) {
        const parsed = JSON.parse(tripleHelixState);
        const newInfo = {
          activeTube: parsed.activeTube || parsed.activeTubeNumber,
          lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated).toLocaleTimeString() : 'unknown',
          hasData: !!parsed,
          timestamp: parsed.lastUpdated ? new Date(parsed.lastUpdated).getTime() : 0
        };

        // Check if changed
        if (!tubeInfo.tripleHelix || tubeInfo.tripleHelix.activeTube !== newInfo.activeTube ||
            tubeInfo.tripleHelix.timestamp !== newInfo.timestamp) {
          statesChanged = true;

          // Add log message if active tube changed
          if (tubeInfo.tripleHelix && tubeInfo.tripleHelix.activeTube !== newInfo.activeTube) {
            const time = new Date().toLocaleTimeString();
            addLog(`[${time}] Triple Helix state tube changed: ${tubeInfo.tripleHelix.activeTube} → ${newInfo.activeTube}`);
          }
        }

        stateInfo.tripleHelix = newInfo;
      }
    } catch (e) {
      console.error('Error parsing triple helix state:', e);
    }

    // Update the state if anything changed
    if (statesChanged) {
      setTubeInfo(stateInfo);
      lastUpdateRef.current = Date.now();

      // Check for inconsistencies between states
      const tubes = Object.values(stateInfo).map((info: any) => info.activeTube);
      if (tubes.length > 1 && new Set(tubes).size > 1) {
        const time = new Date().toLocaleTimeString();
        addLog(`[${time}] ⚠️ WARNING: Inconsistent tube numbers across states: ${JSON.stringify(tubes)}`);
      }
    }

    // Update refreshing state
    setIsRefreshing(false);

    return statesChanged;
  };

  // Add log message
  const addLog = (message: string) => {
    setLogMessages(prev => [message, ...prev.slice(0, 19)]);
  };

  // Initialize tube cycler adapter for performing stitch completions
  const initializeTubeCycler = async () => {
    if (tubeCycler) return tubeCycler; // Already initialized

    setIsLoading(true);
    addLog(`[${new Date().toLocaleTimeString()}] Initializing tube cycler adapter...`);

    try {
      // Dynamic import the adapter to avoid SSR issues (using require() for consistency with TubeStateTestPane)
      if (!StateMachineTubeCyclerAdapter) {
        StateMachineTubeCyclerAdapter = require('../lib/adapters/StateMachineTubeCyclerAdapter');
      }

      // Get actual user ID
      const actualUserId = userId ||
                       localStorage.getItem('zenjin_user_id') ||
                       localStorage.getItem('zenjin_anonymous_id') ||
                       localStorage.getItem('anonymousId');

      if (!actualUserId) {
        addLog(`[${new Date().toLocaleTimeString()}] ❌ No user ID found`);
        setIsLoading(false);
        return null;
      }

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

            addLog(`[${new Date().toLocaleTimeString()}] 📦 Loaded state from ${key}`);
            break;
          }
        } catch (e) {
          addLog(`[${new Date().toLocaleTimeString()}] ❌ Error loading state from ${key}`);
        }
      }

      if (!initialState) {
        addLog(`[${new Date().toLocaleTimeString()}] ⚠️ No existing state found, using default state`);
      }

      // Create the tube cycler adapter
      const adapter = new StateMachineTubeCyclerAdapter({
        userId: actualUserId,
        initialState,
        onStateChange: (newState: any) => {
          // Refresh the UI to show new state
          checkTubeState();

          // Update current stitch reference
          try {
            const currentStitch = adapter.getCurrentStitch();
            if (currentStitch) {
              setCurrentStitchId(currentStitch.id);
              setCurrentThreadId(currentStitch.threadId);
            }
          } catch (e) {
            console.error('Error getting current stitch:', e);
          }

          addLog(`[${new Date().toLocaleTimeString()}] 🔄 State updated: activeTube=${newState.activeTubeNumber}`);
        },
        onTubeChange: (tubeNumber: number) => {
          addLog(`[${new Date().toLocaleTimeString()}] 🔄 Active tube changed to ${tubeNumber}`);
        }
      });

      setTubeCycler(adapter);

      // Get current stitch information
      try {
        const currentStitch = adapter.getCurrentStitch();
        if (currentStitch) {
          setCurrentStitchId(currentStitch.id);
          setCurrentThreadId(currentStitch.threadId);
        }
      } catch (e) {
        console.error('Error getting current stitch:', e);
      }

      addLog(`[${new Date().toLocaleTimeString()}] ✅ Tube cycler initialized successfully`);
      setIsLoading(false);
      return adapter;
    } catch (error) {
      console.error('Error initializing tube cycler:', error);
      addLog(`[${new Date().toLocaleTimeString()}] ❌ Error initializing tube cycler: ${error}`);
      setIsLoading(false);
      return null;
    }
  };

  // Handle stitch completion with a perfect score (20/20)
  const handleCompleteStitchPerfect = async () => {
    const adapter = tubeCycler || await initializeTubeCycler();
    if (!adapter) {
      addLog(`[${new Date().toLocaleTimeString()}] ❌ Cannot complete stitch: No tube cycler adapter`);
      return;
    }

    try {
      // Get current stitch and thread
      const currentStitch = adapter.getCurrentStitch();
      if (!currentStitch) {
        addLog(`[${new Date().toLocaleTimeString()}] ❌ Cannot complete stitch: No current stitch found`);
        return;
      }

      const score = 20;
      const totalQuestions = 20;

      addLog(`[${new Date().toLocaleTimeString()}] 🎯 Completing stitch with perfect score (${score}/${totalQuestions})`);

      // Complete stitch with perfect score
      adapter.handleStitchCompletion(
        currentStitch.threadId,
        currentStitch.id,
        score,
        totalQuestions
      );

      // Force refresh
      setIsRefreshing(true);
      checkTubeState();
    } catch (error) {
      console.error('Error completing stitch:', error);
      addLog(`[${new Date().toLocaleTimeString()}] ❌ Error completing stitch: ${error}`);
    }
  };

  // Handle stitch completion with a partial score (10 FTC + 10 eventually correct)
  const handleCompleteStitchPartial = async () => {
    const adapter = tubeCycler || await initializeTubeCycler();
    if (!adapter) {
      addLog(`[${new Date().toLocaleTimeString()}] ❌ Cannot complete stitch: No tube cycler adapter`);
      return;
    }

    try {
      // Get current stitch and thread
      const currentStitch = adapter.getCurrentStitch();
      if (!currentStitch) {
        addLog(`[${new Date().toLocaleTimeString()}] ❌ Cannot complete stitch: No current stitch found`);
        return;
      }

      // 10 FTC (20pts) + 10 eventually correct (20pts) = 40 points total
      const score = 10; // Only count first-time correct answers for advancement
      const totalQuestions = 20;

      addLog(`[${new Date().toLocaleTimeString()}] 🎯 Completing stitch with partial score (${score}/${totalQuestions}) - 40 total points`);

      // Complete stitch with partial score
      adapter.handleStitchCompletion(
        currentStitch.threadId,
        currentStitch.id,
        score,
        totalQuestions
      );

      // Force refresh
      setIsRefreshing(true);
      checkTubeState();
    } catch (error) {
      console.error('Error completing stitch:', error);
      addLog(`[${new Date().toLocaleTimeString()}] ❌ Error completing stitch: ${error}`);
    }
  };

  // Handle tube cycling
  const handleCycleTube = async () => {
    const adapter = tubeCycler || await initializeTubeCycler();
    if (!adapter) {
      addLog(`[${new Date().toLocaleTimeString()}] ❌ Cannot cycle tube: No tube cycler adapter`);
      return;
    }

    try {
      const currentTube = adapter.getCurrentTube();
      addLog(`[${new Date().toLocaleTimeString()}] 🔄 Cycling from tube ${currentTube}...`);

      // Cycle to next tube
      adapter.nextTube();

      // Force refresh
      setIsRefreshing(true);
      checkTubeState();
    } catch (error) {
      console.error('Error cycling tube:', error);
      addLog(`[${new Date().toLocaleTimeString()}] ❌ Error cycling tube: ${error}`);
    }
  };

  // Initial setup
  useEffect(() => {
    // Mark component as mounted on client side
    setIsMounted(true);

    // Initial check
    checkTubeState();

    // Setup monitoring for localStorage changes
    const storageHandler = () => {
      // Don't check too frequently - throttle to once per second maximum
      const now = Date.now();
      if (now - lastUpdateRef.current > 1000) {
        checkTubeState();
      }
    };

    // Setup regular interval check every 2 seconds
    intervalRef.current = setInterval(() => {
      const changed = checkTubeState();
      // If something changed, log it
      if (changed) {
        const time = new Date().toLocaleTimeString();
        addLog(`[${time}] State updated during interval check`);
      }
    }, 2000);

    // Listen for storage events
    window.addEventListener('storage', storageHandler);

    // Log initial state
    addLog(`[${new Date().toLocaleTimeString()}] Debugger started - monitoring tube state`);

    // Cleanup
    return () => {
      window.removeEventListener('storage', storageHandler);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (tubeCycler) {
        // Clean up adapter if needed
        tubeCycler.destroy?.();
      }
    };
  }, []);

  if (!isMounted) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-800 rounded-lg p-3 shadow-lg text-white text-sm">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold">Tube State Debugger</h3>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setIsRefreshing(true) && checkTubeState()}
              className={`text-xs ${isRefreshing ? 'text-gray-500' : 'text-gray-400 hover:text-white'}`}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Checking...' : 'Refresh'}
            </button>
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="text-xs text-gray-400 hover:text-white"
            >
              {detailsOpen ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
        </div>

        <div className="text-xs">
          <div className="text-gray-400 mb-1">User ID: {userId.substring(0, 8)}...</div>

          {Object.keys(tubeInfo).length === 0 ? (
            <div className="text-yellow-400">No tube state data found</div>
          ) : (
            <div className="space-y-1">
              {Object.entries(tubeInfo).map(([key, info]: [string, any]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-gray-300 capitalize">{key}:</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-medium ${
                      // Color coding for active tube numbers
                      info.activeTube === 1 ? 'text-blue-400' :
                      info.activeTube === 2 ? 'text-green-400' :
                      info.activeTube === 3 ? 'text-purple-400' :
                      'text-red-400'
                    }`}>
                      Tube {info.activeTube}
                    </span>
                    <span className="text-gray-500 text-xs">{info.lastUpdated}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stitch completion buttons */}
          <div className="mt-3 pt-2 border-t border-gray-800">
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-gray-400">Stitch Controls:</div>
              {isLoading && <div className="text-xs text-gray-500">Initializing...</div>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCompleteStitchPerfect}
                disabled={isLoading}
                className="text-xs bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:opacity-50 px-2 py-1.5 rounded text-center"
              >
                Complete 20/20
                <span className="block text-gray-300 text-xs">Perfect Score</span>
              </button>
              <button
                onClick={handleCompleteStitchPartial}
                disabled={isLoading}
                className="text-xs bg-yellow-700 hover:bg-yellow-600 disabled:bg-gray-700 disabled:opacity-50 px-2 py-1.5 rounded text-center"
              >
                Complete 10/20
                <span className="block text-gray-300 text-xs">40 Points Total</span>
              </button>
              <button
                onClick={handleCycleTube}
                disabled={isLoading}
                className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:bg-gray-700 disabled:opacity-50 px-2 py-1.5 rounded col-span-2 text-center"
              >
                Cycle to Next Tube
              </button>
            </div>
          </div>

          {/* Live event log */}
          <div className="mt-3 pt-2 border-t border-gray-800">
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-gray-400">State Change Log:</div>
              <button
                onClick={() => setLogMessages([])}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Clear
              </button>
            </div>
            <div className="bg-gray-950 border border-gray-800 rounded max-h-24 overflow-y-auto p-1 text-xs font-mono text-gray-300">
              {logMessages.length === 0 ? (
                <div className="text-gray-500 italic text-xs p-1">No changes detected yet</div>
              ) : (
                logMessages.map((msg, idx) => (
                  <div key={idx} className="py-0.5 text-xs">
                    {msg}
                  </div>
                ))
              )}
            </div>
          </div>

          {detailsOpen && (
            <div className="mt-3 pt-2 border-t border-gray-800">
              <div className="text-xs text-gray-400 mb-1">Storage Keys:</div>
              <div className="text-xs text-gray-300 space-y-0.5">
                {Object.keys(localStorage)
                  .filter(key => key.includes('state') || key.includes('tube'))
                  .map(key => (
                    <div key={key} className="text-xs truncate font-mono">
                      {key}
                    </div>
                  ))
                }
              </div>

              <div className="flex justify-between mt-3">
                <button
                  onClick={() => {
                    // Force refresh the state to get latest changes
                    setIsRefreshing(true);
                    checkTubeState();
                    addLog(`[${new Date().toLocaleTimeString()}] Manual refresh triggered`);
                  }}
                  className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                  disabled={isRefreshing}
                >
                  Force Refresh
                </button>

                <button
                  onClick={() => {
                    // Set the continue flag for testing
                    localStorage.setItem('zenjin_continue_previous_state', 'true');
                    addLog(`[${new Date().toLocaleTimeString()}] Continue flag set to true`);
                    alert('Continue flag set to true');
                  }}
                  className="text-xs bg-indigo-700 hover:bg-indigo-600 px-2 py-1 rounded"
                >
                  Set Continue Flag
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleTubeStateDebugger;