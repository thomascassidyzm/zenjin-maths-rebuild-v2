/**
 * TubeCyclerAdapter
 * 
 * This adapter connects the TubeCycler component with our state/content architecture.
 * It translates between the state format expected by TubeCycler and our new state management system.
 */
import { MutableRefObject } from 'react';
import { stateManager } from '../state/stateManager';
import { contentManager } from '../content/contentManager';
import { UserState } from '../state/types';
import { StitchWithProgress, ThreadData } from '../types/distinction-learning';

// Import the TubeCycler ref type
export interface TubeCyclerRefHandle {
  nextTube: () => void;
  handleStitchCompletion: (threadId: string, stitchId: string, score: number, totalQuestions: number) => StitchWithProgress | null;
  getCurrentTube: () => string | null;
  getCurrentThread: () => string | null;
  getSortedThreads: () => ThreadData[];
  getCycleCount: () => number;
}

export class TubeCyclerAdapter {
  private tubeCyclerRef: MutableRefObject<TubeCyclerRefHandle | null>;
  private userId: string;
  private isInitialized: boolean = false;
  private currentThreadId: string | null = null;
  private currentTube: number = 1;
  private cycleCount: number = 0;
  
  constructor(tubeCyclerRef: MutableRefObject<TubeCyclerRefHandle | null>, userId: string) {
    this.tubeCyclerRef = tubeCyclerRef;
    this.userId = userId;
    
    // Subscribe to state changes
    stateManager.subscribe(this.handleStateChange);
  }
  
  /**
   * Initialize the adapter and underlying state
   */
  public async initialize(): Promise<ThreadData[]> {
    console.log('Initializing TubeCyclerAdapter for user:', this.userId);
    
    try {
      // Initialize state manager
      await stateManager.initialize(this.userId);
      
      // Get current state
      const state = stateManager.getState();
      
      // Check if state contains valid tube data
      const hasTubeData = Object.values(state.tubes).some(tube => tube.threadId && tube.currentStitchId);
      if (!hasTubeData) {
        console.warn('No valid tube data found in state, will use default data');
      }
      
      // Update local properties
      this.currentTube = state.activeTube || 1;
      this.cycleCount = state.cycleCount || 0;
      this.currentThreadId = state.tubes[this.currentTube]?.threadId || null;
      
      // Transform state into format expected by TubeCycler
      const threadData = this.transformStateToThreadData(state);
      
      // CRITICAL FIX: Prefetch content BEFORE setting initialized to true
      // to ensure content is available when the adapter reports as ready
      if (threadData.length > 0) {
        console.log('Prefetching initial content before completing initialization');
        await this.prefetchInitialContent(state);
      }
      
      // Only mark as initialized after content is prefetched
      this.isInitialized = true;
      
      // Log successful initialization
      console.log(`TubeCyclerAdapter initialized successfully with ${threadData.length} threads`);
      return threadData;
    } catch (error) {
      console.error('Failed to initialize TubeCyclerAdapter:', error);
      // Return empty thread data as fallback
      return [];
    }
  }
  
  /**
   * Handle state changes from state manager
   */
  private handleStateChange = (state: UserState) => {
    if (!this.isInitialized) {
      return;
    }
    
    console.log('State changed, updating adapter internal state');
    
    // Update local properties based on state changes
    this.currentTube = state.activeTube;
    this.cycleCount = state.cycleCount;
    this.currentThreadId = state.tubes[this.currentTube]?.threadId || null;
    
    // Only try to update TubeCycler if it exists and state has changed meaningfully
    if (this.tubeCyclerRef.current && 
        (this.tubeCyclerRef.current.getCurrentTube() !== `Tube-${state.activeTube}`)) {
      
      console.log(`State change requires TubeCycler update: now on tube ${state.activeTube}`);
      
      // Force TubeCycler to select the current tube
      // This is necessary because TubeCycler doesn't have direct tube selection
      // We use nextTube in a loop until we reach the desired tube
      const currentTubeNum = this.getCurrentTubeNumber();
      if (currentTubeNum !== state.activeTube) {
        // We need to cycle to the correct tube
        setTimeout(() => {
          if (this.tubeCyclerRef.current) {
            this.tubeCyclerRef.current.nextTube();
          }
        }, 10);
      }
    }
  };
  
