/**
 * Service Worker Registration Script
 * 
 * This script is responsible for registering the service worker and handling
 * the registration lifecycle. It should be included in the main application.
 */

// Register the service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Check for existing service workers but don't automatically unregister them
    // This prevents reload loops and preserves existing functionality
    navigator.serviceWorker.getRegistrations().then(registrations => {
      console.log(`Found ${registrations.length} existing service worker registrations`);
      
      // Only unregister if specifically requested via URL parameter
      if (window.location.search.includes('reset_sw=true') && registrations.length > 0) {
        console.log('Unregistering service workers based on URL parameter');
        return Promise.all(
          registrations.map(registration => {
            console.log('Unregistering existing service worker');
            return registration.unregister();
          })
        );
      }
      return Promise.resolve();
    })
    .then(() => {
      // Only clear caches when explicitly requested
      if (window.location.search.includes('clear_cache=true')) {
        console.log('Clearing caches based on URL parameter');
        return caches.keys();
      } else {
        // Skip cache clearing to prevent reload loops
        return Promise.resolve([]);
      }
    })
    .then(cacheNames => {
      // Only clear caches if we actually got some cache names (from the URL parameter condition)
      if (cacheNames.length > 0) {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log(`Deleting cache: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
      }
      return Promise.resolve();
    })
    .then(() => {
      console.log('All caches cleared successfully');
      
      // Clear Supabase auth data from localStorage to prevent automatic sign-in
      // Only do this if specifically requested via URL parameter
      if (window.location.search.includes('clear_auth=true')) {
        console.log('Clearing auth data based on URL parameter');
        try {
          // Remove Supabase auth data - this forces re-authentication
          localStorage.removeItem('supabase.auth.token');
          localStorage.removeItem('supabase.auth.refreshToken');
          localStorage.removeItem('supabase.auth.event');
          localStorage.removeItem('supabase.auth.user');
          
          // Remove other potential auth-related keys
          const authKeys = Object.keys(localStorage).filter(key => 
            key.includes('auth') || key.includes('token') || key.includes('user')
          );
          
          authKeys.forEach(key => {
            localStorage.removeItem(key);
            console.log(`Removed localStorage key: ${key}`);
          });
          
          console.log('Auth data cleared successfully');
        } catch (error) {
          console.error('Error clearing auth data:', error);
        }
      }
      
      // Delay service worker registration to ensure previous cleanup is complete
      setTimeout(() => {
        // Register with a fresh cache version number to avoid conflicts
        const cacheBuster = Date.now();
        navigator.serviceWorker.register(`/service-worker.js?v=${cacheBuster}`, {
          scope: '/',
          // Don't update automatically to avoid unexpected behavior
          updateViaCache: 'none'
        })
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
          
          // Listen for updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            
            if (installingWorker) {
              // Set a timeout to prevent installation from hanging
              const installTimeout = setTimeout(() => {
                console.warn('Service worker installation taking too long, may be stuck');
                // Force a reload to recover
                window.location.reload();
              }, 20000); // 20 second timeout
              
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  // Clear the timeout since installation completed
                  clearTimeout(installTimeout);
                  
                  if (navigator.serviceWorker.controller) {
                    // New service worker is available
                    console.log('New service worker is available');
                    
                    // Don't show any notification to the user - this avoids disrupting the experience
                    // We'll just apply the update on the next page load instead
                    
                    // Log that we have a pending update that will be applied on next reload
                    console.log('Service worker update ready, will be applied on next navigation or reload');
                  } else {
                    // First time service worker installation
                    console.log('Service Worker installed for the first time');
                  }
                } else if (installingWorker.state === 'redundant') {
                  // Installation failed
                  clearTimeout(installTimeout);
                  console.error('Service Worker installation failed');
                  // We don't reload here to avoid infinite reload loops
                }
              };
            }
          };
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
          // If registration fails, we'll operate without a service worker
          console.log('App will run without service worker support');
        });
      }, 1000); // 1 second delay to ensure cleanup is complete
    })
    .catch(error => {
      console.error('Error during service worker cleanup:', error);
    });
    
    // Handle service worker controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service Worker controller changed');
    });
    
    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', event => {
      console.log('Message from Service Worker:', event.data);
      
      // Handle specific messages
      if (event.data && event.data.type === 'STATE_SYNCED') {
        // State was successfully synced in the background
        console.log('State was successfully synced in the background');
        
        // Dispatch an event for the application to handle
        window.dispatchEvent(new CustomEvent('sw-state-synced', {
          detail: event.data.detail
        }));
      }
    });
  });
  
  // Add offline/online event handlers
  window.addEventListener('online', () => {
    console.log('Network connection restored');
    
    // Trigger sync if available
    if (navigator.serviceWorker.controller && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.sync.register('sync-state');
      });
    }
    
    // Dispatch event for the application
    window.dispatchEvent(new Event('app-connection-restored'));
  });
  
  window.addEventListener('offline', () => {
    console.log('Network connection lost');
    
    // Dispatch event for the application
    window.dispatchEvent(new Event('app-connection-lost'));
  });
}

// Helper function to check if the app is online
function isOnline() {
  return navigator.onLine;
}

// Helper function to trigger state sync
function triggerStateSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(registration => {
      registration.sync.register('sync-state')
        .then(() => console.log('Background sync registered'))
        .catch(err => console.error('Background sync registration failed:', err));
    });
  }
}

// Expose utility functions to the window object
window.__swUtils = {
  isOnline,
  triggerStateSync
};

// Helper function to unregister service workers and clear caches (for debugging)
window.unregisterServiceWorkers = function() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister();
      }
      
      // Clear all caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
      .then(() => {
        console.log('All service workers unregistered and caches cleared');
        alert('All service workers unregistered. Reload the page to see changes.');
      });
    });
  }
};