/**
 * InfinitePlayStateMachine.js
 * 
 * An enhanced version of PositionBasedStateMachine that explicitly supports infinite play mode.
 * This implementation ensures continuous cycling of content regardless of network connectivity.
 * 
 * Key features:
 * 1. Uses position-based approach to prevent stitch position conflicts
 * 2. Guarantees content is always available in each tube
 * 3. Handles tube cycling robustly even with limited content
 * 4. Supports both anonymous and authenticated users with consistent experience
 */

// Import the base PositionBasedStateMachine
const PositionBasedStateMachine = require('./PositionBasedStateMachine');

class InfinitePlayStateMachine extends PositionBasedStateMachine {
  constructor(initialState = {}) {
    // Let the parent class handle the basic initialization
    super(initialState);
    
    // Add infinite play mode flag
    this.infinitePlayMode = true;
    
    // Track initialization status for recovery strategies
    this._ensureMinimumContent();
    
    console.log('InfinitePlayStateMachine initialized with infinite play mode');
  }
  
  /**
   * Ensures all tubes have at least the minimum required content
   * This prevents cycling errors when a tube has no content
   * @private
   */
  _ensureMinimumContent() {
    // Check each tube
    for (let tubeNumber = 1; tubeNumber <= 3; tubeNumber++) {
      const tube = this.state.tubes[tubeNumber];
      
      // If tube has no positions data, initialize it
      if (!tube.positions || Object.keys(tube.positions).length === 0) {
        console.log(`Initializing empty tube ${tubeNumber} with fallback content`);
        
        // Create basic thread ID if missing
        if (!tube.threadId) {
          tube.threadId = `thread-T${tubeNumber}-001`;
        }
        
        // Add fallback content at position 0
        tube.positions = {
          0: {
            stitchId: `stitch-T${tubeNumber}-001-01`,
            skipNumber: 3,
            distractorLevel: 'L1',
            completed: false
          }
        };
      }
      
      // Ensure there's always a stitch at position 0
      if (!tube.positions[0]) {
        console.log(`Missing position 0 in tube ${tubeNumber}, adding fallback`);
        
        // Find any position to use as template
        const anyPosition = Object.values(tube.positions)[0];
        if (anyPosition) {
          tube.positions[0] = { ...anyPosition };
        } else {
          // Create a completely new one from scratch
          tube.positions[0] = {
            stitchId: `stitch-T${tubeNumber}-001-01`,
            skipNumber: 3,
            distractorLevel: 'L1',
            completed: false
          };
        }
      }
    }
  }
  
  /**
   * Override cycleTubes to ensure continuous cycling even with limited content
   * @returns {Object|null} The new current stitch or null if error
   */
  cycleTubes() {
    const prevTube = this.state.activeTubeNumber;
    
    // Cycle 1->2->3->1
    if (prevTube === 1) {
      this.state.activeTubeNumber = 2;
      console.log('Cycling: Moving from Tube 1 to Tube 2');
    } else if (prevTube === 2) {
      this.state.activeTubeNumber = 3;
      console.log('Cycling: Moving from Tube 2 to Tube 3');
    } else if (prevTube === 3) {
      this.state.activeTubeNumber = 1;
      console.log('Cycling: Moving from Tube 3 to Tube 1');
      this.state.cycleCount = (this.state.cycleCount || 0) + 1;
    } else {
      // Fallback in case of invalid tube number
      console.error(`Invalid tube number ${prevTube}, resetting to 1`);
      this.state.activeTubeNumber = 1;
    }
    
    const nextTube = this.state.activeTubeNumber;
    
    // Make sure the current tube has content
    const currentTube = this.state.tubes[nextTube];
    if (!currentTube || !currentTube.positions || Object.keys(currentTube.positions).length === 0) {
      console.error(`CRITICAL ERROR: Tube ${nextTube} has no content! Attempting recovery...`);
      this._ensureMinimumContent();
    }
    
    // Save state
    this._saveState();
    
    return this.getCurrentStitch();
  }
  
