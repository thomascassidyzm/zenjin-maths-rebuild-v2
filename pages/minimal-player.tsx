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

      // DEBUGGING: Add toast notification to confirm we've loaded from Continue Learning
      try {
        // Try to get the active tube number from localStorage for more detailed debugging
        let activeTube = "?";
        const userId = localStorage.getItem('zenjin_user_id') ||
                       localStorage.getItem('zenjin_anonymous_id') || 
                       'anonymous';
        
        // Check the stored state for active tube info
        try {
          const tripleHelixState = localStorage.getItem(`triple_helix_state_${userId}`);
          if (tripleHelixState) {
            const parsedState = JSON.parse(tripleHelixState);
            if (parsedState && (parsedState.activeTube || parsedState.activeTubeNumber)) {
              activeTube = parsedState.activeTube || parsedState.activeTubeNumber;
            }
          }
        } catch {}
        
        const toastDiv = document.createElement('div');
        toastDiv.innerText = `✓ Continuing from previous state (Tube ${activeTube})`;
        toastDiv.style.position = 'fixed';
        toastDiv.style.bottom = '20px';
        toastDiv.style.right = '20px';
        toastDiv.style.backgroundColor = 'rgba(0, 100, 50, 0.8)';
        toastDiv.style.color = 'white';
        toastDiv.style.padding = '8px 16px';
        toastDiv.style.borderRadius = '4px';
        toastDiv.style.zIndex = '9999';
        toastDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        toastDiv.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        
        document.body.appendChild(toastDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
          toastDiv.style.opacity = '0';
          toastDiv.style.transition = 'opacity 0.5s ease';
          
          setTimeout(() => {
            if (document.body.contains(toastDiv)) {
              document.body.removeChild(toastDiv);
            }
          }, 500);
        }, 5000);
      } catch (e) {
        console.error('Error showing debug toast:', e);
      }
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
        setTubeInfo({
          activeTubeNumber,
          currentStitchId,
          totalStitches: activeTube.stitches?.length || 0,
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
    // Regular player render
    return (
      <MinimalDistinctionPlayer
        tubeNumber={activeTubeNumber}
        tubeData={tubeData}
        onRecordAnswer={recordAnswer}
        onNextQuestion={nextQuestion}
        onCelebrateStitch={(points) => {
          celebrateCurrentStitch();
          onCelebrateStitch(points);
        }}
        onSwitchStitch={switchToNextStitch}
        isSubscribed={isSubscribed}
        userId={user?.id}
        tier={tier}
      />
    );
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