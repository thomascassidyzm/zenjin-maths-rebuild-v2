/**
 * Content Web Worker
 * 
 * This web worker manages content prefetching and processing in a separate thread,
 * ensuring smooth UI performance while handling large content sets.
 * 
 * Responsibilities:
 * - Prefetch content based on current position and likely navigation paths
 * - Process and normalize content data
 * - Cache content in IndexedDB
 * - Provide content to the main thread as needed
 */

let contentCache = new Map();
let prefetchQueue = [];
let isFetching = false;
let dbPromise = null;

// Content types and priorities
const CONTENT_TYPES = {
  STITCH: 'stitch',
  BATCH: 'batch',
  THREAD: 'thread'
};

const PRIORITY = {
  HIGH: 0,    // Current and immediately next content
  MEDIUM: 1,  // Likely to be needed soon
  LOW: 2      // Might be needed later
};

// Initialize IndexedDB
function initDB() {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('zenjin_content_db', 2);
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains('stitches')) {
        const stitchStore = db.createObjectStore('stitches', { keyPath: 'id' });
        stitchStore.createIndex('threadId', 'threadId', { unique: false });
        stitchStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('threads')) {
        const threadStore = db.createObjectStore('threads', { keyPath: 'id' });
        threadStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    };
    
    request.onsuccess = () => {
      console.log('[Content Worker] IndexedDB initialized');
      resolve(request.result);
    };
    
    request.onerror = () => {
      console.error('[Content Worker] IndexedDB initialization error', request.error);
      reject(request.error);
    };
  });
  
  return dbPromise;
}

// Store content in IndexedDB
async function storeInDB(type, data) {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      let storeName, content;
      
      switch (type) {
        case CONTENT_TYPES.STITCH:
          storeName = 'stitches';
          content = {
            ...data,
            timestamp: Date.now(),
            expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
          };
          break;
          
        case CONTENT_TYPES.THREAD:
          storeName = 'threads';
          content = {
            ...data,
            timestamp: Date.now(),
            expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
          };
          break;
          
        default:
          reject(new Error(`Unknown content type: ${type}`));
          return;
      }
      
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      
      const request = store.put(content);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error(`[Content Worker] Error storing ${type} in IndexedDB:`, error);
    return false;
  }
}

