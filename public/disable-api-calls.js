/**
 * EMERGENCY FIX: Disable direct API calls to /api/user-state
 * 
 * This script intercepts and disables direct API calls to /api/user-state
 * that should be going through Zustand instead.
 */

(function() {
  console.log('[PATCH] Initializing API call interception');
  
  // Wait for page to be fully loaded
  window.addEventListener('load', function() {
    console.log('[PATCH] Page loaded, applying patches...');
    
    // Save original fetch and XMLHttpRequest for reference
    const originalFetch = window.fetch;
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;
    
    // Intercept fetch calls
    window.fetch = function(url, options) {
      // Check if this is a call to /api/user-state
      if (url && url.toString().includes('/api/user-state') && 
          options && options.method === 'POST') {
        console.log('[PATCH] Intercepted fetch call to /api/user-state');
        console.log('[PATCH] API call canceled - use Zustand store instead');
        
        // Return a successful mock response
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            message: 'API call intercepted - state NOT saved to server',
            intercepted: true
          })
        });
      }
      
      // Otherwise, proceed normally
      return originalFetch.apply(this, arguments);
    };
    
    // Intercept XMLHttpRequest calls
    XMLHttpRequest.prototype.open = function(method, url) {
      // Store the URL for later use in send
      this._patchedUrl = url;
      this._patchedMethod = method;
      
      // Call original
      return originalXhrOpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(body) {
      // Check if this is a POST to /api/user-state
      if (this._patchedUrl && 
          this._patchedUrl.toString().includes('/api/user-state') && 
          this._patchedMethod === 'POST') {
        console.log('[PATCH] Intercepted XMLHttpRequest to /api/user-state');
        console.log('[PATCH] API call canceled - use Zustand store instead');
        
        // Simulate a successful response
        const mockResponse = JSON.stringify({
          success: true,
          message: 'API call intercepted - state NOT saved to server',
          intercepted: true
        });
        
        // Skip the actual send and simulate a successful response
        setTimeout(() => {
          Object.defineProperty(this, 'readyState', { value: 4 });
          Object.defineProperty(this, 'status', { value: 200 });
          Object.defineProperty(this, 'responseText', { value: mockResponse });
          
          // Trigger the onload event
          if (typeof this.onload === 'function') {
            this.onload();
          }
          
          // Trigger the onreadystatechange event
          if (typeof this.onreadystatechange === 'function') {
            this.onreadystatechange();
          }
        }, 50);
        
        return;
      }
      
      // Otherwise, proceed normally
      return originalXhrSend.apply(this, arguments);
    };
    
    // Also try to disable axios if it's loaded
    if (window.axios) {
      const originalAxiosPost = window.axios.post;
      
      window.axios.post = function(url, data, config) {
        if (url && url.toString().includes('/api/user-state')) {
          console.log('[PATCH] Intercepted axios POST to /api/user-state');
          console.log('[PATCH] API call canceled - use Zustand store instead');
          
          return Promise.resolve({
            data: {
              success: true,
              message: 'API call intercepted - state NOT saved to server',
              intercepted: true
            },
            status: 200,
            statusText: 'OK'
          });
        }
        
        return originalAxiosPost.apply(this, arguments);
      };
    }
    
    console.log('[PATCH] Successfully applied API call interception');
  });
})();