/**
 * TubeCyclerAdapter.js - Adapter for connecting Triple-Helix logic to UI
 * 
 * This adapter implements the interface expected by the player UI while
 * using the improved StateMachine, ContentManager, and SessionManager internally.
 * It prevents the double rotation issue with the rotation lock mechanism.
 */

const StateMachine = require('../core/StateMachine');
const ContentManager = require('../core/ContentManager');
const SessionManager = require('../core/SessionManager');

class TubeCyclerAdapter {
  /**
   * Create a new TubeCyclerAdapter
   * @param {Object} options - Configuration options
   * @param {string} options.userId - User ID
   * @param {Object} options.initialState - Initial state for StateMachine
   * @param {Function} options.onStateChange - Callback when state changes
   * @param {Function} options.onTubeChange - Callback when active tube changes
   * @param {Function} options.onContentLoad - Callback when content loads
   * @param {boolean} options.debug - Enable verbose logging
   */
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.log('Initializing TubeCyclerAdapter');
    
    // Create core components
    this.stateMachine = new StateMachine({
      userId: options.userId || 'anonymous',
      ...(options.initialState || {})
    });
    
    this.contentManager = new ContentManager({
      prefetchCount: options.prefetchCount || 5,
      debug: this.debug
    });
    
    this.sessionManager = new SessionManager({
      userId: options.userId || 'anonymous',
      persistenceInterval: options.persistenceInterval || 300000,
      autoPersist: options.autoPersist !== false,
      debug: this.debug
    });
    
    // Set callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onTubeChange = options.onTubeChange || (() => {});
    this.onContentLoad = options.onContentLoad || (() => {});
    
    // Critical fix: Rotation lock flag to prevent double rotation
    this.rotationInProgressRef = false;
    
    // Cache the current tube number for detecting changes
    this.currentTube = this.stateMachine.getCurrentTubeNumber();
    
    // Initialize preloading
    this._initializePreloading();
    
    // Restore any pending changes from localStorage
    const restoredChanges = this.sessionManager.restoreFromLocalStorage();
    if (restoredChanges > 0) {
      this.log(`Restored ${restoredChanges} pending changes from localStorage`);
    }
    
