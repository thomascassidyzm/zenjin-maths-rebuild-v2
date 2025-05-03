/**
 * PositionBasedStateMachine.js
 * 
 * A reimplementation of StateMachine using a position-first approach,
 * which prevents stitch position conflicts by design.
 * 
 * In this implementation:
 * - Positions are the primary keys in the data structure
 * - Stitches are assigned to positions, not positions to stitches
 * - The active stitch is always at position 0
 * - When advancing stitches, we rearrange the position mapping
 */

class PositionBasedStateMachine {
  constructor(initialState = {}) {
    // Default state with empty tube structure
    this.state = {
      userId: initialState.userId || 'anonymous',
      activeTubeNumber: 1,
      cycleCount: 0,
      tubes: {
        1: { 
          threadId: null,
          positions: {}
        },
        2: { 
          threadId: null,
          positions: {}
        },
        3: { 
          threadId: null,
          positions: {}
        }
      },
      completedStitches: [],
      totalPoints: 0,
      last_updated: Date.now()
    };
    
    // Override with provided state, migrating if necessary
    if (initialState) {
      console.log('Initializing PositionBasedStateMachine with provided state');
      
      // Check if we need to migrate from legacy format
      if (initialState.tubes && Object.values(initialState.tubes).some(tube => Array.isArray(tube.stitches))) {
        console.log('Migrating from legacy format to position-based format');
        this.state = this._migrateLegacyState(initialState);
      } else if (initialState.tubes && Object.values(initialState.tubes).some(tube => tube.positions)) {
        // Already in position-based format
        this.state = {
          ...this.state,
          ...initialState,
          tubes: {
            ...this.state.tubes,
            ...(initialState.tubes || {})
          }
        };
      } else {
        // No tube data, just use default with user ID
        this.state.userId = initialState.userId || this.state.userId;
      }
    }
    
    // Handle offline-first storage
    this._handleOfflineFirstStorage();
    
    // Set timestamp if missing
    if (!this.state.last_updated) {
      this.state.last_updated = Date.now();
    }
  }
  
  /**
   * Handles offline-first storage logic
   * Determines whether to use localStorage or server state based on user type
   */
  _handleOfflineFirstStorage() {
    const isAnonymousUser = this.state.userId === 'anonymous' || this.state.userId.startsWith('anonymous-');
    
    // For anonymous users we preserve localStorage state, for authenticated we prioritize server
    if (isAnonymousUser) {
      console.log('Anonymous user detected - preserving localStorage state when available');
      
      // For anonymous users, check localStorage first as they don't have server state
      if (typeof window !== 'undefined') {
        try {
          const savedState = localStorage.getItem(`triple_helix_state_${this.state.userId}`);
          
          if (savedState) {
            console.log('Found existing state in localStorage for anonymous user');
            
            // Try to parse and validate the saved state
            try {
              const parsedState = JSON.parse(savedState);
              
              // Basic validation - make sure the state has valid structure
              const isValidState = 
                parsedState && 
                parsedState.tubes && 
                typeof parsedState.activeTubeNumber === 'number' &&
                [1, 2, 3].includes(parsedState.activeTubeNumber);
              
              if (isValidState) {
                // If legacy format, migrate
                if (Object.values(parsedState.tubes).some(tube => Array.isArray(tube.stitches))) {
                  console.log('Migrating localStorage state from legacy format');
                  this.state = this._migrateLegacyState(parsedState);
                } else {
                  // Use the localStorage state for anonymous users
                  console.log('Valid state found in localStorage for anonymous user - using it');
                  this.state = parsedState;
                }
              } else {
                console.warn('Invalid state found in localStorage for anonymous user - ignoring');
                // Remove invalid state to avoid future failures
                localStorage.removeItem(`triple_helix_state_${this.state.userId}`);
              }
            } catch (parseError) {
              console.warn('Could not parse state from localStorage for anonymous user', parseError);
              // Remove invalid state
              localStorage.removeItem(`triple_helix_state_${this.state.userId}`);
            }
          }
        } catch (err) {
          console.warn('Could not load state from localStorage for anonymous user', err);
        }
      }
    } else {
      // For authenticated users, prioritize server state (initialState)
      
      // First, check if initialState is present
      if (this.state.tubes && Object.values(this.state.tubes).some(tube => tube.positions && Object.keys(tube.positions).length > 0)) {
        // For authenticated users, always clear localStorage and use server state
        console.log('Authenticated user detected - enforcing server state as source of truth');
        
        // Clear any existing localStorage state to ensure we always use server state
        if (typeof window !== 'undefined') {
          try {
            // Clear the previous state from localStorage
            localStorage.removeItem(`triple_helix_state_${this.state.userId}`);
            console.log('Cleared existing localStorage state for authenticated user');
          } catch (err) {
            console.warn('Could not clear localStorage state for authenticated user', err);
          }
        }
        
        // Server state is already set from initialState earlier in constructor
        
        // Set timestamp if missing
        if (!this.state.last_updated) {
          this.state.last_updated = Date.now();
          console.log('Added missing timestamp to server state:', this.state.last_updated);
        }
      } else {
        console.log('No server state available for authenticated user - using default initialized state');
        
        // Set timestamp on new state
        this.state.last_updated = Date.now();
      }
    }
  }
  
