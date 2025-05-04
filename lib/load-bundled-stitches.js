/**
 * Load Bundled Stitches Utility
 * 
 * This utility ensures all stitches from bundled content are properly
 * loaded into the state machine with the correct positions.
 * 
 * It's used for anonymous and free-tier users to provide
 * consistent access to the bundled content.
 */

const { BUNDLED_FULL_CONTENT } = require('./expanded-bundled-content');

/**
 * Load all bundled stitches into the state machine with correct positions
 * 
 * @param {Object} stateMachine - The state machine instance
 * @returns {boolean} - Whether loading was successful
 */
function loadBundledStitchesIntoStateMachine(stateMachine) {
  if (!stateMachine || !stateMachine.state || !stateMachine.state.tubes) {
    console.error('Invalid state machine for loading bundled stitches');
    return false;
  }
  
  console.log('Loading all bundled stitches into state machine');
  
  // Process each tube (1, 2, 3)
  for (let tubeNumber = 1; tubeNumber <= 3; tubeNumber++) {
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
    
    // Load all 10 stitches for this tube from bundled content
    const tubeStitches = [];
    const existingStitchIds = new Set(tube.stitches.map(s => s.id));
    
    // Load all stitches for this tube and thread
    for (let stitchNumber = 1; stitchNumber <= 10; stitchNumber++) {
      const stitchId = `stitch-T${tubeNumber}-${threadNumber}-${stitchNumber.toString().padStart(2, '0')}`;
      
      if (BUNDLED_FULL_CONTENT[stitchId] && !existingStitchIds.has(stitchId)) {
        console.log(`Found stitch ${stitchId} in bundled content`);
        
        // Create a stitch object in the format expected by StateMachine
        const bundledStitch = BUNDLED_FULL_CONTENT[stitchId];
        
        const stitch = {
          id: stitchId,
          threadId: tube.threadId,
          // Don't assign positions yet - we'll use the existing positions or assign them later
          skipNumber: 3, // Default skip number
          distractorLevel: 'L1', // Default distractor level
          tubeNumber: tubeNumber,
          content: bundledStitch.content,
          title: bundledStitch.title,
          questions: bundledStitch.questions || []
        };
        
        tubeStitches.push(stitch);
      }
    }
    
    if (tubeStitches.length > 0) {
      console.log(`Loaded ${tubeStitches.length} new stitches for tube ${tubeNumber}`);
      
      // Add the new stitches to the tube's stitches array
      tube.stitches.push(...tubeStitches);
      
      // If no current stitch is set, set the first stitch as current
      if (!tube.currentStitchId && tube.stitches.length > 0) {
        const firstStitch = tube.stitches.find(s => s.id.endsWith('-01'));
        if (firstStitch) {
          tube.currentStitchId = firstStitch.id;
          console.log(`Set current stitch for tube ${tubeNumber} to ${firstStitch.id}`);
        } else {
          // If no -01 stitch found, use the first stitch alphabetically
          tube.currentStitchId = tube.stitches[0].id;
          console.log(`Set current stitch for tube ${tubeNumber} to ${tube.stitches[0].id}`);
        }
      }
    }
    
    // Now assign positions based on state machine's current state
    assignPositionsToStitches(tube);
  }
  
  // Save state after loading all stitches
  stateMachine._saveState();
  console.log('Saved state machine state after loading bundled stitches');
  
  return true;
}

/**
 * Assign positions to stitches in a tube
 * Respects existing positions while ensuring all stitches have valid positions
 * 
 * @param {Object} tube - The tube object from the state machine
 */
