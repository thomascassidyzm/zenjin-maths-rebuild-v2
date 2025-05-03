/**
 * StitchSequencer - Core logic for adaptive sequencing of stitches
 * 
 * This class handles:
 * - Tracking the ready stitch (order_number = 0) for each thread
 * - Managing skip numbers and distractor levels
 * - Reordering stitches based on user performance using spaced repetition
 * - Persisting user progress to the database
 */
import { ThreadData, StitchWithProgress, OrderMapEntry, SKIP_SEQUENCE, SyncTiming } from './types/distinction-learning';
import { updateUserStitchProgress } from './supabase-client';

export interface SequencerOptions {
  syncFrequency?: number;  // How often to sync changes to the server (in ms)
  autoSync?: boolean;     // Whether to automatically sync changes
  forceSync?: boolean;    // Whether to force sync on every update (for better persistence)
}

export class StitchSequencer {
  private threadData: Map<string, ThreadData>;
  private userId: string;
  private options: SequencerOptions;
  private pendingUpdates: Map<string, Map<string, any>>;
  private syncTimeoutId: NodeJS.Timeout | null = null;
  private lastSyncTime: number = 0;

  /**
   * Create a new StitchSequencer
   * @param threadData Initial thread data from the API
   * @param userId User ID for progress tracking
   * @param options Configuration options
   */
  constructor(threadData: ThreadData[], userId: string, options: SequencerOptions = {}, tubePosition?: {tubeNumber: number, threadId: string}) {
    // Initialize thread data map for faster access
    this.threadData = new Map();
    threadData.forEach(thread => {
      this.threadData.set(thread.thread_id, thread);
    });

    this.userId = userId;
    this.options = {
      syncFrequency: options.syncFrequency || 10000,  // Default: sync every 10 seconds
      autoSync: options.autoSync !== undefined ? options.autoSync : true,
      forceSync: options.forceSync !== undefined ? options.forceSync : true  // Default to true for better persistence
    };
    
    // If tube position is provided, log it
    if (tubePosition) {
      console.log(`Initializing sequencer with saved tube position: Tube-${tubePosition.tubeNumber}, Thread-${tubePosition.threadId}`);
    }

    // Track pending updates for batch syncing
    this.pendingUpdates = new Map();

    // Start auto-sync if enabled
    if (this.options.autoSync) {
      this.startAutoSync();
    }

    // Verify each thread has exactly one ready stitch
    this.verifyThreadReadyStitches();
  }

  /**
   * Verify that each thread has exactly one ready stitch (order_number = 0)
   * If not, fix the thread by making the first stitch the ready stitch
   */
  private verifyThreadReadyStitches() {
    this.threadData.forEach((thread, threadId) => {
      const readyStitches = thread.stitches.filter(s => s.order_number === 0);
      
      if (readyStitches.length === 0) {
        console.warn(`Thread ${threadId} has no ready stitch. Fixing...`);
        if (thread.stitches.length > 0) {
          // Find stitch with lowest order number
          const lowestOrderStitch = thread.stitches.reduce((prev, curr) => 
            (curr.order_number < prev.order_number) ? curr : prev, thread.stitches[0]);
          
          // Set it as ready
          lowestOrderStitch.order_number = 0;
          
          // Update order map
          const orderMapEntry = thread.orderMap.find(e => e.stitch_id === lowestOrderStitch.id);
          if (orderMapEntry) {
            orderMapEntry.order_number = 0;
          }
          
          // Track this fix for immediate sync
          this.trackUpdate(threadId, lowestOrderStitch.id, {
            order_number: 0,
            skip_number: lowestOrderStitch.skip_number || 1, // Default to 1 if not set
            distractor_level: lowestOrderStitch.distractor_level
          }, SyncTiming.IMMEDIATE);
        }
      } else if (readyStitches.length > 1) {
        console.warn(`Thread ${threadId} has ${readyStitches.length} ready stitches. Fixing...`);
        
        // Keep the first one as ready, push others back
        readyStitches.slice(1).forEach((stitch, index) => {
          const newOrder = index + 1;
          stitch.order_number = newOrder;
          
          // Update order map
          const orderMapEntry = thread.orderMap.find(e => e.stitch_id === stitch.id);
          if (orderMapEntry) {
            orderMapEntry.order_number = newOrder;
          }
          
          // Track this fix for immediate sync
          this.trackUpdate(threadId, stitch.id, {
            order_number: newOrder,
            skip_number: stitch.skip_number,
            distractor_level: stitch.distractor_level
          }, SyncTiming.IMMEDIATE);
        });
      }
    });
    
    // Sync fixes immediately
    if (this.options.forceSync) {
      setTimeout(() => this.syncUpdates(), 100);
    }
  }