  /**
   * Get the current tube number
   */
  private getCurrentTubeNumber(): number {
    if (!this.tubeCyclerRef.current) {
      return this.currentTube;
    }
    
    const currentTube = this.tubeCyclerRef.current.getCurrentTube();
    if (!currentTube) return this.currentTube;
    
    // Extract number from "Tube-X"
    const match = currentTube.match(/Tube-(\d+)/);
    return match ? parseInt(match[1]) : this.currentTube;
  }
  
  /**
   * Get the current state (for testing purposes)
   */
  public getState() {
    return stateManager.getState();
  }
  
  /**
   * Handle tube cycling from TubeCycler
   */
  public handleTubeCycle = (fromTube: number, toTube: number) => {
    console.log(`Cycling from tube ${fromTube} to tube ${toTube}`);
    
    // Update local state
    this.currentTube = toTube;
    
    // CRITICAL FIX: Force a cycle count increment when going from tube 3 to tube 1
    // This ensures we're tracking complete cycles through all three tubes
    let shouldForceStateUpdate = false;
    
    if (fromTube === 3 && toTube === 1) {
      this.cycleCount += 1;
      console.log(`ADAPTER CYCLE COUNT INCREMENTED: Completed a full cycle! New cycle count: ${this.cycleCount}`);
      shouldForceStateUpdate = true;
      
      // Force update the state manager's cycle count as well (redundant safety)
      stateManager.dispatch({
        type: 'UPDATE_CYCLE_COUNT',
        payload: { cycleCount: this.cycleCount }
      });
    }
    
    // Update state manager
    stateManager.dispatch({
      type: 'CYCLE_TUBE',
      payload: { fromTube, toTube }
    });
    
    // After state update, get the latest state
    const state = stateManager.getState();
    this.currentThreadId = state.tubes[toTube]?.threadId || null;
    
    // If we're completing a cycle, force persistence of cycle count
    if (shouldForceStateUpdate) {
      console.log(`Forcing state persistence for cycle count: ${this.cycleCount}`);
      this.persistCurrentState().then(success => {
        if (success) {
          console.log(`Successfully persisted cycle count: ${this.cycleCount}`);
        } else {
          console.error(`Failed to persist cycle count: ${this.cycleCount}`);
        }
      });
    }
    
    // Prefetch content for the new tube
    if (state.tubes[toTube] && state.tubes[toTube].currentStitchId) {
      this.prefetchContentForStitch(state.tubes[toTube].currentStitchId);
    }
  };
  
  /**
   * Manually trigger next tube cycle
   */
  public nextTube = () => {
    if (this.tubeCyclerRef.current) {
      console.log('Adapter triggering next tube cycle');
      this.tubeCyclerRef.current.nextTube();
    } else {
      console.warn('Cannot trigger next tube cycle - TubeCycler ref is null');
    }
  };
  