  /**
   * Override handleStitchCompletion to support infinite play mode
   * @param {string} threadId - The thread ID
   * @param {string} stitchId - The completed stitch ID
   * @param {number} score - The score achieved
   * @param {number} totalQuestions - The total questions
   * @returns {Object|null} The new current stitch or null if error
   */
  handleStitchCompletion(threadId, stitchId, score, totalQuestions) {
    console.log(`Handling stitch completion: ${stitchId} from thread ${threadId} with score ${score}/${totalQuestions}`);
    
    // Find tube number
    const tubeNumber = this._findTubeByThreadId(threadId);
    if (!tubeNumber) {
      console.error(`Thread ${threadId} not found in any tube. Attempting recovery...`);
      
      // Recovery: Try to extract tube number from ID
      const tubeMatch = threadId.match(/T(\d+)/);
      if (tubeMatch && tubeMatch[1]) {
        const extractedTubeNumber = parseInt(tubeMatch[1]);
        
        if (extractedTubeNumber >= 1 && extractedTubeNumber <= 3) {
          console.log(`Recovered tube number ${extractedTubeNumber} from thread ID ${threadId}`);
          
          // Update tube thread ID
          this.state.tubes[extractedTubeNumber].threadId = threadId;
          
          // Resume normal completion flow with recovered tube number
          return this.handleStitchCompletion(threadId, stitchId, score, totalQuestions);
        }
      }
      
      // If recovery fails, use current active tube as fallback
      console.log(`Using current active tube ${this.state.activeTubeNumber} as fallback`);
      return this.handleStitchCompletionWithFallback(this.state.activeTubeNumber, stitchId, score, totalQuestions);
    }
    
    const tube = this.state.tubes[tubeNumber];
    
    // Check if current stitch matches
    const currentPosition = tube.positions[0];
    if (!currentPosition || currentPosition.stitchId !== stitchId) {
      console.error(`Stitch ${stitchId} is not the current stitch for tube ${tubeNumber}`);
      
      // Try to find the stitch in any position
      let found = false;
      for (const [pos, posData] of Object.entries(tube.positions)) {
        if (posData.stitchId === stitchId) {
          console.log(`Found stitch ${stitchId} at position ${pos}`);
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.error(`Stitch ${stitchId} not found in tube ${tubeNumber}. Attempting recovery...`);
        return this.handleStitchCompletionWithFallback(tubeNumber, stitchId, score, totalQuestions);
      }
    }
    
    // Continue with normal stitch completion
    // Record completion
    this.state.completedStitches.push({
      stitchId, 
      threadId, 
      score, 
      totalQuestions,
      timestamp: Date.now()
    });
    
    // Add points
    this.state.totalPoints = (this.state.totalPoints || 0) + score;
    
    // Check for perfect score
    const isPerfectScore = score === totalQuestions;
    
    if (isPerfectScore) {
      console.log(`Perfect score achieved (${score}/${totalQuestions}) for stitch ${stitchId}`);
      
      // Update skip number and distractor level
      // Progress skip number: 1 -> 3 -> 5 -> 10 -> 25 -> 100
      if (currentPosition.skipNumber === 1) currentPosition.skipNumber = 3;
      else if (currentPosition.skipNumber === 3) currentPosition.skipNumber = 5;
      else if (currentPosition.skipNumber === 5) currentPosition.skipNumber = 10;
      else if (currentPosition.skipNumber === 10) currentPosition.skipNumber = 25;
      else if (currentPosition.skipNumber === 25) currentPosition.skipNumber = 100;
      else currentPosition.skipNumber = 100; // Max value
      
      console.log(`Updated skip number to ${currentPosition.skipNumber}`);
      
      // Progress distractor level on ratchet: L1 -> L2 -> L3
      if (currentPosition.distractorLevel === 'L1') currentPosition.distractorLevel = 'L2';
      else if (currentPosition.distractorLevel === 'L2') currentPosition.distractorLevel = 'L3';
      // L3 is max level
      
      console.log(`Updated distractor level to ${currentPosition.distractorLevel}`);
      
      // Mark as completed
      currentPosition.completed = true;
      
      // Advance stitch in the tube
      return this.advanceStitchInTube(tubeNumber);
    } else {
      // For non-perfect scores, reset the skip number to 1
      currentPosition.skipNumber = 1;
      console.log(`Non-perfect score (${score}/${totalQuestions}) - reset skip number to 1`);
      
      // Save state without advancing
      this._saveState();
      
      return this.getCurrentStitch();
    }
  }
  
  /**
   * Fallback method for handling stitch completion when normal path fails
   * @param {number} tubeNumber - The tube number
   * @param {string} stitchId - The completed stitch ID
   * @param {number} score - The score achieved
   * @param {number} totalQuestions - The total questions
   * @returns {Object|null} The new current stitch or null if error
   * @private
   */
  handleStitchCompletionWithFallback(tubeNumber, stitchId, score, totalQuestions) {
    console.log(`Using fallback stitch completion for ${stitchId} in tube ${tubeNumber}`);
    
    const tube = this.state.tubes[tubeNumber];
    
    // Ensure tube has position data
    if (!tube.positions || Object.keys(tube.positions).length === 0) {
      tube.positions = {};
    }
    
    // Add the stitch to position 0 if it's not already in any position
    tube.positions[0] = {
      stitchId: stitchId,
      skipNumber: 3,
      distractorLevel: 'L1',
      completed: false
    };
    
    // Create a fake thread ID if needed
    if (!tube.threadId) {
      tube.threadId = `thread-T${tubeNumber}-001`;
    }
    
    // Now proceed with normal completion using the created position
    if (score === totalQuestions) {
      // For perfect score, mark as completed and advance
      tube.positions[0].completed = true;
      
      // Advance stitch in the tube
      return this.advanceStitchInTube(tubeNumber);
    } else {
      // For non-perfect scores, reset the skip number to 1
      tube.positions[0].skipNumber = 1;
      
      // Save state without advancing
      this._saveState();
      
      return this.getCurrentStitch();
    }
  }
  
  /**
   * Override advanceStitchInTube to handle the case when there's only one stitch
   * @param {number} tubeNumber - The tube number
   * @returns {Object|null} The new current stitch or null if error
   */
  advanceStitchInTube(tubeNumber) {
    const tube = this.state.tubes[tubeNumber];
    if (!tube || !tube.positions) {
      console.error(`Cannot advance stitch in tube ${tubeNumber} - tube not found or no positions`);
      return null;
    }
    
    console.log(`Beginning stitch advancement in tube ${tubeNumber}`);
    
    // Get current position data
    const currentPosition = tube.positions[0];
    if (!currentPosition) {
      console.error(`No stitch at position 0 in tube ${tubeNumber}`);
      return null;
    }
    
    // Get the skip number for the current stitch
    const skipNumber = currentPosition.skipNumber || 3;
    console.log(`Current stitch has skip number ${skipNumber}`);
    
    // In infinite play mode, we need special handling for single stitch
    const positionCount = Object.keys(tube.positions).length;
    
    // Special case for just one stitch (in infinite mode, we keep re-using it)
    if (positionCount === 1 && this.infinitePlayMode) {
      console.log(`Only one stitch in tube ${tubeNumber}, keeping it at position 0 for infinite play`);
      
      // Record that it's completed (useful for stats)
      this.state.completedStitches.push({
        stitchId: currentPosition.stitchId,
        threadId: tube.threadId,
        score: 0,
        totalQuestions: 0,
        timestamp: Date.now()
      });
      
      // Save state without changing positions
      this._saveState();
      
      return this.getCurrentStitch();
    }
    
    // If there's only position 0, create a dummy position 1 by cloning position 0
    if (positionCount === 1 && !this.state.tubes[tubeNumber].positions[1]) {
      this.state.tubes[tubeNumber].positions[1] = { ...currentPosition };
      console.log(`Created dummy position 1 in tube ${tubeNumber} for advancement`);
    }
    
    // Find next stitch to become active
    const nextPosition = tube.positions[1];
    if (!nextPosition) {
      console.error(`No next stitch available in tube ${tubeNumber}`);
      return null;
    }
    
    // Standard position-based advancement logic from here on
    // Create new positions object
    const newPositions = {};
    
    // 1. Move next stitch (position 1) to position 0
    newPositions[0] = { ...nextPosition };
    
    // 2. Shift all other stitches forward
    // Skip the spot where the completed stitch will go
    const maxPosition = Math.max(...Object.keys(tube.positions).map(Number));
    
    for (let i = 2; i <= maxPosition; i++) {
      const position = tube.positions[i];
      if (!position) continue;
      
      if (i < skipNumber) {
        // Positions before skipNumber move up by 1
        newPositions[i - 1] = { ...position };
      } else if (i > skipNumber) {
        // Positions after skipNumber move up by 1
        newPositions[i] = { ...position };
      }
    }
    
    // 3. Place completed stitch at its skip position
    newPositions[skipNumber] = { ...currentPosition };
    
    // Update the tube with new positions
    tube.positions = newPositions;
    
    // Debug output
    console.log('Stitch advancement complete. New positions:');
    Object.entries(tube.positions)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .slice(0, 5)
      .forEach(([pos, data]) => {
        console.log(`  Position ${pos}: Stitch ${data.stitchId} (Skip=${data.skipNumber})`);
      });
    
    // Save state
    this._saveState();
    
    return this.getCurrentStitch();
  }
  
  /**
   * Initializes a tube with content from an array of stitch IDs
   * Useful for setting up a new tube with predetermined content
   * 
   * @param {number} tubeNumber - The tube number (1-3)
   * @param {string} threadId - The thread ID
   * @param {string[]} stitchIds - Array of stitch IDs to initialize tube with
   */
  initializeTubeWithContent(tubeNumber, threadId, stitchIds) {
    if (!stitchIds || stitchIds.length === 0) {
      console.error('Cannot initialize tube with empty stitch list');
      return;
    }
    
    // Create positions map
    const positions = {};
    
    // Setup first stitch at position 0
    positions[0] = {
      stitchId: stitchIds[0],
      skipNumber: 3,
      distractorLevel: 'L1',
      completed: false
    };
    
    // Setup remaining stitches at consecutive positions
    for (let i = 1; i < stitchIds.length; i++) {
      positions[i] = {
        stitchId: stitchIds[i],
        skipNumber: 3,
        distractorLevel: 'L1',
        completed: false
      };
    }
    
    // Update tube
    this.state.tubes[tubeNumber] = {
      threadId,
      positions
    };
    
    console.log(`Initialized tube ${tubeNumber} with ${stitchIds.length} stitches`);
    
    // Save state
    this._saveState();
  }
}

module.exports = InfinitePlayStateMachine;