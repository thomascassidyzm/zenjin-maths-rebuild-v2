import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

/**
 * Verification page for Thread D tube assignment
 * 
 * This page calls the API endpoints to check if Thread D 
 * is consistently assigned to Tube 3 and displays the results.
 */
export default function VerifyTubeD() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threadData, setThreadData] = useState<any[]>([]);
  const [tubePosition, setTubePosition] = useState<any>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [verification, setVerification] = useState<{
    threadsFound: boolean;
    threadDExists: boolean;
    threadDInTube3: boolean;
    otherThreadsCorrect: boolean;
    overallStatus: 'success' | 'warning' | 'error';
    message: string;
  }>({
    threadsFound: false,
    threadDExists: false,
    threadDInTube3: false,
    otherThreadsCorrect: false,
    overallStatus: 'error',
    message: 'Verification not yet performed'
  });

  // Fetch data on load
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        // Generate a unique diagnostic user ID for testing
        const diagUserId = `diag-tube-verify-${Date.now()}`;
        
        // Call the API to get thread data
        const response = await fetch(`/api/user-stitches?userId=${diagUserId}&prefetch=5`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status}`);
        }
        
        const data = await response.json();
        setApiResponse(data);
        
        if (!data.success) {
          throw new Error('API returned failure status');
        }
        
        const threads = data.data;
        setThreadData(threads);
        setTubePosition(data.tubePosition);
        
        // Verify thread D is in tube 3
        let threadsFound = threads.length > 0;
        let threadDExists = false;
        let threadDInTube3 = false;
        let otherThreadsCorrect = true;
        
        // Check all threads for correct tube assignments
        for (const thread of threads) {
          if (thread.thread_id === 'thread-D') {
            threadDExists = true;
            threadDInTube3 = thread.tube_number === 3;
          } else if (thread.thread_id === 'thread-A' && thread.tube_number !== 1) {
            otherThreadsCorrect = false;
          } else if (thread.thread_id === 'thread-B' && thread.tube_number !== 2) {
            otherThreadsCorrect = false;
          } else if (thread.thread_id === 'thread-C' && thread.tube_number !== 3) {
            otherThreadsCorrect = false;
          }
        }
        
        // Set verification results
        let overallStatus: 'success' | 'warning' | 'error' = 'error';
        let message = 'Verification failed';
        
        if (threadsFound && threadDExists && threadDInTube3 && otherThreadsCorrect) {
          overallStatus = 'success';
          message = 'All thread tube assignments are correct, including Thread D in Tube 3';
        } else if (threadsFound && threadDExists && threadDInTube3) {
          overallStatus = 'warning';
          message = 'Thread D is in Tube 3, but other thread assignments have issues';
        } else if (threadsFound && threadDExists) {
          overallStatus = 'error';
          message = 'Thread D exists but is NOT assigned to Tube 3';
        } else if (threadsFound) {
          overallStatus = 'error';
          message = 'Threads exist but Thread D was not found';
        } else {
          overallStatus = 'error';
          message = 'No threads found in the database';
        }
        
        setVerification({
          threadsFound,
          threadDExists,
          threadDInTube3,
          otherThreadsCorrect,
          overallStatus,
          message
        });
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Error verifying thread D:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head>
        <title>Verify Thread D Tube Assignment</title>
      </Head>
      
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Thread D Tube Assignment Verification</h1>
        
        {loading ? (
          <div className="bg-gray-800 rounded-xl p-8 animate-pulse">
            <p>Loading thread data...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900 rounded-xl p-8">
            <h2 className="text-xl font-bold mb-4">Error</h2>
            <p className="text-red-200">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Verification status summary */}
            <div className={`mb-8 rounded-xl p-6 shadow-lg ${
              verification.overallStatus === 'success' ? 'bg-green-800' : 
              verification.overallStatus === 'warning' ? 'bg-yellow-800' : 
              'bg-red-800'
            }`}>
              <h2 className="text-xl font-bold mb-2">Verification Status</h2>
              <p className="text-lg">{verification.message}</p>
              
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="bg-black bg-opacity-30 p-3 rounded-lg">
                  <div className="flex items-center">
                    <div className={`h-3 w-3 rounded-full mr-2 ${verification.threadsFound ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    <span>Threads found</span>
                  </div>
                </div>
                <div className="bg-black bg-opacity-30 p-3 rounded-lg">
                  <div className="flex items-center">
                    <div className={`h-3 w-3 rounded-full mr-2 ${verification.threadDExists ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    <span>Thread D exists</span>
                  </div>
                </div>
                <div className="bg-black bg-opacity-30 p-3 rounded-lg">
                  <div className="flex items-center">
                    <div className={`h-3 w-3 rounded-full mr-2 ${verification.threadDInTube3 ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    <span>Thread D in Tube 3</span>
                  </div>
                </div>
                <div className="bg-black bg-opacity-30 p-3 rounded-lg">
                  <div className="flex items-center">
                    <div className={`h-3 w-3 rounded-full mr-2 ${verification.otherThreadsCorrect ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    <span>Other threads correct</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Thread data display */}
            <div className="mb-8 bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">Thread Tube Assignments</h2>
              
              <div className="overflow-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 rounded-tl-lg">Thread ID</th>
                      <th className="px-4 py-2">Tube Number</th>
                      <th className="px-4 py-2">Stitch Count</th>
                      <th className="px-4 py-2 rounded-tr-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {threadData.map((thread) => {
                      const isCorrect = 
                        (thread.thread_id === 'thread-A' && thread.tube_number === 1) ||
                        (thread.thread_id === 'thread-B' && thread.tube_number === 2) ||
                        (thread.thread_id === 'thread-C' && thread.tube_number === 3) ||
                        (thread.thread_id === 'thread-D' && thread.tube_number === 3) ||
                        (thread.thread_id === 'thread-E' && thread.tube_number === 2) ||
                        (thread.thread_id === 'thread-F' && thread.tube_number === 1);
                        
                      return (
                        <tr key={thread.thread_id} className="border-t border-gray-700">
                          <td className="px-4 py-2">{thread.thread_id}</td>
                          <td className="px-4 py-2">Tube-{thread.tube_number}</td>
                          <td className="px-4 py-2">{thread.stitches?.length || 0}</td>
                          <td className="px-4 py-2">
                            {isCorrect ? (
                              <span className="px-2 py-1 bg-green-800 text-green-200 rounded-full text-xs">
                                Correct
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-red-800 text-red-200 rounded-full text-xs">
                                Incorrect
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
            
            {/* Run Triple-Helix Player button */}
            <div className="flex gap-4 mt-4">
              <Link href="/triple-helix-player-fixed" passHref>
                <div className="inline-block px-6 py-3 bg-blue-700 hover:bg-blue-600 rounded-lg font-medium">
                  Run Triple-Helix Player with Fix
                </div>
              </Link>
              
              <Link href="/triple-helix-debug" passHref>
                <div className="inline-block px-6 py-3 bg-purple-700 hover:bg-purple-600 rounded-lg font-medium">
                  Open Debug Page
                </div>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}