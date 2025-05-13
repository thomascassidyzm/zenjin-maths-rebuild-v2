/**
 * Server-First Stitch Loader
 * 
 * This file replaces the bundled-content-based stitch loader with a server-first approach.
 * It provides the same interface as the original loader but fetches content from the server.
 */

// Import the server stitch provider
const serverStitchProvider = require('../server-stitch-provider');

/**
 * Load a stitch directly from the server
 * @param {string} stitchId - Stitch ID to load
 * @returns {Object|null} Stitch if found, null otherwise
 */
async function loadStitchFromServer(stitchId) {
  return await serverStitchProvider.getStitch(stitchId);
}

/**
 * Get the next logical stitch ID based on current stitch ID
 * @param {string} currentStitchId - Current stitch ID
 * @returns {string|null} Next stitch ID or null if invalid
 */
function getNextStitchId(currentStitchId) {
  // Format is stitch-T{tubeNumber}-{threadNumber}-{stitchNumber}
  const parts = currentStitchId.split('-');
  if (parts.length !== 4) {
    return null;
  }

  const tubeNumber = parts[1]; // e.g., T1
  const threadNumber = parts[2]; // e.g., 001
  const stitchNumber = parts[3]; // e.g., 01

  // Convert stitch number to integer and add 1
  const currentStitchNum = parseInt(stitchNumber, 10);
  if (isNaN(currentStitchNum)) {
    return null;
  }

  const nextStitchNum = currentStitchNum + 1;
  if (nextStitchNum > 10) {
    // We limit to 10 stitches per thread
    return null;
  }

  // Format next stitch ID with padding
  const nextStitchId = `stitch-${tubeNumber}-${threadNumber}-${nextStitchNum.toString().padStart(2, '0')}`;
  return nextStitchId;
}

/**
 * Get the next stitch from server
 * @param {Object} currentStitch - Current stitch object
 * @returns {Promise<Object|null>} Promise resolving to next stitch object or null if not found
 */
async function getNextStitchFromServer(currentStitch) {
  if (!currentStitch || !currentStitch.id) {
    return null;
  }

  const nextStitchId = getNextStitchId(currentStitch.id);
  if (!nextStitchId) {
    return null;
  }

  try {
    const nextStitch = await loadStitchFromServer(nextStitchId);
    
    if (!nextStitch) {
      return null;
    }
    
    // Create a stitch object in the format expected by StateMachine
    return {
      id: nextStitchId,
      threadId: currentStitch.threadId,
      position: 1, // Position it at position 1 so it becomes the next stitch
      skipNumber: currentStitch.skipNumber || 3,
      distractorLevel: currentStitch.distractorLevel || 'L1',
      tubeNumber: currentStitch.tubeNumber,
      content: nextStitch.content,
      title: nextStitch.title,
      questions: nextStitch.questions || []
    };
  } catch (error) {
    console.error('Error fetching next stitch:', error);
    return null;
  }
}

/**
 * Get all stitches for a thread from server
 * @param {number} tubeNumber - Tube number (1-3)
 * @param {string} threadId - Thread ID
 * @returns {Promise<Array>} Promise resolving to array of stitch objects
 */
async function getAllStitchesForThread(tubeNumber, threadId) {
  const stitches = [];
  
  // Format is stitch-T{tubeNumber}-{threadNumber}-{stitchNumber}
  // Extract thread number from threadId
  const threadMatch = threadId.match(/thread-T\d+-(\d+)/);
  if (!threadMatch) {
    return stitches;
  }
  
  const threadNumber = threadMatch[1]; // e.g., 001
  
  // For each tube and thread, load all stitches in sequential order
  const stichIdsToFetch = [];
  for (let i = 1; i <= 10; i++) {
    const stitchId = `stitch-T${tubeNumber}-${threadNumber}-${i.toString().padStart(2, '0')}`;
    stichIdsToFetch.push(stitchId);
  }
  
  try {
    // Fetch all stitches in a batch
    const fetchedStitches = await serverStitchProvider.getStitchBatch(stichIdsToFetch);
    
    // Process the fetched stitches
    for (let i = 1; i <= 10; i++) {
      const stitchId = `stitch-T${tubeNumber}-${threadNumber}-${i.toString().padStart(2, '0')}`;
      
      if (fetchedStitches[stitchId]) {
        const fetchedStitch = fetchedStitches[stitchId];
        
        // Add to list of stitches with proper position
        stitches.push({
          id: stitchId,
          threadId: threadId,
          position: i - 1, // Ensure position is sequential (0-based)
          skipNumber: 3, // Default skip number
          distractorLevel: 'L1', // Default distractor level
          tubeNumber: tubeNumber,
          content: fetchedStitch.content,
          title: fetchedStitch.title,
          questions: fetchedStitch.questions || []
        });
      } else {
        console.warn(`Could not find stitch ${stitchId} in fetched stitches`);
      }
    }
  } catch (error) {
    console.error('Error fetching stitches for thread:', error);
  }
  
  // Make sure stitches are sorted by position
  stitches.sort((a, b) => a.position - b.position);
  
  // Log how many stitches we're returning
  console.log(`getAllStitchesForThread: Returning ${stitches.length} stitches for tube ${tubeNumber}, thread ${threadId}`);
  return stitches;
}

/**
 * Load stitches into a state machine asynchronously
 * This replaces the original function that used bundled content
 * 
 * @param {Object} stateMachine - State machine to load stitches into
 * @returns {Promise<boolean>} Promise resolving to success status
 */
async function loadServerStitchesIntoStateMachine(stateMachine) {
  if (!stateMachine || !stateMachine.state || !stateMachine.state.tubes) {
    console.error('Invalid state machine for loading server stitches');
    return false;
  }
  
  console.log('Loading all server stitches into state machine');
  
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
    
    try {
      // Load all stitches for this tube and thread
      const tubeStitches = await getAllStitchesForThread(tubeNumber, tube.threadId);
      
      if (tubeStitches.length > 0) {
        console.log(`Loaded ${tubeStitches.length} stitches for tube ${tubeNumber} from server`);
        
        // Add the stitches to the tube's stitches array, avoiding duplicates
        const existingStitchIds = new Set(tube.stitches.map(s => s.id));
        const newStitches = tubeStitches.filter(s => !existingStitchIds.has(s.id));
        
        if (newStitches.length > 0) {
          tube.stitches.push(...newStitches);
          console.log(`Added ${newStitches.length} new stitches to tube ${tubeNumber}`);
        }
        
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
    } catch (error) {
      console.error(`Error loading stitches for tube ${tubeNumber}:`, error);
    }
  }
  
  // Save state after loading all stitches
  stateMachine._saveState();
  console.log('Saved state machine state after loading server stitches');
  
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

// Export all the same functions as the original stitch loader, but using server-first
module.exports = {
  loadStitchFromServer,
  getNextStitchId,
  getNextStitchFromServer,
  getAllStitchesForThread,
  loadServerStitchesIntoStateMachine
};