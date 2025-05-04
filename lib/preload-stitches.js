/**
 * Preload Stitches
 * 
 * This module preloads stitches from bundled content into the state machine.
 * It ensures the triple helix system has all stitches available in the correct order.
 */

// Import bundled content
const { BUNDLED_FULL_CONTENT } = require('./expanded-bundled-content');

/**
 * Preload all stitches from bundled content into the state machine
 * This ensures the state machine has access to all stitches in the correct order
 * 
 * @param {Object} stateMachine - The state machine instance to load stitches into
 * @returns {boolean} - Whether preloading was successful
 */
function preloadStitchesIntoStateMachine(stateMachine) {
  try {
    console.log('Preloading all stitches from bundled content into state machine');
    
    if (!stateMachine || !stateMachine.state || !stateMachine.state.tubes) {
      console.error('Invalid state machine for preloading');
      return false;
    }
    
    // Process each tube (1, 2, 3)
    for (let tubeNumber = 1; tubeNumber <= 3; tubeNumber++) {
      console.log(`Preloading stitches for tube ${tubeNumber}`);
      
      const tube = stateMachine.state.tubes[tubeNumber];
      
      if (!tube) {
        console.error(`Tube ${tubeNumber} not found in state machine`);
        continue;
      }
      
      // Set thread ID if not already set
      if (!tube.threadId) {
        tube.threadId = `thread-T${tubeNumber}-001`;
        console.log(`Set thread ID for tube ${tubeNumber} to ${tube.threadId}`);
      }
      
      // Extract thread number from thread ID
      const threadMatch = tube.threadId.match(/thread-T\d+-(\d+)/);
      if (!threadMatch) {
        console.error(`Could not parse thread ID ${tube.threadId}`);
        continue;
      }
      
      const threadNumber = threadMatch[1]; // e.g., "001"
      
      // Find all stitches in bundled content for this tube and thread
      const tubeStitches = [];
      
      // Load all 10 stitches for this tube (stitch-T{tubeNumber}-{threadNumber}-01 through 10)
      for (let stitchNumber = 1; stitchNumber <= 10; stitchNumber++) {
        const stitchId = `stitch-T${tubeNumber}-${threadNumber}-${stitchNumber.toString().padStart(2, '0')}`;
        
        if (BUNDLED_FULL_CONTENT[stitchId]) {
          console.log(`Found stitch ${stitchId} in bundled content`);
          
          // Create a stitch object in the format expected by StateMachine
          const bundledStitch = BUNDLED_FULL_CONTENT[stitchId];
          
          const stitch = {
            id: stitchId,
            threadId: tube.threadId,
            position: stitchNumber - 1, // Start with positions 0, 1, 2, ...
            skipNumber: 3, // Default skip number
            distractorLevel: 'L1', // Default distractor level
            tubeNumber: tubeNumber,
            content: bundledStitch.content,
            title: bundledStitch.title,
            questions: bundledStitch.questions || []
          };
          
          tubeStitches.push(stitch);
        } else {
          console.warn(`Stitch ${stitchId} not found in bundled content`);
        }
      }
      
      // Sort stitches by position
      tubeStitches.sort((a, b) => a.position - b.position);
      
      if (tubeStitches.length > 0) {
        console.log(`Loaded ${tubeStitches.length} stitches for tube ${tubeNumber}`);
        
        // Set the first stitch as current if none is set
        if (!tube.currentStitchId) {
          tube.currentStitchId = tubeStitches[0].id;
          console.log(`Set current stitch for tube ${tubeNumber} to ${tube.currentStitchId}`);
        }
        
        // Add stitches to the tube - only add those that don't already exist
        const existingStitchIds = new Set(tube.stitches.map(s => s.id));
        
        for (const stitch of tubeStitches) {
          if (!existingStitchIds.has(stitch.id)) {
            tube.stitches.push(stitch);
            console.log(`Added stitch ${stitch.id} to tube ${tubeNumber}`);
          }
        }
        
        // Make sure the current stitch is at position 0
        const currentStitch = tube.stitches.find(s => s.id === tube.currentStitchId);
        if (currentStitch && currentStitch.position !== 0) {
          console.log(`Moving current stitch ${currentStitch.id} to position 0`);
          currentStitch.position = 0;
        }
      } else {
        console.warn(`No stitches found for tube ${tubeNumber}`);
      }
    }
    
    // Save state after preloading
    stateMachine._saveState();
    console.log('Saved state machine state after preloading stitches');
    
    return true;
  } catch (error) {
    console.error('Error preloading stitches into state machine:', error);
    return false;
  }
}

module.exports = {
  preloadStitchesIntoStateMachine
};