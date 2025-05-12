/**
 * Loader for Enhanced State Debugger
 * 
 * This script loads the enhanced state debugger either:
 * 1. Automatically via URL parameter (?debug=true)
 * 2. On keyboard shortcut (Alt+D)
 * 3. If the debug flag is already set in localStorage
 */
(function() {
  console.log('[Debugger Loader] Initializing...');
  
  // Check if already loaded
  if (window.__DEBUGGER_LOADER_INITIALIZED) return;
  window.__DEBUGGER_LOADER_INITIALIZED = true;
  
  // Add keyboard shortcut for toggling debugger (Alt+D)
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'd') {
      e.preventDefault();
      
      // Load or toggle the debugger
      if (window.__ENHANCED_STATE_DEBUGGER_INITIALIZED) {
        console.log('[Debugger Loader] Debugger already active, toggling via keyboard shortcut');
        // The debugger itself will handle toggling
      } else {
        console.log('[Debugger Loader] Loading enhanced debugger via keyboard shortcut');
        loadDebugger();
      }
    }
  });
  
  // Function to load the debugger
  function loadDebugger() {
    if (window.__ENHANCED_STATE_DEBUGGER_INITIALIZED) {
      console.log('[Debugger Loader] Debugger already loaded');
      return;
    }
    
    console.log('[Debugger Loader] Loading enhanced state debugger...');
    
    // Create script element
    const script = document.createElement('script');
    script.id = 'enhanced-state-debugger-script';
    script.src = '/enhanced-state-debugger.js';
    script.async = true;
    script.onload = () => {
      console.log('[Debugger Loader] Debugger loaded successfully');
      
      // Set flag in localStorage to remember debug mode
      localStorage.setItem('zenjin_debug_enabled', 'true');
    };
    script.onerror = (error) => {
      console.error('[Debugger Loader] Failed to load debugger:', error);
    };
    
    // Add script to document
    document.head.appendChild(script);
  }
  
  // Check if we should load the debugger
  function shouldLoadDebugger() {
    // Check URL params
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get('debug') === 'true';
    
    // Check localStorage
    const debugEnabled = localStorage.getItem('zenjin_debug_enabled') === 'true';
    
    return debugParam || debugEnabled;
  }
  
  // Load debugger if needed
  if (shouldLoadDebugger()) {
    console.log('[Debugger Loader] Auto-loading debugger based on URL or localStorage');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadDebugger);
    } else {
      loadDebugger();
    }
  } else {
    console.log('[Debugger Loader] Debugger not auto-loaded. Use Alt+D to toggle.');
  }
  
  console.log('[Debugger Loader] Initialization complete');
})();