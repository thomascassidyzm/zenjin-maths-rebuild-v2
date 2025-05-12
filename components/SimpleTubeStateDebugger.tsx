import React, { useEffect, useState } from 'react';

/**
 * A simplified, production-safe version of the tube state debugger
 * 
 * This component is designed to work in production environments without
 * causing hydration mismatches or React errors.
 */
const SimpleTubeStateDebugger: React.FC = () => {
  // Only render client-side
  const [isMounted, setIsMounted] = useState(false);
  const [userId, setUserId] = useState('');
  const [tubeInfo, setTubeInfo] = useState<any>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  useEffect(() => {
    // Mark component as mounted on client side
    setIsMounted(true);
    
    // Get user ID from localStorage
    const uid = localStorage.getItem('zenjin_user_id') ||
                localStorage.getItem('zenjin_anonymous_id') || 
                localStorage.getItem('anonymousId') || 'unknown';
    setUserId(uid);
    
    // Get tube info from various storage locations
    const stateInfo: any = {};
    
    // Check main state
    try {
      const mainState = localStorage.getItem(`zenjin_state_${uid}`);
      if (mainState) {
        const parsed = JSON.parse(mainState);
        stateInfo.main = {
          activeTube: parsed.activeTube || parsed.activeTubeNumber,
          lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated).toLocaleTimeString() : 'unknown',
          hasData: !!parsed
        };
      }
    } catch (e) {
      console.error('Error parsing main state:', e);
    }
    
    // Check anonymous state
    try {
      const anonState = localStorage.getItem('zenjin_anonymous_state');
      if (anonState) {
        const parsed = JSON.parse(anonState);
        if (parsed.state) {
          stateInfo.anon = {
            activeTube: parsed.state.activeTube || parsed.state.activeTubeNumber,
            lastUpdated: parsed.state.lastUpdated ? new Date(parsed.state.lastUpdated).toLocaleTimeString() : 'unknown',
            hasData: !!parsed.state
          };
        }
      }
    } catch (e) {
      console.error('Error parsing anonymous state:', e);
    }
    
    // Check triple helix state
    try {
      const tripleHelixState = localStorage.getItem(`triple_helix_state_${uid}`);
      if (tripleHelixState) {
        const parsed = JSON.parse(tripleHelixState);
        stateInfo.tripleHelix = {
          activeTube: parsed.activeTube || parsed.activeTubeNumber,
          lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated).toLocaleTimeString() : 'unknown',
          hasData: !!parsed
        };
      }
    } catch (e) {
      console.error('Error parsing triple helix state:', e);
    }
    
    setTubeInfo(stateInfo);
  }, []);
  
  if (!isMounted) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-800 rounded-lg p-3 shadow-lg text-white text-sm">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold">Tube State Debugger</h3>
          <button 
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="text-xs text-gray-400 hover:text-white"
          >
            {detailsOpen ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
        
        <div className="text-xs">
          <div className="text-gray-400 mb-1">User ID: {userId.substring(0, 8)}...</div>
          
          {Object.keys(tubeInfo).length === 0 ? (
            <div className="text-yellow-400">No tube state data found</div>
          ) : (
            <div className="space-y-1">
              {Object.entries(tubeInfo).map(([key, info]: [string, any]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-gray-300 capitalize">{key}:</span>
                  <span className={`font-mono font-medium ${
                    // Color coding for active tube numbers
                    info.activeTube === 1 ? 'text-blue-400' : 
                    info.activeTube === 2 ? 'text-green-400' : 
                    info.activeTube === 3 ? 'text-purple-400' : 
                    'text-red-400'
                  }`}>
                    Tube {info.activeTube}
                  </span>
                </div>
              ))}
            </div>
          )}
          
          {detailsOpen && (
            <div className="mt-3 pt-2 border-t border-gray-800">
              <div className="text-xs text-gray-400 mb-1">Storage Keys:</div>
              <div className="text-xs text-gray-300 space-y-0.5">
                {Object.keys(localStorage)
                  .filter(key => key.includes('state') || key.includes('tube'))
                  .map(key => (
                    <div key={key} className="text-xs truncate font-mono">
                      {key}
                    </div>
                  ))
                }
              </div>
              
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => {
                    // Set the continue flag for testing
                    localStorage.setItem('zenjin_continue_previous_state', 'true');
                    alert('Continue flag set to true');
                  }}
                  className="text-xs bg-indigo-700 hover:bg-indigo-600 px-2 py-1 rounded"
                >
                  Set Continue Flag
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleTubeStateDebugger;