import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { createClient } from '../lib/supabase/client';
import { FREE_TIER_THREAD_IDS, FREE_TIER_STITCH_LIMIT } from '../lib/constants/free-tier';

// Create a client-side Supabase client
const supabase = createClient();

export default function FreeTierSetup() {
  const router = useRouter();
  const { isAuthenticated, user, loading } = useAuth();
  
  const [threads, setThreads] = useState<any[]>([]);
  const [stitches, setStitches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Load threads and stitches from the database
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch threads
      const { data: threadsData, error: threadsError } = await supabase
        .from('threads')
        .select('*')
        .order('id');

      if (threadsError) {
        throw new Error(`Error fetching threads: ${threadsError.message}`);
      }

      setThreads(threadsData || []);
      console.log(`Found ${threadsData?.length || 0} threads`);

      // Fetch stitches with related questions
      const { data: stitchesData, error: stitchesError } = await supabase
        .from('stitches')
        .select('*, questions(*)')
        .order('thread_id, id');

      if (stitchesError) {
        throw new Error(`Error fetching stitches: ${stitchesError.message}`);
      }

      setStitches(stitchesData || []);
      console.log(`Found ${stitchesData?.length || 0} stitches`);

    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to check if a thread is in the free tier
  const isThreadInFreeTier = (threadId: string): boolean => {
    return FREE_TIER_THREAD_IDS.includes(threadId);
  };

  // Get stitches for a specific thread
  const getStitchesForThread = (threadId: string): any[] => {
    return stitches.filter(stitch => stitch.thread_id === threadId);
  };

  // Get free tier stitches for a thread (first FREE_TIER_STITCH_LIMIT stitches)
  const getFreeTierStitchesForThread = (threadId: string): any[] => {
    const threadStitches = getStitchesForThread(threadId);
    return threadStitches.slice(0, FREE_TIER_STITCH_LIMIT);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Free Tier Setup | Zenjin Maths</title>
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Free Tier Content Setup</h1>
            
            <div className="flex space-x-2">
              <button 
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Back to Home
              </button>
              
              <button 
                onClick={loadData}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Refresh Data'}
              </button>
            </div>
          </div>
          
          <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h2 className="text-xl font-bold mb-2">Free Tier Configuration</h2>
            <p className="mb-2">The following settings are currently configured for the free tier:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <h3 className="font-semibold">Thread IDs in Free Tier:</h3>
                <ul className="list-disc list-inside">
                  {FREE_TIER_THREAD_IDS.map(threadId => (
                    <li key={threadId} className="font-mono">{threadId}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold">Other Limits:</h3>
                <p><span className="font-medium">Stitches per Thread:</span> {FREE_TIER_STITCH_LIMIT}</p>
              </div>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-bold">Error:</p>
              <p>{error}</p>
            </div>
          )}
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <p className="ml-4">Loading data...</p>
            </div>
          ) : (
            <div className="mt-6">
              <h2 className="text-xl font-bold mb-4">Available Threads</h2>
              
              {threads.length === 0 ? (
                <div className="bg-gray-50 p-4 rounded text-gray-500 text-center">
                  No threads found in the database.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {threads.map(thread => {
                    const threadStitches = getStitchesForThread(thread.id);
                    const freeTierStitches = getFreeTierStitchesForThread(thread.id);
                    const isFreeTier = isThreadInFreeTier(thread.id);
                    
                    return (
                      <div 
                        key={thread.id} 
                        className={`border rounded-lg p-4 ${
                          isFreeTier 
                            ? 'border-green-300 bg-green-50' 
                            : 'border-gray-300 bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-bold">
                              {thread.id}
                              {isFreeTier && (
                                <span className="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                                  Free Tier
                                </span>
                              )}
                            </h3>
                            <p className="text-gray-600">{thread.title || 'No title'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">Total Stitches: {threadStitches.length}</p>
                            {isFreeTier && (
                              <p className="text-sm font-medium text-green-600">
                                Free Tier Stitches: {freeTierStitches.length}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">Stitches:</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    #
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    ID
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Content
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Questions
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Free Tier
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {threadStitches.slice(0, 10).map((stitch, index) => {
                                  const isInFreeTier = isFreeTier && index < FREE_TIER_STITCH_LIMIT;
                                  
                                  return (
                                    <tr key={stitch.id}>
                                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                                        {index + 1}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                                        {stitch.id}
                                      </td>
                                      <td className="px-3 py-2 text-sm">
                                        <div className="truncate max-w-xs">
                                          {stitch.content || '[No content]'}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-sm text-center">
                                        {stitch.questions?.length || 0}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded-full text-xs ${
                                          isInFreeTier 
                                            ? 'bg-green-500 text-white' 
                                            : 'bg-gray-200 text-gray-600'
                                        }`}>
                                          {isInFreeTier ? 'Yes' : 'No'}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                                
                                {threadStitches.length > 10 && (
                                  <tr>
                                    <td colSpan={5} className="px-3 py-2 text-center text-gray-500 text-sm">
                                      + {threadStitches.length - 10} more stitches not shown
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}