  /**
   * Migrates a legacy state format to the new position-based format
   * @param {Object} legacyState - The state in the old format
   * @returns {Object} The state in the new position-based format
   */
  _migrateLegacyState(legacyState) {
    console.log('Starting migration of legacy state to position-based format');
    
    const newState = {
      userId: legacyState.userId,
      activeTubeNumber: legacyState.activeTubeNumber,
      cycleCount: legacyState.cycleCount || 0,
      tubes: {},
      completedStitches: legacyState.completedStitches || [],
      totalPoints: legacyState.totalPoints || 0,
      last_updated: legacyState.last_updated || Date.now()
    };
    
    // Convert each tube
    Object.entries(legacyState.tubes).forEach(([tubeNum, tube]) => {
      // Skip if no stitches
      if (!tube.stitches || tube.stitches.length === 0) {
        newState.tubes[tubeNum] = {
          threadId: tube.threadId,
          positions: {}
        };
        return;
      }
      
      // Create positions map
      const positions = {};
      
      // Sort stitches by position (if position exists)
      // This ensures we maintain the correct order
      const sortedStitches = [...tube.stitches].sort((a, b) => 
        (a.position !== undefined ? a.position : 999) - 
        (b.position !== undefined ? b.position : 999)
      );
      
      // Current stitch ID (position 0)
      const currentStitchId = tube.currentStitchId || sortedStitches[0].id;
      
      // Find and place current stitch at position 0
      const currentStitchIndex = sortedStitches.findIndex(s => s.id === currentStitchId);
      if (currentStitchIndex >= 0) {
        const currentStitch = sortedStitches[currentStitchIndex];
        positions[0] = {
          stitchId: currentStitch.id,
          skipNumber: currentStitch.skipNumber || 3,
          distractorLevel: currentStitch.distractorLevel || 'L1',
          completed: currentStitch.completed || false
        };
        
        // Remove from array to avoid duplication
        sortedStitches.splice(currentStitchIndex, 1);
      }
      
      // Place remaining stitches at positions 1+
      sortedStitches.forEach((stitch, index) => {
        positions[index + 1] = {
          stitchId: stitch.id,
          skipNumber: stitch.skipNumber || 3,
          distractorLevel: stitch.distractorLevel || 'L1',
          completed: stitch.completed || false
        };
      });
      
      // Create new tube
      newState.tubes[tubeNum] = {
        threadId: tube.threadId,
        positions: positions
      };
      
      console.log(`Migrated tube ${tubeNum}: ${Object.keys(positions).length} stitches positioned`);
    });
    
    return newState;
  }
  
