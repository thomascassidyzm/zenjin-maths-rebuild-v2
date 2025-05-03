import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DistinctionPlayer from '../components/DistinctionPlayer';
import { ThreadData, StitchWithProgress } from '../lib/types/distinction-learning';

// Import the StateMachine adapter - this is the key to correct tube rotation behavior
const StateMachineTubeCyclerAdapter = require('../lib/adapters/StateMachineTubeCyclerAdapter');

/**
 * Triple-Helix-Enhanced
 * 
 * An improved implementation that combines:
 * 1. Real data from the server API
 * 2. The correct Triple-Helix tube rotation logic and stitch advancement
 * 3. Proper integration of the UI with the StateMachine
 * 4. Prevention of double rotation bug
 * 5. Support for the 1→3→5→10→25→100 skip number sequence
 */
export default function TripleHelixEnhanced() {
  const router = useRouter();
  
  // State for tubes and user
  const [userId, setUserId] = useState('anonymous');
  const [threadData, setThreadData] = useState<ThreadData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Triple-Helix state
  const [tubeCycler, setTubeCycler] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [currentTube, setCurrentTube] = useState(1);
  const [currentStitch, setCurrentStitch] = useState<StitchWithProgress | null>(null);
  const [tubeStitches, setTubeStitches] = useState<any[]>([]);
  
  // Display state 
  const [showingTubeConfiguration, setShowingTubeConfiguration] = useState(false);
  const [showPlayer, setShowPlayer] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  
  // Accumulated session data
  const [accumulatedSessionData, setAccumulatedSessionData] = useState({
    totalPoints: 0,
    correctAnswers: 0,
    firstTimeCorrect: 0,
    totalQuestions: 0,
    totalAttempts: 0,
    stitchesCompleted: 0
  });
  
  // Reference to prevent double rotation
  const rotationInProgressRef = useRef(false);
  
  // When component mounts, get user ID from URL params or use anonymous
  useEffect(() => {
    const query = router.query;
    const queryUserId = query.userId as string;
    
    if (queryUserId) {
      setUserId(queryUserId);
    }
    
    // Check if debug mode is enabled
    const queryDebug = query.debug as string;
    if (queryDebug === 'true') {
      setDebugMode(true);
    }
  }, [router.query]);
  
  // State change handler for StateMachine
  const handleStateChange = (newState: any) => {
    setState(newState);
    setCurrentTube(newState.activeTubeNumber);
    
    // Update current stitch display
    if (tubeCycler) {
      const stitch = tubeCycler.getCurrentStitch();
      setCurrentStitch(stitch);
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
    }
  };
  
  // Tube change handler for StateMachine
  const handleTubeChange = (tubeNumber: number) => {
    setCurrentTube(tubeNumber);
    console.log(`Active tube changed to ${tubeNumber}`);
    
    // Update stitches for this tube
    if (tubeCycler) {
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
      const stitch = tubeCycler.getCurrentStitch();
      setCurrentStitch(stitch);
    }
  };
  
  // Load data and initialize adapter
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setLoadError(null);
        
        // Fetch user stitches from API
        const response = await fetch(`/api/user-stitches?userId=${userId}&prefetch=5`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch stitches: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error('Failed to fetch user data');
        }
        
        // Convert to ThreadData format
        const threads = data.data.map((thread: any) => ({
          thread_id: thread.thread_id,
          tube_number: thread.tube_number || 1,
          stitches: thread.stitches.map((stitch: any) => ({
            id: stitch.id,
            threadId: thread.thread_id,
            title: `Stitch ${stitch.id}`,
            content: stitch.content || `Content for stitch ${stitch.id}`,
            order_number: stitch.order_number,
            skip_number: stitch.skip_number || 1,
            distractor_level: stitch.distractor_level || 'L1',
            questions: stitch.questions || [],
            ...stitch // Copy any other properties
          }))
        }));
        
        // Extract tube position
        const tubePosition = data.tubePosition;
        
        // Set thread data
        setThreadData(threads);
        
        console.log('Fetched thread data:', threads);
        
        // Initialize StateMachine adapter
        const initialState = {
          userId,
          activeTubeNumber: tubePosition?.tubeNumber || 1,
          tubes: {}
        };
        
        // Process thread data and prepare for StateMachine
        threads.forEach((thread: any) => {
          const threadId = thread.thread_id;
          const tubeNumber = thread.tube_number || 1;
          
          // Convert stitches format
          const stitches = thread.stitches.map((stitch: any) => ({
            id: stitch.id,
            threadId: threadId,
            content: stitch.content || `Content for stitch ${stitch.id}`,
            position: stitch.order_number || 0,
            skipNumber: stitch.skip_number || 1,
            distractorLevel: stitch.distractor_level || 'L1',
            completed: false,
            score: 0,
            questions: stitch.questions || []
          }));
          
          // Find current stitch (position 0)
          const activeStitch = stitches.find((s: any) => s.position === 0);
          
          // Initialize tube with thread data
          initialState.tubes[tubeNumber] = {
            threadId,
            currentStitchId: activeStitch ? activeStitch.id : (stitches.length > 0 ? stitches[0].id : null),
            stitches
          };
        });
        
        // Create adapter
        console.log('CRITICAL DEBUG: Creating StateMachineTubeCyclerAdapter with initial state:', initialState);
        const adapter = new StateMachineTubeCyclerAdapter({
          userId,
          initialState,
          onStateChange: handleStateChange,
          onTubeChange: handleTubeChange
        });
        
        // Set adapter
        setTubeCycler(adapter);
        
        // Initialize UI state from adapter
        setState(adapter.getState());
        setCurrentTube(adapter.getCurrentTube());
        
        // Get the current stitch and log it
        const currentStitchFromAdapter = adapter.getCurrentStitch();
        console.log('CRITICAL DEBUG: Initial current stitch:', currentStitchFromAdapter);
        setCurrentStitch(currentStitchFromAdapter);
        
        // Get current tube stitches and log them
        const tubeStitchesFromAdapter = adapter.getCurrentTubeStitches();
        console.log('CRITICAL DEBUG: Initial tube stitches:', tubeStitchesFromAdapter);
        setTubeStitches(tubeStitchesFromAdapter);
        
        // Finish loading
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoadError(error instanceof Error ? error.message : 'Unknown error occurred');
        setIsLoading(false);
      }
    }
    
    fetchData();
    
    // Cleanup on unmount
    return () => {
      if (tubeCycler) {
        tubeCycler.destroy();
      }
    };
  }, [userId]);
  
  // Handle stitch completion
  const handleSessionComplete = (results: any, isEndSession = false) => {
    console.log('Session completed with results:', results);
    
    // Accumulate session data
    setAccumulatedSessionData(prev => {
      const newData = {
        totalPoints: prev.totalPoints + (results.totalPoints || 0),
        correctAnswers: prev.correctAnswers + (results.correctAnswers || 0),
        firstTimeCorrect: prev.firstTimeCorrect + (results.firstTimeCorrect || 0),
        totalQuestions: prev.totalQuestions + (results.totalQuestions || 0),
        totalAttempts: prev.totalAttempts + (results.totalAttempts || 0),
        stitchesCompleted: prev.stitchesCompleted + 1
      };
      
      console.log('Accumulated session data:', newData);
      return newData;
    });
    
    // If end session is requested, go back to home
    if (isEndSession) {
      router.push('/');
      return;
    }
    
    // Get score info
    const score = results.correctAnswers || 0;
    const totalQuestions = results.totalQuestions || 20;
    const isPerfectScore = score === totalQuestions;
    
    if (!currentStitch) {
      console.error('No current stitch to complete');
      return;
    }
    
    console.log('CRITICAL DEBUG: Starting stitch completion process');
    console.log('CRITICAL DEBUG: Current stitch before completion:', currentStitch);
    console.log('CRITICAL DEBUG: Current tube before rotation:', currentTube);
    
    // CRITICAL: First rotate to the next tube (rotating stage concept)
    // This is key to the Triple-Helix approach
    if (!rotationInProgressRef.current) {
      console.log('Step 1: Rotating to next tube first');
      rotationInProgressRef.current = true;
      
      // First, cycle to the next tube
      tubeCycler.nextTube();
      
      // Log the new tube for debugging
      const newTube = tubeCycler.getCurrentTube();
      console.log(`CRITICAL DEBUG: Rotated from Tube ${currentTube} to Tube ${newTube}`);
      
      // Then, process the stitch completion in the previous tube
      setTimeout(() => {
        console.log('Step 2: Processing stitch completion');
        console.log(`CRITICAL DEBUG: Processing completion for stitch ${currentStitch.id} with score ${score}/${totalQuestions}`);
        
        // This is the key part - we process the stitch completion in the previous tube
        // AFTER rotating to the next tube
        const completionResult = tubeCycler.handleStitchCompletion(
          currentStitch.threadId,
          currentStitch.id,
          score,
          totalQuestions
        );
        
        console.log('CRITICAL DEBUG: Completion result:', completionResult);
        console.log('CRITICAL DEBUG: StateMachine state after completion:', tubeCycler.getState());
        
        // Persist state to server
        persistStateToServer(score, totalQuestions);
        
        // Update UI with new stitch
        const newStitch = tubeCycler.getCurrentStitch();
        console.log('CRITICAL DEBUG: New active stitch:', newStitch);
        
        setCurrentStitch(newStitch);
        setTubeStitches(tubeCycler.getCurrentTubeStitches());
        
        // Reset rotation flag after completion
        setTimeout(() => {
          rotationInProgressRef.current = false;
          console.log('CRITICAL DEBUG: Rotation lock released');
        }, 500);
      }, 500); // Process completion after rotation to match simulator
    } else {
      console.log('Rotation already in progress, skipping duplicate rotation');
    }
  };
  
  // Perfect score button handler
  const handlePerfectScore = () => {
    if (!tubeCycler || !currentStitch) return;
    
    console.log('Simulating stitch completion with perfect score (20/20)');
    
    // Create mock perfect results
    const mockPerfectResults = {
      sessionId: `session-${Date.now()}`,
      threadId: currentStitch.threadId,
      stitchId: currentStitch.id,
      totalQuestions: 20,
      totalAttempts: 20,
      correctAnswers: 20,
      firstTimeCorrect: 20,
      accuracy: 100,
      averageTimeToAnswer: 1500,
      totalPoints: 60,
      completedAt: new Date().toISOString()
    };
    
    // Process perfect score completion
    handleSessionComplete(mockPerfectResults);
  };
  
  // Partial score button handler
  const handlePartialScore = () => {
    if (!tubeCycler || !currentStitch) return;
    
    console.log('Simulating stitch completion with partial score (15/20)');
    
    // Create mock partial results
    const mockPartialResults = {
      sessionId: `session-${Date.now()}`,
      threadId: currentStitch.threadId,
      stitchId: currentStitch.id,
      totalQuestions: 20,
      totalAttempts: 25, // Some retries
      correctAnswers: 15,
      firstTimeCorrect: 10,
      accuracy: 75,
      averageTimeToAnswer: 2500,
      totalPoints: 20,
      completedAt: new Date().toISOString()
    };
    
    // Process partial score completion
    handleSessionComplete(mockPartialResults);
  };
  
  // Persist state to server
  const persistStateToServer = async (score: number, totalQuestions: number) => {
    if (!tubeCycler || !currentStitch) return;
    
    const stateData = tubeCycler.getState();
    
    try {
      // First persist tube position
      await fetch('/api/save-tube-position', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: stateData.userId,
          tubeNumber: currentTube,
          threadId: currentStitch.threadId
        })
      });
      
      // Then persist session results
      await fetch('/api/save-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: stateData.userId,
          threadId: currentStitch.threadId,
          stitchId: currentStitch.id,
          score: score,
          totalQuestions: totalQuestions,
          points: score === totalQuestions ? 60 : 20
        })
      });
      
      console.log('State persisted to server');
    } catch (error) {
      console.error('Error persisting state:', error);
    }
  };

  // Format the skip number for display with appropriate color
  const formatSkipNumber = (skipNumber: number) => {
    let skipClass = "";
    
    // Assign color based on skip number
    if (skipNumber === 1) skipClass = "text-gray-300"; 
    else if (skipNumber === 3) skipClass = "text-white font-medium";
    else if (skipNumber === 5) skipClass = "text-blue-300";
    else if (skipNumber === 10) skipClass = "text-green-300";
    else if (skipNumber === 25) skipClass = "text-yellow-300";
    else if (skipNumber === 100) skipClass = "text-pink-300";
    
    return (
      <span className={skipClass}>{skipNumber}</span>
    );
  };
  
  // Format distractor level for display with appropriate color
  const formatLevel = (level: string) => {
    let levelClass = "";
    
    if (level === 'L1') levelClass = "text-white";
    else if (level === 'L2') levelClass = "text-yellow-300";
    else if (level === 'L3') levelClass = "text-pink-300";
    
    return (
      <span className={levelClass}>{level}</span>
    );
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-indigo-700 text-white">
      <Head>
        <title>Triple-Helix Enhanced Player</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      {/* Tube indicator */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 backdrop-blur-md rounded-full py-2 px-6 flex gap-6 z-10">
        {[1, 2, 3].map(tubeNum => (
          <div key={tubeNum} className={`flex items-center gap-2 ${currentTube === tubeNum ? 'text-teal-400' : 'text-white text-opacity-50'}`}>
            <div className={`w-3 h-3 rounded-full ${currentTube === tubeNum ? 'bg-teal-400' : 'bg-white bg-opacity-30'}`}></div>
            <span className="text-sm font-medium">Tube {tubeNum}</span>
          </div>
        ))}
      </div>
      
      <div className="container mx-auto px-4 py-20">
        {isLoading ? (
          <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-xl p-8 text-center max-w-lg mx-auto">
            <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
            <p>Loading Triple-Helix Enhanced Player...</p>
          </div>
        ) : loadError ? (
          <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-xl p-8 text-center max-w-lg mx-auto">
            <h2 className="text-2xl font-bold mb-4">Error Loading Content</h2>
            <div className="bg-red-500/20 border border-red-300/30 text-red-100 rounded-lg p-4 mb-6">
              {loadError}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : !currentStitch ? (
          <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-xl p-8 text-center max-w-lg mx-auto">
            <h2 className="text-2xl font-bold mb-4">No Active Stitch</h2>
            <p className="mb-4">There is no active stitch available.</p>
            <button
              onClick={() => router.push('/')}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Back to Home
            </button>
          </div>
        ) : (
          <>
            {/* Main action buttons */}
            <div className="mb-6 flex justify-center gap-4">
              <button
                onClick={handlePerfectScore}
                className="bg-green-600 hover:bg-green-500 px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all text-lg font-semibold"
              >
                Perfect Score (20/20)
              </button>
              
              <button
                onClick={handlePartialScore}
                className="bg-yellow-600 hover:bg-yellow-500 px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all text-lg font-semibold"
              >
                Partial Score (15/20)
              </button>
              
              <button
                onClick={() => {
                  // Move to next tube manually
                  if (tubeCycler && !rotationInProgressRef.current) {
                    rotationInProgressRef.current = true;
                    tubeCycler.nextTube();
                    setTimeout(() => {
                      rotationInProgressRef.current = false;
                    }, 500);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all text-lg font-semibold"
              >
                Next Tube
              </button>
            </div>
            
            {/* View controls */}
            <div className="mb-6 flex justify-center">
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                  onClick={() => {
                    setShowingTubeConfiguration(false);
                    setShowPlayer(true);
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg ${!showingTubeConfiguration && showPlayer ? 'bg-indigo-600 text-white' : 'bg-indigo-900/50 text-white/70 hover:bg-indigo-800/60'}`}
                >
                  Player
                </button>
                <button
                  onClick={() => {
                    setShowingTubeConfiguration(true);
                    setShowPlayer(false);
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg ${showingTubeConfiguration && !showPlayer ? 'bg-indigo-600 text-white' : 'bg-indigo-900/50 text-white/70 hover:bg-indigo-800/60'}`}
                >
                  Tube Configuration
                </button>
              </div>
            </div>
            
            {/* Current state info */}
            <div className="mb-6 bg-indigo-900/50 backdrop-blur-sm p-4 rounded-lg max-w-4xl mx-auto">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-sm text-white/70">Active Tube:</span>
                  <span className="text-xl font-bold text-white">Tube-{currentTube}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-white/70">Thread:</span>
                  <span className="text-xl font-bold text-white">{currentStitch.threadId}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-white/70">Current Stitch:</span>
                  <span className="text-xl font-bold text-white">{currentStitch.id.split('-').pop()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-white/70">Skip Number:</span>
                  <span className="text-xl font-bold text-white">{currentStitch.skipNumber}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-white/70">Distractor Level:</span>
                  <span className="text-xl font-bold text-white">{currentStitch.distractorLevel}</span>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-xs text-white/70">Session Points:</span>
                  <span className="text-lg font-bold text-teal-300">{accumulatedSessionData.totalPoints}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-white/70">Stitches Completed:</span>
                  <span className="text-lg font-bold text-teal-300">{accumulatedSessionData.stitchesCompleted}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-white/70">Cycle Count:</span>
                  <span className="text-lg font-bold text-teal-300">{tubeCycler?.getCycleCount() || 0}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-white/70">Total Questions:</span>
                  <span className="text-lg font-bold text-teal-300">{accumulatedSessionData.totalQuestions}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-white/70">Correct Answers:</span>
                  <span className="text-lg font-bold text-teal-300">{accumulatedSessionData.correctAnswers}</span>
                </div>
              </div>
            </div>
            
            {/* Content area */}
            {showingTubeConfiguration && !showPlayer && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 overflow-hidden max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold mb-4">Current Tube Configuration</h2>
                
                <div className="grid grid-cols-3 gap-6">
                  {[1, 2, 3].map(tubeNum => {
                    const tube = state.tubes[tubeNum];
                    const sortedStitches = tube?.stitches
                      ? [...tube.stitches].sort((a: any, b: any) => a.position - b.position)
                      : [];
                    
                    return (
                      <div key={tubeNum} className={`bg-indigo-800/30 backdrop-blur-sm rounded-lg p-4 ${currentTube === tubeNum ? 'ring-2 ring-teal-400' : ''}`}>
                        <h3 className="text-lg font-bold mb-2 flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-2 ${currentTube === tubeNum ? 'bg-teal-400' : 'bg-white/30'}`}></div>
                          Tube {tubeNum}
                          {currentTube === tubeNum && <span className="ml-2 text-xs bg-teal-400/20 text-teal-300 px-2 py-0.5 rounded">ACTIVE</span>}
                        </h3>
                        <div className="text-sm mb-3">
                          <div>Thread: <span className="text-blue-300">{tube?.threadId || 'None'}</span></div>
                          <div>Current Stitch: <span className="text-blue-300">{tube?.currentStitchId?.split('-').pop() || 'None'}</span></div>
                        </div>
                        
                        <div className="text-xs font-medium text-white/70 mb-1">Stitches (by position):</div>
                        <div className="overflow-auto max-h-60">
                          <table className="w-full text-xs">
                            <thead className="text-white/60">
                              <tr className="border-b border-white/20">
                                <th className="py-1 px-2 text-left">Pos</th>
                                <th className="py-1 text-left">Stitch</th>
                                <th className="py-1 text-center">Skip</th>
                                <th className="py-1 text-center">Level</th>
                                <th className="py-1 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedStitches.slice(0, 10).map((stitch: any) => {
                                const isActive = stitch.id === tube?.currentStitchId;
                                
                                return (
                                  <tr key={stitch.id} className={`${isActive ? 'bg-teal-400/20' : ''} hover:bg-white/5`}>
                                    <td className={`py-1 px-2 ${stitch.position === 0 ? 'text-teal-300 font-bold' : ''}`}>{stitch.position}</td>
                                    <td className="py-1">{stitch.id.split('-').pop()}</td>
                                    <td className="py-1 text-center">{formatSkipNumber(stitch.skipNumber)}</td>
                                    <td className="py-1 text-center">{formatLevel(stitch.distractorLevel)}</td>
                                    <td className="py-1 text-center">
                                      {isActive ? (
                                        <span className="inline-block bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                                          ACTIVE
                                        </span>
                                      ) : stitch.position === 0 ? (
                                        <span className="inline-block bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded-full text-[10px]">
                                          READY
                                        </span>
                                      ) : (
                                        <span className="inline-block bg-gray-500/20 text-gray-300 px-1.5 py-0.5 rounded-full text-[10px]">
                                          waiting
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-4 bg-indigo-900/20 p-4 rounded-lg border border-indigo-900/30">
                  <div className="text-sm font-semibold mb-2">Skip Number Progression:</div>
                  <p className="text-xs text-white/80 mb-2">
                    The skip number determines where a stitch is placed after a perfect score.
                    When a stitch gets a perfect score, its skip number is updated FIRST, 
                    and then it's placed at its NEW skip number position.
                  </p>
                  <p className="text-xs text-white/80 mb-2">
                    <strong>Example:</strong> A stitch with skip=1 gets a perfect score → Its skip number 
                    updates to 3 → It's placed at position 3.
                  </p>
                  <div className="flex space-x-4 text-xs">
                    <span className="text-gray-300">1</span>
                    <span className="text-white">→ 3</span>
                    <span className="text-blue-300">→ 5</span>
                    <span className="text-green-300">→ 10</span>
                    <span className="text-yellow-300">→ 25</span>
                    <span className="text-pink-300">→ 100</span>
                  </div>
                </div>
              </div>
            )}
            
            {!showingTubeConfiguration && showPlayer && (
              <div className="max-w-md mx-auto">
                <DistinctionPlayer
                  thread={{
                    id: currentStitch.threadId,
                    name: currentStitch.threadId,
                    description: `Thread ${currentStitch.threadId}`,
                    stitches: [currentStitch]
                  }}
                  onComplete={handleSessionComplete}
                  onEndSession={(results) => handleSessionComplete(results, true)}
                  questionsPerSession={20}
                  sessionTotalPoints={accumulatedSessionData.totalPoints}
                />
              </div>
            )}
            
            {/* Debug info */}
            {debugMode && (
              <div className="mt-8 bg-black/30 p-4 rounded-lg max-w-4xl mx-auto">
                <h3 className="text-lg font-semibold mb-2">Debug Info</h3>
                <div className="overflow-auto h-40 text-xs font-mono">
                  <pre>{JSON.stringify(state, null, 2)}</pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}