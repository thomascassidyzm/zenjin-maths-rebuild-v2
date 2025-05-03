/**
 * Enhanced Content Manager
 * 
 * Handles loading and caching of stitch content using a web worker for better performance
 * Provides a clean interface for components to access content
 */
import { StitchContent, Question } from '../state/types';

/**
 * ContentManager class
 * Manages stitch content loading and caching
 */
export class ContentManager {
  private worker: Worker | null = null;
  private cache: Map<string, StitchContent> = new Map();
  private callbackMap: Map<string, { resolve: Function, reject: Function }> = new Map();
  private workerReady: boolean = false;
  private workerInitPromise: Promise<void>;
  private messageIdCounter: number = 0;
  
  constructor() {
    // Initialize the web worker if available
    this.workerInitPromise = this.initWorker();
    
    // Fallback cache in case worker isn't available
    this.cache = new Map();
  }
  
  /**
   * Initialize the web worker
   */
  private async initWorker(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.Worker) {
        console.log('Web Workers not supported, using fallback mode');
        this.workerReady = false;
        resolve();
        return;
      }
      
      try {
        this.worker = new Worker('/content-worker.js');
        
        // Set up message handler
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        
        // Set up error handler
        this.worker.onerror = (error) => {
          console.error('Content worker error:', error);
          this.workerReady = false;
          
          // Reject all pending callbacks
          this.callbackMap.forEach(({ reject }) => {
            reject(new Error('Content worker error'));
          });
          
          this.callbackMap.clear();
          
          // Continue without worker
          resolve();
        };
        
        // Worker is ready
        this.workerReady = true;
        resolve();
      } catch (error) {
        console.error('Error initializing content worker:', error);
        this.workerReady = false;
        resolve();
      }
    });
  }
  
  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const { id, success, result, error } = event.data;
    
    // Find the callback for this message
    const callback = this.callbackMap.get(id);
    if (!callback) {
      console.warn('No callback found for worker message:', id);
      return;
    }
    
    // Remove the callback from the map
    this.callbackMap.delete(id);
    
    // Call the appropriate callback
    if (success) {
      callback.resolve(result);
    } else {
      callback.reject(new Error(error));
    }
  }
  
  /**
   * Send a message to the worker
   */
  private async sendToWorker(action: string, data: any): Promise<any> {
    // Ensure worker is initialized
    await this.workerInitPromise;
    
    if (!this.workerReady || !this.worker) {
      throw new Error('Content worker not available');
    }
    
    // Generate a unique ID for this message
    const id = `${action}_${Date.now()}_${this.messageIdCounter++}`;
    
    // Create a promise that will be resolved when the worker responds
    const promise = new Promise((resolve, reject) => {
      this.callbackMap.set(id, { resolve, reject });
      
      // Set a timeout to prevent hanging if the worker doesn't respond
      setTimeout(() => {
        if (this.callbackMap.has(id)) {
          this.callbackMap.delete(id);
          reject(new Error('Worker request timed out'));
        }
      }, 30000); // 30 seconds timeout
    });
    
    // Send the message to the worker
    this.worker.postMessage({ action, data, id });
    
    return promise;
  }
  
  /**
   * Get a stitch by ID (from cache or API)
   */
  async getStitch(stitchId: string): Promise<StitchContent> {
    // First check the in-memory cache
    if (this.cache.has(stitchId)) {
      console.log(`Cache hit for stitch ${stitchId}`);
      return this.cache.get(stitchId)!;
    }
    
    // Need to fetch the stitch
    console.log(`Cache miss for stitch ${stitchId}, fetching`);
    
    try {
      let stitch: StitchContent;
      
      // Try to use the worker if available
      if (this.workerReady && this.worker) {
        // Fetch using the worker
        stitch = await this.sendToWorker('FETCH_STITCH', { stitchId });
      } else {
        // Fallback to direct fetch
        stitch = await this.fetchStitchDirect(stitchId);
      }
      
      // Add to cache
      this.cache.set(stitchId, stitch);
      
      return stitch;
    } catch (error) {
      console.error(`Error fetching stitch ${stitchId}:`, error);
      throw error;
    }
  }
  
  /**
   * Direct stitch fetch (fallback if worker isn't available)
   */
  private async fetchStitchDirect(stitchId: string): Promise<StitchContent> {
    // Fetch from API
    const response = await fetch(`/api/content/stitch/${stitchId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Error fetching stitch: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.stitch) {
      throw new Error(`API error: ${data.error || 'Failed to fetch stitch'}`);
    }
    
    return this.processStitch(data.stitch);
  }
  
  /**
   * Process stitch data for consistency
   */
  private processStitch(stitch: any): StitchContent {
    // Ensure required fields
    if (!stitch.questions) {
      stitch.questions = [];
    }
    
    // Process questions
    stitch.questions = stitch.questions.map((q: any) => ({
      id: q.id,
      stitchId: q.stitchId || stitch.id,
      text: q.text,
      correctAnswer: q.correctAnswer,
      distractors: {
        L1: q.distractors?.L1 || '',
        L2: q.distractors?.L2 || '',
        L3: q.distractors?.L3 || ''
      }
    }));
    
    return {
      id: stitch.id,
      threadId: stitch.threadId,
      name: stitch.name || stitch.id,
      description: stitch.description || '',
      orderNumber: stitch.orderNumber || 0,
      skipNumber: stitch.skipNumber || 3,
      distractorLevel: stitch.distractorLevel || 'L1',
      questions: stitch.questions
    };
  }
  
  /**
   * Prefetch multiple stitches in batch
   * @param stitchIds Array of stitch IDs to prefetch
   */
  async prefetchStitches(stitchIds: string[]): Promise<void> {
    // Filter out stitches already in cache
    const missingIds = stitchIds.filter(id => !this.cache.has(id));
    
    if (missingIds.length === 0) {
      return;
    }
    
    console.log(`Prefetching ${missingIds.length} stitches: ${missingIds.join(', ')}`);
    
    try {
      // Try to use the worker if available
      if (this.workerReady && this.worker) {
        // Queue for prefetching using the worker (high priority)
        await this.sendToWorker('PREFETCH', { 
          stitchIds: missingIds,
          priority: 0 // HIGH priority
        });
      } else {
        // Fallback to direct fetch
        await this.prefetchStitchesDirect(missingIds);
      }
    } catch (error) {
      console.error('Error prefetching stitches:', error);
    }
  }
  
  /**
   * Direct batch prefetch (fallback if worker isn't available)
   */
  private async prefetchStitchesDirect(stitchIds: string[]): Promise<void> {
    try {
      // Fetch in batch from API
      const response = await fetch('/api/content/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stitchIds }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Error batch fetching stitches: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.stitches) {
        throw new Error(`API error: ${data.error || 'Failed to fetch stitches'}`);
      }
      
      // Add to cache
      const stitches = data.stitches as any[];
      stitches.forEach(stitch => {
        const processedStitch = this.processStitch(stitch);
        this.cache.set(stitch.id, processedStitch);
      });
      
      console.log(`Successfully prefetched ${stitches.length} stitches`);
    } catch (error) {
      console.error('Error batch fetching stitches:', error);
      throw error;
    }
  }
  
  /**
   * Add stitches to prefetch queue (will be loaded when idle)
   */
  queueStitchesForPrefetch(stitchIds: string[]): void {
    // Filter out duplicates and already cached items
    const newIds = stitchIds.filter(id => !this.cache.has(id));
    
    if (newIds.length === 0) {
      return;
    }
    
    console.log(`Added ${newIds.length} stitches to prefetch queue`);
    
    // Queue using the worker if available (medium priority)
    if (this.workerReady && this.worker) {
      this.sendToWorker('PREFETCH', { 
        stitchIds: newIds,
        priority: 1 // MEDIUM priority
      }).catch(error => {
        console.error('Error queueing stitches for prefetch:', error);
      });
    } else {
      // Fallback to setTimeout
      setTimeout(() => this.prefetchStitchesDirect(newIds), 2000);
    }
  }
  
  /**
   * Get cache status (size, items, etc.)
   */
  async getCacheStatus(): Promise<any> {
    try {
      // Try to get status from worker if available
      if (this.workerReady && this.worker) {
        const workerStatus = await this.sendToWorker('CACHE_STATUS', {});
        
        return {
          ...workerStatus,
          memCacheSize: this.cache.size,
          workerAvailable: true
        };
      } else {
        // Fallback status
        return {
          cacheSize: this.cache.size,
          queueLength: 0,
          isFetching: false,
          memCacheSize: this.cache.size,
          workerAvailable: false
        };
      }
    } catch (error) {
      console.error('Error getting cache status:', error);
      
      return {
        error: error.message,
        memCacheSize: this.cache.size,
        workerAvailable: false
      };
    }
  }
  
  /**
   * Clear old content from cache to free up memory
   */
  async clearOldCache(): Promise<void> {
    console.log('Content cache cleanup requested');
    
    try {
      // Try to use the worker if available
      if (this.workerReady && this.worker) {
        await this.sendToWorker('CLEANUP', {});
      }
      
      // Clean up in-memory cache as well
      if (this.cache.size > 500) { // Arbitrary limit
        // Convert to array to sort if timestamps are available
        const entries = Array.from(this.cache.entries());
        
        // Just remove oldest 20% for now
        const toRemove = Math.floor(entries.length * 0.2);
        for (let i = 0; i < toRemove; i++) {
          this.cache.delete(entries[i][0]);
        }
        
        console.log(`Cleared ${toRemove} items from in-memory cache`);
      }
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }
  }
  
  /**
   * Shutdown the worker (for cleanup)
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerReady = false;
    }
    
    this.cache.clear();
    this.callbackMap.clear();
  }
}

// Export a singleton instance
export const contentManager = new ContentManager();