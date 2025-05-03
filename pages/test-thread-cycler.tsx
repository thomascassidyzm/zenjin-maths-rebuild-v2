import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import ThreadCycler from '../components/ThreadCycler';
import { ThreadData, StitchWithProgress } from '../lib/types/distinction-learning';

export default function TestThreadCycler() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [threadData, setThreadData] = useState<ThreadData[]>([]);
  const [activeStitch, setActiveStitch] = useState<StitchWithProgress | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [testScore, setTestScore] = useState<number>(10);
  const [totalQuestions, setTotalQuestions] = useState<number>(10);
  
  // Reference to the ThreadCycler component
  const threadCyclerRef = useRef<any>(null);

  // Add a log entry
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`${timestamp}: ${message}`, ...prev]);
  };

  // Fetch thread data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        addLog('Fetching thread data...');
        
        const response = await fetch('/api/user-stitches');
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Unknown error');
        }
        
        addLog(`Fetched ${result.data.length} threads`);
        setThreadData(result.data);
      } catch (error) {
        console.error('Error fetching thread data:', error);
        const message = error instanceof Error ? error.message : 'Failed to load thread data';
        setError(message);
        addLog(`ERROR: ${message}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      fetchData();
    }
  }, [authLoading]);

  // Handle stitch selection from ThreadCycler
  const handleStitchSelected = (stitch: StitchWithProgress | null, threadId: string) => {
    setActiveStitch(stitch);
    setActiveThreadId(threadId);
    
    addLog(`Thread cycler selected: Thread ${threadId}, Stitch ${stitch?.id || 'none'}`);
  };

  // Simulate stitch completion
  const handleCompleteStitch = () => {
    if (!activeStitch || !activeThreadId) {
      addLog('ERROR: No active stitch to complete');
      return;
    }
    
    addLog(`Simulating completion of stitch ${activeStitch.id} with score ${testScore}/${totalQuestions}`);
    
    // Access the ThreadCycler's handleStitchCompletion method via ref
    if (threadCyclerRef.current && threadCyclerRef.current.handleStitchCompletion) {
      const result = threadCyclerRef.current.handleStitchCompletion(
        activeThreadId,
        activeStitch.id,
        testScore,
        totalQuestions
      );
      
      addLog(`Stitch completion handled, next active stitch: ${result?.id || 'none'}`);
    } else {
      addLog('ERROR: Could not access ThreadCycler methods');
    }
  };

  // Force next thread
  const handleNextThread = () => {
    if (threadCyclerRef.current && threadCyclerRef.current.nextThread) {
      addLog(`Forcing move to next thread from ${activeThreadId}`);
      threadCyclerRef.current.nextThread();
    } else {
      addLog('ERROR: Could not access ThreadCycler methods');
    }
  };

  // Render loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center">
        <div className="text-center text-white">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
          <p>{authLoading ? 'Checking authentication...' : 'Loading thread data...'}</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-white mb-4 text-center">Authentication Required</h1>
          <p className="text-white text-opacity-80 text-center mb-6">
            You need to be logged in to test the thread cycler.
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

  // Error state
  if (error) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-white mb-4 text-center">Error</h1>
          <div className="bg-red-500/20 border border-red-300/30 text-red-100 rounded-lg p-4 mb-6">
            {error}
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No thread data
  if (threadData.length === 0) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-white mb-4 text-center">No Threads Found</h1>
          <p className="text-white text-opacity-80 text-center mb-6">
            No thread data is available. Please check the database to ensure threads and stitches exist.
          </p>
          <div className="flex justify-center">
            <button
              onClick={() => router.push('/check-db')}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Check Database
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen player-bg p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-white">Thread Cycler Test</h1>
            <div className="flex space-x-4">
              <a
                href="/test-sequencer"
                className="text-teal-300 hover:text-teal-200 transition-colors"
              >
                Sequencer Test
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

          <div className="bg-black/30 rounded-lg p-4 mb-6">
            <h2 className="text-xl font-bold text-white mb-2">User Info</h2>
            <p className="text-white/80">
              User: {user?.email || 'Anonymous'}
            </p>
            <p className="text-white/80">
              User ID: {user?.id || 'anonymous'}
            </p>
          </div>

          {/* Thread Cycler Component */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Thread Cycler</h2>
            <ThreadCycler
              ref={threadCyclerRef}
              threadData={threadData}
              userId={user?.id || 'anonymous'}
              onStitchSelected={handleStitchSelected}
            />
          </div>

          {/* Active Stitch Display */}
          <div className="bg-black/30 rounded-lg p-4 mb-6">
            <h2 className="text-xl font-bold text-white mb-2">Current Active Stitch</h2>
            {activeStitch ? (
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-teal-300 font-mono">Thread: {activeThreadId}</p>
                    <p className="text-teal-300 font-mono">Stitch: {activeStitch.id}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
                      Active (Order: {activeStitch.order_number})
                    </span>
                    <div className="mt-1 space-x-1">
                      <span className="inline-block px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded-full">
                        Skip: {activeStitch.skip_number}
                      </span>
                      <span className="inline-block px-2 py-1 text-xs bg-purple-500/20 text-purple-300 rounded-full">
                        Level: {activeStitch.distractor_level}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-white/70 text-sm">
                  <p>Name: {activeStitch.name}</p>
                  <p>Description: {activeStitch.description}</p>
                  <p>Questions: {activeStitch.questions?.length || 0}</p>
                </div>
              </div>
            ) : (
              <p className="text-yellow-300">No active stitch selected.</p>
            )}
          </div>

          {/* Controls */}
          <div className="bg-black/30 rounded-lg p-4 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Test Controls</h2>
            
            {/* Score settings */}
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-white/80 mb-1">
                  Test Score
                </label>
                <input
                  type="number"
                  value={testScore}
                  onChange={(e) => setTestScore(Math.max(0, Math.min(Number(e.target.value), totalQuestions)))}
                  className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white w-full"
                />
                <p className="text-xs text-white/60 mt-1">
                  {testScore === totalQuestions 
                    ? '🎉 Perfect score (will advance the stitch)'
                    : '🔄 Less than perfect (will reset skip number)'}
                </p>
              </div>
              
              <div>
                <label className="block text-white/80 mb-1">
                  Total Questions
                </label>
                <input
                  type="number"
                  value={totalQuestions}
                  onChange={(e) => {
                    const newTotal = Math.max(1, Number(e.target.value));
                    setTotalQuestions(newTotal);
                    // Ensure score doesn't exceed total
                    if (testScore > newTotal) {
                      setTestScore(newTotal);
                    }
                  }}
                  min="1"
                  className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white w-full"
                />
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex space-x-4">
              <button
                onClick={handleCompleteStitch}
                disabled={!activeStitch}
                className={`px-4 py-2 rounded-lg ${
                  activeStitch
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                }`}
              >
                Complete Current Stitch
              </button>
              
              <button
                onClick={handleNextThread}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
              >
                Force Next Thread
              </button>
            </div>
          </div>
          
          {/* Thread Data Display */}
          <div className="bg-black/30 rounded-lg p-4 mb-6">
            <h2 className="text-xl font-bold text-white mb-4 flex justify-between">
              <span>Thread Data</span>
              <span className="text-sm text-white/60">
                {threadData.length} threads found
              </span>
            </h2>
            
            <div className="space-y-4">
              {threadData.map(thread => (
                <div 
                  key={thread.thread_id}
                  className={`bg-white/10 p-3 rounded-lg ${
                    thread.thread_id === activeThreadId ? 'border border-teal-400/50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-white font-bold">
                      {thread.thread_id}
                      {thread.thread_id === activeThreadId && (
                        <span className="ml-2 text-xs bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </h3>
                    <div className="text-xs text-white/60">
                      {thread.stitches.length} stitches | 
                      {thread.stitches.filter(s => s.order_number === 0).length} active
                    </div>
                  </div>
                  
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    {thread.stitches
                      .sort((a, b) => a.order_number - b.order_number)
                      .slice(0, 4)
                      .map(stitch => (
                        <div 
                          key={stitch.id}
                          className={`p-2 rounded ${
                            stitch.order_number === 0 
                              ? 'bg-teal-900/30 border border-teal-400/30' 
                              : 'bg-gray-900/30'
                          }`}
                        >
                          <div className="flex justify-between">
                            <span className="text-white/80 truncate">{stitch.id}</span>
                            <span className="text-white/60">Order: {stitch.order_number}</span>
                          </div>
                        </div>
                      ))}
                      
                    {thread.stitches.length > 4 && (
                      <div className="p-2 bg-gray-900/20 rounded text-white/50 text-center">
                        +{thread.stitches.length - 4} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Logs */}
          <div className="bg-black/30 rounded-lg p-4">
            <h2 className="text-xl font-bold text-white mb-2 flex justify-between">
              <span>Activity Log</span>
              <button 
                onClick={() => setLogs([])}
                className="text-xs text-white/60 hover:text-white"
              >
                Clear
              </button>
            </h2>
            <div className="bg-black/50 rounded p-2 h-48 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-white/40 text-center italic">No activity yet</p>
              ) : (
                <div className="space-y-1 font-mono text-xs">
                  {logs.map((log, index) => (
                    <div key={index} className="text-teal-300">{log}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}