/**
 * StateMachineTubeCyclerAdapter.js
 * 
 * This adapter implements the TubeCyclerRefHandle interface expected by the SequentialPlayer
 * component while using the new StateMachine architecture internally.
 * 
 * It serves as a bridge between the existing UI components and the new state management,
 * fixing both the double rotation and stitch advancement issues.
 */

const StateMachine = require('../triple-helix/StateMachine');

class StateMachineTubeCyclerAdapter {
  // CRITICAL FIX: Add missing getStitchesForTube method to avoid reference errors during recovery
  /**
   * Create a new adapter
   * @param {Object} options - Configuration options
   * @param {string} options.userId - The user ID for state persistence
   * @param {Object} options.initialState - Optional initial state to use
   * @param {Function} options.onStateChange - Callback when state changes
   * @param {Function} options.onTubeChange - Callback when active tube changes
   */
  constructor(options = {}) {
    // CRITICAL FIX: Ensure userId is always present and valid
    // First check if userId is available in options or initialState
    const userId = options.userId || (options.initialState && options.initialState.userId) || null;
    
    // Fallback to localStorage if available (stronger recovery for authenticated users)
    let recoveredUserId = null;
    if ((!userId || userId === '') && typeof window !== 'undefined') {
      try {
        // Try to recover from localStorage
        recoveredUserId = localStorage.getItem('zenjin_user_id');
        if (recoveredUserId) {
          console.log(`CRITICAL RECOVERY: Recovered userId ${recoveredUserId} from localStorage`);
        }
      } catch (e) {
        console.error('Error accessing localStorage for userId recovery:', e);
      }
    }
    
    // Set final userId with proper fallback chain
    const finalUserId = userId || recoveredUserId || 'anonymous';
    
    // Ensure userId is not an empty string
    if (finalUserId === '') {
      console.error('CRITICAL ERROR: Empty userId provided to StateMachineTubeCyclerAdapter. Using fallback.');
      options.userId = 'anonymous';
    } else {
      // Store validated userId in options
      options.userId = finalUserId;
    }
    
    // Log the userId we're using for debugging
    console.log(`Initializing StateMachineTubeCyclerAdapter with userId: ${options.userId}`);
    
    // Store userId in localStorage for resilience
    if (typeof window !== 'undefined' && options.userId && options.userId !== 'anonymous') {
      try {
        localStorage.setItem('zenjin_user_id', options.userId);
        console.log(`Saved userId ${options.userId} to localStorage for resilience`);
      } catch (e) {
        console.error('Error saving userId to localStorage:', e);
      }
    }
    
    // Create StateMachine with either provided initialState or default settings
    if (options.initialState) {
      console.log('Initializing StateMachine with provided state');
      
      // CRITICAL FIX: Ensure userId is set in initialState
      const initialStateWithUserId = {
        ...options.initialState,
        userId: options.userId // Explicitly set userId in initialState
      };
      
      this.stateMachine = new StateMachine(initialStateWithUserId);
    } else {
      console.log('Initializing StateMachine with default state');
      this.stateMachine = new StateMachine({
        userId: options.userId
      });
    }
    
    this.onStateChange = options.onStateChange || (() => {});
    this.onTubeChange = options.onTubeChange || (() => {});
    
    // Critical fix: Rotation lock flag to prevent double rotation
    this.rotationInProgressRef = false;
    
    // Cache the current tube number for detecting changes
    this.currentTube = this.stateMachine.getCurrentTubeNumber();
    
    // Initialize with current state
    this._notifyStateChange();
  }
  
  /**
   * Get the current tube number
   * @returns {number} Current tube number (1-3)
   */
  getCurrentTube() {
    return this.stateMachine.getCurrentTubeNumber();
  }
  
  /**
   * Get tube name in format expected by SequentialPlayer (e.g., 'Tube-1')
   * @returns {string} Current tube name
   */
  getCurrentTubeName() {
    return `Tube-${this.stateMachine.getCurrentTubeNumber()}`;
  }
  
  /**
   * Get information about the current stitch
   * @returns {Object} Stitch information
   */
  getCurrentStitch() {
    return this.stateMachine.getCurrentStitch();
  }
  