// Retrieve content from IndexedDB
async function getFromDB(type, id) {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      let storeName;
      
      switch (type) {
        case CONTENT_TYPES.STITCH:
          storeName = 'stitches';
          break;
          
        case CONTENT_TYPES.THREAD:
          storeName = 'threads';
          break;
          
        default:
          reject(new Error(`Unknown content type: ${type}`));
          return;
      }
      
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      
      const request = store.get(id);
      
      request.onsuccess = () => {
        const content = request.result;
        
        if (content && (!content.expires || content.expires > Date.now())) {
          resolve(content);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error(`[Content Worker] Error retrieving ${type} from IndexedDB:`, error);
    return null;
  }
}

// Fetch stitch content from API
async function fetchStitch(stitchId) {
  try {
    // Check cache first
    if (contentCache.has(stitchId)) {
      return contentCache.get(stitchId);
    }
    
    // Check IndexedDB
    const cachedStitch = await getFromDB(CONTENT_TYPES.STITCH, stitchId);
    if (cachedStitch) {
      contentCache.set(stitchId, cachedStitch);
      return cachedStitch;
    }
    
    // Fetch from API
    const response = await fetch(`/api/content/stitch/${stitchId}`);
    if (!response.ok) {
      throw new Error(`Error fetching stitch ${stitchId}: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.stitch) {
      throw new Error(`API error fetching stitch ${stitchId}: ${data.error || 'Unknown error'}`);
    }
    
    // Process and normalize the data
    const stitch = processStitch(data.stitch);
    
    // Store in cache and IndexedDB
    contentCache.set(stitchId, stitch);
    await storeInDB(CONTENT_TYPES.STITCH, stitch);
    
    return stitch;
  } catch (error) {
    console.error(`[Content Worker] Error fetching stitch ${stitchId}:`, error);
    throw error;
  }
}

// Fetch multiple stitches in batch
async function fetchStitchBatch(stitchIds) {
  try {
    // Filter out stitches already in cache
    const missingIds = stitchIds.filter(id => !contentCache.has(id));
    
    if (missingIds.length === 0) {
      // All requested stitches are in cache
      return stitchIds.map(id => contentCache.get(id));
    }
    
    // Fetch missing stitches from API
    const response = await fetch('/api/content/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ stitchIds: missingIds })
    });
    
    if (!response.ok) {
      throw new Error(`Error fetching batch: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.stitches) {
      throw new Error(`API error fetching batch: ${data.error || 'Unknown error'}`);
    }
    
    // Process and store each stitch
    const fetchedStitches = data.stitches;
    for (const stitch of fetchedStitches) {
      const processedStitch = processStitch(stitch);
      contentCache.set(stitch.id, processedStitch);
      await storeInDB(CONTENT_TYPES.STITCH, processedStitch);
    }
    
    // Return all requested stitches (from cache and newly fetched)
    return stitchIds.map(id => contentCache.get(id) || null);
  } catch (error) {
    console.error('[Content Worker] Error fetching batch:', error);
    throw error;
  }
}

// Process stitch data for consistency and normalization
function processStitch(stitch) {
  // Ensure questions array exists
  if (!stitch.questions) {
    stitch.questions = [];
  }
  
  // Normalize each question
  stitch.questions = stitch.questions.map(question => {
    return {
      ...question,
      // Ensure distractors object exists with all levels
      distractors: {
        L1: question.distractors?.L1 || '',
        L2: question.distractors?.L2 || '',
        L3: question.distractors?.L3 || ''
      }
    };
  });
  
  // Ensure required properties
  return {
    ...stitch,
    orderNumber: stitch.orderNumber || 0,
    skipNumber: stitch.skipNumber || 3,
    distractorLevel: stitch.distractorLevel || 'L1'
  };
}

// Process thread data for consistency and normalization
function processThread(thread) {
  return {
    ...thread,
    // Ensure stitches array exists
    stitches: thread.stitches || []
  };
}

// Add stitches to prefetch queue
function queueStitchesForPrefetch(stitchIds, priority = PRIORITY.MEDIUM) {
  // Filter out already cached stitches and duplicates in the queue
  const existingIds = new Set([
    ...Array.from(contentCache.keys()),
    ...prefetchQueue.map(item => item.id)
  ]);
  
  const newIds = stitchIds.filter(id => !existingIds.has(id));
  
  // Add new items to the queue with the specified priority
  const queueItems = newIds.map(id => ({
    type: CONTENT_TYPES.STITCH,
    id,
    priority
  }));
  
  prefetchQueue.push(...queueItems);
  
  // Sort queue by priority
  prefetchQueue.sort((a, b) => a.priority - b.priority);
  
  // Start processing the queue if not already in progress
  if (!isFetching) {
    processPrefetchQueue();
  }
}

// Process the prefetch queue
async function processPrefetchQueue() {
  if (prefetchQueue.length === 0 || isFetching) {
    return;
  }
  
  isFetching = true;
  
  try {
    // Take a smaller batch size and limit overall queue size 
    // to avoid memory and network exhaustion
    const MAX_QUEUE_SIZE = 10; // Limit total pending items
    const BATCH_SIZE = 2; // Process fewer items at once
    
    // Trim queue to prevent overflow
    if (prefetchQueue.length > MAX_QUEUE_SIZE) {
      console.log(`[Content Worker] Trimming prefetch queue from ${prefetchQueue.length} to ${MAX_QUEUE_SIZE} items`);
      prefetchQueue.length = MAX_QUEUE_SIZE;
    }
    
    // Take a small batch
    const batch = prefetchQueue.splice(0, BATCH_SIZE);
    
    // Group by type
    const stitchIds = batch
      .filter(item => item.type === CONTENT_TYPES.STITCH)
      .map(item => item.id);
    
    // Fetch stitches in batch if there are any, with longer delay
    if (stitchIds.length > 0) {
      // Add longer delay to prevent too many concurrent requests
      await new Promise(resolve => setTimeout(resolve, 300));
      await fetchStitchBatch(stitchIds);
    }
    
    // Process remaining items individually with a delay between each
    for (const item of batch.filter(item => item.type !== CONTENT_TYPES.STITCH)) {
      try {
        // Add longer delay between processing items
        await new Promise(resolve => setTimeout(resolve, 200));
        
        switch (item.type) {
          case CONTENT_TYPES.THREAD:
            // Thread fetching logic would go here
            break;
            
          default:
            console.warn(`[Content Worker] Unknown prefetch item type: ${item.type}`);
        }
      } catch (error) {
        console.error(`[Content Worker] Error processing prefetch item:`, error);
        // Continue with next item
      }
    }
  } catch (error) {
    console.error('[Content Worker] Error processing prefetch queue:', error);
  } finally {
    isFetching = false;
    
    // If there are more items in the queue, continue processing after a longer delay
    if (prefetchQueue.length > 0) {
      setTimeout(() => processPrefetchQueue(), 500);
    }
  }
}

// Clean up expired content
async function cleanupExpiredContent() {
  try {
    const db = await initDB();
    
    // Clean up stitches
    await cleanupStore(db, 'stitches');
    
    // Clean up threads
    await cleanupStore(db, 'threads');
    
    // Also clean up the in-memory cache (using a more aggressive LRU approach)
    if (contentCache.size > 100) { // Even more reduced limit (from 200 to 100)
      // Convert to array to sort
      const entries = Array.from(contentCache.entries());
      
      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 80% of entries to be much more aggressive about cleanup
      const deleteCount = Math.floor(entries.length * 0.8);
      for (let i = 0; i < deleteCount && i < entries.length; i++) {
        contentCache.delete(entries[i][0]);
      }
      
      console.log(`[Content Worker] Memory cache cleanup: removed ${deleteCount} entries, ${contentCache.size} remaining`);
    }
    
    // Actively garbage collect if possible
    if (typeof self.gc === 'function') {
      try {
        self.gc();
        console.log('[Content Worker] Manual garbage collection triggered');
      } catch (gcError) {
        console.log('[Content Worker] Manual garbage collection not available');
      }
    }
    
    console.log('[Content Worker] Cleanup completed');
  } catch (error) {
    console.error('[Content Worker] Error during cleanup:', error);
  }
}

// Clean up an individual store
async function cleanupStore(db, storeName) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      
      // Get all entries
      const index = store.index('timestamp');
      const request = index.openCursor();
      const now = Date.now();
      let deletedCount = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (cursor) {
          const entry = cursor.value;
          
          // Delete expired entries
          if (entry.expires && entry.expires < now) {
            store.delete(entry.id);
            deletedCount++;
          }
          
          cursor.continue();
        } else {
          console.log(`[Content Worker] Cleaned up ${deletedCount} expired entries from ${storeName}`);
          resolve(deletedCount);
        }
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

// Message event handler
self.onmessage = async (event) => {
  const { action, data, id } = event.data;
  
  try {
    let result;
    
    switch (action) {
      case 'FETCH_STITCH':
        result = await fetchStitch(data.stitchId);
        break;
        
      case 'FETCH_BATCH':
        result = await fetchStitchBatch(data.stitchIds);
        break;
        
      case 'PREFETCH':
        queueStitchesForPrefetch(data.stitchIds, data.priority);
        result = { queued: true, count: data.stitchIds.length };
        break;
        
      case 'CLEANUP':
        await cleanupExpiredContent();
        result = { cleaned: true };
        break;
        
      case 'CACHE_STATUS':
        result = {
          cacheSize: contentCache.size,
          queueLength: prefetchQueue.length,
          isFetching
        };
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Send the result back to the main thread
    self.postMessage({
      id,
      success: true,
      result
    });
  } catch (error) {
    // Send the error back to the main thread
    self.postMessage({
      id,
      success: false,
      error: error.message
    });
  }
};

// Initialize the worker
initDB().then(() => {
  console.log('[Content Worker] Ready');
  
  // Set up periodic cleanup (every 15 minutes instead of every hour)
  setInterval(cleanupExpiredContent, 15 * 60 * 1000);
  
  // Run an initial cleanup after 30 seconds to clear any old data
  setTimeout(cleanupExpiredContent, 30 * 1000);
});