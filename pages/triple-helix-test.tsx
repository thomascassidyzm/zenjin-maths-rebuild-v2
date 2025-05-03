import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { TubeCyclerAdapter } from '../lib/triple-helix';

/**
 * Triple Helix Test Page
 * 
 * A simple test page to verify that the new Triple-Helix implementation
 * works correctly, particularly for:
 * 1. Tube rotation
 * 2. Skip number progression
 * 3. Content preloading
 * 4. Batch persistence
 */
export default function TripleHelixTest() {
  // State
  const [cycler, setCycler] = useState<any>(null);
  const [currentTube, setCurrentTube] = useState<number>(0);
  const [currentStitch, setCurrentStitch] = useState<any>(null);
  const [tubeStitches, setTubeStitches] = useState<any[]>([]);
  const [allStitches, setAllStitches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Add a log entry
  const addLog = (message: string) => {
    setLogs(prev => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev.slice(0, 49)]);
  };
  
  // Initialize the Triple-Helix system
  useEffect(() => {
    if (cycler) return;
    
    try {
      addLog('Initializing Triple-Helix system...');
      
      // Create new adapter
      const adapter = new TubeCyclerAdapter({
        userId: `test-user-${Date.now()}`,
        debug: true,
        onStateChange: (state: any) => {
          addLog(`State changed: Tube ${state.activeTubeNumber}, Points: ${state.totalPoints}`);
          setCurrentTube(state.activeTubeNumber);
          updateStitches(adapter);
        },
        onTubeChange: (tubeNumber: number) => {
          addLog(`Tube changed to: ${tubeNumber}`);
          setCurrentTube(tubeNumber);
        },
        onContentLoad: (stitchId: string) => {
          addLog(`Content loaded for stitch: ${stitchId}`);
        }
      });
      
      setCycler(adapter);
      setCurrentTube(adapter.getCurrentTube());
      updateStitches(adapter);
      setIsLoading(false);
      
      // Get initial stats
      const stats = adapter.getStats();
      addLog(`Adapter initialized with ${JSON.stringify(stats.session)}`);
      
      // Cleanup on unmount
      return () => {
        if (adapter) {
          adapter.destroy();
          addLog('Adapter destroyed and state persisted');
        }
      };
    } catch (error) {
      console.error('Error initializing adapter:', error);
      addLog(`Error initializing adapter: ${error}`);
      setIsLoading(false);
    }
  }, []);
  
  // Update stitches display
  const updateStitches = (adapter: any) => {
    if (!adapter) return;
    
    const stitch = adapter.getCurrentStitch();
    setCurrentStitch(stitch);
    
    const stitches = adapter.getCurrentTubeStitches();
    setTubeStitches(stitches.slice(0, 10)); // Just show first 10
    
    // Get all stitches for all tubes
    const threads = adapter.getSortedThreads();
    const allStitches: any[] = [];
    
    threads.forEach((thread: any) => {
      if (thread.stitches && thread.stitches.length > 0) {
        thread.stitches.forEach((stitch: any) => {
          allStitches.push({
            ...stitch,
            tubeNumber: thread.tube_number
          });
        });
      }
    });
    
    setAllStitches(allStitches);
  };
  
  // Handle perfect score
  const handlePerfectScore = () => {
    if (!cycler || !currentStitch) return;
    
    addLog(`Simulating perfect score for stitch ${currentStitch.id}`);
    
    // First cycle tube
    cycler.nextTube();
    
    // Then handle completion
    setTimeout(() => {
      cycler.handleStitchCompletion(
        currentStitch.threadId,
        currentStitch.id,
        20, // Perfect score
        20  // Total questions
      );
      
      // Get stats
      const stats = cycler.getStats();
      addLog(`After perfect score: ${stats.session.pendingChanges} pending changes`);
      
      // Update UI
      updateStitches(cycler);
    }, 500);
  };
  
  // Handle partial score
  const handlePartialScore = () => {
    if (!cycler || !currentStitch) return;
    
    addLog(`Simulating partial score for stitch ${currentStitch.id}`);
    
    // First cycle tube
    cycler.nextTube();
    
    // Then handle completion
    setTimeout(() => {
      cycler.handleStitchCompletion(
        currentStitch.threadId,
        currentStitch.id,
        15, // Partial score (not perfect)
        20  // Total questions
      );
      
      // Get stats
      const stats = cycler.getStats();
      addLog(`After partial score: ${stats.session.pendingChanges} pending changes`);
      
      // Update UI
      updateStitches(cycler);
    }, 500);
  };
  
  // Cycle to next tube
  const handleNextTube = () => {
    if (!cycler) return;
    
    addLog('Cycling to next tube');
    cycler.nextTube();
    updateStitches(cycler);
  };
  
  // Force persistence
  const handlePersist = async () => {
    if (!cycler) return;
    
    addLog('Forcing persistence of pending changes...');
    
    try {
      const result = await cycler.persist();
      addLog(`Persistence result: ${result ? 'Success' : 'Failed'}`);
      
      // Update stats
      const stats = cycler.getStats();
      addLog(`After persistence: ${stats.session.pendingChanges} pending changes`);
      
      // Refresh UI
      updateStitches(cycler);
    } catch (error) {
      addLog(`Error persisting changes: ${error}`);
    }
  };
  
  // Show stats
  const handleShowStats = () => {
    if (!cycler) return;
    
    const stats = cycler.getStats();
    addLog(`Session stats: ${JSON.stringify(stats.session)}`);
    addLog(`Cache stats: ${JSON.stringify(stats.cache)}`);
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
          <p>Initializing Triple-Helix system...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <Head>
        <title>Triple-Helix Tester</title>
      </Head>
      
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Triple-Helix Tester</h1>
        
        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-4">Controls</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleNextTube}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition"
            >
              Next Tube
            </button>
            <button
              onClick={handlePerfectScore}
              className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg transition"
              disabled={!currentStitch}
            >
              Perfect Score (20/20)
            </button>
            <button
              onClick={handlePartialScore}
              className="bg-yellow-600 hover:bg-yellow-500 px-4 py-2 rounded-lg transition"
              disabled={!currentStitch}
            >
              Partial Score (15/20)
            </button>
            <button
              onClick={handlePersist}
              className="bg-purple-600 hover:purple-500 px-4 py-2 rounded-lg transition"
            >
              Force Persistence
            </button>
            <button
              onClick={handleShowStats}
              className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg transition"
            >
              Show Stats
            </button>
          </div>
        </div>
        
        {/* Current status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">Current Status</h2>
            <div className="space-y-2">
              <p><span className="text-gray-400">Current Tube:</span> <span className="text-teal-400 font-semibold">Tube {currentTube}</span></p>
              <p><span className="text-gray-400">Current Stitch:</span> <span className="text-yellow-300">{currentStitch?.id || 'None'}</span></p>
              <p><span className="text-gray-400">Skip Number:</span> <span className={`font-bold ${
                !currentStitch ? 'text-gray-400' :
                currentStitch.skipNumber === 1 ? 'text-gray-300' :
                currentStitch.skipNumber === 3 ? 'text-blue-300' :
                currentStitch.skipNumber === 5 ? 'text-green-300' :
                currentStitch.skipNumber === 10 ? 'text-yellow-300' :
                currentStitch.skipNumber === 25 ? 'text-orange-300' : 'text-red-300'
              }`}>{currentStitch?.skipNumber || 'N/A'}</span></p>
              <p><span className="text-gray-400">Thread:</span> <span className="text-indigo-300">{currentStitch?.threadId || 'None'}</span></p>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">Current Tube Stitches</h2>
            <div className="overflow-auto max-h-40">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="text-left py-1 px-2">Position</th>
                    <th className="text-left py-1 px-2">Stitch ID</th>
                    <th className="text-left py-1 px-2">Skip Number</th>
                    <th className="text-left py-1 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tubeStitches.length === 0 ? (
                    <tr>
                      <td className="py-2 px-2 text-gray-500" colSpan={4}>No stitches found</td>
                    </tr>
                  ) : (
                    tubeStitches.map((stitch, index) => (
                      <tr key={stitch.id} className={currentStitch?.id === stitch.id ? "bg-blue-900/30" : ""}>
                        <td className="py-1 px-2">{stitch.position}</td>
                        <td className="py-1 px-2">{stitch.id.split('-').slice(-1)[0]}</td>
                        <td className="py-1 px-2">{stitch.skipNumber}</td>
                        <td className="py-1 px-2">
                          {stitch.position === 0 ? (
                            <span className="px-1.5 py-0.5 bg-green-600/30 text-green-400 rounded text-xs">Active</span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">Wait</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* System logs */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-2">System Logs</h2>
          <div className="bg-gray-900 p-2 rounded h-64 overflow-y-auto text-sm font-mono">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Use the controls above to generate activity.</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="py-0.5">
                  <span className="text-green-400">&gt;</span> <span className="text-gray-300">{log}</span>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* All Tubes Overview */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">All Tubes Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(tubeNumber => (
              <div key={tubeNumber} className={`p-3 rounded-lg ${currentTube === tubeNumber ? 'bg-blue-900/30 border border-blue-700' : 'bg-gray-900'}`}>
                <h3 className="font-semibold mb-2 flex items-center justify-between">
                  <span>Tube {tubeNumber}</span>
                  {currentTube === tubeNumber && (
                    <span className="px-2 py-0.5 bg-blue-600/50 text-blue-300 rounded-full text-xs">Current</span>
                  )}
                </h3>
                <div className="space-y-1 text-sm max-h-40 overflow-y-auto">
                  {allStitches
                    .filter(s => s.tubeNumber === tubeNumber)
                    .sort((a, b) => a.order_number - b.order_number)
                    .slice(0, 5)
                    .map(stitch => (
                      <div 
                        key={stitch.id} 
                        className={`p-1.5 rounded flex justify-between ${
                          stitch.order_number === 0 ? 'bg-green-900/20 border border-green-800/30' : 'bg-gray-800'
                        }`}
                      >
                        <span className="text-xs">{stitch.id.split('-').pop()}</span>
                        <span className={`text-xs font-mono ${
                          stitch.skipNumber === 1 ? 'text-gray-400' :
                          stitch.skipNumber === 3 ? 'text-blue-400' :
                          stitch.skipNumber === 5 ? 'text-green-400' :
                          stitch.skipNumber === 10 ? 'text-yellow-400' :
                          stitch.skipNumber === 25 ? 'text-orange-400' : 'text-red-400'
                        }`}>
                          Skip: {stitch.skipNumber}
                        </span>
                      </div>
                    ))}
                  {allStitches.filter(s => s.tubeNumber === tubeNumber).length === 0 && (
                    <div className="text-gray-500 text-xs p-1">No stitches in this tube</div>
                  )}
                  {allStitches.filter(s => s.tubeNumber === tubeNumber).length > 5 && (
                    <div className="text-gray-500 text-xs p-1">
                      + {allStitches.filter(s => s.tubeNumber === tubeNumber).length - 5} more stitches
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Documentation */}
        <div className="bg-gray-800 rounded-lg p-4 mt-6">
          <h2 className="text-xl font-semibold mb-2">Triple-Helix Flow</h2>
          <div className="space-y-2 text-sm text-gray-300">
            <p><span className="text-yellow-400 font-semibold">1.</span> When a stitch is completed, we first rotate to the next tube immediately</p>
            <p><span className="text-yellow-400 font-semibold">2.</span> Then we process the completion in the background</p>
            <p><span className="text-yellow-400 font-semibold">3.</span> If score is perfect, the skip number increases (1→3→5→10→25→100)</p>
            <p><span className="text-yellow-400 font-semibold">4.</span> The completed stitch moves to position = skipNumber</p>
            <p><span className="text-yellow-400 font-semibold">5.</span> All stitches between position 1 and skipNumber move up one position</p>
            <p><span className="text-yellow-400 font-semibold">6.</span> The next stitch becomes active at position 0</p>
          </div>
        </div>
      </div>
    </div>
  );
}