  /**
   * Clean up on destroy
   */
  destroy() {
    if (this.syncTimeoutId) {
      clearTimeout(this.syncTimeoutId);
    }
    
    // Final sync of any pending updates
    this.syncUpdates().catch(err => {
      console.error('Error during final sync on destroy:', err);
    });
  }

  /**
   * Get all thread IDs
   * @returns Array of thread IDs
   */
  getThreadIds(): string[] {
    return Array.from(this.threadData.keys());
  }

  /**
   * Get the ready stitch for a thread (the one with order_number = 0)
   * @param threadId Thread ID
   * @returns Ready stitch or null if not found
   */
  getReadyStitch(threadId: string): StitchWithProgress | null {
    const thread = this.threadData.get(threadId);
    if (!thread) return null;

    // Find stitches with order_number = 0 (ready to be played)
    const readyStitches = thread.stitches.filter(stitch => stitch.order_number === 0);
    
    // If multiple ready stitches exist, log warning but return the first one
    if (readyStitches.length > 1) {
      console.warn(`Found ${readyStitches.length} ready stitches for thread ${threadId}. Using the first one.`);
      
      // Provide more details about the ready stitches for debugging
      readyStitches.forEach((stitch, index) => {
        console.warn(`  Ready stitch ${index + 1}: ID=${stitch.id}, Skip=${stitch.skip_number}, Distractor=${stitch.distractor_level}`);
      });
      
      // This is a data integrity issue that should be fixed
      console.warn(`This thread has multiple ready stitches, which should be fixed for proper tube cycling`);
    }
    
    // Return the first ready stitch or null if none found
    return readyStitches.length > 0 ? readyStitches[0] : null;
  }

  /**
   * Alias for getReadyStitch to maintain backward compatibility
   * @deprecated Use getReadyStitch instead
   */
  getActiveStitch(threadId: string): StitchWithProgress | null {
    return this.getReadyStitch(threadId);
  }

  /**
   * Get the next N upcoming stitches for a thread
   * @param threadId Thread ID
   * @param count Number of upcoming stitches to get
   * @returns Array of upcoming stitches
   */
  getUpcomingStitches(threadId: string, count: number = 5): StitchWithProgress[] {
    const thread = this.threadData.get(threadId);
    if (!thread) return [];

    // Find all non-ready stitches (order_number > 0)
    const upcomingStitches = thread.stitches
      .filter(stitch => stitch.order_number > 0)
      .sort((a, b) => a.order_number - b.order_number);
    
    console.log(`Found ${upcomingStitches.length} upcoming stitches for thread ${threadId}`);
    
    // Return up to 'count' stitches
    return upcomingStitches.slice(0, count);
  }

  /**
   * Handle completion of a stitch
   * @param threadId Thread ID
   * @param stitchId Stitch ID
   * @param score Score (number of correct answers)
   * @param totalQuestions Total number of questions
   * @returns The new ready stitch
   */
  handleStitchCompletion(
    threadId: string,
    stitchId: string,
    score: number,
    totalQuestions: number
  ): StitchWithProgress | null {
    const thread = this.threadData.get(threadId);
    if (!thread) return null;

    // Find the completed stitch in our data
    const stitch = thread.stitches.find(s => s.id === stitchId);
    if (!stitch) return null;

    // Find the stitch in the order map
    const orderMapEntry = thread.orderMap.find(entry => entry.stitch_id === stitchId);
    if (!orderMapEntry) return null;

    // Check if the score was perfect
    const isPerfect = score === totalQuestions;
    
    // Log completion attempt
    console.log(`StitchSequencer: Handling completion of ${stitchId} in ${threadId} with ${score}/${totalQuestions}`);

    if (isPerfect) {
      // Handle perfect score case - 20/20
      console.log(`Perfect score (20/20)! Implementing spaced repetition algorithm`);
      console.log(`1) Move stitch back by its skip_number (${stitch.skip_number}) positions`);
      console.log(`2) Decrement by 1 the order_number of all stitches from 1 to n-1`);
      console.log(`3) The stitch with order_number=1 will become the new ready stitch (order_number=0)`);
      console.log(`4) Advance the skip_number in sequence [1, 3, 5, 10, 25, 100], capped at 100`);
      this.handlePerfectScore(thread, stitch, orderMapEntry);
    } else {
      // Handle less than perfect score - just reset skip number
      console.log(`Non-perfect score. Keeping stitch as ready (order=${stitch.order_number}) and resetting skip_number`);
      stitch.skip_number = 1; // Reset to 1 (default starting skip number)
      orderMapEntry.order_number = stitch.order_number;

      // Track the update
      this.trackUpdate(threadId, stitchId, {
        order_number: stitch.order_number,
        skip_number: stitch.skip_number,
        distractor_level: stitch.distractor_level,
      }, this.options.forceSync ? SyncTiming.IMMEDIATE : SyncTiming.SCHEDULED);
    }
    
    // Log all stitches in thread after update
    console.log(`Thread ${threadId} stitches after update:`);
    thread.stitches.forEach(s => {
      console.log(`- Stitch ${s.id}: order=${s.order_number}, skip=${s.skip_number}`);
    });

    // Find and return the new ready stitch
    return this.getReadyStitch(threadId);
  }

