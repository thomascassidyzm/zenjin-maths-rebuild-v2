import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import TubeStitchPlayer from '../components/TubeStitchPlayer';
import { useZenjinStore } from '../lib/store/zenjinStore';
import BackgroundBubbles from '../components/BackgroundBubbles';

/**
 * Test page for the TubeStitchPlayer component
 * 
 * This is a simplified test page that directly uses the tube-stitch model
 * without any thread abstraction
 */
export default function TubeStitchTest() {
  // State for tube data and player results
  const [tubeData, setTubeData] = useState<any>(null);
  const [activeTubeNumber, setActiveTubeNumber] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionPoints, setSessionPoints] = useState(0);
  
  // Get initial state from Zustand
  const fillInitialContentBuffer = useZenjinStore(state => state.fillInitialContentBuffer);

  // Initialize tube data on component mount
  useEffect(() => {
    async function initializeTubeData() {
      try {
        // Reset loading state
        setIsLoading(true);
        setError(null);
        
        console.log('Initializing tube data from Zustand store...');
        
        // Fill initial content buffer (loads tube state from API/localStorage)
        await fillInitialContentBuffer();
        
        // Get the tube state from Zustand store
        const tubeState = useZenjinStore.getState().tubeState;
        
        if (!tubeState || !tubeState.tubes) {
          console.error('No tube state found in Zustand store');
          setError('Could not load tube data. Please try again.');
          setIsLoading(false);
          return;
        }
        
        console.log('Tube state loaded from Zustand store:', tubeState);
        
        // Process the tube state into tube data
        const processedTubeData = {};
        
        // Iterate through each tube in the state
        Object.entries(tubeState.tubes).forEach(([tubeNumStr, tube]) => {
          const tubeNum = parseInt(tubeNumStr);
          
          // Add the tube to our processed data
          processedTubeData[tubeNum] = {
            ...tube,
            // Ensure required properties exist
            positions: tube.positions || {},
            stitches: tube.stitches || [],
            currentStitchId: tube.currentStitchId || `stitch-T${tubeNum}-001-01`
          };
        });
        
        // Set the tube data and active tube
        setTubeData(processedTubeData);
        setActiveTubeNumber(tubeState.activeTube || 1);
        setIsLoading(false);
        
      } catch (error) {
        console.error('Error initializing tube data:', error);
        setError(`Failed to initialize: ${error.message}`);
        setIsLoading(false);
        
        // Create emergency fallback data
        const fallbackTubes = {
          1: {
            currentStitchId: 'stitch-T1-001-01',
            positions: {
              0: { stitchId: 'stitch-T1-001-01', skipNumber: 3, distractorLevel: 'L1' }
            }
          },
          2: {
            currentStitchId: 'stitch-T2-001-01',
            positions: {
              0: { stitchId: 'stitch-T2-001-01', skipNumber: 3, distractorLevel: 'L1' }
            }
          },
          3: {
            currentStitchId: 'stitch-T3-001-01',
            positions: {
              0: { stitchId: 'stitch-T3-001-01', skipNumber: 3, distractorLevel: 'L1' }
            }
          }
        };
        
        setTubeData(fallbackTubes);
        setActiveTubeNumber(1);
      }
    }
    
    initializeTubeData();
  }, [fillInitialContentBuffer]);
  
  // Handle session completion
  const handleSessionComplete = (results) => {
    console.log('Session complete!', results);
    
    if (results?.totalPoints) {
      setSessionPoints(prev => prev + results.totalPoints);
    }
    
    // You could add more sophisticated handling here
  };
  
  // Handle session ending
  const handleSessionEnd = (results) => {
    console.log('Session ended manually', results);
    
    if (results?.totalPoints) {
      setSessionPoints(prev => prev + results.totalPoints);
    }
  };
  
  // Switch to a different tube
  const switchTube = (tubeNumber) => {
    if (!tubeData || !tubeData[tubeNumber]) {
      console.error(`Cannot switch to tube ${tubeNumber}: tube does not exist`);
      return;
    }
    
    console.log(`Switching to tube ${tubeNumber}`);
    setActiveTubeNumber(tubeNumber);
    
    // Also update in Zustand store for persistence
    useZenjinStore.getState().setActiveTube(tubeNumber);
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center">
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="animate-spin mb-4 h-12 w-12 border-4 border-t-teal-500 border-teal-200 rounded-full mx-auto"></div>
          <h2 className="text-xl font-medium text-white">Loading Tube Content</h2>
          <p className="text-white/70 mt-2">This should only take a moment...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center">
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-medium text-white">Oops! Something went wrong</h2>
          <p className="text-white/70 mt-2 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  // Dashboard link and user info
  const AdminBar = () => (
    <div className="fixed top-0 left-0 right-0 bg-indigo-900/80 p-2 flex justify-between items-center text-white z-50">
      <div className="flex items-center space-x-4">
        <h1 className="font-bold">TubeStitch Test</h1>
        <span className="px-2 py-1 bg-indigo-700 rounded text-xs">TUBE {activeTubeNumber}</span>
      </div>
      <div className="flex items-center space-x-2">
        <span className="text-sm">Session Points: {sessionPoints}</span>
        <a href="/dashboard" className="text-xs bg-teal-600 hover:bg-teal-500 px-2 py-1 rounded transition-colors">
          Dashboard
        </a>
      </div>
    </div>
  );
  
  // Tube selector buttons
  const TubeSelector = () => (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-indigo-900/80 rounded-full px-4 py-2 z-50">
      <div className="flex space-x-3">
        <button
          onClick={() => switchTube(1)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            activeTubeNumber === 1 ? 'bg-blue-500 text-white' : 'bg-indigo-700 text-white/70 hover:bg-indigo-600'
          }`}
        >
          1
        </button>
        <button
          onClick={() => switchTube(2)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            activeTubeNumber === 2 ? 'bg-green-500 text-white' : 'bg-indigo-700 text-white/70 hover:bg-indigo-600'
          }`}
        >
          2
        </button>
        <button
          onClick={() => switchTube(3)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            activeTubeNumber === 3 ? 'bg-purple-500 text-white' : 'bg-indigo-700 text-white/70 hover:bg-indigo-600'
          }`}
        >
          3
        </button>
      </div>
    </div>
  );
  
  // Debug information
  const DebugInfo = () => {
    // Get tube info
    const activeTube = tubeData && tubeData[activeTubeNumber];
    const positions = activeTube?.positions || {};
    const stitches = activeTube?.stitches || [];
    
    // Count stitches based on format
    const stitchCount = Object.keys(positions).length > 0 
      ? Object.keys(positions).length
      : stitches.length;
      
    return (
      <div className="fixed bottom-0 left-0 bg-black/80 text-white p-2 text-xs max-w-xs overflow-auto max-h-32 z-40">
        <div><strong>Tube:</strong> {activeTubeNumber}</div>
        <div><strong>Current Stitch:</strong> {activeTube?.currentStitchId || 'unknown'}</div>
        <div><strong>Stitch Count:</strong> {stitchCount}</div>
        <div><strong>Format:</strong> {Object.keys(positions).length > 0 ? 'position-based' : 'legacy'}</div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen player-bg">
      <Head>
        <title>TubeStitch Test | Zenjin Maths</title>
        <meta name="description" content="Test page for TubeStitch model" />
      </Head>
      
      {/* Background animation */}
      <BackgroundBubbles />
      
      {/* Admin controls */}
      <AdminBar />
      <DebugInfo />
      
      {/* Main player container */}
      <main className="min-h-screen flex flex-col pt-12 relative z-10">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            {tubeData && activeTubeNumber && tubeData[activeTubeNumber] ? (
              <TubeStitchPlayer
                tubeNumber={activeTubeNumber}
                tubeData={tubeData}
                onComplete={handleSessionComplete}
                onEndSession={handleSessionEnd}
                questionsPerSession={5} // Shorter for testing
                sessionTotalPoints={sessionPoints}
                userId="test-user"
              />
            ) : (
              <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
                <div className="text-white text-xl mb-2">No Tube Data Available</div>
                <p className="text-white/70">
                  Could not find data for tube {activeTubeNumber}.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Tube selector */}
      <TubeSelector />
    </div>
  );
}