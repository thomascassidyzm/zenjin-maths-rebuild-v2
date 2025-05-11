import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import useTestPane from '../hooks/useTestPane';

// Dynamic import with no SSR to avoid issues with localStorage/window access
const TubeStateTestPane = dynamic(
  () => import('../components/TubeStateTestPane'),
  { ssr: false }
);

/**
 * Debug Tubes
 * 
 * A diagnostic page for examining tube state persistence issues
 */
export default function DebugTubes() {
  const router = useRouter();
  const { isTestPaneVisible, showTestPane, hideTestPane, toggleTestPane } = useTestPane();
  const [userId, setUserId] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [allStates, setAllStates] = useState<Record<string, any>>({});
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Get userId
    const foundUserId = localStorage.getItem('zenjin_user_id') ||
                     localStorage.getItem('zenjin_anonymous_id') || 
                     localStorage.getItem('anonymousId') || 'unknown';
    
    setUserId(foundUserId);
    
    // Create a debug object for display
    const debug = {
      userId: foundUserId,
      pageInfo: {
        url: window.location.href,
        path: window.location.pathname,
      },
      localStorage: {
        keys: Object.keys(localStorage),
        size: calculateLocalStorageSize(),
      },
      browserInfo: {
        userAgent: navigator.userAgent,
        language: navigator.language,
      }
    };
    
    setDebugInfo(debug);
    
    // Get all states from localStorage
    const states: Record<string, any> = {};
    
    // Define state keys to check
    const stateKeys = [
      `zenjin_state_${foundUserId}`,
      'zenjin_anonymous_state',
      `triple_helix_state_${foundUserId}`
    ];
    
    // Load all states
    stateKeys.forEach(key => {
      try {
        const stateJson = localStorage.getItem(key);
        if (stateJson) {
          const parsed = JSON.parse(stateJson);
          
          // For anonymous state, extract the actual state
          if (key === 'zenjin_anonymous_state' && parsed.state) {
            states[key] = parsed.state;
          } else {
            states[key] = parsed;
          }
        }
      } catch (e) {
        console.error(`Error parsing state from ${key}:`, e);
      }
    });
    
    setAllStates(states);
  }, []);
  
  // Helper to calculate localStorage size
  function calculateLocalStorageSize() {
    let totalSize = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      const value = localStorage.getItem(key) || '';
      totalSize += (key.length + value.length) * 2; // Approximate size in bytes (UTF-16)
    }
    
    return `${(totalSize / 1024).toFixed(2)} KB`;
  }
  
  // Helper to format tube data
  function formatTube(tube: any, tubeNumber: number) {
    if (!tube) return <div>No data for tube {tubeNumber}</div>;
    
    return (
      <div className="bg-gray-800 p-4 rounded-lg mb-4">
        <h4 className="text-lg font-semibold border-b border-gray-700 pb-2 mb-2">
          Tube {tubeNumber}
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm mb-2">
          <div className="font-medium text-gray-400">Thread ID:</div>
          <div>{tube.threadId || 'none'}</div>
          
          <div className="font-medium text-gray-400">Current Stitch ID:</div>
          <div>{tube.currentStitchId || 'none'}</div>
          
          <div className="font-medium text-gray-400">Position:</div>
          <div>{tube.position || 0}</div>
        </div>
        
        {tube.stitches && tube.stitches.length > 0 ? (
          <div>
            <div className="font-medium text-gray-400 mb-1">Stitches: {tube.stitches.length}</div>
            <div className="text-xs max-h-40 overflow-y-auto">
              {tube.stitches
                .sort((a: any, b: any) => a.position - b.position)
                .map((stitch: any, idx: number) => (
                  <div key={idx} className="border-t border-gray-700 py-1">
                    {`Pos ${stitch.position}: ${stitch.id} (Skip=${stitch.skipNumber || 'n/a'})`}
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className="text-orange-400">No stitches in tube</div>
        )}
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <Head>
        <title>State Debugging | Zenjin Maths</title>
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">State Debugging</h1>
            <p className="text-gray-400">Diagnosing tube state persistence issues</p>
          </div>
          
          <div className="flex space-x-4">
            <Link href="/dashboard" passHref legacyBehavior>
              <a className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors">
                Back to Dashboard
              </a>
            </Link>
            
            <button 
              onClick={() => window.location.reload()}
              className="bg-indigo-700 hover:bg-indigo-600 px-4 py-2 rounded-lg transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Basic info */}
          <div className="bg-slate-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-4 border-b border-slate-700 pb-2">User Info</h2>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="font-medium text-gray-400">User ID:</div>
              <div className="font-mono text-sm break-all">{userId}</div>
            </div>
            
            <h3 className="text-lg font-bold mb-2">localStorage</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="font-medium text-gray-400">Total Size:</div>
              <div>{debugInfo.localStorage?.size || 'unknown'}</div>
              
              <div className="font-medium text-gray-400">Key Count:</div>
              <div>{debugInfo.localStorage?.keys?.length || 0}</div>
            </div>
            
            <h3 className="text-lg font-bold mb-2">State Keys</h3>
            <div className="space-y-1 text-sm">
              {debugInfo.localStorage?.keys?.filter((k: string) => k.includes('state'))
                .map((key: string) => (
                <div key={key} className="font-mono bg-slate-700 p-1 rounded">
                  {key}
                </div>
              ))}
            </div>
          </div>
          
          {/* State summaries */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800 p-6 rounded-xl shadow-lg mb-6">
              <h2 className="text-xl font-bold mb-4 border-b border-slate-700 pb-2">Active Tube Summary</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="px-4 py-2">State</th>
                      <th className="px-4 py-2">Active Tube</th>
                      <th className="px-4 py-2">Last Updated</th>
                      <th className="px-4 py-2">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(allStates).map(([key, state]) => (
                      <tr key={key} className="border-b border-slate-700">
                        <td className="px-4 py-2 font-medium">{key.replace(`_${userId}`, '')}</td>
                        <td className="px-4 py-2">{state.activeTube || state.activeTubeNumber || 'unknown'}</td>
                        <td className="px-4 py-2">{state.lastUpdated ? new Date(state.lastUpdated).toLocaleString() : 'unknown'}</td>
                        <td className="px-4 py-2">{JSON.stringify(state).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Detailed state view */}
            {Object.entries(allStates).map(([key, state]) => (
              <div key={key} className="bg-slate-800 p-6 rounded-xl shadow-lg mb-6">
                <h2 className="text-xl font-bold mb-4 border-b border-slate-700 pb-2">
                  {key.replace(`_${userId}`, '')}
                </h2>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="font-medium text-gray-400">Active Tube:</div>
                  <div>{state.activeTube || state.activeTubeNumber || 'unknown'}</div>
                  
                  <div className="font-medium text-gray-400">Active Tube Number:</div>
                  <div>{state.activeTubeNumber || 'unknown'}</div>
                  
                  <div className="font-medium text-gray-400">Cycle Count:</div>
                  <div>{state.cycleCount || 0}</div>
                  
                  <div className="font-medium text-gray-400">Last Updated:</div>
                  <div>{state.lastUpdated ? new Date(state.lastUpdated).toLocaleString() : 'unknown'}</div>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold mb-3">Tube States</h3>
                  
                  {state.tubes ? (
                    <div className="space-y-4">
                      {formatTube(state.tubes[1], 1)}
                      {formatTube(state.tubes[2], 2)}
                      {formatTube(state.tubes[3], 3)}
                    </div>
                  ) : (
                    <div className="text-red-400">No tubes data available</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-8 px-6 py-4 bg-slate-800 rounded-xl shadow-lg">
          <h2 className="text-xl font-bold mb-4">Testing Actions</h2>
          
          <div className="flex flex-wrap gap-4">
            <Link href="/minimal-player?continue=true" passHref legacyBehavior>
              <a className="bg-teal-700 hover:bg-teal-600 px-4 py-2 rounded-lg transition-colors">
                Continue Learning
              </a>
            </Link>
            
            <Link href="/" passHref legacyBehavior>
              <a className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors">
                Home
              </a>
            </Link>
            
            <button
              onClick={() => {
                localStorage.setItem('zenjin_continue_previous_state', 'true');
                alert('Set continue flag to true');
              }}
              className="bg-violet-700 hover:bg-violet-600 px-4 py-2 rounded-lg transition-colors"
            >
              Set Continue Flag
            </button>

            <button
              onClick={toggleTestPane}
              className="bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded-lg transition-colors"
            >
              {isTestPaneVisible ? 'Hide Test Pane' : 'Show Test Pane'}
            </button>
          </div>
        </div>
      </div>

      {/* Add the test pane component */}
      <TubeStateTestPane
        userId={userId}
        isVisible={isTestPaneVisible}
        onClose={hideTestPane}
      />
    </div>
  );
}