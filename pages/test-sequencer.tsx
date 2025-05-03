import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { fetchUserStitches } from '../lib/supabase-client';
import { ThreadData, StitchWithProgress } from '../lib/types/distinction-learning';
import { useAuth } from '../context/AuthContext';
import { StitchSequencer } from '../lib/StitchSequencer';

export default function TestSequencer() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [threadData, setThreadData] = useState<ThreadData[] | null>(null);
  const [sequencer, setSequencer] = useState<StitchSequencer | null>(null);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [activeStitch, setActiveStitch] = useState<StitchWithProgress | null>(null);
  const [upcomingStitches, setUpcomingStitches] = useState<StitchWithProgress[]>([]);
  const [testScore, setTestScore] = useState<number>(20); // Default to perfect score
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setDebugLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]}: ${message}`]);
  };

  // Load stitch data and initialize sequencer
  useEffect(() => {
    async function loadStitches() {
      try {
        setIsLoading(true);
        
        addLog('Fetching user stitches...');
        
        if (user) {
          addLog(`User ID: ${user.id}`);
        } else {
          addLog('No user ID available, using anonymous');
        }
        
        const result = await fetchUserStitches();
        
        if (result === null) {
          addLog('Error: Failed to fetch stitch data from API');
          setError('Failed to fetch stitch data from API.');
          return;
        } 
        
        const { threads, tubePosition } = result;
        
        if (threads.length === 0) {
          addLog('Error: No threads found in the database');
          setError('No threads found in the database.');
          return;
        }
        
        addLog(`Success! Received ${threads.length} threads`);
        if (tubePosition) {
          addLog(`Found saved tube position: Tube-${tubePosition.tubeNumber}, Thread-${tubePosition.threadId}`);
        }
        
        setThreadData(threads);
        
        // Initialize sequencer with first thread if available
        if (threads.length > 0) {
          const userId = user?.id || 'anonymous';
          addLog(`Initializing sequencer with user ID: ${userId}`);
          
          // Check for multiple active stitches in each thread
          threads.forEach(thread => {
            const activeCount = thread.stitches.filter(s => s.order_number === 0).length;
            if (activeCount > 1) {
              addLog(`Warning: Thread ${thread.thread_id} has ${activeCount} active stitches`);
            }
          });
          
          const newSequencer = new StitchSequencer(
            threads, 
            userId, 
            {}, 
            tubePosition ? {
              tubeNumber: tubePosition.tubeNumber,
              threadId: tubePosition.threadId
            } : undefined
          );
          setSequencer(newSequencer);
          
          // Set default selected thread
          const firstThreadId = threads[0].thread_id;
          setSelectedThread(firstThreadId);
          
          // Get active stitch and upcoming stitches
          const active = newSequencer.getActiveStitch(firstThreadId);
          const upcoming = newSequencer.getUpcomingStitches(firstThreadId);
          
          if (active) {
            addLog(`Active stitch: ${active.name} (ID: ${active.id})`);
          } else {
            addLog('No active stitch found');
          }
          
          addLog(`Found ${upcoming.length} upcoming stitches`);
          
          setActiveStitch(active);
          setUpcomingStitches(upcoming);
        }
        
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        addLog(`Exception loading stitches: ${errorMessage}`);
        console.error('Exception loading stitches:', err);
        setError(`Error: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    }

    // Only load stitches if auth is not loading
    if (!authLoading) {
      loadStitches();
    }
    
    // Cleanup sequencer on unmount
    return () => {
      if (sequencer) {
        sequencer.destroy();
      }
    };
  }, [authLoading, user]);

  // Handle thread selection change
  const handleThreadChange = (threadId: string) => {
    if (!sequencer || !threadId) return;
    
    addLog(`Switching to thread: ${threadId}`);
    setSelectedThread(threadId);
    
    // Update active and upcoming stitches
    const active = sequencer.getActiveStitch(threadId);
    const upcoming = sequencer.getUpcomingStitches(threadId);
    
    if (active) {
      addLog(`New active stitch: ${active.name} (ID: ${active.id})`);
    } else {
      addLog('No active stitch found for new thread');
    }
    
    addLog(`Found ${upcoming.length} upcoming stitches for new thread`);
    
    setActiveStitch(active);
    setUpcomingStitches(upcoming);
  };

  // Handle completion of a stitch
  const handleCompleteStitch = async () => {
    if (!sequencer || !selectedThread || !activeStitch) {
      addLog('Cannot complete stitch: sequencer, thread or active stitch is missing');
      return;
    }
    
    try {
      addLog(`Completing stitch ${activeStitch.name} with score ${testScore}/20`);
      
      // Total questions is always 20 in our sample
      const totalQuestions = 20;
      
      // Complete the active stitch with test score
      const newActiveStitch = sequencer.handleStitchCompletion(
        selectedThread,
        activeStitch.id,
        testScore,
        totalQuestions
      );
      
      if (newActiveStitch) {
        addLog(`New active stitch: ${newActiveStitch.name} (ID: ${newActiveStitch.id})`);
      } else {
        addLog('No new active stitch returned');
      }
      
      // Update UI
      setActiveStitch(newActiveStitch);
      
      // Get updated upcoming stitches
      const newUpcoming = sequencer.getUpcomingStitches(selectedThread);
      addLog(`Found ${newUpcoming.length} upcoming stitches after completion`);
      setUpcomingStitches(newUpcoming);
      
      // Force sync updates to server
      addLog('Syncing updates to server...');
      const syncResult = await sequencer.syncUpdates();
      addLog(`Sync result: ${syncResult ? 'Success' : 'Failed'}`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      addLog(`Error completing stitch: ${errorMessage}`);
      console.error('Error completing stitch:', err);
      setError(`Error completing stitch: ${errorMessage}`);
    }
  };

  // Render loading state
  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600">{authLoading ? 'Checking authentication...' : 'Loading stitches...'}</p>
        </div>
      </div>
    );
  }
  
  // Show auth status
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-white mb-4 text-center">Authentication Required</h1>
          <p className="text-white text-opacity-80 text-center mb-6">
            You need to be logged in to test the sequencer.
          </p>
          <div className="flex space-x-4 justify-center">
            <button
              onClick={() => router.push('/login')}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => router.push('/')}
              className="bg-white bg-opacity-10 hover:bg-opacity-20 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen player-bg p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-white">Stitch Sequencer Test</h1>
            <div className="flex space-x-4">
              <a
                href="/test-thread-cycler"
                className="text-teal-300 hover:text-teal-200 transition-colors"
              >
                Thread Cycler
              </a>
              <a
                href="/test-stitches"
                className="text-teal-300 hover:text-teal-200 transition-colors"
              >
                Stitches Data
              </a>
              <a
                href="/admin-dashboard"
                className="text-teal-300 hover:text-teal-200 transition-colors"
              >
                Dashboard
              </a>
              <a
                href="/"
                className="text-teal-300 hover:text-teal-200 transition-colors"
              >
                Home
              </a>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-red-500/20 border border-red-300/30 text-red-100 rounded-lg p-4 mb-6">
              <h2 className="text-red-100 text-lg font-semibold mb-2">Error</h2>
              <p className="text-red-100">{error}</p>
            </div>
          )}

          {/* No data message */}
          {(!threadData || threadData.length === 0) && !error && (
            <div className="bg-yellow-500/20 border border-yellow-300/30 text-yellow-100 rounded-lg p-4 mb-6">
              <h2 className="text-yellow-100 text-lg font-semibold mb-2">No Data Available</h2>
              <p className="text-yellow-100">No thread data is available. This could be because:</p>
              <ul className="list-disc list-inside mt-2 text-yellow-100">
                <li>The database doesn't have any threads or stitches</li>
                <li>There was an error fetching the data</li>
                <li>You haven't been assigned any threads yet</li>
              </ul>
              <div className="mt-4">
                <button
                  onClick={() => router.push('/check-db')}
                  className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Check Database
                </button>
              </div>
            </div>
          )}

          {/* Main content when we have data */}
          {threadData && threadData.length > 0 && (
            <div className="space-y-6">
              {/* Thread selection */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h2 className="text-lg font-semibold mb-3">Select Thread</h2>
                <div className="flex space-x-2 flex-wrap">
                  {threadData.map((thread) => (
                    <button
                      key={thread.thread_id}
                      className={`px-4 py-2 mb-2 rounded-lg transition-colors ${
                        selectedThread === thread.thread_id
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                      }`}
                      onClick={() => handleThreadChange(thread.thread_id)}
                    >
                      Thread: {thread.thread_id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Test controls */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h2 className="text-lg font-semibold mb-3">Test Settings</h2>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Test Score (out of 20)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={testScore}
                    onChange={(e) => setTestScore(parseInt(e.target.value, 10))}
                    className="border border-gray-300 rounded-md px-3 py-2 w-32"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {testScore === 20 ? '🎉 Perfect Score (will advance stitch)' : '⚠️ Less than Perfect (will reset skip number)'}
                  </p>
                </div>
                
                <button
                  onClick={handleCompleteStitch}
                  disabled={!activeStitch}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Complete Current Stitch
                </button>
              </div>

              {/* Active stitch */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h2 className="text-lg font-semibold mb-3">Active Stitch</h2>
                {activeStitch ? (
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-blue-800">{activeStitch.name}</h3>
                        <p className="text-sm text-gray-600">{activeStitch.description}</p>
                        <p className="text-xs text-gray-500 mt-1">ID: {activeStitch.id}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Active (Order: 0)
                        </span>
                        <div className="mt-1 space-x-1">
                          <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            Skip: {activeStitch.skip_number}
                          </span>
                          <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                            Level: {activeStitch.distractor_level}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-500 text-xs mt-2">Questions: {activeStitch.questions?.length || 0}</p>
                  </div>
                ) : (
                  <p className="text-gray-500">No active stitch.</p>
                )}
              </div>

              {/* Upcoming stitches */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h2 className="text-lg font-semibold mb-3">Upcoming Stitches</h2>
                {upcomingStitches.length > 0 ? (
                  <div className="space-y-2">
                    {upcomingStitches.map((stitch) => (
                      <div key={stitch.id} className="bg-white p-3 rounded-lg shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{stitch.name}</h3>
                            <p className="text-sm text-gray-600">{stitch.description}</p>
                            <p className="text-xs text-gray-500 mt-1">ID: {stitch.id}</p>
                          </div>
                          <div className="text-right">
                            <span className="inline-block px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                              Order: {stitch.order_number}
                            </span>
                            <div className="mt-1 space-x-1">
                              <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                Skip: {stitch.skip_number}
                              </span>
                              <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                                Level: {stitch.distractor_level}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No upcoming stitches.</p>
                )}
              </div>
              
              {/* Debug logs */}
              <div className="bg-gray-800 p-4 rounded-lg">
                <h2 className="text-lg font-semibold mb-3 text-white flex justify-between">
                  <span>Debug Logs</span>
                  <button 
                    onClick={() => setDebugLogs([])}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Clear
                  </button>
                </h2>
                <div className="bg-black rounded overflow-auto h-48 p-2">
                  {debugLogs.length === 0 ? (
                    <p className="text-gray-500">No logs yet.</p>
                  ) : (
                    <div className="font-mono text-xs">
                      {debugLogs.map((log, index) => (
                        <div key={index} className="text-green-400">{log}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}