/**
 * Zustand Stitch Adapter
 * 
 * This adapter connects the StateMachine to the Zustand store,
 * providing content loading functions that replace the bundled content approach.
 */

// Import Zustand store instance utility
const { getStoreInstance } = require('../store/zenjin-store-instance');

/**
 * Get a stitch from the Zustand store
 * @param {string} stitchId - The ID of the stitch to fetch
 * @returns {Promise<Object|null>} The stitch content or null if not found
 */
async function getStitchFromStore(stitchId) {
  // Get the store instance (singleton)
  const store = getStoreInstance();
  
  // Use the fetchStitch method from the store
  return await store.getState().fetchStitch(stitchId);
}

/**
 * Get multiple stitches from the Zustand store
 * @param {string[]} stitchIds - Array of stitch IDs to fetch
 * @returns {Promise<Object>} Object mapping stitch IDs to stitch content
 */
async function getStitchBatchFromStore(stitchIds) {
  // Get the store instance
  const store = getStoreInstance();
  
  // Use the fetchStitchBatch method from the store
  return await store.getState().fetchStitchBatch(stitchIds);
}

/**
 * Get all stitches for a thread from the Zustand store
 * @param {number} tubeNumber - The tube number (1-3)
 * @param {string} threadId - The thread ID
 * @returns {Promise<Array>} Array of stitch objects with positions set
 */
async function getAllStitchesForThread(tubeNumber, threadId) {
  // Extract thread number from ID (format: thread-T{tubeNum}-{threadNum})
  const threadMatch = threadId.match(/thread-T\d+-(\d+)/);
  if (!threadMatch) {
    return [];
  }
  
  const threadNumber = threadMatch[1]; // e.g., "001"
  
  // Generate stitch IDs for this thread (assume up to 10 stitches per thread)
  const stitchIds = [];
  for (let i = 1; i <= 10; i++) {
    stitchIds.push(`stitch-T${tubeNumber}-${threadNumber}-${i.toString().padStart(2, '0')}`);
  }
  
  // Fetch all stitches in this thread
  const stitches = await getStitchBatchFromStore(stitchIds);
  
  // Convert to the format expected by StateMachine
  const formattedStitches = [];
  
  // For each stitch fetched, format it for the StateMachine
  Object.entries(stitches).forEach(([stitchId, stitchData], index) => {
    formattedStitches.push({
      id: stitchId,
      threadId: threadId,
      position: index, // Position is sequential for initial load
      skipNumber: 3, // Default skip number
      distractorLevel: 'L1', // Default distractor level
      tubeNumber: tubeNumber,
      content: stitchData.content,
      title: stitchData.title,
      questions: stitchData.questions || []
    });
  });
  
  // Sort stitches by position
  return formattedStitches.sort((a, b) => a.position - b.position);
}

/**
 * Load content for a state machine from the Zustand store
 * @param {Object} stateMachine - The state machine instance
 * @returns {Promise<boolean>} Success status
 */
async function loadContentIntoStateMachine(stateMachine) {
  if (!stateMachine || !stateMachine.state || !stateMachine.state.tubes) {
    console.error('Invalid state machine for loading content');
    return false;
  }
  
  console.log('Loading content into state machine from Zustand store');
  
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
        console.log(`Loaded ${tubeStitches.length} stitches for tube ${tubeNumber} from Zustand store`);
        
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
    } catch (error) {
      console.error(`Error loading stitches for tube ${tubeNumber}:`, error);
    }
  }
  
  // Save state after loading all stitches
  stateMachine._saveState();
  console.log('Saved state machine state after loading content');
  
  return true;
}

/**
 * Create emergency content for a stitch
 * Used when stitch cannot be loaded from Zustand
 * @param {string} stitchId - The stitch ID
 * @returns {Object} Emergency stitch object
 */
function createEmergencyStitch(stitchId) {
  console.warn(`Creating emergency content for stitch ${stitchId}`);
  
  // Extract tube and position info from the stitch ID
  const matches = stitchId.match(/stitch-T(\d+)-(\d+)-(\d+)/);
  const tubeNumber = matches ? parseInt(matches[1], 10) : 1;
  const threadNumber = matches ? matches[2] : '001';
  const stitchNumber = matches ? parseInt(matches[3], 10) : 1;
  const threadId = `thread-T${tubeNumber}-${threadNumber}`;
  
  // Create questions based on tube number
  const questions = [];
  
  if (tubeNumber === 1) {
    // Number facts for tube 1
    questions.push(
      {
        id: `${stitchId}-q1`,
        text: 'What number comes after 5?',
        correctAnswer: '6',
        distractors: { L1: '7', L2: '4', L3: '5' }
      },
      {
        id: `${stitchId}-q2`,
        text: 'Which is greater: 8 or 4?',
        correctAnswer: '8',
        distractors: { L1: '4', L2: 'They are equal', L3: 'Cannot compare' }
      }
    );
  } else if (tubeNumber === 2) {
    // Basic operations for tube 2
    questions.push(
      {
        id: `${stitchId}-q1`,
        text: '3 + 5',
        correctAnswer: '8',
        distractors: { L1: '7', L2: '9', L3: '6' }
      },
      {
        id: `${stitchId}-q2`,
        text: '7 - 2',
        correctAnswer: '5',
        distractors: { L1: '4', L2: '6', L3: '3' }
      }
    );
  } else {
    // Problem solving for tube 3
    questions.push(
      {
        id: `${stitchId}-q1`,
        text: 'Sarah has 5 apples. Tom gives her 3 more. How many apples does Sarah have now?',
        correctAnswer: '8',
        distractors: { L1: '7', L2: '2', L3: '15' }
      },
      {
        id: `${stitchId}-q2`,
        text: 'Jack has 10 stickers. He gives 4 to his friend. How many stickers does Jack have left?',
        correctAnswer: '6',
        distractors: { L1: '14', L2: '4', L3: '5' }
      }
    );
  }
  
  // Create emergency stitch object
  return {
    id: stitchId,
    threadId,
    tubeNumber,
    position: stitchNumber - 1,
    skipNumber: 3,
    distractorLevel: 'L1',
    title: `Emergency Content (Tube ${tubeNumber})`,
    content: `Emergency content for stitch ${stitchId} - please try reloading the page.`,
    questions
  };
}

// Export the adapter functions
module.exports = {
  getStitchFromStore,
  getStitchBatchFromStore,
  getAllStitchesForThread,
  loadContentIntoStateMachine,
  createEmergencyStitch
};