/**
 * Two-Phase Content Loading Hook
 * 
 * A custom hook that manages loading content in two phases:
 * 1. Immediate loading of the active stitch
 * 2. Phase 1: Load 10 stitches per tube for basic interaction
 * 3. Phase 2: Load up to 50 stitches per tube for comprehensive buffering
 */

import { useState, useEffect, useCallback } from 'react';
import { useZenjinStore, useContentBufferStatus } from '../store/zenjinStore';

interface UseTwoPhaseContentLoadingResult {
  activeStitchLoaded: boolean;
  phase1Loaded: boolean;
  phase2Loaded: boolean;
  phase1Loading: boolean;
  phase2Loading: boolean;
  totalStitchesLoaded: number;
  startLoading: () => void;
  loadAdditionalContent: () => void;
}

/**
 * Hook to manage two-phase content loading
 * @returns Object containing loading status and control functions
 */
export function useTwoPhaseContentLoading(): UseTwoPhaseContentLoadingResult {
  const [manualStart, setManualStart] = useState(false);
  
  // Get state and actions from the Zustand store
  const tubeState = useZenjinStore(state => state.tubeState);
  const getActiveStitch = useZenjinStore(state => state.getActiveStitch);
  const fillInitialContentBuffer = useZenjinStore(state => state.fillInitialContentBuffer);
  const fillCompleteContentBuffer = useZenjinStore(state => state.fillCompleteContentBuffer);
  
  // Get buffer status from store
  const bufferStatus = useContentBufferStatus();
  
  /**
   * Start the loading process manually
   * Triggers loading of active stitch and initial buffer (Phase 1)
   */
  const startLoading = useCallback(() => {
    setManualStart(true);
  }, []);
  
  /**
   * Load additional content (Phase 2)
   * Loads up to 50 stitches per tube
   */
  const loadAdditionalContent = useCallback(() => {
    if (!bufferStatus.phase1Loaded) {
      console.warn('Cannot load Phase 2 before Phase 1 is complete');
      return;
    }
    
    if (bufferStatus.phase2Loading || bufferStatus.phase2Loaded) {
      return;
    }
    
    fillCompleteContentBuffer();
  }, [bufferStatus.phase1Loaded, bufferStatus.phase2Loading, bufferStatus.phase2Loaded, fillCompleteContentBuffer]);
  
  // Load the active stitch immediately when component mounts or tube state changes
  useEffect(() => {
    if (tubeState && !bufferStatus.activeStitchLoaded) {
      getActiveStitch().then(() => {
        console.log('Active stitch loaded successfully');
      });
    }
  }, [tubeState, bufferStatus.activeStitchLoaded, getActiveStitch]);
  
  // Load Phase 1 content when component mounts or when manually triggered
  useEffect(() => {
    if (tubeState && bufferStatus.activeStitchLoaded && (manualStart || true) && 
        !bufferStatus.phase1Loading && !bufferStatus.phase1Loaded) {
      // Start loading Phase 1 content (10 stitches per tube)
      fillInitialContentBuffer();
    }
  }, [
    tubeState,
    bufferStatus.activeStitchLoaded,
    bufferStatus.phase1Loading,
    bufferStatus.phase1Loaded,
    manualStart,
    fillInitialContentBuffer
  ]);
  
  // Return the loading status and control functions
  return {
    activeStitchLoaded: bufferStatus.activeStitchLoaded,
    phase1Loaded: bufferStatus.phase1Loaded,
    phase2Loaded: bufferStatus.phase2Loaded,
    phase1Loading: bufferStatus.phase1Loading,
    phase2Loading: bufferStatus.phase2Loading,
    totalStitchesLoaded: bufferStatus.stats.totalStitchesLoaded,
    startLoading,
    loadAdditionalContent
  };
}

/**
 * Hook to load content when user is idle for a specific duration
 * Automatically triggers Phase 2 loading when user is inactive
 * 
 * @param idleTimeMs Time in milliseconds to wait before loading Phase 2 content
 * @returns Same result as useTwoPhaseContentLoading plus idle status
 */
export function useIdleTimeContentLoading(idleTimeMs = 5000): UseTwoPhaseContentLoadingResult & { isIdle: boolean } {
  const [isIdle, setIsIdle] = useState(false);
  const { 
    phase1Loaded, 
    phase2Loaded, 
    phase2Loading, 
    loadAdditionalContent,
    ...rest 
  } = useTwoPhaseContentLoading();
  
  // Set up idle detection 
  useEffect(() => {
    let idleTimer: NodeJS.Timeout;
    
    // Start Phase 2 loading when user is idle and Phase 1 is complete
    const startIdleLoading = () => {
      if (phase1Loaded && !phase2Loaded && !phase2Loading) {
        setIsIdle(true);
        loadAdditionalContent();
      }
    };
    
    // Reset idle timer on user interaction
    const resetIdleTimer = () => {
      setIsIdle(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(startIdleLoading, idleTimeMs);
    };
    
    // Set up event listeners for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    // Initialize the idle timer
    resetIdleTimer();
    
    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, resetIdleTimer);
    });
    
    // Clean up
    return () => {
      clearTimeout(idleTimer);
      events.forEach(event => {
        document.removeEventListener(event, resetIdleTimer);
      });
    };
  }, [idleTimeMs, phase1Loaded, phase2Loaded, phase2Loading, loadAdditionalContent]);
  
  return {
    ...rest,
    phase1Loaded,
    phase2Loaded,
    phase2Loading,
    isIdle,
    loadAdditionalContent
  };
}

export default useTwoPhaseContentLoading;