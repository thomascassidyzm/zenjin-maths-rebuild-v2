/**
 * Integrated Player Page
 * 
 * This page demonstrates the Zustand-based content loading system 
 * with proper integration into the app's state management.
 */

import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useZenjinStore } from '../lib/store/zenjinStore';
import ZustandDistinctionPlayer from '../components/ZustandDistinctionPlayer';

export default function IntegratedPlayerPage() {
  // Get state from Zustand store
  const userInfo = useZenjinStore(state => state.userInformation);
  const tubeState = useZenjinStore(state => state.tubeState);
  const isInitialized = useZenjinStore(state => state.isInitialized);
  const initializeState = useZenjinStore(state => state.initializeState);
  const fetchStitchBatch = useZenjinStore(state => state.fetchStitchBatch);
  
  // Local state for the player
  const [activeStitchId, setActiveStitchId] = useState<string | null>(null);
  const [activeTube, setActiveTube] = useState<1 | 2 | 3>(1);
  const [sessionResults, setSessionResults] = useState<any>(null);
  
  // Initialize Zustand store if needed
  useEffect(() => {
    if (!isInitialized && !userInfo) {
      console.log('Initializing Zustand store for anonymous user');
      
      // Create anonymous user ID
      const anonymousId = `anon-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Initialize store with minimal state
      initializeState({
        userInformation: {
          userId: anonymousId,
          isAnonymous: true,
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString()
        },
        tubeState: {
          activeTube: 1,
          tubes: {
            1: {
              threadId: 'thread-T1-001',
              currentStitchId: 'stitch-T1-001-01',
              stitchOrder: ['stitch-T1-001-01', 'stitch-T1-001-02', 'stitch-T1-001-03']
            },
            2: {
              threadId: 'thread-T2-001',
              currentStitchId: 'stitch-T2-001-01',
              stitchOrder: ['stitch-T2-001-01', 'stitch-T2-001-02', 'stitch-T2-001-03']
            },
            3: {
              threadId: 'thread-T3-001',
              currentStitchId: 'stitch-T3-001-01',
              stitchOrder: ['stitch-T3-001-01', 'stitch-T3-001-02', 'stitch-T3-001-03']
            }
          }
        },
        learningProgress: {
          userId: anonymousId,
          totalTimeSpentLearning: 0,
          evoPoints: 0,
          evolutionLevel: 1,
          currentBlinkSpeed: 1,
          previousSessionBlinkSpeeds: [],
          completedStitchesCount: 0,
          perfectScoreStitchesCount: 0
        }
      });
    }
  }, [isInitialized, userInfo, initializeState]);
  
  // When tube state is available, set the active stitch
  useEffect(() => {
    if (tubeState && tubeState.tubes) {
      const tube = tubeState.tubes[tubeState.activeTube];
      if (tube && tube.currentStitchId) {
        setActiveStitchId(tube.currentStitchId);
        setActiveTube(tubeState.activeTube);
        
        // Prefetch the next few stitches in the tube
        if (tube.stitchOrder && tube.stitchOrder.length > 1) {
          const nextStitches = tube.stitchOrder.slice(0, 3);
          fetchStitchBatch(nextStitches).catch(err => {
            console.warn('Error prefetching stitches:', err);
          });
        }
      }
    }
  }, [tubeState, fetchStitchBatch]);
  
  // Handle session completion
  const handleSessionComplete = (results: any) => {
    console.log('Session completed:', results);
    setSessionResults(results);
    
    // In a real app, we'd update the state and navigate to a summary page
    // For now, we'll just display the results
  };
  
  // Format JSON for display
  const formatJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return 'Error formatting JSON';
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-800 to-purple-900">
      <Head>
        <title>Integrated Player - Zenjin Maths</title>
        <meta name="description" content="Integrated Zustand Distinction Player for Zenjin Maths" />
      </Head>
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2 text-white text-center">Integrated Player</h1>
        <p className="text-white text-opacity-80 text-center mb-8">
          Demonstrating the Zustand-based content loading system
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main player area */}
          <div className="lg:col-span-2">
            {!isInitialized ? (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-white flex flex-col items-center justify-center min-h-[400px]">
                <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                <p>Initializing Zustand store...</p>
              </div>
            ) : activeStitchId ? (
              <div className="bg-white/5 backdrop-blur-lg rounded-xl overflow-hidden">
                <ZustandDistinctionPlayer
                  stitchId={activeStitchId}
                  tubeNumber={activeTube}
                  onComplete={handleSessionComplete}
                  questionsPerSession={10}
                  sessionTotalPoints={0}
                  userId={userInfo?.userId}
                />
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-white text-center">
                <p>No active stitch found. Please select a stitch to play.</p>
              </div>
            )}
            
            {/* Tube selector */}
            {isInitialized && tubeState && (
              <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <h2 className="text-xl font-semibold text-white mb-3">Tube Selection</h2>
                <div className="flex space-x-4">
                  {[1, 2, 3].map(tubeNum => (
                    <button
                      key={tubeNum}
                      onClick={() => {
                        // Update the active tube in the store
                        useZenjinStore.getState().setActiveTube(tubeNum as 1 | 2 | 3);
                        
                        // Local state will be updated via the effect
                      }}
                      className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                        tubeNum === activeTube
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-white/70 hover:bg-gray-600'
                      }`}
                    >
                      Tube {tubeNum}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* State display sidebar */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white">
            <h2 className="text-xl font-semibold mb-4">Zustand Store State</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">User Information</h3>
                <pre className="bg-gray-900/50 p-3 rounded-md text-xs overflow-auto max-h-40">
                  {formatJson(userInfo)}
                </pre>
              </div>
              
              <div>
                <h3 className="font-medium mb-1">Tube State</h3>
                <pre className="bg-gray-900/50 p-3 rounded-md text-xs overflow-auto max-h-40">
                  {formatJson(tubeState)}
                </pre>
              </div>
              
              <div>
                <h3 className="font-medium mb-1">Learning Progress</h3>
                <pre className="bg-gray-900/50 p-3 rounded-md text-xs overflow-auto max-h-40">
                  {formatJson(useZenjinStore.getState().learningProgress)}
                </pre>
              </div>
              
              {sessionResults && (
                <div>
                  <h3 className="font-medium mb-1">Latest Session Results</h3>
                  <pre className="bg-green-900/30 border border-green-500/30 p-3 rounded-md text-xs overflow-auto max-h-40">
                    {formatJson(sessionResults)}
                  </pre>
                </div>
              )}
            </div>
            
            <div className="mt-6">
              <h3 className="font-medium mb-3">Actions</h3>
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
                    useZenjinStore.getState().setActiveTube(next as 1 | 2 | 3);
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
    </div>
  );
}