  /**
   * Gets the full current state (deep copy to prevent mutations)
   * @returns {Object} The current state
   */
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }
  
  /**
   * Gets the current tube number
   * @returns {number} The current tube number
   */
  getCurrentTubeNumber() {
    return this.state.activeTubeNumber;
  }
  
  /**
   * Gets information about a specific tube
   * @param {number} tubeNumber - The tube number
   * @returns {Object|null} The tube or null if not found
   */
  getTube(tubeNumber) {
    return this.state.tubes[tubeNumber] || null;
  }
  
  /**
   * Gets the thread ID for a tube
   * @param {number} tubeNumber - The tube number
   * @returns {string|null} The thread ID or null if not found
   */
  getThreadForTube(tubeNumber) {
    const tube = this.state.tubes[tubeNumber];
    return tube ? tube.threadId : null;
  }
  
  /**
   * Gets all stitches for a specific tube
   * @param {number} tubeNumber - The tube number
   * @returns {Array} Array of stitches with their position info
   */
  getStitchesForTube(tubeNumber) {
    const tube = this.state.tubes[tubeNumber];
    if (!tube || !tube.positions) return [];
    
    // Convert positions map to array
    return Object.entries(tube.positions).map(([position, stitchData]) => ({
      id: stitchData.stitchId,
      position: parseInt(position),
      skipNumber: stitchData.skipNumber,
      distractorLevel: stitchData.distractorLevel,
      completed: stitchData.completed
    })).sort((a, b) => a.position - b.position);
  }
  
  /**
   * Gets the current active stitch
   * @returns {Object|null} The current stitch or null if not found
   */
  getCurrentStitch() {
    const tubeNumber = this.state.activeTubeNumber;
    const tube = this.state.tubes[tubeNumber];
    
    if (!tube || !tube.positions || !tube.positions[0]) return null;
    
    const currentPosition = tube.positions[0];
    
    return {
      id: currentPosition.stitchId,
      tubeNumber,
      skipNumber: currentPosition.skipNumber,
      distractorLevel: currentPosition.distractorLevel,
      completed: currentPosition.completed || false
    };
  }
  
  /**
   * Gets all stitches for the current tube
   * @returns {Array} Array of stitches with their position info
   */
  getCurrentTubeStitches() {
    return this.getStitchesForTube(this.state.activeTubeNumber);
  }
  
  /**
   * Cycles to the next tube in sequence
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
      
      // Ensure tube 3 has content
      if (!this.state.tubes[3] || !this.state.tubes[3].positions || Object.keys(this.state.tubes[3].positions).length === 0) {
        console.error('CRITICAL ERROR: Tube 3 missing or empty during cycle!');
        // Return to tube 1
        this.state.activeTubeNumber = 1;
        return this.getCurrentStitch();
      }
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
    console.log(`Cycled from tube ${prevTube} to tube ${nextTube}`);
    
    // Make sure the current tube has content
    const currentTube = this.state.tubes[nextTube];
    if (!currentTube || !currentTube.positions || Object.keys(currentTube.positions).length === 0) {
      console.error(`CRITICAL ERROR: Tube ${nextTube} has no content!`);
    }
    
    // Save state
    this._saveState();
    
    return this.getCurrentStitch();
  }
  
  /**
   * Finds tube number by thread ID
   * @param {string} threadId - The thread ID to find
   * @returns {number|null} The tube number or null if not found
   * @private
   */
  _findTubeByThreadId(threadId) {
    // First check for tube number directly from thread ID format (thread-T{tubeNum}-)
    const threadMatch = threadId.match(/thread-T(\d+)-/);
    if (threadMatch && threadMatch[1]) {
      const tubeNumber = parseInt(threadMatch[1]);
      const tube = this.state.tubes[tubeNumber];
      
      // If tube exists and has matching thread ID or no thread ID, use it
      if (tube) {
        if (tube.threadId === threadId || !tube.threadId) {
          // Update thread ID if not set
          if (!tube.threadId) {
            tube.threadId = threadId;
          }
          return tubeNumber;
        }
      }
    }
    
    // Search through tubes
    for (const [tubNum, tube] of Object.entries(this.state.tubes)) {
      if (tube.threadId === threadId) {
        return parseInt(tubNum);
      }
    }
    
    // Last resort: try to extract tube number from ID
    if (threadId.includes('T1-')) {
      return 1;
    } else if (threadId.includes('T2-')) {
      return 2;
    } else if (threadId.includes('T3-')) {
      return 3;
    }
    
    return null;
  }
  
  /**
   * Handles stitch completion
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
      console.error(`Thread ${threadId} not found in any tube`);
      return null;
    }
    
    const tube = this.state.tubes[tubeNumber];
    
    // Check if current stitch matches
    const currentPosition = tube.positions[0];
    if (!currentPosition || currentPosition.stitchId !== stitchId) {
      console.error(`Stitch ${stitchId} is not the current stitch`);
      
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
        console.error(`Stitch ${stitchId} not found in tube ${tubeNumber}`);
        return null;
      }
    }
    
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
      this.advanceStitchInTube(tubeNumber);
    } else {
      // For non-perfect scores, reset the skip number to 1
      currentPosition.skipNumber = 1;
      console.log(`Non-perfect score (${score}/${totalQuestions}) - reset skip number to 1`);
      
      // Save state without advancing
      this._saveState();
    }
    
    return this.getCurrentStitch();
  }
  
  /**
   * Advances to a new stitch in the specified tube
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
    
    // Find next stitch to become active
    const nextPosition = tube.positions[1];
    if (!nextPosition) {
      console.error(`No next stitch available in tube ${tubeNumber}`);
      return null;
    }
    
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
      // Skip position==skipNumber as it's reserved for the completed stitch
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
   * Selects a specific tube
   * @param {number} tubeNumber - The tube number to select
   * @returns {boolean} Success flag
   */
  selectTube(tubeNumber) {
    if (!this.state.tubes[tubeNumber]) {
      console.error(`Tube ${tubeNumber} not found`);
      return false;
    }
    
    this.state.activeTubeNumber = tubeNumber;
    
    // Save state
    this._saveState();
    
    return true;
  }
  
  /**
   * Gets the cycle count
   * @returns {number} The cycle count
   */
  getCycleCount() {
    return this.state.cycleCount || 0;
  }
  
  /**
   * Gets a specific stitch from a tube
   * @param {number} tubeNumber - The tube number
   * @param {string} stitchId - The stitch ID
   * @returns {Object|null} The stitch or null if not found
   */
  getStitchFromTube(tubeNumber, stitchId) {
    const tube = this.state.tubes[tubeNumber];
    if (!tube || !tube.positions) return null;
    
    // Search through positions
    for (const [position, stitchData] of Object.entries(tube.positions)) {
      if (stitchData.stitchId === stitchId) {
        return {
          id: stitchData.stitchId,
          position: parseInt(position),
          skipNumber: stitchData.skipNumber,
          distractorLevel: stitchData.distractorLevel,
          completed: stitchData.completed
        };
      }
    }
    
    return null;
  }
  
  /**
   * Saves state to localStorage
   * @private
   */
  _saveState() {
    // Update the timestamp whenever saving state
    this.state.last_updated = Date.now();
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`triple_helix_state_${this.state.userId}`, 
          JSON.stringify(this.state));
      } catch (err) {
        console.warn('Could not save state to localStorage', err);
      }
    }
  }
  
  /**
   * Clears all state and localStorage data
   * @returns {boolean} Success flag
   */
  clearState() {
    console.log('Clearing state and localStorage data');
    
    if (typeof window !== 'undefined') {
      try {
        // Clear localStorage
        localStorage.removeItem(`triple_helix_state_${this.state.userId}`);
        localStorage.removeItem('zenjin_anonymous_state');
        
        // Reset to empty state
        this.state = {
          userId: this.state.userId,
          activeTubeNumber: 1,
          cycleCount: 0,
          tubes: {
            1: { threadId: null, positions: {} },
            2: { threadId: null, positions: {} },
            3: { threadId: null, positions: {} }
          },
          completedStitches: [],
          totalPoints: 0,
          last_updated: Date.now()
        };
        
        console.log('State reset completed');
        return true;
      } catch (err) {
        console.error('Error clearing state:', err);
        return false;
      }
    }
    return false;
  }
  
  /**
   * Converts the position-based state to legacy format for backward compatibility
   * @returns {Object} The state in legacy format
   */
  toLegacyFormat() {
    const legacyState = {
      userId: this.state.userId,
      activeTubeNumber: this.state.activeTubeNumber,
      cycleCount: this.state.cycleCount,
      tubes: {},
      completedStitches: this.state.completedStitches,
      totalPoints: this.state.totalPoints,
      last_updated: this.state.last_updated
    };
    
    // Convert each tube
    Object.entries(this.state.tubes).forEach(([tubeNum, tube]) => {
      // Convert positions to stitches array
      const stitches = [];
      
      // Find current stitch ID (position 0)
      const currentStitchId = tube.positions[0]?.stitchId;
      
      // Sort positions by number
      Object.entries(tube.positions)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([position, stitchData]) => {
          stitches.push({
            id: stitchData.stitchId,
            position: parseInt(position),
            skipNumber: stitchData.skipNumber,
            distractorLevel: stitchData.distractorLevel,
            completed: stitchData.completed
          });
        });
      
      // Create legacy tube
      legacyState.tubes[tubeNum] = {
        threadId: tube.threadId,
        currentStitchId: currentStitchId,
        position: 0,
        stitches: stitches
      };
    });
    
    return legacyState;
  }
}

module.exports = PositionBasedStateMachine;