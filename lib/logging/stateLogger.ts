/**
 * State Logger - Utility for debugging state issues
 * 
 * This logger helps diagnose state persistence issues by examining the state
 * of tubes, checking for inconsistencies, and logging them in a clear format.
 */

// Simple interface for tube data
interface TubeData {
  threadId?: string;
  currentStitchId?: string;
  position?: number;
  stitches?: any[];
}

// Simple interface for state data
interface StateData {
  tubes?: Record<string, TubeData>;
  activeTube?: number;
  activeTubeNumber?: number;
  userId?: string;
  lastUpdated?: string;
}

/**
 * Logs detailed information about state to help diagnose tube persistence issues
 * @param label Debug label to identify the log point
 * @param state The state object to analyze
 */
export function logStateDebug(label: string, state: StateData): void {
  console.group(`🔍 STATE ANALYSIS: ${label}`);
  
  try {
    if (!state) {
      console.log('❌ Empty or null state provided');
      console.groupEnd();
      return;
    }
    
    // Log basic tube information
    console.log(`Active tube: ${state.activeTube || state.activeTubeNumber || 'unknown'}`);
    console.log(`Last updated: ${state.lastUpdated || 'unknown'}`);
    
    // Check for tube/activeTube inconsistency
    if (state.activeTube !== state.activeTubeNumber) {
      console.warn(`⚠️ Inconsistency: activeTube (${state.activeTube}) != activeTubeNumber (${state.activeTubeNumber})`);
    }
    
    // Log detailed tube information
    if (state.tubes) {
      console.log('Tube Information:');
      
      Object.entries(state.tubes).forEach(([tubeNumber, tube]) => {
        console.group(`Tube ${tubeNumber}:`);
        console.log(`Thread ID: ${tube.threadId || 'none'}`);
        console.log(`Current Stitch ID: ${tube.currentStitchId || 'none'}`);
        console.log(`Position: ${tube.position || 0}`);
        
        // Analyze stitches
        if (tube.stitches && tube.stitches.length > 0) {
          console.log(`Stitches: ${tube.stitches.length}`);
          
          // Log position 0 stitch (should be the current stitch)
          const position0Stitch = tube.stitches.find(s => s.position === 0);
          if (position0Stitch) {
            console.log(`Position 0 stitch: ${position0Stitch.id}`);
            
            // Check if position 0 stitch matches currentStitchId
            if (position0Stitch.id !== tube.currentStitchId) {
              console.warn(`⚠️ Current stitch (${tube.currentStitchId}) != Position 0 stitch (${position0Stitch.id})`);
            }
          } else {
            console.warn(`⚠️ No stitch at position 0`);
          }
          
          // Count stitches at each position
          const positionCounts: Record<number, number> = {};
          tube.stitches.forEach(stitch => {
            const pos = stitch.position || 0;
            positionCounts[pos] = (positionCounts[pos] || 0) + 1;
          });
          
          // Check for position conflicts
          Object.entries(positionCounts).forEach(([position, count]) => {
            if (count > 1) {
              console.warn(`⚠️ Position ${position} has ${count} stitches (conflict!)`);
            }
          });
          
          // Find the highest position
          const maxPosition = Math.max(...tube.stitches.map(s => s.position || 0));
          console.log(`Highest position: ${maxPosition}`);
        } else {
          console.warn(`⚠️ No stitches in tube`);
        }
        
        console.groupEnd();
      });
    } else {
      console.warn('⚠️ No tubes in state');
    }
  } catch (error) {
    console.error('Error analyzing state:', error);
  }
  
  console.groupEnd();
}

/**
 * Compares local storage state with current state to find differences
 * that might explain persistence issues
 */
