/**
 * StateMachine.js - Core Triple-Helix Logic
 * 
 * Implements the state management for the Triple-Helix learning system with:
 * - Tube rotation (1->2->3->1)
 * - Skip number progression (1->3->5->10->25->100)
 * - Proper stitch positioning and advancement
 * - Tracking of completion data
 */

class StateMachine {
  /**
   * Create a new StateMachine
   * @param {Object} initialState - Initial state (optional)
   */
  constructor(initialState = {}) {
    // Default state with predefined stitches for each tube
    this.state = {
      userId: initialState.userId || 'anonymous',
      activeTubeNumber: 1,
      cycleCount: 0,
      tubes: {},
      completedStitches: [],
      pendingChanges: [],
      totalPoints: 0
    };
    
    // If initial state includes tubes, use those instead of generating
    if (initialState && initialState.tubes) {
      this.state.tubes = initialState.tubes;
    } else {
      // Generate default tubes with sample stitches for demo/test purposes
      this.state.tubes = {
        1: this._createTube('thread-A', 'Tube 1'),
        2: this._createTube('thread-B', 'Tube 2'),
        3: this._createTube('thread-C', 'Tube 3')
      };
    }
    
    // Apply other initial state properties if provided
    if (initialState) {
      // Copy non-tube properties
      Object.keys(initialState).forEach(key => {
        if (key !== 'tubes') {
          this.state[key] = initialState[key];
        }
      });
    }

    console.log(`StateMachine initialized for user ${this.state.userId}`);
  }
  
  /**
   * Create a tube with stitches
   * @param {string} threadId - Thread ID for this tube
   * @param {string} name - Tube name
   * @param {number} stitchCount - Number of stitches to generate (default: 20)
   * @returns {Object} Tube object with stitches
   * @private
   */
  _createTube(threadId, name, stitchCount = 20) {
    const stitches = this._generateStitches(threadId, stitchCount);
    
    return {
      threadId,
      name,
      currentStitchId: stitches[0].id, // First stitch is active by default
      position: 0,
      stitches
    };
  }
  
  /**
   * Generate sample stitches for testing
   * @param {string} threadId - Thread ID
   * @param {number} count - Number of stitches to generate
   * @returns {Array} Array of stitch objects
   * @private
   */
  _generateStitches(threadId, count = 20) {
    // Extract thread letter (e.g., "A" from "thread-A")
    const threadLetter = threadId.split('-').pop();
    
    return Array.from({ length: count }, (_, i) => ({
      id: `stitch-${threadLetter}-${i + 1}`,
      threadId,
      content: `Content for stitch ${i + 1} of thread ${threadId}`,
      position: i === 0 ? 0 : i, // First stitch at position 0 (ready), rest in sequence
      skipNumber: 1, // Default skip number for reordering (starts at 1)
      distractorLevel: 'L1', // Default distractor level
      completed: false,
      score: 0,
      totalQuestions: 20,
      questions: this._generateSampleQuestions(3, `${threadLetter}-${i+1}`)
    }));
  }
  
  /**
   * Generate sample questions for testing
   * @param {number} count - Number of questions to generate
   * @param {string} id - Base ID for the questions
   * @returns {Array} Array of question objects
   * @private
   */
  _generateSampleQuestions(count, id) {
    const mathOperations = ['+', '-', '×', '÷'];
    const questions = [];
    
    for (let i = 1; i <= count; i++) {
      const op = mathOperations[(i - 1) % 4];
      let num1 = Math.floor(Math.random() * 10) + 1;
      let num2 = Math.floor(Math.random() * 10) + 1;
      let correctAnswer = '';
      let incorrectAnswers = [];
      
      // Ensure division problems have clean answers
      if (op === '÷') {
        num2 = Math.floor(Math.random() * 5) + 1; // 1-5
        num1 = num2 * (Math.floor(Math.random() * 5) + 1); // Ensure divisible
      }
      
      // Calculate correct answer
      switch (op) {
        case '+': correctAnswer = String(num1 + num2); break;
        case '-': correctAnswer = String(num1 - num2); break;
        case '×': correctAnswer = String(num1 * num2); break;
        case '÷': correctAnswer = String(num1 / num2); break;
      }
      
      // Generate wrong answers close to correct one
      const correctNum = Number(correctAnswer);
      incorrectAnswers = [
        String(correctNum + 1),
        String(correctNum - 1),
        String(correctNum + 2)
      ];
      
      questions.push({
        id: `q-${id}-${i}`,
        text: `${num1} ${op} ${num2}`,
        correctAnswer: correctAnswer,
        distractors: {
          L1: incorrectAnswers[0],
          L2: incorrectAnswers[1],
          L3: incorrectAnswers[2]
        }
      });
    }
    
    return questions;
  }
  
