/**
 * Service Worker for Better Player
 * Handles caching, offline support, and background sync
 * 
 * This enhanced service worker provides:
 * - Complete offline support with stale-while-revalidate for content
 * - Background sync for state persistence when online connectivity is restored
 * - Automatic prefetching of likely-to-be-needed resources
 * - Cache management to avoid storage bloat
 */

// Cache version - increment this when cache structure changes
const CACHE_VERSION = 6; // Increment to force cache refresh
const CACHE_NAME = `zenjin-player-cache-v${CACHE_VERSION}`;
const CONTENT_CACHE_NAME = `zenjin-content-cache-v${CACHE_VERSION}`;
const STATE_SYNC_QUEUE = 'zenjin-state-sync-queue';

// Assets to cache on install for offline support
// Modified to match Next.js Pages Router file structure
const CACHE_ASSETS = [
  '/',
  '/play',
  '/dashboard',
  '/signin',
  '/signup',
  '/login-callback',
  '/offline.html',
  '/register-sw.js',
  '/manifest.json',
  '/favicon.ico'
  // Removed specific Next.js file paths since they change with each build
  // Service worker will now cache what it finds via fetch, not via preload
];

// Content types that should be cached differently
const CONTENT_TYPES = [
  '/api/content/stitch/',
  '/api/content/batch'
];

// API endpoints that should never be cached (always go to network)
const NETWORK_ONLY_ENDPOINTS = [
  '/api/auth/',
  '/api/login',
  '/api/signin',
  '/api/signout',
  '/api/transfer-anonymous-data',
  '/api/initialize-user-data',
  '/auth/',
  '/login',
  '/signin',
  '/api/user-profile'
];