export function compareLocalStorageStates(): void {
  if (typeof window === 'undefined') return;
  
  console.group('🔍 LOCAL STORAGE STATE COMPARISON');
  
  try {
    // Get user ID
    const userId = localStorage.getItem('zenjin_user_id') ||
                  localStorage.getItem('zenjin_anonymous_id') || 
                  localStorage.getItem('anonymousId');
    
    if (!userId) {
      console.log('❌ No user ID found in localStorage');
      console.groupEnd();
      return;
    }
    
    console.log(`Analyzing states for user: ${userId}`);
    
    // Define all state keys to check
    const stateKeys = [
      `zenjin_state_${userId}`,
      'zenjin_anonymous_state',
      `triple_helix_state_${userId}`
    ];
    
    // Load and parse states
    const states: Record<string, any> = {};
    let statesFound = 0;
    
    stateKeys.forEach(key => {
      const stateJson = localStorage.getItem(key);
      if (stateJson) {
        try {
          states[key] = JSON.parse(stateJson);
          statesFound++;
          
          // Handle nested state in zenjin_anonymous_state
          if (key === 'zenjin_anonymous_state' && states[key].state) {
            states[key] = states[key].state;
          }
        } catch (e) {
          console.warn(`Cannot parse state from ${key}:`, e);
        }
      }
    });
    
    console.log(`Found ${statesFound} states in localStorage`);
    
    if (statesFound < 2) {
      // No comparison needed
      console.log('No multiple states to compare');
      console.groupEnd();
      return;
    }
    
    // Compare active tube values across states
    console.log('Active Tube Comparison:');
    Object.entries(states).forEach(([key, state]) => {
      const activeTube = state.activeTube || state.activeTubeNumber;
      console.log(`${key}: activeTube = ${activeTube}`);
    });
    
    // Check for conflicting active tube values
    const tubeDifferences = new Set(
      Object.values(states)
        .map(state => state.activeTube || state.activeTubeNumber)
        .filter(Boolean)
    );
    
    if (tubeDifferences.size > 1) {
      console.warn(`⚠️ CRITICAL: Different active tube values across states: ${Array.from(tubeDifferences).join(', ')}`);
    }
    
    // Compare last updated times
    console.log('Last Updated Comparison:');
    const timestamps: Record<string, number> = {};
    
    Object.entries(states).forEach(([key, state]) => {
      if (state.lastUpdated) {
        const timestamp = new Date(state.lastUpdated).getTime();
        timestamps[key] = timestamp;
        console.log(`${key}: lastUpdated = ${state.lastUpdated} (${new Date(timestamp).toLocaleTimeString()})`);
      }
    });
    
    // Find most recent state
    if (Object.keys(timestamps).length > 0) {
      const mostRecentKey = Object.entries(timestamps)
        .sort(([, a], [, b]) => b - a)[0][0];
      
      console.log(`Most recent state: ${mostRecentKey}`);
    }
  } catch (error) {
    console.error('Error comparing states:', error);
  }
  
  console.groupEnd();
}

/**
 * Logs the current localStorage state of active tubes for debugging
 */
export function logActiveTubeState(): void {
  if (typeof window === 'undefined') return;
  
  console.group('🧪 ACTIVE TUBE STATE');
  
  try {
    // Get user ID
    const userId = localStorage.getItem('zenjin_user_id') ||
                  localStorage.getItem('zenjin_anonymous_id') || 
                  localStorage.getItem('anonymousId');
    
    if (!userId) {
      console.log('❌ No user ID found in localStorage');
      console.groupEnd();
      return;
    }
    
    console.log(`Checking tube state for user: ${userId}`);
    
    // Check all possible state locations
    const mainState = localStorage.getItem(`zenjin_state_${userId}`);
    const anonState = localStorage.getItem('zenjin_anonymous_state');
    const tripleHelixState = localStorage.getItem(`triple_helix_state_${userId}`);
    
    // Extract active tube from main state
    if (mainState) {
      try {
        const parsed = JSON.parse(mainState);
        console.log(`Main state: activeTube=${parsed.activeTube}, activeTubeNumber=${parsed.activeTubeNumber}`);
      } catch (e) {
        console.warn('Cannot parse main state');
      }
    }
    
    // Extract active tube from anonymous state
    if (anonState) {
      try {
        const parsed = JSON.parse(anonState);
        if (parsed.state) {
          console.log(`Anonymous state: activeTube=${parsed.state.activeTube}, activeTubeNumber=${parsed.state.activeTubeNumber}`);
        }
      } catch (e) {
        console.warn('Cannot parse anonymous state');
      }
    }
    
    // Extract active tube from triple helix state
    if (tripleHelixState) {
      try {
        const parsed = JSON.parse(tripleHelixState);
        console.log(`Triple helix state: activeTube=${parsed.activeTube}, activeTubeNumber=${parsed.activeTubeNumber}`);
      } catch (e) {
        console.warn('Cannot parse triple helix state');
      }
    }
  } catch (error) {
    console.error('Error checking active tube state:', error);
  }
  
  console.groupEnd();
}