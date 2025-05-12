/**
 * Test Server Sync Page
 * 
 * This page tests the Zustand store's ability to sync state to and from the server.
 */

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useZenjinStore } from '../lib/store/zenjinStore';

export default function TestServerSyncPage() {
  // Track sync operations and results
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadResult, setLoadResult] = useState<any>(null);
  
  // Get state from Zustand store
  const userInfo = useZenjinStore(state => state.userInformation);
  const isInitialized = useZenjinStore(state => state.isInitialized);
  const initializeState = useZenjinStore(state => state.initializeState);
  const syncToServer = useZenjinStore(state => state.syncToServer);
  const loadFromServer = useZenjinStore(state => state.loadFromServer);
  
  // Initialize Zustand store for testing if needed
  useEffect(() => {
    if (!isInitialized && !userInfo) {
      console.log('Initializing test user in Zustand store');
      
      // Create test user ID with timestamp for uniqueness
      const testUserId = `test-user-${Date.now()}`;
      
      // Initialize store with test data
      initializeState({
        userInformation: {
          userId: testUserId,
          isAnonymous: false, // Set to false to test server sync
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
        learningProgress: {
          userId: testUserId,
          totalTimeSpentLearning: 0,
          evoPoints: 50, // Starting with some points for testing
          evolutionLevel: 1,
          currentBlinkSpeed: 1,
          previousSessionBlinkSpeeds: [],
          completedStitchesCount: 0,
          perfectScoreStitchesCount: 0
        }
      });
    }
  }, [isInitialized, userInfo, initializeState]);
  
  // Handle syncing to server
  const handleSyncToServer = async () => {
    if (!userInfo) {
      alert('No user information available. Initialize the store first.');
      return;
    }
    
    setIsSyncing(true);
    setSyncResult(null);
    
    try {
      // Add some points to make the change visible
      useZenjinStore.getState().incrementPoints(10);
      
      // Sync to server
      const result = await syncToServer();
      
      // Log and display result
      console.log('Sync to server result:', result);
      setSyncResult({
        success: result,
        timestamp: new Date().toISOString(),
        message: result ? 'Successfully synced to server' : 'Failed to sync to server'
      });
    } catch (error) {
      console.error('Error syncing to server:', error);
      setSyncResult({
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsSyncing(false);
    }
  };
  
  // Handle loading from server
  const handleLoadFromServer = async () => {
    if (!userInfo) {
      alert('No user information available. Initialize the store first.');
      return;
    }
    
    setIsLoading(true);
    setLoadResult(null);
    
    try {
      // Load from server
      const result = await loadFromServer(userInfo.userId);
      
      // Log and display result
      console.log('Load from server result:', result);
      setLoadResult({
        success: result,
        timestamp: new Date().toISOString(),
        message: result ? 'Successfully loaded from server' : 'Failed to load from server'
      });
    } catch (error) {
      console.error('Error loading from server:', error);
      setLoadResult({
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format JSON for display
  const formatJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return 'Error formatting JSON';
    }
  };
  
  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch (e) {
      return timestamp;
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-800 to-indigo-900 text-white">
      <Head>
        <title>Server Sync Test - Zenjin Maths</title>
        <meta name="description" content="Test server sync for Zustand store" />
      </Head>
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2 text-center">Server Sync Test</h1>
        <p className="text-white/80 text-center mb-8">
          Test synchronizing Zustand store state with the server
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* State Display */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Current Store State</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">User Information</h3>
                <pre className="bg-gray-900/50 p-3 rounded-md text-xs overflow-auto max-h-32">
                  {formatJson(userInfo)}
                </pre>
              </div>
              
              <div>
                <h3 className="font-medium mb-1">Learning Progress</h3>
                <pre className="bg-gray-900/50 p-3 rounded-md text-xs overflow-auto max-h-32">
                  {formatJson(useZenjinStore.getState().learningProgress)}
                </pre>
              </div>
              
              <div>
                <h3 className="font-medium mb-1">Active Tube</h3>
                <div className="bg-gray-900/50 p-3 rounded-md">
                  <p className="font-mono">
                    {useZenjinStore.getState().tubeState?.activeTube || 'Not set'}
                  </p>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-1">Last Updated</h3>
                <div className="bg-gray-900/50 p-3 rounded-md">
                  <p className="font-mono">
                    {formatTimestamp(useZenjinStore.getState().lastUpdated)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => useZenjinStore.getState().incrementPoints(10)}
                className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded-md text-sm"
              >
                Add 10 Points
              </button>
              <button
                onClick={() => {
                  const current = useZenjinStore.getState().tubeState?.activeTube || 1;
                  const next = current < 3 ? current + 1 : 1;
                  useZenjinStore.getState().setActiveTube(next as 1 | 2 | 3);
                }}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm"
              >
                Cycle Tube
              </button>
            </div>
          </div>
          
          {/* Server Sync Controls */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Server Sync Controls</h2>
            
            <div className="space-y-6">
              {/* Sync to Server */}
              <div>
                <h3 className="font-medium mb-2">Sync to Server</h3>
                <p className="text-sm text-white/70 mb-3">
                  Synchronize the current store state to the server.
                </p>
                
                <button
                  onClick={handleSyncToServer}
                  disabled={isSyncing}
                  className={`w-full px-4 py-2 ${
                    isSyncing
                      ? 'bg-blue-800/50 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500'
                  } rounded-md transition-colors`}
                >
                  {isSyncing ? 'Syncing...' : 'Sync to Server'}
                </button>
                
                {syncResult && (
                  <div className={`mt-3 p-3 rounded-md ${
                    syncResult.success ? 'bg-green-900/30 border border-green-500/30' : 'bg-red-900/30 border border-red-500/30'
                  }`}>
                    <p className="font-medium mb-1">{syncResult.message || 'Sync completed'}</p>
                    <p className="text-xs text-white/70">
                      {syncResult.timestamp ? formatTimestamp(syncResult.timestamp) : ''}
                      {syncResult.error ? ` - Error: ${syncResult.error}` : ''}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Load from Server */}
              <div>
                <h3 className="font-medium mb-2">Load from Server</h3>
                <p className="text-sm text-white/70 mb-3">
                  Load the store state from the server.
                </p>
                
                <button
                  onClick={handleLoadFromServer}
                  disabled={isLoading}
                  className={`w-full px-4 py-2 ${
                    isLoading
                      ? 'bg-purple-800/50 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-500'
                  } rounded-md transition-colors`}
                >
                  {isLoading ? 'Loading...' : 'Load from Server'}
                </button>
                
                {loadResult && (
                  <div className={`mt-3 p-3 rounded-md ${
                    loadResult.success ? 'bg-green-900/30 border border-green-500/30' : 'bg-red-900/30 border border-red-500/30'
                  }`}>
                    <p className="font-medium mb-1">{loadResult.message || 'Load completed'}</p>
                    <p className="text-xs text-white/70">
                      {loadResult.timestamp ? formatTimestamp(loadResult.timestamp) : ''}
                      {loadResult.error ? ` - Error: ${loadResult.error}` : ''}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Reset Controls */}
              <div className="pt-4 border-t border-white/10">
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to reset the store? This will clear all state.')) {
                      useZenjinStore.getState().resetStore();
                      setSyncResult(null);
                      setLoadResult(null);
                    }
                  }}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 rounded-md transition-colors"
                >
                  Reset Store
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}