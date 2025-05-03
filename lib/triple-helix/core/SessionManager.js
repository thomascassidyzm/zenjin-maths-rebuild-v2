/**
 * SessionManager.js - Manages session state and persistence
 * 
 * Handles user sessions and batch persistence of changes:
 * - Tracks user's ongoing session
 * - Batches updates for efficient database persistence
 * - Implements reliable persistence strategies 
 * - Handles anonymous vs. authenticated users
 */

class SessionManager {
  /**
   * Create a new SessionManager
   * @param {Object} options - Configuration options
   * @param {string} options.userId - User ID (default: 'anonymous')
   * @param {number} options.persistenceInterval - Interval in ms for auto-persistence (default: 5 minutes)
   * @param {boolean} options.autoPersist - Whether to automatically persist (default: true)
   * @param {boolean} options.debug - Enable debug logging (default: false)
   */
  constructor(options = {}) {
    this.userId = options.userId || 'anonymous';
    this.sessionStartTime = Date.now();
    this.sessionId = `session-${this.userId}-${this.sessionStartTime}`;
    this.completedStitches = [];
    this.pendingChanges = [];
    this.persistenceInterval = options.persistenceInterval || 300000; // 5 minutes
    this.autoPersist = options.autoPersist !== false;
    this.debug = options.debug || false;
    this.persistenceIntervalId = null;
    this.lastPersistenceTime = null;
    this.isAuthenticated = this.userId !== 'anonymous';
    
    this.log(`Session initialized for user ${this.userId} (authenticated: ${this.isAuthenticated})`);
    
    // Set up periodic persistence if configured
    if (this.autoPersist) {
      this.setupAutoPersistence();
    }
    
    // Set up beforeunload handler if in browser
    this.setupExitHandler();
  }
  
  /**
   * Set up automatic persistence interval
   */
  setupAutoPersistence() {
    if (this.persistenceIntervalId) {
      clearInterval(this.persistenceIntervalId);
    }
    
    this.persistenceIntervalId = setInterval(() => {
      this.persistChanges().catch(error => {
        this.log('Error during auto-persistence:', error);
      });
    }, this.persistenceInterval);
    
    this.log(`Auto-persistence set up with interval of ${this.persistenceInterval}ms`);
  }
  
  /**
   * Set up handler for page unload/exit
   */
  setupExitHandler() {
    if (typeof window !== 'undefined') {
      // Save session data when page is unloaded
      window.addEventListener('beforeunload', () => {
        this.persistChanges().catch(err => {
          this.log('Error persisting on exit:', err);
        });
      });
      
      this.log('Exit handler set up for beforeunload');
    }
  }
  
  /**
   * Queue a change for persistence
   * @param {Object} change - Change record to queue
   */
  queueChange(change) {
    if (!change || !change.type) {
      this.log('Invalid change record, must have a type');
      return;
    }
    
    // Ensure change has timestamp and user ID
    const fullChange = {
      ...change,
      userId: this.userId,
      timestamp: change.timestamp || Date.now()
    };
    
    this.pendingChanges.push(fullChange);
    
    // Add to completed stitches if it's a completion
    if (change.type === 'stitchCompletion') {
      this.completedStitches.push({
        stitchId: change.stitchId,
        threadId: change.threadId,
        score: change.score,
        totalQuestions: change.totalQuestions,
        timestamp: fullChange.timestamp
      });
    }
    
    this.log(`Queued change of type ${change.type} (queue size: ${this.pendingChanges.length})`);
    
    // Store pending changes in localStorage as backup
    this._storeChangesInLocalStorage();
  }
  
  /**
   * Batch persist all pending changes
   * @param {boolean} force - Force persistence even if no changes
   * @returns {Promise<boolean>} Success status
   */
  async persistChanges(force = false) {
    if (this.pendingChanges.length === 0 && !force) {
      this.log('No pending changes to persist');
      return true;
    }
    
    this.log(`Persisting ${this.pendingChanges.length} changes...`);
    
    try {
      // Group changes by type for efficient persistence
      const changesByType = this._groupChangesByType();
      
      // Get persistent state for StateMachine
      const persistentState = this._getPersistentState();
      
      // If user is anonymous, just store in localStorage
      if (this.userId === 'anonymous') {
        this._saveToLocalStorage(persistentState);
        this.log('Changes persisted to localStorage (anonymous user)');
        this.pendingChanges = [];
        this.lastPersistenceTime = Date.now();
        return true;
      }
      
      // Otherwise, persist to server
      const results = await Promise.allSettled([
        this._persistStitchCompletions(changesByType.stitchCompletion || []),
        this._persistTubePositions(changesByType.tubeChange || []),
        this._persistStateSnapshot(persistentState)
      ]);
      
      // Check if any failed
      const anyFailed = results.some(result => result.status === 'rejected');
      
      if (anyFailed) {
        this.log('Some persistence operations failed:');
        results.forEach((result, i) => {
          if (result.status === 'rejected') {
            this.log(`- Operation ${i} failed:`, result.reason);
          }
        });
      } else {
        // All succeeded, clear pending changes
        this.pendingChanges = [];
        this._clearLocalStorageBackup();
        this.log('All changes persisted successfully');
      }
      
      this.lastPersistenceTime = Date.now();
      return !anyFailed;
    } catch (error) {
      this.log('Error persisting changes:', error);
      return false;
    }
  }
  