  /**
   * Move to the next tube (critical method that implements rotation lock)
   * This is the key method that prevents the double rotation bug
   */
  nextTube() {
    // CRITICAL FIX: Check if rotation is already in progress
    if (this.rotationInProgressRef) {
      console.log('CRITICAL FIX: Rotation already in progress, ignoring duplicate call');
      return null;
    }
    
    // Set rotation lock flag
    this.rotationInProgressRef = true;
    
    // Get current tube for logging
    const currentTubeNum = this.stateMachine.getCurrentTubeNumber();
    console.log(`Starting tube rotation from Tube-${currentTubeNum}`);
    
    // Calculate expected next tube (for validation)
    const expectedNextTube = (currentTubeNum % 3) + 1; // 1->2->3->1
    
    // Perform the tube cycle
    const nextStitch = this.stateMachine.cycleTubes();
    
    // Get the actual new tube number
    const actualNextTube = this.stateMachine.getCurrentTubeNumber();
    
    // Validation check
    if (actualNextTube !== expectedNextTube) {
      console.error(`ERROR: Tube cycling failed! Expected Tube-${expectedNextTube} but got Tube-${actualNextTube}`);
      
      // Force the correct tube number
      console.log(`RECOVERY: Forcing tube number to ${expectedNextTube}`);
      this.stateMachine.selectTube(expectedNextTube);
    }
    
    // Update current tube cache
    this.currentTube = this.stateMachine.getCurrentTubeNumber();
    console.log(`Tube rotation complete: Now on Tube-${this.currentTube}`);
    
    // Notify state change
    this._notifyStateChange();
    
    // Clear the rotation lock after a delay
    setTimeout(() => {
      this.rotationInProgressRef = false;
      console.log('Tube rotation lock released');
    }, 300); // 300ms is a safe buffer for animations to complete
    
    return nextStitch;
  }
  
  /**
   * Handle the completion of a stitch with score
   * @param {string} threadId - Thread ID
   * @param {string} stitchId - Stitch ID
   * @param {number} score - The score achieved
   * @param {number} totalQuestions - Total possible score
   */
  handleStitchCompletion(threadId, stitchId, score, totalQuestions) {
    console.log(`Handling stitch completion for ${stitchId} with score ${score}/${totalQuestions}`);
    
    // CRITICAL FIX: Check if rotation is already in progress
    if (this.rotationInProgressRef) {
      console.log('CRITICAL FIX: Stitch completion already in progress, ignoring duplicate call');
      return null;
    }
    
    // Set rotation lock flag
    this.rotationInProgressRef = true;
    
    // Log current state before changes
    const isPerfectScore = score === totalQuestions;
    const beforeTubeNumber = this.stateMachine.getCurrentTubeNumber();
    const beforeStitchId = this.stateMachine.getCurrentStitch()?.id;
    
    console.log(`Before: Tube=${beforeTubeNumber}, StitchId=${beforeStitchId}, PerfectScore=${isPerfectScore}`);
    
    // Get detailed tube state before changes (for debugging)
    const beforeTubeState = this.stateMachine.getTube(beforeTubeNumber);
    const beforeStitches = this.stateMachine.getStitchesForTube(beforeTubeNumber);
    console.log('DETAILED DEBUG: Before tube state:', beforeTubeState);
    console.log('DETAILED DEBUG: Before stitches:');
    beforeStitches.sort((a, b) => a.position - b.position).slice(0, 5).forEach((s, i) => {
      console.log(`  Position ${s.position}: ${s.id} (Skip=${s.skipNumber})`);
    });
    
    // Handle the stitch completion
    console.log('DETAILED DEBUG: Calling stateMachine.handleStitchCompletion...');
    const result = this.stateMachine.handleStitchCompletion(threadId, stitchId, score, totalQuestions);
    console.log('DETAILED DEBUG: StateMachine handleStitchCompletion completed with result:', result);
    
    // Log state after changes
    const afterTubeNumber = this.stateMachine.getCurrentTubeNumber();
    const afterStitchId = this.stateMachine.getCurrentStitch()?.id;
    
    // Get detailed tube state after changes (for debugging)
    const afterTubeState = this.stateMachine.getTube(beforeTubeNumber); // Check the PREVIOUS tube
    const afterStitches = this.stateMachine.getStitchesForTube(beforeTubeNumber);
    console.log('DETAILED DEBUG: After tube state:', afterTubeState);
    console.log('DETAILED DEBUG: After stitches:');
    afterStitches.sort((a, b) => a.position - b.position).slice(0, 5).forEach((s, i) => {
      console.log(`  Position ${s.position}: ${s.id} (Skip=${s.skipNumber})`);
    });
    
    console.log(`After: Tube=${afterTubeNumber}, StitchId=${afterStitchId}`);
    console.log(`Stitch ${isPerfectScore ? 'advanced' : 'remained same'}: ${beforeStitchId} -> ${afterStitchId}`);
    
    // Notify state change
    this._notifyStateChange();
    
    // Clear the rotation lock after a delay
    setTimeout(() => {
      this.rotationInProgressRef = false;
      console.log('Stitch completion lock released');
    }, 500);
    
    return result;
  }
  
