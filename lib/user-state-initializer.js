/**
 * User State Initializer
 * 
 * This module syncs user state from the state manager with the state machine
 * to ensure consistent stitch advancement.
 * 
 * It resolves the issue where the app cycles through tubes but doesn't
 * properly advance to new stitches.
 */

// Import the state manager singleton
import { stateManager } from './state/stateManager';

/**
 * Initialize the state machine with user state
 * This ensures the state machine knows which stitches have been completed
 * to prevent showing previously completed stitches
 * 
 * @param {Object} stateMachine - The state machine instance to initialize
 * @returns {boolean} - Whether initialization was successful
 */
export function initializeStateMachineWithUserState(stateMachine) {
  try {
    // Get the current user state from stateManager
    const userState = stateManager.getState();
    
    console.log('Initializing StateMachine with UserState:', userState);
    
    if (!userState || !userState.tubes) {
      console.warn('No valid user state found for initialization');
      return false;
    }

    // Loop through each tube in user state
    for (const [tubeNumStr, tubeState] of Object.entries(userState.tubes)) {
      const tubeNumber = parseInt(tubeNumStr, 10);
      
      // Get the state machine tube
      const tubeSm = stateMachine.getTube(tubeNumber);
      
      if (!tubeSm) {
        console.warn(`Tube ${tubeNumber} not found in state machine`);
        continue;
      }
      
      // Check if the tube has current stitch ID and position
      if (tubeState.currentStitchId && tubeState.position !== undefined) {
        console.log(`Syncing tube ${tubeNumber}: Current stitch ${tubeState.currentStitchId}, position ${tubeState.position}`);
        
        // Get all stitches for this tube 
        const allStitches = stateMachine.getStitchesForTube(tubeNumber);
        
        // Find the current stitch in state machine
        const currentStitch = allStitches.find(s => s.id === tubeState.currentStitchId);
        
        if (currentStitch) {
          console.log(`Found stitch ${currentStitch.id} in state machine for tube ${tubeNumber}`);
          
          // Get the tube object from state machine
          const tube = stateMachine.getTube(tubeNumber);
          
          // Verify the state machine's current stitch matches the user state
          if (tube.currentStitchId !== tubeState.currentStitchId) {
            console.log(`Updating current stitch for tube ${tubeNumber} from ${tube.currentStitchId} to ${tubeState.currentStitchId}`);
            tube.currentStitchId = tubeState.currentStitchId;
          }
          
          // For stitches before the current position, mark them as completed
          const completedStitches = [];
          
          // Since position in userState represents how many stitches have been completed,
          // we can use it to determine which stitches are completed
          if (tubeState.position > 0) {
            console.log(`Marking stitches as completed for tube ${tubeNumber} - current position is ${tubeState.position}`);
            
            // Use the position from user state to determine how many stitches should be marked as completed
            const stitchesToMark = Math.min(tubeState.position, allStitches.length);
            
            // Get stitch IDs that should be before the current position
            const stitchPattern = extractStitchPattern(tubeState.currentStitchId);
            
            if (stitchPattern) {
              // Mark previous stitches in sequence as completed
              for (let i = 1; i <= stitchPattern.stitchNum; i++) {
                const previousStitchId = `stitch-${stitchPattern.tubePrefix}-${stitchPattern.threadNum}-${i.toString().padStart(2, '0')}`;
                
                // Skip the current stitch
                if (previousStitchId === tubeState.currentStitchId) continue;
                
                const stitch = allStitches.find(s => s.id === previousStitchId);
                
                if (stitch) {
                  console.log(`Marking stitch ${previousStitchId} as completed (before current stitch)`);
                  
                  // Add to completed stitches list
                  completedStitches.push({
                    stitchId: stitch.id,
                    threadId: stitch.threadId || tube.threadId,
                    score: 20, // Assume perfect score for completed stitches
                    totalQuestions: 20,
                    timestamp: Date.now() - (10000 * (stitchPattern.stitchNum - i)) // Fake timestamps in the past
                  });
                  
                  // Mark as completed in the state machine
                  stitch.completed = true;
                  stitch.score = 20;
                  stitch.totalQuestions = 20;
                  stitch.completedAt = Date.now() - (10000 * (stitchPattern.stitchNum - i));
                  
                  // Also set skip number to max
                  stitch.skipNumber = 100;
                }
              }
            }
          }
          
          // Add the completed stitches to the state machine
          if (completedStitches.length > 0) {
            console.log(`Adding ${completedStitches.length} completed stitches to state machine for tube ${tubeNumber}`);
            
            // Add to the state machine's completed stitches list
            stateMachine.state.completedStitches.push(...completedStitches);
          }
        } else {
          console.warn(`Stitch ${tubeState.currentStitchId} not found in state machine for tube ${tubeNumber}`);
        }
      }
    }
    
    // Set active tube
    if (userState.activeTube) {
      stateMachine.selectTube(userState.activeTube);
      console.log(`Set active tube to ${userState.activeTube}`);
    }
    
    // Set cycle count
    if (userState.cycleCount !== undefined) {
      stateMachine.state.cycleCount = userState.cycleCount;
      console.log(`Set cycle count to ${userState.cycleCount}`);
    }
    
    // Save the updated state machine state
    stateMachine._saveState();
    console.log('Saved updated state machine state');
    
    return true;
  } catch (error) {
    console.error('Error initializing state machine with user state:', error);
    return false;
  }
}