  /**
   * Group changes by type
   * @returns {Object} Changes grouped by type
   * @private
   */
  _groupChangesByType() {
    return this.pendingChanges.reduce((grouped, change) => {
      const type = change.type;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(change);
      return grouped;
    }, {});
  }
  
  /**
   * Persist stitch completions to server
   * @param {Array} completions - Stitch completion changes
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async _persistStitchCompletions(completions) {
    if (!completions || completions.length === 0) return true;
    
    this.log(`Persisting ${completions.length} stitch completions`);
    
    // In real implementation, this would call an API endpoint
    // For now, simulate a successful API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 100);
    });
  }
  
  /**
   * Persist tube position changes to server
   * @param {Array} tubeChanges - Tube position changes
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async _persistTubePositions(tubeChanges) {
    if (!tubeChanges || tubeChanges.length === 0) return true;
    
    // Only care about the most recent tube change
    const latestChange = tubeChanges.reduce((latest, change) => {
      return (!latest || change.timestamp > latest.timestamp) ? change : latest;
    }, null);
    
    if (!latestChange) return true;
    
    this.log(`Persisting latest tube change to tube ${latestChange.newTube}`);
    
    // In real implementation, this would call an API endpoint
    // For now, simulate a successful API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 100);
    });
  }
  
  /**
   * Persist current state snapshot to server
   * @param {Object} state - State snapshot
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async _persistStateSnapshot(state) {
    if (!state) return false;
    
    this.log('Persisting state snapshot');
    
    // In real implementation, this would call an API endpoint
    // For now, simulate a successful API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 100);
    });
  }
  
  /**
   * Get complete state of the session for persistence
   * @returns {Object} Session state
   * @private
   */
  _getPersistentState() {
    return {
      userId: this.userId,
      sessionId: this.sessionId,
      sessionStartTime: this.sessionStartTime,
      lastUpdateTime: Date.now(),
      completedStitches: [...this.completedStitches],
      pendingChanges: [...this.pendingChanges]
    };
  }
  
  /**
   * Store pending changes in localStorage as backup
   * @private
   */
  _storeChangesInLocalStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      const key = `triple_helix_pending_changes_${this.userId}`;
      localStorage.setItem(key, JSON.stringify(this.pendingChanges));
    } catch (error) {
      this.log('Error storing changes in localStorage:', error);
    }
  }
  
  /**
   * Save full state to localStorage
   * @param {Object} state - State to save
   * @private
   */
  _saveToLocalStorage(state) {
    if (typeof window === 'undefined') return;
    
    try {
      const key = `triple_helix_session_${this.userId}`;
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      this.log('Error saving to localStorage:', error);
    }
  }
  
  /**
   * Clear localStorage backup of pending changes
   * @private
   */
  _clearLocalStorageBackup() {
    if (typeof window === 'undefined') return;
    
    try {
      const key = `triple_helix_pending_changes_${this.userId}`;
      localStorage.removeItem(key);
    } catch (error) {
      this.log('Error clearing localStorage backup:', error);
    }
  }
  
  /**
   * Restore any pending changes from localStorage
   * @returns {number} Number of changes restored
   */
  restoreFromLocalStorage() {
    if (typeof window === 'undefined') return 0;
    
    try {
      // Check for pending changes
      const changesKey = `triple_helix_pending_changes_${this.userId}`;
      const pendingChangesJson = localStorage.getItem(changesKey);
      
      if (pendingChangesJson) {
        const restoredChanges = JSON.parse(pendingChangesJson);
        
        if (Array.isArray(restoredChanges) && restoredChanges.length > 0) {
          this.pendingChanges = restoredChanges;
          this.log(`Restored ${restoredChanges.length} pending changes from localStorage`);
          return restoredChanges.length;
        }
      }
      
      // Check for full session state
      const sessionKey = `triple_helix_session_${this.userId}`;
      const sessionStateJson = localStorage.getItem(sessionKey);
      
      if (sessionStateJson) {
        const sessionState = JSON.parse(sessionStateJson);
        
        if (sessionState && sessionState.pendingChanges) {
          this.pendingChanges = sessionState.pendingChanges;
          this.completedStitches = sessionState.completedStitches || [];
          
          this.log(`Restored session state from localStorage with ${this.pendingChanges.length} pending changes`);
          return this.pendingChanges.length;
        }
      }
      
      return 0;
    } catch (error) {
      this.log('Error restoring from localStorage:', error);
      return 0;
    }
  }
  
  /**
   * Get session statistics
   * @returns {Object} Session statistics
   */
  getSessionStats() {
    const now = Date.now();
    return {
      userId: this.userId,
      sessionId: this.sessionId,
      isAuthenticated: this.isAuthenticated,
      sessionDuration: now - this.sessionStartTime,
      completedStitches: this.completedStitches.length,
      pendingChanges: this.pendingChanges.length,
      lastPersistenceTime: this.lastPersistenceTime,
      timeSinceLastPersistence: this.lastPersistenceTime ? now - this.lastPersistenceTime : null
    };
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    // Clear persistence interval
    if (this.persistenceIntervalId) {
      clearInterval(this.persistenceIntervalId);
      this.persistenceIntervalId = null;
    }
    
    // Final persistence
    if (this.pendingChanges.length > 0) {
      this.persistChanges().catch(err => {
        this.log('Error during cleanup persistence:', err);
      });
    }
    
    this.log('SessionManager cleaned up');
  }
  
  /**
   * Conditional logging based on debug flag
   * @private
   */
  log(...args) {
    if (this.debug) {
      console.log('[SessionManager]', ...args);
    }
  }
}

module.exports = SessionManager;