import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { ThreadData } from '../lib/types/distinction-learning';
import { StitchSequencer } from '../lib/StitchSequencer';
import TubeCycler, { TubeCyclerRefHandle } from '../components/TubeCycler';
import TubeVisualizer from '../components/TubeVisualizer';
import { getSampleThreadData } from '../lib/sample-data';

export default function TubeDiagnostic() {
  const router = useRouter();
  const [threadData, setThreadData] = useState<ThreadData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStitch, setSelectedStitch] = useState<any>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const cyclerRef = useRef<TubeCyclerRefHandle>(null);
  const [cycleCount, setCycleCount] = useState(0);
  const [tubeIntegrity, setTubeIntegrity] = useState<any>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(true);
  const [isRealData, setIsRealData] = useState(false);
  const [userId, setUserId] = useState<string>("diagnostic-user");
  const [visualizerKey, setVisualizerKey] = useState(0); // Force re-render when data changes

  useEffect(() => {
    // Fetch real data from the database without relying on sample data
    const fetchRealData = async () => {
      try {
        console.log('Fetching thread data from database...');
        setIsLoading(true);
        
        // Import the client function to fetch stitches
        const { fetchUserStitches } = await import('../lib/supabase-client');
        
        // Try to get user ID from query param
        const paramUserId = router.query.userId as string;
        let currentUserId: string;
        
        if (paramUserId) {
          console.log(`Using user ID from query param: ${paramUserId}`);
          currentUserId = paramUserId;
        } else {
          // Generate a diagnostic user ID if none provided
          currentUserId = `diag-${Date.now()}`;
          console.log(`No user ID provided, using generated ID: ${currentUserId}`);
        }
        
        // Update state
        setUserId(currentUserId);
        
        // Fetch data with prefetch option to get multiple stitches per thread
        const result = await fetchUserStitches({
          prefetch: 20, // Prefetch more stitches per thread for better testing
          mode: 'restore', // Use restore mode to get proper tube assignment
          userId: currentUserId // Pass the diagnostic user ID to ensure API returns the right data
        });
        
        if (!result || result.threads.length === 0) {
          console.error('No thread data found in database');
          alert('Error: No thread data found in the database. Please check your database setup.');
          setThreadData([]);
        } else {
          const { threads, tubePosition } = result;
          console.log(`Loaded ${threads.length} threads from database`);
          
          if (tubePosition) {
            console.log(`Found saved tube position: Tube-${tubePosition.tubeNumber}, Thread-${tubePosition.threadId}`);
          }
          
          // Log tube distribution
          const tubeDistribution: Record<string, number> = {'1': 0, '2': 0, '3': 0, 'undefined': 0};
          threads.forEach(thread => {
            if (thread.tube_number) {
              const tubeKey = thread.tube_number.toString();
              tubeDistribution[tubeKey] = (tubeDistribution[tubeKey] || 0) + 1;
            } else {
              tubeDistribution['undefined']++;
            }
          });
          console.log('Tube distribution:', tubeDistribution);
          
          // Calculate total stitches
          let totalStitches = 0;
          threads.forEach(thread => {
            totalStitches += thread.stitches.length;
            
            // Check for thread tube number
            if (!thread.tube_number) {
              console.warn(`Warning: Thread ${thread.thread_id} has no tube_number assigned`);
            }
            
            // Check for ready stitches
            const readyStitches = thread.stitches.filter(s => s.order_number === 0);
            if (readyStitches.length > 1) {
              console.warn(`Warning: Thread ${thread.thread_id} has ${readyStitches.length} ready stitches`);
            }
          });
          
          console.log(`Total stitches loaded: ${totalStitches}`);
          
          setThreadData(threads);
          setIsRealData(true);
        }
      } catch (error) {
        console.error('Error fetching thread data:', error);
        alert('Error fetching thread data. Check console for details.');
        setThreadData([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Only run this when router is ready
    if (router.isReady) {
      fetchRealData();
    }
  }, [router.isReady, router.query.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle stitch selection
  const handleStitchSelected = (stitch: any, threadId: string) => {
    setSelectedStitch(stitch);
    setSelectedThreadId(threadId);
  };

  // Simulate perfect score completion of current stitch
  const handlePerfectScore = async () => {
    if (!cyclerRef.current || !selectedStitch || !selectedThreadId) return;
    console.log(`Completing stitch ${selectedStitch.id} with perfect score`);
    
    // Complete the stitch with a perfect score (20/20)
    cyclerRef.current.handleStitchCompletion(
      selectedThreadId,
      selectedStitch.id,
      20, // Perfect score
      20  // Total questions
    );
    
    // Force visualizer to update after a short delay
    setTimeout(() => {
      // Update visualization by incrementing key
      setVisualizerKey(prev => prev + 1);
      // Also update the thread data from the cycler
      if (cyclerRef.current) {
        const updatedThreads = cyclerRef.current.getSortedThreads();
        setThreadData([...updatedThreads]);
        
        // Make sure cycle count is updated
        updateCycleCountFromCycler();
      }
    }, 100);
    
    // Also manually persist the stitch progress to the database
    // This is critical for making the diagnostic tool work as a fast-forward simulator
    try {
      const { updateUserStitchProgress } = await import('../lib/supabase-client');
      updateUserStitchProgress(
        userId,
        selectedThreadId,
        selectedStitch.id,
        0, // We'll put it at position 0 initially
        selectedStitch.skip_number || 3, 
        selectedStitch.distractor_level || 'L1',
        false // Not urgent - make sure it fully completes
      ).then(success => {
        if (success) {
          console.log(`DIAGNOSTIC: Successfully saved stitch progress for ${selectedStitch.id}`);
        } else {
          console.error(`DIAGNOSTIC: Failed to save stitch progress for ${selectedStitch.id}`);
        }
      });
    } catch (err) {
      console.error('DIAGNOSTIC: Error saving stitch progress:', err);
    }
  };
  
  // Simulate non-perfect score completion of current stitch
  const handlePartialScore = async () => {
    if (!cyclerRef.current || !selectedStitch || !selectedThreadId) return;
    console.log(`Completing stitch ${selectedStitch.id} with partial score`);
    
    // Complete the stitch with a non-perfect score (15/20)
    cyclerRef.current.handleStitchCompletion(
      selectedThreadId,
      selectedStitch.id,
      15, // Partial score
      20  // Total questions
    );
    
    // Force visualizer to update after a short delay
    setTimeout(() => {
      // Update visualization by incrementing key
      setVisualizerKey(prev => prev + 1);
      // Also update the thread data from the cycler
      if (cyclerRef.current) {
        const updatedThreads = cyclerRef.current.getSortedThreads();
        setThreadData([...updatedThreads]);
        
        // Make sure cycle count is updated
        updateCycleCountFromCycler();
      }
    }, 100);
    
    // Also manually persist the stitch progress to the database
    // This is critical for making the diagnostic tool work as a fast-forward simulator
    try {
      const { updateUserStitchProgress } = await import('../lib/supabase-client');
      updateUserStitchProgress(
        userId,
        selectedThreadId,
        selectedStitch.id,
        0, // Keep it as the active stitch since score wasn't perfect
        3, // Reset skip number to 3 for non-perfect score
        selectedStitch.distractor_level || 'L1',
        false // Not urgent - make sure it fully completes
      ).then(success => {
        if (success) {
          console.log(`DIAGNOSTIC: Successfully saved stitch progress for ${selectedStitch.id}`);
        } else {
          console.error(`DIAGNOSTIC: Failed to save stitch progress for ${selectedStitch.id}`);
        }
      });
    } catch (err) {
      console.error('DIAGNOSTIC: Error saving stitch progress:', err);
    }
  };
  
  // Move to the next tube manually
  const handleNextTube = () => {
    if (!cyclerRef.current) return;
    console.log('Moving to next tube');
    
    // Get current tube for debugging
    const currentTube = cyclerRef.current.getCurrentTube();
    console.log(`Before cycling: Current tube is ${currentTube}`);
    
    // Move to the next tube
    cyclerRef.current.nextTube();
    
    // Force visualizer to update after a short delay
    setTimeout(() => {
      // Log the new current tube for debugging
      if (cyclerRef.current) {
        const newTube = cyclerRef.current.getCurrentTube();
        console.log(`After cycling: Current tube is now ${newTube}`);
        
        // Update visualization by incrementing key
        setVisualizerKey(prev => prev + 1);
        
        // Also update the thread data from the cycler
        const updatedThreads = cyclerRef.current.getSortedThreads();
        setThreadData([...updatedThreads]);
        
        // Manually update the cycle count
        updateCycleCountFromCycler();
      }
    }, 100);
  };
  
  // Check tube integrity
  const checkTubeIntegrity = () => {
    if (!cyclerRef.current) return;
    console.log('Checking tube integrity');
    const integrity = cyclerRef.current.checkTubeIntegrity();
    setTubeIntegrity(integrity);
    
    // Force visualizer to update after a short delay
    setTimeout(() => {
      // Update visualization by incrementing key
      setVisualizerKey(prev => prev + 1);
      // Also update the thread data from the cycler
      if (cyclerRef.current) {
        const updatedThreads = cyclerRef.current.getSortedThreads();
        setThreadData([...updatedThreads]);
        
        // Make sure cycle count is updated
        updateCycleCountFromCycler();
      }
    }, 100);
  };
  
  // Reset user progress
  const handleResetProgress = async () => {
    if (!userId) {
      alert('No user ID available. Please refresh the page.');
      return;
    }
    
    if (!confirm(`Are you sure you want to reset all progress for user ${userId}?\nThis will delete all learning progress data and cannot be undone.`)) {
      return;
    }
    
    try {
      console.log(`Resetting progress for user ${userId}...`);
      const response = await fetch('/api/reset-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`Progress reset successfully for user ${userId}.`);
        // Just refresh the page to reload everything
        window.location.reload();
      } else {
        console.error('Error resetting progress:', result);
        // Show a more detailed error message
        alert(`Failed to reset progress for user ${userId}: ${result.error}\n\nThis is likely due to a permission issue with the diagnostic user.\nCheck browser console for more details.`);
      }
    } catch (error) {
      console.error('Error calling reset-progress API:', error);
      alert('An error occurred while resetting progress. Check console for details.');
    }
  };
  
  // Update cycle count when it changes in the TubeCycler
  useEffect(() => {
    // Check immediately on mount
    if (cyclerRef.current) {
      const initialCount = cyclerRef.current.getCycleCount();
      if (initialCount !== cycleCount) {
        setCycleCount(initialCount);
      }
    }
    
    // Then check periodically
    const interval = setInterval(() => {
      if (cyclerRef.current) {
        const newCount = cyclerRef.current.getCycleCount();
        if (newCount !== cycleCount) {
          console.log(`CYCLE COUNT: Updated from ${cycleCount} to ${newCount}`);
          setCycleCount(newCount);
        }
      }
    }, 500); // Check more frequently
    
    return () => clearInterval(interval);
  }, [cycleCount, cyclerRef]);
  
  // Also update cycle count after certain operations
  const updateCycleCountFromCycler = () => {
    if (cyclerRef.current) {
      const newCount = cyclerRef.current.getCycleCount();
      if (newCount !== cycleCount) {
        console.log(`CYCLE COUNT: Manually updated from ${cycleCount} to ${newCount}`);
        setCycleCount(newCount);
      }
    }
  };

  return (
    <div className="min-h-screen player-bg">
      <Head>
        <title>Tube Cycling Diagnostic | Zenjin Maths</title>
      </Head>

      {/* Header */}
      <header className="bg-white bg-opacity-20 backdrop-blur-lg shadow-xl">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">Tube Cycling Diagnostic</h1>
            {!isLoading && (
              <div className={`text-xs mt-1 px-2 py-0.5 rounded-sm inline-block ${
                isRealData ? 'bg-green-600/50 text-white' : 'bg-yellow-600/50 text-white'
              }`}>
                {isRealData ? 'Using real database data' : 'Using sample data'} | User ID: {userId}
              </div>
            )}
          </div>
          <a
            href="/"
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1 rounded"
          >
            Back to Home
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-white">
              <div className="inline-block animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full mb-4"></div>
              <p>Connecting to database...</p>
              <p className="text-white/60 text-sm mt-1">Trying to load real data before falling back to samples</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {/* Control Panel */}
            <div className="bg-black/30 p-6 rounded-xl shadow-lg">
              <h2 className="text-xl font-semibold text-white mb-4">Tube Cycling Controls</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <div className="bg-indigo-900/30 p-4 rounded-lg border border-indigo-400/30">
                  <h3 className="font-medium text-indigo-300 mb-3">Current Status</h3>
                  <p className="text-sm text-white mb-2">
                    <span className="font-medium">Current Tube:</span>{" "}
                    <span className="text-teal-300">{cyclerRef.current?.getCurrentTube() || "None"}</span>
                  </p>
                  <p className="text-sm text-white mb-2">
                    <span className="font-medium">Active Thread:</span>{" "}
                    <span className="text-teal-300">{cyclerRef.current?.getCurrentThread() || "None"}</span>
                  </p>
                  <p className="text-sm text-white mb-2">
                    <span className="font-medium">Active Stitch:</span>{" "}
                    <span className="text-teal-300">{selectedStitch?.id || "None"}</span>
                  </p>
                  <p className="text-sm text-white mb-2">
                    <span className="font-medium">Cycle Count:</span>{" "}
                    <span className="text-teal-300">{cycleCount}</span>
                  </p>
                  <div className="mt-3 pt-2 border-t border-indigo-500/20">
                    <p className="text-xs font-medium text-indigo-300/90">Database Connection</p>
                    <p className="text-xs text-white/80 mt-1">
                      <span className="font-medium">User ID:</span>{" "}
                      <span className="bg-indigo-900/60 rounded px-1 py-0.5">{userId}</span>
                    </p>
                    <p className="text-xs text-indigo-300/70 mt-1">
                      {isRealData ? "Using real database data" : "Using sample data"}
                    </p>
                  </div>
                </div>
                
                <div className="bg-teal-900/30 p-4 rounded-lg border border-teal-400/30">
                  <h3 className="font-medium text-teal-300 mb-3">Controls</h3>
                  <div className="grid grid-cols-2 gap-2 h-[calc(100%-2rem)]">
                    <button
                      onClick={handleNextTube}
                      className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-3 rounded-lg transition-colors"
                      disabled={!cyclerRef.current}
                    >
                      Next Tube
                    </button>
                    <button
                      onClick={checkTubeIntegrity}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-lg transition-colors"
                      disabled={!cyclerRef.current}
                    >
                      Check Integrity
                    </button>
                    <button
                      onClick={handlePerfectScore}
                      className="bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-lg transition-colors"
                      disabled={!selectedStitch}
                    >
                      Perfect Score
                    </button>
                    <button
                      onClick={handlePartialScore}
                      className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-3 rounded-lg transition-colors"
                      disabled={!selectedStitch}
                    >
                      Partial Score
                    </button>
                    
                    {/* No direct tube buttons needed, just use the main Next Tube button */}
                    <button
                      onClick={handleResetProgress}
                      className="col-span-2 mt-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                    >
                      Reset All Progress
                    </button>
                  </div>
                </div>
                
                <div className="bg-purple-900/30 p-4 rounded-lg border border-purple-400/30">
                  <h3 className="font-medium text-purple-300 mb-3">Tube Integrity</h3>
                  {tubeIntegrity ? (
                    <div className="space-y-2">
                      {Object.entries(tubeIntegrity).map(([tube, status]: [string, any]) => (
                        <div 
                          key={tube} 
                          className={`p-2 rounded ${
                            status.valid ? 'bg-green-900/30 border border-green-500/30' : 'bg-red-900/30 border border-red-500/30'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-white font-medium">Tube-{tube}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              status.valid ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            }`}>
                              {status.valid ? 'VALID' : 'INVALID'}
                            </span>
                          </div>
                          <div className="flex justify-between mt-1">
                            <p className="text-xs text-white/70">
                              {status.readyStitchCount} ready {status.readyStitchCount === 1 ? 'stitch' : 'stitches'}
                            </p>
                            <p className="text-xs text-white/70">
                              {status.threadCount || 0} {(status.threadCount || 0) === 1 ? 'thread' : 'threads'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-white/70 text-sm italic">
                      Click "Check Integrity" to verify tube integrity
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium text-teal-300">Diagnostic Output</h3>
                <button
                  onClick={() => setShowDebugInfo(!showDebugInfo)}
                  className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded"
                >
                  {showDebugInfo ? 'Hide Debug Info' : 'Show Debug Info'}
                </button>
              </div>
              
              <div className="bg-black/50 p-4 rounded-lg border border-gray-500/30 h-64 overflow-auto">
                <div className="text-gray-300 text-sm font-mono whitespace-pre-wrap">
                  <p className="text-green-400">// Open your browser console (F12) to see detailed logs</p>
                  <p className="text-white/60">// Using {isRealData ? 'REAL DATABASE DATA' : 'SAMPLE TEST DATA'}</p>
                  {isRealData ? (
                    <p className="text-green-400/80">// Changes will be saved to the database for user: {userId}</p>
                  ) : (
                    <p className="text-yellow-400/80">// Using sample data - changes will not be persisted</p>
                  )}
                  <p className="text-white/60">// Use the controls above to test the tube cycling system</p>
                  <p className="text-white/60">// Check tube integrity after each operation</p>
                </div>
              </div>
            </div>
            
            {/* Tube Cycler Component */}
            <div className="bg-white/10 p-6 rounded-xl shadow-lg">
              <TubeCycler
                ref={cyclerRef}
                threadData={threadData}
                userId={userId}
                onStitchSelected={handleStitchSelected}
              />
            </div>
            
            {/* Tube Visualizer - Shows tube contents */}
            <div className="bg-black/30 p-6 rounded-xl shadow-lg">
              <TubeVisualizer 
                key={visualizerKey} // Key forces re-render when data changes
                threadData={threadData}
                maxPositions={50}
                highlightUpdates={true}
              />
            </div>

            {/* Instructions */}
            <div className="bg-black/30 p-6 rounded-xl shadow-lg">
              <h2 className="text-xl font-semibold text-white mb-4">How to Test the Tube Cycling System</h2>
              <ol className="list-decimal list-inside text-white/80 space-y-2 ml-2">
                <li>Use <span className="text-teal-300 font-medium">Next Tube</span> to cycle through tubes (Tube-1 → Tube-2 → Tube-3 → Tube-1)</li>
                <li>Use <span className="text-green-300 font-medium">Perfect Score</span> to complete a stitch with 20/20 and advance it deeper in its tube</li>
                <li>Use <span className="text-amber-300 font-medium">Partial Score</span> to complete a stitch with 15/20 and keep it at position 0</li>
                <li>Use <span className="text-blue-300 font-medium">Check Integrity</span> to verify that each tube has exactly one ready stitch</li>
                <li>Watch the console (F12) for detailed logs of what's happening</li>
              </ol>
              <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-600/30 rounded text-sm text-white/80">
                <p className="font-medium text-yellow-300 mb-1">Key Concepts to Test:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Each tube should always have exactly ONE stitch with order_number = 0</li>
                  <li>After a perfect score, the stitch moves to position = skip_number</li>
                  <li>Skip number increases in sequence: 3 → 5 → 10 → 25 → 100</li>
                  <li>All stitches with positions 1 to skip_number are decremented by 1</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}