  /**
   * Handle a perfect score on a stitch
   * @param thread Thread data
   * @param stitch Stitch that was completed
   * @param orderMapEntry Order map entry for the stitch
   */
  private handlePerfectScore(
    thread: ThreadData,
    stitch: StitchWithProgress,
    orderMapEntry: OrderMapEntry
  ) {
    // Log the tube we're operating on
    console.log(`Processing perfect score for stitch ${stitch.id} in Thread ${thread.thread_id} (Tube-${thread.tube_number})`);
    
    // 1. Get all stitches in the tube
    const allStitchesInTube = this.getAllStitchesInTube(thread);
    
    // Record the current order_number (usually 0, since this should be the active stitch) 
    const currentPosition = stitch.order_number;
    console.log(`Current position of stitch: ${currentPosition}`);
    
    // 2. Calculate the correct target position based on skip_number
    // The target position is now EXACTLY the skip_number, not skip_number positions ahead
    // This is a key fix to the algorithm
    const targetPosition = stitch.skip_number;
    console.log(`Target position for stitch: ${targetPosition} (skip_number=${stitch.skip_number})`);
    
    // 3. Temporarily set this stitch's order to a special value to exclude it from position decrements
    stitch.order_number = -1;
    
    // 4. CRITICAL FIX: Decrement ALL stitches with order numbers between 1 and skip_number by 1
    // This pulls everything forward in the tube
    let adjustedCount = 0;
    
    // Get all threads in the tube
    const tubeThreads = this.getThreadsInSameTube(thread);
    
    // For all stitches in all threads in this tube
    tubeThreads.forEach(tubeThread => {
      tubeThread.stitches.forEach(tubeStitch => {
        // Skip the stitch we're currently working on
        if (tubeThread.thread_id === thread.thread_id && tubeStitch.id === stitch.id) return;
        
        // If this stitch is in positions 1 through skip_number, decrement it
        if (tubeStitch.order_number >= 1 && tubeStitch.order_number <= targetPosition) {
          const oldPosition = tubeStitch.order_number;
          tubeStitch.order_number -= 1;
          
          // Also update the order map
          const orderMapEntry = tubeThread.orderMap.find(entry => entry.stitch_id === tubeStitch.id);
          if (orderMapEntry) {
            orderMapEntry.order_number = tubeStitch.order_number;
          }
          
          // Track the update for database persistence
          this.trackUpdate(tubeThread.thread_id, tubeStitch.id, {
            order_number: tubeStitch.order_number
          }, this.options.forceSync ? SyncTiming.IMMEDIATE : SyncTiming.SCHEDULED);
          
          console.log(`Adjusted stitch ${tubeStitch.id} in thread ${tubeThread.thread_id} from position ${oldPosition} to ${tubeStitch.order_number}`);
          adjustedCount++;
        }
      });
    });
    
    console.log(`Adjusted ${adjustedCount} stitches during reordering`);
    
    // 5. Now place the completed stitch at its target position
    stitch.order_number = targetPosition;
    orderMapEntry.order_number = targetPosition;
    
    // Track this update for database persistence
    this.trackUpdate(thread.thread_id, stitch.id, {
      order_number: targetPosition
    }, this.options.forceSync ? SyncTiming.IMMEDIATE : SyncTiming.SCHEDULED);
    
    console.log(`Placed stitch ${stitch.id} at position ${targetPosition}`);
    
    // 6. CRITICAL VALIDATION: Ensure exactly one stitch in the tube has order_number=0
    // This is essential for the tube cycling system to work properly
    
    // Define ready stitch entry type
    interface ReadyStitchEntry {
      threadId: string;
      stitchId: string;
      stitchObject: StitchWithProgress;
      orderMapEntry: OrderMapEntry | undefined;
    }
    
    const readyStitches: ReadyStitchEntry[] = [];
    
    // Check across all threads in the tube
    tubeThreads.forEach(tubeThread => {
      tubeThread.stitches.forEach(tubeStitch => {
        if (tubeStitch.order_number === 0) {
          readyStitches.push({
            threadId: tubeThread.thread_id,
            stitchId: tubeStitch.id,
            stitchObject: tubeStitch,
            orderMapEntry: tubeThread.orderMap.find(e => e.stitch_id === tubeStitch.id)
          });
        }
      });
    });
    
    // Fix any issues with ready stitches
    if (readyStitches.length === 0) {
      // No ready stitch - find the stitch with the lowest positive order_number
      console.warn('No ready stitch found after reordering. Finding the lowest ordered stitch to make ready.');
      
      // Define stitch position entry type
      interface StitchPositionEntry {
        threadId: string;
        stitchId: string;
        orderNumber: number;
        stitchObject: StitchWithProgress;
        orderMapEntry: OrderMapEntry | undefined;
      }
      
      // Collect all stitches with their positions
      const allStitchPositions: StitchPositionEntry[] = [];
      tubeThreads.forEach(tubeThread => {
        tubeThread.stitches.forEach(tubeStitch => {
          if (tubeStitch.order_number > 0) { // Only consider positive order numbers
            allStitchPositions.push({
              threadId: tubeThread.thread_id,
              stitchId: tubeStitch.id,
              orderNumber: tubeStitch.order_number,
              stitchObject: tubeStitch,
              orderMapEntry: tubeThread.orderMap.find(e => e.stitch_id === tubeStitch.id)
            });
          }
        });
      });
      
      // Sort by order number
      allStitchPositions.sort((a, b) => a.orderNumber - b.orderNumber);
      
      // Make the lowest one the ready stitch
      if (allStitchPositions.length > 0) {
        const nextReady = allStitchPositions[0];
        console.log(`INTEGRITY FIX: Setting stitch ${nextReady.stitchId} in thread ${nextReady.threadId} as the new ready stitch (was position ${nextReady.orderNumber})`);
        
        // Update the stitch object
        nextReady.stitchObject.order_number = 0;
        
        // Update the order map
        if (nextReady.orderMapEntry) {
          nextReady.orderMapEntry.order_number = 0;
        }
        
        // Track the update
        this.trackUpdate(nextReady.threadId, nextReady.stitchId, {
          order_number: 0
        }, SyncTiming.IMMEDIATE);
      } else {
        console.error('Critical error: No stitches available to make ready!');
      }
    } else if (readyStitches.length > 1) {
      // Multiple ready stitches - this should never happen, but let's fix it anyway
      console.warn(`INTEGRITY FIX: Multiple ready stitches (${readyStitches.length}) found in tube. Keeping only the first one.`);
      
      // Log all the ready stitches for debugging
      readyStitches.forEach((rs, idx) => {
        console.warn(`  Ready stitch ${idx+1}: thread=${rs.threadId}, stitch=${rs.stitchId}`);
      });
      
      // Keep the first one ready, demote others
      let counter = 1;
      
      for (let i = 1; i < readyStitches.length; i++) {
        const extraReady = readyStitches[i];
        console.log(`INTEGRITY FIX: Demoting extra ready stitch ${extraReady.stitchId} in thread ${extraReady.threadId} to position ${counter}`);
        
        // Update the stitch object
        extraReady.stitchObject.order_number = counter;
        
        // Update the order map
        if (extraReady.orderMapEntry) {
          extraReady.orderMapEntry.order_number = counter;
        }
        
        // Track the update
        this.trackUpdate(extraReady.threadId, extraReady.stitchId, {
          order_number: counter
        }, SyncTiming.IMMEDIATE);
        
        counter++;
      }
    } else {
      console.log(`Tube has exactly one ready stitch: ${readyStitches[0].stitchId} in thread ${readyStitches[0].threadId}`);
    }
    
    // Increase the skip number for next time
    const currentSkipIndex = SKIP_SEQUENCE.indexOf(stitch.skip_number);
    const oldSkipNumber = stitch.skip_number;
    
    if (currentSkipIndex >= 0 && currentSkipIndex < SKIP_SEQUENCE.length - 1) {
      // Advance to the next skip number in the sequence, up to the maximum of 100
      stitch.skip_number = SKIP_SEQUENCE[currentSkipIndex + 1];
      console.log(`Advanced skip_number from ${oldSkipNumber} to ${stitch.skip_number} (next in sequence)`);
    } else if (stitch.skip_number === 100) {
      // Already at maximum, no change needed
      console.log(`Skip_number remains at max value (100)`);
    } else if (stitch.skip_number > 100 || stitch.skip_number < 0) {
      // If for some reason we have an invalid skip_number, reset to the maximum allowed
      console.log(`Resetting invalid skip_number ${stitch.skip_number} to max value of 100`);
      stitch.skip_number = 100;
    } else {
      // Not found in sequence, set to a reasonable value
      console.log(`Skip_number ${stitch.skip_number} not found in sequence, setting to default of 3`);
      stitch.skip_number = 3;
    }

    // Update distractor level if needed (distractor level only increases, never decreases)
    if (stitch.distractor_level === 'L1') {
      stitch.distractor_level = 'L2';
    } else if (stitch.distractor_level === 'L2') {
      stitch.distractor_level = 'L3';
    }

    // Track the update with immediate sync if forced
    this.trackUpdate(thread.thread_id, stitch.id, {
      order_number: stitch.order_number,
      skip_number: stitch.skip_number,
      distractor_level: stitch.distractor_level,
    }, this.options.forceSync ? SyncTiming.IMMEDIATE : SyncTiming.SCHEDULED);
    
    // If forced sync, do it immediately
    if (this.options.forceSync) {
      setTimeout(() => this.syncUpdates(), 100);
    }
  }
  
