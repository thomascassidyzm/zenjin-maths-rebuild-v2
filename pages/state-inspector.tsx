import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';

/**
 * State Inspector
 * 
 * A diagnostic tool to view the server-side state without having to logout and back in
 * Helps verify state persistence is working correctly
 */
export default function StateInspector() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  
  const [serverState, setServerState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedEndpoint, setSelectedEndpoint] = useState('user-state');

  // Fetch state from server
  useEffect(() => {
    const fetchState = async () => {
      setIsLoading(true);
      setError(null);
      
      if (!isAuthenticated) {
        setError('You must be authenticated to view server state');
        setIsLoading(false);
        return;
      }
      
      try {
        // Get auth headers from localStorage - this ensures authentication is passed
        let authHeader = {};
        if (typeof window !== 'undefined') {
          // Try to find the Supabase token with flexible key pattern matching
          const supabaseTokenKey = Object.keys(localStorage).find(key => 
            key.startsWith('sb-') && key.includes('-auth-token')
          );
          
          if (supabaseTokenKey) {
            const supabaseToken = localStorage.getItem(supabaseTokenKey);
            if (supabaseToken) {
              try {
                const parsedToken = JSON.parse(supabaseToken);
                if (parsedToken?.access_token) {
                  authHeader = {
                    'Authorization': `Bearer ${parsedToken.access_token}`
                  };
                  console.log('Found and using auth token');
                }
              } catch (e) {
                console.error('Failed to parse supabase token:', e);
              }
            }
          } else {
            console.warn('Could not find supabase token in localStorage');
          }
        }
        
        // Construct URL with proper query parameters
        let url = `/api/${selectedEndpoint}`;
        const params = new URLSearchParams();
        
        // IMPORTANT: Always add userId for all endpoints during troubleshooting
        if (user?.id) {
          params.append('userId', user.id);
          console.log(`Adding user ID to request: ${user.id}`);
        } else {
          console.log('No user ID available to add to request');
        }
        
        // Add debug flag to get more verbose output from API
        params.append('debug', 'true');
        
        // Add cache-busting timestamp
        params.append('t', Date.now().toString());
        
        // Only add ? if we have parameters
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        
        console.log(`Fetching state from: ${url}`);
        
        // Fetch from the selected endpoint
        const response = await fetch(url, {
          headers: {
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache',
            ...authHeader
          },
          credentials: 'include'
        });
        
        // Handle common error codes specially
        if (!response.ok) {
          const statusCode = response.status;
          
          try {
            // Try to get error details from response
            const errorData = await response.json();
            throw new Error(`Failed to fetch state: ${statusCode} - ${errorData.error || 'Unknown error'}`);
          } catch (jsonError) {
            // If we can't parse JSON, use generic error
            throw new Error(`Failed to fetch state: ${statusCode}`);
          }
        }
        
        const data = await response.json();
        
        if (!data.success && data.error) {
          throw new Error(`API error: ${data.error}`);
        }
        
        setServerState(data);
      } catch (err: any) {
        console.error('Error fetching state:', err);
        setError(err.message || 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchState();
  }, [isAuthenticated, refreshKey, selectedEndpoint, user?.id]);
  
  // Pretty-print JSON with syntax highlighting
  const PrettyJson = ({ data }: { data: any }) => {
    if (!data) return null;
    
    // Format the JSON string with indentation
    const formattedJson = JSON.stringify(data, null, 2);
    
    return (
      <pre className="bg-gray-800 p-4 rounded-lg overflow-auto text-xs text-green-300 max-h-[70vh]">
        {formattedJson}
      </pre>
    );
  };
  
  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-t-teal-500 border-teal-200 rounded-full"></div>
      </div>
    );
  }
  
  // Show unauthorized message
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-xl text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Authentication Required</h1>
          <p className="text-white/80 mb-6">You need to be signed in to use the State Inspector.</p>
          <Link href="/signin?redirect=/state-inspector" className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen dashboard-bg text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">State Inspector</h1>
          <div className="flex space-x-4">
            <button
              onClick={() => setRefreshKey(prev => prev + 1)}
              className="bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-lg transition-colors flex items-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="inline-block h-4 w-4 border-2 border-t-blue-200 border-blue-500 rounded-full animate-spin mr-2"></span>
              ) : (
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Refresh
            </button>
            <Link href="/dashboard" className="bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg transition-colors">
              Back to Dashboard
            </Link>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="md:w-1/3">
              <h2 className="font-bold text-xl mb-2">Select API Endpoint</h2>
              <div className="bg-black/20 rounded-lg p-4 flex flex-col gap-2">
                <button
                  className={`text-left p-2 rounded-md transition-colors ${selectedEndpoint === 'user-state' ? 'bg-teal-700 text-white' : 'hover:bg-gray-700'}`}
                  onClick={() => setSelectedEndpoint('user-state')}
                >
                  user-state (Complete State)
                </button>
                <button
                  className={`text-left p-2 rounded-md transition-colors ${selectedEndpoint === 'user-stitches' ? 'bg-teal-700 text-white' : 'hover:bg-gray-700'}`}
                  onClick={() => setSelectedEndpoint('user-stitches')}
                >
                  user-stitches (Active Stitches)
                </button>
                <button
                  className={`text-left p-2 rounded-md transition-colors ${selectedEndpoint === 'check-stitch-progress' ? 'bg-teal-700 text-white' : 'hover:bg-gray-700'}`}
                  onClick={() => setSelectedEndpoint('check-stitch-progress')}
                >
                  check-stitch-progress (Stitch Details)
                </button>
                <button
                  className={`text-left p-2 rounded-md transition-colors ${selectedEndpoint === 'user-progress' ? 'bg-teal-700 text-white' : 'hover:bg-gray-700'}`}
                  onClick={() => setSelectedEndpoint('user-progress')}
                >
                  user-progress (Points & Stats)
                </button>
              </div>
              
              <div className="mt-4">
                <h2 className="font-bold text-xl mb-2">Diagnostics</h2>
                <div className="bg-black/20 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-300 mb-1">Reset Tools</h3>
                  <Link href="/test-utils" className="block mb-2 p-2 bg-red-800/30 hover:bg-red-700/40 border border-red-600/30 rounded-md transition-colors text-sm text-center">
                    Go to Test Utils Page
                  </Link>
                  <Link href="/minimal-player?dev=true" className="block mb-2 p-2 bg-blue-800/30 hover:bg-blue-700/40 border border-blue-600/30 rounded-md transition-colors text-sm text-center">
                    Open Dev Player
                  </Link>
                  
                  <h3 className="font-semibold text-yellow-300 mt-3 mb-1">Database Utilities</h3>
                  <button 
                    onClick={async () => {
                      try {
                        setIsLoading(true);
                        const response = await fetch('/api/auth-test', {
                          method: 'GET',
                          credentials: 'include'
                        });
                        
                        const result = await response.json();
                        alert(JSON.stringify(result, null, 2));
                      } catch (e) {
                        console.error('Error testing auth:', e);
                        alert('Auth test error: ' + e);
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    className="block w-full mb-2 p-2 bg-green-800/30 hover:bg-green-700/40 border border-green-600/30 rounded-md transition-colors text-sm text-center"
                  >
                    Test Authentication
                  </button>
                  
                  <button 
                    onClick={async () => {
                      try {
                        if (confirm('Are you sure you want to create/repair the user_state table?')) {
                          setIsLoading(true);
                          const response = await fetch('/api/create-user-state-table', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include'
                          });
                          
                          const result = await response.json();
                          if (result.success) {
                            alert('Success: ' + result.message);
                            setRefreshKey(prev => prev + 1);
                          } else {
                            alert('Error: ' + result.error);
                          }
                        }
                      } catch (e) {
                        console.error('Error creating table:', e);
                        alert('Unexpected error: ' + e);
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    className="block w-full p-2 bg-yellow-800/30 hover:bg-yellow-700/40 border border-yellow-600/30 rounded-md transition-colors text-sm text-center"
                  >
                    Create/Repair Database Tables
                  </button>
                </div>
              </div>
            </div>
            
            <div className="md:w-2/3">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-bold text-xl">Server State</h2>
                <div className="text-sm text-gray-300">User: {user?.email}</div>
              </div>
              
              {error ? (
                <div className="bg-red-500/20 border border-red-300/30 p-4 rounded-lg text-red-100">
                  {error}
                </div>
              ) : isLoading ? (
                <div className="bg-gray-800 rounded-lg p-6 text-center">
                  <div className="animate-spin h-8 w-8 border-4 border-t-teal-500 border-teal-200 rounded-full mx-auto mb-3"></div>
                  <p className="text-gray-300">Loading server state...</p>
                </div>
              ) : selectedEndpoint === 'user-state' && serverState?.state?.tubes ? (
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Active State Overview</h3>
                    <div className="bg-black/20 rounded-lg p-4 text-white/90">
                      <p>
                        <span className="text-white/70">Active Tube:</span> {serverState.state.activeTubeNumber}
                      </p>
                      <p>
                        <span className="text-white/70">Cycle Count:</span> {serverState.state.cycleCount || 0}
                      </p>
                      <p>
                        <span className="text-white/70">Last Updated:</span> {new Date(serverState.state.last_updated).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Triple-Helix Tube Visualization</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3].map(tubeNum => {
                        const tube = serverState.state.tubes[tubeNum];
                        const currentStitchId = tube?.currentStitchId;
                        const stitches = tube?.stitches || [];
                        const sortedStitches = [...stitches].sort((a, b) => a.position - b.position);
                        
                        return (
                          <div key={tubeNum} className="bg-black/20 rounded-lg p-3">
                            <div className={`text-center py-1 mb-2 rounded ${
                              serverState.state.activeTubeNumber === tubeNum 
                                ? 'bg-teal-800 font-bold' 
                                : 'bg-gray-800'
                            }`}>
                              Tube {tubeNum} ({sortedStitches.length} stitches)
                            </div>
                            <div className="max-h-64 overflow-y-auto pr-1">
                              {sortedStitches.length > 0 ? (
                                sortedStitches.map((stitch, idx) => (
                                  <div 
                                    key={stitch.id} 
                                    className={`mb-1 p-1 text-xs rounded ${
                                      stitch.id === currentStitchId
                                        ? 'bg-teal-900 border border-teal-500' 
                                        : stitch.position === 0
                                          ? 'bg-indigo-900/50 border border-indigo-700'
                                          : 'bg-gray-800/50 border border-gray-700'
                                    }`}
                                  >
                                    <div className="flex justify-between">
                                      <span>Pos: <span className="text-amber-300">{stitch.position}</span></span>
                                      <span>Skip: {stitch.skipNumber}</span>
                                    </div>
                                    <div className="truncate text-gray-400">{stitch.id.split('-').pop()}</div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-center text-white/50 text-sm">No stitches</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Raw JSON Data</h3>
                    <PrettyJson data={serverState} />
                  </div>
                </div>
              ) : (
                <PrettyJson data={serverState} />
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6">
          <h2 className="font-bold text-xl mb-4">Testing State Persistence</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-black/20 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">Instructions</h3>
              <ol className="list-decimal pl-5 space-y-2 text-white/90">
                <li>Make changes in the player (complete stitches, cycle tubes)</li>
                <li>Refresh this page to see updated server state</li>
                <li>Compare current session state with server state</li>
                <li>Try opening a new browser window to verify same state is loaded</li>
              </ol>
            </div>
            
            <div className="bg-black/20 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">Local Storage</h3>
              <div className="mb-2">
                <button 
                  onClick={() => {
                    try {
                      // Only clear triple_helix_state cache, not user auth data
                      if (typeof window !== 'undefined') {
                        // Find and clear any triple_helix_state related items
                        Object.keys(localStorage).forEach(key => {
                          if (key.startsWith('triple_helix_state_') || 
                              key === 'zenjin_anonymous_state' || 
                              key === 'anonymous_initial_stitch') {
                            console.log('Clearing cached state:', key);
                            localStorage.removeItem(key);
                          }
                        });
                        setRefreshKey(prev => prev + 1);
                        alert('Local state cache cleared!');
                      }
                    } catch (e) {
                      console.warn('Error clearing local cache:', e);
                      alert('Error clearing cache: ' + e);
                    }
                  }}
                  className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors mb-3"
                >
                  Clear Local State Cache
                </button>
                <div className="text-xs text-white/70">
                  This will force the player to load fresh state from the server on next visit.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}