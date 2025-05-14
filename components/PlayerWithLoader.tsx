import React, { useState, useEffect, useCallback } from 'react';
import { useZenjinStore } from '../lib/store';
import LoadingScreen from './LoadingScreen';
import { useAuth } from '../context/AuthContext';

interface PlayerWithLoaderProps {
  children: React.ReactNode;
  tubeId: number;
  stitchId: string;
  minLoadingTime?: number;
  maxAttempts?: number;
  onContentLoaded?: () => void;
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
  onContentLoaded
}) => {
  const [contentLoaded, setContentLoaded] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
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
    
    const initialCheck = async () => {
      const isLoaded = await checkContentLoaded();
      if (!isLoaded) {
        // If not loaded, set up polling
        const interval = setInterval(async () => {
          const success = await checkContentLoaded();
          if (success) {
            clearInterval(interval);
            logWithTime('Content loading polling completed');
          }
        }, 1000); // Check every second
        
        return () => clearInterval(interval);
      } else {
        logWithTime('Content loaded on first check');
      }
    };
    
    initialCheck();
  }, [checkContentLoaded, logWithTime]);

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

  // Function to wait for content loading to complete
  const waitForContent = useCallback(() => {
    logWithTime('Setting up content loading check interval');
    
    const checkInterval = setInterval(() => {
      if (contentLoaded) {
        logWithTime('Content is now loaded, hiding loading screen');
        setShowLoadingScreen(false);
        clearInterval(checkInterval);
      } else {
        logWithTime('Content still not loaded, continuing to wait');
      }
    }, 500); // Check every half second
    
    return () => clearInterval(checkInterval);
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
  
  // Show warning if content loaded but no questions available
  if (!questionsAvailable) {
    logWithTime('⚠️ Showing player with no questions available warning');
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-red-700 text-white p-6 rounded-xl">
        <h2 className="text-2xl font-bold mb-4">Content Loading Issue</h2>
        <p className="text-lg mb-4">
          We were unable to load the questions for this session after multiple attempts.
        </p>
        <p className="mb-6">
          You may want to refresh the page or check your network connection.
        </p>
        <button 
          className="bg-white text-red-700 px-4 py-2 rounded font-bold hover:bg-gray-100"
          onClick={() => window.location.reload()}
        >
          Reload Page
        </button>
      </div>
    );
  }
  
  // Otherwise render the player
  logWithTime('✅ Rendering player with loaded content');
  return (
    <div className="player-content" style={{ position: 'relative', zIndex: 'var(--z-content)' }}>
      {children}
    </div>
  );
};

export default PlayerWithLoader;