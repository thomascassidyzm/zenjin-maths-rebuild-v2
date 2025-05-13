import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import MinimalDistinctionPlayer from '../components/MinimalDistinctionPlayer';
import MinimalDistinctionPlayerWithUpgrade from '../components/MinimalDistinctionPlayerWithUpgrade';
import BackgroundBubbles from '../components/BackgroundBubbles';
import StitchCelebration from '../components/StitchCelebration';
import SubscriptionStatusIndicator from '../components/subscription/SubscriptionStatusIndicator';
import DevTestPane from '../components/DevTestPane';
import { useAuth } from '../context/AuthContext';
// SIMPLIFIED: Remove complex hook and use the store directly
// import { useTripleHelixPlayer } from '../lib/playerUtils';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';
import UserWelcomeButton from '../components/UserWelcomeButton';
import { useZenjinStore } from '../lib/store/zenjinStore';
import { useTwoPhaseContentLoading } from '../lib/hooks/useTwoPhaseContentLoading';

// Component for playful loading messages that cycle every 2 seconds
const LoadingMessage = ({ isAnonymous }: { isAnonymous: boolean }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  
  // Different message sets for anonymous vs. logged-in users
  const anonymousMessages = [
    "Warming up our number powers...",
    "Getting your maths playground ready...",
    "Counting down to blast off...",
    "Preparing your brain challenge...",
    "Loading the number fun..."
  ];
  
  const memberMessages = [
    "Firing up the engines...",
    "Tuning the math circuits...",
    "Calculating all the things...",
    "Organizing your learning journey...",
    "Preparing your personalized content..."
  ];
  
  // Select the appropriate message set
  const messages = isAnonymous ? anonymousMessages : memberMessages;
  
  // Cycle through messages every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [messages.length]);
  
  return <>{messages[messageIndex]}</>;
};

/**
 * Minimal Player - Triple-Helix with minimal UI
 * 
 * This is a streamlined version of the player that removes the admin controls
 * but keeps the player component exactly the same
 */
