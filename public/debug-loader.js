// debug-loader.js - Loader script for tube state debugger
(function() {
  // Check if we've already attempted to load the debugger
  if (window.__DEBUG_LOADER_INITIALIZED) return;
  window.__DEBUG_LOADER_INITIALIZED = true;
  
  console.log('[Debug Loader] Initializing...');
  
  // Function to load the debugger script
  function loadDebugger() {
    if (window.__TUBE_STATE_DEBUGGER_INITIALIZED) {
      console.log('[Debug Loader] Debugger already loaded');
      return;
    }
    
    console.log('[Debug Loader] Loading tube state debugger...');
    
    // Create script element
    const script = document.createElement('script');
    script.id = 'tube-state-debugger-script';
    script.src = '/tube-state-debugger.js';
    script.async = true;
    script.onload = () => {
      console.log('[Debug Loader] Debugger loaded successfully');
    };
    script.onerror = (error) => {
      console.error('[Debug Loader] Failed to load debugger:', error);
    };
    
    // Add script to document
    document.head.appendChild(script);
  }
  
  // Check URL parameters for debug flag
  function checkURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('debug') || urlParams.has('debugger') || urlParams.has('tube-debug');
  }
  
  // Check localStorage for persistent debug flag
  function checkLocalStorage() {
    return localStorage.getItem('zenjin_debug_enabled') === 'true';
  }
  
  // Main initialization logic
  function init() {
    // Check if we should load the debugger
    const debugViaURL = checkURLParams();
    const debugViaPersistent = checkLocalStorage();
    
    if (debugViaURL || debugViaPersistent) {
      // Set the flag in localStorage for persistence across page loads
      if (debugViaURL && !debugViaPersistent) {
        localStorage.setItem('zenjin_debug_enabled', 'true');
      }
      
      // Load the debugger
      loadDebugger();
    }
    
    // Add keyboard shortcut (Ctrl+Shift+D) for toggling debugger
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        
        const isEnabled = localStorage.getItem('zenjin_debug_enabled') === 'true';
        if (isEnabled) {
          // Disable debugger
          localStorage.setItem('zenjin_debug_enabled', 'false');
          
          // Reload to remove debugger
          window.location.reload();
        } else {
          // Enable debugger
          localStorage.setItem('zenjin_debug_enabled', 'true');
          
          // Load debugger immediately
          loadDebugger();
        }
      }
    });
  }
  
  // Initialize on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  console.log('[Debug Loader] Setup complete');
})();