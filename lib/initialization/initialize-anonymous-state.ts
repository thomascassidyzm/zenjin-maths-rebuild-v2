/**
 * Anonymous User State Initialization
 * 
 * This module handles initializing an anonymous user's state with default positions.
 * Creates a default state structure with empty tubes that will be filled via API.
 */

interface StitchPosition {
  id: string;
  threadId: string;
  position: number;
  skipNumber: number;
  distractorLevel: string;
}

interface TubeState {
  threadId: string;
  stitches: StitchPosition[];
  currentStitchId: string;
  positions?: { [position: number]: TubePosition };
  stitchOrder?: string[];
}

interface TubePosition {
  stitchId: string;
  skipNumber: number;
  distractorLevel: number | string;
  perfectCompletions: number;
  lastCompleted?: string;
}

interface UserState {
  userId: string;
  tubes: {
    [tubeNumber: string]: TubeState;
  };
  activeTube?: number;
  activeTubeNumber: number;
  lastUpdated: string;
}

// Default initial stitch IDs for each tube
const DEFAULT_INITIAL_STITCHES = {
  1: "stitch-T1-001-01",
  2: "stitch-T2-001-01",
  3: "stitch-T3-001-01"
};

// Default thread IDs for each tube
const DEFAULT_THREAD_IDS = {
  1: "thread-T1-001",
  2: "thread-T2-001",
  3: "thread-T3-001"
};

/**
 * Initializes minimal anonymous user state structure
 * Instead of using bundled content, this creates a skeleton state
 * that will be populated via API calls
 * 
 * @param userId The anonymous user ID
 * @returns Prepared minimal user state object
 */
export function initializeAnonymousUserState(userId: string): UserState {
  if (!userId) {
    throw new Error('User ID is required to initialize anonymous state');
  }

  console.log(`Initializing minimal anonymous user state for user ID: ${userId}`);

  // Build the user state with empty tubes
  const tubeStates: { [tubeNumber: string]: TubeState } = {};
  
  // Create basic structure for each tube (1, 2, 3)
  for (let tubeNumber = 1; tubeNumber <= 3; tubeNumber++) {
    const tubeKey = tubeNumber.toString();
    const initialStitchId = DEFAULT_INITIAL_STITCHES[tubeKey];
    const threadId = DEFAULT_THREAD_IDS[tubeKey];
    
    // Create an initial position for the first stitch
    const initialPosition: TubePosition = {
      stitchId: initialStitchId,
      skipNumber: 3,
      distractorLevel: 1,
      perfectCompletions: 0
    };
    
    // Create the tube state with both legacy and new position formats
    tubeStates[tubeKey] = {
      threadId,
      currentStitchId: initialStitchId,
      // Legacy format: array of stitch positions
      stitches: [{
        id: initialStitchId,
        threadId,
        position: 0,
        skipNumber: 3,
        distractorLevel: 'L1'
      }],
      // New format: positions map
      positions: {
        0: initialPosition
      },
      // Also include stitchOrder for compatibility
      stitchOrder: [initialStitchId]
    };
  }

  // Create the complete user state
  const userState: UserState = {
    userId,
    tubes: tubeStates,
    activeTube: 1,
    activeTubeNumber: 1, // Include both formats for compatibility
    lastUpdated: new Date().toISOString()
  };

  // Log summary of created state
  console.log(`Minimal anonymous user state initialized:`);
  for (const tubeNumber in userState.tubes) {
    console.log(`- Tube ${tubeNumber}: current stitch: ${userState.tubes[tubeNumber].currentStitchId}`);
  }

  return userState;
}

/**
 * Saves anonymous user state to local storage in all required formats
 * @param userId Anonymous user ID
 * @param state The user state to save
 */
export function saveAnonymousUserStateToLocalStorage(userId: string, state: UserState): void {
  if (typeof window === 'undefined') return;

  // Save state in the format expected by each storage method
  try {
    // Format 1: Direct state object in zenjin_state_XXX
    localStorage.setItem(`zenjin_state_${userId}`, JSON.stringify(state));
    
    // Format 2: State object in triple_helix_state_XXX
    localStorage.setItem(`triple_helix_state_${userId}`, JSON.stringify(state));
    
    // Format 3: Wrapped state object in zenjin_anonymous_state
    localStorage.setItem('zenjin_anonymous_state', JSON.stringify({ state }));
    
    console.log(`Successfully saved anonymous user state to all localStorage formats for user ${userId}`);
  } catch (error) {
    console.error('Failed to save anonymous user state to localStorage:', error);
  }
}

/**
 * Initializes and saves anonymous user state for a new anonymous user
 * @param userId Anonymous user ID
 * @returns The initialized user state
 */
export function initializeAndSaveAnonymousUserState(userId: string): UserState {
  // Initialize the state
  const state = initializeAnonymousUserState(userId);
  
  // Save to localStorage
  saveAnonymousUserStateToLocalStorage(userId, state);
  
  return state;
}