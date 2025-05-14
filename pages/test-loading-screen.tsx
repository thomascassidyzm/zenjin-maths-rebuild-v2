import React, { useState } from 'react';
import PlayerWithLoader from '../components/PlayerWithLoader';
import MinimalDistinctionPlayer from '../components/MinimalDistinctionPlayer';
import { useZenjinStore } from '../lib/store';
import LoadingScreen from '../components/LoadingScreen';

/**
 * Test page for the loading screen component
 * Demonstrates:
 * 1. Direct LoadingScreen usage with manual control
 * 2. PlayerWithLoader integration that handles loading automatically
 */
export default function TestLoadingScreen() {
  const [showDirectLoader, setShowDirectLoader] = useState(false);
  const [testMode, setTestMode] = useState<'direct' | 'integrated' | 'none'>('none');
  const { initializeUserState } = useZenjinStore();
  
  // Initialize user state when page loads
  React.useEffect(() => {
    initializeUserState();
  }, [initializeUserState]);
  
  // Toggle between different test modes
  const handleSelectTestMode = (mode: 'direct' | 'integrated' | 'none') => {
    setTestMode(mode);
  };
  
  // Show loader for direct test mode
  const showLoader = () => {
    setShowDirectLoader(true);
    // Auto-hide after 5 seconds for demo purposes
    setTimeout(() => {
      setShowDirectLoader(false);
    }, 5000);
  };
  
  return (
    <div className="min-h-screen p-8 bg-slate-800 text-white">
      <h1 className="text-3xl font-bold mb-6">Loading Screen Test</h1>
      
      {/* Test mode selection */}
      <div className="mb-8 flex gap-4">
        <button 
          className={`px-4 py-2 rounded ${testMode === 'direct' ? 'bg-blue-600' : 'bg-slate-600'}`}
          onClick={() => handleSelectTestMode('direct')}
        >
          Direct LoadingScreen
        </button>
        <button 
          className={`px-4 py-2 rounded ${testMode === 'integrated' ? 'bg-blue-600' : 'bg-slate-600'}`}
          onClick={() => handleSelectTestMode('integrated')}
        >
          Integrated PlayerWithLoader
        </button>
        <button 
          className={`px-4 py-2 rounded ${testMode === 'none' ? 'bg-blue-600' : 'bg-slate-600'}`}
          onClick={() => handleSelectTestMode('none')}
        >
          None
        </button>
      </div>
      
      {/* Test scenarios */}
      {testMode === 'direct' && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Direct LoadingScreen Test</h2>
          <p className="mb-4">
            This tests the LoadingScreen component directly, without the PlayerWithLoader integration.
          </p>
          <button 
            className="px-4 py-2 rounded bg-green-600"
            onClick={showLoader}
          >
            Show Loading Screen (5 seconds)
          </button>
          
          {/* Direct loading screen */}
          {showDirectLoader && (
            <LoadingScreen 
              isAnonymous={true}
              onAnimationComplete={() => console.log('Animation complete')}
              minDisplayTime={5000}
            />
          )}
        </div>
      )}
      
      {testMode === 'integrated' && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Integrated PlayerWithLoader Test</h2>
          <p className="mb-4">
            This tests the PlayerWithLoader component that integrates the LoadingScreen with the player.
            It will show the loading screen until content is fully loaded, then display the player.
          </p>
          
          {/* Player with loader integration */}
          <div className="bg-slate-700 rounded-lg p-4 h-[600px]">
            <PlayerWithLoader tubeId={1} stitchId="stitch-T1-001-01">
              <MinimalDistinctionPlayer tubeNumber={1} />
            </PlayerWithLoader>
          </div>
        </div>
      )}
      
      {testMode === 'none' && (
        <div className="flex items-center justify-center p-16 bg-slate-700 rounded-lg">
          <p className="text-xl">Select a test mode above to begin</p>
        </div>
      )}
    </div>
  );
}