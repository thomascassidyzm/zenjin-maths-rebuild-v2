import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import useZenjinStore from '../lib/store/zenjinStore';
import { updateZustandFromLegacyState, getLegacyState } from '../lib/store/legacyAdapter';

/**
 * Zustand Store Test Page
 * 
 * A comprehensive test page for validating the new state management system
 * with real-world usage patterns.
 */
export default function ZustandStoreTest() {
  // Use Zustand store for state
  const userInfo = useZenjinStore(state => state.userInformation);
  const tubeState = useZenjinStore(state => state.tubeState);
  const learningProgress = useZenjinStore(state => state.learningProgress);
  const lastUpdated = useZenjinStore(state => state.lastUpdated);
  
  // Get actions directly
  const {
    setUserInformation,
    setTubeState,
    setActiveTube,
    updateEvoPoints,
    startNewSession,
    endCurrentSession,
    saveToLocalStorage,
    loadFromLocalStorage,
    syncToServer
  } = useZenjinStore();
  
  // Local state for test results
  const [testResults, setTestResults] = useState<{
    name: string;
    success: boolean;
    message: string;
  }[]>([]);
  
  // Initialize on mount
  useEffect(() => {
    // Start with a clean slate for testing
    useZenjinStore.getState().resetStore();
    
    // Create a test user
    const testUserId = `test-user-${Date.now()}`;
    console.log(`Testing with user ID: ${testUserId}`);
    
    // Initialize with test user
    setUserInformation({
      userId: testUserId,
      isAnonymous: true,
      displayName: 'Test User',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    });
    
    // Initialize with test tube state
    setTubeState({
      activeTube: 1,
      tubes: {
        1: {
          stitchOrder: ['stitch-T1-001-01', 'stitch-T1-001-02', 'stitch-T1-001-03'],
          currentStitchId: 'stitch-T1-001-01'
        },
        2: {
          stitchOrder: ['stitch-T2-001-01', 'stitch-T2-001-02', 'stitch-T2-001-03'],
          currentStitchId: 'stitch-T2-001-01'
        },
        3: {
          stitchOrder: ['stitch-T3-001-01', 'stitch-T3-001-02', 'stitch-T3-001-03'],
          currentStitchId: 'stitch-T3-001-01'
        }
      }
    });
    
    // Log the initial setup
    console.log('Initial store setup complete');
  }, []);
  
  // Save result of a test
  const logTestResult = (name: string, success: boolean, message: string) => {
    console.log(`Test "${name}": ${success ? 'PASSED' : 'FAILED'} - ${message}`);
    setTestResults(prev => [...prev, { name, success, message }]);
  };
  
  // Test 1: State update
  const testStateUpdate = () => {
    try {
      // Change active tube
      setActiveTube(2);
      
      // Verify change
      const updatedTube = useZenjinStore.getState().tubeState?.activeTube;
      const success = updatedTube === 2;
      
      logTestResult('State Update', success, 
        success ? 'Successfully changed active tube to 2' : `Failed to change tube, got ${updatedTube}`
      );
    } catch (error) {
      logTestResult('State Update', false, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Test 2: Local storage persistence
  const testLocalStoragePersistence = async () => {
    try {
      // Update state
      updateEvoPoints(100, 'set');
      
      // Save to localStorage
      const saveResult = saveToLocalStorage();
      
      // Reset store
      useZenjinStore.getState().resetStore();
      
      // Set user ID again to match saved state
      setUserInformation({
        userId: userInfo?.userId || 'unknown',
        isAnonymous: true,
        displayName: 'Test User',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      });
      
      // Load from localStorage
      const loadResult = loadFromLocalStorage();
      
      // Verify load
      const loadedPoints = useZenjinStore.getState().learningProgress?.evoPoints;
      const success = loadResult && loadedPoints === 100;
      
      logTestResult('localStorage Persistence', success, 
        success ? 'Successfully saved and loaded state from localStorage' : 
                 `Failed to persist state. Save: ${saveResult}, Load: ${loadResult}, Points: ${loadedPoints}`
      );
    } catch (error) {
      logTestResult('localStorage Persistence', false, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Test 3: Legacy state compatibility
  const testLegacyCompatibility = () => {
    try {
      // Reset store
      useZenjinStore.getState().resetStore();
      
      // Create mock legacy state
      const mockLegacyState = {
        userId: 'legacy-user-123',
        tubes: {
          1: {
            threadId: 'thread-T1-001',
            currentStitchId: 'stitch-T1-001-01',
            stitches: [
              { id: 'stitch-T1-001-01', position: 0 },
              { id: 'stitch-T1-001-02', position: 1 }
            ]
          },
          2: {
            threadId: 'thread-T2-001',
            currentStitchId: 'stitch-T2-001-01',
            stitches: [
              { id: 'stitch-T2-001-01', position: 0 },
              { id: 'stitch-T2-001-02', position: 1 }
            ]
          },
          3: {
            threadId: 'thread-T3-001',
            currentStitchId: 'stitch-T3-001-01',
            stitches: [
              { id: 'stitch-T3-001-01', position: 0 },
              { id: 'stitch-T3-001-02', position: 1 }
            ]
          }
        },
        activeTube: 1,
        points: { session: 50, lifetime: 500 },
        lastUpdated: new Date().toISOString()
      };
      
      // Update Zustand from legacy state
      const updateResult = updateZustandFromLegacyState(mockLegacyState);
      
      // Verify update
      const updatedUserId = useZenjinStore.getState().userInformation?.userId;
      const updatedTube = useZenjinStore.getState().tubeState?.activeTube;
      
      const success = updateResult && 
                     updatedUserId === 'legacy-user-123' && 
                     updatedTube === 1;
      
      logTestResult('Legacy Compatibility', success, 
        success ? 'Successfully converted legacy state to Zustand format' : 
                 `Failed to convert legacy state. Update: ${updateResult}, UserId: ${updatedUserId}, Tube: ${updatedTube}`
      );
      
      // Test conversion back to legacy format
      const legacyState = getLegacyState();
      const legacySuccess = legacyState && 
                           legacyState.userId === 'legacy-user-123' && 
                           legacyState.activeTube === 1;
      
      logTestResult('Legacy Format Conversion', legacySuccess, 
        legacySuccess ? 'Successfully converted Zustand state back to legacy format' : 
                       'Failed to convert back to legacy format'
      );
    } catch (error) {
      logTestResult('Legacy Compatibility', false, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Test 4: Session management
  const testSessionManagement = () => {
    try {
      // Reset store
      useZenjinStore.getState().resetStore();
      
      // Set user ID
      setUserInformation({
        userId: 'session-test-user',
        isAnonymous: true,
        displayName: 'Session Test User',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      });
      
      // Start new session
      startNewSession('session-test-user');
      
      // Get session data
      const sessionData = useZenjinStore.getState().sessionData;
      const hasSession = sessionData && sessionData.sessionId && sessionData.startTime;
      
      // End session
      endCurrentSession();
      
      // Get ended session
      const endedSession = useZenjinStore.getState().sessionData;
      const hasEndTime = endedSession && endedSession.endTime;
      
      const success = hasSession && hasEndTime;
      
      logTestResult('Session Management', success, 
        success ? 'Successfully started and ended a session' : 
                 `Failed to manage session. HasSession: ${hasSession}, HasEndTime: ${hasEndTime}`
      );
    } catch (error) {
      logTestResult('Session Management', false, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Test 5: Server synchronization (simulate)
  const testServerSync = async () => {
    try {
      // Since we can't actually test the server sync without a server,
      // we'll create a mock function to simulate it
      const originalFetch = window.fetch;
      
      // Replace fetch with a mock that returns success
      window.fetch = async (url, options) => {
        if (url === '/api/state/sync') {
          console.log('Mock server sync called with:', options?.body);
          return {
            ok: true,
            json: async () => ({ success: true })
          } as Response;
        }
        
        // Pass through other requests
        return originalFetch(url, options);
      };
      
      // Reset store
      useZenjinStore.getState().resetStore();
      
      // Set user ID
      setUserInformation({
        userId: 'sync-test-user',
        isAnonymous: true,
        displayName: 'Sync Test User',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      });
      
      // Try to sync
      const syncResult = await syncToServer();
      
      // Restore original fetch
      window.fetch = originalFetch;
      
      logTestResult('Server Sync (Simulated)', syncResult, 
        syncResult ? 'Successfully simulated server sync' : 'Failed to simulate server sync'
      );
    } catch (error) {
      logTestResult('Server Sync (Simulated)', false, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Run all tests
  const runAllTests = async () => {
    // Clear previous results
    setTestResults([]);
    
    // Run tests
    testStateUpdate();
    await testLocalStoragePersistence();
    testLegacyCompatibility();
    testSessionManagement();
    await testServerSync();
  };
  
  // Format JSON for display
  const formatJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return 'Error formatting JSON';
    }
  };
  
  return (
    <div className="container">
      <Head>
        <title>Zustand Store Test - Zenjin Maths</title>
        <meta name="description" content="Test page for Zustand state management" />
      </Head>
      
      <main>
        <h1>Zustand Store Test Suite</h1>
        
        <div className="test-controls">
          <button className="test-button" onClick={runAllTests}>
            Run All Tests
          </button>
          
          <div className="individual-tests">
            <button onClick={testStateUpdate}>Test State Update</button>
            <button onClick={testLocalStoragePersistence}>Test localStorage</button>
            <button onClick={testLegacyCompatibility}>Test Legacy Compatibility</button>
            <button onClick={testSessionManagement}>Test Session Management</button>
            <button onClick={testServerSync}>Test Server Sync (Mock)</button>
          </div>
        </div>
        
        <div className="test-results">
          <h2>Test Results</h2>
          {testResults.length === 0 ? (
            <p className="no-results">No tests run yet. Click "Run All Tests" to begin.</p>
          ) : (
            <ul>
              {testResults.map((result, index) => (
                <li key={index} className={`test-result ${result.success ? 'success' : 'failure'}`}>
                  <strong>{result.name}:</strong> {result.success ? 'PASSED' : 'FAILED'} - {result.message}
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="current-state">
          <h2>Current State</h2>
          
          <div className="state-display">
            <div className="state-section">
              <h3>User Information</h3>
              <pre>{formatJson(userInfo)}</pre>
            </div>
            
            <div className="state-section">
              <h3>Tube State</h3>
              <pre>{formatJson(tubeState)}</pre>
            </div>
            
            <div className="state-section">
              <h3>Learning Progress</h3>
              <pre>{formatJson(learningProgress)}</pre>
            </div>
            
            <div className="state-section">
              <h3>Last Updated</h3>
              <div className="timestamp">{lastUpdated}</div>
            </div>
          </div>
        </div>
      </main>
      
      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        
        main {
          background-color: #f8f9fa;
          border-radius: 10px;
          padding: 30px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }
        
        h1, h2, h3 {
          color: #333;
          margin-top: 0;
        }
        
        h1 {
          font-size: 28px;
          margin-bottom: 20px;
          text-align: center;
          color: #2d3748;
        }
        
        h2 {
          font-size: 22px;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e2e8f0;
          color: #4a5568;
        }
        
        h3 {
          font-size: 18px;
          margin-bottom: 12px;
          color: #4a5568;
        }
        
        .test-controls {
          margin-bottom: 30px;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        
        .test-button {
          padding: 12px 24px;
          font-size: 16px;
          font-weight: bold;
          background-color: #4299e1;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        .test-button:hover {
          background-color: #3182ce;
        }
        
        .individual-tests {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .individual-tests button {
          padding: 8px 16px;
          font-size: 14px;
          background-color: #e2e8f0;
          color: #4a5568;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        .individual-tests button:hover {
          background-color: #cbd5e0;
        }
        
        .test-results {
          margin-bottom: 30px;
        }
        
        .no-results {
          color: #718096;
          font-style: italic;
        }
        
        .test-result {
          padding: 8px 12px;
          margin-bottom: 8px;
          border-radius: 4px;
          line-height: 1.5;
        }
        
        .test-result.success {
          background-color: #c6f6d5;
          color: #2f855a;
        }
        
        .test-result.failure {
          background-color: #fed7d7;
          color: #c53030;
        }
        
        .current-state {
          background-color: #fff;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }
        
        .state-display {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }
        
        .state-section {
          background-color: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 15px;
        }
        
        pre {
          background-color: #2d3748;
          color: #e2e8f0;
          padding: 12px;
          border-radius: 5px;
          overflow: auto;
          font-size: 12px;
          margin: 0;
          max-height: 200px;
        }
        
        .timestamp {
          font-family: monospace;
          font-size: 14px;
          color: #4a5568;
          margin-top: 5px;
        }
      `}</style>
    </div>
  );
}