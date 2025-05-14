import React, { useState, useEffect } from 'react';
import LoadingScreen from './LoadingScreen';
import PlayerWithLoader from './PlayerWithLoader';
import MinimalDistinctionPlayer from './MinimalDistinctionPlayer';

/**
 * Client-side only component that ensures a clean start for testing
 * - Clears localStorage on demand
 * - Provides controls for testing the loading screen
 * - Shows detailed diagnostics about content loading
 */
const CleanStartPlayerContent = () => {
  // State to control what's displayed
  const [showControls, setShowControls] = useState(true);
  const [showDirectLoader, setShowDirectLoader] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [diagnostics, setDiagnostics] = useState([]);
  const [manualMinDisplayTime, setManualMinDisplayTime] = useState(5000);
  const [localStorage, setLocalStorage] = useState({});
  
  // Check localStorage on mount
  useEffect(() => {
    refreshLocalStorageInfo();
  }, []);
  
  // Function to refresh localStorage info
  const refreshLocalStorageInfo = () => {
    const items = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      try {
        const value = window.localStorage.getItem(key);
        items[key] = value ? value.substring(0, 50) + '...' : null;
      } catch (error) {
        items[key] = 'Error reading value';
      }
    }
    setLocalStorage(items);
  };
  
  // Function to clear all localStorage
  const clearAllLocalStorage = () => {
    try {
      window.localStorage.clear();
      addDiagnostic('All localStorage items cleared');
      refreshLocalStorageInfo();
    } catch (error) {
      addDiagnostic(`Error clearing localStorage: ${error.message}`);
    }
  };
  
  // Function to clear specific localStorage keys
  const clearStorageKeys = (keyPattern) => {
    try {
      const keysToRemove = [];
      
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.includes(keyPattern)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        window.localStorage.removeItem(key);
        addDiagnostic(`Removed localStorage key: ${key}`);
      });
      
      addDiagnostic(`Cleared ${keysToRemove.length} keys matching "${keyPattern}"`);
      refreshLocalStorageInfo();
    } catch (error) {
      addDiagnostic(`Error clearing localStorage keys: ${error.message}`);
    }
  };
  
  // Add diagnostic message with timestamp
  const addDiagnostic = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDiagnostics(prev => [{timestamp, message}, ...prev.slice(0, 19)]);
  };
  
  // Handle showing the loading screen directly
  const handleShowLoadingScreen = () => {
    addDiagnostic('Showing direct loading screen');
    setShowControls(false);
    setShowDirectLoader(true);
    
    // Hide after the specified time
    setTimeout(() => {
      addDiagnostic('Loading screen timeout complete');
      setShowDirectLoader(false);
      setShowControls(true);
    }, manualMinDisplayTime);
  };
  
  // Handle showing the player with loader
  const handleShowPlayerWithLoader = () => {
    addDiagnostic('Starting PlayerWithLoader');
    clearAllLocalStorage();
    setShowControls(false);
    setShowPlayer(true);
  };
  
  // Handle when loading is complete
  const handlePlayerLoadingComplete = () => {
    addDiagnostic('Player loading complete');
  };
  
  // Handle going back to controls
  const handleBackToControls = () => {
    addDiagnostic('Returning to controls');
    setShowPlayer(false);
    setShowDirectLoader(false);
    setShowControls(true);
  };
  
  // Render direct loading screen
  if (showDirectLoader) {
    return (
      <>
        <button
          className="fixed top-4 right-4 z-[1100] bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg"
          onClick={handleBackToControls}
        >
          Cancel
        </button>
        <LoadingScreen
          isAnonymous={true}
          minDisplayTime={manualMinDisplayTime}
          onAnimationComplete={() => addDiagnostic('Loading screen animation complete')}
        />
      </>
    );
  }
  
  // Render player with loader
  if (showPlayer) {
    return (
      <>
        <button
          className="fixed top-4 right-4 z-[1100] bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg"
          onClick={handleBackToControls}
        >
          Back to Controls
        </button>
        <div className="min-h-screen">
          <PlayerWithLoader 
            tubeId={1} 
            stitchId="stitch-T1-001-01"
            onContentLoaded={handlePlayerLoadingComplete}
          >
            <MinimalDistinctionPlayer tubeNumber={1} />
          </PlayerWithLoader>
        </div>
      </>
    );
  }
  
  // Render controls
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Clean Start Player</h1>
      
      {/* Control Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* LocalStorage Management */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">LocalStorage Management</h2>
          
          <div className="flex flex-col gap-4 mb-6">
            <button 
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              onClick={clearAllLocalStorage}
            >
              Clear All LocalStorage
            </button>
            
            <div className="flex gap-2">
              <button 
                className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
                onClick={() => clearStorageKeys('zenjin')}
              >
                Clear Zenjin Keys
              </button>
              
              <button 
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
                onClick={() => clearStorageKeys('user')}
              >
                Clear User Keys
              </button>
              
              <button 
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                onClick={() => clearStorageKeys('content')}
              >
                Clear Content Keys
              </button>
            </div>
            
            <button 
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              onClick={refreshLocalStorageInfo}
            >
              Refresh LocalStorage Info
            </button>
          </div>
          
          <h3 className="font-medium mb-2">LocalStorage Contents:</h3>
          <div className="bg-gray-900 p-3 rounded h-48 overflow-y-auto text-sm">
            {Object.keys(localStorage).length === 0 ? (
              <p className="text-gray-400 italic">LocalStorage is empty</p>
            ) : (
              <ul className="list-disc list-inside">
                {Object.entries(localStorage).map(([key, value]) => (
                  <li key={key} className="mb-1 break-all">
                    <span className="font-mono text-green-400">{key}:</span> {value}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        
        {/* Testing Controls */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Testing Controls</h2>
          
          <div className="mb-6">
            <label className="block mb-2">Loading Screen Display Time (ms):</label>
            <input
              type="number"
              value={manualMinDisplayTime}
              onChange={(e) => setManualMinDisplayTime(parseInt(e.target.value) || 3000)}
              className="w-full px-3 py-2 bg-gray-700 rounded text-white mb-4"
              min="1000"
              max="30000"
              step="1000"
            />
            
            <button 
              className="bg-teal-600 text-white px-4 py-2 rounded w-full mb-4 hover:bg-teal-700"
              onClick={handleShowLoadingScreen}
            >
              Show Loading Screen Directly
            </button>
            
            <button 
              className="bg-purple-600 text-white px-4 py-2 rounded w-full hover:bg-purple-700"
              onClick={handleShowPlayerWithLoader}
            >
              Start Player With Clean State
            </button>
          </div>
          
          <h3 className="font-medium mb-2">About This Tool:</h3>
          <p className="text-gray-300 text-sm">
            This tool provides a clean testing environment by clearing localStorage
            and providing controls to manually test the loading screen and player.
            The diagnostics panel shows events that occur during testing.
          </p>
        </div>
      </div>
      
      {/* Diagnostics Panel */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Diagnostics</h2>
        <div className="bg-black p-3 rounded h-64 overflow-y-auto text-sm font-mono">
          {diagnostics.length === 0 ? (
            <p className="text-gray-500 italic">No diagnostics yet</p>
          ) : (
            <div>
              {diagnostics.map((entry, index) => (
                <div key={index} className="mb-1">
                  <span className="text-gray-500">[{entry.timestamp}]</span>{' '}
                  <span className="text-green-400">{entry.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CleanStartPlayerContent;