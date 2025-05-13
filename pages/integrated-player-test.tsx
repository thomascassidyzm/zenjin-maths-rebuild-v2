/**
 * Integrated Player Test Page
 * 
 * This page tests the integration of MinimalDistinctionPlayer with the Zustand store
 * using the position-based format data. This demonstrates how the player can work
 * directly with the position-based data format from the store.
 */

import { useEffect, useState } from 'react';
import { useZenjinStore } from '../lib/store/zenjinStore';
import MinimalDistinctionPlayer from '../components/MinimalDistinctionPlayer';

export default function IntegratedPlayerTest() {
  const [results, setResults] = useState<any>(null);
  
  // Get state from Zustand store for diagnostics
  const tubeState = useZenjinStore(state => state.tubeState);
  const userInfo = useZenjinStore(state => state.userInformation);
  const contentCollection = useZenjinStore(state => state.contentCollection);
  const contentBufferStatus = useZenjinStore(state => state.contentBufferStatus);
  
  // Active tube and tube data for the player
  const activeTube = tubeState?.activeTube || 1;
  const [tubeData, setTubeData] = useState<any>(null);
  
  // Initialize store with test data if needed
  const initializeState = useZenjinStore(state => state.initializeState);
  const resetStore = useZenjinStore(state => state.resetStore);
  const fillInitialContentBuffer = useZenjinStore(state => state.fillInitialContentBuffer);
  
  // Format the tubeState data for the player
  useEffect(() => {
    if (tubeState && tubeState.tubes) {
      // Create tube data object in the format expected by the player
      const formattedTubeData: Record<number, any> = {};
      
      // Convert each tube to the format expected by the player
      Object.entries(tubeState.tubes).forEach(([tubeNumStr, tube]) => {
        const tubeNum = parseInt(tubeNumStr);
        if (!tube) return;
        
        // Include the tube in the output, directly exposing positions object
        // The player now handles position-based format directly
        formattedTubeData[tubeNum] = {
          threadId: tube.threadId,
          currentStitchId: tube.currentStitchId,
          positions: tube.positions, // Directly pass the positions to the player
          stitches: [] // Keep this for backward compatibility
        };
        
        // If the tube has stitchOrder but no positions, create empty positions
        if (!tube.positions && tube.stitchOrder && tube.stitchOrder.length > 0) {
          formattedTubeData[tubeNum].positions = {};
          tube.stitchOrder.forEach((stitchId, index) => {
            formattedTubeData[tubeNum].positions[index] = {
              stitchId,
              skipNumber: 3,
              distractorLevel: 'L1'
            };
          });
        }
      });
      
      setTubeData(formattedTubeData);
      console.log('Formatted tube data for player:', formattedTubeData);
    }
  }, [tubeState]);
  
  // Initialize test data when the component mounts
  useEffect(() => {
    // Don't initialize if we already have data
    if (tubeState && Object.keys(tubeState.tubes).length > 0) {
      console.log('Using existing tube state:', tubeState);
      return;
    }
    
    console.log('Initializing test data in store');
    
    // First reset the store
    resetStore();
    
    // Initialize with test data
    initializeState({
      userInformation: {
        userId: `test-user-${Date.now()}`,
        isAnonymous: false,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      },
      tubeState: {
        activeTube: 1,
        tubes: {
          1: {
            threadId: 'thread-T1-001',
            currentStitchId: 'stitch-T1-001-01',
            positions: {
              0: { stitchId: 'stitch-T1-001-01', skipNumber: 3, distractorLevel: 'L1' },
              1: { stitchId: 'stitch-T1-001-02', skipNumber: 3, distractorLevel: 'L1' },
              2: { stitchId: 'stitch-T1-001-03', skipNumber: 3, distractorLevel: 'L1' }
            }
          },
          2: {
            threadId: 'thread-T2-001',
            currentStitchId: 'stitch-T2-001-01',
            positions: {
              0: { stitchId: 'stitch-T2-001-01', skipNumber: 3, distractorLevel: 'L1' },
              1: { stitchId: 'stitch-T2-001-02', skipNumber: 3, distractorLevel: 'L1' },
              2: { stitchId: 'stitch-T2-001-03', skipNumber: 3, distractorLevel: 'L1' }
            }
          },
          3: {
            threadId: 'thread-T3-001',
            currentStitchId: 'stitch-T3-001-01',
            positions: {
              0: { stitchId: 'stitch-T3-001-01', skipNumber: 3, distractorLevel: 'L1' },
              1: { stitchId: 'stitch-T3-001-02', skipNumber: 3, distractorLevel: 'L1' },
              2: { stitchId: 'stitch-T3-001-03', skipNumber: 3, distractorLevel: 'L1' }
            }
          }
        }
      }
    });
    
    // Fill the initial content buffer
    setTimeout(() => {
      fillInitialContentBuffer();
    }, 500);
  }, []);
  
  // Handle player completion
  const handleComplete = (results: any) => {
    console.log('Player session completed:', results);
    setResults(results);
  };
  
  // Handle player session end
  const handleEndSession = (results: any) => {
    console.log('Player session ended manually:', results);
    setResults(results);
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Integrated Player Test</h1>
        <p className="text-gray-300 mb-8">
          Testing MinimalDistinctionPlayer with Zustand position-based data format
        </p>
        
        {/* Diagnostic info */}
        <div className="bg-gray-800 rounded-lg p-4 mb-8">
          <h2 className="text-xl font-semibold mb-2">Store Status</h2>
          
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <p className="text-gray-300 mb-1">
                User ID: <span className="font-mono">{userInfo?.userId || 'None'}</span>
              </p>
              <p className="text-gray-300 mb-1">
                Active tube: <span className="font-mono">{activeTube}</span>
              </p>
              <p className="text-gray-300">
                Tube count: <span className="font-mono">
                  {tubeState?.tubes ? Object.keys(tubeState.tubes).length : 0}
                </span>
              </p>
            </div>
            <div>
              <p className="text-gray-300 mb-1">
                Cached stitches: <span className="font-mono">
                  {contentCollection?.stitches ? Object.keys(contentCollection.stitches).length : 0}
                </span>
              </p>
              <p className="text-gray-300 mb-1">
                Buffer phase 1: <span className="font-mono">
                  {contentBufferStatus?.phase1Loaded ? 'Loaded' : 'Not loaded'}
                </span>
              </p>
              <p className="text-gray-300">
                Buffer phase 2: <span className="font-mono">
                  {contentBufferStatus?.phase2Loaded ? 'Loaded' : 'Not loaded'}
                </span>
              </p>
            </div>
          </div>
          
          {/* Reload button */}
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md transition-colors text-sm"
          >
            Reload Page
          </button>
        </div>
        
        {/* Player component */}
        {tubeData ? (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              Playing Active Tube: {activeTube}
            </h2>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <MinimalDistinctionPlayer
                tubeNumber={activeTube}
                tubeData={tubeData}
                onComplete={handleComplete}
                onEndSession={handleEndSession}
                questionsPerSession={5}
                sessionTotalPoints={0}
                userId={userInfo?.userId}
              />
            </div>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="inline-block animate-spin h-8 w-8 border-4 border-teal-300 border-t-transparent rounded-full mb-4"></div>
            <p className="text-gray-300">Loading tube data...</p>
          </div>
        )}
        
        {/* Results display */}
        {results && (
          <div className="bg-gray-800 rounded-lg p-4 mb-8">
            <h2 className="text-xl font-semibold mb-2">Session Results</h2>
            <pre className="bg-gray-900 p-4 rounded-md overflow-auto text-sm">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}