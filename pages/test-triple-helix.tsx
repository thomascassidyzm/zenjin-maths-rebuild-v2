import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import TubeCycler from '../components/TubeCycler';
import { ThreadData, StitchWithProgress } from '../lib/types/distinction-learning';
import { getSampleThreadData } from '../lib/sample-data';

/**
 * Triple-Helix Test Player
 * 
 * A streamlined player for testing the Triple-Helix system with:
 * - Perfect and partial score test buttons
 * - Skip number sequence [1, 3, 5, 10, 25, 100]
 * - Rotation lock to prevent double tube rotation
 * - Debugging information
 */
export default function TestTripleHelix() {
  const router = useRouter();
  const { isAuthenticated, user, userEmail } = useAuth();
  
  // State
  const [threadData, setThreadData] = useState<ThreadData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeStitch, setActiveStitch] = useState<StitchWithProgress | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string>('');
  const [cycleCount, setCycleCount] = useState(0);
  const [testState, setTestState] = useState<'ready' | 'running' | 'complete' | 'error'>('ready');
  const [testLog, setTestLog] = useState<string[]>([]);
  
  // Refs
  const tubeCyclerRef = useRef<any>(null);
  
  // Handle authentication and fetch thread data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch thread data and tube position from API if authenticated
        if (isAuthenticated) {
          console.log('Fetching user data from API...');
          
          const { fetchUserStitches } = await import('../lib/supabase-client');
          const data = await fetchUserStitches({
            prefetch: 5, // Prefetch 5 stitches per thread
            mode: 'restore'
          });
          
          if (!data) {
            throw new Error('Failed to fetch user stitches');
          }
          
          const { threads, tubePosition } = data;
          
          console.log(`Fetched ${threads.length} threads for user ${userEmail || user?.id || 'unknown'}`);
          if (tubePosition) {
            console.log(`Found saved tube position: Tube-${tubePosition.tubeNumber}, Thread-${tubePosition.threadId}`);
          }
          
          setThreadData(threads);
        } else {
          // Use sample data for unauthenticated users
          console.log('Using sample data for unauthenticated user');
          const sampleData = getSampleThreadData();
          setThreadData(sampleData);
        }
      } catch (error) {
        console.error('Error fetching thread data:', error);
        logMessage('Error: Failed to load thread data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [isAuthenticated, user?.id, userEmail]);
  
  // Add a message to the test log
  const logMessage = (message: string) => {
    setTestLog(prev => [message, ...prev.slice(0, 19)]);
  };
  
  // Handle stitch selection from TubeCycler
  const handleStitchSelected = (stitch: StitchWithProgress | null, threadId: string) => {
    console.log(`Stitch selected: ${stitch?.id || 'none'} from thread ${threadId}`);
    setActiveStitch(stitch);
    setActiveThreadId(threadId);
    
    if (stitch) {
      logMessage(`Selected stitch ${stitch.id} from thread ${threadId}`);
      logMessage(`Stitch position: ${stitch.order_number}, skip: ${stitch.skip_number}`);
    }
  };
  
  // Handle perfect score
  const handlePerfectScore = async () => {
    if (!activeStitch || !activeThreadId || !tubeCyclerRef.current) {
      logMessage('Error: No active stitch or thread');
      return;
    }
    
    logMessage(`Testing perfect score (20/20) for stitch ${activeStitch.id}`);
    
    // Get current state for comparison
    const beforeStitchId = activeStitch.id;
    const beforeSkip = activeStitch.skip_number;
    
    // Process the stitch completion
    const result = tubeCyclerRef.current.handleStitchCompletion(
      activeThreadId,
      activeStitch.id,
      20, // Perfect score
      20  // Total questions
    );
    
    // Log the result
    if (result) {
      logMessage(`Result: New stitch ${result.id}, position ${result.order_number}`);
      logMessage(`Skip number changed: ${beforeSkip} → ${result.skip_number}`);
    } else {
      logMessage('Error: Failed to process perfect score');
    }
    
    // Update cycle count
    setCycleCount(tubeCyclerRef.current.getCycleCount() || 0);
    
    // Wait for state to update then move to next tube
    setTimeout(() => {
      if (tubeCyclerRef.current) {
        tubeCyclerRef.current.nextTube();
      }
    }, 500);
  };
  
  // Handle partial score
  const handlePartialScore = () => {
    if (!activeStitch || !activeThreadId || !tubeCyclerRef.current) {
      logMessage('Error: No active stitch or thread');
      return;
    }
    
    logMessage(`Testing partial score (10/20) for stitch ${activeStitch.id}`);
    
    // Get current state for comparison
    const beforeStitchId = activeStitch.id;
    const beforeSkip = activeStitch.skip_number;
    
    // Process the stitch completion
    const result = tubeCyclerRef.current.handleStitchCompletion(
      activeThreadId,
      activeStitch.id,
      10, // Partial score
      20  // Total questions
    );
    
    // Log the result
    if (result) {
      logMessage(`Result: Same stitch ${result.id}, position ${result.order_number}`);
      logMessage(`Skip number reset: ${beforeSkip} → ${result.skip_number}`);
    } else {
      logMessage('Error: Failed to process partial score');
    }
    
    // Update cycle count
    setCycleCount(tubeCyclerRef.current.getCycleCount() || 0);
    
    // Wait for state to update then move to next tube
    setTimeout(() => {
      if (tubeCyclerRef.current) {
        tubeCyclerRef.current.nextTube();
      }
    }, 500);
  };
  
  // Handle manual tube cycling
  const handleNextTube = () => {
    if (!tubeCyclerRef.current) {
      logMessage('Error: TubeCycler not initialized');
      return;
    }
    
    logMessage('Manually cycling to next tube');
    tubeCyclerRef.current.nextTube();
    setCycleCount(tubeCyclerRef.current.getCycleCount() || 0);
  };
  
  // Run full progression test
  const runFullTest = async () => {
    if (!tubeCyclerRef.current) {
      logMessage('Error: TubeCycler not initialized');
      return;
    }
    
    setTestState('running');
    logMessage('Starting FULL Triple-Helix progression test');
    
    try {
      // Run test for all three tubes
      for (let i = 0; i < 3; i++) {
        // Get current tube/stitch info
        const currentStitch = activeStitch;
        const currentThreadId = activeThreadId;
        
        if (!currentStitch || !currentThreadId) {
          logMessage('Error: No active stitch or thread');
          continue;
        }
        
        // Log current state
        logMessage(`Tube ${i+1}: Testing stitch ${currentStitch.id}`);
        logMessage(`Position: ${currentStitch.order_number}, Skip: ${currentStitch.skip_number}`);
        
        // Process perfect score
        const result = tubeCyclerRef.current.handleStitchCompletion(
          currentThreadId,
          currentStitch.id,
          20, // Perfect score
          20  // Total questions
        );
        
        // Log result
        if (result) {
          logMessage(`Result: Skip number ${currentStitch.skip_number} → ${result.skip_number}`);
        }
        
        // Wait then move to next tube
        await new Promise(r => setTimeout(r, 500));
        tubeCyclerRef.current.nextTube();
        await new Promise(r => setTimeout(r, 500));
      }
      
      // Update cycle count
      setCycleCount(tubeCyclerRef.current.getCycleCount() || 0);
      
      setTestState('complete');
      logMessage('Full test completed successfully');
    } catch (error) {
      console.error('Error running full test:', error);
      logMessage(`Error running full test: ${error}`);
      setTestState('error');
    }
  };
  
  // If loading, show spinner
  if (isLoading) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center">
        <div className="text-center text-white">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
          <p>Loading Triple-Helix Test Environment...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen player-bg p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Triple-Helix System Test</h1>
        
        {/* Main content area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: TubeCycler and controls */}
          <div className="lg:col-span-2">
            {/* TubeCycler (hidden UI but functional) */}
            <div className="mb-4">
              <TubeCycler
                ref={tubeCyclerRef}
                threadData={threadData}
                userId={user?.id || 'anonymous'}
                onStitchSelected={handleStitchSelected}
              />
            </div>
            
            {/* Test controls */}
            <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">Test Controls</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button
                  onClick={handlePerfectScore}
                  disabled={!activeStitch}
                  className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Perfect Score (20/20)
                </button>
                
                <button
                  onClick={handlePartialScore}
                  disabled={!activeStitch}
                  className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Partial Score (10/20)
                </button>
                
                <button
                  onClick={handleNextTube}
                  disabled={!tubeCyclerRef.current}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Next Tube
                </button>
              </div>
              
              <button
                onClick={runFullTest}
                disabled={testState === 'running' || !tubeCyclerRef.current}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                {testState === 'running' ? 'Test Running...' : 'Run Full Progression Test'}
              </button>
            </div>
            
            {/* Current state */}
            <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Current State</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/30 p-4 rounded-lg">
                  <h3 className="text-lg font-bold text-white mb-2">Active Stitch</h3>
                  {activeStitch ? (
                    <div>
                      <p className="text-white">ID: <span className="text-teal-300 font-mono">{activeStitch.id}</span></p>
                      <p className="text-white">Thread: <span className="text-teal-300 font-mono">{activeThreadId}</span></p>
                      <p className="text-white">Order: <span className="text-teal-300 font-mono">{activeStitch.order_number}</span></p>
                      <p className="text-white">Skip Number: <span className="text-teal-300 font-mono">{activeStitch.skip_number}</span></p>
                      <p className="text-white">Distractor Level: <span className="text-teal-300 font-mono">{activeStitch.distractor_level}</span></p>
                    </div>
                  ) : (
                    <p className="text-white text-opacity-70">No active stitch</p>
                  )}
                </div>
                
                <div className="bg-black/30 p-4 rounded-lg">
                  <h3 className="text-lg font-bold text-white mb-2">System Stats</h3>
                  <p className="text-white">Cycle Count: <span className="text-teal-300 font-mono">{cycleCount}</span></p>
                  <p className="text-white">Threads: <span className="text-teal-300 font-mono">{threadData.length}</span></p>
                  <p className="text-white">Skip Sequence: <span className="text-teal-300 font-mono">[1, 3, 5, 10, 25, 100]</span></p>
                  <p className="text-white">Authenticated: <span className="text-teal-300 font-mono">{isAuthenticated ? 'Yes' : 'No'}</span></p>
                  <p className="text-white">User: <span className="text-teal-300 font-mono">{userEmail || user?.id || 'anonymous'}</span></p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right column: Log and debug info */}
          <div>
            <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-xl p-6 h-full">
              <h2 className="text-xl font-bold text-white mb-4">Test Log</h2>
              
              <div className="bg-black/50 rounded-lg p-4 h-[600px] overflow-y-auto font-mono text-sm">
                {testLog.length === 0 ? (
                  <p className="text-white text-opacity-50">No log entries yet. Run a test to see results.</p>
                ) : (
                  testLog.map((entry, index) => (
                    <div key={index} className="mb-2 pb-2 border-b border-white/10 text-white">
                      {entry}
                    </div>
                  ))
                )}
              </div>
              
              <div className="mt-4">
                <button
                  onClick={() => setTestLog([])}
                  className="bg-red-600/70 hover:bg-red-500/90 text-white text-sm py-2 px-4 rounded transition-colors"
                >
                  Clear Log
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center text-white text-opacity-50 text-sm">
          <p>Triple-Helix Test Environment | Fixed Skip Sequence: [1, 3, 5, 10, 25, 100] | Rotation Lock Enabled</p>
        </div>
      </div>
    </div>
  );
}