  /**
   * Handle stitch completion from TubeCycler
   */
  public handleStitchCompletion = async (
    threadId: string, 
    stitchId: string, 
    score: number, 
    totalQuestions: number
  ): Promise<StitchWithProgress | null> => {
    console.log(`Stitch completed: ${stitchId} in thread ${threadId} with score ${score}/${totalQuestions}`);
    console.log(`DIRECT DEBUG: Starting stitch completion with state:`);
    
    // Log current state
    const initialState = stateManager.getState();
    console.log(`DIRECT DEBUG: Initial state:`, JSON.stringify(initialState.tubes));
    
    const state = stateManager.getState();
    const tubeNumber = this.findTubeByThreadId(threadId, state);
    
    if (tubeNumber) {
      try {
        // Calculate skip number based on score
        let skipNumber = 3; // Default
        let distractorLevel = 'L1';
        let nextStitchId = stitchId; // Default to same stitch (for non-perfect scores)
        
        // Get current stitch details from TubeCycler if available
        let currentStitch = null;
        if (this.tubeCyclerRef.current) {
          const threads = this.tubeCyclerRef.current.getSortedThreads();
          const thread = threads.find(t => t.thread_id === threadId);
          
          if (thread) {
            currentStitch = thread.stitches.find(s => s.id === stitchId);
            
            if (currentStitch) {
              // Use current values as defaults
              skipNumber = currentStitch.skip_number || 3;
              distractorLevel = currentStitch.distractor_level || 'L1';
            }
          }
        }
        
        // Perfect score logic - generate new stitch ID and increase skip number/distractor level
        const isPerfectScore = score === totalQuestions;
        if (isPerfectScore) {
          console.log(`Perfect score (${score}/${totalQuestions}) - generating new stitch ID`);
          
          // Generate a new stitch ID for progression
          // Using a more unique ID with thread info to avoid conflicts
          nextStitchId = `stitch-${threadId.replace('thread-', '')}-${Date.now().toString(36)}`;
          
          if (currentStitch) {
            // Increase skip number for perfect scores
            if (skipNumber === 3) skipNumber = 5;
            else if (skipNumber === 5) skipNumber = 10;
            else if (skipNumber === 10) skipNumber = 25;
            else if (skipNumber === 25) skipNumber = 100;
            else skipNumber = 100; // Max value
            
            // Increase distractor level for perfect scores
            if (distractorLevel === 'L1') distractorLevel = 'L2';
            else if (distractorLevel === 'L2') distractorLevel = 'L3';
            // L3 is max level
          }
        } else {
          console.log(`Score ${score}/${totalQuestions} is not perfect - staying on same stitch ${stitchId}`);
        }
        
        // Update state with comprehensive stitch information
        stateManager.dispatch({
          type: 'COMPLETE_STITCH',
          payload: {
            tubeNumber,
            threadId,
            stitchId,           // Original stitch ID that was completed
            nextStitchId,       // New stitch ID (same as original for non-perfect scores)
            score,
            totalQuestions,
            skipNumber,
            distractorLevel,
            isPerfectScore      // Explicitly flag whether this was a perfect score
          }
        });
        
        // Prefetch next content
        this.prefetchNextContent(nextStitchId, tubeNumber);
        
        // CRITICAL FIX: If this is a perfect score, we need to reorder ALL stitches in the tube
        // This is because a perfect score causes all stitches to shift their positions
        if (isPerfectScore) {
          try {
            console.log(`Perfect score achieved (${score}/${totalQuestions}). Implementing Triple-Helix tube progression algorithm.`);
            
            // Get the updated state to ensure we have the most recent data
            const updatedState = stateManager.getState();
            const currentTubeState = updatedState.tubes[tubeNumber];
            
            // Log tube state before changes
            console.log(`TUBE STATE BEFORE: Tube ${tubeNumber}`, JSON.stringify(currentTubeState));
            
            // Get all tubes and their information
            const allTubes = updatedState.tubes;
            
            // Import the client for database updates
            const { updateUserStitchProgress } = await import('../supabase-client');
            
            // Step 1: Find all threads in the same tube (we need to update all of them)
            // In the database, we need to identify which threads belong to the same tube
            console.log(`Finding threads in Tube-${tubeNumber} that need position updates`);
            
            // The threads that share a tube will be from threadIds with specific letters:
            // Tube-1: thread-A, thread-D
            // Tube-2: thread-B, thread-E
            // Tube-3: thread-C, thread-F
            const threadLetterMap = {
              1: ['A', 'D', 'G', 'J'], // Tube-1 threads
              2: ['B', 'E', 'H', 'K'], // Tube-2 threads
              3: ['C', 'F', 'I', 'L']  // Tube-3 threads
            };
            
            // Get the letters for the current tube
            const tubeThreadLetters = threadLetterMap[tubeNumber] || [];
            
            // Find which threadIds belong to the current tube
            const tubeThreadIds: string[] = [];
            
            // Search through all tubes to find threads belonging to the same tube
            for (const [tubeName, tubeData] of Object.entries(allTubes)) {
              const tubeThreadId = tubeData.threadId;
              
              if (tubeThreadId) {
                // Extract letter from thread ID (e.g., thread-A -> A)
                const match = tubeThreadId.match(/thread-([A-Z])/);
                if (match && match[1]) {
                  const threadLetter = match[1];
                  
                  // Check if this thread belongs to our tube
                  if (tubeThreadLetters.includes(threadLetter)) {
                    tubeThreadIds.push(tubeThreadId);
                    console.log(`Found Thread-${threadLetter} (${tubeThreadId}) in Tube-${tubeNumber}`);
                  }
                }
              }
            }
            
            // Step 2: For a perfect score, we need to:
            // 1. Decrement the order_number of all stitches between positions 1 and skip_number by 1
            // 2. Place the completed stitch at position skip_number
            // 3. Ensure there's exactly one stitch with order_number=0 (the ready stitch)
            
            // First, update the stitch we just completed (the one that was at position 0)
            console.log(`Updating completed stitch ${stitchId} to position ${skipNumber} in the tube`);
            
            // Update the completed stitch with its new position
            const updateCompletedSuccess = await updateUserStitchProgress(
              this.userId,
              threadId,
              stitchId,       // Still use original stitch ID as we're moving this stitch
              skipNumber,     // Move to position equal to skip_number
              skipNumber,     // Updated skip number
              distractorLevel as 'L1' | 'L2' | 'L3',
              false // Not urgent - ensure it completes
            );
            
            if (updateCompletedSuccess) {
              console.log(`Successfully updated completed stitch position to ${skipNumber}`);
            } else {
              console.error(`Failed to update completed stitch position`);
            }
            
            // Now, query the database to get all stitches in these threads
            // This would normally be done through an API endpoint, but for direct implementation:
            console.log(`Updating other stitches in Tube-${tubeNumber} threads: ${tubeThreadIds.join(', ')}`);
            
            // Step 3: Create a new stitch entry for this tube's thread with order_number=0
            console.log(`Creating new ready stitch (${nextStitchId}) for thread ${threadId} with position 0`);
            
            // Create the new ready stitch
            const createNewStitchSuccess = await updateUserStitchProgress(
              this.userId,
              threadId,
              nextStitchId,    // Use the new stitch ID for perfect scores
              0,               // Position 0 = ready stitch
              3,               // Reset to initial skip number
              'L1' as 'L1',    // Reset to initial level
              false            // Not urgent - ensure it completes
            );
            
            if (createNewStitchSuccess) {
              console.log(`Successfully created new ready stitch ${nextStitchId} with position 0`);
            } else {
              console.error(`Failed to create new ready stitch`);
            }
            
            // Step 4: We should also request the server to implement the full reordering logic
            console.log('Requesting server-side reordering of stitch positions...');
            
            // Ideally, call a server endpoint that will handle the complex reordering logic
            try {
              const response = await fetch('/api/reorder-tube-stitches', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  userId: this.userId,
                  tubeNumber,
                  threadId,
                  completedStitchId: stitchId,
                  skipNumber
                })
              });
              
              if (response.ok) {
                console.log('Server-side stitch reordering successful');
                
                // Get response data
                const responseData = await response.json();
                console.log('Reordering response:', responseData);
                
                // Check if we have updated stitch data to sync state
                if (responseData.success) {
                  console.log('Updating local state to match server reordering');
                  
                  // Extract the new stitch ID from the response if available
                  // This ensures client and server use the same IDs
                  const serverNewStitchId = responseData.stats?.newStitchId || nextStitchId;
                  
                  // Update our nextStitchId to match server if needed
                  if (serverNewStitchId !== nextStitchId) {
                    console.log(`Syncing stitch IDs - client: ${nextStitchId}, server: ${serverNewStitchId}`);
                    nextStitchId = serverNewStitchId;
                  }
                  
                  // Check if the server incremented the tube position
                  const tubePosition = responseData.stats?.tubePosition;
                  if (tubePosition && tubePosition.incremented) {
                    console.log(`Server confirmed tube position increment for Tube-${tubeNumber}`);
                  }

                  // CRITICAL FIX: Force fetch of latest user stitches from the server to ensure
                  // we have the correct ordering after server-side reordering
                  try {
                    console.log('CRITICAL FIX: Fetching latest stitch data from server to ensure current state is accurate');
                    const userStitchesResponse = await fetch(`/api/user-stitches?userId=${encodeURIComponent(this.userId)}`);
                    
                    if (userStitchesResponse.ok) {
                      const stitchesData = await userStitchesResponse.json();
                      
                      if (stitchesData.success) {
                        console.log('Successfully fetched latest stitch data from server');
                        
                        // Check if our thread is in the updated data
                        const updatedThread = stitchesData.threads.find((t: any) => t.thread_id === threadId);
                        
                        if (updatedThread) {
                          // Find the stitch with order_number = 0 (ready stitch) for this thread
                          const readyStitch = updatedThread.stitches.find((s: any) => s.order_number === 0);
                          
                          if (readyStitch) {
                            console.log(`CRITICAL FIX: Found new ready stitch: ${readyStitch.stitch_id} at position 0`);
                            
                            // Use this stitch ID instead of the one we generated
                            if (readyStitch.stitch_id !== nextStitchId) {
                              console.log(`CRITICAL FIX: Updating next stitch ID from ${nextStitchId} to ${readyStitch.stitch_id}`);
                              nextStitchId = readyStitch.stitch_id;
                            }
                          }
                        }
                      }
                    }
                  } catch (fetchErr) {
                    console.warn('Error fetching updated stitch data:', fetchErr);
                  }
                  
                  // Refresh state to match server-side changes
                  // This is the critical fix - ensure state reflects server changes
                  const refreshedState = stateManager.getState();
                  
                  // Update position in state, ensuring it reflects the server state
                  const currentPosition = refreshedState.tubes[tubeNumber]?.position || 0;
                  
                  // CRITICAL FIX: Force the state to update with the server-confirmed stitch
                  console.log(`CRITICAL FIX: Updating state with server-confirmed stitch ID: ${nextStitchId}`);
                  
                  stateManager.dispatch({
                    type: 'COMPLETE_STITCH',
                    payload: {
                      tubeNumber,
                      threadId,
                      stitchId,           // Original stitch ID that was completed
                      nextStitchId,       // New stitch ID (for progression) - now synced with server
                      score,
                      totalQuestions,
                      skipNumber,
                      distractorLevel,
                      isPerfectScore: true // Force progression
                    }
                  });
                  
                  // CRITICAL FIX: Force persistence of state after the update
                  await stateManager.forceSyncToServer();
                  
                  // CRITICAL FIX: Now reload the page content to reflect the new stitch
                  // This ensures the UI shows the new stitch immediately
                  console.log('CRITICAL FIX: Forcing content reload for new stitch');
                  this.prefetchContentForStitch(nextStitchId);
                  
                  // Verify state was updated correctly
                  const finalState = stateManager.getState();
                  console.log('FINAL STATE CHECK:');
                  console.log(`- Tube: ${tubeNumber}`);
                  console.log(`- Original stitch: ${stitchId}`);
                  console.log(`- New stitch: ${finalState.tubes[tubeNumber]?.currentStitchId}`);
                  console.log(`- Position: ${finalState.tubes[tubeNumber]?.position}`);
                  console.log(`- Expected: Position should be incremented, stitch ID should be ${nextStitchId}`);
                  
                  // Final verification
                  const updated = finalState.tubes[tubeNumber]?.currentStitchId === nextStitchId;
                  console.log(`State sync ${updated ? 'SUCCESSFUL ✅' : 'FAILED ❌'}`);
                  
                  // If update appears to have failed, try one last fix
                  if (!updated) {
                    console.log('CRITICAL FIX: Final attempt to correct stitch ID in state');
                    stateManager.dispatch({
                      type: 'FORCE_STITCH_UPDATE',
                      payload: {
                        tubeNumber,
                        nextStitchId,
                        position: currentPosition + 1
                      }
                    });
                    
                    // Check again
                    const retryState = stateManager.getState();
                    const retryUpdated = retryState.tubes[tubeNumber]?.currentStitchId === nextStitchId;
                    console.log(`State retry sync ${retryUpdated ? 'SUCCESSFUL ✅' : 'FAILED ❌'}`);
                  }
                } else {
                  console.warn('Server reordering did not return success status');
                }
              } else {
                console.warn('Server-side stitch reordering failed, positions may be inconsistent');
                
                // Try to log response details for debugging
                try {
                  const errorData = await response.json();
                  console.error('API error details:', errorData);
                } catch (e) {
                  console.error('API error status:', response.status, response.statusText);
                }
              }
            } catch (apiErr) {
              console.warn('API error during server-side reordering, positions may be inconsistent:', apiErr);
            }
          } catch (err) {
            console.error('Error updating stitch progression in database:', err);
          }
        }
        
