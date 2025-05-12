/**
 * Anonymous User State Initialization
 * 
 * This module handles initializing an anonymous user's state with default positions.
 * It extracts all bundled content stitches and organizes them by tube and position.
 */

import { BUNDLED_FULL_CONTENT } from '../expanded-bundled-content';

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
}

interface UserState {
  userId: string;
  tubes: {
    [tubeNumber: string]: TubeState;
  };
  activeTubeNumber: number;
  lastUpdated: string;
}

/**
 * Initializes complete anonymous user state with all bundled content stitches
 * Properly structured for local storage and StateMachine
 * @param userId The anonymous user ID
 * @returns Prepared user state object
 */
export function initializeAnonymousUserState(userId: string): UserState {
  if (!userId) {
    throw new Error('User ID is required to initialize anonymous state');
  }

  console.log(`Initializing anonymous user state for user ID: ${userId}`);

  // Collect all stitches from bundled content and organize by tube
  const stitchesByTube: { [tubeNumber: string]: StitchPosition[] } = {
    1: [],
    2: [],
    3: []
  };

  // Extract all stitch IDs from bundled content
  const stitchIds = Object.keys(BUNDLED_FULL_CONTENT);
  console.log(`Found ${stitchIds.length} total stitches in bundled content`);

  // Process each stitch ID and organize by tube
  for (const stitchId of stitchIds) {
    // Extract tube number and stitch number from ID format: stitch-T{tube}-{thread}-{number}
    const match = stitchId.match(/stitch-T(\d+)-(\d+)-(\d+)/);
    if (!match) {
      console.warn(`Unrecognized stitch ID format: ${stitchId}`);
      continue;
    }

    const tubeNumber = match[1];
    const threadNumber = match[2];
    const stitchNumber = match[3];
    const threadId = `thread-T${tubeNumber}-${threadNumber}`;

    // Skip if tube is not 1, 2, or 3
    if (!['1', '2', '3'].includes(tubeNumber)) {
      console.warn(`Skipping stitch ${stitchId} with invalid tube number: ${tubeNumber}`);
      continue;
    }

    // Create stitch position object
    const stitchPosition: StitchPosition = {
      id: stitchId,
      threadId,
      position: parseInt(stitchNumber) - 1, // Convert to 0-based positions
      skipNumber: 1, // Start with skip number 1
      distractorLevel: 'L1' // Start with level 1 distractors
    };

    // Add to the appropriate tube
    stitchesByTube[tubeNumber].push(stitchPosition);
  }

  // Sort stitches within each tube by their position
  for (const tubeNumber in stitchesByTube) {
    stitchesByTube[tubeNumber].sort((a, b) => a.position - b.position);
    
    // Ensure positions are sequential starting from 0
    stitchesByTube[tubeNumber].forEach((stitch, index) => {
      stitch.position = index;
    });
  }

  // Build the complete user state
  const tubeStates: { [tubeNumber: string]: TubeState } = {};
  
  for (const tubeNumber in stitchesByTube) {
    const stitches = stitchesByTube[tubeNumber];
    if (stitches.length > 0) {
      // Find the first stitch in this tube
      const firstStitch = stitches.find(s => s.position === 0) || stitches[0];
      
      tubeStates[tubeNumber] = {
        threadId: firstStitch.threadId,
        stitches,
        currentStitchId: firstStitch.id
      };
    } else {
      // Fallback if no stitches found for this tube
      tubeStates[tubeNumber] = {
        threadId: `thread-T${tubeNumber}-001`,
        stitches: [],
        currentStitchId: ''
      };
    }
  }

  // Create the complete user state
  const userState: UserState = {
    userId,
    tubes: tubeStates,
    activeTubeNumber: 1, // Start with tube 1
    lastUpdated: new Date().toISOString()
  };

  // Log summary of created state
  console.log(`Anonymous user state initialized:`);
  for (const tubeNumber in userState.tubes) {
    console.log(`- Tube ${tubeNumber}: ${userState.tubes[tubeNumber].stitches.length} stitches, current stitch: ${userState.tubes[tubeNumber].currentStitchId}`);
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