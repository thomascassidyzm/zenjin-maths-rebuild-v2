import React, { useState } from 'react';
import Head from 'next/head';
import { useZustandTripleHelixPlayer } from '../lib/hooks/useZustandTripleHelixPlayer';
import useZenjinStore from '../lib/store/zenjinStore';
import PlayerComponentZustand from '../components/PlayerComponentZustand';

/**
 * Zustand Player Test
 * 
 * A comprehensive test page for the Zustand-based Triple Helix Player.
 * Tests the entire flow from player initialization to state persistence.
 */
export default function ZustandPlayerTest() {
  // Use the Zustand Triple Helix Player hook
  const player = useZustandTripleHelixPlayer({
    debug: (message) => console.log(`[TripleHelixPlayer] ${message}`),
    continuePreviousState: true
  });

  // Get state from Zustand store
  const userInfo = useZenjinStore(state => state.userInformation);
  const tubeState = useZenjinStore(state => state.tubeState);
  const learningProgress = useZenjinStore(state => state.learningProgress);
  
  // Test state
  const [testResults, setTestResults] = useState<{
    name: string;
    success: boolean;
    message: string;
  }[]>([]);

  // Format JSON for display
  const formatJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return 'Error formatting JSON';
    }
  };

  // Run tests
  const runTests = async () => {
    // Clear previous test results
    setTestResults([]);

    // Test 1: Check initialization
    const initResult = !player.isLoading && player.currentStitch !== null;
    addTestResult('Player Initialization', initResult, 
      initResult ? 'Player initialized successfully' : 'Player failed to initialize');

    // Test 2: Check tube state in Zustand store
    const tubeStateResult = !!tubeState && tubeState.activeTube > 0;
    addTestResult('Tube State in Zustand', tubeStateResult,
      tubeStateResult ? `Active tube is ${tubeState?.activeTube}` : 'Tube state not found in Zustand store');

    // Test 3: Check user information in Zustand store
    const userInfoResult = !!userInfo && !!userInfo.userId;
    addTestResult('User Info in Zustand', userInfoResult,
      userInfoResult ? `User ID is ${userInfo?.userId}` : 'User info not found in Zustand store');

    // Test 4: Test persistence to localStorage
    const persistenceResult = await testLocalStoragePersistence();
    addTestResult('localStorage Persistence', persistenceResult.success, persistenceResult.message);

    // Test 5: Test stitch completion
    if (player.currentStitch) {
      const completionResult = await testStitchCompletion();
      addTestResult('Stitch Completion', completionResult.success, completionResult.message);
    } else {
      addTestResult('Stitch Completion', false, 'No current stitch available to test completion');
    }

    // Test 6: Test session completion
    const sessionResult = await testSessionCompletion();
    addTestResult('Session Completion', sessionResult.success, sessionResult.message);
  };

  // Test localStorage persistence
  const testLocalStoragePersistence = async () => {
    try {
      // First check that we have some state
      if (!userInfo || !tubeState) {
        return { success: false, message: 'No state to test persistence with' };
      }

      // Get initial points
      const initialPoints = learningProgress?.points?.session || 0;

      // Update points - add 10 points
      useZenjinStore.getState().incrementPoints(10);

      // Force save to localStorage
      useZenjinStore.getState().saveToLocalStorage();

      // Get updated points
      const updatedPoints = useZenjinStore(state => state.learningProgress?.points?.session);

      // Check if points were updated in the store
      if (updatedPoints !== initialPoints + 10) {
        return { 
          success: false, 
          message: `Points not updated correctly: expected ${initialPoints + 10}, got ${updatedPoints}` 
        };
      }

      // Now reload from localStorage to verify persistence
      const loadResult = useZenjinStore.getState().loadFromLocalStorage();

      // Check if points are still there after reload
      const reloadedPoints = useZenjinStore(state => state.learningProgress?.points?.session);

      return {
        success: loadResult && reloadedPoints === initialPoints + 10,
        message: loadResult ? 
          `Points persisted correctly: ${reloadedPoints}` : 
          'Failed to load state from localStorage'
      };
    } catch (error) {
      return {
        success: false,
        message: `Error testing localStorage persistence: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  };

  // Test stitch completion
  const testStitchCompletion = async () => {
    try {
      if (!player.currentStitch || !player.tubeCycler) {
        return { success: false, message: 'No current stitch or tubeCycler available' };
      }

      // Get initial points
      const initialPoints = learningProgress?.points?.session || 0;

      // Complete the current stitch with a perfect score
      await player.completeStitch(
        player.currentStitch.threadId,
        player.currentStitch.id,
        20, // perfect score
        20, // total questions
        { skipAnimation: true }
      );

      // Check if points were updated
      const updatedPoints = useZenjinStore(state => state.learningProgress?.points?.session);

      // We expect points to increase by at least 20
      return {
        success: updatedPoints > initialPoints,
        message: `Points increased from ${initialPoints} to ${updatedPoints} after stitch completion`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error testing stitch completion: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  };

  // Test session completion
  const testSessionCompletion = async () => {
    try {
      if (!player.tubeCycler) {
        return { success: false, message: 'No tubeCycler available' };
      }

      // Prepare mock session results
      const mockResults = {
        points: 50,
        correctAnswers: 45,
        totalQuestions: 50,
        isPerfect: false
      };

      // Complete the session without navigation
      const result = await player.handleSessionComplete(mockResults, false);

      return {
        success: result,
        message: result ? 'Session completed and saved successfully' : 'Failed to complete session'
      };
    } catch (error) {
      return {
        success: false,
        message: `Error testing session completion: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  };

  // Add a test result
  const addTestResult = (name: string, success: boolean, message: string) => {
    setTestResults(prev => [...prev, { name, success, message }]);
    console.log(`Test "${name}": ${success ? 'PASSED' : 'FAILED'} - ${message}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Zustand Player Test - Zenjin Maths</title>
        <meta name="description" content="Test page for Zustand-based Triple Helix Player" />
      </Head>

      <main className="bg-white/20 backdrop-blur-lg rounded-xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-8 text-center">Zustand Player Test</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Player and Test Controls */}
          <div className="bg-gray-800/50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Player Component</h2>

            {player.isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                <p className="ml-3">Loading player...</p>
              </div>
            ) : player.loadError ? (
              <div className="bg-red-600/20 border border-red-400 p-4 rounded-lg">
                <h3 className="font-semibold text-red-300">Error</h3>
                <p>{player.loadError}</p>
              </div>
            ) : (
              <div>
                <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
                  <h3 className="font-medium mb-2">Current Stitch</h3>
                  <p><strong>ID:</strong> {player.currentStitch?.id}</p>
                  <p><strong>Thread:</strong> {player.currentStitch?.threadId}</p>
                  <p><strong>Tube:</strong> {player.currentTube}</p>
                  <p><strong>Content:</strong> {player.currentStitch?.content}</p>
                </div>

                <div className="flex space-x-3 mb-4">
                  <button 
                    onClick={() => player.currentStitch && player.completeStitch(
                      player.currentStitch.threadId,
                      player.currentStitch.id,
                      20, 20,
                      { skipAnimation: true }
                    )}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-md"
                    disabled={!player.currentStitch}
                  >
                    Perfect Score
                  </button>
                  <button 
                    onClick={() => player.currentStitch && player.completeStitch(
                      player.currentStitch.threadId,
                      player.currentStitch.id,
                      15, 20,
                      { skipAnimation: true }
                    )}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-md"
                    disabled={!player.currentStitch}
                  >
                    Partial Score
                  </button>
                </div>

                <div>
                  <button 
                    onClick={() => player.handleSessionComplete({
                      points: player.accumulatedSessionData.totalPoints,
                      correctAnswers: player.accumulatedSessionData.correctAnswers,
                      totalQuestions: player.accumulatedSessionData.totalQuestions
                    })}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md w-full"
                  >
                    End Session
                  </button>
                </div>
              </div>
            )}

            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
              <button
                onClick={runTests}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-md w-full font-medium"
              >
                Run All Tests
              </button>

              <div className="mt-4">
                <h3 className="font-medium mb-2">Test Results</h3>
                {testResults.length === 0 ? (
                  <p className="text-gray-400">No tests run yet</p>
                ) : (
                  <div className="space-y-2">
                    {testResults.map((result, index) => (
                      <div 
                        key={index}
                        className={`p-3 rounded-md ${result.success ? 'bg-green-600/20 border border-green-400/30' : 'bg-red-600/20 border border-red-400/30'}`}
                      >
                        <div className="font-medium">{result.name}</div>
                        <div className="text-sm">{result.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* State Display */}
          <div className="bg-gray-800/50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Zustand Store State</h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">User Information</h3>
                <pre className="bg-gray-900 p-3 rounded-md text-xs overflow-auto max-h-40">
                  {formatJson(userInfo)}
                </pre>
              </div>

              <div>
                <h3 className="font-medium mb-1">Tube State</h3>
                <pre className="bg-gray-900 p-3 rounded-md text-xs overflow-auto max-h-40">
                  {formatJson(tubeState)}
                </pre>
              </div>

              <div>
                <h3 className="font-medium mb-1">Learning Progress</h3>
                <pre className="bg-gray-900 p-3 rounded-md text-xs overflow-auto max-h-40">
                  {formatJson(learningProgress)}
                </pre>
              </div>

              <div>
                <h3 className="font-medium mb-1">Session Data</h3>
                <pre className="bg-gray-900 p-3 rounded-md text-xs overflow-auto max-h-40">
                  {formatJson(player.accumulatedSessionData)}
                </pre>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="font-medium mb-3">Store Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => useZenjinStore.getState().incrementPoints(10)}
                  className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded-md text-sm"
                >
                  Add 10 Points
                </button>
                <button
                  onClick={() => {
                    const current = tubeState?.activeTube || 1;
                    const next = current < 3 ? current + 1 : 1;
                    useZenjinStore.getState().setActiveTube(next);
                  }}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm"
                >
                  Cycle Tube
                </button>
                <button
                  onClick={() => useZenjinStore.getState().saveToLocalStorage()}
                  className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-md text-sm"
                >
                  Save to localStorage
                </button>
                <button
                  onClick={() => useZenjinStore.getState().loadFromLocalStorage()}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-500 rounded-md text-sm"
                >
                  Load from localStorage
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        body {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        }
      `}</style>
    </div>
  );
}