/**
 * Legacy State Adapter
 * 
 * This adapter provides a bridge between the legacy state management system
 * and the new Zustand-based state management, allowing for gradual migration.
 */
import useZenjinStore from './zenjinStore';
import { 
  UserInformation, TubeState, LearningProgress, 
  SessionData, ContentCollection, Tube
} from './types';

/**
 * Convert legacy tube format to Zustand format
 */
export function convertLegacyTubeFormat(legacyTubes: any): TubeState | null {
  if (!legacyTubes) return null;
  
  try {
    // Handle different legacy tube formats
    
    // Format 1: {1: {...}, 2: {...}, 3: {...}} with position and currentStitchId
    if (typeof legacyTubes === 'object' && !Array.isArray(legacyTubes)) {
      const tubeNumbers = Object.keys(legacyTubes)
        .filter(k => ['1', '2', '3'].includes(k))
        .map(k => parseInt(k, 10));
      
      if (tubeNumbers.length > 0) {
        // Create new tube state
        const tubeState: TubeState = {
          activeTube: 1, // Default
          tubes: {
            1: { stitchOrder: [], currentStitchId: '' },
            2: { stitchOrder: [], currentStitchId: '' },
            3: { stitchOrder: [], currentStitchId: '' }
          }
        };
        
        // Set active tube if available
        const activeTube = legacyTubes.activeTube || legacyTubes.activeTubeNumber || 1;
        tubeState.activeTube = activeTube as (1 | 2 | 3);
        
        // Convert each tube
        for (const tubeNum of [1, 2, 3]) {
          const legacyTube = legacyTubes[tubeNum];
          if (!legacyTube) continue;
          
          // Extract stitch order and current stitch
          let stitchOrder: string[] = [];
          let currentStitchId: string = '';
          
          // Format with stitches array
          if (Array.isArray(legacyTube.stitches)) {
            // Sort by position (or order_number)
            const sortedStitches = [...legacyTube.stitches].sort((a, b) => {
              const posA = a.position !== undefined ? a.position : (a.order_number || 0);
              const posB = b.position !== undefined ? b.position : (b.order_number || 0);
              return posA - posB;
            });
            
            // Extract stitch order
            stitchOrder = sortedStitches.map(s => s.id);
            
            // Get current stitch (either from currentStitchId or first in list)
            currentStitchId = legacyTube.currentStitchId || (stitchOrder.length > 0 ? stitchOrder[0] : '');
          }
          
          // Update tube state
          tubeState.tubes[tubeNum as (1 | 2 | 3)] = {
            stitchOrder,
            currentStitchId
          };
        }
        
        return tubeState;
      }
    }
    
    // Format 2: Array of tubes with number and activeStitches
    if (Array.isArray(legacyTubes)) {
      // Create new tube state
      const tubeState: TubeState = {
        activeTube: 1, // Default
        tubes: {
          1: { stitchOrder: [], currentStitchId: '' },
          2: { stitchOrder: [], currentStitchId: '' },
          3: { stitchOrder: [], currentStitchId: '' }
        }
      };
      
      // Process each tube in the array
      for (const legacyTube of legacyTubes) {
        const tubeNumber = legacyTube.number;
        if (![1, 2, 3].includes(tubeNumber)) continue;
        
        // Extract stitch order and current stitch
        let stitchOrder: string[] = [];
        let currentStitchId: string = '';
        
        // Format with activeStitches array
        if (Array.isArray(legacyTube.activeStitches)) {
          // Sort by position (or order_number)
          const sortedStitches = [...legacyTube.activeStitches].sort((a, b) => {
            const posA = a.orderNumber !== undefined ? a.orderNumber : (a.order_number || 0);
            const posB = b.orderNumber !== undefined ? b.orderNumber : (b.order_number || 0);
            return posA - posB;
          });
          
          // Extract stitch order
          stitchOrder = sortedStitches.map(s => s.id);
          
          // Get current stitch
          const activeStitch = sortedStitches.find(s => 
            (s.orderNumber === 0 || s.order_number === 0) || 
            (s.is_current_tube === true)
          );
          
          currentStitchId = activeStitch?.id || (stitchOrder.length > 0 ? stitchOrder[0] : '');
        }
        
        // Update tube state
        tubeState.tubes[tubeNumber as (1 | 2 | 3)] = {
          stitchOrder,
          currentStitchId
        };
      }
      
      return tubeState;
    }
    
    console.error('Unknown tube format:', legacyTubes);
    return null;
  } catch (error) {
    console.error('Error converting legacy tube format:', error);
    return null;
  }
}

/**
 * Convert legacy state format to Zustand store format
 */
