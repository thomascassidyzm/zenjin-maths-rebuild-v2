import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import MinimalDistinctionPlayer from '../components/MinimalDistinctionPlayer';
import ResetProgressButton from '../components/ResetProgressButton';
import BackgroundBubbles from '../components/BackgroundBubbles';
import CelebrationEffect from '../components/CelebrationEffect';
import { useAuth } from '../context/AuthContext';
import { useTripleHelixPlayer } from '../lib/playerUtils';

/**
 * Dev Player - Triple-Helix with debugging tools
 * 
 * This is a developer version of the player that includes:
 * - Debug information panel
 * - Tube configuration inspection
 * - Perfect score button
 * - Reset progress functionality
 * - Manual tube selection controls
 * - Debug logging
 * 
 * Uses the same core player functionality as minimal-player.tsx
 */
export default function DevPlayer() {
  const router = useRouter();
  const { mode } = router.query;
  const { user, isAuthenticated } = useAuth();
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(true);
  
  // Debug logger
  const debug = (message: string) => {
    console.log(message);
    setDebugLogs(prev => [message, ...prev.slice(0, 19)]);
  };
  
  // Use the shared player hook with dev mode
  const player = useTripleHelixPlayer({ 
    mode: 'dev',
    debug 
  });
  
  // Handle hard reset (dev mode only)
  const handleHardReset = async () => {
    if (!confirm('HARD RESET: This will clear ALL browser storage, caches, and service workers. Continue?')) return;
    
    debug('HARD RESET: Clearing all storage and caches');
    
    // 1. Clear localStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // 2. Clear IndexedDB
    try {
      const dbNames = ['zenjin-content', 'supabase'];
      for (const dbName of dbNames) {
        const req = window.indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => debug(`IndexedDB ${dbName} cleared`);
        req.onerror = () => debug(`Error clearing IndexedDB ${dbName}`);
      }
    } catch (e) {
      debug(`IndexedDB error: ${e}`);
    }
    
    // 3. Clear caches
    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          await caches.delete(key);
          debug(`Cache ${key} cleared`);
        }
      }
    } catch (e) {
      debug(`Cache error: ${e}`);
    }
    
    // 4. Unregister service workers
    try {
      if (navigator.serviceWorker) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          debug('Service worker unregistered');
        }
      }
    } catch (e) {
      debug(`Service worker error: ${e}`);
    }
    
    // 5. Reload the page with cache bust
    setTimeout(() => {
      window.location.href = '/dev-player?t=' + Date.now();
    }, 1000);
  };
  
  // Render Debug Panel
  const renderDebugPanel = () => {
    if (!showDebugPanel) return null;
    
    return (
      <div className="fixed top-24 left-4 z-20 bg-black/60 backdrop-blur-sm p-3 rounded-lg shadow-lg max-w-xs text-white text-xs">
        <h3 className="font-medium mb-2 text-sm">Debug Controls</h3>
        
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={player.handlePerfectScore}
            className="px-2 py-1 bg-green-600/70 hover:bg-green-500/80 text-white rounded-md transition-colors"
            title="Mark current stitch as 20/20 and advance to next tube"
          >
            Mark as 20/20
          </button>
          
          <button
            onClick={handleHardReset}
            className="px-2 py-1 bg-red-600/70 hover:bg-red-500/80 text-white rounded-md transition-colors"
            title="Clear all storage and caches"
          >
            Hard Reset
          </button>
        </div>
        
        <div className="mb-3">
          <h4 className="text-white/70 mb-1">Tube Selection:</h4>
          <div className="flex space-x-2">
            {[1, 2, 3].map(tubeNum => (
              <button
                key={tubeNum}
                onClick={() => player.handleManualTubeSelect(tubeNum)}
                className={`px-3 py-1 rounded-md ${player.currentTube === tubeNum ? 'bg-teal-600/80' : 'bg-gray-700/50'}`}
              >
                Tube {tubeNum}
              </button>
            ))}
          </div>
        </div>
        
        <div className="mb-3">
          <h4 className="text-white/70 mb-1">Player State:</h4>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xxs">
            <div className="text-white/80">Tube:</div>
            <div>{player.currentTube}</div>
            <div className="text-white/80">Thread:</div>
            <div>{player.currentStitch?.threadId || 'none'}</div>
            <div className="text-white/80">Stitch:</div>
            <div>{player.currentStitch?.id || 'none'}</div>
            <div className="text-white/80">Questions:</div>
            <div>{player.currentStitch?.questions?.length || 0}</div>
            <div className="text-white/80">Points:</div>
            <div>{player.accumulatedSessionData.totalPoints}</div>
            <div className="text-white/80">Pending Changes:</div>
            <div>{player.pendingChanges}</div>
          </div>
        </div>
        
        <div className="text-xxs">
          <h4 className="text-white/70 mb-1">Logs:</h4>
          <div className="bg-black/40 p-2 rounded max-h-32 overflow-auto">
            {debugLogs.map((log, i) => (
              <div key={i} className="mb-1">{log}</div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen player-bg relative">
      <Head>
        <title>Dev Player | Zenjin Maths</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      {/* Background bubbles at the page level for continuous animation */}
      <BackgroundBubbles />
      
      {/* Celebration effect that appears when completing a stitch */}
      <CelebrationEffect 
        isVisible={player.showCelebration} 
        onComplete={() => player.setShowCelebration(false)} 
      />
      
      {/* Header with settings and account */}
      <div className="absolute top-4 right-4 z-20 flex space-x-3">
        {isAuthenticated && user && (
          <ResetProgressButton onComplete={() => window.location.reload()} />
        )}
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-md transition-colors"
          title="Back to dashboard"
        >
          Dashboard
        </button>
      </div>
      
      {/* Dev mode controls */}
      <div className="absolute top-4 left-4 z-20 flex space-x-3">
        <button
          onClick={() => setShowDebugPanel(!showDebugPanel)}
          className="px-4 py-2 bg-purple-600/70 hover:bg-purple-500/80 text-white rounded-md transition-colors"
        >
          {showDebugPanel ? 'Hide Debug' : 'Show Debug'}
        </button>
      </div>
      
      {/* Tube indicator */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm flex items-center space-x-6">
          {[1, 2, 3].map(tubeNum => (
            <div key={tubeNum} className="flex items-center">
              <div 
                className={`w-3 h-3 rounded-full mr-1.5 ${tubeNum === player.currentTube ? 'bg-teal-400' : 'bg-white/30'}`}
              />
              <span className={tubeNum === player.currentTube ? 'text-teal-300' : 'text-white/50'}>
                Tube {tubeNum}
              </span>
            </div>
          ))}
          
          {/* Add pending changes indicator */}
          {player.pendingChanges > 0 && (
            <div className="ml-3 text-xs text-white/70 bg-indigo-600/50 px-2 py-0.5 rounded-full flex items-center">
              <span className="animate-pulse mr-1">⬤</span> {player.pendingChanges}
            </div>
          )}
        </div>
      </div>
      
      {/* Render debug panel */}
      {renderDebugPanel()}
      
      {/* Main content area */}
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen relative" style={{zIndex: 'auto'}}>
        {player.isLoading ? (
          <div className="bg-white/20 backdrop-blur-lg rounded-xl p-6 text-center shadow-xl">
            <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-300 border-t-transparent rounded-full mb-2"></div>
            <p className="text-white text-lg">Loading...</p>
          </div>
        ) : player.loadError ? (
          <div className="bg-white/20 backdrop-blur-lg rounded-xl p-8 text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-white">Error Loading Content</h2>
            <div className="bg-red-500/20 border border-red-300/30 text-red-100 rounded-lg p-4 mb-6">
              {player.loadError}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : !player.currentStitch ? (
          <div className="bg-white/20 backdrop-blur-lg rounded-xl p-8 text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-white">No Content Available</h2>
            <p className="mb-4 text-white">There is no active content.</p>
            <button
              onClick={() => router.push('/')}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Back to Home
            </button>
          </div>
        ) : (
          /* Render the player directly - remove key to preserve component across transitions */
          <MinimalDistinctionPlayer
            thread={{
              id: player.currentStitch.threadId,
              name: player.currentStitch.threadId,
              description: `Thread ${player.currentStitch.threadId}`,
              stitches: [player.currentStitch]
            }}
            onComplete={player.handleSessionComplete}
            onEndSession={(results) => player.handleSessionComplete(results, true)}
            questionsPerSession={20}
            sessionTotalPoints={player.accumulatedSessionData.totalPoints}
          />
        )}
      </div>
    </div>
  );
}