import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import PlayerComponentZustand from '../components/PlayerComponentZustand';
import { useAppStore } from '../lib/store/appStore';

/**
 * Zustand Test Page
 * 
 * This page tests the Zustand-enhanced player component
 * and displays the current state from the Zustand store
 * for debugging purposes.
 */
export default function ZustandTestPage() {
  // Use Zustand store for state
  const storeState = useAppStore();
  const [userId, setUserId] = useState<string>('');
  
  // Mock user for testing
  const [user, setUser] = useState(null);
  
  // Initialize on mount
  useEffect(() => {
    // Use a unique ID for testing
    const anonymousId = `anonymous-test-${Date.now()}`;
    
    // Set the userId for initializing the store
    setUserId(anonymousId);
    
    // Set the mock user
    setUser({
      id: anonymousId,
      isAnonymous: true
    });
    
    // Initialize the store with this ID
    useAppStore.getState().setUserInformation({
      userId: anonymousId,
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
    
    // Set a default tube state
    useAppStore.getState().setTubeState({
      tubes: {
        1: { threadId: 'thread-T1-001', currentStitchId: '', position: 0 },
        2: { threadId: 'thread-T2-001', currentStitchId: '', position: 0 },
        3: { threadId: 'thread-T3-001', currentStitchId: '', position: 0 }
      },
      activeTube: 1,
      activeTubeNumber: 1,
      cycleCount: 0
    });
    
  }, []);
  
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
        <title>Zustand Test - Zenjin Maths</title>
        <meta name="description" content="Zustand state persistence test page" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main>
        <h1>Zustand State Persistence Test</h1>
        
        <div className="test-page-content">
          <div className="player-section">
            <h2>Player Component (Zustand-Enhanced)</h2>
            <PlayerComponentZustand user={user} />
          </div>
          
          <div className="state-section">
            <h2>Current Zustand Store State</h2>
            
            <div className="state-info">
              <h3>User Information</h3>
              <pre>{formatJson(storeState.userInformation)}</pre>
              
              <h3>Tube State</h3>
              <pre>{formatJson(storeState.tubeState)}</pre>
              
              <h3>Learning Progress</h3>
              <pre>{formatJson(storeState.learningProgress)}</pre>
              
              <h3>Last Updated</h3>
              <pre>{storeState.lastUpdated}</pre>
            </div>
            
            <div className="store-actions">
              <h3>Store Actions</h3>
              <button 
                onClick={() => useAppStore.getState().syncToServer()}
                className="btn btn-primary"
              >
                Force Sync to Server
              </button>
              
              <button 
                onClick={() => {
                  const points = storeState.learningProgress?.points || { session: 0, lifetime: 0 };
                  useAppStore.getState().incrementPoints(10);
                }}
                className="btn btn-success"
              >
                Add 10 Points
              </button>
              
              <button 
                onClick={() => {
                  const currentTube = storeState.tubeState?.activeTube || 1;
                  const nextTube = currentTube < 3 ? currentTube + 1 : 1;
                  useAppStore.getState().setActiveTube(nextTube);
                }}
                className="btn btn-info"
              >
                Cycle Tube
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
        }
        
        h1, h2, h3 {
          color: #333;
        }
        
        .test-page-content {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin-top: 30px;
        }
        
        .player-section {
          flex: 1;
          min-width: 45%;
          border: 1px solid #eaeaea;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .state-section {
          flex: 1;
          min-width: 45%;
          border: 1px solid #eaeaea;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        pre {
          background-color: #f7f7f7;
          padding: 15px;
          border-radius: 5px;
          overflow: auto;
          max-height: 200px;
          font-size: 12px;
        }
        
        .state-info {
          margin-bottom: 20px;
        }
        
        .store-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        button {
          padding: 10px 15px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .btn-primary {
          background-color: #0070f3;
          color: white;
        }
        
        .btn-success {
          background-color: #28a745;
          color: white;
        }
        
        .btn-info {
          background-color: #17a2b8;
          color: white;
        }
      `}</style>
    </div>
  );
}