import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { StitchWithProgress } from '../types/distinction-learning';
import { useAuth } from '../../context/AuthContext';
import useZenjinStore from '../store/zenjinStore';
import { updateZustandFromLegacyState } from '../store/legacyAdapter';
import { useMigratedComponent } from '../store/migrationUtils';

// Import the StateMachine adapter directly
const StateMachineTubeCyclerAdapter = require('../adapters/StateMachineTubeCyclerAdapter');

/**
 * Zustand-enhanced Triple Helix Player hook
 * 
 * An enhanced version of the Triple Helix Player hook that uses Zustand for state management.
 * Provides the same API as the original hook but with more reliable state persistence.
 */
export function useZustandTripleHelixPlayer({ 
  mode = 'default',
  resetPoints = false, // Reset points but maintain stitch progress
  continuePreviousState = false, // Continue from previous state (used by "Continue Playing" button)
  debug = (message: string) => { console.log(message); }
}) {
  // Mark this component as migrated to Zustand
  useMigratedComponent('useZustandTripleHelixPlayer');

  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  
  // Use Zustand store for state
  const storeUserId = useZenjinStore(state => state.userInformation?.userId);
  const storeIsAnonymous = useZenjinStore(state => state.userInformation?.isAnonymous || false);
  const storeTubeState = useZenjinStore(state => state.tubeState);
  const storeLearningProgress = useZenjinStore(state => state.learningProgress);
  const {
    setUserInformation,
    setTubeState,
    setActiveTube,
    incrementPoints,
    syncToServer
  } = useZenjinStore();

  // Enhanced state for tubes and user with stronger initialization
  const [userId, setUserId] = useState(() => {
    // First use Zustand store if available
    if (storeUserId) {
      debug(`Using user ID from Zustand store: ${storeUserId}`);
      return storeUserId;
    }
    
    // CRITICAL FIX: Next check if we have a stored user ID in localStorage
    // This ensures we always have a valid ID even during initial load
    if (typeof window !== 'undefined') {
      try {
        const storedUserId = localStorage.getItem('zenjin_user_id');
        if (storedUserId && storedUserId !== '') {
          debug(`Using stored user ID from localStorage: ${storedUserId}`);
          // Store this explicitly in window object for other components to find
          if (window) {
            (window as any).__CURRENT_USER_ID__ = storedUserId;
          }
          return storedUserId;
        }
      } catch (e) {
        console.error('Error accessing localStorage for userId:', e);
      }
    }

    // If no stored ID, follow the normal priority chain
    
    // Always prioritize authenticated user if available
    if (user?.id && isAuthenticated) {
      debug(`Using authenticated user ID: ${user.id}`);
      
      // Store this in localStorage and window for resilience
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('zenjin_user_id', user.id);
          (window as any).__CURRENT_USER_ID__ = user.id;
          debug(`Saved authenticated user ID to localStorage: ${user.id}`);
        } catch (e) {
          console.error('Error saving userId to localStorage:', e);
        }
      }
      return user.id;
    }
    // Use authenticated user ID if available and not in forced anonymous mode
    else if (user?.id && mode !== 'anonymous') {
      debug(`Using user ID (not yet authenticated): ${user.id}`);
      
      // Store this in localStorage and window for resilience
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('zenjin_user_id', user.id);
          (window as any).__CURRENT_USER_ID__ = user.id;
          debug(`Saved user ID to localStorage: ${user.id}`);
        } catch (e) {
          console.error('Error saving userId to localStorage:', e);
        }
      }
      return user.id;
    }
    // Generate anonymous ID if in anonymous mode
    else if (mode === 'anonymous' || !isAuthenticated) {
      const anonId = `anonymous-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      debug(`Using generated anonymous ID: ${anonId}`);
      
      // Store in localStorage for continuity
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('zenjin_user_id', anonId);
          (window as any).__CURRENT_USER_ID__ = anonId;
        } catch (e) {
          console.error('Error saving anonymous ID to localStorage:', e);
        }
      }
      return anonId;
    }
    // If user object exists but ID isn't available yet, use fallback
    else if (user) {
      debug(`User object exists but ID not available yet - using fallback`);
      return 'anonymous-pending';
    }
    
    debug(`No user ID available - using anonymous placeholder`);
    return 'anonymous'; // Default placeholder until we get real user ID
  });

  // Authenticated users should NEVER be treated as anonymous
  const [isAnonymous, setIsAnonymous] = useState(storeIsAnonymous || isAuthenticated ? false : (mode === 'anonymous' || !user?.id));
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  
  // Triple-Helix state
  const [tubeCycler, setTubeCycler] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const currentTube = useZenjinStore(state => state.tubeState?.activeTube || 1);
  const [currentStitch, setCurrentStitch] = useState<StitchWithProgress | null>(null);
  const [tubeStitches, setTubeStitches] = useState<any[]>([]);
  const [pendingChanges, setPendingChanges] = useState(0);
  
  // Internal state for seamless tube cycling
  const nextTubeRef = useRef<{tube: number, stitch: any, stitches: any[]} | null>(null);
  
  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Accumulated session data - initialized with zeroed points if resetPoints is true
  const [accumulatedSessionData, setAccumulatedSessionData] = useState(() => {
    // If resetPoints is true, always start with 0 points
    if (resetPoints) {
      return {
        totalPoints: 0,
        correctAnswers: 0,
        firstTimeCorrect: 0,
        totalQuestions: 0,
        totalAttempts: 0,
        stitchesCompleted: 0
      };
    }
    
    // Check Zustand store first
    if (storeLearningProgress?.points) {
      return {
        totalPoints: storeLearningProgress.points.session || 0,
        correctAnswers: 0,
        firstTimeCorrect: 0,
        totalQuestions: 0,
        totalAttempts: 0,
        stitchesCompleted: 0
      };
    }
    
    // Otherwise, try to load previous points from localStorage
    if (typeof window !== 'undefined') {
      try {
        const savedState = localStorage.getItem('zenjin_anonymous_state');
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          
          // If continuePreviousState is true, we MUST use the saved data to ensure
          // the Continue Playing button works correctly
          if (continuePreviousState) {
            debug('CRITICAL DIAGNOSTIC: Continue=true set - Using saved state for continuation');
            
            // Add explicit diagnostic about tube state
            if (parsedState.state) {
              const activeTube = parsedState.state.activeTubeNumber || parsedState.state.activeTube;
              debug(`CRITICAL DIAGNOSTIC: Continuing with activeTube=${activeTube} from stored state`);
              
              if (parsedState.state.tubes) {
                // Check each tube's current stitch
                Object.entries(parsedState.state.tubes).forEach(([tubeNum, tube]) => {
                  debug(`TUBE STATE: Tube ${tubeNum} has currentStitchId=${(tube as any).currentStitchId}`);
                });
              }
            }
            
            // Check for accumulatedSessionData in the stored state
            if (parsedState.state && parsedState.state.accumulatedSessionData) {
              // Use all accumulated stats from localStorage
              const accData = parsedState.state.accumulatedSessionData;
              return {
                totalPoints: parsedState.totalPoints || accData.totalPoints || 0,
                correctAnswers: accData.correctAnswers || 0,
                firstTimeCorrect: accData.firstTimeCorrect || 0,
                totalQuestions: accData.totalQuestions || 0,
                totalAttempts: accData.totalAttempts || 0,
                stitchesCompleted: accData.stitchesCompleted || 0
              };
            } else {
              // Fallback to just using totalPoints if no accumulated data
              return {
                totalPoints: parsedState.totalPoints || 0,
                correctAnswers: 0,
                firstTimeCorrect: 0,
                totalQuestions: 0,
                totalAttempts: 0,
                stitchesCompleted: 0
              };
            }
          } 
          // If not continuing, just look for accumulatedSessionData
          else {
            // Check for accumulatedSessionData in the stored state
            if (parsedState.state && parsedState.state.accumulatedSessionData) {
              // Use all accumulated stats from localStorage
              const accData = parsedState.state.accumulatedSessionData;
              return {
                totalPoints: parsedState.totalPoints || accData.totalPoints || 0,
                correctAnswers: accData.correctAnswers || 0,
                firstTimeCorrect: accData.firstTimeCorrect || 0,
                totalQuestions: accData.totalQuestions || 0,
                totalAttempts: accData.totalAttempts || 0,
                stitchesCompleted: accData.stitchesCompleted || 0
              };
            } else {
              // Fallback to just using totalPoints if no accumulated data
              return {
                totalPoints: parsedState.totalPoints || 0,
                correctAnswers: 0,
                firstTimeCorrect: 0,
                totalQuestions: 0,
                totalAttempts: 0,
                stitchesCompleted: 0
              };
            }
          }
        }
      } catch (error) {
        console.error('Error loading previous session data:', error);
      }
    }
    
    // Default if no saved state or error occurred
    return {
      totalPoints: 0,
      correctAnswers: 0,
      firstTimeCorrect: 0,
      totalQuestions: 0,
      totalAttempts: 0,
      stitchesCompleted: 0
    };
  });
  
  // Reference to prevent double rotation
  const rotationInProgressRef = useRef(false);

  // Preload next tube data for seamless transitions
  const preloadNextTube = () => {
    if (!tubeCycler) {
      debug('No tubeCycler available for preloading');
      return;
    }
    
    try {
      // Calculate next tube number following strict 1->2->3->1 cycle
      const currentTubeNum = tubeCycler.getCurrentTube();
      
      // Verify the current tube is valid (1, 2, or 3)
      if (currentTubeNum !== 1 && currentTubeNum !== 2 && currentTubeNum !== 3) {
        debug(`⚠️ Invalid current tube number: ${currentTubeNum} - defaulting to tube 1`);
        // Safety measure - if the tube number is invalid, use tube 1 as current
        const forceCurrentTube = 1;
        
        // Force tube selection to a valid tube
        tubeCycler.selectTube(forceCurrentTube);
        debug(`⚠️ SAFETY: Force-selected tube ${forceCurrentTube}`);
        
        // Now proceed with next tube calculation from the valid tube
        calculateNextTube(forceCurrentTube);
        return;
      }
      
      // Deterministically calculate the next tube in sequence
      const nextTubeNum = (currentTubeNum % 3) + 1; // 1->2->3->1 cycle
      
      debug(`Preloading next tube ${nextTubeNum} from current tube ${currentTubeNum}`);
      calculateNextTube(currentTubeNum);
    } catch (err) {
      debug(`Error in preloadNextTube: ${err}`);
      nextTubeRef.current = null;
    }
  };

  // Helper function to calculate and preload the next tube
  const calculateNextTube = (currentTubeNum: number) => {
    try {
      // Calculate next tube following 1->2->3->1 cycle
      const nextTubeNum = (currentTubeNum % 3) + 1; // 1->2->3->1
      
      debug(`Preloading data for next tube (${nextTubeNum}) from current tube ${currentTubeNum}`);
      
      // Get current state and verify it has all tubes
      const currentState = tubeCycler.getState();
      
      // Validation: Ensure all three tubes exist
      const hasTube1 = !!currentState.tubes[1]?.stitches?.length;
      const hasTube2 = !!currentState.tubes[2]?.stitches?.length;
      const hasTube3 = !!currentState.tubes[3]?.stitches?.length;
      
      debug(`TUBE STATUS: Tube1=${hasTube1 ? 'exists' : 'missing'}, Tube2=${hasTube2 ? 'exists' : 'missing'}, Tube3=${hasTube3 ? 'exists' : 'missing'}`);
      
      // Get next tube data
      const nextTube = currentState.tubes[nextTubeNum];
      if (!nextTube) {
        debug(`Error: Next tube ${nextTubeNum} not found in state - tube cycling may fail`);
        
        // If specifically tube 3 is missing, log error but continue
        if (nextTubeNum === 3 && !hasTube3) {
          debug(`Error: No content available for Tube 3 preloading`);
          // Reset the nextTubeRef to null
          nextTubeRef.current = null;
          // Don't throw, just return
          debug(`Unable to preload Tube 3 - missing content`);
          return;
        }
        nextTubeRef.current = null;
        return;
      }
      
      // Verify the tube has stitches
      if (!nextTube.stitches || nextTube.stitches.length === 0) {
        debug(`Error: Next tube ${nextTubeNum} has no stitches - tube cycling may fail`);
        nextTubeRef.current = null;
        return;
      }
      
      // Get active stitch
      const nextStitchId = nextTube.currentStitchId;
      
      if (!nextStitchId) {
        debug(`Error: No current stitch ID for tube ${nextTubeNum}`);
        
        // Create a fallback stitch ID - use the first stitch
        if (nextTube.stitches.length > 0) {
          const sortedStitches = [...nextTube.stitches].sort((a: any, b: any) => a.position - b.position);
          const fallbackStitch = sortedStitches[0];
          
          // Make a deep copy to prevent reference issues
          const stitchCopy = JSON.parse(JSON.stringify(fallbackStitch));
          const stitchesCopy = JSON.parse(JSON.stringify(sortedStitches));
          
          nextTubeRef.current = {
            tube: nextTubeNum,
            stitch: {...stitchCopy, tubeNumber: nextTubeNum},
            stitches: stitchesCopy
          };
          
          debug(`Recovery: Using first available stitch as fallback for tube ${nextTubeNum}`);
          return;
        }
        
        nextTubeRef.current = null;
        return;
      }
      
      const nextStitch = nextTube.stitches.find((s: any) => s.id === nextStitchId);
      
      if (!nextStitch) {
        debug(`Error: Active stitch ${nextStitchId} not found in tube ${nextTubeNum}`);
        
        // Fall back to first stitch in the tube if we can't find the active one
        if (nextTube.stitches.length > 0) {
          debug(`Recovery: Using first stitch of tube ${nextTubeNum} as fallback`);
          const sortedStitches = [...nextTube.stitches].sort((a: any, b: any) => a.position - b.position);
          const fallbackStitch = sortedStitches[0];
          
          // Make a deep copy to prevent reference issues
          const stitchCopy = JSON.parse(JSON.stringify(fallbackStitch));
          const stitchesCopy = JSON.parse(JSON.stringify(sortedStitches));
          
          nextTubeRef.current = {
            tube: nextTubeNum,
            stitch: {...stitchCopy, tubeNumber: nextTubeNum},
            stitches: stitchesCopy
          };
          
          debug(`Recovery: Preloaded fallback stitch for tube ${nextTubeNum}`);
          return;
        }
        
        nextTubeRef.current = null;
        return;
      }
      
      // Make deep copies of the data to prevent reference issues
      const stitchCopy = JSON.parse(JSON.stringify(nextStitch));
      const stitchesCopy = JSON.parse(JSON.stringify(nextTube.stitches));
      
      // Sort stitches by position
      const sortedStitches = stitchesCopy.sort((a: any, b: any) => a.position - b.position);
      
      // Store in ref for direct access without re-renders
      nextTubeRef.current = {
        tube: nextTubeNum,
        stitch: {...stitchCopy, tubeNumber: nextTubeNum},
        stitches: sortedStitches
      };
      
      debug(`Successfully preloaded next tube data: Tube ${nextTubeNum} with stitch ${nextStitch.id}`);
    } catch (err) {
      debug(`Error in calculateNextTube: ${err}`);
      nextTubeRef.current = null;
    }
  };


  // First, try to load state from server if user is authenticated
  useEffect(() => {
    if (userId && userId !== 'anonymous-pending' && !isAnonymous) {
      debug(`Attempting to load state from server for authenticated user ${userId}`);

      // Try to load state from server
      useZenjinStore.getState().loadFromServer(userId)
        .then(success => {
          if (success) {
            debug(`Successfully loaded state from server for user ${userId}`);
          } else {
            debug(`Failed to load state from server for user ${userId}, will use localStorage`);
          }
        })
        .catch(err => {
          debug(`Error loading state from server: ${err}`);
        });
    }
  }, [userId, isAnonymous]);

  // Initialize TubeCycler when userId is available
  useEffect(() => {
    if (isLoading && userId && userId !== 'anonymous-pending') {
      async function initialize() {
        debug(`Initializing TubeCycler for user ${userId} (anonymous: ${isAnonymous})`);

        try {
          // Import the TubeCycler initialization functionality
          const tubeCyclerModule = require('../tube-config-integration');
          const adapter = await tubeCyclerModule.initializeTubeCycler(
            isAnonymous ? null : { id: userId },
            {
              onStateChange: handleStateChange,
              onTubeChange: handleTubeChange,
              debug: debug,
              continuePreviousState
            }
          );
          
          if (!adapter) {
            debug('Failed to create TubeCycler adapter');
            setLoadError('Failed to initialize learning content.');
            setIsLoading(false);
            return;
          }
          
          // Get initial state
          const initialState = adapter.getState();
          
          if (!initialState || !initialState.tubes) {
            debug('TubeCycler adapter returned invalid state');
            setLoadError('Learning content is not available.');
            setIsLoading(false);
            return;
          }
          
          // Set the adapter and update UI components
          setTubeCycler(adapter);
          setState(initialState);
          
          // Update Zustand store from legacy state
          updateZustandFromLegacyState(initialState);
          
          // Set the current tube in Zustand store
          const currentTubeNum = adapter.getCurrentTube();
          setActiveTube(currentTubeNum);
          
          // Get current stitch and tube stitches
          const currentStitch = adapter.getCurrentStitch();
          const tubeStitches = adapter.getCurrentTubeStitches();
          
          if (!currentStitch) {
            debug('No current stitch available');
            setLoadError('Current learning content is not available.');
            setIsLoading(false);
            return;
          }
          
          // Set the component state
          setCurrentStitch(currentStitch);
          setTubeStitches(tubeStitches || []);
          
          // Preload next tube for seamless transitions
          preloadNextTube();
          
          // Update Zustand store with user information
          setUserInformation({
            userId,
            isAnonymous,
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString()
          });
          
          // Complete loading
          setIsLoading(false);
          debug('TubeCycler initialization complete');
        } catch (error) {
          console.error('Error initializing TubeCycler:', error);
          setLoadError(`Failed to initialize learning system: ${error instanceof Error ? error.message : String(error)}`);
          setIsLoading(false);
        }
      }
      
      initialize();
    }
  }, [userId, isAnonymous, continuePreviousState]);

  // Skip flag to completely block UI updates during transitions
  const skipUIUpdatesRef = useRef(false);
  
  // State change handler
  const handleStateChange = (newState: any) => {
    // First, always update internal state reference
    setState(newState);
    
    // Track pending changes - with safety check for getStats method
    let pendingCount = 0;
    try {
      if (tubeCycler && typeof tubeCycler.getStats === 'function') {
        pendingCount = tubeCycler.getStats()?.pendingChanges || 0;
      }
    } catch (err) {
      console.warn('Error getting stats:', err);
    }
    setPendingChanges(pendingCount);
    
    // Skip UI updates if we're in a transition
    if (skipUIUpdatesRef.current) {
      debug('Skipping UI update during transition');
      return;
    }
    
    // Normal flow: Update UI components
    try {
      if (tubeCycler) {
        const currentStitch = tubeCycler.getCurrentStitch();
        const tubeStitches = tubeCycler.getCurrentTubeStitches();
        const currentTubeNum = tubeCycler.getCurrentTube();
        
        // Update component state
        setCurrentStitch(currentStitch);
        setTubeStitches(tubeStitches || []);
        
        // Update Zustand store
        setActiveTube(currentTubeNum);
        updateZustandFromLegacyState(newState);
        
        // Preload next tube for seamless transitions
        preloadNextTube();
      }
    } catch (err) {
      console.error('Error handling state change:', err);
    }
  };
  
  // Tube change handler
  const handleTubeChange = (tubeNumber: number) => {
    debug(`Tube changed to ${tubeNumber}`);
    
    // Update Zustand store with new active tube
    setActiveTube(tubeNumber);
    
    // Also update our internal state (just to be safe)
    if (tubeCycler) {
      try {
        // Get the current stitch and tube stitches for the new tube
        const currentStitch = tubeCycler.getCurrentStitch();
        const tubeStitches = tubeCycler.getCurrentTubeStitches();
        
        // Update component state
        setCurrentStitch(currentStitch);
        setTubeStitches(tubeStitches || []);
        
        // Preload next tube for seamless transitions
        preloadNextTube();
      } catch (err) {
        console.error('Error handling tube change:', err);
      }
    }
  };
  
  // Handle stitch completion
  const completeStitch = async (
    threadId: string,
    stitchId: string,
    score: number,
    total: number,
    options?: {
      skipAnimation?: boolean;
      skipTubeRotation?: boolean;
    }
  ) => {
    if (!tubeCycler || rotationInProgressRef.current) {
      debug('TubeCycler not available or rotation already in progress');
      return false;
    }
    
    try {
      // Block double submissions
      rotationInProgressRef.current = true;
      
      // Get the current tube before completion
      const currentTubeNum = tubeCycler.getCurrentTube();
      debug(`Current tube before completion: ${currentTubeNum}`);
      
      // Import the TubeCycler module for completion handler
      const tubeCyclerModule = require('../tube-config-integration');
      const completionHandler = tubeCyclerModule.createStitchCompletionHandler(
        tubeCycler,
        (adapter: any) => {
          try {
            // Get the new state after completion
            const newState = adapter.getState();
            setState(newState);
            
            // Update Zustand store
            updateZustandFromLegacyState(newState);
            
            // Update UI components
            const currentStitch = adapter.getCurrentStitch();
            const tubeStitches = adapter.getCurrentTubeStitches();
            const newTubeNum = adapter.getCurrentTube();
            
            // Update component state
            setCurrentStitch(currentStitch);
            setTubeStitches(tubeStitches || []);
            
            // Update Zustand store with new active tube
            setActiveTube(newTubeNum);
            
            // Preload next tube for seamless transitions
            preloadNextTube();
            
            // Check if tube has changed
            const tubeHasChanged = currentTubeNum !== newTubeNum;
            
            // If tube rotated and we should show celebration
            if (tubeHasChanged && !options?.skipAnimation) {
              debug(`Tube rotated from ${currentTubeNum} to ${newTubeNum} - showing celebration`);
              setShowCelebration(true);
            }
            
            // Update accumulated session data
            setAccumulatedSessionData(prev => ({
              ...prev,
              totalPoints: prev.totalPoints + (Math.ceil(score * 1.1) || 0),
              correctAnswers: prev.correctAnswers + score,
              totalQuestions: prev.totalQuestions + total,
              stitchesCompleted: prev.stitchesCompleted + 1
            }));
            
            // Update points in Zustand store
            incrementPoints(Math.ceil(score * 1.1) || 0);

            // We don't sync to server after each stitch completion
            // Only sync at the end of the session when the user clicks "Finish"
            debug('Stitch completed - state will be synced at the end of the session');

            // Release rotation lock
            rotationInProgressRef.current = false;
          } catch (err) {
            console.error('Error in completion callback:', err);
            rotationInProgressRef.current = false;
          }
        }, 
        { 
          skipTubeRotation: options?.skipTubeRotation || false 
        }
      );
      
      // Execute the completion
      completionHandler(threadId, stitchId, score, total);
      return true;
    } catch (err) {
      console.error('Error completing stitch:', err);
      rotationInProgressRef.current = false;
      return false;
    }
  };
  
  // Handle session completion with sync to server
  const handleSessionComplete = async (
    sessionResults: any,
    forceNavigate: boolean = false
  ) => {
    try {
      debug('Handling session completion');

      if (!tubeCycler) {
        debug('No TubeCycler available for session completion');
        return false;
      }

      // For authenticated users, save to database
      if (!isAnonymous && userId && userId.indexOf('anonymous') !== 0) {
        debug(`Saving session data for authenticated user ${userId}`);

        // Import the session completion module
        const tubeCyclerModule = require('../tube-config-integration');

        // End the session
        await tubeCyclerModule.endSession(
          { id: userId },
          tubeCycler
        );

        // Make sure Zustand store is up to date with the latest state
        const finalState = tubeCycler.getState();
        updateZustandFromLegacyState(finalState);

        // THIS IS THE ONE PLACE WE SYNC TO SERVER - at the end of a session
        debug('Syncing final state to server at end of session');
        await syncToServer();

        debug('Session data saved to server');
      }
      // For anonymous users, save to localStorage only
      else {
        debug(`Saving session data for anonymous user to localStorage`);

        // Import the localStorage save module
        const { saveToLocalStorage } = require('../tube-config-loader');

        // Save state to localStorage
        await saveToLocalStorage(null, tubeCycler.getState());

        // Save session data in the state
        const stateWithSession = {
          ...tubeCycler.getState(),
          accumulatedSessionData: {
            totalPoints: accumulatedSessionData.totalPoints,
            correctAnswers: accumulatedSessionData.correctAnswers,
            firstTimeCorrect: accumulatedSessionData.firstTimeCorrect,
            totalQuestions: accumulatedSessionData.totalQuestions,
            totalAttempts: accumulatedSessionData.totalAttempts,
            stitchesCompleted: accumulatedSessionData.stitchesCompleted
          }
        };

        // Save the enhanced state
        await saveToLocalStorage(null, stateWithSession);

        // Make sure Zustand store is up to date with the latest state
        updateZustandFromLegacyState(stateWithSession);

        // Sync to localStorage via Zustand store's persistence
        useZenjinStore.getState().saveToLocalStorage();

        debug('Session data saved to localStorage');
      }

      // If we need to navigate
      if (forceNavigate) {
        debug('Forced navigation requested');
        // Use Next.js router instead of direct location navigation to preserve state
        router.push('/dashboard');
      }

      return true;
    } catch (err) {
      console.error('Error completing session:', err);
      return false;
    }
  };
  
  return {
    // User identity
    userId,
    isAnonymous,
    
    // State
    state,
    currentTube,
    currentStitch,
    tubeStitches,
    
    // Loading state
    isLoading,
    loadError,
    
    // Celebration state
    showCelebration,
    setShowCelebration,
    
    // API
    tubeCycler,
    preloadNextTube,
    completeStitch,
    handleSessionComplete,
    
    // Session data
    accumulatedSessionData,
    
    // Updates pending
    pendingChanges,
    showLoginPrompt,
    setShowLoginPrompt
  };
}