/**
 * Extract stitch pattern components from stitch ID
 * @param {string} stitchId - The stitch ID to parse
 * @returns {Object|null} - Pattern object or null if invalid
 */
function extractStitchPattern(stitchId) {
  // Format is stitch-T{tubeNumber}-{threadNumber}-{stitchNumber}
  const match = stitchId.match(/stitch-(T\d+)-(\d+)-(\d+)/);
  
  if (!match) return null;
  
  return {
    tubePrefix: match[1],    // e.g., T1
    threadNum: match[2],     // e.g., 001
    stitchNum: parseInt(match[3], 10) // e.g., 1 (from "01")
  };
}

/**
 * Get the next stitch ID in sequence
 * @param {string} currentStitchId - Current stitch ID
 * @returns {string|null} - Next stitch ID or null
 */
export function getNextStitchInSequence(currentStitchId) {
  const pattern = extractStitchPattern(currentStitchId);
  
  if (!pattern) return null;
  
  const nextStitchNum = pattern.stitchNum + 1;
  
  // Format next stitch ID with padding
  return `stitch-${pattern.tubePrefix}-${pattern.threadNum}-${nextStitchNum.toString().padStart(2, '0')}`;
}

/**
 * Check if a stitch is completed in the state machine
 * @param {Object} stateMachine - State machine instance
 * @param {string} stitchId - Stitch ID to check
 * @returns {boolean} - Whether the stitch is completed
 */
export function isStitchCompleted(stateMachine, stitchId) {
  // Check in the completedStitches array
  const completed = stateMachine.state.completedStitches.some(s => s.stitchId === stitchId);
  
  if (completed) {
    return true;
  }
  
  // Also check if any stitches have the completed flag set
  for (const tubeNum of [1, 2, 3]) {
    const tube = stateMachine.getTube(tubeNum);
    
    if (!tube || !tube.stitches) continue;
    
    const stitch = tube.stitches.find(s => s.id === stitchId);
    
    if (stitch && stitch.completed) {
      return true;
    }
  }
  
  return false;
}

/**
 * Find the next unseen stitch in sequence
 * @param {Object} stateMachine - State machine instance 
 * @param {Object} currentStitch - Current stitch
 * @returns {Object|null} - Next unseen stitch or null
 */
export function findNextUnseenStitch(stateMachine, currentStitch) {
  const pattern = extractStitchPattern(currentStitch.id);
  
  if (!pattern) return null;
  
  // Try the next 5 stitches in sequence
  for (let i = 1; i <= 5; i++) {
    const nextStitchNum = pattern.stitchNum + i;
    
    // Skip if it would exceed 10 (we only have 10 stitches per thread in bundled content)
    if (nextStitchNum > 10) break;
    
    // Format next stitch ID
    const nextStitchId = `stitch-${pattern.tubePrefix}-${pattern.threadNum}-${nextStitchNum.toString().padStart(2, '0')}`;
    
    // Check if this stitch is already completed
    if (!isStitchCompleted(stateMachine, nextStitchId)) {
      // Check if this stitch exists in any tube
      for (const tubeNum of [1, 2, 3]) {
        const tube = stateMachine.getTube(tubeNum);
        
        if (!tube || !tube.stitches) continue;
        
        const stitch = tube.stitches.find(s => s.id === nextStitchId);
        
        if (stitch) {
          console.log(`Found next unseen stitch ${nextStitchId}`);
          return stitch;
        }
      }
      
      // If we didn't find the stitch in state machine, try to load it from bundle
      const stitchLoader = require('./stitch-loader');
      const loadedStitch = stitchLoader.loadStitchFromBundle(nextStitchId);
      
      if (loadedStitch) {
        console.log(`Loaded next unseen stitch ${nextStitchId} from bundle`);
        
        // Create a stitch object in the format expected by StateMachine
        return {
          id: nextStitchId,
          threadId: currentStitch.threadId,
          position: 1, // Position it at position 1 so it becomes the next stitch
          skipNumber: currentStitch.skipNumber || 3,
          distractorLevel: currentStitch.distractorLevel || 'L1',
          tubeNumber: currentStitch.tubeNumber,
          content: loadedStitch.content,
          title: loadedStitch.title,
          questions: loadedStitch.questions || []
        };
      }
    }
  }
  
  // If we couldn't find a valid next stitch, return null
  return null;
}