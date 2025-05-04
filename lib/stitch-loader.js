/**
 * Stitch Loader - Direct Stitch Loading
 * 
 * This utility module provides direct stitch loading capabilities
 * for the StateMachine.js when it needs to load stitches.
 * 
 * This file fixes the "No next stitch available" issue by adding
 * a direct mechanism to load stitches from the bundled content.
 */

// Import bundled content
const { BUNDLED_FULL_CONTENT } = require('./expanded-bundled-content');

/**
 * Load a stitch directly from the bundled content
 * @param {string} stitchId - Stitch ID to load
 * @returns {Object|null} Stitch if found, null otherwise
 */
function loadStitchFromBundle(stitchId) {
  if (!BUNDLED_FULL_CONTENT) {
    console.error('BUNDLED_FULL_CONTENT is not available');
    return null;
  }

  if (BUNDLED_FULL_CONTENT[stitchId]) {
    console.log(`Successfully loaded bundled stitch ${stitchId}`);
    return BUNDLED_FULL_CONTENT[stitchId];
  }

  console.warn(`Stitch ${stitchId} not found in bundled content`);
  return null;
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
    // We only have 10 stitches per thread in the bundled content
    return null;
  }

  // Format next stitch ID with padding
  const nextStitchId = `stitch-${tubeNumber}-${threadNumber}-${nextStitchNum.toString().padStart(2, '0')}`;
  return nextStitchId;
}

/**
 * Check if a stitch with the specified ID exists in the bundle
 * @param {string} stitchId - Stitch ID to check
 * @returns {boolean} True if exists, false otherwise
 */
function stitchExistsInBundle(stitchId) {
  return BUNDLED_FULL_CONTENT && !!BUNDLED_FULL_CONTENT[stitchId];
}

/**
 * Get the next stitch in sequence from bundled content
 * @param {Object} currentStitch - Current stitch object
 * @returns {Object|null} Next stitch object or null if not found
 */
function getNextStitchFromBundle(currentStitch) {
  if (!currentStitch || !currentStitch.id) {
    return null;
  }

  const nextStitchId = getNextStitchId(currentStitch.id);
  if (!nextStitchId) {
    return null;
  }

  const bundledStitch = loadStitchFromBundle(nextStitchId);
  if (!bundledStitch) {
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
    content: bundledStitch.content,
    title: bundledStitch.title,
    questions: bundledStitch.questions || []
  };
}

/**
 * Get all stitches for a thread from bundled content
 * @param {number} tubeNumber - Tube number (1-3)
 * @param {string} threadId - Thread ID
 * @returns {Array} Array of stitch objects
 */
function getAllStitchesForThread(tubeNumber, threadId) {
  const stitches = [];
  
  // Format is stitch-T{tubeNumber}-{threadNumber}-{stitchNumber}
  // Extract thread number from threadId
  const threadMatch = threadId.match(/thread-T\d+-(\d+)/);
  if (!threadMatch) {
    return stitches;
  }
  
  const threadNumber = threadMatch[1]; // e.g., 001
  
  // CRITICAL FIX: For each tube and thread, make sure we load all stitches in sequential order
  for (let i = 1; i <= 10; i++) {
    const stitchId = `stitch-T${tubeNumber}-${threadNumber}-${i.toString().padStart(2, '0')}`;
    
    // First check directly in bundled content
    if (BUNDLED_FULL_CONTENT[stitchId]) {
      const bundledStitch = BUNDLED_FULL_CONTENT[stitchId];
      console.log(`CRITICAL FIX: Found stitch ${stitchId} directly in bundled content`);
      
      // Add to list of stitches with proper position
      stitches.push({
        id: stitchId,
        threadId: threadId,
        position: i - 1, // CRITICAL FIX: Ensure position is sequential (0-based)
        skipNumber: 3, // Default skip number
        distractorLevel: 'L1', // Default distractor level
        tubeNumber: tubeNumber,
        content: bundledStitch.content,
        title: bundledStitch.title,
        questions: bundledStitch.questions || []
      });
    } else {
      // Try loading from bundled content using the helper function
      const bundledStitch = loadStitchFromBundle(stitchId);
      
      if (bundledStitch) {
        stitches.push({
          id: stitchId,
          threadId: threadId,
          position: i - 1, // Position 0, 1, 2, etc.
          skipNumber: 3, // Default skip number
          distractorLevel: 'L1', // Default distractor level
          tubeNumber: tubeNumber,
          content: bundledStitch.content,
          title: bundledStitch.title,
          questions: bundledStitch.questions || []
        });
      } else {
        console.warn(`Could not find stitch ${stitchId} in bundled content`);
      }
    }
  }
  
  // CRITICAL FIX: Make sure stitches are sorted by position
  stitches.sort((a, b) => a.position - b.position);
  
  // Log how many stitches we're returning
  console.log(`getAllStitchesForThread: Returning ${stitches.length} stitches for tube ${tubeNumber}, thread ${threadId}`);
  return stitches;
}

// Export utilities
module.exports = {
  loadStitchFromBundle,
  getNextStitchId,
  stitchExistsInBundle,
  getNextStitchFromBundle,
  getAllStitchesForThread
};