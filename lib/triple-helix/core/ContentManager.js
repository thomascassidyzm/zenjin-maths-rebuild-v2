/**
 * ContentManager.js - Handles preloading and caching of content
 * 
 * Manages content preloading and caching for smooth transitions:
 * - Prioritizes loading of active stitches
 * - Maintains a preload queue
 * - Ensures critical content is available when needed
 * - Optimizes network requests by avoiding redundant loads
 */

class ContentManager {
  /**
   * Create a new ContentManager
   * @param {Object} options - Configuration options
   * @param {number} options.prefetchCount - Number of stitches to prefetch per tube (default: 5)
   * @param {number} options.cacheExpiry - Cache expiry in milliseconds (default: 30 minutes)
   * @param {boolean} options.debug - Enable debug logging (default: false)
   */
  constructor(options = {}) {
    this.cache = new Map(); // Content cache
    this.preloadQueue = [];
    this.prefetchCount = options.prefetchCount || 5;
    this.cacheExpiry = options.cacheExpiry || 30 * 60 * 1000; // 30 minutes
    this.isPreloading = false;
    this.debug = options.debug || false;
    
    // Statistics
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalLoaded: 0
    };
    
    this.log('ContentManager initialized with prefetchCount:', this.prefetchCount);
  }
  
  /**
   * Preload content for one or more stitches
   * @param {Array|Object} stitches - Stitch(es) to preload
   * @param {boolean} highPriority - Whether to prioritize in queue
   * @returns {Promise} Promise that resolves when preloading starts
   */
  preloadStitches(stitches, highPriority = false) {
    // Handle single stitch or array
    const stitchArray = Array.isArray(stitches) ? stitches : [stitches];
    
    if (stitchArray.length === 0) return Promise.resolve();
    
    this.log(`Adding ${stitchArray.length} stitches to preload queue (priority: ${highPriority})`);
    
    // Add to queue based on priority
    if (highPriority) {
      // Add to front of queue for high priority items
      this.preloadQueue.unshift(...stitchArray);
    } else {
      // Add to end of queue for standard items
      this.preloadQueue.push(...stitchArray);
    }
    
    // Start processing queue
    return this.processPreloadQueue();
  }
  
  /**
   * Preload next stitches based on the StateMachine's prediction
   * @param {StateMachine} stateMachine - StateMachine instance
   * @param {number} count - Number of stitches to preload per tube
   * @returns {Promise} Promise that resolves when preloading starts
   */
  preloadNextStitches(stateMachine, count = 5) {
    if (!stateMachine) {
      this.log('ERROR: Cannot preload next stitches without StateMachine');
      return Promise.resolve();
    }
    
    const stitchesToPreload = stateMachine.getNextStitchesToPreload(count);
    this.log(`Preloading next ${stitchesToPreload.length} stitches`);
    
    return this.preloadStitches(stitchesToPreload);
  }
  
  /**
   * Process the preload queue
   * @returns {Promise} Promise that resolves when processing starts
   */
  async processPreloadQueue() {
    // If already processing, don't start again
    if (this.isPreloading) {
      return Promise.resolve();
    }
    
    this.isPreloading = true;
    
    // Deduplicate the queue (in case same stitch is in queue multiple times)
    this.preloadQueue = this._deduplicateQueue(this.preloadQueue);
    
    this.log(`Processing preload queue with ${this.preloadQueue.length} stitches`);
    
    // Start processing in background
    this._processQueueAsync();
    
    // Return resolved promise immediately (don't wait for all loading)
    return Promise.resolve();
  }
  
  /**
   * Process the queue asynchronously (doesn't block)
   * @private
   */
  async _processQueueAsync() {
    try {
      // Process in small batches to avoid blocking main thread
      const BATCH_SIZE = 3;
      
      while (this.preloadQueue.length > 0) {
        // Take a small batch from the queue
        const batch = this.preloadQueue.splice(0, BATCH_SIZE);
        
        // Load each stitch in the batch concurrently
        await Promise.allSettled(
          batch.map(stitch => this._loadStitchContent(stitch))
        );
        
        // Small delay to avoid blocking the main thread
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } catch (error) {
      this.log('Error processing preload queue:', error);
    } finally {
      this.isPreloading = false;
      this.log('Finished processing preload queue');
    }
  }
  
  /**
   * Deduplicate the queue based on stitch ID
   * @param {Array} queue - Queue to deduplicate
   * @returns {Array} Deduplicated queue
   * @private
   */
  _deduplicateQueue(queue) {
    const seen = new Set();
    return queue.filter(stitch => {
      if (!stitch || !stitch.id) return false;
      
      if (seen.has(stitch.id)) {
        return false;
      }
      
      seen.add(stitch.id);
      return true;
    });
  }
  
  /**
   * Get content for a stitch (from cache or load)
   * @param {string} stitchId - Stitch ID
   * @returns {Promise<Object>} Stitch content
   */
  async getStitchContent(stitchId) {
    if (!stitchId) {
      throw new Error('Stitch ID is required');
    }
    
    // Check cache first
    if (this.cache.has(stitchId)) {
      const cachedItem = this.cache.get(stitchId);
      
      // Check if cache entry is still valid
      if (Date.now() - cachedItem.timestamp < this.cacheExpiry) {
        this.stats.cacheHits++;
        this.log(`CACHE HIT: ${stitchId}`);
        return cachedItem.content;
      } else {
        this.log(`CACHE EXPIRED: ${stitchId}`);
      }
    }
    
    this.stats.cacheMisses++;
    this.log(`CACHE MISS: ${stitchId}`);
    
    // Not in cache or expired, load it
    try {
      const content = await this._loadStitchContent({ id: stitchId });
      return content;
    } catch (error) {
      this.log(`ERROR loading stitch ${stitchId}:`, error);
      throw error;
    }
  }
  
  /**
   * Load content for a stitch
   * @param {Object} stitch - Stitch object with ID
   * @returns {Promise<Object>} Loaded content
   * @private
   */
  async _loadStitchContent(stitch) {
    if (!stitch || !stitch.id) {
      throw new Error('Invalid stitch object');
    }
    
    const stitchId = stitch.id;
    
    // If already in cache and not expired, return cached version
    if (this.cache.has(stitchId)) {
      const cachedItem = this.cache.get(stitchId);
      
      if (Date.now() - cachedItem.timestamp < this.cacheExpiry) {
        return cachedItem.content;
      }
    }
    
    this.log(`Loading content for stitch: ${stitchId}`);
    
    try {
      // In a real implementation, this would call an API to load content
      // For now, simulate loading with a small delay
      const contentPromise = new Promise(resolve => {
        setTimeout(() => {
          // If stitch already has data, use it as content
          // Otherwise, create minimal placeholder content
          let content;
          
          if (stitch.questions && stitch.content) {
            // Use existing data from the stitch
            content = {
              id: stitch.id,
              threadId: stitch.threadId,
              content: stitch.content,
              questions: stitch.questions,
              loaded: true
            };
          } else {
            // Create minimal placeholder
            content = {
              id: stitchId,
              threadId: stitch.threadId || 'unknown',
              content: `Content for stitch ${stitchId}`,
              questions: [],
              loaded: true
            };
          }
          
          resolve(content);
        }, 100); // Simulate network delay
      });
      
      const content = await contentPromise;
      
      // Update cache
      this.cache.set(stitchId, {
        content,
        timestamp: Date.now()
      });
      
      this.stats.totalLoaded++;
      
      return content;
    } catch (error) {
      this.log(`Error loading stitch ${stitchId}:`, error);
      throw error;
    }
  }
  
  /**
   * Check if a stitch is already in the cache
   * @param {string} stitchId - Stitch ID
   * @returns {boolean} Whether the stitch is cached
   */
  isStitchCached(stitchId) {
    if (!stitchId) return false;
    
    if (!this.cache.has(stitchId)) {
      return false;
    }
    
    // Check if cache entry is expired
    const cachedItem = this.cache.get(stitchId);
    return Date.now() - cachedItem.timestamp < this.cacheExpiry;
  }
  
  /**
   * Clear the entire cache
   */
  clearCache() {
    this.log('Clearing content cache');
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const cacheItems = Array.from(this.cache.entries()).map(([id, item]) => ({
      id,
      age: Math.round((Date.now() - item.timestamp) / 1000), // Age in seconds
      expired: Date.now() - item.timestamp >= this.cacheExpiry
    }));
    
    return {
      size: this.cache.size,
      hits: this.stats.cacheHits,
      misses: this.stats.cacheMisses,
      totalLoaded: this.stats.totalLoaded,
      hitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses || 1),
      items: cacheItems
    };
  }
  
  /**
   * Conditional logging based on debug flag
   * @private
   */
  log(...args) {
    if (this.debug) {
      console.log('[ContentManager]', ...args);
    }
  }
}

module.exports = ContentManager;