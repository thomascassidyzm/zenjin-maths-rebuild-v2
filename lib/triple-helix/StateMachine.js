/**
 * StateMachine.js - Enhanced version with predefined stitches
 * 
 * This version properly implements the stitch reordering logic for the Triple-Helix system.
 * It maintains a tube-based structure with predefined stitches that are reordered
 * rather than creating new stitches on the fly.
 * 
 * OFFLINE-FIRST IMPLEMENTATION:
 * - All state is managed client-side during the session
 * - localStorage is used for state persistence between page refreshes
 * - No server communication is needed during the learning session
 * - State is only sent to the server at explicit session end
 */

// CRITICAL FIX: Import the stitch loader to ensure we always have the next stitch available
const stitchLoader = require('../stitch-loader');

class StateMachine {
  constructor(initialState = {}) {
    // Default state with empty tube structure - no sample content
    this.state = {
      userId: initialState.userId || 'anonymous',
      activeTubeNumber: 1,
      cycleCount: 0,
      tubes: {
        1: { 
          threadId: null,
          currentStitchId: null,
          position: 0,
          stitches: []
        },
        2: { 
          threadId: null,
          currentStitchId: null,
          position: 0,
          stitches: []
        },
        3: { 
          threadId: null,
          currentStitchId: null,
          position: 0,
          stitches: []
        }
      },
      completedStitches: [],
      totalPoints: 0,
      last_updated: Date.now() // Add timestamp for synchronization
    };
    
    // Override with provided state
    if (initialState) {
      console.log('Initializing StateMachine with provided state');
      this.state = {
        ...this.state,
        ...initialState,
        tubes: {
          ...this.state.tubes,
          ...(initialState.tubes || {})
        }
      };
    }
    
    // REVISED SYNC MODEL: Different handling for anonymous vs authenticated users
    const isAnonymousUser = this.state.userId === 'anonymous' || this.state.userId.startsWith('anonymous-');
    
    // For anonymous users we preserve localStorage state, for authenticated we prioritize server
    if (isAnonymousUser) {
      console.log('Anonymous user detected - preserving localStorage state when available');
      
      // For anonymous users, check localStorage first as they don't have server state
      if (typeof window !== 'undefined') {
        try {
          const savedState = localStorage.getItem(`triple_helix_state_${this.state.userId}`);
          
          if (savedState) {
            console.log('Found existing state in localStorage for anonymous user');
            
            // Try to parse and validate the saved state
            try {
              const parsedState = JSON.parse(savedState);
              
              // Basic validation - make sure the state has valid structure
              const isValidState = 
                parsedState && 
                parsedState.tubes && 
                typeof parsedState.activeTubeNumber === 'number' &&
                [1, 2, 3].includes(parsedState.activeTubeNumber) &&
                Object.keys(parsedState.tubes).some(tubeNum => 
                  parsedState.tubes[tubeNum] && 
                  Array.isArray(parsedState.tubes[tubeNum].stitches) &&
                  parsedState.tubes[tubeNum].stitches.length > 0
                );
              
              if (isValidState) {
                // Use the localStorage state for anonymous users
                console.log('Valid state found in localStorage for anonymous user - using it');
                this.state = parsedState;
                
                // Continue using initial state in parallel if provided - helps with new stitches
                if (initialState && initialState.tubes) {
                  console.log('Merging initialState data with localStorage state for anonymous user');
                  
                  // Merge in any new content from initialState, preserving positions from localStorage
                  Object.entries(initialState.tubes).forEach(([tubeNum, tubData]) => {
                    if (!this.state.tubes[tubeNum] || !this.state.tubes[tubeNum].stitches) {
                      // If we don't have this tube, just use the initialState version
                      this.state.tubes[tubeNum] = tubData;
                    } else if (tubData.stitches && tubData.stitches.length > 0) {
                      // Merge in any new stitches from initialState
                      const existingStitchIds = new Set(this.state.tubes[tubeNum].stitches.map(s => s.id));
                      const newStitches = tubData.stitches.filter(s => !existingStitchIds.has(s.id));
                      
                      if (newStitches.length > 0) {
                        console.log(`Adding ${newStitches.length} new stitches to tube ${tubeNum}`);
                        this.state.tubes[tubeNum].stitches.push(...newStitches);
                      }
                    }
                  });
                }
              } else {
                console.warn('Invalid state found in localStorage for anonymous user - ignoring');
                // Remove invalid state to avoid future failures
                localStorage.removeItem(`triple_helix_state_${this.state.userId}`);
                
                // Use the default state or initialState for anonymous user
                if (initialState && initialState.tubes) {
                  console.log('Using initialState for anonymous user (fallback)');
                }
              }
            } catch (parseError) {
              console.warn('Could not parse state from localStorage for anonymous user', parseError);
              // Remove invalid state
              localStorage.removeItem(`triple_helix_state_${this.state.userId}`);
            }
          }
        } catch (err) {
          console.warn('Could not load state from localStorage for anonymous user', err);
        }
      }
    } else {
      // For authenticated users, prioritize server state (initialState)
      
      // First, check if initialState is present
      if (initialState && initialState.tubes) {
        console.log('Authenticated user detected - checking for state to use');
        
        // CRITICAL FIX: Check if we're in the middle of an anonymous-to-auth transition
        let isInTransfer = false;
        if (typeof window !== 'undefined') {
          try {
            isInTransfer = localStorage.getItem('zenjin_auth_transfer_in_progress') === 'true';
          } catch (err) {
            console.warn('Could not check transfer status:', err);
          }
        }
        
        // IMPORTANT: Only clear localStorage and enforce server state if NOT in a transfer
        if (!isInTransfer) {
          console.log('Using server state as source of truth (no transfer in progress)');
          
          // Clear any existing localStorage state to ensure we always use server state
          if (typeof window !== 'undefined') {
            try {
              // Clear the previous state from localStorage
              localStorage.removeItem(`triple_helix_state_${this.state.userId}`);
              console.log('Cleared existing localStorage state for authenticated user');
            } catch (err) {
              console.warn('Could not clear localStorage state for authenticated user', err);
            }
          }
        } else {
          console.log('IMPORTANT: Transfer in progress - preserving localStorage state');
        }
        
        // Server state is already set from initialState earlier in constructor
        // No need to do anything further
        
        // Set timestamp if missing
        if (!this.state.last_updated) {
          this.state.last_updated = Date.now();
          console.log('Added missing timestamp to server state:', this.state.last_updated);
        }
      } else {
        console.log('No server state available for authenticated user - using default initialized state');
        
        // Set timestamp on new state
        this.state.last_updated = Date.now();
      }
    }
    
    // Set timestamp if missing
    if (!this.state.last_updated) {
      this.state.last_updated = Date.now();
      console.log('Added missing timestamp to state:', this.state.last_updated);
    }
    // Otherwise use default state already initialized
  }
  