    // Initialize with current state
    this._notifyStateChange();
  }
  
  /**
   * Initialize content preloading
   * @private
   */
  _initializePreloading() {
    // Start preloading next stitches
    const stitchesToPreload = this.stateMachine.getNextStitchesToPreload(5);
    this.log(`Preloading ${stitchesToPreload.length} stitches from initial state`);
    
    this.contentManager.preloadStitches(stitchesToPreload);
    
    // Preload specifically the current stitch with high priority
    const currentStitch = this.stateMachine.getCurrentStitch();
    if (currentStitch) {
      this.contentManager.preloadStitches(currentStitch, true);
    }
  }
  
  /**
   * Get the current tube number (1-3)
   * @returns {number} Current tube number
   */
  getCurrentTube() {
    return this.stateMachine.getCurrentTubeNumber();
  }
  
  /**
   * Get tube name in format expected by player UI (e.g., 'Tube-1')
   * @returns {string} Current tube name
   */
  getCurrentTubeName() {
    return `Tube-${this.stateMachine.getCurrentTubeNumber()}`;
  }
  
  /**
   * Get the current stitch information
   * @returns {Object|null} Current stitch
   */
  getCurrentStitch() {
    return this.stateMachine.getCurrentStitch();
  }
  
  /**
   * Get the current thread ID
   * @returns {string|null} Current thread ID
   */
  getCurrentThread() {
    const tubeNumber = this.stateMachine.getCurrentTubeNumber();
    return this.stateMachine.getThreadForTube(tubeNumber);
  }
  
  /**
   * Get all stitches for the current tube, sorted by position
   * @returns {Array} Sorted stitches
   */
  getCurrentTubeStitches() {
    return this.stateMachine.getCurrentTubeStitches();
  }
  
  /**
   * Get sorted threads for all tubes
   * @returns {Array} Sorted thread data array
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
        order_number: stitch.position,
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
   * Move to the next tube (implements rotation lock)
   * @returns {Object|null} The new current stitch
   */
  nextTube() {
    // CRITICAL FIX: Check if rotation is already in progress
    if (this.rotationInProgressRef) {
      this.log('CRITICAL FIX: Rotation already in progress, ignoring duplicate call');
      return null;
    }
    
    // Set rotation lock flag
    this.rotationInProgressRef = true;
    this.log(`Starting tube rotation from Tube-${this.currentTube}`);
    
    // Perform the tube cycle
    const nextStitch = this.stateMachine.cycleTubes();
    
    // Update current tube cache
    this.currentTube = this.stateMachine.getCurrentTubeNumber();
    
    // Queue change for persistence
    this.sessionManager.queueChange({
      type: 'tubeChange',
      prevTube: this.currentTube,
      newTube: this.stateMachine.getCurrentTubeNumber()
    });
    
    // Start preloading the next stitch immediately
    if (nextStitch) {
      this.contentManager.preloadStitches(nextStitch, true);
    }
    
    // Notify state change
    this._notifyStateChange();
    
    // Clear the rotation lock after a delay
    setTimeout(() => {
      this.rotationInProgressRef = false;
      this.log('Tube rotation lock released');
    }, 500); // 500ms is a safe buffer for animations to complete
    
    return nextStitch;
  }
  
  /**
   * Handle the completion of a stitch with score
   * @param {string} threadId - Thread ID
   * @param {string} stitchId - Stitch ID
   * @param {number} score - The score achieved
   * @param {number} totalQuestions - Total possible score
   * @returns {Object|null} The next stitch after processing completion
   */
  handleStitchCompletion(threadId, stitchId, score, totalQuestions) {
    this.log(`Handling stitch completion for ${stitchId} with score ${score}/${totalQuestions}`);
    
    // CRITICAL FIX: Check if stitch completion is already in progress
    if (this.rotationInProgressRef) {
      this.log('CRITICAL FIX: Stitch completion already in progress, ignoring duplicate call');
      return null;
    }
    
    // Set rotation lock flag
    this.rotationInProgressRef = true;
    
    // Log current state before changes
    const isPerfectScore = score === totalQuestions;
    const beforeTubeNumber = this.stateMachine.getCurrentTubeNumber();
    const beforeStitchId = this.stateMachine.getCurrentStitch()?.id;
    
    this.log(`Before: Tube=${beforeTubeNumber}, StitchId=${beforeStitchId}, PerfectScore=${isPerfectScore}`);
    
    // Handle the stitch completion
    const result = this.stateMachine.handleStitchCompletion(threadId, stitchId, score, totalQuestions);
    
    // Log state after changes
    const afterTubeNumber = this.stateMachine.getCurrentTubeNumber();
    const afterStitchId = this.stateMachine.getCurrentStitch()?.id;
    
    this.log(`After: Tube=${afterTubeNumber}, StitchId=${afterStitchId}`);
    
    // Queue completion for persistence
    this.sessionManager.queueChange({
      type: 'stitchCompletion',
      stitchId,
      threadId,
      score,
      totalQuestions,
      isPerfectScore
    });
    
    // Start preloading the new current stitch and next stitches
    if (result) {
      this.contentManager.preloadStitches(result, true);
      
      // Also preload next few stitches
      const nextStitches = this.stateMachine.getNextStitchesToPreload(5);
      this.contentManager.preloadStitches(nextStitches);
    }
    
    // Notify state change
    this._notifyStateChange();
    
    // Clear the rotation lock after a delay
    setTimeout(() => {
      this.rotationInProgressRef = false;
      this.log('Stitch completion lock released');
    }, 500);
    
    return result;
  }
  
  /**
   * Get the cycle count (number of times through all tubes)
   * @returns {number} Cycle count
   */
  getCycleCount() {
    return this.stateMachine.getCycleCount();
  }
  
  /**
   * Check tube integrity - verify that each tube has valid state
   * @returns {Object} Tube integrity status
   */
  checkTubeIntegrity() {
    return this.stateMachine.verifyAllTubesIntegrity();
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
      
      // Queue tube select for persistence
      this.sessionManager.queueChange({
        type: 'tubeSelect',
        tubeNumber
      });
      
      // Notify state change
      this._notifyStateChange();
      
      // Start preloading content for this tube
      const currentStitch = this.stateMachine.getCurrentStitch();
      if (currentStitch) {
        this.contentManager.preloadStitches(currentStitch, true);
      }
    }
    
    return success;
  }
  
  /**
   * Get the current state (for debugging/display)
   * @returns {Object} Current state
   */
  getState() {
    return this.stateMachine.getState();
  }
  
  /**
   * Get statistics about the session and caching
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      session: this.sessionManager.getSessionStats(),
      cache: this.contentManager.getCacheStats()
    };
  }
  
  /**
   * Force persistence of all pending changes
   * @returns {Promise<boolean>} Success status
   */
  persist() {
    return this.sessionManager.persistChanges(true);
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    this.log('Destroying TubeCyclerAdapter');
    
    // Clean up session manager (persists remaining changes)
    this.sessionManager.cleanup();
    
    // Clear content cache
    this.contentManager.clearCache();
    
    // Clear any other resources
    // (Would remove event listeners, etc. in a more complete implementation)
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
  
  /**
   * Conditional logging based on debug flag
   * @private
   */
  log(...args) {
    if (this.debug) {
      console.log('[TubeCyclerAdapter]', ...args);
    }
  }
}

module.exports = TubeCyclerAdapter;