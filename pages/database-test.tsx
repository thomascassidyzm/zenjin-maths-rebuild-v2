import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { createClient } from '../lib/supabase/client';

// Create a client-side Supabase client
const supabase = createClient();

export default function DatabaseTest() {
  const router = useRouter();
  const { isAuthenticated, user, loading } = useAuth();
  
  const [progressData, setProgressData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [newOrderNumber, setNewOrderNumber] = useState<number>(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Fetch progress data on mount
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      router.push('/login');
      return;
    }
    
    if (isAuthenticated) {
      fetchProgressData();
    }
  }, [isAuthenticated, loading, refreshTrigger]);
  
  // Fetch user stitch progress data
  const fetchProgressData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Fetching user progress data...');
      
      // Fetch user progress data
      const { data, error } = await supabase
        .from('user_stitch_progress')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });  // Use updated_at instead of created_at
      
      if (error) {
        throw new Error(`Error fetching progress data: ${error.message}`);
      }
      
      console.log(`Fetched ${data?.length || 0} progress entries`);
      setProgressData(data || []);
      
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update a specific entry
  const updateEntry = async () => {
    if (!selectedEntry) {
      setUpdateResult('No entry selected');
      return;
    }
    
    try {
      setUpdateResult('Updating...');
      
      const { error } = await supabase
        .from('user_stitch_progress')
        .update({
          order_number: newOrderNumber,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', selectedEntry.user_id)
        .eq('thread_id', selectedEntry.thread_id)
        .eq('stitch_id', selectedEntry.stitch_id);
      
      if (error) {
        throw new Error(`Update failed: ${error.message}`);
      }
      
      setUpdateResult(`Successfully updated entry. Order number set to ${newOrderNumber}`);
      
      // Refresh data
      setRefreshTrigger(prev => prev + 1);
      
    } catch (err) {
      console.error('Update error:', err);
      setUpdateResult(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };
  
  // Handle refresh
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return dateString;
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Database Test | Zenjin Admin</title>
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Database Connectivity Test</h1>
            
            <div className="flex space-x-2">
              <button 
                onClick={() => router.push('/admin-dashboard')}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Back to Dashboard
              </button>
              
              <button 
                onClick={handleRefresh}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Refresh Data
              </button>
            </div>
          </div>
          
          <p className="mb-4 text-gray-600">
            This page tests direct database connectivity by showing your user_stitch_progress 
            entries and allowing you to manually update them.
          </p>
          
          {!isAuthenticated && !loading ? (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
              <p>Please log in to view and test database connectivity.</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <p className="ml-4">Loading authentication status...</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  <p>{error}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Progress Entry List */}
                <div className="lg:col-span-2">
                  <h2 className="text-xl font-bold mb-4">Your Progress Entries</h2>
                  
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                      <p className="ml-4">Loading progress data...</p>
                    </div>
                  ) : progressData.length === 0 ? (
                    <div className="bg-gray-50 rounded p-4 text-gray-500">
                      No progress entries found for your account.
                    </div>
                  ) : (
                    <div className="overflow-x-auto shadow border-b border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Thread
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Stitch
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Order
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Skip
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Level
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Updated
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {progressData.map((entry, index) => (
                            <tr 
                              key={index} 
                              className={selectedEntry?.stitch_id === entry.stitch_id ? 'bg-blue-50' : ''}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-mono">{entry.thread_id}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-mono">{entry.stitch_id}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded ${
                                  entry.order_number === 0 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {entry.order_number}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {entry.skip_number}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {entry.distractor_level}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {formatDate(entry.updated_at)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    setSelectedEntry(entry);
                                    setNewOrderNumber(entry.order_number);
                                  }}
                                  className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded"
                                >
                                  Select
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                
                {/* Right: Update Form */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h2 className="text-xl font-bold mb-4">Update Entry</h2>
                  
                  {selectedEntry ? (
                    <div>
                      <div className="mb-4">
                        <div className="bg-blue-50 p-3 rounded border border-blue-100 mb-4">
                          <p className="font-medium">Selected Entry:</p>
                          <p className="mt-1">
                            <span className="font-medium">Thread:</span> {selectedEntry.thread_id}
                          </p>
                          <p>
                            <span className="font-medium">Stitch:</span> {selectedEntry.stitch_id}
                          </p>
                          <p>
                            <span className="font-medium">Current Order:</span> {selectedEntry.order_number}
                          </p>
                        </div>
                        
                        <label className="block text-gray-700 font-medium mb-2">
                          New Order Number:
                        </label>
                        <input
                          type="number"
                          value={newOrderNumber}
                          onChange={(e) => setNewOrderNumber(parseInt(e.target.value) || 0)}
                          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                          min="0"
                        />
                      </div>
                      
                      <button
                        onClick={updateEntry}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded"
                      >
                        Update Order Number
                      </button>
                      
                      <button
                        onClick={() => setSelectedEntry(null)}
                        className="w-full mt-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="bg-gray-100 p-4 rounded text-gray-500 text-center">
                      Select an entry from the table to update it.
                    </div>
                  )}
                  
                  {updateResult && (
                    <div className={`mt-4 p-3 rounded ${
                      updateResult.includes('Successfully') 
                        ? 'bg-green-100 border border-green-200 text-green-800' 
                        : 'bg-red-100 border border-red-200 text-red-800'
                    }`}>
                      {updateResult}
                    </div>
                  )}
                  
                  <div className="mt-6">
                    <h3 className="font-medium mb-2">Direct Database Test</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      This test will help determine if your changes are actually being saved to the database.
                    </p>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={async () => {
                          try {
                            setUpdateResult('Testing database connection...');
                            
                            // Just try a simple select query
                            const { data, error } = await supabase
                              .from('user_stitch_progress')
                              .select('count(*)', { count: 'exact', head: true });
                              
                            if (error) {
                              throw new Error(error.message);
                            }
                            
                            setUpdateResult(`Database connection successful! Count: ${data}`);
                          } catch (err) {
                            setUpdateResult(`Database connection failed: ${err instanceof Error ? err.message : String(err)}`);
                          }
                        }}
                        className="bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded text-sm"
                      >
                        Test Connection
                      </button>
                      
                      <button
                        onClick={handleRefresh}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded text-sm"
                      >
                        Refresh Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}