  // Get current state (deep copy to prevent mutations)
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }
  
  // Get current tube number
  getCurrentTubeNumber() {
    return this.state.activeTubeNumber;
  }
  
  // Get info about a specific tube
  getTube(tubeNumber) {
    return this.state.tubes[tubeNumber] || null;
  }
  
  // Get stitches for a specific tube
  getStitchesForTube(tubeNumber) {
    const tube = this.state.tubes[tubeNumber];
    return tube?.stitches || [];
  }
  
  // Get thread for a tube
  getThreadForTube(tubeNumber) {
    const tube = this.state.tubes[tubeNumber];
    return tube ? tube.threadId : null;
  }
  
  // Get current stitch
  getCurrentStitch() {
    const tubeNumber = this.state.activeTubeNumber;
    const tube = this.state.tubes[tubeNumber];
    
    if (!tube) return null;
    
    // ENHANCEMENT: Check for position conflicts when getting the current stitch
    // This ensures conflicts are caught and fixed before they can cause content loading issues
    if (tube.stitches && tube.stitches.length > 0) {
      // Create a temporary map to check for position conflicts
      const positions = {};
      let hasConflicts = false;
      
      tube.stitches.forEach(s => {
        if (positions[s.position]) {
          hasConflicts = true;
        } else {
          positions[s.position] = s.id;
        }
      });
      
      // If conflicts found, normalize positions
      if (hasConflicts) {
        console.warn(`Detected position conflicts in tube ${tubeNumber} during getCurrentStitch - normalizing positions`);
        this._normalizeStitchPositions(tube);
        
        // Re-fetch the current stitch after normalization
        const updatedCurrentStitch = tube.stitches.find(s => s.id === tube.currentStitchId);
        if (updatedCurrentStitch) {
          return {
            ...updatedCurrentStitch,
            tubeNumber
          };
        }
      }
    }
    
    // Find the current stitch in the stitches array
    const currentStitch = tube.stitches.find(s => s.id === tube.currentStitchId);
    
    if (!currentStitch) return null;
    
    return {
      ...currentStitch,
      tubeNumber
    };
  }
  
  // Get all stitches for the current tube
  getCurrentTubeStitches() {
    const tubeNumber = this.state.activeTubeNumber;
    const tube = this.state.tubes[tubeNumber];
    
    if (!tube || !tube.stitches) return [];
    
    return [...tube.stitches].sort((a, b) => a.position - b.position);
  }
  
  // Cycle to next tube
  cycleTubes() {
    const prevTube = this.state.activeTubeNumber;
    
    // Cycle 1->2->3->1
    // CRITICAL FIX: Force proper cycling through all tubes
    if (prevTube === 1) {
      this.state.activeTubeNumber = 2;
      console.log('FIXED CYCLING: Moving from Tube 1 to Tube 2');
    } else if (prevTube === 2) {
      this.state.activeTubeNumber = 3;
      console.log('FIXED CYCLING: Moving from Tube 2 to Tube 3');
      
      // CRITICAL: Ensure tube 3 exists and has stitches
      if (!this.state.tubes[3] || !this.state.tubes[3].stitches || !this.state.tubes[3].stitches.length) {
        console.error('CRITICAL ERROR: Tube 3 missing or empty during cycle!');
        // Instead of creating emergency content, return to tube 1
        console.log('Returning to tube 1 due to missing tube 3 content');
        this.state.activeTubeNumber = 1;
        return this.getCurrentStitch();
      }
    } else if (prevTube === 3) {
      this.state.activeTubeNumber = 1;
      console.log('FIXED CYCLING: Moving from Tube 3 to Tube 1');
      this.state.cycleCount = (this.state.cycleCount || 0) + 1;
    } else {
      // Fallback in case of invalid tube number
      console.error(`Invalid tube number ${prevTube}, resetting to 1`);
      this.state.activeTubeNumber = 1;
    }
    
    const nextTube = this.state.activeTubeNumber;
    console.log(`Cycled from tube ${prevTube} to tube ${nextTube}`);
    
    // Make sure the current tube has a valid current stitch
    const currentTube = this.state.tubes[nextTube];
    if (!currentTube || !currentTube.stitches || currentTube.stitches.length === 0) {
      console.error(`CRITICAL ERROR: Tube ${nextTube} has no stitches!`);
    } else if (!currentTube.currentStitchId || 
               !currentTube.stitches.find(s => s.id === currentTube.currentStitchId)) {
      console.log(`Fixing missing currentStitchId in tube ${nextTube}`);
      // Set the first stitch as the current one
      const firstStitch = [...currentTube.stitches].sort((a, b) => a.position - b.position)[0];
      if (firstStitch) {
        currentTube.currentStitchId = firstStitch.id;
        console.log(`Set current stitch to ${firstStitch.id}`);
      }
    }
    
    // Save state
    this._saveState();
    
    return this.getCurrentStitch();
  }
  
  // Handle stitch completion
  handleStitchCompletion(threadId, stitchId, score, totalQuestions) {
    console.log(`Handling stitch completion: ${stitchId} from thread ${threadId} with score ${score}/${totalQuestions}`);
    
    // First check for tube number directly from thread ID format (thread-T{tubeNum}-)
    let tubeNumber = null;
    const threadMatch = threadId.match(/thread-T(\d+)-/);
    if (threadMatch && threadMatch[1]) {
      tubeNumber = parseInt(threadMatch[1]);
      console.log(`Extracted tube number ${tubeNumber} from thread ID ${threadId}`);
      
      // If the tube doesn't have this thread ID assigned yet, fix it
      if (this.state.tubes[tubeNumber] && this.state.tubes[tubeNumber].threadId !== threadId) {
        // Only update if there's a stitch with this thread ID
        const hasStitchWithThreadId = this.state.tubes[tubeNumber].stitches?.some(s => s.threadId === threadId);
        if (hasStitchWithThreadId) {
          console.log(`Updating tube ${tubeNumber} thread ID from ${this.state.tubes[tubeNumber].threadId} to ${threadId}`);
          this.state.tubes[tubeNumber].threadId = threadId;
        }
      }
    }
    
    // If we couldn't get tube from thread ID format, search through tubes
    if (!tubeNumber) {
      for (const [tubNum, tube] of Object.entries(this.state.tubes)) {
        // Check thread ID match
        if (tube.threadId === threadId) {
          tubeNumber = parseInt(tubNum);
          break;
        }
        
        // Also check if any stitch has this thread ID
        if (tube.stitches?.some(s => s.threadId === threadId)) {
          tubeNumber = parseInt(tubNum);
          console.log(`Found thread ${threadId} through stitch in tube ${tubeNumber}`);
          break;
        }
      }
    }
    
    if (!tubeNumber) {
      console.error(`Thread ${threadId} not found in any tube`);
      
      // Try to extract tube number from thread ID as last resort
      if (threadId.includes('T1-')) {
        tubeNumber = 1;
      } else if (threadId.includes('T2-')) {
        tubeNumber = 2;
      } else if (threadId.includes('T3-')) {
        tubeNumber = 3;
      }
      
      if (tubeNumber) {
        console.log(`Assigning thread ${threadId} to tube ${tubeNumber} based on naming convention`);
        // Update the tube's thread ID
        if (this.state.tubes[tubeNumber]) {
          this.state.tubes[tubeNumber].threadId = threadId;
        } else {
          return null; // Tube doesn't exist
        }
      } else {
        return null; // Couldn't find or assign tube
      }
    }
    
    const tube = this.state.tubes[tubeNumber];
    
    // Find the stitch in the tube
    const stitchIndex = tube.stitches.findIndex(s => s.id === stitchId);
    
    if (stitchIndex === -1) {
      console.error(`Stitch ${stitchId} not found in tube ${tubeNumber}`);
      return null;
    }
    
    // Update stitch with completion information
    tube.stitches[stitchIndex].completed = true;
    tube.stitches[stitchIndex].score = score;
    tube.stitches[stitchIndex].totalQuestions = totalQuestions;
    tube.stitches[stitchIndex].completedAt = Date.now();
    
    // Record completion
    this.state.completedStitches.push({
      stitchId, 
      threadId, 
      score, 
      totalQuestions,
      timestamp: Date.now()
    });
    
    // Add raw points without any bonus multiplier
    // Simply add the score directly to totalPoints - all bonuses are applied at session end
    // For each correct answer in the stitch, add 1 point (no multiplier)
    this.state.totalPoints = (this.state.totalPoints || 0) + score;
    
    // Check for perfect score
    const isPerfectScore = score === totalQuestions;
    
    if (isPerfectScore) {
      console.log(`Perfect score achieved (${score}/${totalQuestions}) for stitch ${stitchId}`);
      
      // Update skip number and distractor level
      const currentStitch = tube.stitches[stitchIndex];
      
      // Progress skip number: 1 -> 3 -> 5 -> 10 -> 25 -> 100
      if (currentStitch.skipNumber === 1) currentStitch.skipNumber = 3;
      else if (currentStitch.skipNumber === 3) currentStitch.skipNumber = 5;
      else if (currentStitch.skipNumber === 5) currentStitch.skipNumber = 10;
      else if (currentStitch.skipNumber === 10) currentStitch.skipNumber = 25;
      else if (currentStitch.skipNumber === 25) currentStitch.skipNumber = 100;
      else currentStitch.skipNumber = 100; // Max value
      
      console.log(`Updated skip number to ${currentStitch.skipNumber}`);
      
      // Progress distractor level on ratchet: L1 -> L2 -> L3
      if (currentStitch.distractorLevel === 'L1') currentStitch.distractorLevel = 'L2';
      else if (currentStitch.distractorLevel === 'L2') currentStitch.distractorLevel = 'L3';
      // L3 is max level
      
      console.log(`Updated distractor level to ${currentStitch.distractorLevel}`);
      
      // Advance stitch in the tube
      this.advanceStitchInTube(tubeNumber);
    } else {
      // For non-perfect scores, reset the skip number to 1
      tube.stitches[stitchIndex].skipNumber = 1;
      console.log(`Non-perfect score (${score}/${totalQuestions}) - reset skip number to 1`);
      
      // Note: We do NOT reset distractor level as it's on a ratchet
    }
    
    // Save state
    this._saveState();
    
    return this.getCurrentStitch();
  }
  
  /**
   * Advance to a new stitch with proper reordering based on spaced repetition
   * 
   * This method handles the core functionality of the Triple Helix spaced repetition system:
   * 1. The current stitch (position 0) is moved back by its skip number
   * 2. The next stitch (position 1) becomes the new active stitch (moves to position 0)
   * 3. All other stitches maintain their relative ordering
   * 
   * POSITION HANDLING DETAILS:
   * - Positions are virtual and dynamically assigned (not pre-allocated)
   * - If a stitch's skip number exceeds available positions, it gets the highest position
   * - Position -1 is used temporarily during reordering to avoid conflicts
   * - Position 0 is always the active stitch, position 1 is always next
   * 
   * @param {number} tubeNumber - The number of the tube to advance (1, 2, or 3)
   * @returns {Object|null} The new current stitch or null if error
   */
  advanceStitchInTube(tubeNumber) {
    const tube = this.state.tubes[tubeNumber];
    if (!tube || !tube.stitches || tube.stitches.length === 0) {
      console.error(`CRITICAL ERROR: Cannot advance stitch in tube ${tubeNumber} - tube not found or no stitches`);
      return null;
    }
    
    console.log(`Beginning stitch advancement in tube ${tubeNumber}`);

    // ENHANCED APPROACH: First, normalize all positions to ensure uniqueness
    this._normalizeStitchPositions(tube);

    // Find current stitch
    const currentStitchIndex = tube.stitches.findIndex(s => s.id === tube.currentStitchId);
    if (currentStitchIndex === -1) {
      console.error(`CRITICAL ERROR: Current stitch ${tube.currentStitchId} not found in tube ${tubeNumber}`);
      
      // Try to recover by setting first stitch as current
      if (tube.stitches.length > 0) {
        // Find stitch at position 0 or lowest position
        const sortedStitches = [...tube.stitches].sort((a, b) => a.position - b.position);
        tube.currentStitchId = sortedStitches[0].id;
        console.log(`RECOVERY: Setting first stitch ${sortedStitches[0].id} as current stitch`);
        return this.getCurrentStitch();
      }
      
      return null;
    }
    
    const currentStitch = tube.stitches[currentStitchIndex];
    
    // Get the current stitch's skip number
    const skipNumber = currentStitch.skipNumber || 3;
    console.log(`Current stitch (${currentStitch.id}) has skip number ${skipNumber}`);
    
    // Print the full list of stitches for comprehensive debugging
    console.log('DETAILED DEBUG: Full list of stitches before reordering:');
    const stitchesBeforeReordering = [...tube.stitches].sort((a, b) => a.position - b.position);
    stitchesBeforeReordering.slice(0, 10).forEach(s => {
      console.log(`  Stitch ${s.id}: Position=${s.position}, Skip=${s.skipNumber}, Active=${s.id === tube.currentStitchId}`);
    });
    
    // IMPROVED APPROACH: Completely rebuild the position order using a positions registry
    // This is a more thorough approach than patching existing positions
    
    // Step 1: Create a comprehensive mapping of current positions to stitches
    const positionToStitches = new Map();
    tube.stitches.forEach(stitch => {
      if (!positionToStitches.has(stitch.position)) {
        positionToStitches.set(stitch.position, []);
      }
      positionToStitches.get(stitch.position).push(stitch);
    });
    
    // Step 2: Create a fresh position registry - this will be our source of truth
    const positionRegistry = new Set();
    
    // Step 3: Verify current stitch is at position 0 (should always be the case after normalization)
    if (currentStitch.position !== 0) {
      console.warn(`Current stitch ${currentStitch.id} is not at position 0, fixing...`);
      
      // Find any stitch that's currently at position 0
      const existingPosition0 = tube.stitches.find(s => s.position === 0 && s.id !== currentStitch.id);
      if (existingPosition0) {
        // Mark its position for update later
        existingPosition0._needsPositionUpdate = true;
      }
      
      // Place current stitch at position 0
      currentStitch.position = 0;
      console.log(`Moved current stitch ${currentStitch.id} to position 0`);
    }
    
    // Step 4: Get the next stitch that should become active (position 1 -> position 0)
    let nextStitch = null;
    const position1Stitches = positionToStitches.get(1) || [];
    
    if (position1Stitches.length > 0) {
      // Take the first stitch at position 1
      nextStitch = position1Stitches[0];
      console.log(`Found next stitch ${nextStitch.id} at position 1`);
    } else {
      // If no stitch at position 1, find the one with lowest position > 0
      const candidateStitches = [...tube.stitches]
        .filter(s => s.position > 0 && s.id !== currentStitch.id)
        .sort((a, b) => a.position - b.position);
      
      if (candidateStitches.length > 0) {
        nextStitch = candidateStitches[0];
        console.log(`No stitch at position 1, using next lowest position stitch: ${nextStitch.id} at position ${nextStitch.position}`);
      } else {
        console.error(`CRITICAL ERROR: No next stitch available in tube ${tubeNumber}`);
        
        // CRITICAL FIX: Try to load the next stitch from bundled content
        console.log(`RECOVERY: Attempting to load next stitch for ${currentStitch.id} from bundled content`);
        const nextStitch = stitchLoader.getNextStitchFromBundle(currentStitch);
        
        if (nextStitch) {
          // Add the new stitch to the tube
          console.log(`RECOVERY: Found next stitch ${nextStitch.id} in bundled content`);
          tube.stitches.push(nextStitch);
          
          // Update position registry
          positionRegistry.add(0); // Current stitch stays at position 0
          positionRegistry.add(1); // New stitch at position 1
          
          // Save state
          this._saveState();
          
          // Return the next stitch
          console.log(`RECOVERY: Successfully loaded next stitch ${nextStitch.id} at position 1`);
          return nextStitch;
        }
        
        // If we get here, we couldn't load the next stitch from bundled content
        // Create a recovery situation by keeping current stitch at position 0
        positionRegistry.add(0);
        console.log(`RECOVERY: Keeping current stitch ${currentStitch.id} at position 0`);
        
        // Try to load all stitches for this thread as a last resort
        const allStitches = stitchLoader.getAllStitchesForThread(tubeNumber, currentStitch.threadId);
        if (allStitches.length > 1) {
          console.log(`RECOVERY: Loaded ${allStitches.length} stitches for tube ${tubeNumber}`);
          
          // Add all stitches to the tube
          for (const stitch of allStitches) {
            // Only add if not already in tube
            if (!tube.stitches.some(s => s.id === stitch.id)) {
              tube.stitches.push(stitch);
            }
          }
          
          // Try to find a stitch at position 1
          const position1Stitch = tube.stitches.find(s => s.position === 1);
          if (position1Stitch) {
            console.log(`RECOVERY: Found stitch ${position1Stitch.id} at position 1`);
            
            // Save state
            this._saveState();
            
            // Return the position 1 stitch
            return position1Stitch;
          }
        }
        
        // Save state and return current stitch as last resort
        this._saveState();
        return this.getCurrentStitch();
      }
    }
    
    // Step 5: Assign new positions methodically to prevent any conflicts
    
    // 5a. First, assign position 0 to the new active stitch
    nextStitch.position = 0;
    tube.currentStitchId = nextStitch.id;
    positionRegistry.add(0);
    console.log(`Assigned position 0 to new active stitch ${nextStitch.id}`);
    
    // 5b. Build a list of all stitches that need positions assigned
    // Exclude the next stitch (now at position 0) and the completed stitch (will go to skipNumber)
    const stitchesNeedingPositions = tube.stitches.filter(s => 
      s.id !== nextStitch.id && 
      s.id !== currentStitch.id
    );
    
    // 5c. Sort by original position to maintain relative order as much as possible
    stitchesNeedingPositions.sort((a, b) => a.position - b.position);
    
    // 5d. Assign positions 1 through N (except skipNumber which is reserved)
    // IMPORTANT: Positions are virtual and dynamically assigned - not pre-allocated
    let positionCounter = 1;
    stitchesNeedingPositions.forEach(stitch => {
      const oldPosition = stitch.position;
      
      // Find next available position that isn't skipNumber
      while (positionCounter === skipNumber || positionRegistry.has(positionCounter)) {
        positionCounter++;
      }
      
      // Assign position and mark as used
      stitch.position = positionCounter;
      positionRegistry.add(positionCounter);
      
      console.log(`Assigned position ${positionCounter} to stitch ${stitch.id} (was ${oldPosition})`);
      positionCounter++;
    });
    
    // 5e. Finally, place the completed stitch at skipNumber position
    // POSITION COMPRESSION: If skipNumber exceeds available positions,
    // the stitch will get the highest position value that's available
    const maxPosition = Math.max(...Array.from(positionRegistry));
    const actualPosition = skipNumber > tube.stitches.length ? maxPosition + 1 : skipNumber;
    
    currentStitch.position = actualPosition;
    positionRegistry.add(actualPosition);
    console.log(`Placed completed stitch ${currentStitch.id} at position ${actualPosition}` + 
                (actualPosition !== skipNumber ? ` (compressed from ${skipNumber})` : ''));
    
    // Step 6: Verification - ALL stitches must have unique positions
    const positionCheck = new Set();
    let hasPositionConflict = false;
    
    tube.stitches.forEach(stitch => {
      if (positionCheck.has(stitch.position)) {
        console.error(`VERIFICATION FAILED: Position ${stitch.position} is assigned to multiple stitches`);
        hasPositionConflict = true;
      }
      positionCheck.add(stitch.position);
    });
    
    // If there's a conflict, run complete position normalization
    if (hasPositionConflict) {
      console.warn(`Running emergency position normalization to resolve conflicts`);
      this._normalizeStitchPositions(tube, true);
    }
    
    // Step 7: Increment the tube position counter
    tube.position = (tube.position || 0) + 1;
    console.log(`Incremented tube position to ${tube.position}`);
    
    // Log the new stitch order (for debugging)
    const sortedStitches = [...tube.stitches].sort((a, b) => a.position - b.position);
    console.log('DETAILED DEBUG: New stitch order after reordering:');
    sortedStitches.slice(0, 10).forEach(s => {
      console.log(`Position ${s.position}: Stitch ${s.id} (Skip=${s.skipNumber}, Active=${s.id === tube.currentStitchId})`);
    });
    
    // Save state
    this._saveState();
    
    return this.getCurrentStitch();
  }

  /**
   * Normalize stitch positions to ensure uniqueness
   * 
   * This method ensures all stitches have unique positions and fixes any conflicts.
   * Positions are treated as first-class citizens, meaning the system enforces 
   * one-to-one mapping between positions and stitches.
   * 
   * Key concepts:
   * 1. Each position can only contain ONE stitch
   * 2. Temporary position -1 is used during reordering to avoid conflicts
   * 3. Position compression happens automatically when skip numbers exceed available slots
   *    (e.g., if there are 50 stitches and a skip number is 100, the stitch will get 
   *    the highest available position, NOT literally position 100)
   * 4. Position 0 is ALWAYS the active stitch
   * 
   * @param {Object} tube - The tube object containing stitches
   * @param {boolean} forceRebuild - If true, completely rebuild all positions sequentially
   * @private
   */
  _normalizeStitchPositions(tube, forceRebuild = false) {
    console.log(`Normalizing stitch positions for tube (forceRebuild: ${forceRebuild})`);
    
    if (!tube || !tube.stitches || tube.stitches.length === 0) {
      console.warn('Cannot normalize positions: tube is empty or invalid');
      return;
    }
    
    // Find current stitch (should be at position 0)
    const currentStitchId = tube.currentStitchId;
    const currentStitch = tube.stitches.find(s => s.id === currentStitchId);
    
    // First fix: If multiple stitches at position 0, keep only the currentStitch there
    const position0Stitches = tube.stitches.filter(s => s.position === 0);
    
    if (position0Stitches.length > 1) {
      console.warn(`FIXING: Found ${position0Stitches.length} stitches at position 0`);
      
      // Which stitch should stay at position 0?
      let keepStitchId = currentStitchId;
      
      // If current stitch doesn't exist or isn't at position 0, pick one
      if (!currentStitch || currentStitch.position !== 0) {
        keepStitchId = position0Stitches[0].id;
        console.log(`Current stitch not at position 0, keeping ${keepStitchId} at position 0`);
      }
      
      // Move all others to temporary negative positions
      // This temporary position (-1) is a key part of our approach - it serves as
      // a "holding area" to prevent conflicts during reordering and ensures positions
      // remain first-class citizens (one stitch per position)
      position0Stitches.forEach(stitch => {
        if (stitch.id !== keepStitchId) {
          stitch.position = -1; // Temporary position, will be fixed later
          console.log(`Temporarily moved stitch ${stitch.id} from position 0 to -1`);
        }
      });
    }
    
    // If current stitch exists but isn't at position 0, fix it
    if (currentStitch && currentStitch.position !== 0) {
      // Find what's currently at position 0
      const existingPosition0 = tube.stitches.find(s => s.position === 0);
      
      if (existingPosition0) {
        // Move it to temporary position
        existingPosition0.position = -1;
        console.log(`Temporarily moved stitch ${existingPosition0.id} from position 0 to -1`);
      }
      
      // Move current stitch to position 0
      currentStitch.position = 0;
      console.log(`Moved current stitch ${currentStitch.id} to position 0`);
    }
    
    // If we don't have a current stitch or it's not at position 0 yet
    if (!currentStitch) {
      console.warn('No current stitch found, selecting one');
      
      // Is any stitch at position 0?
      const position0Stitch = tube.stitches.find(s => s.position === 0);
      
      if (position0Stitch) {
        // Update currentStitchId to match
        tube.currentStitchId = position0Stitch.id;
        console.log(`Updated current stitch ID to ${position0Stitch.id}`);
      } else if (tube.stitches.length > 0) {
        // Pick stitch with lowest position
        const sortedStitches = [...tube.stitches].sort((a, b) => a.position - b.position);
        tube.currentStitchId = sortedStitches[0].id;
        sortedStitches[0].position = 0;
        console.log(`Set stitch ${sortedStitches[0].id} as current stitch at position 0`);
      }
    }
    
    // If forceRebuild is true, recreate all positions sequentially
    if (forceRebuild) {
      console.log('Performing complete position rebuild');
      
      // First, find the current stitch (which should be at position 0)
      const currentStitchId = tube.currentStitchId;
      const currentStitch = tube.stitches.find(s => s.id === currentStitchId);
      
      // Collect all other stitches
      const otherStitches = tube.stitches.filter(s => s.id !== currentStitchId);
      
      // Sort them by current position to maintain relative order
      otherStitches.sort((a, b) => a.position - b.position);
      
      // Assign positions 1, 2, 3... to all other stitches
      otherStitches.forEach((stitch, index) => {
        const oldPosition = stitch.position;
        stitch.position = index + 1;
        console.log(`Rebuild: Moved stitch ${stitch.id} from position ${oldPosition} to ${stitch.position}`);
      });
      
      // Make sure current stitch is at position 0
      if (currentStitch) {
        currentStitch.position = 0;
      }
      
      return; // We're done with complete rebuild
    }
    
    // Normal mode: Only fix conflicts instead of complete rebuild
    
    // Find all positions with more than one stitch
    const positionCounts = {};
    tube.stitches.forEach(s => {
      if (!positionCounts[s.position]) {
        positionCounts[s.position] = [];
      }
      positionCounts[s.position].push(s.id);
    });
    
    // Track positions that are already used
    const usedPositions = new Set();
    usedPositions.add(0); // Position 0 is always reserved for current stitch
    
    // Fix conflicted positions and negative positions
    for (const [position, stitchIds] of Object.entries(positionCounts)) {
      // Skip position 0 which was already handled
      if (position === '0') continue;
      
      // Fix negative positions
      if (parseInt(position) < 0) {
        // Find next available position
        let newPos = 1;
        while (usedPositions.has(newPos)) {
          newPos++;
        }
        
        // Assign new position to this stitch
        stitchIds.forEach(stitchId => {
          const stitch = tube.stitches.find(s => s.id === stitchId);
          if (stitch) {
            console.log(`Fixing negative: Moved stitch ${stitch.id} from position ${stitch.position} to ${newPos}`);
            stitch.position = newPos;
            usedPositions.add(newPos);
            newPos++; // Increment for next stitch if more than one
          }
        });
        
        continue; // Go to next position
      }
      
      // Fix conflicts (more than one stitch at same position)
      if (stitchIds.length > 1) {
        console.warn(`CONFLICT: ${stitchIds.length} stitches at position ${position}: ${stitchIds.join(', ')}`);
        
        // Keep first one at this position, move others
        for (let i = 1; i < stitchIds.length; i++) {
          // Find next available position
          let newPos = parseInt(position) + i;
          while (usedPositions.has(newPos)) {
            newPos++;
          }
          
          // Assign new position to this stitch
          const stitch = tube.stitches.find(s => s.id === stitchIds[i]);
          if (stitch) {
            console.log(`Fixing conflict: Moved stitch ${stitch.id} from position ${stitch.position} to ${newPos}`);
            stitch.position = newPos;
            usedPositions.add(newPos);
          }
        }
        
        // Mark the position of the first stitch as used
        usedPositions.add(parseInt(position));
      } else {
        // Single stitch at this position - just mark as used
        usedPositions.add(parseInt(position));
      }
    }
    
    // Verification: make sure all stitches have unique positions
    const verificationSet = new Set();
    let needsRebuild = false;
    
    tube.stitches.forEach(stitch => {
      if (verificationSet.has(stitch.position)) {
        console.error(`VERIFICATION FAILED: Position ${stitch.position} is still duplicated after normalization`);
        needsRebuild = true;
      }
      verificationSet.add(stitch.position);
    });
    
    // If conflicts still exist, force a complete rebuild
    if (needsRebuild) {
      console.warn('Conflicts still present - forcing complete rebuild');
      this._normalizeStitchPositions(tube, true);
    }
  }
  
  // Select a specific tube
  selectTube(tubeNumber) {
    if (!this.state.tubes[tubeNumber]) {
      console.error(`Tube ${tubeNumber} not found`);
      return false;
    }
    
    this.state.activeTubeNumber = tubeNumber;
    
    // Save state
    this._saveState();
    
    return true;
  }
  
  // Get cycle count
  getCycleCount() {
    return this.state.cycleCount || 0;
  }
  
  // Get a stitch from a specific tube
  getStitchFromTube(tubeNumber, stitchId) {
    const tube = this.state.tubes[tubeNumber];
    if (!tube || !tube.stitches) return null;
    
    return tube.stitches.find(s => s.id === stitchId) || null;
  }
  
  // Save state to localStorage - CRITICAL FOR OFFLINE-FIRST APPROACH
  // This is called after every state change to ensure persistence without server communication
  _saveState() {
    // Update the timestamp whenever saving state
    this.state.last_updated = Date.now();
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`triple_helix_state_${this.state.userId}`, 
          JSON.stringify(this.state));
        // No need to log every save to avoid console clutter
      } catch (err) {
        console.warn('Could not save state to localStorage', err);
      }
    }
  }
  
  // Clear all state and localStorage data
  clearState() {
    console.log('Clearing StateMachine state and localStorage data');
    
    if (typeof window !== 'undefined') {
      try {
        // Clear all localStorage keys related to this state machine
        localStorage.removeItem(`triple_helix_state_${this.state.userId}`);
        
        // Clear anonymous state if it exists
        localStorage.removeItem('zenjin_anonymous_state');
        
        // Reset to empty state
        this.state = {
          userId: this.state.userId,
          activeTubeNumber: 1,
          cycleCount: 0,
          tubes: {
            1: { 
              threadId: null,
              currentStitchId: null,
              position: 0,
              stitches: []
            },
            2: { 
              threadId: null,
              currentStitchId: null,
              position: 0,
              stitches: []
            },
            3: { 
              threadId: null,
              currentStitchId: null,
              position: 0,
              stitches: []
            }
          },
          completedStitches: [],
          totalPoints: 0
        };
        
        console.log('State machine reset completed');
        return true;
      } catch (err) {
        console.error('Error clearing state:', err);
        return false;
      }
    }
    return false;
  }
}

module.exports = StateMachine;