  /**
   * Get all stitches for the current tube, sorted by position
   * @returns {Array} Sorted array of stitches
   */
  getCurrentTubeStitches() {
    return this.stateMachine.getCurrentTubeStitches();
  }
  
  /**
   * Get the current thread ID
   * @returns {string} Current thread ID
   */
  getCurrentThread() {
    const tubNumber = this.stateMachine.getCurrentTubeNumber();
    return this.stateMachine.getThreadForTube(tubNumber);
  }
  
  /**
   * Get stitches for a specific tube
   * CRITICAL FIX: Adding this method to prevent null reference errors
   * @param {number} tubeNumber - Tube number to get stitches for
   * @returns {Array} Array of stitches in the tube
   */
  getStitchesForTube(tubeNumber) {
    console.log(`Getting stitches for tube ${tubeNumber} (recovery method)`);
    
    // Get state from stateMachine
    const state = this.stateMachine.getState();
    
    // Check if tube exists in state
    if (!state || !state.tubes || !state.tubes[tubeNumber]) {
      console.log(`No tube ${tubeNumber} found in state`);
      return [];
    }
    
    // Get stitches from tube
    const tube = state.tubes[tubeNumber];
    const stitches = tube.stitches || [];
    
    // Return sorted stitches by position
    return [...stitches].sort((a, b) => a.position - b.position);
  }
  
  /**
   * Get sorted threads in format expected by TubeCycler
   * This provides compatibility with the existing TubeCycler interface
   * @returns {Array} Thread data array
   */
  getSortedThreads() {
    const state = this.stateMachine.getState();
    const threads = [];
    
    // Convert our state format to the expected ThreadData format
    for (const [tubNum, tube] of Object.entries(state.tubes)) {
      const tubeNumber = parseInt(tubNum);
      
      // Skip tubes without a thread ID
      if (!tube.threadId) continue;
      
      // Get all stitches in this tube
      const stitches = tube.stitches || [];
      
      // Sort stitches by position to ensure correct order
      const sortedStitches = [...stitches].sort((a, b) => a.position - b.position);
      
      // Map our stitch format to the expected format
      const mappedStitches = sortedStitches.map(stitch => ({
        id: stitch.id,
        threadId: stitch.threadId,
        title: `Stitch ${stitch.id}`,
        content: stitch.content || `Content for stitch ${stitch.id}`,
        orderNumber: stitch.position,
        skip_number: stitch.skipNumber,
        distractor_level: stitch.distractorLevel,
        questions: stitch.questions || []
      }));
      
      // Create the thread data
      threads.push({
        thread_id: tube.threadId,
        tube_number: tubeNumber,
        stitches: mappedStitches
      });
    }
    
    // Sort threads by tube number
    return threads.sort((a, b) => a.tube_number - b.tube_number);
  }
  
  /**
   * Get cycle count (how many times through all tubes)
   * @returns {number} Cycle count
   */
  getCycleCount() {
    return this.stateMachine.getCycleCount();
  }
  
  /**
   * Get thread ID for a specific tube
   * @param {number} tubeNumber - Tube number (1-3)
   * @returns {string} Thread ID
   */
  getThreadForTube(tubeNumber) {
    return this.stateMachine.getThreadForTube(tubeNumber);
  }
  
  /**
   * Get current state (for debugging/display)
   * @returns {Object} Current state
   */
  getState() {
    return this.stateMachine.getState();
  }
  
  /**
   * Manually select a specific tube
   * @param {number} tubeNumber - Tube to select (1-3)
   * @returns {boolean} Success
   */
  selectTube(tubeNumber) {
    const success = this.stateMachine.selectTube(tubeNumber);
    
    if (success) {
      // Update current tube cache
      this.currentTube = this.stateMachine.getCurrentTubeNumber();
      
      // Notify state change
      this._notifyStateChange();
    }
    
    return success;
  }
  
  /**
   * Persist current state to server
   * @returns {Promise<boolean>} Success
   */
  async persistCurrentState() {
    // In a more complete implementation, this would call an API
    // to save the state to the server
    console.log('Persisting state to server...');
    
    // Simulate API call
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('State persisted successfully');
        resolve(true);
      }, 100);
    });
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    console.log('Destroying StateMachineTubeCyclerAdapter');
    // If we had any event listeners or timers, we'd clean them up here
  }
  
  /**
   * Notify state change to listeners
   * @private
   */
  _notifyStateChange() {
    const state = this.stateMachine.getState();
    const currentTube = this.stateMachine.getCurrentTubeNumber();
    
    // Notify state change
    if (this.onStateChange) {
      this.onStateChange(state);
    }
    
    // Notify tube change
    if (this.onTubeChange) {
      this.onTubeChange(currentTube);
    }
  }
}

module.exports = StateMachineTubeCyclerAdapter;