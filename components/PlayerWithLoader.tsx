import React, { useState, useEffect, useCallback } from 'react';
import { useZenjinStore } from '../lib/store';
import LoadingScreen from './LoadingScreen';
import { useAuth } from '../context/AuthContext';

interface PlayerWithLoaderProps {
  children: React.ReactNode;
  tubeId: number;
  stitchId: string;
}

/**
 * A wrapper component that ensures content is loaded before rendering the player
 * Shows a loading screen with welcome message and instructions while loading
 */
const PlayerWithLoader: React.FC<PlayerWithLoaderProps> = ({
  children,
  tubeId,
  stitchId
}) => {
  const [contentLoaded, setContentLoaded] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [contentCheckAttempts, setContentCheckAttempts] = useState(0);
  const { user, isAuthenticated } = useAuth();
  
  // Get necessary functions from Zustand store
  const { 
    fetchStitch, 
    contentCollection,
    fillInitialContentBuffer,
    getActiveStitch 
  } = useZenjinStore();

  // Function to check if content is loaded
  const checkContentLoaded = useCallback(async () => {
    // First check if content is already in store
    if (contentCollection?.stitches?.[stitchId]?.questions?.length > 0) {
      console.log('Content already loaded in store');
      setContentLoaded(true);
      return true;
    }
    
    try {
      console.log(`Checking content for stitch ${stitchId} (attempt ${contentCheckAttempts + 1})`);
      
      // Try to get content in 3 ways:
      
      // 1. Try getActiveStitch first (might be most reliable)
      const activeStitch = await getActiveStitch();
      if (activeStitch?.questions?.length > 0) {
        console.log('Content loaded via getActiveStitch');
        setContentLoaded(true);
        return true;
      }
      
      // 2. Try direct fetch
      const stitch = await fetchStitch(stitchId);
      if (stitch?.questions?.length > 0) {
        console.log('Content loaded via fetchStitch');
        setContentLoaded(true);
        return true;
      }
      
      // 3. Try to fill initial buffer as last resort
      await fillInitialContentBuffer();
      
      // Check if content is now available after buffer fill
      if (contentCollection?.stitches?.[stitchId]?.questions?.length > 0) {
        console.log('Content loaded after buffer fill');
        setContentLoaded(true);
        return true;
      }
      
      // Increase attempt counter
      setContentCheckAttempts(prev => prev + 1);
      
      // If we've made too many attempts, just give up and show the player anyway
      if (contentCheckAttempts >= 5) {
        console.warn('Maximum content check attempts reached, proceeding anyway');
        setContentLoaded(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking content:', error);
      return false;
    }
  }, [stitchId, contentCollection, fetchStitch, getActiveStitch, fillInitialContentBuffer, contentCheckAttempts]);

  // Initial content check
  useEffect(() => {
    const initialCheck = async () => {
      const isLoaded = await checkContentLoaded();
      if (!isLoaded) {
        // If not loaded, set up polling
        const interval = setInterval(async () => {
          const success = await checkContentLoaded();
          if (success) {
            clearInterval(interval);
          }
        }, 1000); // Check every second
        
        return () => clearInterval(interval);
      }
    };
    
    initialCheck();
  }, [checkContentLoaded]);

  // Handle when loading screen animation is complete
  const handleAnimationComplete = () => {
    // Only hide the loading screen if content is loaded
    if (contentLoaded) {
      setShowLoadingScreen(false);
    } else {
      // If content isn't loaded yet, wait for it
      const checkInterval = setInterval(() => {
        if (contentLoaded) {
          setShowLoadingScreen(false);
          clearInterval(checkInterval);
        }
      }, 500); // Check every half second
      
      // Cleanup
      return () => clearInterval(checkInterval);
    }
  };

  // If showing loading screen, render that
  if (showLoadingScreen) {
    return (
      <div className="loading-screen-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
        <LoadingScreen 
          isAnonymous={!isAuthenticated}
          userName={user?.name}
          onAnimationComplete={handleAnimationComplete}
        />
      </div>
    );
  }
  
  // Otherwise render the player
  return (
    <div className="player-content" style={{ position: 'relative', zIndex: 'var(--z-content)' }}>
      {children}
    </div>
  );
};

export default PlayerWithLoader;