import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

/**
 * Triple-Helix Debug Page
 * 
 * This page helps diagnose issues with tube assignments and stitch loading
 * by displaying raw API responses and analyzing the data
 */
export default function TripleHelixDebug() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [diagnosticResults, setDiagnosticResults] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>(`diag-debug-${Date.now()}`);
  
  // Fetch data on load
  useEffect(() => {
    fetchData();
  }, []);
  
  // Fetch fresh data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Generate a unique diagnostic user ID
      const newUserId = `diag-debug-${Date.now()}`;
      setUserId(newUserId);
      
      // Call the API to get thread data
      const response = await fetch(`/api/user-stitches?userId=${newUserId}&prefetch=10`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      
      const data = await response.json();
      setRawResponse(data);
      
      if (!data.success) {
        throw new Error('API returned failure status');
      }
      
      // Run diagnostics on the data
      const results = runDiagnostics(data);
      setDiagnosticResults(results);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching debug data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Run diagnostics on the API response
  const runDiagnostics = (data: any) => {
    const threads = data.data || [];
    const results = [];
    
    // Check if Thread D exists and is in Tube 3
    const threadD = threads.find((t: any) => t.thread_id === 'thread-D');
    
    if (threadD) {
      results.push({
        name: 'Thread D Existence',
        status: 'success',
        message: `Thread D found with ${threadD.stitches?.length || 0} stitches`
      });
      
      // Check tube assignment
      if (threadD.tube_number === 3) {
        results.push({
          name: 'Thread D Tube Assignment',
          status: 'success',
          message: 'Thread D is correctly assigned to Tube 3'
        });
      } else {
        results.push({
          name: 'Thread D Tube Assignment',
          status: 'error',
          message: `Thread D is assigned to Tube ${threadD.tube_number} instead of Tube 3`
        });
      }
    } else {
      results.push({
        name: 'Thread D Existence',
        status: 'error',
        message: 'Thread D not found in API response'
      });
    }
    
    // Check other thread assignments
    const threadA = threads.find((t: any) => t.thread_id === 'thread-A');
    const threadB = threads.find((t: any) => t.thread_id === 'thread-B');
    const threadC = threads.find((t: any) => t.thread_id === 'thread-C');
    
    if (threadA && threadA.tube_number !== 1) {
      results.push({
        name: 'Thread A Tube Assignment',
        status: 'error',
        message: `Thread A is assigned to Tube ${threadA.tube_number} instead of Tube 1`
      });
    }
    
    if (threadB && threadB.tube_number !== 2) {
      results.push({
        name: 'Thread B Tube Assignment',
        status: 'error',
        message: `Thread B is assigned to Tube ${threadB.tube_number} instead of Tube 2`
      });
    }
    
    if (threadC && threadC.tube_number !== 3) {
      results.push({
        name: 'Thread C Tube Assignment',
        status: 'error',
        message: `Thread C is assigned to Tube ${threadC.tube_number} instead of Tube 3`
      });
    }
    
    // Check for tube collisions (multiple primary threads in same tube)
    const tube1Threads = threads.filter((t: any) => t.tube_number === 1);
    const tube2Threads = threads.filter((t: any) => t.tube_number === 2);
    const tube3Threads = threads.filter((t: any) => t.tube_number === 3);
    
    if (tube1Threads.length > 0) {
      results.push({
        name: 'Tube 1 Content',
        status: 'success',
        message: `Tube 1 contains ${tube1Threads.map((t: any) => t.thread_id).join(', ')}`
      });
    }
    
    if (tube2Threads.length > 0) {
      results.push({
        name: 'Tube 2 Content',
        status: 'success',
        message: `Tube 2 contains ${tube2Threads.map((t: any) => t.thread_id).join(', ')}`
      });
    }
    
    if (tube3Threads.length > 0) {
      const tube3ThreadNames = tube3Threads.map((t: any) => t.thread_id).join(', ');
      const hasThreadD = tube3Threads.some((t: any) => t.thread_id === 'thread-D');
      
      results.push({
        name: 'Tube 3 Content',
        status: hasThreadD ? 'success' : 'warning',
        message: `Tube 3 contains ${tube3ThreadNames}${!hasThreadD ? ' but Thread D is missing!' : ''}`
      });
    }
    
    // Check stitch properties
    const allStitches = threads.flatMap((t: any) => t.stitches || []);
    
    if (allStitches.length > 0) {
      // Check if all stitches have order_number
      const missingOrderNumber = allStitches.some((s: any) => s.order_number === undefined);
      
      if (missingOrderNumber) {
        results.push({
          name: 'Stitch Order Numbers',
          status: 'error',
          message: 'Some stitches are missing order_number property'
        });
      } else {
        results.push({
          name: 'Stitch Order Numbers',
          status: 'success',
          message: 'All stitches have order_number property'
        });
      }
      
      // Check if each thread has at least one active stitch (order_number = 0)
      const threadsWithActiveStitch = new Set();
      
      allStitches.forEach((s: any) => {
        if (s.order_number === 0) {
          threadsWithActiveStitch.add(s.thread_id);
        }
      });
      
      const threadsWithoutActiveStitch = threads.filter((t: any) => 
        !threadsWithActiveStitch.has(t.thread_id)
      );
      
      if (threadsWithoutActiveStitch.length > 0) {
        results.push({
          name: 'Active Stitches',
          status: 'error',
          message: `Threads missing active stitch: ${threadsWithoutActiveStitch.map((t: any) => t.thread_id).join(', ')}`
        });
      } else {
        results.push({
          name: 'Active Stitches',
          status: 'success',
          message: 'All threads have one active stitch (order_number = 0)'
        });
      }
    }
    
    return results;
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head>
        <title>Triple-Helix Debug</title>
      </Head>
      
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-6">Triple-Helix Debug Page</h1>
        <p className="mb-8 text-gray-300">User ID: {userId}</p>
        
        {loading ? (
          <div className="bg-gray-800 rounded-xl p-8 animate-pulse">
            <p>Loading thread data...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900 rounded-xl p-8">
            <h2 className="text-xl font-bold mb-4">Error</h2>
            <p className="text-red-200">{error}</p>
            <button 
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Diagnostic results display */}
            <div className="mb-8 bg-gray-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Diagnostic Results</h2>
                <button 
                  onClick={fetchData}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm"
                >
                  Refresh Data
                </button>
              </div>
              
              <div className="space-y-4">
                {diagnosticResults.map((result, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg ${
                      result.status === 'success' ? 'bg-green-900/30 border border-green-700' : 
                      result.status === 'warning' ? 'bg-yellow-900/30 border border-yellow-700' : 
                      'bg-red-900/30 border border-red-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.status === 'success' && (
                        <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                      
                      {result.status === 'warning' && (
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                      
                      {result.status === 'error' && (
                        <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                      
                      <h3 className="font-medium">{result.name}</h3>
                    </div>
                    <p className="mt-1 ml-7 text-sm text-gray-300">{result.message}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Raw API response */}
            <div className="mb-8 bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">Raw API Response</h2>
              <div className="max-h-96 overflow-auto bg-black/30 p-4 rounded-lg">
                <pre className="text-xs whitespace-pre-wrap text-gray-300 font-mono">
                  {JSON.stringify(rawResponse, null, 2)}
                </pre>
              </div>
            </div>
            
            {/* Thread data summary table */}
            <div className="mb-8 bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">Thread Summary</h2>
              
              <div className="overflow-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 rounded-tl-lg">Thread ID</th>
                      <th className="px-4 py-2">Tube Number</th>
                      <th className="px-4 py-2">Stitches</th>
                      <th className="px-4 py-2">Active Stitch</th>
                      <th className="px-4 py-2 rounded-tr-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawResponse?.data?.map((thread: any) => {
                      const activeStitch = thread.stitches?.find((s: any) => s.order_number === 0);
                      const isCorrectTube = 
                        (thread.thread_id === 'thread-A' && thread.tube_number === 1) ||
                        (thread.thread_id === 'thread-B' && thread.tube_number === 2) ||
                        (thread.thread_id === 'thread-C' && thread.tube_number === 3) ||
                        (thread.thread_id === 'thread-D' && thread.tube_number === 3) ||
                        (thread.thread_id === 'thread-E' && thread.tube_number === 2) ||
                        (thread.thread_id === 'thread-F' && thread.tube_number === 1);
                      
                      return (
                        <tr key={thread.thread_id} className="border-t border-gray-700">
                          <td className="px-4 py-2">{thread.thread_id}</td>
                          <td className="px-4 py-2">
                            <span className={`
                              px-2 py-1 rounded-lg text-xs 
                              ${thread.tube_number === 1 ? 'bg-blue-900/50 text-blue-200' : 
                                thread.tube_number === 2 ? 'bg-purple-900/50 text-purple-200' : 
                                'bg-green-900/50 text-green-200'}
                            `}>
                              Tube-{thread.tube_number}
                            </span>
                          </td>
                          <td className="px-4 py-2">{thread.stitches?.length || 0}</td>
                          <td className="px-4 py-2">
                            {activeStitch ? (
                              <span className="text-teal-300">
                                {activeStitch.id}
                              </span>
                            ) : (
                              <span className="text-red-400">None</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {isCorrectTube ? (
                              <span className="px-2 py-1 bg-green-800/30 text-green-300 rounded-full text-xs">
                                Correct Tube
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-red-800/30 text-red-300 rounded-full text-xs">
                                Wrong Tube
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
            
            {/* Links to player pages */}
            <div className="flex flex-wrap gap-4 mt-8">
              <Link href="/triple-helix-player-fixed" passHref>
                <div className="inline-block px-6 py-3 bg-blue-700 hover:bg-blue-600 rounded-lg font-medium">
                  Run Triple-Helix Player with Fix
                </div>
              </Link>
              
              <Link href="/verify-tube-d" passHref>
                <div className="inline-block px-6 py-3 bg-green-700 hover:bg-green-600 rounded-lg font-medium">
                  Verify Thread D Assignment
                </div>
              </Link>
              
              <Link href="/" passHref>
                <div className="inline-block px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium">
                  Back to Home
                </div>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}