export function convertLegacyStateToZustand(legacyState: any) {
  if (!legacyState) return null;
  
  try {
    // Extract user info
    const userInfo: UserInformation = {
      userId: legacyState.userId || legacyState.id || '',
      isAnonymous: (legacyState.userId || '').startsWith('anon') || (legacyState.userId || '').startsWith('anonymous'),
      displayName: legacyState.displayName || legacyState.name || 'User',
      email: legacyState.email || undefined,
      createdAt: legacyState.createdAt || new Date().toISOString(),
      lastActive: legacyState.lastActive || new Date().toISOString()
    };
    
    // Extract tube state
    const tubeState = convertLegacyTubeFormat(legacyState.tubes);
    
    // Extract learning progress
    const learningProgress: LearningProgress = {
      userId: userInfo.userId,
      totalTimeSpentLearning: legacyState.totalTimeSpent || 0,
      evoPoints: (legacyState.points?.lifetime || 0),
      evolutionLevel: legacyState.evolutionLevel || 1,
      currentBlinkSpeed: legacyState.blinkSpeed || 1,
      previousSessionBlinkSpeeds: legacyState.previousBlinkSpeeds || [],
      completedStitchesCount: legacyState.completedStitches?.length || 0,
      perfectScoreStitchesCount: 0 // Not tracked in legacy format
    };
    
    return {
      userInformation: userInfo,
      tubeState,
      learningProgress,
      // Other slices can be added as needed
      lastUpdated: legacyState.lastUpdated || new Date().toISOString()
    };
  } catch (error) {
    console.error('Error converting legacy state to Zustand:', error);
    return null;
  }
}

/**
 * Convert Zustand state to legacy format
 */
export function convertZustandToLegacyState() {
  const state = useZenjinStore.getState();
  
  // Create legacy state object
  const legacyState: any = {
    userId: state.userInformation?.userId || '',
    tubes: {},
    points: {
      session: state.learningProgress?.evoPoints || 0,
      lifetime: state.learningProgress?.evoPoints || 0
    },
    lastUpdated: state.lastUpdated,
    cycleCount: 0
  };
  
  // Convert tube state
  if (state.tubeState) {
    // Add active tube info
    legacyState.activeTube = state.tubeState.activeTube;
    legacyState.activeTubeNumber = state.tubeState.activeTube;
    
    // Convert tubes
    legacyState.tubes = {};
    for (const tubeNum of [1, 2, 3]) {
      const tube = state.tubeState.tubes[tubeNum as (1 | 2 | 3)];
      if (!tube) continue;
      
      // Create legacy tube format
      legacyState.tubes[tubeNum] = {
        threadId: `thread-T${tubeNum}-001`, // Default thread ID pattern
        currentStitchId: tube.currentStitchId,
        position: 0, // Default position
        stitches: tube.stitchOrder.map((stitchId, index) => ({
          id: stitchId,
          threadId: `thread-T${tubeNum}-001`,
          position: index,
          skipNumber: 3, // Default
          distractorLevel: 'L1' // Default
        }))
      };
    }
  }
  
  return legacyState;
}

/**
 * Update Zustand store from legacy state
 */
export function updateZustandFromLegacyState(legacyState: any) {
  if (!legacyState) return false;
  
  try {
    const convertedState = convertLegacyStateToZustand(legacyState);
    if (!convertedState) return false;
    
    const store = useZenjinStore.getState();
    
    // Update store with converted state
    if (convertedState.userInformation) {
      store.setUserInformation(convertedState.userInformation);
    }
    
    if (convertedState.tubeState) {
      store.setTubeState(convertedState.tubeState);
    }
    
    if (convertedState.learningProgress) {
      store.setLearningProgress(convertedState.learningProgress);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating Zustand from legacy state:', error);
    return false;
  }
}

/**
 * Initialize Zustand store from legacy state
 */
export function initializeZustandFromLegacy(legacyState: any) {
  // Check if already initialized
  const isInitialized = useZenjinStore.getState().isInitialized;
  
  if (legacyState && !isInitialized) {
    updateZustandFromLegacyState(legacyState);
    useZenjinStore.getState().initializeState({ isInitialized: true });
  }
}

/**
 * Get the legacy state format from Zustand store
 */
export function getLegacyState() {
  return convertZustandToLegacyState();
}

/**
 * Save state to server using both systems
 */
export async function saveStateToServer() {
  // Get current state in both formats
  const zustandState = useZenjinStore.getState();
  const legacyState = convertZustandToLegacyState();
  
  // First try to save using Zustand
  const zustandSuccess = await useZenjinStore.getState().syncToServer();
  
  // Then try the legacy API (if needed)
  // This can be removed once migration is complete
  let legacySuccess = true;
  if (!zustandSuccess) {
    try {
      // Use legacy API endpoint for compatibility
      const response = await fetch('/api/user-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ state: legacyState })
      });
      
      legacySuccess = response.ok;
    } catch (error) {
      console.error('Error saving legacy state to server:', error);
      legacySuccess = false;
    }
  }
  
  return zustandSuccess || legacySuccess;
}