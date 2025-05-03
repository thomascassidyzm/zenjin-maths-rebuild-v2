import React, { useEffect, useState, useRef } from 'react';
import { loadTubeState, saveTubeState, completeStitchWithPerfectScore, TubeState } from '../lib/tubeStateManager';

// Types
interface StitchPosition {
  stitch_id: string;
  position: number;
  skip_number: number;
  distractor_level: string;
}

interface Stitch {
  id: string;
  content: string;
  questions: any[];
  // Include any other stitch properties needed
}

interface SimplifiedTubeCyclerProps {
  userId: string;
  onStateChange?: (state: any) => void;
  onTubeChange?: (tubeNumber: number) => void;
  onLoadError?: (error: string) => void;
  debugMode?: boolean;
}

// Helper for logging in debug mode
const debugLog = (debug: boolean, ...args: any[]) => {
  if (debug) {
    console.log(...args);
  }
};

export default function SimplifiedTubeCycler({
  userId,
  onStateChange,
  onTubeChange,
  onLoadError,
  debugMode = false
}: SimplifiedTubeCyclerProps) {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [activeTube, setActiveTube] = useState(1);
  const [tubeStates, setTubeStates] = useState<TubeState[]>([]);
  const [activeStitch, setActiveStitch] = useState<Stitch | null>(null);
  const [stitchMap, setStitchMap] = useState<Record<string, Stitch>>({});
  
  // Refs
  const rotationLockRef = useRef(false);
  
  // Load initial state
  useEffect(() => {
    async function loadState() {
      try {
        debugLog(debugMode, `Loading tube state for user ${userId}`);
        setIsLoading(true);
        
        // Load tube state from database
        const states = await loadTubeState(userId);
        
        // If no states found, initialize with defaults
        if (states.length === 0) {
          debugLog(debugMode, 'No tube state found, initializing with defaults');
          // This would normally call an API to get initial stitches
          // For now, we'll just set empty states
          const defaultStates: TubeState[] = [
            { user_id: userId, tube_number: 1, positions: [], active_stitch_id: '' },
            { user_id: userId, tube_number: 2, positions: [], active_stitch_id: '' },
            { user_id: userId, tube_number: 3, positions: [], active_stitch_id: '' }
          ];
          setTubeStates(defaultStates);
        } else {
          debugLog(debugMode, `Loaded ${states.length} tube states`);
          setTubeStates(states);
          
          // Set active tube to the first one by default
          setActiveTube(1);
        }
        
        // Load all stitches referenced in the tube states
        await loadAllStitches(states);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading tube state:', error);
        if (onLoadError) {
          onLoadError('Failed to load tube state');
        }
        setIsLoading(false);
      }
    }
    
    loadState();
  }, [userId]);
  
  // Load all stitches referenced in tube states
  const loadAllStitches = async (states: TubeState[]) => {
    try {
      // Collect all stitch IDs from all tubes
      const stitchIds: string[] = [];
      states.forEach(state => {
        state.positions.forEach(pos => {
          if (!stitchIds.includes(pos.stitch_id)) {
            stitchIds.push(pos.stitch_id);
          }
        });
      });
      
      if (stitchIds.length === 0) {
        debugLog(debugMode, 'No stitches to load');
        return;
      }
      
      debugLog(debugMode, `Loading ${stitchIds.length} stitches`);
      
      // Load stitches from API (this would make an API call)
      // For now, we'll create dummy stitches
      const dummyStitches: Record<string, Stitch> = {};
      
      stitchIds.forEach(id => {
        dummyStitches[id] = {
          id,
          content: `Content for stitch ${id}`,
          questions: []
        };
      });
      
      setStitchMap(dummyStitches);
      
      // Set active stitch based on current tube
      updateActiveStitch(states, activeTube, dummyStitches);
    } catch (error) {
      console.error('Error loading stitches:', error);
    }
  };
  
  // Update active stitch based on tube states and active tube
  const updateActiveStitch = (
    states: TubeState[], 
    tube: number, 
    stitches: Record<string, Stitch>
  ) => {
    // Find the active tube state
    const tubeState = states.find(s => s.tube_number === tube);
    
    if (!tubeState) {
      debugLog(debugMode, `No state found for tube ${tube}`);
      setActiveStitch(null);
      return;
    }
    
    // Find the active stitch in this tube
    const activePosition = tubeState.positions.find(p => p.position === 0);
    
    if (!activePosition) {
      debugLog(debugMode, `No active stitch found for tube ${tube}`);
      setActiveStitch(null);
      return;
    }
    
    // Get the stitch from our map
    const stitch = stitches[activePosition.stitch_id];
    
    if (!stitch) {
      debugLog(debugMode, `Stitch ${activePosition.stitch_id} not found in stitch map`);
      setActiveStitch(null);
      return;
    }
    
    // Set as active stitch
    debugLog(debugMode, `Setting active stitch to ${stitch.id}`);
    setActiveStitch(stitch);
  };
  
  // Effect to update active stitch when tube changes
  useEffect(() => {
    if (!isLoading) {
      updateActiveStitch(tubeStates, activeTube, stitchMap);
      
      // Notify of tube change
      if (onTubeChange) {
        onTubeChange(activeTube);
      }
    }
  }, [activeTube, isLoading, tubeStates]);
  
  // Cycle to the next tube
  const cycleTubes = () => {
    // Use rotation lock to prevent double cycles
    if (rotationLockRef.current) {
      debugLog(debugMode, 'Rotation already in progress, ignoring request');
      return;
    }
    
    rotationLockRef.current = true;
    
    try {
      // Calculate next tube in sequence
      const nextTube = (activeTube % 3) + 1;
      debugLog(debugMode, `Cycling from tube ${activeTube} to tube ${nextTube}`);
      
      // Set new active tube
      setActiveTube(nextTube);
      
      // Release rotation lock after delay
      setTimeout(() => {
        rotationLockRef.current = false;
      }, 300);
    } catch (error) {
      console.error('Error cycling tubes:', error);
      rotationLockRef.current = false;
    }
  };
  
  // Handle stitch completion
  const handleStitchCompletion = async (stitchId: string, score: number, totalQuestions: number) => {
    try {
      // Find the tube containing this stitch
      const tubeIndex = tubeStates.findIndex(state => 
        state.positions.some(pos => pos.stitch_id === stitchId && pos.position === 0)
      );
      
      if (tubeIndex === -1) {
        console.error(`Stitch ${stitchId} not found as active stitch in any tube`);
        return;
      }
      
      const tubeState = tubeStates[tubeIndex];
      
      // Check if this is a perfect score
      const isPerfectScore = score === totalQuestions;
      
      if (isPerfectScore) {
        debugLog(debugMode, `Perfect score (${score}/${totalQuestions}) for stitch ${stitchId}`);
        
        // Update the tube state with completed stitch
        const updatedTubeState = completeStitchWithPerfectScore(tubeState, stitchId);
        
        // Update state
        const newTubeStates = [...tubeStates];
        newTubeStates[tubeIndex] = updatedTubeState;
        setTubeStates(newTubeStates);
        
        // Update active stitch
        updateActiveStitch(newTubeStates, activeTube, stitchMap);
        
        // Save changes to database in background
        saveTubeState(userId, newTubeStates).then(success => {
          if (!success) {
            console.error('Failed to save tube state after stitch completion');
          }
        });
      } else {
        debugLog(debugMode, `Non-perfect score (${score}/${totalQuestions}) for stitch ${stitchId}`);
        
        // Find the stitch position
        const stitchPosition = tubeState.positions.find(p => p.stitch_id === stitchId);
        
        if (stitchPosition) {
          // Reset skip number to 1 for non-perfect scores
          stitchPosition.skip_number = 1;
          
          // Update state
          const newTubeStates = [...tubeStates];
          setTubeStates(newTubeStates);
          
          // Save changes to database in background
          saveTubeState(userId, newTubeStates).then(success => {
            if (!success) {
              console.error('Failed to save tube state after stitch reset');
            }
          });
        }
      }
      
      // Notify of state change
      if (onStateChange) {
        onStateChange({
          activeTube,
          tubeStates,
          activeStitch
        });
      }
    } catch (error) {
      console.error('Error handling stitch completion:', error);
    }
  };
  
  // Manual tube selection
  const selectTube = (tubeNumber: number) => {
    if (tubeNumber < 1 || tubeNumber > 3) {
      console.error(`Invalid tube number: ${tubeNumber}`);
      return;
    }
    
    debugLog(debugMode, `Manually selecting tube ${tubeNumber}`);
    setActiveTube(tubeNumber);
  };
  
  // Return interface for external components
  return {
    isLoading,
    activeTube,
    activeStitch,
    tubeStates,
    cycleTubes,
    handleStitchCompletion,
    selectTube,
    
    // Additional utility methods for components to use
    getPositionedStitches: (tubeNumber: number) => {
      const tubeState = tubeStates.find(s => s.tube_number === tubeNumber);
      if (!tubeState) return [];
      
      // Map positions to stitches and sort by position
      return tubeState.positions
        .map(pos => ({
          ...stitchMap[pos.stitch_id],
          position: pos.position,
          skip_number: pos.skip_number,
          distractor_level: pos.distractor_level
        }))
        .sort((a, b) => a.position - b.position);
    }
  };
}