  /**
   * Verify the integrity of all tubes in the system
   * This checks that each tube has exactly one ready stitch
   * @returns An object containing integrity status for each tube
   */
  verifyAllTubesIntegrity(): { [tubeNumber: number]: { valid: boolean, readyStitchCount: number, threadCount: number } } {
    // Initialize result object for all 3 tubes
    const result: { [tubeNumber: number]: { valid: boolean, readyStitchCount: number, threadCount: number } } = {
      1: { valid: false, readyStitchCount: 0, threadCount: 0 },
      2: { valid: false, readyStitchCount: 0, threadCount: 0 },
      3: { valid: false, readyStitchCount: 0, threadCount: 0 }
    };
    
    // Step 1: Ensure all threads have a tube_number
    this.threadData.forEach((thread, index) => {
      if (!thread.tube_number || thread.tube_number < 1 || thread.tube_number > 3) {
        // Assign a tube_number based on thread name pattern or position
        let assignedTube = 1; // default to tube 1
        
        // Try to extract from thread ID (like "thread-A" -> Tube-1)
        const match = thread.thread_id.match(/thread-([A-Z])/);
        if (match && match[1]) {
          const letter = match[1];
          // Map specific thread letters to tube numbers:
          // A -> Tube-1
          // B -> Tube-2
          // C -> Tube-3
          // D -> Tube-3 (continuation of C)
          // E -> Tube-2 (continuation of B)
          // F -> Tube-1 (continuation of A)
          switch (letter) {
            case 'A': assignedTube = 1; break;
            case 'B': assignedTube = 2; break;
            case 'C': assignedTube = 3; break;
            case 'D': assignedTube = 3; break; // Same tube as C
            case 'E': assignedTube = 2; break; // Same tube as B
            case 'F': assignedTube = 1; break; // Same tube as A
            default:
              // Fallback for other letters
              const code = letter.charCodeAt(0) - 65; 
              assignedTube = (code % 3) + 1;
          }
        } else {
          // Even distribution across tubes
          // Convert index to number and then use modulo
          const indexNum = typeof index === 'number' ? index : 0;
          assignedTube = (indexNum % 3) + 1;
        }
        
        console.log(`Thread ${thread.thread_id} had no valid tube_number. Assigned to Tube-${assignedTube}`);
        
        // Directly modify the thread's tube_number
        thread.tube_number = assignedTube;
      }
    });
    
    // Step 2: Group threads by tube number
    const threadsByTube: { [key: number]: ThreadData[] } = {
      1: [],
      2: [],
      3: []
    };
    
    // Group all threads by tube number
    this.threadData.forEach((thread) => {
      const tubeNumber = thread.tube_number;
      threadsByTube[tubeNumber].push(thread);
    });
    
    // Log tube distribution
    console.log('Tube distribution check:');
    for (let i = 1; i <= 3; i++) {
      const count = threadsByTube[i].length;
      console.log(`Tube-${i}: ${count} threads`);
      result[i].threadCount = count;
    }
    
    // Step 3: Check each tube for ready stitches
    for (let tubeNumber = 1; tubeNumber <= 3; tubeNumber++) {
      const threads = threadsByTube[tubeNumber];
      const readyStitches: {thread: ThreadData, stitch: StitchWithProgress}[] = [];
      
      // Collect all ready stitches across all threads in this tube
      threads.forEach(thread => {
        thread.stitches.forEach(stitch => {
          if (stitch.order_number === 0) {
            readyStitches.push({thread, stitch});
          }
        });
      });
      
      const readyStitchCount = readyStitches.length;
      
      // Update result for this tube
      result[tubeNumber].readyStitchCount = readyStitchCount;
      result[tubeNumber].valid = readyStitchCount === 1;
      
      // Log detailed results
      if (readyStitchCount === 0) {
        // No ready stitches - this is a problem for tube cycling
        console.warn(`Tube-${tubeNumber} has no ready stitches. This will break the tube cycling pattern.`);
        
        // We could fix this, but let's just log it for now and let TubeCycler handle it
        console.log(`To fix: TubeCycler.verifyTubeReadyStitches() will repair this issue.`);
      } else if (readyStitchCount > 1) {
        // Multiple ready stitches - this will cause problems
        console.warn(`Tube-${tubeNumber} has ${readyStitchCount} ready stitches. This will cause problems with the tube cycling.`);
        
        // Log details of all ready stitches
        readyStitches.forEach((rs, i) => {
          console.warn(`  Ready stitch ${i+1}: Thread=${rs.thread.thread_id}, Stitch=${rs.stitch.id}`);
        });
        
        // We could fix this, but let's just log it for now and let TubeCycler handle it
        console.log(`To fix: TubeCycler.verifyTubeReadyStitches() will repair this issue by keeping the first ready stitch and demoting others.`);
      } else {
        console.log(`Tube-${tubeNumber} has exactly one ready stitch as required.`);
      }
    }
    
    return result;
  }
  
