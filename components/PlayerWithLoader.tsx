import React, { useState, useEffect, useCallback } from 'react';
import { useZenjinStore } from '../lib/store';
import LoadingScreen from './LoadingScreen';
import { useAuth } from '../context/AuthContext';
import WarmUpMode from './WarmUpMode';
import WarmUpTransition from './WarmUpTransition';

interface PlayerWithLoaderProps {
  children: React.ReactNode;
  tubeId: number;
  stitchId: string;
  minLoadingTime?: number;
  maxAttempts?: number;
  onContentLoaded?: () => void;
  useWarmUp?: boolean;
  warmUpQuestionsCount?: number;
}

/**
 * A wrapper component that ensures content is loaded before rendering the player
 * Shows a loading screen with welcome message and instructions while loading
 */
const PlayerWithLoader: React.FC<PlayerWithLoaderProps> = ({
  children,
  tubeId,
  stitchId,
  minLoadingTime = 3000, // Minimum time to show loading screen (ms)
  maxAttempts = 10,     // Maximum attempts to load content
  onContentLoaded,
  useWarmUp = true,     // Use warm-up mode by default
  warmUpQuestionsCount = 10 // Number of warm-up questions to show
}) => {
  const [contentLoaded, setContentLoaded] = useState(false);
  // Start with loading screen hidden if warm-up mode is enabled
  const [showLoadingScreen, setShowLoadingScreen] = useState(!useWarmUp);
  const [showWarmUp, setShowWarmUp] = useState(useWarmUp);
  const [showTransition, setShowTransition] = useState(false);
  const [contentCheckAttempts, setContentCheckAttempts] = useState(0);
  const [questionsAvailable, setQuestionsAvailable] = useState(false);
  const [loadingStartTime] = useState(Date.now());
  const { user, isAuthenticated } = useAuth();
  
  // Get necessary functions from Zustand store
  const { 
    fetchStitch, 
    contentCollection,
    fillInitialContentBuffer,
    getActiveStitch,
    resetStore,
    initializeState
  } = useZenjinStore();

  // Function to log with timestamp
  const logWithTime = useCallback((message: string) => {
    const timeElapsed = Math.round((Date.now() - loadingStartTime) / 100) / 10;
    console.log(`[${timeElapsed}s] ${message}`);
  }, [loadingStartTime]);

  // Function to check if content is loaded with questions
  const checkContentLoaded = useCallback(async () => {
    try {
      // Log current attempt
      logWithTime(`Checking content for stitch ${stitchId} (attempt ${contentCheckAttempts + 1}/${maxAttempts})`);
      
      // Try multiple content loading strategies
      
      // First check if content is already in store with questions
      if (contentCollection?.stitches?.[stitchId]?.questions?.length > 0) {
        logWithTime('✅ Content found in store');
        setContentLoaded(true);
        setQuestionsAvailable(true);
        if (onContentLoaded) onContentLoaded();
        return true;
      }
      
      // 1. Try getActiveStitch first - this should have the most up-to-date content
      logWithTime('Trying getActiveStitch...');
      const activeStitch = await getActiveStitch();
      if (activeStitch?.questions?.length > 0) {
        logWithTime('✅ Content loaded via getActiveStitch');
        setContentLoaded(true);
        setQuestionsAvailable(true);
        if (onContentLoaded) onContentLoaded();
        return true;
      }
      
      // 2. Try direct fetch with the specific stitch ID
      logWithTime(`Trying direct fetch for ${stitchId}...`);
      const stitch = await fetchStitch(stitchId);
      if (stitch?.questions?.length > 0) {
        logWithTime('✅ Content loaded via fetchStitch');
        setContentLoaded(true);
        setQuestionsAvailable(true);
        if (onContentLoaded) onContentLoaded();
        return true;
      }
      
      // 3. Try to fill initial buffer as a more comprehensive approach
      logWithTime('Trying fillInitialContentBuffer...');
      await fillInitialContentBuffer();
      
      // Check if content is now available after buffer fill
      if (contentCollection?.stitches?.[stitchId]?.questions?.length > 0) {
        logWithTime('✅ Content loaded after buffer fill');
        setContentLoaded(true);
        setQuestionsAvailable(true);
        if (onContentLoaded) onContentLoaded();
        return true;
      }
      
      // Increase attempt counter
      setContentCheckAttempts(prev => prev + 1);
      
      // If we've made too many attempts, notify but don't proceed yet
      if (contentCheckAttempts >= maxAttempts - 1) {
        logWithTime('⚠️ Maximum content check attempts reached');
        
        // Set content loaded but indicate questions aren't available
        // This will still show the loading screen until minLoadingTime passes
        setContentLoaded(true);
        setQuestionsAvailable(false);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking content:', error);
      
      // On error, increment attempts
      setContentCheckAttempts(prev => prev + 1);
      
      // After maximum attempts, proceed anyway
      if (contentCheckAttempts >= maxAttempts - 1) {
        logWithTime('⚠️ Maximum attempts reached with errors');
        setContentLoaded(true);
        setQuestionsAvailable(false);
        return true;
      }
      
      return false;
    }
  }, [
    stitchId, 
    contentCollection, 
    fetchStitch, 
    getActiveStitch, 
    fillInitialContentBuffer, 
    contentCheckAttempts, 
    maxAttempts, 
    logWithTime,
    onContentLoaded
  ]);

  // Initial content check
  useEffect(() => {
    logWithTime('Starting content loading process');
    let intervalId: NodeJS.Timeout | null = null;
    let totalRuntime = 0;
    const maxRuntime = 10000; // Maximum 10 seconds before giving up
    const pollingInterval = 1000; // 1 second between checks
    const maxLoopCount = 3; // Maximum 3 polling attempts to minimize server hits
    let loopCount = 0;
    
    // Debug the content collection to see what's available
    try {
      const storeState = contentCollection;
      logWithTime(`DEBUG: Current content collection state:`);
      logWithTime(`- Has collection: ${!!storeState}`);
      if (storeState) {
        logWithTime(`- Has stitches: ${!!storeState.stitches}`);
        logWithTime(`- Stitch count: ${storeState.stitches ? Object.keys(storeState.stitches).length : 0}`);
        logWithTime(`- Looking for stitch: ${stitchId}`);
        logWithTime(`- Stitch exists in collection: ${!!(storeState.stitches && storeState.stitches[stitchId])}`);
        
        // Check if we have a single stitch match
        if (storeState.stitches && storeState.stitches[stitchId]) {
          const stitch = storeState.stitches[stitchId];
          logWithTime(`- Found stitch in collection with ${stitch.questions?.length || 0} questions`);
        }
      }
    } catch (e) {
      logWithTime(`Error debugging content collection: ${e}`);
    }
    
    const initialCheck = async () => {
      const isLoaded = await checkContentLoaded();
      if (!isLoaded) {
        logWithTime(`Initial content check failed. Will try ${maxLoopCount} more attempts to minimize server load.`);
        
        // If not loaded, set up polling with strict limits (reduced to minimize server hits)
        intervalId = setInterval(async () => {
          // Check if we've exceeded maximum polling attempts
          if (loopCount >= maxLoopCount) {
            logWithTime(`⚠️ Maximum polling attempts (${maxLoopCount}) reached, stopping checks`);
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            
            // Force content loaded state to proceed with error UI
            setContentLoaded(true);
            setQuestionsAvailable(false);
            return;
          }
          
          // Check if we've exceeded maximum runtime
          totalRuntime += pollingInterval;
          if (totalRuntime >= maxRuntime) {
            logWithTime(`⚠️ Maximum polling runtime (${maxRuntime/1000}s) reached, stopping checks`);
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            
            // Force content loaded state to proceed with error UI
            setContentLoaded(true);
            setQuestionsAvailable(false);
            return;
          }
          
          // Increment loop counter
          loopCount++;
          logWithTime(`Polling attempt ${loopCount}/${maxLoopCount} (runtime: ${totalRuntime/1000}s)`);
          
          // Try to load content
          try {
            const success = await checkContentLoaded();
            if (success) {
              logWithTime('✅ Content loaded during polling, clearing interval');
              if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
              }
            }
          } catch (error) {
            logWithTime(`⚠️ Error during polling: ${error}`);
            // On error, increment attempt counter but don't stop - the maxLoopCount will handle this
          }
        }, pollingInterval);
      } else {
        logWithTime('✅ Content loaded on first check');
      }
    };
    
    initialCheck();
    
    // Cleanup function - critical to prevent memory leaks and infinite loops
    return () => {
      if (intervalId) {
        logWithTime('Cleaning up content polling interval');
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [checkContentLoaded, logWithTime, contentCollection, stitchId]);

  // Handle when loading screen animation is complete and minLoadingTime passed
  const handleAnimationComplete = useCallback(() => {
    const timeElapsed = Date.now() - loadingStartTime;
    const remainingTime = Math.max(0, minLoadingTime - timeElapsed);
    
    logWithTime(`Animation complete. Minimum time: ${minLoadingTime}ms, Elapsed: ${timeElapsed}ms, Remaining: ${remainingTime}ms`);
    
    if (remainingTime > 0) {
      logWithTime(`Waiting ${remainingTime}ms to meet minimum loading time`);
      setTimeout(() => {
        if (contentLoaded) {
          logWithTime('Minimum loading time reached, hiding loading screen');
          setShowLoadingScreen(false);
        } else {
          logWithTime('Minimum time reached but content not loaded, continuing to wait');
          waitForContent();
        }
      }, remainingTime);
    } else if (contentLoaded) {
      logWithTime('Minimum loading time already elapsed and content loaded, hiding loading screen');
      setShowLoadingScreen(false);
    } else {
      logWithTime('Minimum loading time already elapsed but content not loaded, waiting for content');
      waitForContent();
    }
  }, [contentLoaded, loadingStartTime, minLoadingTime, logWithTime]);
  
  // Handle when warm-up is complete
  const handleWarmUpComplete = useCallback(() => {
    logWithTime('Warm-up session completed, showing transition animation');
    setShowTransition(true);
  }, [logWithTime]);
  
  // Handle when transition animation is complete
  const handleTransitionComplete = useCallback(() => {
    logWithTime('Transition animation completed, switching to main content');
    setShowTransition(false);
    setShowWarmUp(false);
  }, [logWithTime]);

  // Function to wait for content loading to complete
  const waitForContent = useCallback(() => {
    logWithTime('Setting up content loading check interval');
    
    let waitInterval: NodeJS.Timeout | null = null;
    let waitAttempts = 0;
    const maxWaitAttempts = 6; // Max 3 seconds (6 * 500ms) - reduced to minimize polling
    
    waitInterval = setInterval(() => {
      // Increment attempts
      waitAttempts++;
      
      if (contentLoaded) {
        logWithTime('Content is now loaded, hiding loading screen');
        setShowLoadingScreen(false);
        if (waitInterval) {
          clearInterval(waitInterval);
          waitInterval = null;
        }
      } else if (waitAttempts >= maxWaitAttempts) {
        // If we've waited too long, proceed anyway with error state
        logWithTime(`⚠️ Maximum wait attempts (${maxWaitAttempts}) reached, proceeding with error state`);
        setContentLoaded(true);
        setQuestionsAvailable(false);
        setShowLoadingScreen(false);
        if (waitInterval) {
          clearInterval(waitInterval);
          waitInterval = null;
        }
      } else {
        logWithTime(`Content still not loaded, continuing to wait (attempt ${waitAttempts}/${maxWaitAttempts})`);
      }
    }, 500); // Check every half second
    
    // Cleanup function
    return () => {
      if (waitInterval) {
        logWithTime('Cleaning up wait for content interval');
        clearInterval(waitInterval);
        waitInterval = null;
      }
    };
  }, [contentLoaded, logWithTime]);

  // If showing loading screen, render that
  if (showLoadingScreen) {
    return (
      <div className="loading-screen-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
        <LoadingScreen 
          isAnonymous={!isAuthenticated}
          userName={user?.name}
          onAnimationComplete={handleAnimationComplete}
          minDisplayTime={minLoadingTime}
        />
      </div>
    );
  }
  
  // Show warning if content loaded but no questions available (and not using warm-up)
  if (!questionsAvailable && !showWarmUp) {
    logWithTime('⚠️ Showing player with no questions available warning');
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-slate-800 p-6">
        <div className="bg-gradient-to-b from-red-600 to-red-800 rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden">
          {/* Top decoration bar */}
          <div className="h-2 bg-gradient-to-r from-orange-400 via-red-500 to-pink-500"></div>
          
          <div className="p-8 text-white">
            <div className="flex flex-col items-center">
              {/* Error icon */}
              <div className="w-16 h-16 rounded-full bg-red-100 text-red-700 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <h2 className="text-2xl font-bold mb-4">Content Loading Issue</h2>
              
              <p className="text-lg mb-4 text-center">
                We were unable to load the questions for this session after multiple attempts.
              </p>
              
              <p className="mb-6 text-center text-red-200">
                You may want to refresh the page or check your network connection.
              </p>
              
              <button 
                className="bg-white text-red-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 shadow-lg transition-all"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </button>
            </div>
          </div>
          
          {/* Bottom decoration bar */}
          <div className="h-2 bg-gradient-to-r from-pink-500 via-red-500 to-orange-400"></div>
        </div>
      </div>
    );
  }
  
  // If transition is showing, render the transition component with the actual player as children
  if (showTransition) {
    logWithTime('🚀 Showing transition animation from warm-up to main content');
    return (
      <WarmUpTransition onTransitionComplete={handleTransitionComplete} duration={3000}>
        {/* Pass the actual player component as children to show on the back of the card */}
        <div className="player-content" style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </WarmUpTransition>
    );
  }
  
  // If warm-up mode is enabled and content is loaded (or loading), show warm-up
  if (showWarmUp) {
    logWithTime('🔥 Showing warm-up session while main content loads');
    return (
      <div className="warm-up-wrapper" style={{ position: 'relative', width: '100%', height: '100%', background: 'transparent' }}>
        <WarmUpMode
          questionsCount={warmUpQuestionsCount}
          onWarmUpComplete={handleWarmUpComplete}
          userId={user?.id}
          contentIsReady={contentLoaded && questionsAvailable}
          startingTube={1}
        />
      </div>
    );
  }
  
  // Otherwise render the player with main content
  logWithTime('✅ Rendering player with loaded content');
  return (
    <div className="player-content" style={{ position: 'relative', zIndex: 'var(--z-content)', background: 'transparent' }}>
      {children}
    </div>
  );
};

export default PlayerWithLoader;