        // Force state persistence for this important change
        await this.persistCurrentState();
        
        // Get additional stitch details by combining data from tubeCycler and our state
        const updatedState = stateManager.getState();
        
        // CRITICAL FIX: Log the state after changes to verify progression
        console.log('STITCH PROGRESSION: State after changes for tube', tubeNumber);
        console.log('- Before changes position:', initialState.tubes[tubeNumber]?.position);
        console.log('- After changes position:', updatedState.tubes[tubeNumber]?.position);
        console.log('- Before stitch ID:', initialState.tubes[tubeNumber]?.currentStitchId);
        console.log('- After stitch ID:', updatedState.tubes[tubeNumber]?.currentStitchId);
        console.log('- Perfect score?', isPerfectScore ? 'Yes - should advance' : 'No - should stay');
        
        const orderNumber = updatedState.tubes[tubeNumber]?.position || 0;
        
        // Return a StitchWithProgress with more details
        return {
          id: nextStitchId,
          threadId: threadId,
          title: `Next Stitch for ${threadId}`,
          content: 'Content will be loaded when needed',
          orderNumber: orderNumber + 1,
          skip_number: skipNumber,
          distractor_level: distractorLevel as 'L1' | 'L2' | 'L3',
          questions: []
        };
      } catch (error) {
        console.error('Error handling stitch completion:', error);
        
        // Return fallback stitch info in case of error
        return {
          id: `fallback-${Date.now().toString(36)}`,
          threadId: threadId,
          title: `Fallback Stitch for ${threadId}`,
          content: 'Fallback content due to error',
          orderNumber: 0,
          skip_number: 3,
          distractor_level: 'L1',
          questions: []
        };
      }
    }
    
    return null;
  };
  
  /**
   * Get the current thread ID
   */
  public getCurrentThread = (): string | null => {
    // First check TubeCycler if available
    if (this.tubeCyclerRef.current) {
      const threadId = this.tubeCyclerRef.current.getCurrentThread();
      if (threadId) {
        this.currentThreadId = threadId;
        return threadId;
      }
    }
    
    // Fall back to our tracked state
    return this.currentThreadId;
  };
  
  /**
   * Get the current tube name
   */
  public getCurrentTube = (): string | null => {
    // First check TubeCycler if available
    if (this.tubeCyclerRef.current) {
      return this.tubeCyclerRef.current.getCurrentTube();
    }
    
    // Fall back to our tracked state
    return `Tube-${this.currentTube}`;
  };
  
  /**
   * Force selection of a specific tube number (1, 2, or 3)
   * This is helpful for recovery after errors or initialization issues
   */
  public selectTube = (tubeNumber: number): void => {
    console.log(`Forcing selection of tube ${tubeNumber}`);
    
    // Validate tube number
    if (tubeNumber < 1 || tubeNumber > 3) {
      console.error(`Invalid tube number: ${tubeNumber}. Must be 1, 2, or 3.`);
      return;
    }
    
    // If already on this tube, nothing to do
    if (this.currentTube === tubeNumber) {
      console.log(`Already on tube ${tubeNumber}, no change needed`);
      return;
    }
    
    // Calculate how many times to call nextTube to reach the desired tube
    const currentTube = this.getCurrentTubeNumber();
    let cyclesToPerform = 0;
    
    // Calculate shortest path (1→2→3→1)
    if (currentTube === 1) {
      cyclesToPerform = tubeNumber === 2 ? 1 : 2; // 1→2 or 1→3
    } else if (currentTube === 2) {
      cyclesToPerform = tubeNumber === 3 ? 1 : 2; // 2→3 or 2→1
    } else { // currentTube === 3
      cyclesToPerform = tubeNumber === 1 ? 1 : 2; // 3→1 or 3→2
    }
    
    console.log(`Need to cycle ${cyclesToPerform} times to reach tube ${tubeNumber} from tube ${currentTube}`);
    
    // Perform the cycles with slight delays to ensure proper state updates
    const cycleWithDelay = (remainingCycles: number) => {
      if (remainingCycles <= 0) return;
      
      if (this.tubeCyclerRef.current) {
        this.tubeCyclerRef.current.nextTube();
        
        // Schedule next cycle after a short delay
        if (remainingCycles > 1) {
          setTimeout(() => {
            cycleWithDelay(remainingCycles - 1);
          }, 100);
        }
      } else {
        console.error('TubeCycler ref is not available for tube selection');
      }
    };
    
    // Start cycling
    cycleWithDelay(cyclesToPerform);
  };
  
  /**
   * Get the current cycle count
   */
  public getCycleCount = (): number => {
    // First check state manager
    const state = stateManager.getState();
    this.cycleCount = state.cycleCount;
    
    // Return our tracked cycle count
    return this.cycleCount;
  };
  
  /**
   * Get sorted threads from TubeCycler or state
   */
  public getSortedThreads = (): ThreadData[] => {
    // First check TubeCycler if available
    if (this.tubeCyclerRef.current) {
      return this.tubeCyclerRef.current.getSortedThreads();
    }
    
    // Fall back to transforming our state
    const state = stateManager.getState();
    return this.transformStateToThreadData(state);
  };
  
  /**
   * Transform the state into thread data format expected by TubeCycler
   */
  private transformStateToThreadData = (state: UserState): ThreadData[] => {
    const threadData: ThreadData[] = [];
    
    // Create a thread for each tube
    Object.entries(state.tubes).forEach(([tubeKey, tubeState]) => {
      const tubeNumber = parseInt(tubeKey);
      
      if (tubeState.threadId) {
        // Generate a unique ID if missing
        const stitchId = tubeState.currentStitchId || `mock-stitch-${tubeNumber}-${Date.now()}`;
        
        threadData.push({
          thread_id: tubeState.threadId,
          tube_number: tubeNumber,
          stitches: [
            {
              id: stitchId,
              threadId: tubeState.threadId,
              title: `Stitch for Tube ${tubeNumber}`,
              content: 'This is placeholder content for tube ' + tubeNumber,
              orderNumber: tubeState.position || 0,
              skip_number: 3,
              distractor_level: 'L1',
              questions: [
                // CRITICAL FIX: Include sample questions to ensure content can render
                // even if API fetch fails
                {
                  id: `${stitchId}-q1`,
                  text: `7 + 5`,
                  correctAnswer: "12",
                  distractors: {
                    L1: "13",
                    L2: "11",
                    L3: "10"
                  }
                },
                {
                  id: `${stitchId}-q2`,
                  text: `9 - 3`,
                  correctAnswer: "6",
                  distractors: {
                    L1: "7",
                    L2: "5",
                    L3: "4"
                  }
                }
              ]
            }
          ]
        });
      }
    });
    
    // If no threads were created from state, create default data
    if (threadData.length === 0) {
      console.log('No thread data found in state, creating default thread data');
      
      // Use proper thread naming conventions that match the database
      const tubeToThreadMap = {
        1: 'A',
        2: 'B',
        3: 'C'
      };
      
      for (let i = 1; i <= 3; i++) {
        const threadLetter = tubeToThreadMap[i as keyof typeof tubeToThreadMap] || String.fromCharCode(64 + i);
        const defaultThreadId = `thread-${threadLetter}`;
        const defaultStitchId = `stitch-default-${threadLetter}-${Date.now()}`;
        
        threadData.push({
          thread_id: defaultThreadId,
          tube_number: i,
          stitches: [
            {
              id: defaultStitchId,
              threadId: defaultThreadId,
              title: `Default Stitch for Thread ${threadLetter} (Tube ${i})`,
              content: `This is default content for Thread ${threadLetter} in Tube ${i}`,
              orderNumber: 0,
              skip_number: 3,
              distractor_level: 'L1',
              questions: [
                // Include sample questions to ensure content can render
                {
                  id: `${defaultStitchId}-q1`,
                  text: `6 × 3`,
                  correctAnswer: "18",
                  distractors: {
                    L1: "15",
                    L2: "21",
                    L3: "12"
                  }
                },
                {
                  id: `${defaultStitchId}-q2`,
                  text: `20 ÷ 4`,
                  correctAnswer: "5",
                  distractors: {
                    L1: "4",
                    L2: "6",
                    L3: "8"
                  }
                }
              ]
            }
          ]
        });
      }
      
      // Also update the state so it's consistent with our created data
      state.tubes[1].threadId = threadData[0].thread_id;
      state.tubes[1].currentStitchId = threadData[0].stitches[0].id;
      state.tubes[2].threadId = threadData[1].thread_id;
      state.tubes[2].currentStitchId = threadData[1].stitches[0].id;
      state.tubes[3].threadId = threadData[2].thread_id;
      state.tubes[3].currentStitchId = threadData[2].stitches[0].id;
      
      // We'll set the active tube after checking tube positions from database
      
      // Log the state update
      console.log(`Updated state with correct thread IDs: Tube 1→${threadData[0].thread_id}, Tube 2→${threadData[1].thread_id}, Tube 3→${threadData[2].thread_id}`);
      
      // Start with Tube-1 and Thread-A as the logical first experience
      // This matches the design intention of the program
      state.activeTube = 1;
      this.currentTube = 1;
      this.currentThreadId = 'thread-A';
      
      // Persist this first version of the state
      stateManager.dispatch({
        type: 'INITIALIZE_STATE',
        payload: state
      });
      
      // Try to match existing tube positions from database if possible
      try {
        console.log('Checking for existing tube positions in database...');
        return fetch(`/api/tube-positions?userId=${this.userId}`)
          .then(response => response.json())
          .then(data => {
            if (data.positions && data.positions.length > 0) {
              console.log('Found existing tube positions, will use these to update state');
              
              // Update tubes based on existing positions
              let foundActiveTube = false;
              
              data.positions.forEach((position: any) => {
                const tubeNumber = position.tube_number;
                const threadId = position.thread_id;
                
                if (tubeNumber && threadId && state.tubes[tubeNumber]) {
                  console.log(`Setting tube ${tubeNumber} to thread ${threadId} based on database record`);
                  state.tubes[tubeNumber].threadId = threadId;
                  
                  // If this is the first position or the one explicitly set as active, use it as active tube
                  if (!foundActiveTube) {
                    console.log(`Setting active tube to ${tubeNumber} based on database tube position`);
                    state.activeTube = tubeNumber;
                    this.currentTube = tubeNumber;
                    this.currentThreadId = threadId;
                    foundActiveTube = true;
                  }
                }
              });
              
              // Default to Tube-1 with Thread-A if no active tube was found
              // This is the logical first tube/thread as intended by the design
              if (!foundActiveTube) {
                console.log('No active tube found in positions, defaulting to Tube-1 with Thread-A');
                state.activeTube = 1;
                this.currentTube = 1;
                this.currentThreadId = 'thread-A';
              }
              
              // Update state
              stateManager.dispatch({
                type: 'INITIALIZE_STATE',
                payload: state
              });
            }
          })
          .catch(err => {
            console.warn('Error checking tube positions, using default thread mapping:', err);
          });
      } catch (err) {
        console.warn('Error in tube position check, continuing with default threads');
      }
      
      // Persist this state
      stateManager.dispatch({
        type: 'INITIALIZE_STATE',
        payload: state
      });
    }
    
    // Log the thread data for debugging
    console.log(`Transformed state into ${threadData.length} threads:`, 
      threadData.map(t => `${t.thread_id} (Tube ${t.tube_number})`).join(', '));
    
    return threadData;
  };
  
  /**
   * Find which tube contains a given thread
   */
  private findTubeByThreadId = (threadId: string, state: UserState): number | null => {
    for (const [tubeKey, tubeState] of Object.entries(state.tubes)) {
      if (tubeState.threadId === threadId) {
        return parseInt(tubeKey);
      }
    }
    
    return null;
  };
  
  /**
   * Prefetch initial content based on current state
   * Changed to async function to wait for prefetch to complete
   */
  private prefetchInitialContent = async (state: UserState): Promise<void> => {
    const stitchIds: string[] = [];
    
    // Collect all current stitch IDs
    Object.values(state.tubes).forEach(tube => {
      if (tube.currentStitchId) {
        stitchIds.push(tube.currentStitchId);
      }
    });
    
    // Prefetch content
    if (stitchIds.length > 0) {
      console.log('Prefetching initial content:', stitchIds);
      
      try {
        // CRITICAL FIX: Wait for content to be prefetched before continuing
        await contentManager.prefetchStitches(stitchIds);
        console.log('Initial content prefetch completed successfully');
        
        // Also prefetch next position content for each tube as backup
        const nextIds: string[] = [];
        for (const tubeKey in state.tubes) {
          const tube = state.tubes[tubeKey];
          if (tube.threadId && tube.currentStitchId) {
            // Generate a next stitch ID for each tube as fallback
            nextIds.push(`next-stitch-${tube.threadId}-${Date.now()}`);
          }
        }
        
        if (nextIds.length > 0) {
          // Queue these for background prefetch
          contentManager.queueStitchesForPrefetch(nextIds);
        }
      } catch (error) {
        console.error('Error prefetching initial content:', error);
        // Continue even if prefetch fails, as content will be loaded on demand
      }
    } else {
      console.warn('No stitch IDs found to prefetch');
    }
  };
  
  /**
   * Prefetch content for next stitch and next tube
   */
  private prefetchNextContent = (stitchId: string, tubeNumber: number) => {
    // Prefetch the specific stitch
    this.prefetchContentForStitch(stitchId);
    
    // Also prefetch next tube's content
    const state = stateManager.getState();
    const nextTube = tubeNumber < 3 ? tubeNumber + 1 : 1;
    const nextTubeStitchId = state.tubes[nextTube]?.currentStitchId;
    
    if (nextTubeStitchId) {
      this.prefetchContentForStitch(nextTubeStitchId);
    }
  };
  
  /**
   * Prefetch content for a specific stitch
   */
  private prefetchContentForStitch = (stitchId: string) => {
    if (!stitchId) return;
    
    console.log('Prefetching content for stitch:', stitchId);
    contentManager.prefetchStitches([stitchId]);
  };
  
  /**
   * Save the current state to ensure persistence
   */
  public persistCurrentState = async (): Promise<boolean> => {
    console.log('Adapter saving state');
    return await stateManager.saveState();
  };
  
  /**
   * Destroy the adapter and clean up resources
   */
  public destroy() {
    // Unsubscribe from state manager
    stateManager.unsubscribe(this.handleStateChange);
    
    // Save state before cleanup
    stateManager.saveState();
  }
}

export default TubeCyclerAdapter;