  /**
   * Get the current state (deep copy to prevent mutations)
   * @returns {Object} Current state
   */
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }
  
  /**
   * Get information about the current tube
   * @returns {number} Current tube number (1-3)
   */
  getCurrentTubeNumber() {
    return this.state.activeTubeNumber;
  }
  
  /**
   * Get info about a specific tube
   * @param {number} tubeNumber - Tube number (1-3)
   * @returns {Object|null} Tube info or null if not found
   */
  getTube(tubeNumber) {
    return this.state.tubes[tubeNumber] || null;
  }
  
  /**
   * Get thread ID for a specific tube
   * @param {number} tubeNumber - Tube number (1-3)
   * @returns {string|null} Thread ID or null if not found
   */
  getThreadForTube(tubeNumber) {
    const tube = this.state.tubes[tubeNumber];
    return tube ? tube.threadId : null;
  }
  
  /**
   * Get stitches for a specific tube
   * @param {number} tubeNumber - Tube number (1-3)
   * @returns {Array} Array of stitches (empty if tube not found)
   */
  getStitchesForTube(tubeNumber) {
    const tube = this.state.tubes[tubeNumber];
    return tube?.stitches || [];
  }
  
  /**
   * Get the current active stitch
   * @returns {Object|null} Current stitch or null if not available
   */
  getCurrentStitch() {
    const tubeNumber = this.state.activeTubeNumber;
    const tube = this.state.tubes[tubeNumber];
    
    if (!tube) return null;
    
    // Find the current stitch in the stitches array
    const currentStitch = tube.stitches.find(s => s.id === tube.currentStitchId);
    
    if (!currentStitch) return null;
    
    return {
      ...currentStitch,
      tubeNumber
    };
  }
  
  /**
   * Get all stitches for the current tube, sorted by position
   * @returns {Array} Sorted stitches
   */
  getCurrentTubeStitches() {
    const tubeNumber = this.state.activeTubeNumber;
    const tube = this.state.tubes[tubeNumber];
    
    if (!tube || !tube.stitches) return [];
    
    return [...tube.stitches].sort((a, b) => a.position - b.position);
  }
  
  /**
   * Cycle to the next tube (1->2->3->1)
   * @returns {Object|null} The new current stitch after cycling
   */
  cycleTubes() {
    const prevTube = this.state.activeTubeNumber;
    
    // Cycle 1->2->3->1
    this.state.activeTubeNumber = (this.state.activeTubeNumber % 3) + 1;
    
    // Increment cycle count if back to tube 1
    if (this.state.activeTubeNumber === 1) {
      this.state.cycleCount = (this.state.cycleCount || 0) + 1;
    }
    
    console.log(`Cycled from tube ${prevTube} to tube ${this.state.activeTubeNumber}`);
    
    // Add to pending changes for persistence
    this._recordPendingChange({
      type: 'tubeChange',
      prevTube,
      newTube: this.state.activeTubeNumber,
      timestamp: Date.now()
    });
    
    return this.getCurrentStitch();
  }
  
  /**
   * Handle stitch completion with score
   * @param {string} threadId - Thread ID
   * @param {string} stitchId - Stitch ID
   * @param {number} score - Score achieved
   * @param {number} totalQuestions - Total possible score
   * @returns {Object|null} The next stitch after processing completion
   */
  handleStitchCompletion(threadId, stitchId, score, totalQuestions) {
    console.log(`Handling stitch completion: ${stitchId} from thread ${threadId} with score ${score}/${totalQuestions}`);
    
    // Find which tube has this thread
    let tubeNumber = null;
    for (const [tubNum, tube] of Object.entries(this.state.tubes)) {
      if (tube.threadId === threadId) {
        tubeNumber = parseInt(tubNum);
        break;
      }
    }
    
    if (!tubeNumber) {
      console.error(`Thread ${threadId} not found in any tube`);
      return null;
    }
    
    const tube = this.state.tubes[tubeNumber];
    
    // Find the stitch in the tube
    const stitchIndex = tube.stitches.findIndex(s => s.id === stitchId);
    
    if (stitchIndex === -1) {
      console.error(`Stitch ${stitchId} not found in tube ${tubeNumber}`);
      return null;
    }
    
    // Update stitch with completion information
    tube.stitches[stitchIndex].completed = true;
    tube.stitches[stitchIndex].score = score;
    tube.stitches[stitchIndex].totalQuestions = totalQuestions;
    tube.stitches[stitchIndex].completedAt = Date.now();
    
    // Record completion
    this.state.completedStitches.push({
      stitchId, 
      threadId, 
      score, 
      totalQuestions,
      timestamp: Date.now()
    });
    
    // Add to pending changes for persistence
    this._recordPendingChange({
      type: 'stitchCompletion',
      stitchId,
      threadId,
      tubeNumber,
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
      const currentStitch = tube.stitches[stitchIndex];
      
      // Progress skip number: 1 -> 3 -> 5 -> 10 -> 25 -> 100
      if (currentStitch.skipNumber === 1) currentStitch.skipNumber = 3;
      else if (currentStitch.skipNumber === 3) currentStitch.skipNumber = 5;
      else if (currentStitch.skipNumber === 5) currentStitch.skipNumber = 10;
      else if (currentStitch.skipNumber === 10) currentStitch.skipNumber = 25;
      else if (currentStitch.skipNumber === 25) currentStitch.skipNumber = 100;
      else currentStitch.skipNumber = 100; // Max value
      
      console.log(`Updated skip number to ${currentStitch.skipNumber}`);
      
      // Progress distractor level on ratchet: L1 -> L2 -> L3
      if (currentStitch.distractorLevel === 'L1') currentStitch.distractorLevel = 'L2';
      else if (currentStitch.distractorLevel === 'L2') currentStitch.distractorLevel = 'L3';
      // L3 is max level
      
      console.log(`Updated distractor level to ${currentStitch.distractorLevel}`);
      
      // Advance stitch in the tube
      this.advanceStitchInTube(tubeNumber);
    } else {
      // For non-perfect scores, reset the skip number to 1
      tube.stitches[stitchIndex].skipNumber = 1;
      console.log(`Non-perfect score (${score}/${totalQuestions}) - reset skip number to 1`);
      
      // Note: We do NOT reset distractor level as it's on a ratchet
    }
    
    return this.getCurrentStitch();
  }
  
  /**
   * Advance to a new stitch with proper reordering after perfect score
   * @param {number} tubeNumber - Tube number (1-3)
   * @returns {Object|null} The new current stitch after advancement
   */
  advanceStitchInTube(tubeNumber) {
    const tube = this.state.tubes[tubeNumber];
    if (!tube || !tube.stitches || tube.stitches.length === 0) {
      console.error(`Cannot advance stitch in tube ${tubeNumber} - tube not found or no stitches`);
      return null;
    }
    
    console.log(`Beginning stitch advancement in tube ${tubeNumber}`);
    
    // Find current stitch
    const currentStitchIndex = tube.stitches.findIndex(s => s.id === tube.currentStitchId);
    if (currentStitchIndex === -1) {
      console.error(`Current stitch ${tube.currentStitchId} not found in tube ${tubeNumber}`);
      return null;
    }
    
    const currentStitch = tube.stitches[currentStitchIndex];
    
    // Get the current stitch's skip number
    const skipNumber = currentStitch.skipNumber || 3;
    console.log(`Current stitch (${currentStitch.id}) has skip number ${skipNumber}`);
    
    // Step 1: Temporarily assign position -1 to current stitch (making it inactive)
    console.log(`Step 1: Assign position -1 to current stitch ${currentStitch.id}`);
    currentStitch.position = -1;
    
    // Step 2: Shift all stitches between positions 1 to skipNumber up one position (decrement)
    console.log(`Step 2: Shift positions 1 to ${skipNumber} up by 1`);
    tube.stitches.forEach(stitch => {
      if (stitch.position >= 1 && stitch.position <= skipNumber) {
        const oldPosition = stitch.position;
        stitch.position -= 1;
        console.log(`- Moved stitch ${stitch.id} from position ${oldPosition} to ${stitch.position}`);
      }
    });
    
    // Step 3: Place the completed stitch at the skipNumber position
    console.log(`Step 3: Place completed stitch ${currentStitch.id} at position ${skipNumber}`);
    currentStitch.position = skipNumber;
    
    // Step 4: Find the next stitch in sequence (the one now at position 0)
    const newReadyStitch = tube.stitches.find(s => s.position === 0);
    
    if (!newReadyStitch) {
      console.error(`No stitch found at position 0 after reordering in tube ${tubeNumber}`);
      
      // Create a fallback stitch if no ready stitch is found
      const threadLetter = tube.threadId.split('-').pop();
      let maxStitchNumber = 0;
      
      // Find the highest stitch number
      tube.stitches.forEach(stitch => {
        const match = stitch.id.match(/-(\d+)$/);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxStitchNumber) maxStitchNumber = num;
        }
      });
      
      const newStitchNumber = maxStitchNumber + 1;
      const newId = `stitch-${threadLetter}-${newStitchNumber}`;
      
      const fallbackStitch = {
        id: newId,
        threadId: tube.threadId,
        content: `Content for stitch ${newStitchNumber} of thread ${tube.threadId}`,
        position: 0,
        skipNumber: 1,
        distractorLevel: 'L1',
        completed: false,
        score: 0,
        questions: this._generateSampleQuestions(3, newId)
      };
      
      tube.stitches.push(fallbackStitch);
      tube.currentStitchId = fallbackStitch.id;
      console.log(`Created fallback stitch ${fallbackStitch.id} at position 0`);
    } else {
      // Set the new ready stitch as the current stitch
      tube.currentStitchId = newReadyStitch.id;
      console.log(`Step 4: Set new ready stitch ${newReadyStitch.id} as current stitch`);
    }
    
    // Add to pending changes for persistence
    this._recordPendingChange({
      type: 'stitchAdvancement',
      tubeNumber,
      prevStitchId: currentStitch.id,
      newStitchId: tube.currentStitchId,
      skipNumber,
      timestamp: Date.now()
    });
    
    return this.getCurrentStitch();
  }
  
  /**
   * Get all stitches that should be preloaded next
   * @param {number} count - Number of stitches to preload per tube (default: 5)
   * @returns {Array} Array of stitches to preload
   */
  getNextStitchesToPreload(count = 5) {
    const stitchesToPreload = [];
    
    // For each tube, get the next 'count' stitches by position
    for (let tubeNumber = 1; tubeNumber <= 3; tubeNumber++) {
      const tube = this.state.tubes[tubeNumber];
      if (!tube || !tube.stitches) continue;
      
      // Sort stitches by position
      const sortedStitches = [...tube.stitches].sort((a, b) => a.position - b.position);
      
      // Take the first 'count' stitches
      const nextStitches = sortedStitches.slice(0, count);
      
      // Add to the preload list
      stitchesToPreload.push(...nextStitches);
    }
    
    return stitchesToPreload;
  }
  
  /**
   * Select a specific tube (for manual control)
   * @param {number} tubeNumber - Tube number (1-3)
   * @returns {boolean} Success
   */
  selectTube(tubeNumber) {
    if (!this.state.tubes[tubeNumber]) {
      console.error(`Tube ${tubeNumber} not found`);
      return false;
    }
    
    this.state.activeTubeNumber = tubeNumber;
    
    // Add to pending changes for persistence
    this._recordPendingChange({
      type: 'tubeSelect',
      tubeNumber,
      timestamp: Date.now()
    });
    
    return true;
  }
  
  /**
   * Get the cycle count (number of times through all 3 tubes)
   * @returns {number} Cycle count
   */
  getCycleCount() {
    return this.state.cycleCount || 0;
  }
  
  /**
   * Check tube integrity - verify that each tube has valid state
   * @returns {Object} Tube integrity status
   */
  verifyAllTubesIntegrity() {
    const result = {};
    
    for (let tubeNumber = 1; tubeNumber <= 3; tubeNumber++) {
      const tube = this.state.tubes[tubeNumber];
      if (!tube || !tube.stitches) {
        result[tubeNumber] = { 
          valid: false, 
          readyStitchCount: 0,
          threadCount: 0,
          error: 'Tube not found or no stitches'
        };
        continue;
      }
      
      // Count ready stitches (position === 0)
      const readyStitches = tube.stitches.filter(s => s.position === 0);
      const currentStitchExists = tube.stitches.some(s => s.id === tube.currentStitchId);
      
      result[tubeNumber] = {
        valid: readyStitches.length === 1 && currentStitchExists,
        readyStitchCount: readyStitches.length,
        threadCount: 1, // Each tube has exactly one thread in this implementation
        errors: []
      };
      
      // Add specific error messages
      if (readyStitches.length !== 1) {
        result[tubeNumber].errors.push(`Expected 1 ready stitch, found ${readyStitches.length}`);
      }
      
      if (!currentStitchExists) {
        result[tubeNumber].errors.push(`Current stitch ${tube.currentStitchId} not found`);
      }
    }
    
    return result;
  }
  
  /**
   * Initialize with real content from API/database
   * @param {Array} content - Content data
   */
  initializeWithContent(content) {
    if (!content || !Array.isArray(content) || content.length === 0) {
      console.error('Cannot initialize with invalid content');
      return false;
    }
    
    try {
      // Process content and update state
      // This would be implemented according to actual content format
      console.log(`Initializing StateMachine with ${content.length} content items`);
      
      // For now, just log that we received content
      return true;
    } catch (error) {
      console.error('Error initializing with content:', error);
      return false;
    }
  }
  
  /**
   * Record a change for later persistence
   * @param {Object} change - Change record
   * @private
   */
  _recordPendingChange(change) {
    if (!change || !change.type) return;
    
    this.state.pendingChanges.push({
      ...change,
      timestamp: change.timestamp || Date.now()
    });
  }
  
  /**
   * Get all pending changes for persistence
   * @returns {Array} Pending changes
   */
  getPendingChangesForPersistence() {
    return [...this.state.pendingChanges];
  }
  
  /**
   * Clear pending changes after persistence
   */
  clearPendingChanges() {
    this.state.pendingChanges = [];
  }
}

module.exports = StateMachine;