  /**
   * Get all threads that are in the same tube as the given thread
   * @param thread Thread to find related threads for
   * @returns Array of all threads in the same tube
   */
  private getThreadsInSameTube(thread: ThreadData): ThreadData[] {
    const tubeThreads: ThreadData[] = [];
    
    // Ensure thread has a valid tube_number
    if (!thread.tube_number || thread.tube_number < 1 || thread.tube_number > 3) {
      // Assign a tube number based on thread ID pattern if possible
      let assignedTube = 1; // default to tube 1
      
      // Try to extract from thread ID (like "thread-A" -> Tube-1)
      const match = thread.thread_id.match(/thread-([A-Z])/);
      if (match && match[1]) {
        const letter = match[1];
        // Map specific letters to tube numbers (one tube per letter)
        // A -> Tube-1
        // B -> Tube-2
        // C -> Tube-3
        // D -> Tube-3 (continuation of C)
        // E -> Tube-2 (continuation of B)
        // F -> Tube-1 (continuation of A)
        switch (letter) {
          case 'A': assignedTube = 1; break;
          case 'B': assignedTube = 2; break;
          case 'C': assignedTube = 3; break;
          case 'D': assignedTube = 3; break; // Same tube as C
          case 'E': assignedTube = 2; break; // Same tube as B
          case 'F': assignedTube = 1; break; // Same tube as A
          default:
            // Fallback for other letters
            const code = letter.charCodeAt(0) - 65; // A=0, B=1, etc.
            assignedTube = (code % 3) + 1;
        }
      }
      
      console.log(`Thread ${thread.thread_id} has no valid tube_number. Assigning to Tube-${assignedTube}`);
      thread.tube_number = assignedTube;
    }
    
    const threadTubeNumber = thread.tube_number;
    
    // Log for debugging
    console.log(`Finding threads in same tube as ${thread.thread_id} (Tube-${threadTubeNumber})`);
    
    // Find all threads with the same tube_number
    this.threadData.forEach((threadData) => {
      // Ensure each thread has a valid tube number
      if (!threadData.tube_number || threadData.tube_number < 1 || threadData.tube_number > 3) {
        // Similar pattern-based assignment logic as above
        let assignedTube = 1;
        const match = threadData.thread_id.match(/thread-([A-Z])/);
        if (match && match[1]) {
          const letter = match[1];
          // Map specific letters to tube numbers (one tube per letter)
          // A -> Tube-1
          // B -> Tube-2
          // C -> Tube-3
          // D -> Tube-3 (continuation of C)
          // E -> Tube-2 (continuation of B)
          // F -> Tube-1 (continuation of A)
          switch (letter) {
            case 'A': assignedTube = 1; break;
            case 'B': assignedTube = 2; break;
            case 'C': assignedTube = 3; break;
            case 'D': assignedTube = 3; break; // Same tube as C
            case 'E': assignedTube = 2; break; // Same tube as B
            case 'F': assignedTube = 1; break; // Same tube as A
            default:
              // Fallback for other letters
              const code = letter.charCodeAt(0) - 65; // A=0, B=1, etc.
              assignedTube = (code % 3) + 1;
          }
        }
        
        console.log(`Thread ${threadData.thread_id} has no valid tube_number. Assigning to Tube-${assignedTube}`);
        threadData.tube_number = assignedTube;
      }
      
      // Now check if this thread belongs to the same tube
      if (threadData.tube_number === threadTubeNumber) {
        tubeThreads.push(threadData);
      }
    });
    
    console.log(`Found ${tubeThreads.length} threads in Tube-${threadTubeNumber}`);
    
    // If we couldn't identify any threads in the same tube, just return the original thread
    if (tubeThreads.length === 0) {
      console.warn(`No threads found in Tube-${threadTubeNumber}, returning just the original thread`);
      tubeThreads.push(thread);
    }
    
    return tubeThreads;
  }
  
