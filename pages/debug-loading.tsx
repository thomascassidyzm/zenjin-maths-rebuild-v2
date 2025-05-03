import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { createClient } from '../lib/supabase/client';

// Create a client-side Supabase client
const supabase = createClient();

export default function DebugLoading() {
  const router = useRouter();
  const { isAuthenticated, user, loading } = useAuth();
  
  const [logs, setLogs] = useState<string[]>([]);
  const [threadData, setThreadData] = useState<any[]>([]);
  const [stitchData, setStitchData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
  };
  
  // Test loading state and threads
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      addLog("User not authenticated, trying with anonymous user");
      runTests('anonymous-debug-user');
    } else if (isAuthenticated && user) {
      addLog(`User authenticated as ${user.email || user.id}`);
      runTests(user.id);
    }
  }, [isAuthenticated, loading, user]);
  
  const runTests = async (userId: string) => {
    setIsLoading(true);
    try {
      addLog(`Starting debug for user ${userId}`);
      
      // Test 1: Check if we can load state
      addLog('Test 1: Loading state from API...');
      try {
        const stateResponse = await fetch(`/api/user-state?debug=true&userId=${encodeURIComponent(userId)}`);
        const stateData = await stateResponse.json();
        
        if (stateResponse.ok) {
          addLog('✅ State loaded successfully');
          
          if (stateData.state) {
            addLog(`State contains: activeTube=${stateData.state.activeTube}, cycleCount=${stateData.state.cycleCount}`);
            if (stateData.state.tubes) {
              Object.keys(stateData.state.tubes).forEach((tubeKey) => {
                const tube = stateData.state.tubes[tubeKey];
                addLog(`Tube ${tubeKey}: threadId=${tube.threadId}, currentStitchId=${tube.currentStitchId}, position=${tube.position}`);
              });
            }
          } else {
            addLog('⚠️ State object is empty');
          }
        } else {
          addLog(`❌ Failed to load state: ${stateData.error}`);
        }
      } catch (err) {
        addLog(`❌ Error loading state: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      // Test 2: Load threads
      addLog('Test 2: Loading threads from database...');
      try {
        const { data: threads, error: threadsError } = await supabase
          .from('threads')
          .select('*')
          .limit(10);
        
        if (threadsError) {
          throw threadsError;
        }
        
        setThreadData(threads || []);
        addLog(`✅ Loaded ${threads?.length || 0} threads`);
      } catch (err) {
        addLog(`❌ Error loading threads: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      // Test 3: Load stitches for first thread
      addLog('Test 3: Loading stitches...');
      try {
        if (threadData.length > 0) {
          const firstThreadId = threadData[0]?.id;
          addLog(`Loading stitches for thread ${firstThreadId}`);
          
          const { data: stitches, error: stitchesError } = await supabase
            .from('stitches')
            .select('*')
            .eq('thread_id', firstThreadId)
            .limit(10);
          
          if (stitchesError) {
            throw stitchesError;
          }
          
          setStitchData(stitches || []);
          addLog(`✅ Loaded ${stitches?.length || 0} stitches for thread ${firstThreadId}`);
        } else {
          addLog('⚠️ No threads available to load stitches for');
        }
      } catch (err) {
        addLog(`❌ Error loading stitches: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      // Test 4: Check threads table functionality more directly
      addLog('Test 4: Testing threads table directly...');
      try {
        // Just count the number of threads
        const { count, error: countError } = await supabase
          .from('threads')
          .select('*', { count: 'exact', head: true });
          
        if (countError) {
          throw countError;
        }
        
        addLog(`✅ Threads table count query successful. Total thread count: ${count}`);
      } catch (err) {
        addLog(`❌ Error with direct threads test: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      // Test 5: Load tube position
      addLog('Test 5: Loading tube position...');
      try {
        const { data: tubePosition, error: tubeError } = await supabase
          .from('user_tube_position')
          .select('*')
          .eq('user_id', userId)
          .single();
          
        if (tubeError && tubeError.code !== 'PGRST116') {
          // Not a "not found" error
          throw tubeError;
        }
        
        if (tubePosition) {
          addLog(`✅ Loaded tube position: tube_number=${tubePosition.tube_number}, thread_id=${tubePosition.thread_id}`);
        } else {
          addLog('⚠️ No tube position found for this user');
        }
      } catch (err) {
        addLog(`❌ Error loading tube position: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      // Final verdict
      addLog('Tests completed.');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      addLog(`❌ Error during tests: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Debug Loading | Better Player</title>
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Debug Loading Issues</h1>
            
            <div className="flex space-x-2">
              <button 
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Back to Home
              </button>
              
              <button 
                onClick={() => runTests(user?.id || 'anonymous-debug-user')}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={isLoading}
              >
                {isLoading ? 'Running Tests...' : 'Run Tests Again'}
              </button>
            </div>
          </div>
          
          <p className="mb-4 text-gray-600">
            This tool diagnoses issues with the "Loading next stitch" spinner by testing each component
            of the loading process.
          </p>
          
          {!isAuthenticated && !loading ? (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
              <p>Note: You are not authenticated. Tests will run with an anonymous user ID.</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <p className="ml-4">Loading authentication status...</p>
            </div>
          ) : (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              <p>Authenticated as: {user?.email || user?.id}</p>
            </div>
          )}
          
          {/* Test Logs */}
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-2">Diagnostic Logs</h2>
            <div className="bg-black text-white p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500">Running tests...</p>
              ) : (
                logs.map((log, index) => (
                  <div 
                    key={index} 
                    className={`py-1 ${
                      log.includes('❌') ? 'text-red-400' :
                      log.includes('⚠️') ? 'text-yellow-400' :
                      log.includes('✅') ? 'text-green-400' :
                      'text-gray-300'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Thread Data */}
          {threadData.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2">Thread Data</h2>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tube</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {threadData.map((thread, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{thread.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{thread.name}</td>
                        <td className="px-6 py-4">{thread.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{thread.tube_number || 'Not assigned'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Stitch Data */}
          {stitchData.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2">Stitch Data for First Thread</h2>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stitchData.map((stitch, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{stitch.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{stitch.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{stitch.order}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Error Display */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-bold">Error:</p>
              <p>{error}</p>
            </div>
          )}
          
          <div className="mt-8 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h2 className="text-lg font-bold mb-2">Debug Suggestions</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Check that thread data is correctly loading (Test 2)</li>
              <li>Verify that stitches are associated with threads (Test 3)</li>
              <li>Confirm that tube positions are correctly stored (Test 5)</li>
              <li>If all tests pass but the spinner still appears, it suggests an issue in the user interface component rendering rather than data loading</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}