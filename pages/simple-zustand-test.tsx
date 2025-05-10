import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useAppStore } from '../lib/store/appStore';

/**
 * Simple Zustand Test Page
 * 
 * A simplified test page focused solely on state management without
 * the player component.
 */
export default function SimpleZustandTest() {
  // Use Zustand store for state
  const storeState = useAppStore();
  const [userId, setUserId] = useState<string>('');
  
  // Initialize on mount
  useEffect(() => {
    // Use a consistent test ID between refreshes
    let testId = localStorage.getItem('zustand_test_user_id');

    // If no ID exists, create a new one and store it
    if (!testId) {
      testId = `test-user-${Date.now()}`;
      localStorage.setItem('zustand_test_user_id', testId);
    }

    console.log(`Using test ID: ${testId}`);

    // Set the userId
    setUserId(testId);

    // Initialize the store with this ID
    useAppStore.getState().setUserInformation({
      userId: testId,
      isAnonymous: true,
      displayName: 'Test User'
    });
    
    // Initialize learning progress
    useAppStore.getState().setLearningProgress({
      points: {
        session: 0,
        lifetime: 0
      },
      blinkSpeed: 1.0,
      evolutionLevel: 1,
      totalStitchesCompleted: 0,
      perfectScores: 0
    });
    
    // Set a simplified tube state - just enough to test state persistence
    useAppStore.getState().setTubeState({
      tubes: {
        1: { threadId: 'thread-T1-001', currentStitchId: 'stitch-T1-001-01', position: 0 },
        2: { threadId: 'thread-T2-001', currentStitchId: 'stitch-T2-001-01', position: 0 },
        3: { threadId: 'thread-T3-001', currentStitchId: 'stitch-T3-001-01', position: 0 }
      },
      activeTube: 1,
      activeTubeNumber: 1,
      cycleCount: 0
    });
    
    // Check if we should load existing data for this user
    setTimeout(() => {
      const key = `zenjin_state_${testId}`;
      const existingState = localStorage.getItem(key);

      if (existingState) {
        console.log('Found existing state in localStorage, attempting to load it');
        const success = useAppStore.getState().loadFromLocalStorage();
        console.log(`Loaded existing state: ${success ? 'Success' : 'Failed'}`);
      } else {
        console.log('No existing state found, saving initial state');
        useAppStore.getState().saveToLocalStorage();
        console.log('Initial state saved to localStorage');
      }
    }, 500);
    
  }, []);
  
  // Format JSON for display
  const formatJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return 'Error formatting JSON';
    }
  };
  
  // For testing localStorage directly
  const checkLocalStorage = () => {
    try {
      const key = `zenjin_state_${userId}`;
      const data = localStorage.getItem(key);
      
      if (data) {
        try {
          const parsed = JSON.parse(data);
          return formatJson(parsed);
        } catch (e) {
          return `Error parsing data for key ${key}: ${e.message}`;
        }
      } else {
        return `No data found for key ${key}`;
      }
    } catch (e) {
      return `Error accessing localStorage: ${e.message}`;
    }
  };
  
  return (
    <div className="container">
      <Head>
        <title>Simple Zustand Test - Zenjin Maths</title>
        <meta name="description" content="Simple Zustand state persistence test page" />
      </Head>
      
      <main>
        <h1>Simple Zustand State Persistence Test</h1>
        <p className="user-id">Test User ID: {userId}</p>
        
        <div className="test-content">
          <div className="state-display">
            <h2>Current Zustand Store State</h2>
            
            <div className="state-info">
              <div className="state-box">
                <h3>User Information</h3>
                <pre>{formatJson(storeState.userInformation)}</pre>
              </div>
              
              <div className="state-box">
                <h3>Active Tube</h3>
                <div className="tube-indicator">
                  <span className="tube-number">{storeState.tubeState?.activeTube || 1}</span>
                </div>
              </div>
              
              <div className="state-box">
                <h3>Points</h3>
                <div className="points-display">
                  <div className="point-item">
                    <span className="point-label">Session:</span>
                    <span className="point-value">{storeState.learningProgress?.points?.session || 0}</span>
                  </div>
                  <div className="point-item">
                    <span className="point-label">Lifetime:</span>
                    <span className="point-value">{storeState.learningProgress?.points?.lifetime || 0}</span>
                  </div>
                </div>
              </div>
              
              <div className="state-box">
                <h3>Last Updated</h3>
                <div className="timestamp">
                  {storeState.lastUpdated}
                </div>
              </div>
            </div>
            
            <div className="state-info">
              <div className="state-box full-width">
                <h3>localStorage Content</h3>
                <pre>{checkLocalStorage()}</pre>
              </div>
            </div>
          </div>
          
          <div className="actions">
            <h2>Test Actions</h2>
            
            <div className="button-group">
              <h3>State Manipulation</h3>
              <button 
                onClick={() => {
                  // Add 10 points
                  const points = storeState.learningProgress?.points || { session: 0, lifetime: 0 };
                  const newSession = (points.session || 0) + 10;
                  const newLifetime = (points.lifetime || 0) + 10;
                  
                  useAppStore.getState().updatePoints(newSession, newLifetime);
                  console.log(`Added 10 points - New totals: Session=${newSession}, Lifetime=${newLifetime}`);
                }}
                className="btn btn-success"
              >
                Add 10 Points
              </button>
              
              <button 
                onClick={() => {
                  // Cycle tube
                  const currentTube = storeState.tubeState?.activeTube || 1;
                  const nextTube = currentTube >= 3 ? 1 : currentTube + 1;
                  
                  useAppStore.getState().setActiveTube(nextTube);
                  console.log(`Cycled tube from ${currentTube} to ${nextTube}`);
                }}
                className="btn btn-info"
              >
                Cycle Tube
              </button>
            </div>
            
            <div className="button-group">
              <h3>Storage Operations</h3>
              <button 
                onClick={() => {
                  // Save directly to localStorage
                  const result = useAppStore.getState().saveToLocalStorage();
                  console.log(`Save to localStorage: ${result ? 'Success' : 'Failed'}`);
                }}
                className="btn btn-primary"
              >
                Save to localStorage
              </button>
              
              <button 
                onClick={() => {
                  // Load from localStorage
                  const result = useAppStore.getState().loadFromLocalStorage();
                  console.log(`Load from localStorage: ${result ? 'Success' : 'Failed'}`);
                }}
                className="btn btn-secondary"
              >
                Load from localStorage
              </button>
              
              <button 
                onClick={() => {
                  // Attempt server sync
                  useAppStore.getState().syncToServer()
                    .then(success => {
                      console.log(`Server sync: ${success ? 'Success' : 'Failed'}`);
                    })
                    .catch(error => {
                      console.error('Error during server sync:', error);
                    });
                }}
                className="btn btn-warning"
              >
                Sync to Server
              </button>
            </div>
            
            <div className="button-group">
              <h3>Page Operations</h3>
              <button 
                onClick={() => {
                  window.location.reload();
                }}
                className="btn btn-danger"
              >
                Refresh Page
              </button>
              
              <button 
                onClick={() => {
                  localStorage.clear();
                  console.log('All localStorage data cleared');
                  setTimeout(() => {
                    window.location.reload();
                  }, 100);
                }}
                className="btn btn-dark"
              >
                Clear localStorage & Refresh
              </button>
            </div>
          </div>
        </div>
      </main>
      
      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        
        main {
          background-color: #1a202c;
          border-radius: 10px;
          padding: 30px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        
        h1, h2, h3 {
          color: #fff;
          margin-top: 0;
        }
        
        h1 {
          font-size: 28px;
          margin-bottom: 20px;
          text-align: center;
        }
        
        h2 {
          font-size: 22px;
          margin-bottom: 15px;
          border-bottom: 1px solid #4a5568;
          padding-bottom: 10px;
        }
        
        h3 {
          font-size: 18px;
          margin-bottom: 12px;
          color: #e2e8f0;
        }
        
        .user-id {
          text-align: center;
          font-size: 16px;
          color: #a0aec0;
          margin-bottom: 30px;
        }
        
        .test-content {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }
        
        .state-display {
          background-color: #2d3748;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }
        
        .state-info {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          margin-bottom: 20px;
        }
        
        .state-box {
          background-color: #1a202c;
          border: 1px solid #4a5568;
          border-radius: 6px;
          padding: 15px;
          flex: 1;
          min-width: 200px;
        }
        
        .full-width {
          flex-basis: 100%;
        }
        
        .tube-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 10px;
        }
        
        .tube-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 60px;
          background-color: #3182ce;
          color: white;
          font-size: 24px;
          font-weight: bold;
          border-radius: 50%;
        }
        
        .points-display {
          margin-top: 10px;
        }
        
        .point-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 16px;
        }
        
        .point-label {
          color: #a0aec0;
        }
        
        .point-value {
          font-weight: bold;
          color: #38a169;
        }
        
        .timestamp {
          font-family: monospace;
          font-size: 14px;
          color: #a0aec0;
          margin-top: 10px;
        }
        
        pre {
          background-color: #1a202c;
          border: 1px solid #4a5568;
          padding: 12px;
          border-radius: 5px;
          overflow: auto;
          max-height: 200px;
          font-size: 12px;
          color: #e2e8f0;
          margin: 0;
        }
        
        .actions {
          background-color: #2d3748;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }
        
        .button-group {
          margin-bottom: 20px;
        }
        
        .button-group h3 {
          margin-bottom: 10px;
          color: #a0aec0;
        }
        
        button {
          padding: 12px 20px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
          margin-right: 10px;
          margin-bottom: 10px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        }
        
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        .btn-primary {
          background-color: #3182ce;
          color: white;
        }
        
        .btn-success {
          background-color: #38a169;
          color: white;
        }
        
        .btn-info {
          background-color: #319795;
          color: white;
        }
        
        .btn-secondary {
          background-color: #718096;
          color: white;
        }
        
        .btn-warning {
          background-color: #d69e2e;
          color: white;
        }
        
        .btn-danger {
          background-color: #e53e3e;
          color: white;
        }
        
        .btn-dark {
          background-color: #1a202c;
          color: white;
          border: 1px solid #4a5568;
        }
      `}</style>
    </div>
  );
}