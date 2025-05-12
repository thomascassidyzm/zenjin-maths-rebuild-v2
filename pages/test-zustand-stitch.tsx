/**
 * Test page for Zustand Stitch Content System
 * 
 * This page demonstrates the new stitch content loading system using Zustand.
 * It allows testing of stitch loading, error handling, and UI components.
 */

import { useState } from 'react';
import { useZenjinStore } from '../lib/store/zenjinStore';
import { useStitchContent } from '../lib/hooks/useStitchContent';
import StitchContentLoader from '../components/StitchContentLoader';

export default function TestZustandStitchPage() {
  const [stitchId, setStitchId] = useState('');
  const [inputValue, setInputValue] = useState('');
  
  // Get store state for diagnostics
  const contentCollection = useZenjinStore(state => state.contentCollection);
  const cachedStitchCount = contentCollection?.stitches 
    ? Object.keys(contentCollection.stitches).length 
    : 0;
  
  // Try to manually fetch a stitch for testing the API call
  const manualFetchStitch = useZenjinStore(state => state.fetchStitch);
  const [manualFetchResult, setManualFetchResult] = useState<any>(null);
  const [isFetching, setIsFetching] = useState(false);
  
  const handleFetchClick = async () => {
    if (!inputValue) return;
    
    setIsFetching(true);
    try {
      const result = await manualFetchStitch(inputValue);
      setManualFetchResult(result);
      // If fetch was successful, update the input field with the fetched ID
      if (result) {
        setStitchId(inputValue);
      }
    } catch (error) {
      console.error('Error fetching stitch:', error);
      setManualFetchResult({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsFetching(false);
    }
  };
  
  // Some sample stitch IDs for testing
  const sampleStitchIds = [
    'stitch-T1-001-01',
    'stitch-T2-001-01',
    'stitch-T3-001-01'
  ];
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Zustand Stitch Content Test</h1>
        <p className="text-gray-300 mb-8">
          Test the new Zustand-based stitch content loading system
        </p>
        
        {/* Diagnostic info */}
        <div className="bg-gray-800 rounded-lg p-4 mb-8">
          <h2 className="text-xl font-semibold mb-2">Store Status</h2>
          <p className="text-gray-300 mb-1">
            Cached stitches: <span className="font-mono">{cachedStitchCount}</span>
          </p>
          <p className="text-gray-300">
            Store initialized: <span className="font-mono">{useZenjinStore(state => state.isInitialized) ? 'Yes' : 'No'}</span>
          </p>
        </div>
        
        {/* Manual fetch section */}
        <div className="bg-gray-800 rounded-lg p-4 mb-8">
          <h2 className="text-xl font-semibold mb-4">Manual Fetch Test</h2>
          
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter stitch ID to fetch"
              className="bg-gray-700 text-white px-3 py-2 rounded-md flex-1"
            />
            <button
              onClick={handleFetchClick}
              disabled={isFetching}
              className={`bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md transition-colors ${isFetching ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isFetching ? 'Fetching...' : 'Fetch'}
            </button>
          </div>
          
          {/* Sample stitch ID buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {sampleStitchIds.map(id => (
              <button
                key={id}
                onClick={() => setInputValue(id)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm"
              >
                {id}
              </button>
            ))}
          </div>
          
          {/* Display manual fetch result */}
          {manualFetchResult && (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Fetch Result:</h3>
              <pre className="bg-gray-900 p-4 rounded-md overflow-auto text-sm">
                {JSON.stringify(manualFetchResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
        
        {/* StitchContentLoader component test */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">StitchContentLoader Component Test</h2>
          
          <div className="mb-4">
            <label className="block text-gray-300 mb-2">Stitch ID to load:</label>
            <input
              type="text"
              value={stitchId}
              onChange={(e) => setStitchId(e.target.value)}
              placeholder="Enter a stitch ID"
              className="bg-gray-700 text-white px-3 py-2 rounded-md w-full"
            />
          </div>
          
          {stitchId && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Loading stitch: {stitchId}</h3>
              <StitchContentLoader stitchId={stitchId}>
                {(stitch) => (
                  <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-2">{stitch.title || 'Untitled Stitch'}</h3>
                    <p className="text-gray-300 mb-4">{stitch.content || 'No description available'}</p>
                    
                    <div className="mt-6">
                      <h4 className="text-lg font-medium mb-3">Questions ({stitch.questions?.length || 0})</h4>
                      {stitch.questions && stitch.questions.length > 0 ? (
                        <ul className="space-y-4">
                          {stitch.questions.slice(0, 5).map((q: any, index: number) => (
                            <li key={q.id || index} className="bg-gray-800/50 p-4 rounded-md">
                              <p className="font-medium mb-2">{q.text || q.questionText}</p>
                              <p className="text-green-400">Correct: {q.correctAnswer}</p>
                              <div className="mt-2 grid grid-cols-3 gap-2">
                                {q.distractors ? (
                                  Object.entries(q.distractors).map(([level, text]) => (
                                    <span key={level} className="bg-gray-700 px-2 py-1 rounded text-sm">
                                      {level}: {text}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-gray-400">No distractors</span>
                                )}
                              </div>
                            </li>
                          ))}
                          {stitch.questions.length > 5 && (
                            <li className="text-center text-gray-400">
                              ...and {stitch.questions.length - 5} more questions
                            </li>
                          )}
                        </ul>
                      ) : (
                        <p className="text-gray-400">No questions available</p>
                      )}
                    </div>
                  </div>
                )}
              </StitchContentLoader>
            </div>
          )}
        </div>
        
        {/* Raw useStitchContent hook test */}
        {stitchId && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">useStitchContent Hook Test</h2>
            <RawHookTest stitchId={stitchId} />
          </div>
        )}
      </div>
    </div>
  );
}

// Component to test the raw hook implementation
function RawHookTest({ stitchId }: { stitchId: string }) {
  const { stitch, loading, error } = useStitchContent(stitchId);
  
  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex items-center">
          <div className="animate-spin w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full mr-3"></div>
          <p>Loading stitch content...</p>
        </div>
      </div>
    );
  }
  
  if (error || !stitch) {
    return (
      <div className="bg-red-900/30 border border-red-500/30 p-6 rounded-lg">
        <h3 className="text-red-300 font-medium mb-2">Error in useStitchContent hook:</h3>
        <p className="text-gray-300">{error ? error.message : 'Stitch not found'}</p>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h3 className="text-lg font-medium mb-2">Hook Result:</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-gray-400 mb-1">ID:</p>
          <p className="font-mono text-sm mb-3">{stitch.id}</p>
          
          <p className="text-gray-400 mb-1">Thread ID:</p>
          <p className="font-mono text-sm mb-3">{stitch.threadId}</p>
          
          <p className="text-gray-400 mb-1">Title:</p>
          <p className="font-medium mb-3">{stitch.title || 'Untitled'}</p>
        </div>
        <div>
          <p className="text-gray-400 mb-1">Content:</p>
          <p className="text-sm mb-3">{stitch.content || 'No content'}</p>
          
          <p className="text-gray-400 mb-1">Questions:</p>
          <p className="text-sm">{stitch.questions?.length || 0} questions available</p>
        </div>
      </div>
    </div>
  );
}