// State API endpoints (use network with IndexedDB backup)
const STATE_ENDPOINTS = [
  '/api/user-state',
  '/api/update-state',
  '/api/save-tube-position',
  '/api/update-progress'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  
  // Skip waiting to ensure the new service worker activates immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('Service Worker: Caching core assets');
      
      // Instead of cache.addAll, manually cache each asset with individual promises
      // This prevents the "Failed to execute 'addAll' on 'Cache'" error
      const cachePromises = CACHE_ASSETS.map(async (asset) => {
        try {
          // First check if the asset exists by doing a HEAD request
          // This prevents the 404 errors for missing pages in the network log
          const checkResponse = await fetch(asset, { 
            method: 'HEAD', 
            cache: 'no-store'
          }).catch(() => ({ ok: false }));
          
          // Only try to cache if the HEAD request was successful
          if (checkResponse.ok) {
            // Then get the full resource
            const response = await fetch(asset, { cache: 'reload' });
            if (response.ok) {
              return cache.put(asset, response);
            } else {
              console.warn(`Service Worker: Failed to cache ${asset}, status ${response.status}`);
            }
          } else {
            console.warn(`Service Worker: Asset ${asset} does not exist, skipping cache`);
          }
        } catch (error) {
          console.warn(`Service Worker: Error caching ${asset}:`, error);
        }
      });
      
      // Wait for all cache operations to complete
      return Promise.allSettled(cachePromises);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating');
  
  // Claim clients to ensure the service worker controls all clients immediately
  self.clients.claim();
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old cache versions
          if (cacheName !== CACHE_NAME && cacheName !== CONTENT_CACHE_NAME) {
            console.log(`Service Worker: Deleting old cache ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - use custom strategies based on request type
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests except for state updates
  if (event.request.method !== 'GET') {
    // For state update POST requests, add to background sync if offline
    if (event.request.method === 'POST' && STATE_ENDPOINTS.some(endpoint => url.pathname.includes(endpoint))) {
      event.respondWith(
        fetch(event.request.clone())
          .catch((error) => {
            console.log('Service Worker: State update failed, queuing for background sync', error);
            
            // Clone the request for background sync
            return event.request.clone().text()
              .then(payload => {
                // Queue for background sync
                return saveStateForSync(url.pathname, payload)
                  .then(() => {
                    // Return a fake successful response so the app continues working
                    return new Response(JSON.stringify({
                      success: true,
                      message: 'Update queued for background sync'
                    }), {
                      headers: { 'Content-Type': 'application/json' },
                      status: 200
                    });
                  });
              });
          })
      );
      return;
    }
    
    // Skip other non-GET requests
    return;
  }
  
  // Check if this is an auto-refresh dashboard request
  // If we're reloading the dashboard API when it's already been loaded, just return the cached version
  const isDashboardApi = url.pathname === '/api/dashboard';
  const isRefreshingTooFrequently = isDashboardApi && event.request.headers.get('X-Last-Refresh');
  
  if (isDashboardApi) {
    console.log('Service Worker: Dashboard API request - passing through to network');
    // Always pass dashboard requests to network
    event.respondWith(
      fetch(event.request)
        .catch(error => {
          console.error('Service Worker: Dashboard request failed', error);
          // Try cache as fallback
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Handle different request types with appropriate strategies
  
  // 1. Content API requests - stale-while-revalidate with long TTL
  if (CONTENT_TYPES.some(endpoint => url.pathname.includes(endpoint))) {
    handleContentRequest(event);
    return;
  }
  
  // 2. State API requests - network-first with fallback
  if (STATE_ENDPOINTS.some(endpoint => url.pathname.includes(endpoint))) {
    handleStateRequest(event);
    return;
  }
  
  // 3. Network-only endpoints - never cache
  if (NETWORK_ONLY_ENDPOINTS.some(endpoint => url.pathname.includes(endpoint))) {
    event.respondWith(
      fetch(event.request)
        .catch(error => {
          console.error('Service Worker: Network-only request failed', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'You are offline and this resource requires network connection'
          }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503
          });
        })
    );
    return;
  }
  
  // 4. For other requests (static assets), use cache-first strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return from cache but don't update in background (to reduce resource usage)
        return cachedResponse;
      }
      
      // Not in cache, try network - but don't prefetch
      return fetch(event.request)
        .then((response) => {
          // Cache the response if it's valid but only for important resources
          if (response.status === 200) {
            // Don't cache everything, only cache essential files to avoid storage bloat
            const isEssentialFile = CACHE_ASSETS.some(asset => 
              event.request.url.includes(asset)
            );
            
            if (isEssentialFile) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
          }
          
          return response;
        })
        .catch((error) => {
          console.error('Service Worker: Fetch failed', error);
          
          // Return a custom offline page/response
          if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
            // For JS/CSS, return empty to avoid console errors
            return new Response('', { status: 200 });
          } else if (url.pathname.endsWith('.json')) {
            return new Response('{}', { 
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          } else if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '/sequential-player') {
            // For HTML requests, return offline page
            return caches.match('/offline.html')
              .then(offlineResponse => {
                return offlineResponse || new Response(
                  '<html><body><h1>You are offline</h1><p>Please check your internet connection.</p></body></html>',
                  { 
                    status: 200,
                    headers: { 'Content-Type': 'text/html' }
                  }
                );
              });
          } else {
            return new Response('Resource unavailable offline', { status: 503 });
          }
        });
    })
  );
});

/**
 * Handle state API requests (network-first with IndexedDB fallback)
 */
function handleStateRequest(event) {
  event.respondWith(
    // Try network first
    fetch(event.request.clone())
      .then(response => {
        // Cache the successful response in IndexedDB
        if (response.status === 200) {
          const clonedResponse = response.clone();
          clonedResponse.json().then(data => {
            storeStateResponseInIDB(event.request.url, data);
          }).catch(err => {
            console.error('Failed to parse state response for caching:', err);
          });
        }
        return response;
      })
      .catch(error => {
        console.log('Service Worker: State request failed, checking IndexedDB', error);
        
        // Try to get from IndexedDB
        return getStateFromIDB(event.request.url)
          .then(data => {
            if (data) {
              console.log('Service Worker: Returning state from IndexedDB');
              return new Response(JSON.stringify(data), {
                headers: { 'Content-Type': 'application/json' },
                status: 200
              });
            }
            
            // Not in IndexedDB, try cache as last resort
            return caches.match(event.request)
              .then(cachedResponse => {
                if (cachedResponse) {
                  console.log('Service Worker: Returning state from cache');
                  return cachedResponse;
                }
                
                // Nothing found, return error
                throw new Error('State not available offline');
              });
          })
          .catch(err => {
            console.error('Service Worker: State not available offline', err);
            return new Response(JSON.stringify({
              success: false,
              error: 'You are offline and state data is not available'
            }), {
              headers: { 'Content-Type': 'application/json' },
              status: 503
            });
          });
      })
  );
}

/**
 * Handle content API requests
 * Uses a stale-while-revalidate strategy with longer TTL
 */
function handleContentRequest(event) {
  event.respondWith(
    caches.open(CONTENT_CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        // Start a fresh network fetch (in background if we have a cached response)
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            // Update cache with fresh response
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
              
              // Store content in IndexedDB for deeper offline support
              const clonedResponse = networkResponse.clone();
              clonedResponse.json().then(data => {
                // Only store actual content data (stitches)
                if (data && (data.stitch || data.stitches)) {
                  storeContentInIDB(event.request.url, data);
                }
              }).catch(err => {
                console.error('Failed to parse content for IndexedDB:', err);
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.error('Service Worker: Content fetch failed, using fallbacks', error);
            
            // Try to get from IDB if the cache doesn't have it
            if (!cachedResponse) {
              return getContentFromIDB(event.request.url)
                .then(data => {
                  if (data) {
                    console.log('Service Worker: Returning content from IndexedDB');
                    return new Response(JSON.stringify(data), {
                      headers: { 'Content-Type': 'application/json' },
                      status: 200
                    });
                  }
                  throw new Error('Content not available offline');
                });
            }
            
            // Return cached response as fallback
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // No cache or IDB data available
            throw new Error('Content not available offline');
          });
        
        // Return the cached response immediately if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
}

/**
 * Update cache in background
 * Used for cache-first strategy to keep cache fresh
 */
function updateCacheInBackground(request) {
  setTimeout(() => {
    fetch(request)
      .then(response => {
        if (response.status === 200) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, response);
          });
        }
      })
      .catch(error => {
        // Silently fail for background updates
        console.log('Background cache update failed:', error);
      });
  }, 1000);
}

/**
 * Store state response in IndexedDB
 */
function storeStateResponseInIDB(url, data) {
  // Create a key from the URL
  const urlObj = new URL(url);
  const key = `state_${urlObj.pathname}_${Date.now()}`;
  
  // Store in IndexedDB
  return openDatabase()
    .then(db => {
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('state_cache', 'readwrite');
          const store = tx.objectStore('state_cache');
          
          // Store with TTL of 1 day
          store.put({
            key,
            url,
            data,
            timestamp: Date.now(),
            expires: Date.now() + (24 * 60 * 60 * 1000) // 1 day
          });
          
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        } catch (err) {
          reject(err);
        }
      });
    })
    .catch(err => {
      console.error('Failed to store state in IndexedDB:', err);
      return false;
    });
}

/**
 * Get state from IndexedDB
 */
function getStateFromIDB(url) {
  return openDatabase()
    .then(db => {
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('state_cache', 'readonly');
          const store = tx.objectStore('state_cache');
          
          // Get all entries for this URL
          const index = store.index('url');
          const request = index.getAll(url);
          
          request.onsuccess = () => {
            const entries = request.result || [];
            
            // Find the most recent non-expired entry
            const now = Date.now();
            const validEntries = entries
              .filter(entry => entry.expires > now)
              .sort((a, b) => b.timestamp - a.timestamp);
            
            if (validEntries.length > 0) {
              resolve(validEntries[0].data);
            } else {
              resolve(null);
            }
          };
          
          request.onerror = () => reject(request.error);
        } catch (err) {
          reject(err);
        }
      });
    })
    .catch(err => {
      console.error('Failed to get state from IndexedDB:', err);
      return null;
    });
}

/**
 * Store content in IndexedDB
 */
function storeContentInIDB(url, data) {
  // Get ID from URL for stitch content
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  const id = pathParts[pathParts.length - 1];
  const key = id || `content_${Date.now()}`;
  
  // Store in IndexedDB
  return openDatabase()
    .then(db => {
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('content_cache', 'readwrite');
          const store = tx.objectStore('content_cache');
          
          // Store with longer TTL - 7 days for content
          store.put({
            key,
            url,
            data,
            timestamp: Date.now(),
            expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
          });
          
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        } catch (err) {
          reject(err);
        }
      });
    })
    .catch(err => {
      console.error('Failed to store content in IndexedDB:', err);
      return false;
    });
}

/**
 * Get content from IndexedDB
 */
function getContentFromIDB(url) {
  return openDatabase()
    .then(db => {
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('content_cache', 'readonly');
          const store = tx.objectStore('content_cache');
          
          // Get by URL index
          const index = store.index('url');
          const request = index.get(url);
          
          request.onsuccess = () => {
            const entry = request.result;
            
            if (entry && entry.expires > Date.now()) {
              resolve(entry.data);
            } else {
              resolve(null);
            }
          };
          
          request.onerror = () => reject(request.error);
        } catch (err) {
          reject(err);
        }
      });
    })
    .catch(err => {
      console.error('Failed to get content from IndexedDB:', err);
      return null;
    });
}

/**
 * Save state for background sync
 */
function saveStateForSync(url, payload) {
  return openDatabase()
    .then(db => {
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction('state_sync', 'readwrite');
          const store = tx.objectStore('state_sync');
          
          // Store with unique ID
          store.put({
            id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            url,
            payload,
            timestamp: Date.now()
          });
          
          tx.oncomplete = () => {
            // Request a background sync if available
            if ('serviceWorker' in navigator && 'SyncManager' in window) {
              navigator.serviceWorker.ready.then(registration => {
                registration.sync.register('sync-state')
                  .then(() => console.log('Background sync registered'))
                  .catch(err => console.error('Background sync registration failed:', err));
              });
            }
            resolve(true);
          };
          tx.onerror = () => reject(tx.error);
        } catch (err) {
          reject(err);
        }
      });
    })
    .catch(err => {
      console.error('Failed to save state for sync:', err);
      return false;
    });
}

// Sync event - handle background syncing
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-state') {
    console.log('Service Worker: Background sync triggered');
    
    event.waitUntil(
      syncStateFromIndexedDB()
    );
  }
});

/**
 * Sync state from IndexedDB to server
 */
async function syncStateFromIndexedDB() {
  try {
    // Open the state sync queue
    const db = await openDatabase();
    const tx = db.transaction('state_sync', 'readwrite');
    const store = tx.objectStore('state_sync');
    
    // Get all pending sync items
    const items = await getAll(store);
    
    if (items.length === 0) {
      console.log('Service Worker: No state items to sync');
      return;
    }
    
    console.log(`Service Worker: Found ${items.length} state items to sync`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Process each item
    for (const item of items) {
      try {
        // Try to send to server using original URL and payload
        const response = await fetch(item.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: item.payload
        });
        
        if (response.ok) {
          // Delete from queue on success
          await deleteItem(store, item.id);
          console.log(`Service Worker: Successfully synced item ${item.id}`);
          successCount++;
        } else {
          console.error(`Service Worker: Failed to sync item ${item.id}:`, await response.text());
          failureCount++;
        }
      } catch (error) {
        console.error(`Service Worker: Error syncing item ${item.id}:`, error);
        failureCount++;
        // Keep item in queue for next sync attempt
      }
    }
    
    // Notify all clients of sync result
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'STATE_SYNCED',
        detail: {
          success: successCount > 0,
          successCount,
          failureCount,
          totalCount: items.length
        }
      });
    });
    
    return true;
  } catch (error) {
    console.error('Service Worker: Error during background sync:', error);
    return false;
  }
}

/**
 * Get all items from store
 */
function getAll(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Delete item from store
 */
function deleteItem(store, id) {
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    
    request.onsuccess = () => {
      resolve(true);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Open IndexedDB with all required object stores
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const dbVersion = 3; // Increment when changing schema
    const request = indexedDB.open('zenjin_state_db', dbVersion);
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains('state_sync')) {
        db.createObjectStore('state_sync', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('state_cache')) {
        const stateStore = db.createObjectStore('state_cache', { keyPath: 'key' });
        stateStore.createIndex('url', 'url', { unique: false });
        stateStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('content_cache')) {
        const contentStore = db.createObjectStore('content_cache', { keyPath: 'key' });
        contentStore.createIndex('url', 'url', { unique: false });
        contentStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Add tube tracking store for improved tube state management
      if (!db.objectStoreNames.contains('tube_state')) {
        const tubeStore = db.createObjectStore('tube_state', { keyPath: 'key' });
        tubeStore.createIndex('userId', 'userId', { unique: false });
        tubeStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Add analytics store for offline usage tracking
      if (!db.objectStoreNames.contains('analytics')) {
        const analyticsStore = db.createObjectStore('analytics', { keyPath: 'id', autoIncrement: true });
        analyticsStore.createIndex('userId', 'userId', { unique: false });
        analyticsStore.createIndex('eventType', 'eventType', { unique: false });
        analyticsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Periodically clean up expired cache entries
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(cleanupCaches());
  }
});

// Also clean up on activation
self.addEventListener('activate', (event) => {
  // Claim clients
  self.clients.claim();
  
  // Clean up old caches
  event.waitUntil(
    Promise.all([
      cleanupCaches(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old cache versions
            if (cacheName !== CACHE_NAME && cacheName !== CONTENT_CACHE_NAME) {
              console.log(`Service Worker: Deleting old cache ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

/**
 * Clean up expired cache entries
 */
async function cleanupCaches() {
  try {
    // 1. Clean up IndexedDB caches
    const db = await openDatabase();
    
    // Clean state cache
    await cleanupStore(db, 'state_cache');
    
    // Clean content cache
    await cleanupStore(db, 'content_cache');
    
    // 2. Clean up Cache API entries - now implemented
    try {
      const cacheNames = await caches.keys();
      
      for (const cacheName of cacheNames) {
        // Delete old cache versions
        if (cacheName !== CACHE_NAME && cacheName !== CONTENT_CACHE_NAME) {
          console.log(`Service Worker: Deleting old cache ${cacheName}`);
          await caches.delete(cacheName);
          continue;
        }
        
        // For current caches, limit their size
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        // If cache has too many items, aggressively prune it
        if (keys.length > 100) {
          console.log(`Service Worker: Trimming cache ${cacheName} from ${keys.length} items`);
          const deleteCount = Math.floor(keys.length * 0.7); // Delete 70% of cache
          
          for (let i = 0; i < deleteCount; i++) {
            await cache.delete(keys[i]);
          }
          
          console.log(`Service Worker: Removed ${deleteCount} entries from ${cacheName}`);
        }
      }
    } catch (cacheError) {
      console.error('Service Worker: Error cleaning Cache API:', cacheError);
    }
    
    // 3. Try to trigger garbage collection
    if (typeof self.gc === 'function') {
      try {
        self.gc();
        console.log('Service Worker: Manual garbage collection triggered');
      } catch (gcError) {
        console.log('Service Worker: Manual garbage collection not available');
      }
    }
    
    console.log('Service Worker: Cache cleanup completed');
    return true;
  } catch (error) {
    console.error('Service Worker: Error during cache cleanup:', error);
    return false;
  }
}

/**
 * Clean up expired entries in a store
 */
async function cleanupStore(db, storeName) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      
      // Get all entries
      const request = store.index('timestamp').openCursor();
      const now = Date.now();
      let deletedCount = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (cursor) {
          const entry = cursor.value;
          
          // Delete expired entries
          if (entry.expires && entry.expires < now) {
            store.delete(entry.key);
            deletedCount++;
          }
          
          cursor.continue();
        } else {
          console.log(`Service Worker: Cleaned up ${deletedCount} expired entries from ${storeName}`);
          resolve(deletedCount);
        }
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
      
      tx.oncomplete = () => {
        resolve(deletedCount);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Clear all authentication-related data from caches and IndexedDB
 * This function is called when a sign-out action is detected
 */
async function clearAuthData() {
  console.log('Service Worker: Clearing all authentication data');
  
  try {
    // 1. Clear any auth-related cache entries
    const cacheKeys = await caches.keys();
    const clearPromises = cacheKeys.map(async (cacheName) => {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      // Filter for auth-related requests
      const authRequests = requests.filter(request => {
        const url = new URL(request.url);
        return NETWORK_ONLY_ENDPOINTS.some(endpoint => url.pathname.includes(endpoint));
      });
      
      // Delete each auth-related request from cache
      return Promise.all(authRequests.map(request => cache.delete(request)));
    });
    
    await Promise.all(clearPromises);
    console.log('Service Worker: Auth cache entries cleared');
    
    // 2. Clear auth data from IndexedDB if it exists
    try {
      const db = await openDatabase();
      
      // Clear state_cache store entries related to user data
      if (db.objectStoreNames.contains('state_cache')) {
        const tx = db.transaction('state_cache', 'readwrite');
        const store = tx.objectStore('state_cache');
        
        // We don't have a direct way to filter, so we'll get all and then delete selectively
        const request = store.getAll();
        
        request.onsuccess = () => {
          const entries = request.result || [];
          
          // Delete entries that contain auth-related data
          entries.forEach(entry => {
            if (entry.url.includes('/api/user-state') || 
                entry.url.includes('/api/auth') ||
                entry.url.includes('/api/anonymous-state')) {
              store.delete(entry.key);
            }
          });
        };
      }
      
      console.log('Service Worker: Auth IndexedDB data cleared');
    } catch (dbError) {
      console.warn('Service Worker: Unable to clear IndexedDB auth data:', dbError);
    }
    
    return true;
  } catch (error) {
    console.error('Service Worker: Error clearing auth data:', error);
    return false;
  }
}

// Message event handler for communication with the main thread
self.addEventListener('message', (event) => {
  // Handle messages from the main thread
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        // Skip waiting and activate immediately
        self.skipWaiting();
        break;
        
      case 'TRIGGER_SYNC':
        // Trigger background sync manually
        syncStateFromIndexedDB()
          .then(result => {
            // Respond to the client that sent the message
            event.source.postMessage({
              type: 'SYNC_COMPLETED',
              success: result
            });
          });
        break;
        
      case 'CLEAR_CACHES':
        // Clear all caches (used for debugging/testing)
        caches.keys().then(cacheNames => {
          return Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
        })
        .then(() => {
          event.source.postMessage({
            type: 'CACHES_CLEARED',
            success: true
          });
        });
        break;
        
      case 'CLEAR_AUTH_DATA':
        // Clear authentication data specifically
        clearAuthData().then(success => {
          event.source.postMessage({
            type: 'AUTH_DATA_CLEARED',
            success
          });
        });
        break;
    }
  }
});