import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const TubeDebugPage: React.FC = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [userId, setUserId] = useState('');
  const [tubeInfo, setTubeInfo] = useState<any>({});
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Add log message
  const addLog = (message: string) => {
    setLogMessages(prev => [message, ...prev.slice(0, 19)]);
  };
  
  useEffect(() => {
    setIsMounted(true);
    
    // Get user ID from localStorage
    const uid = localStorage.getItem('zenjin_user_id') ||
              localStorage.getItem('zenjin_anonymous_id') ||
              localStorage.getItem('anonymousId') || 'anonymous';
              
    setUserId(uid);
    
    // Initial state check
    checkState();
    
    // Set up interval for checking state
    const interval = setInterval(checkState, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  const checkState = () => {
    try {
      // Get current state
      const stateKey = `zenjin_state_${userId || 'anonymous'}`;
      const stateJson = localStorage.getItem(stateKey);
      
      if (stateJson) {
        const state = JSON.parse(stateJson);
        setTubeInfo({
          activeTube: state.activeTube || state.activeTubeNumber || 1,
          lastUpdated: state.lastUpdated ? new Date(state.lastUpdated).toLocaleString() : 'unknown',
          tubes: state.tubes ? Object.keys(state.tubes) : []
        });
      } else {
        // Try anonymous state
        const anonStateJson = localStorage.getItem('zenjin_anonymous_state');
        if (anonStateJson) {
          const parsed = JSON.parse(anonStateJson);
          if (parsed.state) {
            setTubeInfo({
              activeTube: parsed.state.activeTube || parsed.state.activeTubeNumber || 1,
              lastUpdated: parsed.state.lastUpdated ? new Date(parsed.state.lastUpdated).toLocaleString() : 'unknown',
              tubes: parsed.state.tubes ? Object.keys(parsed.state.tubes) : []
            });
          }
        }
      }
    } catch (e) {
      console.error('Error checking state:', e);
    }
  };
  
  // Simple function to complete stitch with 20/20 score by directly updating localStorage
  const completeStitchPerfect = () => {
    setIsLoading(true);
    addLog(`[${new Date().toLocaleTimeString()}] 🎯 Setting stitch to completed with perfect score (20/20)`);
    
    try {
      // Get state from localStorage
      const stateKey = `zenjin_state_${userId || 'anonymous'}`;
      const stateJson = localStorage.getItem(stateKey);
      
      if (stateJson) {
        const state = JSON.parse(stateJson);
        const activeTube = state.activeTube || state.activeTubeNumber || 1;
        
        if (state.tubes && state.tubes[activeTube]) {
          // Mark current stitch as completed with perfect score
          const tube = state.tubes[activeTube];
          if (tube.stitches && tube.stitches.length > 0) {
            // Find current stitch (position 0)
            const currentStitchIndex = tube.stitches.findIndex((s: any) => s.position === 0);
            
            if (currentStitchIndex >= 0) {
              const currentStitch = tube.stitches[currentStitchIndex];
              
              // Update stitch skip number (simulating perfect score advancement)
              const oldSkip = currentStitch.skipNumber || 1;
              const newSkip = oldSkip === 1 ? 3 : 
                              oldSkip === 3 ? 5 :
                              oldSkip === 5 ? 10 :
                              oldSkip === 10 ? 25 :
                              oldSkip === 25 ? 100 : 100;
                              
              addLog(`[${new Date().toLocaleTimeString()}] 📊 Stitch skip number updated: ${oldSkip} → ${newSkip}`);
              
              // Update state
              tube.stitches[currentStitchIndex].skipNumber = newSkip;
              
              // Rotate positions (simulating advancement)
              tube.stitches.forEach((stitch: any) => {
                stitch.position = (stitch.position + 1) % tube.stitches.length;
              });
              
              // Update last updated timestamp
              state.lastUpdated = new Date().toISOString();
              
              // Save back to localStorage
              localStorage.setItem(stateKey, JSON.stringify(state));
              
              // Also update anonymous state if it exists
              const anonStateJson = localStorage.getItem('zenjin_anonymous_state');
              if (anonStateJson) {
                const anonState = JSON.parse(anonStateJson);
                if (anonState.state) {
                  anonState.state = state;
                  localStorage.setItem('zenjin_anonymous_state', JSON.stringify(anonState));
                }
              }
              
              // Also update triple helix state if it exists
              localStorage.setItem(`triple_helix_state_${userId || 'anonymous'}`, JSON.stringify(state));
              
              addLog(`[${new Date().toLocaleTimeString()}] ✅ Stitch completed successfully`);
            } else {
              addLog(`[${new Date().toLocaleTimeString()}] ❌ No stitch found at position 0`);
            }
          } else {
            addLog(`[${new Date().toLocaleTimeString()}] ❌ No stitches found in tube ${activeTube}`);
          }
        } else {
          addLog(`[${new Date().toLocaleTimeString()}] ❌ No tube ${activeTube} found in state`);
        }
      } else {
        addLog(`[${new Date().toLocaleTimeString()}] ❌ No state found in localStorage`);
      }
    } catch (e) {
      console.error('Error completing stitch:', e);
      addLog(`[${new Date().toLocaleTimeString()}] ❌ Error completing stitch: ${e}`);
    } finally {
      setIsLoading(false);
      checkState();
    }
  };
  
  // Simple function to complete stitch with 10/20 score (40 points total)
  const completeStitchPartial = () => {
    setIsLoading(true);
    addLog(`[${new Date().toLocaleTimeString()}] 🎯 Setting stitch to completed with partial score (10/20 - 40 points)`);
    
    try {
      // Get state from localStorage
      const stateKey = `zenjin_state_${userId || 'anonymous'}`;
      const stateJson = localStorage.getItem(stateKey);
      
      if (stateJson) {
        const state = JSON.parse(stateJson);
        const activeTube = state.activeTube || state.activeTubeNumber || 1;
        
        if (state.tubes && state.tubes[activeTube]) {
          // Mark current stitch as completed with partial score
          const tube = state.tubes[activeTube];
          if (tube.stitches && tube.stitches.length > 0) {
            // Find current stitch (position 0)
            const currentStitchIndex = tube.stitches.findIndex((s: any) => s.position === 0);
            
            if (currentStitchIndex >= 0) {
              // Update last updated timestamp
              state.lastUpdated = new Date().toISOString();
              
              // Save back to localStorage without changing skip number
              localStorage.setItem(stateKey, JSON.stringify(state));
              
              // Also update anonymous state if it exists
              const anonStateJson = localStorage.getItem('zenjin_anonymous_state');
              if (anonStateJson) {
                const anonState = JSON.parse(anonStateJson);
                if (anonState.state) {
                  anonState.state = state;
                  localStorage.setItem('zenjin_anonymous_state', JSON.stringify(anonState));
                }
              }
              
              // Also update triple helix state if it exists
              localStorage.setItem(`triple_helix_state_${userId || 'anonymous'}`, JSON.stringify(state));
              
              addLog(`[${new Date().toLocaleTimeString()}] ✅ Stitch completed with partial score - no advancement`);
            } else {
              addLog(`[${new Date().toLocaleTimeString()}] ❌ No stitch found at position 0`);
            }
          } else {
            addLog(`[${new Date().toLocaleTimeString()}] ❌ No stitches found in tube ${activeTube}`);
          }
        } else {
          addLog(`[${new Date().toLocaleTimeString()}] ❌ No tube ${activeTube} found in state`);
        }
      } else {
        addLog(`[${new Date().toLocaleTimeString()}] ❌ No state found in localStorage`);
      }
    } catch (e) {
      console.error('Error completing stitch:', e);
      addLog(`[${new Date().toLocaleTimeString()}] ❌ Error completing stitch: ${e}`);
    } finally {
      setIsLoading(false);
      checkState();
    }
  };
  
  // Simple function to cycle to next tube
  const cycleTube = () => {
    setIsLoading(true);
    
    try {
      // Get state from localStorage
      const stateKey = `zenjin_state_${userId || 'anonymous'}`;
      const stateJson = localStorage.getItem(stateKey);
      
      if (stateJson) {
        const state = JSON.parse(stateJson);
        const currentTube = state.activeTube || state.activeTubeNumber || 1;
        const nextTube = (currentTube % 3) + 1; // 1->2->3->1
        
        addLog(`[${new Date().toLocaleTimeString()}] 🔄 Cycling from tube ${currentTube} to ${nextTube}`);
        
        // Update active tube
        state.activeTube = nextTube;
        state.activeTubeNumber = nextTube;
        state.lastUpdated = new Date().toISOString();
        
        // Save back to localStorage
        localStorage.setItem(stateKey, JSON.stringify(state));
        
        // Also update anonymous state if it exists
        const anonStateJson = localStorage.getItem('zenjin_anonymous_state');
        if (anonStateJson) {
          const anonState = JSON.parse(anonStateJson);
          if (anonState.state) {
            anonState.state = state;
            localStorage.setItem('zenjin_anonymous_state', JSON.stringify(anonState));
          }
        }
        
        // Also update triple helix state if it exists
        localStorage.setItem(`triple_helix_state_${userId || 'anonymous'}`, JSON.stringify(state));
        
        addLog(`[${new Date().toLocaleTimeString()}] ✅ Tube cycled successfully`);
      } else {
        addLog(`[${new Date().toLocaleTimeString()}] ❌ No state found in localStorage`);
      }
    } catch (e) {
      console.error('Error cycling tube:', e);
      addLog(`[${new Date().toLocaleTimeString()}] ❌ Error cycling tube: ${e}`);
    } finally {
      setIsLoading(false);
      checkState();
    }
  };
  
  if (!isMounted) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4">
      <Head>
        <title>Simple Tube Debugger</title>
      </Head>
      
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-4">Simple Tube State Debugger</h1>
        
        <div className="mb-6 bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Current State</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-400">User ID:</div>
            <div className="font-mono">{userId || 'unknown'}</div>
            
            <div className="text-gray-400">Active Tube:</div>
            <div className="font-mono">{tubeInfo.activeTube || 'unknown'}</div>
            
            <div className="text-gray-400">Last Updated:</div>
            <div className="font-mono">{tubeInfo.lastUpdated || 'unknown'}</div>
            
            <div className="text-gray-400">Tubes:</div>
            <div className="font-mono">{tubeInfo.tubes ? tubeInfo.tubes.join(', ') : 'none'}</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={completeStitchPerfect}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 px-4 py-3 rounded-lg text-center"
          >
            Complete 20/20
            <span className="block text-sm mt-1">Perfect Score</span>
          </button>
          
          <button
            onClick={completeStitchPartial}
            disabled={isLoading}
            className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 px-4 py-3 rounded-lg text-center"
          >
            Complete 10/20
            <span className="block text-sm mt-1">40 Points Total</span>
          </button>
        </div>
        
        <button
          onClick={cycleTube}
          disabled={isLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 px-4 py-3 rounded-lg text-center mb-6"
        >
          Cycle to Next Tube
          <span className="block text-sm mt-1">1→2→3→1</span>
        </button>
        
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Event Log</h2>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-2 h-64 overflow-y-auto text-sm font-mono">
            {logMessages.length === 0 ? (
              <div className="text-gray-500 italic">No events yet</div>
            ) : (
              logMessages.map((msg, idx) => (
                <div key={idx} className="pb-1">{msg}</div>
              ))
            )}
          </div>
        </div>
        
        <div className="flex justify-between">
          <Link href="/debug-tubes">
            <a className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">
              View Debug Page
            </a>
          </Link>
          
          <Link href="/minimal-player">
            <a className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">
              Go to Player
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TubeDebugPage;