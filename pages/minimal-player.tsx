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
import { useTripleHelixPlayer } from '../lib/playerUtils';
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

  // Connect to Zustand store for content buffer
  const fillInitialContentBuffer = useZenjinStore(state => state.fillInitialContentBuffer);

  // Add state for admin tube debugging
  const [tubeInfo, setTubeInfo] = useState<any>({});
  const [showAdminControls] = useState(admin === 'true');
  const [adminMessage, setAdminMessage] = useState('');

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

  // Function to manually switch tubes (for debugging)
  const switchTube = (tubeNumber: number) => {
    // Get the user ID
    const uid = localStorage.getItem('zenjin_user_id') ||
                localStorage.getItem('zenjin_anonymous_id') ||
                user?.id || 'anonymous';

    try {
      // Update main state
      const stateKey = `zenjin_state_${uid}`;
      const stateJson = localStorage.getItem(stateKey);

      if (stateJson) {
        const state = JSON.parse(stateJson);
        state.activeTube = tubeNumber;
        state.activeTubeNumber = tubeNumber;
        state.lastUpdated = new Date().toISOString();
        localStorage.setItem(stateKey, JSON.stringify(state));

        // Also update anonymous state if it exists
        const anonStateJson = localStorage.getItem('zenjin_anonymous_state');
        if (anonStateJson) {
          try {
            const anonState = JSON.parse(anonStateJson);
            if (anonState.state) {
              anonState.state.activeTube = tubeNumber;
              anonState.state.activeTubeNumber = tubeNumber;
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
            localStorage.setItem(`triple_helix_state_${uid}`, JSON.stringify(tripleHelix));
          } catch (e) {
            console.error('Error updating triple helix state:', e);
          }
        }

        // Reload to see changes
        window.location.reload();
      } else {
        alert('No state found to update');
      }
    } catch (e) {
      console.error('Error switching tube:', e);
      alert(`Error: ${e.message}`);
    }
  };
  
  // If the user is anonymous and we have the create flag, ensure we create a proper account
  if (typeof window !== 'undefined' && !isAuthenticated) {
    const createAnonymousState = localStorage.getItem('zenjin_create_anonymous_state') === 'true';
    if (createAnonymousState) {
      console.log('DEBUGGING: Anonymous account creation flag detected in minimal-player');
      // Clear the flag after detecting it to prevent repeated creation
      localStorage.removeItem('zenjin_create_anonymous_state');
      console.log('DEBUGGING: Cleared anonymous creation flag after handling');
      // Flag will be handled by _app.tsx and createAnonymousUser in anonymousData.ts
    } else {
      console.log('DEBUGGING: No anonymous creation flag found in minimal-player');
    }
  }
  
  // Initialize the triple-helix player - this is now cleaner and decoupled from the UI
  const { 
    tubeData, 
    mode: playerStatus, 
    isActive, 
    activeTubeNumber, 
    recordAnswer, 
    nextQuestion,
    celebrateCurrentStitch,
    switchToNextStitch,
    isLoading,
    getStitchInfo,
    error,
    completedSessions,
    totalPoints,
    sessionPoints,
    restart, 
  } = useTripleHelixPlayer({ 
    mode: playerMode,
    resetPoints: shouldResetPoints,
    continuePreviousState,
    debug: (message) => {
      console.log(message); 
      setAdminMessage(message);
    }
  });
  
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
  
  // Conditionally render different player components based on upgrade flag and player mode
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

    // Create tube-stitch structure with validation
    try {
      // Note: MinimalDistinctionPlayer still expects a "thread" property for backwards compatibility
      // But we're focusing on the tube-stitch relationship in our model
      const tube = {
        // Use a simple tube identifier - thread is just an implementation detail
        id: `tube-${activeTubeNumber}`,
        name: `Tube ${activeTubeNumber}`,
        description: `Learning content for Tube ${activeTubeNumber}`,
        // The actual meaningful data - the stitches array
        stitches: stitches.map(stitch => {
          // Validate stitch has an id
          if (!stitch.id) {
            console.error('Found stitch without id:', stitch);
            return {
              id: `generated-stitch-${Math.random().toString(36).substring(2, 9)}`,
              name: 'Unknown Stitch',
              description: 'Generated placeholder for invalid stitch',
              questions: [] // Questions will be loaded from Zustand store via getStitch
            };
          }

          return {
            id: stitch.id,
            name: stitch.id.split('-').pop() || 'Stitch',
            description: `Stitch ${stitch.id}`,
            questions: [] // Questions will be loaded from Zustand store via getStitch
          };
        })
      };

      console.log(`Rendering player with tube ${activeTubeNumber}, containing ${tube.stitches.length} stitches`);

      // Additional debug information for successful loading
      if (typeof window !== 'undefined' && (window as any).gtag) {
        try {
          (window as any).gtag('event', 'content_loaded', {
            'tube_number': activeTubeNumber,
            'stitch_count': tube.stitches.length,
            'format': activeTube.positions ? 'position-based' : 'legacy'
          });
        } catch (error) {
          console.error('Error sending analytics event:', error);
        }
      }

      // Regular player render - note that we pass the tube object via the thread prop
      // for backwards compatibility with the MinimalDistinctionPlayer component
      return (
        <MinimalDistinctionPlayer
          thread={tube} // For backwards compatibility
          onComplete={(results) => {
            console.log('Session complete, recording results', results);
            // Handle any tube-specific logic here before passing to general handler
            if (results && results.goDashboard) {
              // Navigate or handle completion
            }
            // Pass to original handlers
            recordAnswer && recordAnswer(results);
            nextQuestion && nextQuestion();
          }}
          onEndSession={(results) => {
            console.log('Session ended manually', results);
            // Could add additional tube-specific logic here
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
    
    return (
      <div className="absolute bottom-5 left-5 z-50 m-4">
        <DevTestPane
          tubeData={tubeData}
          activeTubeNumber={activeTubeNumber}
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