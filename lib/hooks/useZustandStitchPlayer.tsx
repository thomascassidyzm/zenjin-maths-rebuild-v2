/**
 * useZustandStitchPlayer
 * 
 * A custom hook that connects the MinimalDistinctionPlayer with the Zustand store.
 * Provides stitch content, handles stitch completion, and manages content loading.
 */

import { useState, useEffect } from 'react';
import { useZenjinStore } from '../store/zenjinStore';
import { Thread } from '../types/distinction-learning';
import { StitchContent } from '../client/offline-first-content-buffer';

interface UseZustandStitchPlayerResult {
  thread: Thread | null;
  loading: boolean;
  error: Error | null;
  completeStitch: (results: any) => void;
}

export function useZustandStitchPlayer(tubeNumber: number): UseZustandStitchPlayerResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  
  // Get Zustand store state and actions
  const tubeState = useZenjinStore(state => state.tubeState);
  const fetchStitch = useZenjinStore(state => state.fetchStitch);
  const setCurrentStitch = useZenjinStore(state => state.setCurrentStitch);
  const updateStitchOrder = useZenjinStore(state => state.updateStitchOrder);
  const incrementStitchesCompleted = useZenjinStore(state => state.incrementStitchesCompleted);
  
  useEffect(() => {
    if (!tubeState || !tubeNumber) {
      setLoading(false);
      return;
    }
    
    // Reset state
    setLoading(true);
    setError(null);
    setThread(null);
    
    const activeTube = tubeState.tubes[tubeNumber];
    if (!activeTube) {
      setError(new Error(`Tube ${tubeNumber} not found in tube state`));
      setLoading(false);
      return;
    }
    
    // Get current stitch ID
    const currentStitchId = activeTube.currentStitchId;
    if (!currentStitchId) {
      setError(new Error(`No current stitch found for tube ${tubeNumber}`));
      setLoading(false);
      return;
    }
    
    // Load stitch content
    const loadStitchContent = async () => {
      try {
        const stitch = await fetchStitch(currentStitchId);
        
        if (!stitch) {
          throw new Error(`Failed to load stitch ${currentStitchId}`);
        }
        
        // Create a thread with the stitch
        const threadObj: Thread = {
          id: activeTube.threadId || `thread-T${tubeNumber}-001`,
          name: `Tube ${tubeNumber}`,
          description: `Learning content for Tube ${tubeNumber}`,
          stitches: [{
            id: stitch.id,
            name: stitch.title || stitch.id.split('-').pop() || 'Stitch',
            description: stitch.content || `Stitch ${stitch.id}`,
            questions: stitch.questions || []
          }]
        };
        
        setThread(threadObj);
      } catch (e) {
        console.error('Error loading stitch content:', e);
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setLoading(false);
      }
    };
    
    loadStitchContent();
  }, [tubeNumber, tubeState, fetchStitch]);
  
  // Function to handle stitch completion
  const completeStitch = useCallback((results: any) => {
    if (!tubeState || !tubeNumber) return;
    
    const activeTube = tubeState.tubes[tubeNumber];
    if (!activeTube) return;
    
    // Extract current stitch information
    const currentStitchId = activeTube.currentStitchId;
    const stitchOrder = activeTube.stitchOrder;
    
    // Check if we have completed this stitch with a perfect score
    const isPerfect = results.correctAnswers === results.totalQuestions;
    
    // Update stitch completion in learning progress
    incrementStitchesCompleted(isPerfect);
    
    // Advance to the next stitch if there is one
    if (stitchOrder.length > 1) {
      // Move the current stitch to the end of the order and make the next one current
      const newOrder = [...stitchOrder.slice(1), currentStitchId];
      updateStitchOrder(tubeNumber, newOrder);
      setCurrentStitch(tubeNumber, newOrder[0]);
    }
    
    // Later we can add more advanced logic for spacing based on performance
  }, [tubeState, tubeNumber, incrementStitchesCompleted, updateStitchOrder, setCurrentStitch]);
  
  return { thread, loading, error, completeStitch };
}