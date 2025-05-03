import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { fetchUserStitches } from '../lib/supabase-client';
import { ThreadData } from '../lib/types/distinction-learning';
import { useAuth } from '../context/AuthContext';

export default function TestStitches() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [threadData, setThreadData] = useState<ThreadData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStitches() {
      try {
        setIsLoading(true);
        
        // Start with API fetch
        console.log('Fetching user stitches...', isAuthenticated ? 'User is authenticated' : 'User is not authenticated');
        if (user) {
          console.log('User ID:', user.id);
        }
        
        const result = await fetchUserStitches();
        console.log('Stitch data response:', result);
        
        if (result === null) {
          setError('Failed to fetch stitch data from API.');
        } else if (result.threads.length === 0) {
          setError('No threads found in the database.');
        } else {
          setThreadData(result.threads);
          
          if (result.tubePosition) {
            console.log(`Found saved tube position: Tube-${result.tubePosition.tubeNumber}, Thread-${result.tubePosition.threadId}`);
          }
          
          setError(null);
        }
      } catch (err) {
        console.error('Exception loading stitches:', err);
        setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    }

    // Only load stitches if auth is not loading
    if (!authLoading) {
      loadStitches();
    }
  }, [authLoading, isAuthenticated, user]);

  // Render loading state
  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center">
        <div className="text-center text-white">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
          <p>{authLoading ? 'Checking authentication...' : 'Loading stitches...'}</p>
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
            You need to be logged in to view stitch data.
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

  // Render error state
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
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors mr-4"
            >
              Try Again
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

  // Render the thread data
  return (
    <div className="min-h-screen player-bg p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-white">Stitch Data Test</h1>
            <div className="flex space-x-4">
              <a
                href="/test-thread-cycler"
                className="text-teal-300 hover:text-teal-200 transition-colors"
              >
                Thread Cycler
              </a>
              <a
                href="/test-sequencer"
                className="text-teal-300 hover:text-teal-200 transition-colors"
              >
                Sequencer Test
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

          {!threadData || threadData.length === 0 ? (
            <p className="text-gray-500">No thread data available.</p>
          ) : (
            <div className="space-y-8">
              {threadData.map((thread) => (
                <div key={thread.thread_id} className="border border-gray-200 rounded-lg p-4">
                  <h2 className="text-xl font-semibold mb-4">Thread: {thread.thread_id}</h2>
                  
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">Order Map:</h3>
                    <div className="bg-gray-50 p-3 rounded overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stitch ID</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {thread.orderMap.map((entry) => (
                            <tr key={entry.stitch_id}>
                              <td className="px-3 py-2 text-sm text-gray-900">{entry.stitch_id}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">{entry.order_number}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Stitches:</h3>
                  {thread.stitches.length === 0 ? (
                    <p className="text-gray-500">No stitches available for this thread.</p>
                  ) : (
                    <div className="space-y-4">
                      {thread.stitches.map((stitch) => (
                        <div key={stitch.id} className="border border-gray-200 rounded p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-blue-600">{stitch.name}</h4>
                              <p className="text-sm text-gray-600">{stitch.description}</p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                                stitch.order_number === 0 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {stitch.order_number === 0 ? 'Active' : `Order: ${stitch.order_number}`}
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
                          
                          <div className="mt-3">
                            <p className="text-xs text-gray-500 mb-2">Questions: {stitch.questions?.length || 0}</p>
                            {stitch.questions && stitch.questions.length > 0 && (
                              <div className="bg-gray-50 p-2 rounded text-sm">
                                <p className="font-medium">Sample Question:</p>
                                <p>{stitch.questions[0].text} = {stitch.questions[0].correctAnswer}</p>
                                <div className="mt-1 grid grid-cols-3 gap-1 text-xs">
                                  <div className="bg-red-50 p-1 rounded">L1: {stitch.questions[0].distractors.L1}</div>
                                  <div className="bg-yellow-50 p-1 rounded">L2: {stitch.questions[0].distractors.L2}</div>
                                  <div className="bg-orange-50 p-1 rounded">L3: {stitch.questions[0].distractors.L3}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}