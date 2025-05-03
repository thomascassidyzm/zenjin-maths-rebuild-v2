import { useState, useEffect } from 'react';
import { contentBuffer, StitchContent } from './content-buffer';
import { useUserState } from '../state/useUserState';

/**
 * Hook for using the content buffer in components
 * 
 * Provides access to the in-play stitch and manages buffering of upcoming content
 */
export function useContentBuffer() {
  const { userState, updateUserState } = useUserState();
  const [inPlayStitch, setInPlayStitch] = useState<StitchContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize the content buffer
  useEffect(() => {
    const initializeBuffer = async () => {
      try {
        // Determine if this is a new or anonymous user by checking
        // if the userState has default values or is missing
        const isNewUser = !userState || 
                          (userState.userId && userState.userId.startsWith('anonymous-')) ||
                          (userState.tubes && 
                           Object.values(userState.tubes).every(tube => 
                             tube.stitches?.length <= 5 || !tube.position || tube.position <= 1));
                          
        console.log(`Initializing content buffer as ${isNewUser ? 'new' : 'returning'} user`);
        await contentBuffer.initialize(isNewUser);
      } catch (e) {
        setError('Failed to initialize content buffer');
        console.error('Error initializing content buffer:', e);
      }
    };

    initializeBuffer();
  }, [userState]);

  // Load the in-play stitch whenever user state changes
  useEffect(() => {
    if (!userState) return;

    const loadInPlayStitch = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get the in-play stitch (active stitch in the active tube)
        const stitch = await contentBuffer.getInPlayStitch(userState);

        if (!stitch) {
          setError('Could not load the current stitch');
        } else {
          setInPlayStitch(stitch);
        }
      } catch (e) {
        setError('Error loading current stitch');
        console.error('Error loading in-play stitch:', e);
      } finally {
        setIsLoading(false);
      }

      // Update the buffer in the background
      try {
        await contentBuffer.updateBuffer(userState);
      } catch (e) {
        console.error('Error updating buffer:', e);
        // Non-critical error, don't set error state
      }
    };

    loadInPlayStitch();
  }, [userState]);

  /**
   * Complete the current stitch and advance to the next one
   * Important: This only updates local state, not the database
   * @param success Whether the stitch was completed successfully (20/20)
   * @param score Optional score (out of totalQuestions)
   * @param totalQuestions Optional total questions
   */
  const completeStitch = async (success: boolean, score?: number, totalQuestions?: number) => {
    if (!userState || !inPlayStitch) return;

    // Clone the user state to avoid direct mutation
    const newState = { ...userState };
    
    // Get the active tube number (support both state formats)
    const activeTubeNumber = newState.activeTube || newState.activeTubeNumber;
    const activeTube = newState.tubes[activeTubeNumber];

    if (!activeTube) return;

    // If the state has position-based format, apply that logic
    if (activeTube.stitches && Array.isArray(activeTube.stitches)) {
      if (success) {
        // 20/20 score - apply the re-ordering logic
        const activeStitch = activeTube.stitches.find(s => s.id === activeTube.currentStitchId);
        
        if (activeStitch) {
          // Move the active stitch back by its skip number
          activeStitch.position = activeStitch.skipNumber;
          
          // Find the next stitch (position 1)
          const nextStitch = activeTube.stitches
            .filter(s => s.position > 0)
            .sort((a, b) => a.position - b.position)[0];
            
          if (nextStitch) {
            // Make it the new active stitch
            nextStitch.position = 0;
            activeTube.currentStitchId = nextStitch.id;
          }
        }
      }
    } else {
      // For simpler formats, we'll use a state action to update position
      // This will need to be handled by the stateManager to determine the next stitch
      if (score !== undefined && totalQuestions !== undefined) {
        // If we have score info, use it
        const isPerfectScore = score === totalQuestions;
        
        // Find the next stitch ID from the manifest
        if (isPerfectScore) {
          // This would need to get the next stitch from the manifest sequence
          // For now, just mark that we completed this stitch
          console.log(`Stitch ${activeTube.currentStitchId} completed with perfect score`);
        }
      } else if (success) {
        // Just use success flag if no detailed scores
        console.log(`Stitch ${activeTube.currentStitchId} completed successfully`);
      }
    }

    // Always advance to the next tube
    if (newState.activeTube !== undefined) {
      newState.activeTube = activeTubeNumber === 3 ? 1 : (activeTubeNumber as number) + 1;
    } else if (newState.activeTubeNumber !== undefined) {
      newState.activeTubeNumber = activeTubeNumber === 3 ? 1 : (activeTubeNumber as number) + 1;
    }
    
    newState.lastUpdated = new Date().toISOString();

    // CHANGE: Only update the state locally, without syncing to the server
    // This allows offline use and only syncs when the session is finished
    stateManager.dispatch({ type: 'INITIALIZE_STATE', payload: newState });

    // Pre-load the next stitch
    try {
      const nextStitch = await contentBuffer.getInPlayStitch(newState);
      if (nextStitch) {
        // Pre-load successful, you could set it immediately if needed
      }
    } catch (e) {
      console.error('Error pre-loading next stitch:', e);
    }
  };
  
  /**
   * Finish the current session, saving all accumulated state changes to the database
   * This should be called when the user explicitly ends their session (clicks "Finish")
   * @returns Promise<boolean> Success status of the database sync
   */
  const finishSession = async (): Promise<boolean> => {
    try {
      if (!userState) return false;
      
      // Force sync all accumulated state changes to the server
      const syncSuccess = await syncState();
      
      console.log(`Session finished. Database sync ${syncSuccess ? 'successful' : 'failed'}`);
      return syncSuccess;
    } catch (error) {
      console.error('Error finishing session:', error);
      return false;
    }
  };

  return {
    inPlayStitch,
    isLoading,
    error,
    completeStitch,
    finishSession,
    
    // Expose direct access to the buffer for advanced use cases
    buffer: contentBuffer
  };
}