  /**
   * Get all stitches in the tube, sorted by order_number
   * This treats all stitches across all threads in the same tube as a continuous sequence
   * @param thread A thread in the target tube
   * @returns Array of all stitches in the tube, sorted by order_number
   */
  private getAllStitchesInTube(thread: ThreadData): StitchWithProgress[] {
    const tubeThreads = this.getThreadsInSameTube(thread);
    const allStitches: StitchWithProgress[] = [];
    
    // First, sort threads alphabetically by thread_id
    tubeThreads.sort((a, b) => {
      const letterA = a.thread_id.match(/thread-([A-Z])/)?.[1] || '';
      const letterB = b.thread_id.match(/thread-([A-Z])/)?.[1] || '';
      return letterA.localeCompare(letterB);
    });
    
    // Log thread ordering for debugging
    console.log(`Thread ordering for Tube-${thread.tube_number}: ${tubeThreads.map(t => t.thread_id).join(', ')}`);
    
    // Create a map to track which stitches belong to which thread
    interface ThreadStitch extends StitchWithProgress {
      _sourceThreadId?: string;
      _threadLetter?: string;
    }
    
    // Group stitches by thread first
    const stitchesByThread = new Map<string, ThreadStitch[]>();
    
    // Process each thread
    tubeThreads.forEach(tubeThread => {
      const threadId = tubeThread.thread_id;
      const threadLetter = threadId.match(/thread-([A-Z])/)?.[1] || '';
      
      // Create extended stitches with thread info
      const threadStitches: ThreadStitch[] = tubeThread.stitches.map(stitch => ({
        ...stitch,
        _sourceThreadId: threadId,
        _threadLetter: threadLetter
      }));
      
      // Sort stitches within this thread by order_number
      threadStitches.sort((a, b) => a.order_number - b.order_number);
      
      // Add to map
      stitchesByThread.set(threadLetter, threadStitches);
    });
    
    // Get thread letters in alphabetical order
    const orderedThreads = Array.from(stitchesByThread.keys()).sort();
    
    // Now add stitches in thread sequence order (all of thread A, then all of thread B, etc.)
    orderedThreads.forEach(threadLetter => {
      const threadStitches = stitchesByThread.get(threadLetter) || [];
      allStitches.push(...threadStitches);
      console.log(`Added ${threadStitches.length} stitches from thread ${threadLetter}`);
    });
    
    return allStitches;
  }

