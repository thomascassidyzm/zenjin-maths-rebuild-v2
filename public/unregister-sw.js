/**
 * Script to explicitly unregister all service workers
 * This helps resolve issues with cached API URLs going to the wrong domain
 */

(function() {
  console.log('Attempting to unregister all service workers...');
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      const count = registrations.length;
      console.log(`Found ${count} service worker registrations`);
      
      if (count === 0) {
        console.log('No service workers to unregister');
        return;
      }
      
      // Unregister all service workers
      return Promise.all(
        registrations.map(registration => {
          console.log('Unregistering service worker with scope:', registration.scope);
          return registration.unregister();
        })
      ).then(results => {
        const successCount = results.filter(Boolean).length;
        console.log(`Successfully unregistered ${successCount} of ${count} service workers`);
        
        if (successCount > 0) {
          // Clear all caches
          return caches.keys().then(cacheNames => {
            console.log(`Found ${cacheNames.length} caches to clear`);
            
            return Promise.all(
              cacheNames.map(cacheName => {
                console.log(`Deleting cache: ${cacheName}`);
                return caches.delete(cacheName);
              })
            );
          });
        }
      }).then(() => {
        console.log('Service worker cleanup complete');
        
        // Set a flag to indicate the cleanup was performed
        localStorage.setItem('sw_cleanup_performed', 'true');
        localStorage.setItem('sw_cleanup_time', Date.now().toString());
        
        // Reload the page to ensure a clean state (commented out to avoid automatic reloads)
        // window.location.reload();
      });
    }).catch(error => {
      console.error('Error unregistering service workers:', error);
    });
  } else {
    console.log('Service workers not supported in this browser');
  }
})();