function assignPositionsToStitches(tube) {
  if (!tube || !tube.stitches || tube.stitches.length === 0) {
    return;
  }
  
  // First check which stitches already have positions assigned
  const hasPositions = tube.stitches.some(s => s.position !== undefined);
  
  // If positions are already assigned, respect them (user_state is being used)
  if (hasPositions) {
    console.log(`Tube already has positions assigned - respecting existing positions`);
    
    // Check for and fix any duplicate positions
    const positions = {};
    let hasDuplicates = false;
    
    tube.stitches.forEach(s => {
      if (s.position !== undefined) {
        if (positions[s.position] !== undefined) {
          hasDuplicates = true;
        } else {
          positions[s.position] = s.id;
        }
      }
    });
    
    // If duplicates found, normalize the positions
    if (hasDuplicates) {
      console.log(`Found duplicate positions - normalizing`);
      normalizePositions(tube);
    }
    
    // Make sure current stitch is at position 0
    const currentStitch = tube.stitches.find(s => s.id === tube.currentStitchId);
    if (currentStitch && currentStitch.position !== 0) {
      // Find what's at position 0
      const pos0Stitch = tube.stitches.find(s => s.position === 0);
      
      if (pos0Stitch) {
        // Swap positions
        const tempPos = currentStitch.position;
        currentStitch.position = 0;
        pos0Stitch.position = tempPos;
        console.log(`Moved current stitch ${currentStitch.id} to position 0`);
      } else {
        // Just set current stitch to position 0
        currentStitch.position = 0;
        console.log(`Set current stitch ${currentStitch.id} to position 0`);
      }
    }
    
    // Assign positions to any stitches without positions
    const usedPositions = new Set(tube.stitches.filter(s => s.position !== undefined).map(s => s.position));
    let nextPos = 1;
    
    tube.stitches.forEach(s => {
      if (s.position === undefined) {
        // Find the next available position
        while (usedPositions.has(nextPos)) {
          nextPos++;
        }
        
        // Assign the position
        s.position = nextPos;
        usedPositions.add(nextPos);
        console.log(`Assigned position ${nextPos} to stitch ${s.id}`);
      }
    });
  } else {
    // No positions assigned yet - use default ordering
    console.log(`No positions assigned yet - using default sequential ordering`);
    
    // Sort stitches by stitch number (stitch-T{n}-{thread}-{number})
    const sortedStitches = [...tube.stitches].sort((a, b) => {
      // Extract stitch number from ID
      const aMatch = a.id.match(/-(\d+)$/);
      const bMatch = b.id.match(/-(\d+)$/);
      
      if (aMatch && bMatch) {
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
      }
      return 0;
    });
    
    // Assign sequential positions (0, 1, 2, ...)
    sortedStitches.forEach((stitch, index) => {
      stitch.position = index;
      console.log(`Assigned default position ${index} to stitch ${stitch.id}`);
    });
    
    // Make sure current stitch is at position 0
    const currentStitch = tube.stitches.find(s => s.id === tube.currentStitchId);
    if (currentStitch && currentStitch.position !== 0) {
      // Find what's at position 0
      const pos0Stitch = tube.stitches.find(s => s.position === 0);
      
      if (pos0Stitch) {
        // Swap positions
        pos0Stitch.position = currentStitch.position;
        currentStitch.position = 0;
        console.log(`Moved current stitch ${currentStitch.id} to position 0`);
      }
    }
  }
}

/**
 * Normalize positions in a tube to ensure they're unique and sequential
 * 
 * @param {Object} tube - The tube object from the state machine
 */
function normalizePositions(tube) {
  if (!tube || !tube.stitches || tube.stitches.length === 0) {
    return;
  }
  
  // Sort stitches by current position
  const sortedStitches = [...tube.stitches].sort((a, b) => {
    // Ensure all stitches have a position
    a.position = a.position !== undefined ? a.position : 999;
    b.position = b.position !== undefined ? b.position : 999;
    return a.position - b.position;
  });
  
  // Ensure current stitch is at position 0
  const currentStitchId = tube.currentStitchId;
  const currentStitchIndex = sortedStitches.findIndex(s => s.id === currentStitchId);
  
  if (currentStitchIndex !== -1 && currentStitchIndex !== 0) {
    // Move current stitch to the front
    const currentStitch = sortedStitches.splice(currentStitchIndex, 1)[0];
    sortedStitches.unshift(currentStitch);
  }
  
  // Assign sequential positions (0, 1, 2, ...)
  sortedStitches.forEach((stitch, index) => {
    stitch.position = index;
  });
  
  console.log(`Normalized positions for ${sortedStitches.length} stitches`);
}

module.exports = {
  loadBundledStitchesIntoStateMachine
};