  /**
   * Track a stitch update for syncing later
   * @param threadId Thread ID
   * @param stitchId Stitch ID
   * @param updates Update data
   * @param timing When to sync this update
   */
  private trackUpdate(threadId: string, stitchId: string, updates: any, timing: SyncTiming = SyncTiming.SCHEDULED) {
    if (!this.pendingUpdates.has(threadId)) {
      this.pendingUpdates.set(threadId, new Map());
    }
    
    const threadUpdates = this.pendingUpdates.get(threadId)!;
    threadUpdates.set(stitchId, {
      ...(threadUpdates.get(stitchId) || {}),
      ...updates
    });
    
    // If immediate sync requested, do it now
    if (timing === SyncTiming.IMMEDIATE) {
      const currentTime = Date.now();
      // Avoid excessive syncing (limit to once per second)
      if (currentTime - this.lastSyncTime > 1000) {
        this.lastSyncTime = currentTime;
        setTimeout(() => this.syncUpdates(), 100);
      }
    }
  }

  /**
   * Start auto-syncing updates to the server
   */
  private startAutoSync() {
    if (this.syncTimeoutId) {
      clearTimeout(this.syncTimeoutId);
    }

    this.syncTimeoutId = setTimeout(async () => {
      await this.syncUpdates();
      this.startAutoSync(); // Schedule the next sync
    }, this.options.syncFrequency);
  }

