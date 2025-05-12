/**
 * Test page for ZustandDistinctionPlayer
 * 
 * This page demonstrates the new player implementation with Zustand integration.
 */

import { useState } from 'react';
import { useZenjinStore } from '../lib/store/zenjinStore';
import ZustandDistinctionPlayer from '../components/ZustandDistinctionPlayer';

export default function TestZustandPlayerPage() {
  const [stitchId, setStitchId] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<any>(null);
  
  // Get store state for diagnostics
  const contentCollection = useZenjinStore(state => state.contentCollection);
  const cachedStitchCount = contentCollection?.stitches 
    ? Object.keys(contentCollection.stitches).length 
    : 0;
  
  // Initialize Zustand store if needed
  const isInitialized = useZenjinStore(state => state.isInitialized);
  const initializeState = useZenjinStore(state => state.initializeState);
  const userInfo = useZenjinStore(state => state.userInformation);
  
  // Ensure store is initialized
  if (!isInitialized && !userInfo) {
    // Create anonymous user ID
    const anonymousId = `anon-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Initialize the store with anonymous user
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
      contentCollection: {
        stitches: {},
        questions: {}
      }
    });
  }
  
  // Some sample stitch IDs for testing
  const sampleStitchIds = [
    'stitch-T1-001-01',
    'stitch-T2-001-01',
    'stitch-T3-001-01'
  ];
  
  // Handle session completion
  const handleComplete = (results: any) => {
    console.log('Player session completed:', results);
    setResults(results);
  };
  
  // Handle session end
  const handleEndSession = (results: any) => {
    console.log('Player session ended manually:', results);
    setResults(results);
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Zustand Distinction Player Test</h1>
        <p className="text-gray-300 mb-8">
          Test the new ZustandDistinctionPlayer component with Zustand store integration
        </p>
        
        {/* Diagnostic info */}
        <div className="bg-gray-800 rounded-lg p-4 mb-8">
          <h2 className="text-xl font-semibold mb-2">Store Status</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-300 mb-1">
                Cached stitches: <span className="font-mono">{cachedStitchCount}</span>
              </p>
              <p className="text-gray-300">
                Store initialized: <span className="font-mono">{useZenjinStore(state => state.isInitialized) ? 'Yes' : 'No'}</span>
              </p>
            </div>
            <div>
              <p className="text-gray-300 mb-1">
                User ID: <span className="font-mono">{userInfo?.userId || 'None'}</span>
              </p>
              <p className="text-gray-300">
                Is Anonymous: <span className="font-mono">{userInfo?.isAnonymous ? 'Yes' : 'No'}</span>
              </p>
            </div>
          </div>
        </div>
        
        {/* Stitch selection section */}
        <div className="bg-gray-800 rounded-lg p-4 mb-8">
          <h2 className="text-xl font-semibold mb-4">Select Stitch to Play</h2>
          
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter stitch ID to play"
              className="bg-gray-700 text-white px-3 py-2 rounded-md flex-1"
            />
            <button
              onClick={() => setStitchId(inputValue)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md transition-colors"
            >
              Play
            </button>
          </div>
          
          {/* Sample stitch ID buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {sampleStitchIds.map(id => (
              <button
                key={id}
                onClick={() => {
                  setInputValue(id);
                  setStitchId(id);
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm"
              >
                {id}
              </button>
            ))}
          </div>
        </div>
        
        {/* Player component */}
        {stitchId && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Playing Stitch: {stitchId}</h2>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <ZustandDistinctionPlayer
                stitchId={stitchId}
                tubeNumber={parseInt(stitchId.charAt(8), 10) as 1 | 2 | 3}
                onComplete={handleComplete}
                onEndSession={handleEndSession}
                questionsPerSession={5}
                sessionTotalPoints={0}
                userId={userInfo?.userId}
              />
            </div>
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