export default function MinimalPlayer() {
  const router = useRouter();
  const { mode, force, resetPoints, dev, admin, continue: shouldContinue } = router.query;
  const { user, isAuthenticated, loading: authLoading, signOut } = useAuth();
  const { isSubscribed, tier } = useSubscriptionStatus();

  // Initialize content loading with two-phase approach
  const {
    activeStitchLoaded,
    phase1Loaded,
    phase2Loaded,
    phase1Loading,
    totalStitchesLoaded,
    loadAdditionalContent
  } = useTwoPhaseContentLoading();

  // SIMPLIFIED: Directly access relevant state from Zustand store
  const tubeState = useZenjinStore(state => state.tubeState);
  const activeTubeNumber = useZenjinStore(state => state.tubeState?.activeTube || 1);
  const fetchStitch = useZenjinStore(state => state.fetchStitch);
  const totalPoints = useZenjinStore(state => state.userState?.totalPoints || 0);
  const completedSessions = useZenjinStore(state => state.userState?.completedSessions || 0);
  const fillInitialContentBuffer = useZenjinStore(state => state.fillInitialContentBuffer);

  // State for loading and errors
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState('');
  const [tubeInfo, setTubeInfo] = useState<any>({});
  const [showAdminControls] = useState(admin === 'true');
  const [sessionPoints, setSessionPoints] = useState(0);

  // Record answer function to handle player session completion
  const recordAnswer = (results: any) => {
    console.log('Recording session results:', results);
    if (results?.totalPoints) {
      setSessionPoints(prev => prev + results.totalPoints);
    }
    // Could add more sophisticated handling here if needed
  };

  // Function to handle moving to next question
  const nextQuestion = () => {
    console.log('Moving to next question');
    // This is a simplified placeholder for the next question logic
  };

  // Function to restart in case of errors
  const restart = () => {
    setIsLoading(true);
    setError(null);
    // Trigger content reload
    fillInitialContentBuffer();
    setIsLoading(false);
  };

  // Create tubeData object from Zustand store's tubeState
  const [tubeData, setTubeData] = useState<Record<number, any> | null>(null);

  // Effect to handle waiting for tube data to be available
  useEffect(() => {
    if (!tubeState || !tubeState.tubes) {
      console.log('Waiting for tube state to load from Zustand store...');

      // If the tube state isn't available yet, let's load it
      const loadTubeState = async () => {
        try {
          console.log('Attempting to fill initial content buffer...');
          await fillInitialContentBuffer();

          // Get the updated state
          const updatedState = useZenjinStore.getState().tubeState;
          if (updatedState && updatedState.tubes) {
            console.log('Successfully loaded tube state after initialization');
            processTubeState(updatedState);
          } else {
            console.error('Still no tube state available after initialization');
          }
        } catch (error) {
          console.error('Error loading tube state:', error);
        }
      };

      loadTubeState();
      return;
    }

    // Process tube state when available
    processTubeState(tubeState);
  }, [tubeState, fillInitialContentBuffer]);

  // Function to process tube state into tubeData
  const processTubeState = (state: any) => {
    console.log('Processing tube state to tubeData:', state);

    if (!state.tubes) {
      console.error('No tubes in tube state');
      return;
    }

    // Build tube data object from Zustand store
    const tubes = Object.entries(state.tubes).reduce((acc, [tubeNumStr, tube]: [string, any]) => {
      const tubeNum = parseInt(tubeNumStr);
      acc[tubeNum] = {
        ...tube,
        // Ensure we have all the properties we need
        threadId: tube.threadId || `thread-T${tubeNum}-001`,
        currentStitchId: tube.currentStitchId,
        positions: tube.positions || {},
        stitches: tube.stitches || []
      };
      return acc;
    }, {} as Record<number, any>);

    console.log('Tube data processed:', tubes);
    setTubeData(tubes);
  };

  // Simply check if auth is loading - no need for additional state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center player-bg">
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="animate-spin mb-4 h-12 w-12 border-4 border-t-teal-500 border-teal-200 rounded-full mx-auto"></div>
          <h2 className="text-xl font-medium text-white">Preparing Your Learning Experience</h2>
          <p className="text-white/70 mt-2">Loading your personalized content...</p>
        </div>
      </div>
    );
  }

  // Check if we should reset points but maintain stitch progress
  const shouldResetPoints = resetPoints === 'true';

  // Check if we should continue from previous state (important for "Continue Playing" button)
  // Get continue flag from both the query parameter and localStorage
  // This ensures we continue from the previous state even if the URL parameter isn't present
  const continuePreviousState =
    shouldContinue === 'true' ||
    (typeof window !== 'undefined' && localStorage.getItem('zenjin_continue_previous_state') === 'true');

  // Add state to track if we're continuing from previous state
  const [isContinuingFromPrevious, setIsContinuingFromPrevious] = useState(false);

  // Clear the flag after reading it to prevent persisting the state indefinitely
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('zenjin_continue_previous_state') === 'true') {
      console.log('CRITICAL: Clearing zenjin_continue_previous_state flag after reading');
      localStorage.removeItem('zenjin_continue_previous_state');

      // Set the state to show we're continuing from previous state
      setIsContinuingFromPrevious(true);
    }
  }, []);

  // Check if dev mode is enabled
  const showDevTools = dev === 'true';

  // Determine the correct player mode based solely on auth state - simple and clear
  const playerMode = isAuthenticated && user?.id ? 'authenticated' : 'anonymous';

  // Simplified logging - just a single log statement
  console.log(`Auth state: User is ${isAuthenticated ? 'authenticated' : 'anonymous'}, mode: ${playerMode}, ID: ${user?.id || 'anonymous'}`);

  // Set up a listener for localStorage state changes
  useEffect(() => {
    if (!user?.id) return;

    const userId = user.id;
    console.log(`Setting up tube state listener for user ${userId}`);

    // Function to load state from localStorage directly
    const loadStateFromLocalStorage = () => {
      if (tubeData && Object.keys(tubeData).length > 0) {
        console.log('Already have tube data, skipping localStorage load');
        return true;
      }

      try {
        // Check for state in localStorage - this gets populated by _app.tsx after API calls
        const stateKey = `zenjin_state_${userId}`;
        const stateJson = localStorage.getItem(stateKey);

        if (stateJson) {
          const state = JSON.parse(stateJson);
          console.log('Found state in localStorage:', state);

          if (state.tubes && Object.keys(state.tubes).length > 0) {
            console.log('DIRECT APPROACH: Using state from localStorage');

            // Process the tubes directly
            const tubes = {};
            Object.entries(state.tubes).forEach(([tubeNumStr, tube]) => {
              const tubeNum = parseInt(tubeNumStr);
              tubes[tubeNum] = {
                ...tube,
                threadId: tube.threadId || `thread-T${tubeNum}-001`,
                currentStitchId: tube.currentStitchId || `stitch-T${tubeNum}-001-01`,
                positions: tube.positions || {},
                stitches: tube.stitches || []
              };
            });

            console.log('Processed tube data from localStorage:', tubes);
            setTubeData(tubes);
            setIsLoading(false);
            return true;
          }
        }
      } catch (error) {
        console.error('Error loading state from localStorage:', error);
      }

      return false;
    };

    // Check localStorage immediately
    if (loadStateFromLocalStorage()) {
      console.log('Successfully loaded state from localStorage on first try');
      return;
    }

    // If not found, set up a polling mechanism to check periodically
    console.log('State not found in localStorage yet, setting up polling');
    let attempts = 0;
    const maxAttempts = 10;
    const pollInterval = 1000; // 1 second

    const poll = setInterval(() => {
      attempts++;
      console.log(`Polling for state in localStorage (attempt ${attempts}/${maxAttempts})`);

      if (loadStateFromLocalStorage()) {
        console.log('Successfully loaded state from localStorage after polling');
        clearInterval(poll);
        return;
      }

      if (attempts >= maxAttempts) {
        console.error('Failed to load state from localStorage after maximum attempts');
        clearInterval(poll);

        // Fallback to the normal initialization process
        console.log('Falling back to normal initialization process');
        initializeContentManually();
      }
    }, pollInterval);

    return () => clearInterval(poll);
  }, [user?.id, tubeData]);

  // Manual initialization as fallback
  const initializeContentManually = async () => {
    try {
      console.log('FALLBACK: Manually initializing content');
      setIsLoading(true);

      // Fill initial content buffer from Zustand store
      await fillInitialContentBuffer();

      // Get the updated tube state directly from the store
      const updatedState = useZenjinStore.getState().tubeState;
      if (updatedState && updatedState.tubes) {
        console.log('Successfully loaded tube state after manual initialization');
        processTubeState(updatedState);
      } else {
        // Create emergency fallback tube data
        console.log('No tube state available, creating emergency fallback data');
        const fallbackTubes = {
          1: {
            threadId: 'thread-T1-001',
            currentStitchId: 'stitch-T1-001-01',
            positions: {
              0: { stitchId: 'stitch-T1-001-01', skipNumber: 3, distractorLevel: 'L1' }
            }
          },
          2: {
            threadId: 'thread-T2-001',
            currentStitchId: 'stitch-T2-001-01',
            positions: {
              0: { stitchId: 'stitch-T2-001-01', skipNumber: 3, distractorLevel: 'L1' }
            }
          },
          3: {
            threadId: 'thread-T3-001',
            currentStitchId: 'stitch-T3-001-01',
            positions: {
              0: { stitchId: 'stitch-T3-001-01', skipNumber: 3, distractorLevel: 'L1' }
            }
          }
        };
        setTubeData(fallbackTubes);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error in manual initialization:', error);
      setError('Error loading content. Please try again.');
      setIsLoading(false);
    }
  };

  // Function to manually switch tubes (for debugging)
  const switchTube = (tubeNumber: number) => {
    // Get the user ID
    const uid = localStorage.getItem('zenjin_user_id') ||
                localStorage.getItem('zenjin_anonymous_id') ||
                user?.id || 'anonymous';

    try {
      // Update Zustand store directly
      useZenjinStore.getState().setActiveTube(tubeNumber);

      // Also update localStorage for persistence
      const stateKey = `zenjin_state_${uid}`;
      const stateJson = localStorage.getItem(stateKey);

      if (stateJson) {
        const state = JSON.parse(stateJson);
        state.activeTube = tubeNumber;
        state.activeTubeNumber = tubeNumber;
        state.lastUpdated = new Date().toISOString();
        localStorage.setItem(stateKey, JSON.stringify(state));
      }

      // Reload to see changes
      window.location.reload();
    } catch (e) {
      console.error('Error switching tube:', e);
      alert(`Error: ${e.message}`);
    }
  };

  // Show function to get stitch info
  const getStitchInfo = (tubeNumber: number, stitchId: string) => {
    if (!tubeData || !tubeData[tubeNumber]) {
      return null;
    }

    const tube = tubeData[tubeNumber];

    // Check in positions first (preferred)
    if (tube.positions) {
      for (const [pos, data] of Object.entries(tube.positions)) {
        if ((data as any).stitchId === stitchId) {
          return {
            position: parseInt(pos),
            ...data
          };
        }
      }
    }

    // Fallback to stitches array
    if (tube.stitches) {
      return tube.stitches.find((s: any) => s.id === stitchId);
    }

    return null;
  };
  
  // Track tube info for admin tools
  useEffect(() => {
    if (showAdminControls && tubeData && activeTubeNumber) {
      const activeTube = tubeData[activeTubeNumber];
      if (activeTube) {
        // Get stitch info for admin display
        const currentStitchId = activeTube.currentStitchId;
        const stitchInfo = getStitchInfo(activeTubeNumber, currentStitchId);

        // Count total stitches based on available data format
        let totalStitches = 0;
        if (activeTube.positions && Object.keys(activeTube.positions).length > 0) {
          // Position-based format
          totalStitches = Object.keys(activeTube.positions).length;
        } else if (activeTube.stitches && activeTube.stitches.length > 0) {
          // Legacy stitches array format
          totalStitches = activeTube.stitches.length;
        }

        setTubeInfo({
          activeTubeNumber,
          currentStitchId,
          totalStitches,
          stitchInfo
        });
      }
    }
  }, [tubeData, activeTubeNumber, showAdminControls, getStitchInfo]);

  // Show a special celebration when a stitch is completed
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationPoints, setCelebrationPoints] = useState(0);
  const [celebrationLevel, setCelebrationLevel] = useState(1);

  // Handle celebration events
  const onCelebrateStitch = (points: number, level: number = 1) => {
    console.log(`Celebrating stitch completion with ${points} points at level ${level}`);
    setCelebrationPoints(points);
    setCelebrationLevel(level);
    setShowCelebration(true);

    // Record the celebration in analytics if available
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'stitch_completed', {
          'level': level,
          'points': points,
          'tube': activeTubeNumber
        });
      }
    } catch (e) {
      console.error('Error logging analytics:', e);
    }
  };

  // Function to celebrate current stitch (for compatibility with existing API expectations)
  const celebrateCurrentStitch = (points: number = 60) => {
    onCelebrateStitch(points, 1);
  };

  // Function to switch to next stitch (placeholder for API compatibility)
  const switchToNextStitch = () => {
    console.log('Switching to next stitch (placeholder)');
    // In our simplified model, this would be handled by the component itself
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center player-bg">
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="animate-spin mb-4 h-12 w-12 border-4 border-t-teal-500 border-teal-200 rounded-full mx-auto"></div>
          <h2 className="text-xl font-medium text-white">
            <LoadingMessage isAnonymous={playerMode === 'anonymous'} />
          </h2>
          <p className="text-white/70 mt-2">This should only take a moment...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center player-bg">
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-medium text-white">Oops! Something went wrong</h2>
          <p className="text-white/70 mt-2 mb-4">{error}</p>
          <button
            onClick={restart}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Debug logging for tube data
  if (tubeData && activeTubeNumber) {
    console.log(`Tube data debug:`, {
      activeTubeNumber,
      hasActiveTube: !!tubeData[activeTubeNumber],
      availableTubes: Object.keys(tubeData),
    });

    if (tubeData[activeTubeNumber]) {
      const activeTube = tubeData[activeTubeNumber];
      console.log(`Active tube data:`, {
        currentStitchId: activeTube.currentStitchId,
        hasPositions: !!activeTube.positions,
        positionCount: activeTube.positions ? Object.keys(activeTube.positions).length : 0,
        hasStitches: !!activeTube.stitches,
        stitchCount: activeTube.stitches ? activeTube.stitches.length : 0
      });
    }
  } else {
    console.error(`Missing tube data or active tube number: tubeData=${!!tubeData}, activeTubeNumber=${activeTubeNumber}`);
  }
  
  // Render player component directly from the Zustand store data
  const renderPlayer = () => {
    // Enhanced diagnostics for tube data validation
    if (!tubeData) {
      console.error('No tube data object found for rendering player');
      return (
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="text-white text-xl mb-4">No content available</div>
          <div className="text-white text-opacity-70 mb-6">
            Unable to load learning content. The tube data is missing. Please try refreshing the page.
          </div>
        </div>
      );
    }

    if (!activeTubeNumber) {
      console.error('No active tube number found for rendering player');
      return (
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="text-white text-xl mb-4">No active tube selected</div>
          <div className="text-white text-opacity-70 mb-6">
            Unable to determine which tube to display. Please try refreshing the page.
          </div>
        </div>
      );
    }

    if (!tubeData[activeTubeNumber]) {
      console.error(`Missing tube data for active tube ${activeTubeNumber}`);
      return (
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="text-white text-xl mb-4">No content available</div>
          <div className="text-white text-opacity-70 mb-6">
            Unable to load learning content for tube {activeTubeNumber}. Please try refreshing the page.
          </div>
          <div className="text-white text-opacity-50 text-xs mt-4">
            Available tubes: {Object.keys(tubeData).join(', ')}
          </div>
        </div>
      );
    }

    // Get the active tube data
    const activeTube = tubeData[activeTubeNumber];

    // Enhanced logging to diagnose the data structure
    console.log(`Active tube data structure for tube ${activeTubeNumber}:`, {
      hasPositions: !!activeTube.positions,
      positionsType: activeTube.positions ? typeof activeTube.positions : 'undefined',
      positionsCount: activeTube.positions ? Object.keys(activeTube.positions).length : 0,
      hasStitches: !!activeTube.stitches,
      stitchesType: activeTube.stitches ? (Array.isArray(activeTube.stitches) ? 'array' : typeof activeTube.stitches) : 'undefined',
      stitchesCount: activeTube.stitches && Array.isArray(activeTube.stitches) ? activeTube.stitches.length : 0,
      currentStitchId: activeTube.currentStitchId || 'undefined',
      threadId: activeTube.threadId || 'undefined'
    });

    // Check for empty tube data
    if ((!activeTube.positions || Object.keys(activeTube.positions).length === 0) &&
        (!activeTube.stitches || !Array.isArray(activeTube.stitches) || activeTube.stitches.length === 0)) {
      console.error(`Tube ${activeTubeNumber} has no valid content (empty positions and stitches)`);
      return (
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="text-white text-xl mb-4">Empty Tube Content</div>
          <div className="text-white text-opacity-70 mb-6">
            The selected tube appears to be empty. Please try refreshing the page or selecting a different tube.
          </div>
          <div className="text-white text-opacity-50 text-xs mt-4">
            Tube {activeTubeNumber} has no positions or stitches.
          </div>
        </div>
      );
    }

    // Convert tube data to thread format expected by MinimalDistinctionPlayer
    // Support both position-based and legacy stitches array formats
    let stitches = [];

    // First check if we have positions (new format)
    if (activeTube.positions && Object.keys(activeTube.positions).length > 0) {
      console.log(`Using positions-based data format for tube ${activeTubeNumber} with ${Object.keys(activeTube.positions).length} positions`);

      try {
        // Log the first few positions for debugging
        const firstFewPositions = Object.entries(activeTube.positions).slice(0, 3);
        console.log('Sample positions data:', firstFewPositions);

        // Convert positions to stitches array
        const positionsArray = Object.entries(activeTube.positions).map(([pos, data]) => {
          // Add extra validation to handle malformed data
          if (!data || typeof data !== 'object') {
            console.error(`Invalid position data at position ${pos}:`, data);
            return null;
          }

          // Ensure we have a valid stitchId
          if (!data.stitchId) {
            console.error(`Missing stitchId for position ${pos}:`, data);
            return null;
          }

          return {
            id: data.stitchId,
            position: parseInt(pos),
            skipNumber: data.skipNumber || 3,
            distractorLevel: data.distractorLevel || 'L1'
          };
        }).filter(Boolean); // Remove null entries from malformed data

        // Sort by position
        stitches = positionsArray.sort((a, b) => a.position - b.position);
        console.log(`Successfully converted ${stitches.length} positions to stitches format`);

        // Log the first few stitches for debugging
        if (stitches.length > 0) {
          console.log('First few converted stitches:', stitches.slice(0, 3));
        }
      } catch (error) {
        console.error(`Error processing positions data for tube ${activeTubeNumber}:`, error);
        // Fall back to legacy format if available
        if (activeTube.stitches && activeTube.stitches.length > 0) {
          console.log(`Falling back to legacy stitches array after positions error`);
          stitches = activeTube.stitches;
        }
      }
    }
    // Fall back to legacy stitches array if available
    else if (activeTube.stitches && Array.isArray(activeTube.stitches) && activeTube.stitches.length > 0) {
      console.log(`Using legacy stitches array format for tube ${activeTubeNumber} with ${activeTube.stitches.length} stitches`);
      stitches = activeTube.stitches;

      // Log the first few stitches for debugging
      if (stitches.length > 0) {
        console.log('First few legacy stitches:', stitches.slice(0, 3));
      }
    }
    // No content available
    else {
      console.error(`No valid stitch data found for tube ${activeTubeNumber} (neither positions nor stitches)`);
    }

    // Check if we have any valid stitches to create a thread
    if (stitches.length === 0) {
      console.error(`No valid stitches found for tube ${activeTubeNumber} after processing both formats`);
      return (
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="text-white text-xl mb-4">No Learning Content Available</div>
          <div className="text-white text-opacity-70 mb-6">
            We couldn't find any content to display for this tube. Please try refreshing the page or selecting a different tube.
          </div>
          <button
            onClick={restart}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    // SIMPLIFIED: Just check if active tube data exists and pass it to component
    try {
      const activeTube = tubeData[activeTubeNumber];

      // Verify the tube has content (either positions or stitches)
      const hasPositions = activeTube.positions && Object.keys(activeTube.positions).length > 0;
      const hasStitches = activeTube.stitches && Array.isArray(activeTube.stitches) && activeTube.stitches.length > 0;

      if (!hasPositions && !hasStitches) {
        console.error(`Tube ${activeTubeNumber} has no content (neither positions nor stitches)`);
      } else {
        console.log(`Tube ${activeTubeNumber} has content: positions=${hasPositions}, stitches=${hasStitches}`);

        // Log content stats
        if (hasPositions) {
          console.log(`Positions count: ${Object.keys(activeTube.positions).length}`);
        }
        if (hasStitches) {
          console.log(`Stitches count: ${activeTube.stitches.length}`);
        }
      }

      // Additional debug information for analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        try {
          (window as any).gtag('event', 'content_loaded', {
            'tube_number': activeTubeNumber,
            'content_type': hasPositions ? 'position-based' : (hasStitches ? 'legacy' : 'empty')
          });
        } catch (error) {
          console.error('Error sending analytics event:', error);
        }
      }

      console.log(`Creating thread adapter for the MinimalDistinctionPlayer`);

      // Create a thread object from the tube data that the MinimalDistinctionPlayer can use
      const createThreadFromTube = (tubeData, tubeNumber) => {
        const activeTube = tubeData[tubeNumber];
        if (!activeTube) {
          console.error(`No data found for tube ${tubeNumber}`);
          return null;
        }

        // Get stitches from either positions or stitches array
        let stitches = [];

        // First check if we have positions (preferred format)
        if (activeTube.positions && Object.keys(activeTube.positions).length > 0) {
          console.log(`Converting positions to stitches for tube ${tubeNumber}`);

          // Convert positions to stitches array format
          stitches = Object.entries(activeTube.positions)
            .map(([position, data]: [string, any]) => ({
              id: data.stitchId,
              position: parseInt(position),
              skipNumber: data.skipNumber || 3,
              distractorLevel: data.distractorLevel || 'L1',
              questions: data.questions || [] // Include questions if available
            }))
            .sort((a, b) => a.position - b.position);

          console.log(`Converted ${stitches.length} positions to stitches`);
        }
        // Legacy format support (stitches array)
        else if (activeTube.stitches && activeTube.stitches.length > 0) {
          console.log(`Using legacy stitches array for tube ${tubeNumber}`);
          stitches = [...activeTube.stitches];
        }

        if (stitches.length === 0) {
          console.error(`No stitches found for tube ${tubeNumber}`);
          return null;
        }

        // Create a thread object that matches what the player expects
        return {
          id: `thread-T${tubeNumber}-001`, // Generate a thread ID that matches the expected format
          tubeId: tubeNumber,
          stitches,
          currentStitchId: activeTube.currentStitchId || stitches[0].id
        };
      };

      // Create a thread object for the player
      const thread = createThreadFromTube(tubeData, activeTubeNumber);

      if (!thread) {
        return (
          <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
            <div className="text-white text-xl mb-4">Failed to Create Content</div>
            <div className="text-white text-opacity-70 mb-6">
              Unable to create thread from tube data for tube {activeTubeNumber}.
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors"
            >
              Try Again
            </button>
          </div>
        );
      }

      console.log(`Successfully created thread with ${thread.stitches.length} stitches for player`);

      return (
        <MinimalDistinctionPlayer
          thread={thread}
          onComplete={(results) => {
            console.log('Session complete, recording results', results);
            // Handle session completion
            if (results?.totalPoints) {
              setSessionPoints(prev => prev + results.totalPoints);
            }
            recordAnswer(results);
          }}
          onEndSession={(results) => {
            console.log('Session ended manually', results);
            // Handle manual session ending
            recordAnswer(results);
          }}
          questionsPerSession={10} // Default to 10 questions per session
          sessionTotalPoints={totalPoints || 0} // Use accumulated points
          userId={user?.id}
        />
      );
    } catch (error) {
      // Handle any errors during thread creation or rendering
      console.error('Error creating thread or rendering player:', error);
      return (
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="text-white text-xl mb-4">Error Loading Content</div>
          <div className="text-white text-opacity-70 mb-6">
            An error occurred while preparing the learning content. Please try refreshing the page.
          </div>
          <div className="text-white text-opacity-50 text-xs mt-4 mb-4">
            Error: {error.message || 'Unknown error'}
          </div>
          <button
            onClick={restart}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
  };

  // Admin tools rendering
  const renderAdminTools = () => {
    if (!showAdminControls) return null;
    
    return (
      <div className="fixed bottom-0 left-0 z-50 bg-gray-800 text-white p-4 rounded-tr-lg text-xs w-64 max-h-[300px] overflow-auto">
        <h3 className="font-bold">Admin Debug</h3>
        <div className="mt-2">
          <div>Active Tube: {activeTubeNumber}</div>
          <div>Current Stitch: {tubeInfo.currentStitchId}</div>
          <div>Stitches in Tube: {tubeInfo.totalStitches}</div>
          <div>Session Points: {sessionPoints}</div>
          <div>Total Points: {totalPoints}</div>
          <div>Completed Sessions: {completedSessions}</div>
        </div>
        <div className="mt-2">
          <div className="font-bold">Stitch Info:</div>
          <div className="text-gray-300">{tubeInfo.stitchInfo ? JSON.stringify(tubeInfo.stitchInfo) : 'N/A'}</div>
        </div>
        <div className="mt-2">
          <div className="font-bold">Last Message:</div>
          <div className="text-gray-300">{adminMessage}</div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-600">
          <button 
            onClick={() => switchTube(1)}
            className="px-2 py-1 bg-blue-600 text-white rounded mr-2 text-xs"
          >
            Tube 1
          </button>
          <button 
            onClick={() => switchTube(2)}
            className="px-2 py-1 bg-green-600 text-white rounded mr-2 text-xs"
          >
            Tube 2
          </button>
          <button 
            onClick={() => switchTube(3)}
            className="px-2 py-1 bg-purple-600 text-white rounded text-xs"
          >
            Tube 3
          </button>
        </div>
      </div>
    );
  };
  
  const DeveloperTools = () => {
    if (!showDevTools) return null;

    // Create a simplified player object that the DevTestPane expects
    const player = {
      currentTube: activeTubeNumber,
      currentStitch: tubeData?.[activeTubeNumber]?.currentStitchId ? {
        id: tubeData[activeTubeNumber].currentStitchId,
        threadId: `thread-T${activeTubeNumber}-001` // Use a generic threadId
      } : null,
      handleSessionComplete: recordAnswer,
      handleManualTubeSelect: switchTube,
      cycleTubes: () => {
        // Simplified tube cycling: just go to next tube (1->2->3->1)
        const nextTube = (activeTubeNumber % 3) + 1;
        switchTube(nextTube);
      }
    };

    return (
      <div className="absolute bottom-5 left-5 z-50 m-4">
        <DevTestPane
          player={player}
          show={true}
        />
      </div>
    );
  };
  
  // User welcome/account display - shown in the top-right corner
  const UserDisplay = () => {
    return (
      <div className="absolute top-5 right-5 z-50">
        <div className="flex items-center space-x-4">
          <SubscriptionStatusIndicator />
          <UserWelcomeButton />
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen player-bg">
      <Head>
        <title>Zenjin Maths | {isSubscribed ? 'Premium' : 'Free'} Learning</title>
        <meta name="description" content="Interactive maths learning with Zenjin" />
      </Head>
      
      {/* Celebration overlay */}
      {showCelebration && (
        <StitchCelebration 
          points={celebrationPoints} 
          level={celebrationLevel}
          onClose={() => setShowCelebration(false)}
        />
      )}
      
      {/* Background bubbles animation */}
      <BackgroundBubbles />
      
      {/* Player UI */}
      <main className="min-h-screen flex flex-col relative z-10">
        {/* User display in top right */}
        <UserDisplay />
        
        {/* Main container */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            {renderPlayer()}
          </div>
        </div>
        
        {/* Admin tools */}
        {renderAdminTools()}
        
        {/* Dev tools */}
        <DeveloperTools />
      </main>
    </div>
  );
}