  /**
   * Force an immediate sync regardless of schedule
   */
  forceSync(): Promise<boolean> {
    return this.syncUpdates();
  }

  /**
   * Sync pending updates to the server
   * @returns Promise that resolves when sync is complete
   */
  async syncUpdates(): Promise<boolean> {
    if (this.pendingUpdates.size === 0) {
      console.log('No pending updates to sync');
      return true;
    }

    // Track sync time
    this.lastSyncTime = Date.now();

    // Log syncing activity for debugging
    const threadCount = this.pendingUpdates.size;
    let stitchCount = 0;
    this.pendingUpdates.forEach(updates => {
      stitchCount += updates.size;
    });
    console.log(`Syncing ${stitchCount} stitch updates across ${threadCount} threads...`);

    const updatePromises: Promise<boolean>[] = [];

    // Process each thread's updates - use Array.from to handle iterator compatibility
    Array.from(this.pendingUpdates.entries()).forEach(([threadId, stitchUpdates]) => {
      // For each stitch in the thread
      Array.from(stitchUpdates.entries()).forEach(([stitchId, updates]) => {
        // Log individual updates for debugging
        console.log(`Syncing update for thread ${threadId}, stitch ${stitchId}:`, 
          JSON.stringify({
            order: updates.order_number, 
            skip: updates.skip_number, 
            level: updates.distractor_level
          })
        );
        
        // Send update to server with error handling for each individual update
        updatePromises.push(
          updateUserStitchProgress(
            this.userId,
            threadId,
            stitchId,
            updates.order_number,
            updates.skip_number,
            updates.distractor_level
          ).catch(err => {
            console.error(`Failed to update stitch ${stitchId} in thread ${threadId}:`, err);
            return false;
          })
        );
      });
    });

    try {
      // Wait for all updates to complete
      const results = await Promise.all(updatePromises);
      
      // Log results
      const successCount = results.filter(result => result).length;
      console.log(`Sync complete: ${successCount}/${results.length} updates successful`);
      
      // Clear pending updates if all successful
      if (results.every(result => result)) {
        this.pendingUpdates.clear();
        return true;
      } else {
        // Filter out successful updates to avoid retrying them
        // This is a bit complex because we need to maintain the nested Map structure
        // while removing only successful updates
        console.log('Some updates failed, keeping them for retry');
        
        // Keep track of which updates to keep
        const keepUpdates = new Map<string, Set<string>>();
        
        let i = 0;
        // Use Array.from for TypeScript compatibility
        Array.from(this.pendingUpdates.entries()).forEach(([threadId, stitchUpdates]) => {
          Array.from(stitchUpdates.entries()).forEach(([stitchId, _]) => {
            if (!results[i]) {
              // This update failed, keep it for retry
              if (!keepUpdates.has(threadId)) {
                keepUpdates.set(threadId, new Set());
              }
              keepUpdates.get(threadId)!.add(stitchId);
            }
            i++;
          });
        });
        
        // Create a new pendingUpdates Map with only the failed updates
        const newPendingUpdates = new Map<string, Map<string, any>>();
        
        // Use Array.from for TypeScript compatibility
        Array.from(keepUpdates.entries()).forEach(([threadId, stitchIds]) => {
          newPendingUpdates.set(threadId, new Map());
          // Convert Set to Array for iteration
          Array.from(stitchIds).forEach(stitchId => {
            const originalUpdates = this.pendingUpdates.get(threadId)!.get(stitchId);
            newPendingUpdates.get(threadId)!.set(stitchId, originalUpdates);
          });
        });
        
        this.pendingUpdates = newPendingUpdates;
        
        return false;
      }
    } catch (error) {
      console.error('Error syncing stitch updates:', error);
      return false;
    }
  }
}