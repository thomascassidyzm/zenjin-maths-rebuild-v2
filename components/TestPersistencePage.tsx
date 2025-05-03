import React, { useState, useEffect } from 'react';

const TestPersistencePage: React.FC = () => {
  // State manager and content manager
  const [stateManager, setStateManager] = useState<any>(null);
  const [contentManager, setContentManager] = useState<any>(null);

  // State for test metadata
  const [userId, setUserId] = useState<string>('test-user-001');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  // State status indicators
  const [persistenceStatus, setPersistenceStatus] = useState<{
    localStorage: boolean;
    sessionStorage: boolean;
    indexedDB: boolean;
    server: boolean;
    serviceWorker: boolean;
  }>({
    localStorage: false,
    sessionStorage: false,
    indexedDB: false,
    server: false,
    serviceWorker: false,
  });
  
  // Connection status
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState<string>('Not started');
  
  // Current state snapshot
  const [currentState, setCurrentState] = useState<any>(null);
  
  // Content cache status
  const [cacheStatus, setCacheStatus] = useState<any>(null);

  // Load managers
  useEffect(() => {
    // Import on the client side only
    Promise.all([
      import('../lib/state/stateManager'),
      import('../lib/content/contentManager')
    ]).then(([stateModule, contentModule]) => {
      setStateManager(stateModule.stateManager);
      setContentManager(contentModule.contentManager);
    });
  }, []);
  
  // Initialize
  useEffect(() => {
    // Only proceed if managers are loaded
    if (!stateManager || !contentManager) return;
    
    // Check browser features
    checkBrowserFeatures();
    
    // Initialize state manager
    if (!isInitialized) {
      stateManager.initialize(userId).then(() => {
        console.log('State manager initialized');
        setIsInitialized(true);
        
        // Subscribe to state changes
        stateManager.subscribe((newState: any) => {
          setCurrentState(newState);
        });
        
        // Get initial state
        setCurrentState(stateManager.getState());
      });
      
      // Register page events for state persistence
      stateManager.registerPageEvents();
    }
    
    // Setup online/offline listeners
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    
    // Listen for service worker events
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }
    
    // Setup the page beforeunload event
    window.addEventListener('beforeunload', () => {
      // Force sync state before unloading
      stateManager.forceSyncToServer();
    });
    
    // Get content cache status
    updateCacheStatus();
    
    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
      
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [stateManager, contentManager, userId, isInitialized]);
  
  // Check browser features
  const checkBrowserFeatures = () => {
    if (typeof window === 'undefined') {
      return;
    }
    
    const status = {
      localStorage: false,
      sessionStorage: false,
      indexedDB: false,
      server: false,
      serviceWorker: false,
    };
    
    // Check localStorage
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      status.localStorage = true;
    } catch (e) {
      status.localStorage = false;
    }
    
    // Check sessionStorage
    try {
      sessionStorage.setItem('test', 'test');
      sessionStorage.removeItem('test');
      status.sessionStorage = true;
    } catch (e) {
      status.sessionStorage = false;
    }
    
    // Check IndexedDB
    status.indexedDB = 'indexedDB' in window;
    
    // Check service worker
    status.serviceWorker = 'serviceWorker' in navigator;
    
    // Check server connection
    fetch('/api/health-check').then(response => {
      status.server = response.ok;
      setPersistenceStatus(status);
    }).catch(() => {
      status.server = false;
      setPersistenceStatus(status);
    });
  };
  
  // Handle online/offline status changes
  const handleOnlineStatusChange = () => {
    if (typeof navigator === 'undefined') return;
    
    setIsOnline(navigator.onLine);
    
    // Trigger sync if coming back online
    if (navigator.onLine) {
      triggerSync();
    }
  };
  
  // Handle service worker messages
  const handleServiceWorkerMessage = (event: MessageEvent) => {
    if (typeof navigator === 'undefined') return;
    
    if (event.data && event.data.type === 'STATE_SYNCED') {
      const { successCount, failureCount, totalCount } = event.data.detail;
      setSyncStatus(`Sync completed: ${successCount}/${totalCount} succeeded, ${failureCount} failed`);
    }
  };
  
  // Update cache status
  const updateCacheStatus = async () => {
    if (!contentManager) {
      return;
    }
    
    try {
      const status = await contentManager.getCacheStatus();
      setCacheStatus(status);
    } catch (error) {
      console.error('Error getting cache status:', error);
    }
  };
  
  // Update state with new values
  const updateState = () => {
    if (!stateManager) {
      alert('State manager not yet loaded');
      return;
    }
    
    // Create a state update action
    stateManager.dispatch({
      type: 'UPDATE_POINTS',
      payload: {
        sessionPoints: Math.floor(Math.random() * 100),
        lifetimePoints: Math.floor(Math.random() * 1000)
      }
    });
    
    // Check local storage to verify
    if (typeof window !== 'undefined') {
      const localState = localStorage.getItem(`zenjin_state_${userId}`);
      if (localState) {
        console.log('State saved to localStorage');
      }
    }
  };
  
  // Simulate tube cycling
  const simulateTubeCycle = () => {
    if (!stateManager || !currentState) {
      alert('State manager not yet loaded or no current state');
      return;
    }
    
    const currentTube = currentState.activeTube;
    const nextTube = currentTube < 3 ? currentTube + 1 : 1;
    
    stateManager.dispatch({
      type: 'CYCLE_TUBE',
      payload: {
        fromTube: currentTube,
        toTube: nextTube
      }
    });
  };
  
  // Complete a stitch in the current tube
  const simulateStitchCompletion = () => {
    if (!stateManager || !currentState) {
      alert('State manager not yet loaded or no current state');
      return;
    }
    
    const currentTube = currentState.activeTube;
    const currentTubeState = currentState.tubes[currentTube];
    
    stateManager.dispatch({
      type: 'COMPLETE_STITCH',
      payload: {
        tubeNumber: currentTube,
        threadId: currentTubeState.threadId || 'thread-123',
        nextStitchId: `stitch-${Date.now().toString(36)}`,
        score: Math.floor(Math.random() * 5), // Random score between 0-5
        totalQuestions: 5
      }
    });
  };
  
  // Force a sync to the server
  const forceSyncToServer = async () => {
    if (!stateManager) {
      alert('State manager not yet loaded');
      return;
    }
    
    setSyncStatus('Syncing...');
    const result = await stateManager.forceSyncToServer();
    setSyncStatus(result ? 'Sync succeeded' : 'Sync failed');
  };
  
  // Trigger a background sync via service worker
  const triggerSync = () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
      setSyncStatus('Triggering background sync...');
      
      navigator.serviceWorker.controller.postMessage({
        type: 'TRIGGER_SYNC'
      });
    } else {
      setSyncStatus('Service worker not available');
    }
  };
  
  // Clear service worker caches (for testing)
  const clearCaches = () => {
    if (!contentManager) {
      alert('Content manager not yet loaded');
      return;
    }
    
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_CACHES'
      });
      
      // Also clear content manager cache
      contentManager.clearOldCache();
      
      setTimeout(updateCacheStatus, 500);
    } else {
      alert('Service worker not available');
    }
  };
  
  // Toggle offline mode (for testing)
  const toggleOfflineMode = () => {
    if (typeof window === 'undefined') {
      return;
    }
    
    // Declare originalFetch in the context of the event handler
    let originalFetch = window.fetch;
    
    // Can't really toggle navigator.onLine directly, but we can simulate it
    if (isOnline) {
      // Force the fetch requests to fail by using a non-existent server
      // This is a hack for testing, but it should work for our purposes
      window.fetch = async (url, options) => {
        // Only block API requests, allow other requests
        if (typeof url === 'string' && url.includes('/api/')) {
          throw new Error('Network error - offline simulation');
        }
        return originalFetch(url, options);
      };
      setIsOnline(false);
      window.dispatchEvent(new Event('offline'));
    } else {
      // Restore fetch
      window.fetch = originalFetch;
      setIsOnline(true);
      window.dispatchEvent(new Event('online'));
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">State Persistence Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-100 rounded p-4">
          <h2 className="text-lg font-semibold mb-2">Browser Features</h2>
          <ul className="list-disc pl-5">
            <li className={persistenceStatus.localStorage ? 'text-green-600' : 'text-red-600'}>
              localStorage: {persistenceStatus.localStorage ? 'Available' : 'Not Available'}
            </li>
            <li className={persistenceStatus.sessionStorage ? 'text-green-600' : 'text-red-600'}>
              sessionStorage: {persistenceStatus.sessionStorage ? 'Available' : 'Not Available'}
            </li>
            <li className={persistenceStatus.indexedDB ? 'text-green-600' : 'text-red-600'}>
              IndexedDB: {persistenceStatus.indexedDB ? 'Available' : 'Not Available'}
            </li>
            <li className={persistenceStatus.serviceWorker ? 'text-green-600' : 'text-red-600'}>
              Service Worker: {persistenceStatus.serviceWorker ? 'Available' : 'Not Available'}
            </li>
            <li className={persistenceStatus.server ? 'text-green-600' : 'text-red-600'}>
              Server Connection: {persistenceStatus.server ? 'Available' : 'Not Available'}
            </li>
          </ul>
        </div>
        
        <div className="bg-gray-100 rounded p-4">
          <h2 className="text-lg font-semibold mb-2">Connection Status</h2>
          <div className="mb-2">
            <div className={`inline-block w-3 h-3 rounded-full mr-2 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <div className="mb-2">
            <strong>Sync Status:</strong> {syncStatus}
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={toggleOfflineMode}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {isOnline ? 'Simulate Offline' : 'Simulate Online'}
            </button>
            <button 
              onClick={checkBrowserFeatures}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Refresh Status
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-100 rounded p-4">
          <h2 className="text-lg font-semibold mb-2">Test User</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User ID:
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => stateManager && stateManager.initialize(userId)}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
              disabled={!userId || !stateManager}
            >
              Initialize State
            </button>
          </div>
        </div>
        
        <div className="bg-gray-100 rounded p-4">
          <h2 className="text-lg font-semibold mb-2">Content Cache Status</h2>
          {cacheStatus ? (
            <div>
              <p><strong>Worker Available:</strong> {cacheStatus.workerAvailable ? 'Yes' : 'No'}</p>
              <p><strong>Memory Cache Size:</strong> {cacheStatus.memCacheSize} items</p>
              <p><strong>Worker Cache Size:</strong> {cacheStatus.cacheSize || 'N/A'} items</p>
              <p><strong>Queue Length:</strong> {cacheStatus.queueLength || 0} items</p>
              <p><strong>Is Fetching:</strong> {cacheStatus.isFetching ? 'Yes' : 'No'}</p>
            </div>
          ) : (
            <p>Loading cache status...</p>
          )}
          <div className="mt-2">
            <button 
              onClick={updateCacheStatus}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
            >
              Refresh
            </button>
            <button 
              onClick={clearCaches}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear Caches
            </button>
          </div>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Test Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <button 
            onClick={updateState}
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={!isInitialized}
          >
            Update Points
          </button>
          <button 
            onClick={simulateTubeCycle}
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={!isInitialized}
          >
            Cycle Tube
          </button>
          <button 
            onClick={simulateStitchCompletion}
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={!isInitialized}
          >
            Complete Stitch
          </button>
          <button 
            onClick={forceSyncToServer}
            className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            disabled={!isInitialized || !isOnline}
          >
            Force Sync
          </button>
          <button 
            onClick={triggerSync}
            className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            disabled={!persistenceStatus.serviceWorker || !isOnline}
          >
            Trigger Background Sync
          </button>
        </div>
      </div>
      
      {currentState && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Current State</h2>
          <div className="bg-gray-100 rounded p-4 mb-2">
            <p><strong>User ID:</strong> {currentState.userId}</p>
            <p><strong>Active Tube:</strong> {currentState.activeTube}</p>
            <p><strong>Cycle Count:</strong> {currentState.cycleCount}</p>
            <p><strong>Session Points:</strong> {currentState.points.session}</p>
            <p><strong>Lifetime Points:</strong> {currentState.points.lifetime}</p>
            <p><strong>Last Updated:</strong> {new Date(currentState.lastUpdated).toLocaleString()}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(currentState.tubes).map(([tubeNumber, tubeState]: [string, any]) => (
              <div key={tubeNumber} className={`rounded p-3 ${parseInt(tubeNumber) === currentState.activeTube ? 'bg-blue-200' : 'bg-gray-200'}`}>
                <h3 className="font-medium mb-1">Tube {tubeNumber}</h3>
                <p><strong>Thread ID:</strong> {tubeState.threadId || 'None'}</p>
                <p><strong>Current Stitch:</strong> {tubeState.currentStitchId || 'None'}</p>
                <p><strong>Position:</strong> {tubeState.position}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Storage Debug</h2>
        <div className="bg-gray-100 rounded p-4">
          <div className="mb-4">
            <h3 className="font-medium mb-1">LocalStorage</h3>
            <button 
              onClick={() => {
                try {
                  const state = localStorage.getItem(`zenjin_state_${userId}`);
                  console.log('LocalStorage state:', state ? JSON.parse(state) : null);
                  alert(`LocalStorage state found: ${state ? 'Yes' : 'No'}`);
                } catch (e) {
                  console.error('Error reading localStorage:', e);
                  alert(`Error reading localStorage: ${e.message}`);
                }
              }}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
            >
              Check LocalStorage
            </button>
            <button 
              onClick={() => {
                try {
                  localStorage.removeItem(`zenjin_state_${userId}`);
                  alert('LocalStorage state cleared');
                } catch (e) {
                  console.error('Error clearing localStorage:', e);
                  alert(`Error clearing localStorage: ${e.message}`);
                }
              }}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear LocalStorage
            </button>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium mb-1">Service Worker</h3>
            <button 
              onClick={() => {
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(registrations => {
                    alert(`Service Worker registrations: ${registrations.length}`);
                    console.log('Service Worker registrations:', registrations);
                  });
                } else {
                  alert('Service Worker API not available');
                }
              }}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Check Service Worker
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPersistencePage;