import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useZenjinStore } from '../lib/store';
import PlayerWithLoader from './PlayerWithLoader';
import MinimalDistinctionPlayer from './MinimalDistinctionPlayer';
import { useAuth } from '../context/AuthContext';

/**
 * Client-side only component that demonstrates PlayerWithLoader integration
 * with MinimalDistinctionPlayer using the Zustand store for content
 */
const MinimalPlayerWithLoaderContent: React.FC = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<Array<{timestamp: string, message: string}>>([]);
  
  // Define tube and stitch IDs for the demo
  const tubeId = 1;
  const stitchId = "stitch-T1-001-01";
  
  // Get necessary store functions
  const { 
    contentCollection,
    initializeState, 
    fillInitialContentBuffer,
  } = useZenjinStore();
  
  // Add diagnostic message with timestamp
  const addDiagnostic = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDiagnostics(prev => [{timestamp, message}, ...prev.slice(0, 19)]);
    console.log(`[${timestamp}] ${message}`);
  }, []);
  
  // Initialize the store when the component mounts
  useEffect(() => {
    const initializeStore = async () => {
      try {
        addDiagnostic('Initializing Zustand store...');
        await initializeState();
        addDiagnostic('Zustand store initialized');
        
        addDiagnostic('Filling initial content buffer...');
        await fillInitialContentBuffer();
        addDiagnostic('Initial content buffer filled');
        
        setLoading(false);
      } catch (error) {
        console.error('Error initializing store:', error);
        setError('Failed to initialize content store');
        setLoading(false);
      }
    };
    
    initializeStore();
  }, [initializeState, fillInitialContentBuffer, addDiagnostic]);
  
  // Handle player completion
  const handleComplete = (results: any) => {
    addDiagnostic(`Player completed with ${results.correctAnswers} correct answers`);
    
    // Normally, you would navigate to the dashboard or next content
    // For this demo, we'll just log the results
    console.log('Player completed with results:', results);
    
    // Show completion message
    alert(`Session completed with ${results.correctAnswers} correct answers!`);
  };
  
  // Handle content loading completion
  const handleContentLoaded = () => {
    addDiagnostic('Content loaded successfully');
  };
  
  // If we're still initializing, show simple loading
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="inline-block animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full mb-4"></div>
          <p className="text-xl">Initializing content store...</p>
        </div>
      </div>
    );
  }
  
  // If there was an initialization error, show error message
  if (error) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="bg-red-800 text-white p-6 rounded-xl max-w-md">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p className="mb-4">{error}</p>
          <button 
            className="bg-white text-red-800 px-4 py-2 rounded font-semibold"
            onClick={() => router.reload()}
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
  
  // Get the tube data from the content collection
  const tubeData = contentCollection?.tubes?.[tubeId];
  
  return (
    <div className="flex flex-col min-h-screen relative">
      {/* Main player area */}
      <div className="flex-grow">
        <PlayerWithLoader 
          tubeId={tubeId} 
          stitchId={stitchId}
          onContentLoaded={handleContentLoaded}
          minLoadingTime={3000} // Show loading screen for at least 3 seconds
          maxAttempts={3}      // Try up to 3 times to load content
        >
          {tubeData ? (
            <MinimalDistinctionPlayer 
              tubeNumber={tubeId} 
              tubeData={tubeData} 
              onComplete={handleComplete}
              userId={user?.id || 'anon-user'}
            />
          ) : (
            <div className="min-h-screen player-bg flex items-center justify-center p-4">
              <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl p-6 max-w-md">
                <h2 className="text-white text-2xl font-bold mb-4">Error Loading Content</h2>
                <p className="text-white mb-6">
                  We couldn't load the required content. Please try refreshing the page.
                </p>
                <button 
                  onClick={() => router.reload()} 
                  className="bg-teal-600 hover:bg-teal-500 text-white py-2 px-6 rounded-lg"
                >
                  Reload
                </button>
              </div>
            </div>
          )}
        </PlayerWithLoader>
      </div>
      
      {/* Diagnostics panel at the bottom */}
      <div className="bg-black bg-opacity-80 text-white p-4 max-h-48 overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold">Diagnostics</h3>
          <button 
            className="bg-gray-700 text-white px-3 py-1 rounded text-sm"
            onClick={() => router.push('/')}
          >
            Back to Home
          </button>
        </div>
        <div className="text-sm font-mono">
          {diagnostics.map((entry, index) => (
            <div key={index} className="mb-1">
              <span className="text-gray-400">[{entry.timestamp}]</span>{' '}
              <span className="text-green-400">{entry.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MinimalPlayerWithLoaderContent;