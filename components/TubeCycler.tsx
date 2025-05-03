import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { StitchWithProgress, ThreadData, OrderMapEntry } from '../lib/types/distinction-learning';
import { StitchSequencer } from '../lib/StitchSequencer';

// Extend ThreadData with runtime properties for virtual tube assignment
interface ExtendedThreadData extends ThreadData {
  _virtualTube?: boolean;  // Whether tube_number was assigned virtually
  _dummyThread?: boolean;  // Whether this is a dummy thread added to ensure tube coverage
  _saved?: boolean;        // Whether this thread's position was saved
}

interface TubeCyclerProps {
  threadData: ThreadData[];
  userId: string;
  onStitchSelected: (stitch: StitchWithProgress | null, threadId: string) => void;
}

// Define the ref interface
export interface TubeCyclerRefHandle {
  nextTube: () => void;
  handleStitchCompletion: (threadId: string, stitchId: string, score: number, totalQuestions: number) => StitchWithProgress | null;
  getCurrentTube: () => string | null;
  getCurrentThread: () => string | null;
  getSortedThreads: () => ThreadData[];
  getCycleCount: () => number;
  checkTubeIntegrity: () => { [tubeNumber: number]: { valid: boolean, readyStitchCount: number } } | null;
  setCurrentTubeIndex: (index: number) => void; // Method to set tube index directly
  goToTubeNumber: (tubeNumber: number) => boolean; // Method to go to a specific tube by number
}

/**
 * TubeCycler - Cycles through tubes in order (A -> B -> C -> A)
 * and selects the ready stitch from the current tube
 * 
 * The player always has exactly 3 tubes (A, B, C)
 * Each tube contains one or more threads, with their stitches in order
 * Each tube has exactly one ready stitch (order_number = 0) at any time
 * When a stitch is completed, it moves further down the tube based on performance
 * and the next stitch in sequence becomes the ready stitch (order_number = 0)
 * 
 * Important: A tube is a continuous sequence of positions. Stitches move within
 * the tube as a whole, not just within their thread. When a stitch's skip number
 * would move it beyond its thread, it simply ends up in a position that might
 * be occupied by a stitch from a different thread in the same tube.
 */
const TubeCycler = forwardRef<TubeCyclerRefHandle, TubeCyclerProps>(
  ({ threadData, userId, onStitchSelected }, ref) => {
    const [sequencer, setSequencer] = useState<StitchSequencer | null>(null);
    const [currentTubeIndex, _setCurrentTubeIndex] = useState(0);
    const [cycleCount, setCycleCount] = useState(0);
    const [sortedThreads, setSortedThreads] = useState<ExtendedThreadData[]>([]);
    
    // Create a wrapped version of setCurrentTubeIndex that logs all state changes
    const setCurrentTubeIndex = (indexOrFunc: number | ((prev: number) => number)) => {
      console.log(`TUBE INDEX DEBUG: setCurrentTubeIndex called with: ${typeof indexOrFunc === 'function' ? 'function' : indexOrFunc}`);
      console.log(`TUBE INDEX DEBUG: Current value is: ${currentTubeIndex}`);
      console.log(`TUBE INDEX DEBUG: Stack trace: ${new Error().stack}`);
      
      if (typeof indexOrFunc === 'function') {
        _setCurrentTubeIndex(prev => {
          const newValue = indexOrFunc(prev);
          console.log(`TUBE INDEX DEBUG: Function returned new value: ${newValue}`);
          return newValue;
        });
      } else {
        _setCurrentTubeIndex(indexOrFunc);
      }
    };

    // Expose component methods via ref
    useImperativeHandle(ref, () => ({
      // Move to the next tube in the cycle
      nextTube: () => {
        nextTube();
        return true;
      },
      
      // Handle stitch completion and cycle to next tube
      handleStitchCompletion: (threadId, stitchId, score, totalQuestions) => {
        return handleStitchCompletion(threadId, stitchId, score, totalQuestions);
      },
      
      // Get current tube ID (Tube-1, Tube-2, Tube-3 or A, B, C)
      getCurrentTube: () => {
        const currentThread = sortedThreads[currentTubeIndex];
        
        if (!currentThread) return null;
        
        // Always use tube_number if available (should always be available with our virtual property)
        const tubeNumber = currentThread.tube_number || (currentTubeIndex + 1);
        const tubeLetter = getTubeLetter(tubeNumber);
        
        // Return just the tube number without letter
        return `Tube-${tubeNumber}`;
      },
      
      // Get current thread ID
      getCurrentThread: () => {
        return sortedThreads[currentTubeIndex]?.thread_id || null;
      },
      
      // Get alphabetically sorted threads
      getSortedThreads: () => {
        return sortedThreads;
      },
      
      // Get the number of complete cycles
      getCycleCount: () => {
        return cycleCount;
      },
      
      // Check tube integrity across all tubes
      checkTubeIntegrity: () => {
        if (!sequencer) return null;
        return sequencer.verifyAllTubesIntegrity();
      },

      // Set current tube index directly (useful for debugging and diagnostic tools)
      setCurrentTubeIndex: (index: number) => {
        console.log(`Setting current tube index directly to ${index}`);
        
        // Validate the index is within bounds
        if (index < 0 || index >= sortedThreads.length) {
          console.error(`Invalid tube index: ${index}. Must be between 0 and ${sortedThreads.length - 1}`);
          return false;
        }
        
        // Get the thread and tube number at this index
        const thread = sortedThreads[index];
        const tubeNumber = thread.tube_number || (index + 1);
        
        console.log(`Changing to thread ${thread.thread_id} in Tube-${tubeNumber}`);
        
        // Save the current tube position before moving
        const currentThreadForPosition = sortedThreads[currentTubeIndex];
        if (currentThreadForPosition && currentThreadForPosition.tube_number) {
          // Import saveTubePosition dynamically to avoid circular dependencies
          import('../lib/supabase-client').then(({ saveTubePosition }) => {
            console.log(`Saving current tube position: Tube-${currentThreadForPosition.tube_number}, Thread-${currentThreadForPosition.thread_id}`);
            saveTubePosition(userId, currentThreadForPosition.tube_number, currentThreadForPosition.thread_id)
              .catch(error => {
                console.error(`Error saving tube position: ${error}`, error);
              });
          });
        }
        
        // Update current index
        setCurrentTubeIndex(index);
        
        // Log the change
        console.log(`Current tube index set to ${index} (Tube-${tubeNumber})`);
        
        return true;
      },
      
      // Go to a specific tube by tube number (1, 2, or 3)
      goToTubeNumber: (tubeNumber: number) => {
        console.log(`Attempting to go directly to Tube-${tubeNumber}`);
        
        // Validate tube number
        if (tubeNumber < 1 || tubeNumber > 3) {
          console.error(`Invalid tube number: ${tubeNumber}. Must be 1, 2, or 3.`);
          return false;
        }
        
        // Find the first thread in the target tube
        const targetThreadIndex = sortedThreads.findIndex(thread => thread.tube_number === tubeNumber);
        
        if (targetThreadIndex === -1) {
          console.error(`No threads found in Tube-${tubeNumber}`);
          
          // EMERGENCY FIX: Create a dummy thread for this tube
          console.warn(`Emergency fix: Creating a dummy thread for Tube-${tubeNumber}`);
          
          // Find a thread to clone
          if (sortedThreads.length > 0) {
            const sourceThread = sortedThreads[0];
            
            // Create a deep clone with modified tube_number
            const dummyThread: ExtendedThreadData = {
              ...JSON.parse(JSON.stringify(sourceThread)), // Deep clone
              thread_id: `dummy-thread-${tubeNumber}`,
              tube_number: tubeNumber,
              _virtualTube: true,
              _dummyThread: true
            };
            
            // Add to sortedThreads
            const newSortedThreads = [...sortedThreads, dummyThread];
            
            // Sort by tube_number
            newSortedThreads.sort((a, b) => a.tube_number - b.tube_number);
            
            // Update state
            setSortedThreads(newSortedThreads);
            
            // Find the index of the new dummy thread
            const dummyIndex = newSortedThreads.findIndex(thread => thread.thread_id === dummyThread.thread_id);
            
            if (dummyIndex !== -1) {
              // Set current tube index to the dummy thread
              setCurrentTubeIndex(dummyIndex);
              console.log(`Set current tube to dummy thread at index ${dummyIndex}`);
              return true;
            }
          }
          
          return false;
        }
        
        // Set the current tube index to the first thread in the target tube
        setCurrentTubeIndex(targetThreadIndex);
        console.log(`Successfully moved to Tube-${tubeNumber} (thread index ${targetThreadIndex})`);
        
        return true;
      }
    }));

    // Initialize sequencer and sort threads
    useEffect(() => {
      if (threadData && threadData.length > 0) {
        // CRITICAL PERSISTENCE DEBUG: Log initial tube cycling setup
        console.log('CRITICAL PERSISTENCE: TubeCycler initializing with', {
          userId,
          threadCount: threadData.length,
          timestamp: new Date().toISOString(),
          threadIds: threadData.map(t => t.thread_id).join(', '),
          tubeNumbers: threadData.map(t => t.tube_number).join(', ')
        });
        
        // Check for saved tube position
        let initialTubeIndex = 0;
        let savedTubePosition: {tubeNumber: number, threadId: string, timestamp?: number} | undefined;
        
        // Try to load from localStorage first (for immediate response)
        try {
          const localState = localStorage.getItem('zenjin_current_tube');
          if (localState) {
            const parsedState = JSON.parse(localState);
            if (parsedState && parsedState.userId === userId) {
              savedTubePosition = {
                tubeNumber: parsedState.tubeNumber,
                threadId: parsedState.threadId,
                timestamp: parsedState.timestamp
              };
              console.log(`Found saved tube position in localStorage: Tube-${savedTubePosition.tubeNumber}, Thread-${savedTubePosition.threadId}`);
            }
          }
        } catch (err) {
          console.error('Error loading saved position from localStorage:', err);
        }
        
        // Find any thread that has a user_tube_position property from the API
        const threadWithPosition = threadData.find(thread => 
          thread._savedTubePosition === true
        );
        
        if (threadWithPosition) {
          // Create a timestamp from the thread's updated_at if available
          const dbTimestamp = threadWithPosition._savedTimestamp ? 
            new Date(threadWithPosition._savedTimestamp).getTime() : 0;
          
          // Only use database position if it's more recent than localStorage
          if (!savedTubePosition || !savedTubePosition.timestamp || dbTimestamp > savedTubePosition.timestamp) {
            savedTubePosition = {
              tubeNumber: threadWithPosition.tube_number || 1,
              threadId: threadWithPosition.thread_id,
              timestamp: dbTimestamp
            };
            console.log(`Found more recent saved tube position from database: Tube-${savedTubePosition.tubeNumber}, Thread-${savedTubePosition.threadId}`);
          } else {
            console.log(`Using localStorage tube position as it's more recent than database position`);
          }
        }
        
        // Create new sequencer with forced sync for better persistence
        const newSequencer = new StitchSequencer(threadData, userId, { 
          syncFrequency: 10000,  // 10 seconds
          forceSync: true        // Force sync after important changes
        }, savedTubePosition);
        setSequencer(newSequencer);
        
        // Sort threads by tube_number, add virtual tube_number if needed
        let sorted: ExtendedThreadData[] = [...threadData].map(thread => {
          // Ensure every thread has a valid tube_number
          if (thread.tube_number === undefined || thread.tube_number < 1 || thread.tube_number > 3) {
            // Extract letter from thread ID (thread-A -> A, thread-B -> B, etc.)
            const letter = thread.thread_id.match(/thread-([A-Z])/)?.[1] || '';
            
            // Map specific letters to tube numbers (one tube per letter)
            // A -> Tube-1
            // B -> Tube-2
            // C -> Tube-3
            // D -> Tube-3 (continuation of C)
            // E -> Tube-2 (continuation of B)
            // F -> Tube-1 (continuation of A)
            // This ensures threads appear in sequence within each tube
            let virtualTubeNumber = 1; // Default to tube 1
            if (letter) {
              switch (letter) {
                case 'A': virtualTubeNumber = 1; break;
                case 'B': virtualTubeNumber = 2; break;
                case 'C': virtualTubeNumber = 3; break;
                case 'D': virtualTubeNumber = 3; break; // Same tube as C
                case 'E': virtualTubeNumber = 2; break; // Same tube as B
                case 'F': virtualTubeNumber = 1; break; // Same tube as A
                default:
                  // Fallback for other letters
                  const charCode = letter.charCodeAt(0) - 65; // A=0, B=1, etc.
                  virtualTubeNumber = (charCode % 3) + 1; // Map to 1, 2, 3 with wraparound
              }
            }
            
            // Create a copy of thread data with valid tube_number added
            const threadWithValidTube: ExtendedThreadData = {
              ...thread,
              tube_number: virtualTubeNumber,
              _virtualTube: true // Mark that this was calculated virtually
            };
            
            console.log(`Assigned thread ${thread.thread_id} to Tube-${virtualTubeNumber} (virtual assignment)`);
            return threadWithValidTube;
          }
          
          // Thread already has a valid tube_number - return as is
          console.log(`Thread ${thread.thread_id} is assigned to Tube-${thread.tube_number} (from database)`);
          return {
            ...thread,
            tube_number: thread.tube_number, // Ensure tube_number is included
            _virtualTube: false
          } as ExtendedThreadData;
        })
        // Sort threads by tube_number
        .sort((a, b) => a.tube_number - b.tube_number);
        
        // CRITICAL FIX: Ensure each tube (1, 2, 3) has at least one thread
        // Otherwise tube cycling cannot work
        const tubeDistribution = {
          1: sorted.filter(t => t.tube_number === 1).length,
          2: sorted.filter(t => t.tube_number === 2).length,
          3: sorted.filter(t => t.tube_number === 3).length
        };
        
        console.log('Initial tube distribution:', tubeDistribution);
        
        // Find any tubes with no threads assigned
        const emptyTubes = [];
        if (tubeDistribution[1] === 0) emptyTubes.push(1);
        if (tubeDistribution[2] === 0) emptyTubes.push(2);
        if (tubeDistribution[3] === 0) emptyTubes.push(3);
        
        // If any tubes are empty, we need to distribute threads to ensure all 3 tubes are populated
        if (emptyTubes.length > 0) {
          console.warn(`Found empty tubes: ${emptyTubes.join(', ')}. Redistributing threads to ensure proper tube cycling.`);
          
          // Use evenly distributed assignments for all threads
          sorted = sorted.map((thread, index) => ({
            ...thread,
            tube_number: (index % 3) + 1, // Simple modulo distribution: 1, 2, 3, 1, 2, 3, ...
            _virtualTube: true // Mark as virtually assigned
          }));
          
          // Check the new distribution
          const newDistribution = {
            1: sorted.filter(t => t.tube_number === 1).length,
            2: sorted.filter(t => t.tube_number === 2).length,
            3: sorted.filter(t => t.tube_number === 3).length
          };
          
          console.log('Redistributed tubes:', newDistribution);
          
          // If we still have empty tubes after redistribution, create dummy threads for those tubes
          // This is a last resort to ensure tube cycling works
          for (const tubeNumber of emptyTubes) {
            if (sorted.filter(t => t.tube_number === tubeNumber).length === 0) {
              console.warn(`Tube-${tubeNumber} is still empty after redistribution. Creating a dummy thread.`);
              
              // Find a thread to clone and modify
              const sourceThread = sorted[0];
              
              if (sourceThread) {
                // Create a copy with modified tube assignment
                const dummyThread: ExtendedThreadData = {
                  ...JSON.parse(JSON.stringify(sourceThread)), // Deep clone
                  thread_id: `dummy-thread-${tubeNumber}`,
                  tube_number: tubeNumber,
                  _virtualTube: true,
                  _dummyThread: true
                };
                
                // Ensure this dummy thread has at least one ready stitch
                if (dummyThread.stitches && dummyThread.stitches.length > 0) {
                  // Set the first stitch as ready
                  dummyThread.stitches[0].order_number = 0;
                  
                  // Update order map
                  if (dummyThread.orderMap && dummyThread.orderMap.length > 0) {
                    dummyThread.orderMap[0].order_number = 0;
                  }
                  
                  console.log(`Set ready stitch in dummy thread for Tube-${tubeNumber}: ${dummyThread.stitches[0].id}`);
                }
                
                // Add to sorted threads
                sorted.push(dummyThread);
                console.log(`Created dummy thread for Tube-${tubeNumber}: ${dummyThread.thread_id}`);
              }
            }
          }
          
          // Re-sort by tube number
          sorted.sort((a, b) => a.tube_number - b.tube_number);
        }
        
        // Verify that each tube has at least one thread with a ready stitch
        // This is critical for proper tube cycling
        for (let tubeNumber = 1; tubeNumber <= 3; tubeNumber++) {
          const tubeThreads = sorted.filter(t => t.tube_number === tubeNumber);
          
          // Skip if tube has no threads (shouldn't happen with fixes above)
          if (tubeThreads.length === 0) {
            continue;
          }
          
          // Check if any thread in this tube has a ready stitch
          const hasReadyStitch = tubeThreads.some(thread => 
            thread.stitches.some(stitch => stitch.order_number === 0)
          );
          
          // If no ready stitch in this tube, fix it
          if (!hasReadyStitch) {
            console.warn(`No ready stitch found in Tube-${tubeNumber}. Creating one.`);
            
            // Find the first thread in this tube
            const firstThread = tubeThreads[0];
            
            // If thread has stitches, make the first one ready
            if (firstThread.stitches && firstThread.stitches.length > 0) {
              // Find the stitch with lowest order number
              const stitches = [...firstThread.stitches].sort((a, b) => a.order_number - b.order_number);
              const firstStitch = stitches[0];
              
              // Set it as ready
              firstStitch.order_number = 0;
              
              // Update order map
              const orderMapEntry = firstThread.orderMap.find(e => e.stitch_id === firstStitch.id);
              if (orderMapEntry) {
                orderMapEntry.order_number = 0;
              }
              
              console.log(`Set stitch ${firstStitch.id} as ready in thread ${firstThread.thread_id} for Tube-${tubeNumber}`);
            } else {
              // If no stitches, this is a serious issue - create a new dummy stitch
              console.error(`Thread ${firstThread.thread_id} in Tube-${tubeNumber} has no stitches! Creating dummy stitch.`);
              
              // Create a dummy stitch
              // Use any to bypass type checking for emergency dummy stitch
              const dummyStitch: any = {
                id: `emergency-stitch-${Date.now()}`,
                content_id: "dummy-content",
                order_number: 0,
                skip_number: 3,
                distractor_level: "L1",
                completed: false,
                accuracy: 0,
                questions: []
              };
              
              // Add the stitch to the thread
              firstThread.stitches.push(dummyStitch);
              
              // Create an order map entry
              const orderMapEntry: OrderMapEntry = {
                stitch_id: dummyStitch.id,
                order_number: 0
              };
              
              // Add to order map
              if (!firstThread.orderMap) {
                firstThread.orderMap = [];
              }
              
              firstThread.orderMap.push(orderMapEntry);
              
              console.log(`Created emergency stitch ${dummyStitch.id} in thread ${firstThread.thread_id} for Tube-${tubeNumber}`);
            }
          }
        }
        
        // Log tube assignments for debugging
        if (process.env.NODE_ENV === 'development') {
          sorted.forEach(thread => {
            const source = thread._virtualTube === true ? 'thread ID pattern' : 'database field';
            console.log(`Thread ${thread.thread_id} -> Tube-${thread.tube_number} (from ${source})`);
          });
        }
        
        setSortedThreads(sorted);
        
        // Log thread ordering
        if (process.env.NODE_ENV === 'development') {
          console.log('Thread order:', sorted.map(t => t.thread_id).join(' -> '));
        }
        
        // If we have a saved tube position, set the current tube index to match
        if (savedTubePosition) {
          const savedThreadIndex = sorted.findIndex(
            thread => thread.thread_id === savedTubePosition.threadId &&
                      thread.tube_number === savedTubePosition.tubeNumber
          );
          
          if (savedThreadIndex >= 0) {
            console.log(`Restoring tube position to index ${savedThreadIndex} (Thread ${savedTubePosition.threadId}, Tube-${savedTubePosition.tubeNumber})`);
            // Set the current tube index after a short delay to ensure the component has mounted
            setTimeout(() => setCurrentTubeIndex(savedThreadIndex), 100);
            
            // Also persist to localStorage to ensure consistency
            try {
              localStorage.setItem('zenjin_current_tube', JSON.stringify({
                userId,
                tubeNumber: savedTubePosition.tubeNumber,
                threadId: savedTubePosition.threadId,
                timestamp: Date.now()
              }));
              console.log(`Updated localStorage with restored tube position`);
            } catch (err) {
              console.error('Error saving tube position to localStorage:', err);
            }
          } else {
            // If no saved position, always start with Tube-1
            const tube1Index = sorted.findIndex(thread => thread.tube_number === 1);
            if (tube1Index >= 0) {
              console.log(`No saved position found in threads, starting with Tube-1 at index ${tube1Index}`);
              setTimeout(() => setCurrentTubeIndex(tube1Index), 100);
            }
          }
        } else {
          // If no saved position, always start with Tube-1
          const tube1Index = sorted.findIndex(thread => thread.tube_number === 1);
          if (tube1Index >= 0) {
            console.log(`No saved position, starting with Tube-1 at index ${tube1Index}`);
            setTimeout(() => setCurrentTubeIndex(tube1Index), 100);
          }
        }
      }
      
      // Cleanup
      return () => {
        if (sequencer) {
          sequencer.destroy();
        }
      };
    }, [threadData, userId]);
    
    // Session end & window close handling to ensure state is saved when user leaves
    useEffect(() => {
      // Handle page unload/close
      const handleUnload = () => {
        if (!sortedThreads || sortedThreads.length === 0) {
          console.error('CRITICAL PERSISTENCE: No sorted threads available during unload');
          return;
        }
        
        // Get the current thread for the final save
        const currentThread = sortedThreads[currentTubeIndex];
        if (!currentThread || !currentThread.tube_number) {
          console.error('CRITICAL PERSISTENCE: Invalid current thread during unload', { 
            index: currentTubeIndex, 
            threadCount: sortedThreads.length,
            threadIds: sortedThreads.map(t => t.thread_id).join(',')
          });
          return;
        }
        
        // Get the current stitch for the final save
        const activeStitch = sequencer?.getReadyStitch(currentThread.thread_id);
        
        console.log(`CRITICAL PERSISTENCE: Saving final state at Tube-${currentThread.tube_number}, Thread-${currentThread.thread_id}, Stitch-${activeStitch?.id || 'unknown'}`);
        console.log(`CRITICAL PERSISTENCE: Full state snapshot at exit:`, {
          userId,
          tubeNumber: currentThread.tube_number,
          threadId: currentThread.thread_id,
          stitchId: activeStitch?.id || 'unknown',
          orderNumber: activeStitch?.order_number,
          skipNumber: activeStitch?.skip_number,
          timestamp: new Date().toISOString()
        });
        
        // STEP 1: Sync localStorage one last time
        try {
          // Save tube position
          localStorage.setItem('zenjin_current_tube', JSON.stringify({
            userId,
            tubeNumber: currentThread.tube_number,
            threadId: currentThread.thread_id,
            timestamp: Date.now()
          }));
          
          // Also save active stitch state for better persistence
          if (activeStitch) {
            localStorage.setItem('zenjin_active_stitch', JSON.stringify({
              userId,
              threadId: currentThread.thread_id,
              stitchId: activeStitch.id,
              orderNumber: activeStitch.order_number || 0,
              skipNumber: activeStitch.skip_number || 3,
              distractorLevel: activeStitch.distractor_level || 'L1',
              timestamp: Date.now()
            }));
          }
          
          console.log('CRITICAL PERSISTENCE: Successfully saved state to localStorage');
        } catch (err) {
          console.error('CRITICAL PERSISTENCE: Error saving to localStorage:', err);
        }
        
        // STEP 1B: Force an immediate update to the database for the active stitch
        if (activeStitch) {
          try {
            // Dynamically import to avoid circular dependencies
            import('../lib/supabase-client').then(({ updateUserStitchProgress }) => {
              updateUserStitchProgress(
                userId,
                currentThread.thread_id,
                activeStitch.id,
                activeStitch.order_number || 0,
                activeStitch.skip_number || 3,
                activeStitch.distractor_level || 'L1',
                true // Urgent - synchronous
              );
            });
          } catch (err) {
            console.error('CRITICAL PERSISTENCE: Error force-saving active stitch:', err);
          }
        }
        
        // STEP 2: Try to use the synchronous sendBeacon API for last-chance saves
        try {
          // Create a blob with the tube position data
          const blob = new Blob([JSON.stringify({
            userId,
            tubeNumber: currentThread.tube_number,
            threadId: currentThread.thread_id
          })], { type: 'application/json' });
          
          // Use the Beacon API for a "fire-and-forget" save
          // This has a higher chance of completing during page unload
          const beaconSuccess = navigator.sendBeacon('/api/save-tube-position', blob);
          console.log(`CRITICAL PERSISTENCE: Tube position Beacon API ${beaconSuccess ? 'succeeded' : 'failed'}`);
          
          // Also send the active stitch data via beacon for better persistence
          if (activeStitch) {
            const stitchBlob = new Blob([JSON.stringify({
              userId,
              threadId: currentThread.thread_id,
              stitchId: activeStitch.id,
              orderNumber: activeStitch.order_number || 0,
              skipNumber: activeStitch.skip_number || 3,
              distractorLevel: activeStitch.distractor_level || 'L1'
            })], { type: 'application/json' });
            
            const stitchBeaconSuccess = navigator.sendBeacon('/api/update-progress', stitchBlob);
            console.log(`CRITICAL PERSISTENCE: Stitch state Beacon API ${stitchBeaconSuccess ? 'succeeded' : 'failed'}`);
          }
        } catch (err) {
          console.error('SESSION END: Error using sendBeacon:', err);
        }
        
        // STEP 3: Also save to IndexedDB if available (as another layer of persistence)
        try {
          const openRequest = window.indexedDB.open('zenjin_state_db', 1);
          
          openRequest.onsuccess = (event) => {
            try {
              const db = openRequest.result;
              const transaction = db.transaction(['tube_state'], 'readwrite');
              const store = transaction.objectStore('tube_state');
              
              // Store the data with a unique key based on userId
              store.put({
                key: `tube_position_${userId}`,
                data: {
                  userId,
                  tubeNumber: currentThread.tube_number,
                  threadId: currentThread.thread_id,
                  timestamp: Date.now()
                }
              });
            } catch (inner) {
              // Silent fail - we're already in unload handler
            }
          };
        } catch (dbErr) {
          // Silent fail during unload
        }
      };
      
      // Add event listeners for various ways a session can end
      window.addEventListener('beforeunload', handleUnload);
      window.addEventListener('pagehide', handleUnload);
      window.addEventListener('unload', handleUnload);
      
      // Create a persistent tracking object for visibility changes
      if (typeof window !== 'undefined' && !window.__ZENJIN_VISIBILITY_TRACKED) {
        window.__ZENJIN_VISIBILITY_TRACKED = true;
        
        // Handle visibility change (user switching tabs/apps)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            // When page becomes hidden, there's a chance user may not return
            handleUnload();
          }
        });
      }
      
      return () => {
        window.removeEventListener('beforeunload', handleUnload);
        window.removeEventListener('pagehide', handleUnload);
        window.removeEventListener('unload', handleUnload);
      };
    }, [currentTubeIndex, sortedThreads, userId]);

    // Handle tube cycling - COMPLETELY REDESIGNED for maximum reliability
    useEffect(() => {
      if (!sequencer || sortedThreads.length === 0) return;
      
      console.log('TUBE INITIALIZATION: Beginning tube cycling system startup');
      
      // STEP 1: First try to load from localStorage for immediate state restoration
      let initialTubePosition = null;
      
      try {
        const savedState = localStorage.getItem('zenjin_current_tube');
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          if (parsedState.userId === userId) {
            initialTubePosition = {
              tubeNumber: parsedState.tubeNumber,
              threadId: parsedState.threadId,
              timestamp: parsedState.timestamp
            };
            console.log('TUBE INITIALIZATION: Loaded tube position from localStorage:', initialTubePosition);
          }
        }
      } catch (err) {
        console.error('TUBE INITIALIZATION: Error parsing localStorage tube state:', err);
      }
      
      // STEP 2: Verify that tube integrity is intact
      // This ensures each tube has exactly one ready stitch
      verifyTubeIntegrity();
      
      // Also use sequencer's more thorough verification for additional validation
      const tubeIntegrityStatus = sequencer.verifyAllTubesIntegrity();
      console.log('TUBE INITIALIZATION: Full integrity check results:', tubeIntegrityStatus);
      
      // STEP 3: Load the saved position from last session and ensure it's correctly initialized
      // At this point currentTubeIndex might have been set during the initialization phase
      // from the threadData's _savedTubePosition flag
      
      // Get the current thread and validate it
      const threadId = sortedThreads[currentTubeIndex]?.thread_id;
      if (!threadId) {
        console.error('TUBE INITIALIZATION: No thread at current index, checking for saved state');
        
        // If we have a saved position from localStorage, use that
        if (initialTubePosition) {
          console.log(`TUBE INITIALIZATION: Using saved position from localStorage: Tube-${initialTubePosition.tubeNumber}, Thread-${initialTubePosition.threadId}`);
          
          // Find the thread index for this saved position
          const savedThreadIndex = sortedThreads.findIndex(t => 
            t.thread_id === initialTubePosition.threadId && 
            t.tube_number === initialTubePosition.tubeNumber
          );
          
          if (savedThreadIndex >= 0) {
            setCurrentTubeIndex(savedThreadIndex);
            return; // Exit and let the effect run again with the saved index
          }
        }
        
        // Find first thread in Tube-1 as fallback
        const tube1Index = sortedThreads.findIndex(t => t.tube_number === 1);
        if (tube1Index >= 0) {
          setCurrentTubeIndex(tube1Index);
        } else {
          // If no Tube-1 threads, just use the first thread
          setCurrentTubeIndex(0);
        }
        return; // Exit and let the effect run again with the correct index
      }
      
      // Get the tube number and log details
      const currentThread = sortedThreads[currentTubeIndex];
      const currentTubeNumber = currentThread?.tube_number || 1; // Default to Tube-1 if undefined
      
      // Check if we should override with localStorage position because it's more recent
      if (initialTubePosition && initialTubePosition.timestamp) {
        // Only override if localStorage state is from current user
        const dbTimestamp = currentThread?._savedTimestamp ? new Date(currentThread._savedTimestamp).getTime() : 0;
        const localTimestamp = initialTubePosition.timestamp;
        
        if (localTimestamp > dbTimestamp) {
          console.log(`TUBE INITIALIZATION: localStorage position is more recent than database position`);
          
          // Find the thread for the saved position
          const savedThreadIndex = sortedThreads.findIndex(t => 
            t.thread_id === initialTubePosition.threadId &&
            t.tube_number === initialTubePosition.tubeNumber
          );
          
          if (savedThreadIndex >= 0 && savedThreadIndex !== currentTubeIndex) {
            console.log(`TUBE INITIALIZATION: Switching to saved position from localStorage: Tube-${initialTubePosition.tubeNumber}`);
            setCurrentTubeIndex(savedThreadIndex);
            return; // Exit and let the effect run again with the correct index
          }
        } else {
          console.log(`TUBE INITIALIZATION: Database position is more recent than localStorage position, using DB state`);
        }
      }
      
      console.log(`TUBE INITIALIZATION: Starting at Tube-${currentTubeNumber}, Thread-${threadId}`);
      
      // STEP 4: Get and validate the ready stitch for this thread
      const readyStitch = sequencer.getReadyStitch(threadId);
      
      console.log(`TUBE INITIALIZATION: Current tube: Tube-${currentTubeNumber}, Thread: ${threadId}, Ready stitch: ${readyStitch?.id || 'none'}`);
      
      // STEP 5: Save the current position to localStorage for persistence redundancy
      try {
        localStorage.setItem('zenjin_current_tube', JSON.stringify({
          userId,
          tubeNumber: currentTubeNumber,
          threadId: threadId,
          timestamp: Date.now()
        }));
        console.log(`TUBE INITIALIZATION: Saved current position to localStorage: Tube-${currentTubeNumber}, Thread-${threadId}`);
      } catch (err) {
        console.error('TUBE INITIALIZATION: Error saving to localStorage:', err);
      }
      
      // STEP 6: If no ready stitch exists, attempt comprehensive repair
      if (!readyStitch) {
        console.warn(`TUBE INITIALIZATION: No ready stitch in thread ${threadId}, initiating thorough repair...`);
        
        // STEP 6A: First try - look for the lowest order_number stitch in this thread
        const sortedStitches = [...currentThread.stitches].sort((a, b) => a.order_number - b.order_number);
        
        if (sortedStitches.length > 0) {
          const lowestStitch = sortedStitches[0];
          console.log(`TUBE REPAIR: Setting stitch ${lowestStitch.id} as ready in thread ${threadId}`);
          
          // Set this stitch as ready
          lowestStitch.order_number = 0;
          
          // Update order map
          const orderMapEntry = currentThread.orderMap.find(entry => entry.stitch_id === lowestStitch.id);
          if (orderMapEntry) {
            orderMapEntry.order_number = 0;
          }
          
          // Force immediate sync to ensure persistence
          if (sequencer) {
            sequencer.forceSync();
            // Schedule additional syncs with delays to ensure it sticks
            setTimeout(() => sequencer.forceSync(), 100);
            setTimeout(() => sequencer.forceSync(), 500);
          }
          
          // Notify parent of the repaired ready stitch
          onStitchSelected(lowestStitch, threadId);
          return;
        }
        
        // STEP 6B: If we couldn't repair this thread, check if ANY thread in this tube has a ready stitch
        console.warn(`TUBE REPAIR: Could not find any stitch in thread ${threadId}. Checking other threads in Tube-${currentTubeNumber}`);
        
        // Find all threads in the current tube
        const tubeThreads = sortedThreads.filter(t => t.tube_number === currentTubeNumber);
        
        let foundReadyStitchInTube = false;
        for (const tubeThread of tubeThreads) {
          if (tubeThread.thread_id === threadId) continue; // Skip the current thread
          
          const tubeReadyStitch = sequencer.getReadyStitch(tubeThread.thread_id);
          if (tubeReadyStitch) {
            // Found a ready stitch in another thread in this tube
            console.log(`TUBE REPAIR: Found ready stitch in another thread (${tubeThread.thread_id}) in Tube-${currentTubeNumber}`);
            
            // Switch to this thread as it has a ready stitch
            const newThreadIndex = sortedThreads.findIndex(t => t.thread_id === tubeThread.thread_id);
            if (newThreadIndex >= 0) {
              console.log(`TUBE REPAIR: Switching to thread ${tubeThread.thread_id} with index ${newThreadIndex}`);
              
              // Save to localStorage before changing
              try {
                localStorage.setItem('zenjin_current_tube', JSON.stringify({
                  userId,
                  tubeNumber: currentTubeNumber,
                  threadId: tubeThread.thread_id,
                  timestamp: Date.now()
                }));
              } catch (err) {
                console.error('TUBE REPAIR: Error saving to localStorage:', err);
              }
              
              setCurrentTubeIndex(newThreadIndex);
              foundReadyStitchInTube = true;
              break;
            }
          }
        }
        
        // STEP 6C: If we still couldn't find a ready stitch in any thread in this tube, move to next tube
        if (!foundReadyStitchInTube) {
          console.warn(`TUBE REPAIR: No ready stitch in any thread in Tube-${currentTubeNumber}. Cycling to next tube.`);
          
          // Calculate the next tube number (1->2->3->1)
          const nextTubeNumber = (currentTubeNumber % 3) + 1;
          console.log(`TUBE REPAIR: Cycling to Tube-${nextTubeNumber}`);
          
          // Find a thread in the next tube
          const nextTubeThreadIndex = sortedThreads.findIndex(t => t.tube_number === nextTubeNumber);
          
          if (nextTubeThreadIndex >= 0) {
            // Switch to this thread
            const targetThread = sortedThreads[nextTubeThreadIndex];
            console.log(`TUBE REPAIR: Moving to Tube-${nextTubeNumber}, thread index ${nextTubeThreadIndex}`);
            
            // Save to localStorage before changing
            try {
              localStorage.setItem('zenjin_current_tube', JSON.stringify({
                userId,
                tubeNumber: nextTubeNumber,
                threadId: targetThread.thread_id,
                timestamp: Date.now()
              }));
            } catch (err) {
              console.error('TUBE REPAIR: Error saving to localStorage:', err);
            }
            
            setCurrentTubeIndex(nextTubeThreadIndex);
          } else {
            // If we can't find a thread in the next tube, just move to the next thread
            console.warn(`TUBE REPAIR: No threads found in Tube-${nextTubeNumber}. Moving to next thread.`);
            const nextIndex = (currentTubeIndex + 1) % sortedThreads.length;
            const nextThread = sortedThreads[nextIndex];
            
            // Save to localStorage before changing
            try {
              localStorage.setItem('zenjin_current_tube', JSON.stringify({
                userId,
                tubeNumber: nextThread.tube_number,
                threadId: nextThread.thread_id,
                timestamp: Date.now()
              }));
            } catch (err) {
              console.error('TUBE REPAIR: Error saving to localStorage:', err);
            }
            
            setCurrentTubeIndex(nextIndex);
          }
        }
        
        return; // Exit and let the effect run again with the updated index
      }
      
      // STEP 7: We have a valid ready stitch, notify parent component
      console.log(`TUBE INITIALIZATION: Successfully started with ready stitch ${readyStitch.id} in Tube-${currentTubeNumber}`);
      onStitchSelected(readyStitch, threadId);
      
      // STEP 8: Save tube position to ensure it's persistent in database
      // A redundant save to ensure the database records the correct starting tube
      console.log(`TUBE INITIALIZATION: Saving initial tube position (Tube-${currentTubeNumber}, Thread-${threadId})`);
      
      // Import here to avoid circular dependencies 
      import('../lib/supabase-client').then(({ saveTubePosition }) => {
        saveTubePosition(userId, currentTubeNumber, threadId)
          .then(success => {
            if (success) {
              console.log(`TUBE INITIALIZATION: Successfully saved initial tube position`);
            } else {
              console.warn(`TUBE INITIALIZATION: Failed to save initial tube position`);
            }
          })
          .catch(err => console.error(`TUBE INITIALIZATION: Error saving initial position: ${err}`));
      });
      
      // STEP 9: Set up IndexedDB for additional storage persistence
      try {
        // Initialize IndexedDB storage for more robust state persistence
        const openRequest = window.indexedDB.open('zenjin_state_db', 1);
        
        openRequest.onupgradeneeded = (event) => {
          const db = openRequest.result;
          // Create object stores if they don't exist
          if (!db.objectStoreNames.contains('tube_state')) {
            db.createObjectStore('tube_state', { keyPath: 'key' });
          }
        };
        
        openRequest.onsuccess = (event) => {
          console.log('TUBE INITIALIZATION: IndexedDB initialized successfully');
          // Save current position to IndexedDB
          const db = openRequest.result;
          const transaction = db.transaction(['tube_state'], 'readwrite');
          const store = transaction.objectStore('tube_state');
          
          const stateData = {
            key: `tube_position_${userId}`,
            data: {
              userId,
              tubeNumber: currentTubeNumber,
              threadId: threadId,
              timestamp: Date.now()
            }
          };
          
          const storeRequest = store.put(stateData);
          storeRequest.onsuccess = () => {
            console.log('TUBE INITIALIZATION: Successfully saved position to IndexedDB');
          };
          
          storeRequest.onerror = (event) => {
            console.error('TUBE INITIALIZATION: Error saving to IndexedDB:', event);
          };
        };
        
        openRequest.onerror = (event) => {
          console.error('TUBE INITIALIZATION: IndexedDB error:', event);
        };
      } catch (dbError) {
        console.error('TUBE INITIALIZATION: Error initializing IndexedDB:', dbError);
      }
    }, [sequencer, sortedThreads, currentTubeIndex, onStitchSelected, userId]);
    
    /**
     * Verify that the entire tube cycling system is in a valid state
     * This includes checking that each tube has exactly one ready stitch,
     * and that each thread is properly assigned to a tube.
     */
    const verifyTubeIntegrity = () => {
      if (!sequencer) return;
      
      console.log('Verifying tube cycling integrity...');
      
      // CRITICAL FIX: Ensure all threads have valid tube numbers
      sortedThreads.forEach(thread => {
        if (!thread.tube_number || thread.tube_number < 1 || thread.tube_number > 3) {
          // Assign a tube_number based on thread name pattern
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
          
          console.warn(`Thread ${thread.thread_id} had no valid tube_number. Assigned to Tube-${assignedTube}`);
          thread.tube_number = assignedTube;
        }
      });
      
      // Check if we have threads for each tube
      const tube1Threads = sortedThreads.filter(t => t.tube_number === 1);
      const tube2Threads = sortedThreads.filter(t => t.tube_number === 2);
      const tube3Threads = sortedThreads.filter(t => t.tube_number === 3);
      
      console.log(`Tube distribution: Tube-1: ${tube1Threads.length} threads, Tube-2: ${tube2Threads.length} threads, Tube-3: ${tube3Threads.length} threads`);
      
      // Verify all thread assignments
      console.log('Thread tube assignments:');
      sortedThreads.forEach(thread => {
        console.log(`- Thread ${thread.thread_id} -> Tube-${thread.tube_number}`);
      });
      
      // Log warning if any tube is missing
      if (tube1Threads.length === 0) console.warn('Tube-1 has no threads assigned to it. This will break the tube cycling pattern.');
      if (tube2Threads.length === 0) console.warn('Tube-2 has no threads assigned to it. This will break the tube cycling pattern.');
      if (tube3Threads.length === 0) console.warn('Tube-3 has no threads assigned to it. This will break the tube cycling pattern.');
      
      // Verify each tube has exactly one ready stitch
      verifyTubeReadyStitches();
      
      // Make sure current tube index points to a valid tube
      const currentThread = sortedThreads[currentTubeIndex];
      if (!currentThread) {
        console.warn('Current tube index does not point to a valid thread. Resetting to first thread in Tube-1.');
        
        // Find the first thread in Tube-1
        const tube1Index = sortedThreads.findIndex(t => t.tube_number === 1);
        if (tube1Index >= 0) {
          // Set current tube to first thread in Tube-1
          setTimeout(() => setCurrentTubeIndex(tube1Index), 0);
        } else {
          // If no Tube-1, use the first available thread
          setTimeout(() => setCurrentTubeIndex(0), 0);
        }
      }
      
      console.log('Tube integrity verification complete');
    };

    // Helper to get tube letter (A, B, C) from tube number or index
    const getTubeLetter = (indexOrTubeNumber: number): string => {
      const tubeLetters = ['A', 'B', 'C'];
      
      // If it's a tube number (1, 2, 3), convert to 0-based index for array access
      const index = (indexOrTubeNumber >= 1 && indexOrTubeNumber <= 3) 
        ? indexOrTubeNumber - 1 
        : indexOrTubeNumber % tubeLetters.length;
        
      return tubeLetters[index] || '?';
    };

    // Tube position save lock to prevent race conditions
    let savingTubePosition = false;
    
    // Function to move to the next tube in sequence (1->2->3->1)
    const nextTube = () => {
      // Track the tube we're about to transition from for better debugging
      const transitionFromTube = sortedThreads[currentTubeIndex]?.tube_number || 0;
      
      // Get current thread for logging and state saving
      const currentThread = sortedThreads[currentTubeIndex];
      if (!currentThread) {
        console.error('Cannot cycle tubes: No current thread found');
        return currentTubeIndex;
      }
      
      const currentThreadId = currentThread?.thread_id || 'none';
      const currentTubeNumber = currentThread?.tube_number || (currentTubeIndex + 1);
      
      // STEP 1: Save the current position to localStorage immediately
      try {
        localStorage.setItem('zenjin_current_tube', JSON.stringify({
          userId,
          tubeNumber: currentTubeNumber,
          threadId: currentThreadId,
          timestamp: Date.now()
        }));
        console.log(`Saved current tube position to localStorage: Tube-${currentTubeNumber}, Thread-${currentThreadId}`);
      } catch (err) {
        console.error('Error saving to localStorage:', err);
      }
      
      // STEP 2: Save to IndexedDB as additional persistence layer
      try {
        const openRequest = window.indexedDB.open('zenjin_state_db', 1);
        
        openRequest.onsuccess = (event) => {
          try {
            const db = openRequest.result;
            const transaction = db.transaction(['tube_state'], 'readwrite');
            const store = transaction.objectStore('tube_state');
            
            const stateData = {
              key: `tube_position_${userId}`,
              data: {
                userId,
                tubeNumber: currentTubeNumber,
                threadId: currentThreadId,
                timestamp: Date.now()
              }
            };
            
            store.put(stateData);
          } catch (inner) {
            console.error('Error in IndexedDB operation:', inner);
          }
        };
      } catch (dbErr) {
        console.error('Error with IndexedDB:', dbErr);
      }
      
      // STEP 3: Save the current tube position to database before moving to the next tube
      if (currentThread && currentThread.tube_number && !savingTubePosition) {
        // Set lock to prevent multiple concurrent saves
        savingTubePosition = true;
        
        // Import saveTubePosition dynamically to avoid circular dependencies
        import('../lib/supabase-client').then(({ saveTubePosition }) => {
          console.log(`Attempting to save tube position for user ${userId}: Tube-${currentThread.tube_number}, Thread-${currentThread.thread_id}`);
          saveTubePosition(userId, currentThread.tube_number, currentThread.thread_id)
            .then(success => {
              if (success) {
                console.log(`Successfully saved tube position: Tube-${currentThread.tube_number}, Thread-${currentThread.thread_id}`);
              } else {
                console.warn(`Failed to save tube position via API: User-${userId}, Tube-${currentThread.tube_number}, Thread-${currentThread.thread_id}`);
              }
              // Release lock
              savingTubePosition = false;
            })
            .catch(error => {
              console.error(`Error saving tube position: ${error}`, error);
              // Release lock even on error
              savingTubePosition = false;
            });
        }).catch(() => {
          // Release lock if import fails
          savingTubePosition = false;
        });
      }
      
      // STEP 4: Get threads by tube number (1, 2, 3)
      const tube1Threads = sortedThreads.filter(t => t.tube_number === 1);
      const tube2Threads = sortedThreads.filter(t => t.tube_number === 2);
      const tube3Threads = sortedThreads.filter(t => t.tube_number === 3);
      
      // Log tube status for debugging
      console.log(`Tube status: Tube-1: ${tube1Threads.length} threads, Tube-2: ${tube2Threads.length} threads, Tube-3: ${tube3Threads.length} threads`);
      
      // Determine next tube number (1->2->3->1) - strictly follow the sequence
      const nextTubeNumber = (currentTubeNumber % 3) + 1;
      
      console.log(`Looking for a thread in Tube-${nextTubeNumber}...`);
      
      // Get the threads in the next tube
      const nextTubeThreads = sortedThreads.filter(t => t.tube_number === nextTubeNumber);
      
      // Enhanced logging for debugging the cycling issue
      console.log('All threads with tube numbers:', sortedThreads.map(t => 
        `${t.thread_id}: Tube-${t.tube_number || '?'}`).join(', '));
      
      // DETAILED THREAD DEBUGGING - log each thread with its tube_number
      console.log('DETAILED THREAD DATA FOR DEBUGGING:');
      sortedThreads.forEach((thread, idx) => {
        console.log(`Thread ${idx}: ${thread.thread_id}, Tube-${thread.tube_number}, Virtual: ${thread._virtualTube || false}`);
        // Also check if the thread has a ready stitch
        const readyStitch = thread.stitches.find(s => s.order_number === 0);
        console.log(`  Has ready stitch: ${readyStitch ? `Yes - ${readyStitch.id}` : 'No'}`);
      });
      
      // STEP 5: Handle the case where there are no threads in the next tube
      if (nextTubeThreads.length === 0) {
        console.warn(`No threads found in Tube-${nextTubeNumber}. Creating emergency dummy thread.`);
        console.warn('CYCLING ERROR: No threads assigned to the next tube!');
        console.warn('Thread distribution:',
          `Tube-1: ${sortedThreads.filter(t => t.tube_number === 1).length} threads,`,
          `Tube-2: ${sortedThreads.filter(t => t.tube_number === 2).length} threads,`,
          `Tube-3: ${sortedThreads.filter(t => t.tube_number === 3).length} threads,`,
          `Unknown: ${sortedThreads.filter(t => !t.tube_number || t.tube_number < 1 || t.tube_number > 3).length} threads`
        );
        
        // EMERGENCY FIX ATTEMPT: Try to find any thread that doesn't have tube_number set correctly
        // and fix it based on thread ID pattern
        let didFixThreads = false;
        sortedThreads.forEach(thread => {
          if (!thread.tube_number || thread.tube_number < 1 || thread.tube_number > 3) {
            // Extract letter from thread ID (thread-A -> A, thread-B -> B, etc.)
            const letter = thread.thread_id.match(/thread-([A-Z])/)?.[1] || '';
            
            if (letter) {
              // Determine tube number based on thread letter
              let fixedTubeNumber = 1;
              switch (letter) {
                case 'A': fixedTubeNumber = 1; break;
                case 'B': fixedTubeNumber = 2; break;
                case 'C': fixedTubeNumber = 3; break;
                case 'D': fixedTubeNumber = 3; break; // Same tube as C
                case 'E': fixedTubeNumber = 2; break; // Same tube as B
                case 'F': fixedTubeNumber = 1; break; // Same tube as A
                default:
                  const charCode = letter.charCodeAt(0) - 65;
                  fixedTubeNumber = (charCode % 3) + 1;
              }
              
              console.log(`EMERGENCY FIX: Thread ${thread.thread_id} had invalid tube_number. Fixed to Tube-${fixedTubeNumber}`);
              thread.tube_number = fixedTubeNumber;
              thread._virtualTube = true;
              didFixThreads = true;
            }
          }
        });
        
        // If we fixed any threads, check again for the next tube
        if (didFixThreads) {
          console.log('Rechecking for threads in next tube after emergency fix...');
          const fixedNextTubeThreads = sortedThreads.filter(t => t.tube_number === nextTubeNumber);
          
          if (fixedNextTubeThreads.length > 0) {
            console.log(`Success! Found ${fixedNextTubeThreads.length} threads in Tube-${nextTubeNumber} after fixing tube assignments.`);
            // Try to continue with cycling - find the first thread in the next tube
            const nextThreadIndex = sortedThreads.findIndex(t => t.tube_number === nextTubeNumber);
            if (nextThreadIndex !== -1) {
              console.log(`Setting current tube index to ${nextThreadIndex} (Tube-${nextTubeNumber})`);
              
              // Save new position to localStorage before state change
              try {
                const targetThread = sortedThreads[nextThreadIndex];
                localStorage.setItem('zenjin_current_tube', JSON.stringify({
                  userId,
                  tubeNumber: nextTubeNumber,
                  threadId: targetThread.thread_id,
                  timestamp: Date.now()
                }));
                console.log(`Saved fixed tube position to localStorage: Tube-${nextTubeNumber}`);
              } catch (err) {
                console.error('Error saving fixed position to localStorage:', err);
              }
              
              setCurrentTubeIndex(nextThreadIndex);
              return nextThreadIndex;
            }
          } else {
            console.warn(`Still no threads found in Tube-${nextTubeNumber} after emergency fix.`);
          }
        }
        
        // Create a new emergency dummy thread for this tube
        // This is a critical fix to maintain tube cycling
        console.log(`CRITICAL FIX: Creating emergency dummy thread for Tube-${nextTubeNumber}`);
        
        // Find a source thread to clone (use the first available)
        const sourceThread = sortedThreads[0];
        
        if (sourceThread) {
          // Create a deep clone with modifications for the needed tube
          const dummyThread: ExtendedThreadData = {
            ...JSON.parse(JSON.stringify(sourceThread)), // Deep clone
            thread_id: `emergency-dummy-thread-${nextTubeNumber}`,
            tube_number: nextTubeNumber,
            _virtualTube: true,
            _dummyThread: true
          };
          
          // Ensure the dummy thread has at least one stitch
          if (dummyThread.stitches && dummyThread.stitches.length > 0) {
            // Set the first stitch as ready (order_number = 0)
            dummyThread.stitches[0].order_number = 0;
            
            // Update order map
            if (dummyThread.orderMap && dummyThread.orderMap.length > 0) {
              dummyThread.orderMap[0].order_number = 0;
            }
            
            console.log(`Emergency dummy thread created with ready stitch: ${dummyThread.stitches[0].id}`);
          } else {
            console.warn('Could not set ready stitch in dummy thread - no stitches available');
          }
          
          // Add to sorted threads
          sortedThreads.push(dummyThread);
          
          // Re-sort threads by tube number
          sortedThreads.sort((a, b) => a.tube_number - b.tube_number);
          
          // Update state with the new threads array
          setSortedThreads([...sortedThreads]);
          
          // Find the index of our new thread
          const dummyThreadIndex = sortedThreads.findIndex(t => t.thread_id === dummyThread.thread_id);
          
          if (dummyThreadIndex !== -1) {
            // Save to localStorage before changing
            try {
              localStorage.setItem('zenjin_current_tube', JSON.stringify({
                userId,
                tubeNumber: nextTubeNumber,
                threadId: dummyThread.thread_id,
                timestamp: Date.now()
              }));
              console.log(`Saved emergency dummy thread position to localStorage: Tube-${nextTubeNumber}`);
            } catch (err) {
              console.error('Error saving dummy position to localStorage:', err);
            }
            
            console.log(`Moving to dummy thread at index ${dummyThreadIndex}`);
            setCurrentTubeIndex(dummyThreadIndex);
            return dummyThreadIndex;
          }
        }
        
        // If all else fails, stay on current tube but log a critical error
        console.error(`CRITICAL ERROR: Could not create dummy thread for Tube-${nextTubeNumber}`);
        return currentTubeIndex;
      }
      
      // STEP 6: Find the thread in the next tube that has a ready stitch
      let nextThread: ExtendedThreadData | undefined;
      let nextIndex = -1;
      
      // First try to find a thread with a ready stitch
      for (let i = 0; i < nextTubeThreads.length; i++) {
        const thread = nextTubeThreads[i];
        const threadIndex = sortedThreads.findIndex(t => t.thread_id === thread.thread_id);
        
        if (threadIndex !== -1 && sequencer) {
          const readyStitch = sequencer.getReadyStitch(thread.thread_id);
          if (readyStitch) {
            nextThread = thread;
            nextIndex = threadIndex;
            console.log(`Found thread ${thread.thread_id} in Tube-${nextTubeNumber} with ready stitch ${readyStitch.id}`);
            break;
          }
        }
      }
      
      // If no thread has a ready stitch, use the first thread in the tube
      if (nextIndex === -1 && nextTubeThreads.length > 0) {
        nextThread = nextTubeThreads[0];
        nextIndex = sortedThreads.findIndex(t => t.thread_id === nextThread?.thread_id);
        console.log(`No thread in Tube-${nextTubeNumber} has a ready stitch. Using first thread ${nextThread?.thread_id}`);
        
        // Try to repair the ready stitch situation
        if (sequencer && nextThread) {
          // Get the thread's stitches sorted by order_number
          const sortedStitches = [...nextThread.stitches].sort((a, b) => a.order_number - b.order_number);
          
          // Make the first stitch ready if there are any stitches
          if (sortedStitches.length > 0) {
            const firstStitch = sortedStitches[0];
            console.log(`Repairing thread ${nextThread.thread_id}: Setting stitch ${firstStitch.id} as ready`);
            
            // Set this stitch as ready
            firstStitch.order_number = 0;
            
            // Update order map
            const orderMapEntry = nextThread.orderMap.find(entry => entry.stitch_id === firstStitch.id);
            if (orderMapEntry) {
              orderMapEntry.order_number = 0;
            }
            
            // Force sync to ensure persistence
            setTimeout(() => {
              if (sequencer) {
                sequencer.forceSync();
              }
            }, 100);
          }
        }
      }
      
      if (nextIndex === -1) {
        console.error(`Critical error: Could not find any thread in Tube-${nextTubeNumber}. Tube cycling is broken.`);
        return currentTubeIndex;
      }
      
      // Get the next thread details for logging
      const nextThreadId = nextThread?.thread_id || 'none';
      
      // STEP 7: Log detailed tube transition information
      console.log(`Cycling from Tube-${currentTubeNumber} (${getTubeLetter(currentTubeNumber)}, thread ${currentThreadId}) to Tube-${nextTubeNumber} (${getTubeLetter(nextTubeNumber)}, thread ${nextThreadId})`);
      
      // DEBUGGING: Track where we're setting the tube index
      console.log(`CRITICAL TRACKING: In nextTube(), attempting to set currentTubeIndex from ${currentTubeIndex} to ${nextIndex}`);
      console.log(`CRITICAL TRACKING: Moving from Tube-${currentTubeNumber} to Tube-${nextTubeNumber}`);
      
      // STEP 8: Save the next tube position to localStorage
      try {
        localStorage.setItem('zenjin_current_tube', JSON.stringify({
          userId,
          tubeNumber: nextTubeNumber,
          threadId: nextThreadId,
          timestamp: Date.now()
        }));
        console.log(`Saved next tube position to localStorage: Tube-${nextTubeNumber}, Thread-${nextThreadId}`);
      } catch (err) {
        console.error('Error saving next position to localStorage:', err);
      }
      
      // STEP 9: Update current index with a guaranteed state update reference to previous state
      setCurrentTubeIndex(prevIndex => {
        console.log(`CRITICAL TRACKING: In setCurrentTubeIndex callback, prevIndex=${prevIndex}, setting to ${nextIndex}`);
        if (prevIndex === nextIndex) {
          console.log(`CRITICAL TRACKING: No change needed, staying on same index`);
        }
        return nextIndex;
      });
      
      // STEP 10: If we've completed a full cycle (back to tube 1), increment cycle count
      // CRITICAL FIX: Change logic to only increment when going from Tube-3 to Tube-1
      if (nextTubeNumber === 1 && currentTubeNumber === 3) {
        setCycleCount(prev => prev + 1);
        console.log('CYCLE COUNT INCREMENTED: Completed a full tube cycle from Tube-3 to Tube-1');
        
        // This is a good time to verify tube integrity across all tubes
        if (sequencer) {
          console.log('Verifying tube integrity after completing a full cycle...');
          sequencer.verifyAllTubesIntegrity();
        }
      }
      
      // STEP 11: Save the next tube position to the database in the background
      import('../lib/supabase-client').then(({ saveTubePosition }) => {
        console.log(`Saving next tube position to database: User-${userId}, Tube-${nextTubeNumber}, Thread-${nextThreadId}`);
        saveTubePosition(userId, nextTubeNumber, nextThreadId, true)
          .catch(error => console.error(`Error saving next tube position: ${error}`));
      });
      
      // Check if the new tube's thread has a ready stitch
      if (nextThreadId && sequencer) {
        const readyStitch = sequencer.getReadyStitch(nextThreadId);
        console.log(`New Tube-${nextTubeNumber} (thread ${nextThreadId}) has ready stitch: ${readyStitch ? 'Yes - ' + readyStitch.id : 'No'}`);
      }
      
      return nextIndex;
    };

    // Rotation lock flag to prevent double rotation
    const rotationInProgressRef = React.useRef(false);
    
    // "Live Aid Rotating Stage" model for tube cycling - USER FIRST APPROACH
    // FIRST rotate to the next tube so the user can continue learning immediately
    // THEN process the previous stitch completion in the background
    const handleStitchCompletion = (threadId: string, stitchId: string, score: number, totalQuestions: number) => {
      if (!sequencer) return null;
      
      // CRITICAL FIX: Check if rotation is already in progress
      if (rotationInProgressRef.current) {
        console.log('CRITICAL FIX: Rotation already in progress, ignoring duplicate call');
        return null;
      }
      
      // Set rotation lock flag
      rotationInProgressRef.current = true;
      
      // Release the lock after a timeout (500ms is enough to prevent double triggers)
      setTimeout(() => {
        rotationInProgressRef.current = false;
        console.log('CRITICAL FIX: Released rotation lock');
      }, 500);
      
      // STEP 1: Capture the current state
      const currentThread = sortedThreads[currentTubeIndex];
      const currentTubeNumber = currentThread?.tube_number || (currentTubeIndex + 1);
      console.log(`ROTATING STAGE: Currently on Tube-${currentTubeNumber} (stitch ${stitchId})`);
      
      // Save the previous tube data for background processing
      const previousTubeNumber = currentTubeNumber;
      const previousThreadId = threadId;
      const previousStitchId = stitchId;
      
      // STEP 2: IMMEDIATELY determine and move to the next tube
      // This prioritizes user experience - let them continue learning without delay
      const nextTubeNumber = (currentTubeNumber % 3) + 1;
      console.log(`ROTATING STAGE: IMMEDIATELY rotating stage to Tube-${nextTubeNumber}...`);
      
      // Find a thread in the next tube directly
      const targetThreadIndex = sortedThreads.findIndex(t => t.tube_number === nextTubeNumber);
      let moveSuccessful = false;
      let nextThreadId = null;
      
      if (targetThreadIndex === -1) {
        console.error(`ROTATING STAGE: No threads found in Tube-${nextTubeNumber}! Creating emergency thread.`);
        
        // Create a dummy thread for this tube (similar to having a backup band ready)
        const sourceThread = sortedThreads[0];
        if (sourceThread) {
          const dummyThread: ExtendedThreadData = {
            ...JSON.parse(JSON.stringify(sourceThread)),
            thread_id: `emergency-dummy-thread-${nextTubeNumber}`,
            tube_number: nextTubeNumber,
            _virtualTube: true,
            _dummyThread: true
          };
          
          // Ensure the dummy thread has a ready stitch
          if (dummyThread.stitches && dummyThread.stitches.length > 0) {
            dummyThread.stitches[0].order_number = 0;
            
            if (dummyThread.orderMap && dummyThread.orderMap.length > 0) {
              dummyThread.orderMap[0].order_number = 0;
            }
          }
          
          // Add this emergency thread and resort
          const newThreads = [...sortedThreads, dummyThread];
          newThreads.sort((a, b) => a.tube_number - b.tube_number);
          setSortedThreads(newThreads);
          
          // Now find the index of our new thread
          const newIndex = newThreads.findIndex(t => t.thread_id === dummyThread.thread_id);
          if (newIndex !== -1) {
            // Save to localStorage before changing
            try {
              localStorage.setItem('zenjin_current_tube', JSON.stringify({
                userId,
                tubeNumber: nextTubeNumber,
                threadId: dummyThread.thread_id,
                timestamp: Date.now()
              }));
              console.log(`ROTATING STAGE: Saved emergency tube position to localStorage: Tube-${nextTubeNumber}`);
            } catch (err) {
              console.error('ROTATING STAGE: Error saving to localStorage:', err);
            }
            
            // This direct dispatch with no dependencies ensures we change tube
            console.log(`ROTATING STAGE: Setting to emergency thread at index ${newIndex}`);
            setCurrentTubeIndex(newIndex);
            moveSuccessful = true;
            nextThreadId = dummyThread.thread_id;
          }
        }
      } else {
        // Normal case - we found a thread in the next tube
        console.log(`ROTATING STAGE: Found thread at index ${targetThreadIndex} in Tube-${nextTubeNumber}`);
        
        // Get the thread ID for the next tube
        const targetThread = sortedThreads[targetThreadIndex];
        nextThreadId = targetThread.thread_id;
        
        // Save to localStorage immediately for persistence
        try {
          localStorage.setItem('zenjin_current_tube', JSON.stringify({
            userId,
            tubeNumber: nextTubeNumber,
            threadId: targetThread.thread_id,
            timestamp: Date.now()
          }));
          console.log(`ROTATING STAGE: Saved new tube position to localStorage: Tube-${nextTubeNumber}, Thread-${targetThread.thread_id}`);
        } catch (err) {
          console.error('ROTATING STAGE: Error saving to localStorage:', err);
        }
        
        // Also save to IndexedDB for extra persistence
        try {
          const openRequest = window.indexedDB.open('zenjin_state_db', 1);
          
          openRequest.onsuccess = (event) => {
            try {
              const db = openRequest.result;
              const transaction = db.transaction(['tube_state'], 'readwrite');
              const store = transaction.objectStore('tube_state');
              
              const stateData = {
                key: `tube_position_${userId}`,
                data: {
                  userId,
                  tubeNumber: nextTubeNumber,
                  threadId: targetThread.thread_id,
                  timestamp: Date.now()
                }
              };
              
              const storeRequest = store.put(stateData);
              storeRequest.onsuccess = () => {
                console.log('ROTATING STAGE: Successfully saved position to IndexedDB');
              };
            } catch (inner) {
              console.error('ROTATING STAGE: Error in IndexedDB inner operation:', inner);
            }
          };
        } catch (dbErr) {
          console.error('ROTATING STAGE: Error with IndexedDB:', dbErr);
        }
        
        // Directly set current tube index - no dependencies, no conditions
        // This is like rotating the physical stage - happens regardless of preparation status
        setCurrentTubeIndex(targetThreadIndex);
        moveSuccessful = true;
        
        // Persist this tube position with maximum urgency (background processing)
        // The "urgent" flag means we'll return immediately to not delay the UI
        import('../lib/supabase-client').then(({ saveTubePosition }) => {
          console.log(`ROTATING STAGE: Saving position to Tube-${nextTubeNumber}, Thread-${targetThread.thread_id}`);
          
          // Mark position as urgent - rotate first, then save
          saveTubePosition(userId, nextTubeNumber, targetThread.thread_id, true)
            .catch(error => console.error(`Error saving tube position: ${error}`));
        });
      }
      
      // STEP 3: Now that we've rotated to the next tube, process the PREVIOUS tube's stitch completion
      // This happens "behind the curtain" while the user is already seeing the next tube
      // To maintain the "Live Aid" pattern, we'll do this async in a non-blocking way
      const isPerfect = score === totalQuestions;
      console.log(`ROTATING STAGE: Now processing previous stitch ${previousStitchId} with ${isPerfect ? 'perfect' : 'partial'} score`);
      
      // Use a setTimeout to process this asynchronously
      setTimeout(() => {
        // Check if sequencer still exists (component not unmounted)
        if (!sequencer) return;
        
        try {
          // Use the sequencer to update the stitch position in the PREVIOUS tube
          console.log(`ROTATING STAGE: Processing stitch completion in background`);
          const processedStitch = sequencer.handleStitchCompletion(
            previousThreadId,
            previousStitchId,
            score,
            totalQuestions
          );
          
          // Force sync to ensure the stitch position changes are persisted
          // Using our updated client with robust persistence
          sequencer.forceSync();
          console.log(`ROTATING STAGE: Previous stitch processing complete`);
          
          // Pass stitch update to our robust persistence system with "urgent" flag set to false
          // This ensures thorough persistence but is not blocking the UI
          import('../lib/supabase-client').then(({ updateUserStitchProgress }) => {
            // Don't await this - it's a background operation
            if (processedStitch) {
              console.log(`ROTATING STAGE: Persisting completed stitch state in background`);
              updateUserStitchProgress(
                userId,
                previousThreadId,
                previousStitchId,
                processedStitch.order_number,
                processedStitch.skip_number || 1, // Default to 1 instead of 3
                processedStitch.distractor_level || 'L1',
                false // not urgent - can take its time for thoroughness
              ).catch(e => console.error('Error persisting stitch state:', e));
            }
          });
        } catch (err) {
          console.error('ROTATING STAGE: Error processing previous stitch:', err);
        }
      }, 10); // Very short delay to ensure UI remains responsive
      
      // STEP 4: Verify tube integrity after rotation in background
      // Like having stage managers verify all tubes are ready after rotation
      setTimeout(() => {
        console.log(`ROTATING STAGE: Verifying tube integrity after rotation`);
        
        // Re-check we're in the right tube after all is said and done
        const currentThread = sortedThreads[currentTubeIndex];
        const actualTubeNumber = currentThread?.tube_number || 0;
        
        if (actualTubeNumber !== nextTubeNumber) {
          console.error(`ROTATING STAGE: CRITICAL ERROR - Stage rotation failed! In Tube-${actualTubeNumber} instead of Tube-${nextTubeNumber}`);
          
          // One final attempt to force the correct tube
          const finalAttemptIndex = sortedThreads.findIndex(t => t.tube_number === nextTubeNumber);
          if (finalAttemptIndex >= 0) {
            console.log(`ROTATING STAGE: Last-ditch emergency rotation to index ${finalAttemptIndex}`);
            
            // Save to localStorage before emergency correction
            try {
              const targetThread = sortedThreads[finalAttemptIndex];
              localStorage.setItem('zenjin_current_tube', JSON.stringify({
                userId,
                tubeNumber: nextTubeNumber,
                threadId: targetThread.thread_id,
                timestamp: Date.now()
              }));
              console.log(`ROTATING STAGE: Saved emergency correction to localStorage: Tube-${nextTubeNumber}`);
            } catch (err) {
              console.error('ROTATING STAGE: Error saving to localStorage:', err);
            }
            
            setCurrentTubeIndex(finalAttemptIndex);
            
            // Also save this emergency position to ensure database consistency
            const targetThread = sortedThreads[finalAttemptIndex];
            if (targetThread && targetThread.tube_number) {
              import('../lib/supabase-client').then(({ saveTubePosition }) => {
                console.log(`ROTATING STAGE: Saving emergency corrected position: Tube-${targetThread.tube_number}`);
                saveTubePosition(userId, targetThread.tube_number, targetThread.thread_id, true)
                  .catch(e => console.error('Error saving emergency position:', e));
              });
            }
          }
        } else {
          console.log(`ROTATING STAGE: Rotation successful - now on Tube-${nextTubeNumber}`);
        }
        
        // Ensure all tubes have exactly one ready stitch
        verifyTubeReadyStitches();
        
        // STEP 5: In background, prepare ALL three tubes for smooth cycling (for future rotations)
        // Split this from the verification to improve responsiveness
        setTimeout(() => {
          console.log(`ROTATING STAGE: Preparing all tubes for future rotations`);
          
          for (let tubeNum = 1; tubeNum <= 3; tubeNum++) {
            const tubeThreads = sortedThreads.filter(t => t.tube_number === tubeNum);
            
            if (tubeThreads.length === 0) {
              console.log(`ROTATING STAGE: No threads in Tube-${tubeNum} to prepare`);
              continue;
            }
            
            // Check if this tube has exactly one ready stitch
            let readyStitchCount = 0;
            let readyStitches = [];
            
            for (const thread of tubeThreads) {
              const readyStitch = thread.stitches.find(s => s.order_number === 0);
              if (readyStitch) {
                readyStitchCount++;
                readyStitches.push({ thread, stitch: readyStitch });
              }
            }
            
            if (readyStitchCount !== 1) {
              console.log(`ROTATING STAGE: Preparing Tube-${tubeNum} - fixing ready stitch count (currently ${readyStitchCount})`);
              
              // Fix this tube to have exactly one ready stitch
              if (readyStitchCount === 0) {
                // Find the first thread in this tube and set its first stitch as ready
                const firstThread = tubeThreads[0];
                if (firstThread && firstThread.stitches.length > 0) {
                  // Find stitch with lowest order_number
                  const sortedStitches = [...firstThread.stitches].sort((a, b) => a.order_number - b.order_number);
                  const firstStitch = sortedStitches[0];
                  
                  // Make it ready
                  firstStitch.order_number = 0;
                  
                  // Update order map
                  const orderMapEntry = firstThread.orderMap.find(e => e.stitch_id === firstStitch.id);
                  if (orderMapEntry) {
                    orderMapEntry.order_number = 0;
                  }
                  
                  console.log(`ROTATING STAGE: Set stitch ${firstStitch.id} as ready in Tube-${tubeNum}`);
                  
                  // Persist this change using our robust client with urgent=false
                  import('../lib/supabase-client').then(({ updateUserStitchProgress }) => {
                    updateUserStitchProgress(
                      userId,
                      firstThread.thread_id,
                      firstStitch.id,
                      0, // order_number = 0 (ready)
                      firstStitch.skip_number || 3,
                      firstStitch.distractor_level || 'L1',
                      false // not urgent - background processing
                    ).catch(e => console.error(`Error updating stitch ${firstStitch.id}:`, e));
                  });
                }
              } else if (readyStitchCount > 1) {
                // Keep only one ready stitch, demote others
                let foundOne = false;
                let position = 1;
                
                // Sort ready stitches (optional - could prioritize certain threads)
                readyStitches.sort((a, b) => a.thread.thread_id.localeCompare(b.thread.thread_id));
                
                for (const { thread, stitch } of readyStitches) {
                  if (!foundOne) {
                    foundOne = true;
                    console.log(`ROTATING STAGE: Keeping stitch ${stitch.id} as the only ready stitch in Tube-${tubeNum}`);
                  } else {
                    // Demote this one
                    stitch.order_number = position++;
                    
                    // Update order map
                    const orderMapEntry = thread.orderMap.find(e => e.stitch_id === stitch.id);
                    if (orderMapEntry) {
                      orderMapEntry.order_number = stitch.order_number;
                    }
                    
                    console.log(`ROTATING STAGE: Demoted stitch ${stitch.id} to position ${stitch.order_number}`);
                    
                    // Persist this change using our robust client with urgent=false
                    import('../lib/supabase-client').then(({ updateUserStitchProgress }) => {
                      updateUserStitchProgress(
                        userId,
                        thread.thread_id,
                        stitch.id,
                        stitch.order_number,
                        stitch.skip_number || 3,
                        stitch.distractor_level || 'L1',
                        false // not urgent - background processing
                      ).catch(e => console.error(`Error updating stitch ${stitch.id}:`, e));
                    });
                  }
                }
              }
            } else {
              console.log(`ROTATING STAGE: Tube-${tubeNum} already has exactly one ready stitch`);
            }
          }
          
          // Force sync to persist any changes made while preparing tubes
          if (sequencer) {
            sequencer.forceSync();
          }
        }, 300); // Delay tube preparation to improve responsiveness
      }, 100);
      
      // STEP 6: Get the ready stitch for the new tube we've rotated to
      // This is what the user will see next - highest priority for UI responsiveness
      let nextReadyStitch = null;
      
      if (moveSuccessful && nextThreadId) {
        // Get the ready stitch from the next tube's thread
        nextReadyStitch = sequencer.getReadyStitch(nextThreadId);
        
        if (!nextReadyStitch) {
          console.error(`ROTATING STAGE: Failed to find ready stitch in next thread ${nextThreadId}`);
          
          // Try to fix this tube
          const nextThread = sortedThreads.find(t => t.thread_id === nextThreadId);
          if (nextThread && nextThread.stitches.length > 0) {
            console.log(`ROTATING STAGE: Fixing thread ${nextThreadId} - setting a ready stitch`);
            const lowestStitch = [...nextThread.stitches].sort((a, b) => a.order_number - b.order_number)[0];
            lowestStitch.order_number = 0;
            
            // Update order map
            const orderMapEntry = nextThread.orderMap.find(e => e.stitch_id === lowestStitch.id);
            if (orderMapEntry) {
              orderMapEntry.order_number = 0;
            }
            
            // Force sync immediately for UI responsiveness
            sequencer.forceSync();
            
            // Also queue a background operation to ensure this change persists
            import('../lib/supabase-client').then(({ updateUserStitchProgress }) => {
              updateUserStitchProgress(
                userId,
                nextThread.thread_id,
                lowestStitch.id,
                0, // order_number = 0 (ready)
                lowestStitch.skip_number || 3,
                lowestStitch.distractor_level || 'L1',
                false // not urgent - already fixed in memory
              ).catch(e => console.error(`Error updating stitch ${lowestStitch.id}:`, e));
            });
            
            // Now try again
            nextReadyStitch = sequencer.getReadyStitch(nextThreadId);
            
            if (!nextReadyStitch) {
              console.error(`ROTATING STAGE: Still no ready stitch after fix attempt - critical error`);
            } else {
              console.log(`ROTATING STAGE: Successfully fixed thread ${nextThreadId} - now has ready stitch ${nextReadyStitch.id}`);
            }
          }
        } else {
          console.log(`ROTATING STAGE: Successfully found ready stitch ${nextReadyStitch.id} in thread ${nextThreadId}`);
        }
        
        // CRITICAL FIX: Do another explicit save of the tube position to ensure it's persisted
        // This is the key to fixing the "state not being saved" issue
        const targetThread = sortedThreads.find(t => t.thread_id === nextThreadId);
        if (targetThread && targetThread.tube_number) {
          console.log(`ROTATING STAGE: Extra persistence - saving tube position direct from return handler`);
          
          // Update local storage one more time
          try {
            localStorage.setItem('zenjin_current_tube', JSON.stringify({
              userId,
              tubeNumber: targetThread.tube_number,
              threadId: targetThread.thread_id,
              timestamp: Date.now()
            }));
          } catch (err) {
            console.error('ROTATING STAGE: Error saving final localStorage update:', err);
          }
          
          // Import directly to avoid circular dependencies
          import('../lib/supabase-client').then(({ saveTubePosition }) => {
            // Call with retries to maximize chance of success
            const tubeNumber = targetThread.tube_number;
            console.log(`ROTATING STAGE: Final save of tube position: User-${userId}, Tube-${tubeNumber}, Thread-${nextThreadId}`);
            
            // Final save with urgency flag set to true
            saveTubePosition(userId, tubeNumber, nextThreadId, true)
              .catch(error => console.error(`ROTATING STAGE: Final tube position save error: ${error}`));
          });
        }
      }
      
      // Return the next ready stitch from the new tube the user has been rotated to
      return nextReadyStitch;
    };
    
    /**
     * Verify that each tube has exactly one ready stitch and repair if needed
     * This is a critical function to maintain tube cycling integrity
     */
    const verifyTubeReadyStitches = () => {
      if (!sequencer) return;
      
      // Check each tube
      for (let tubeNumber = 1; tubeNumber <= 3; tubeNumber++) {
        const tubeThreads = sortedThreads.filter(t => t.tube_number === tubeNumber);
        
        if (tubeThreads.length === 0) {
          console.log(`Tube-${tubeNumber} has no threads assigned to it.`);
          continue;
        }
        
        // Count how many ready stitches exist in this tube
        let readyStitches = [];
        
        // Collect all ready stitches from all threads in this tube
        for (const thread of tubeThreads) {
          const readyStitch = sequencer.getReadyStitch(thread.thread_id);
          if (readyStitch) {
            readyStitches.push({
              threadId: thread.thread_id,
              stitch: readyStitch,
              thread: thread
            });
          }
        }
        
        const readyStitchCount = readyStitches.length;
        
        if (readyStitchCount === 0) {
          console.warn(`INTEGRITY FIX: Tube-${tubeNumber} has no ready stitches. This is a data integrity issue that must be repaired.`);
          
          // Find the stitch with the lowest positive order_number across all threads in this tube
          let lowestOrderThread: ThreadData | null = null;
          let lowestOrderStitch: StitchWithProgress | null = null;
          let lowestOrder = Number.MAX_SAFE_INTEGER;
          
          for (const thread of tubeThreads) {
            // Check all stitches in this thread
            for (const stitch of thread.stitches) {
              // Only consider stitches with positive order numbers
              if (stitch.order_number > 0 && stitch.order_number < lowestOrder) {
                lowestOrder = stitch.order_number;
                lowestOrderStitch = stitch;
                lowestOrderThread = thread;
              }
            }
          }
          
          // Make this stitch the ready stitch
          if (lowestOrderStitch && lowestOrderThread) {
            console.log(`INTEGRITY FIX: Promoting stitch ${lowestOrderStitch.id} in thread ${lowestOrderThread.thread_id} from position ${lowestOrder} to ready (0) for Tube-${tubeNumber}`);
            
            // Set as ready (order_number = 0)
            lowestOrderStitch.order_number = 0;
            
            // Update order map
            const orderMapEntry = lowestOrderThread.orderMap.find(e => e.stitch_id === lowestOrderStitch.id);
            if (orderMapEntry) {
              orderMapEntry.order_number = 0;
            }
            
            // Force sync to persist changes
            sequencer.forceSync();
          } else {
            // If no stitch has a positive order number, set the first stitch to ready
            if (tubeThreads.length > 0 && tubeThreads[0].stitches.length > 0) {
              const firstThread = tubeThreads[0];
              const firstStitch = firstThread.stitches[0];
              
              console.log(`INTEGRITY FIX: No stitches with positive order found in Tube-${tubeNumber}. Setting first stitch ${firstStitch.id} as ready.`);
              
              // Set as ready
              firstStitch.order_number = 0;
              
              // Update order map
              const orderMapEntry = firstThread.orderMap.find(e => e.stitch_id === firstStitch.id);
              if (orderMapEntry) {
                orderMapEntry.order_number = 0;
              }
              
              // Force sync
              sequencer.forceSync();
            }
          }
        } else if (readyStitchCount > 1) {
          console.warn(`INTEGRITY FIX: Tube-${tubeNumber} has ${readyStitchCount} ready stitches. Fixing this data integrity issue...`);
          
          // Keep only the first ready stitch, demote others
          const keepStitch = readyStitches[0];
          console.log(`INTEGRITY FIX: Keeping stitch ${keepStitch.stitch.id} in thread ${keepStitch.threadId} as the only ready stitch for Tube-${tubeNumber}`);
          
          // Log all the ready stitches for debugging
          readyStitches.forEach((stitch, idx) => {
            console.warn(`  Ready stitch ${idx+1} in Tube-${tubeNumber}: thread=${stitch.threadId}, stitch=${stitch.stitch.id}`);
          });
          
          // Assign incremental order numbers to the others
          let orderCounter = 1;
          
          for (let i = 1; i < readyStitches.length; i++) {
            const demoteInfo = readyStitches[i];
            console.log(`INTEGRITY FIX: Demoting stitch ${demoteInfo.stitch.id} in thread ${demoteInfo.threadId} from order 0 to position ${orderCounter}`);
            
            // Update stitch order
            demoteInfo.stitch.order_number = orderCounter;
            
            // Update order map
            const orderMapEntry = demoteInfo.thread.orderMap.find(e => e.stitch_id === demoteInfo.stitch.id);
            if (orderMapEntry) {
              orderMapEntry.order_number = orderCounter;
            }
            
            orderCounter++;
          }
          
          // Force sync to persist these changes
          sequencer.forceSync();
        } else {
          console.log(`Tube-${tubeNumber} has exactly one ready stitch: ${readyStitches[0].stitch.id} in thread ${readyStitches[0].threadId}`);
        }
      }
    };

    return (
      <div className="tube-cycler">
        {/* This component doesn't render anything directly */}
        {/* It just manages the tube cycling and provides the current stitch */}
        
        {/* Debug UI - visible in development mode */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-black/30 p-3 rounded-lg text-white/90 text-sm mb-4">
            <h3 className="font-bold mb-2">Tube Cycler Status</h3>
            <p className="font-bold text-teal-300">
              Current Tube: Tube-{sortedThreads[currentTubeIndex]?.tube_number || (currentTubeIndex + 1)}
            </p>
            
            <div className="mt-2">
              <p className="font-semibold">Active Thread:</p>
              <p className="text-teal-300">{sortedThreads[currentTubeIndex]?.thread_id || 'none'}</p>
              {sequencer && sortedThreads[currentTubeIndex] && (
                <p>
                  Ready Stitch: <span className="text-teal-300">{
                    sequencer.getReadyStitch(sortedThreads[currentTubeIndex]?.thread_id)?.id || 'none'
                  }</span>
                </p>
              )}
            </div>
            
            <div className="mt-4">
              <p className="font-semibold">All Tubes Status:</p>
              <div className="grid grid-cols-3 gap-2 mt-1 text-sm">
                {[1, 2, 3].map(tubeNum => {
                  const tubeThreads = sortedThreads.filter(t => t.tube_number === tubeNum);
                  const activeTubeNumber = sortedThreads[currentTubeIndex]?.tube_number || 0;
                  const isActive = activeTubeNumber === tubeNum;
                  
                  return (
                    <div key={tubeNum} className={`p-2 rounded ${isActive ? 'bg-teal-600/40' : 'bg-black/20'}`}>
                      <p className="font-bold">Tube-{tubeNum}</p>
                      <p className="text-xs mt-1">Threads: {tubeThreads.length}</p>
                      {tubeThreads.map(t => (
                        <p key={t.thread_id} className="text-xs text-teal-300/80 truncate">
                          {t.thread_id}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="mt-2">
              <p className="font-semibold">Cycle Information:</p>
              <p>Cycle Count: <span className="text-teal-300">{cycleCount}</span></p>
              <p>Cycle Order: <span className="text-teal-300">Tube-1 → Tube-2 → Tube-3</span></p>
            </div>
            
            <div className="flex space-x-2 mt-3 flex-wrap">
              <button 
                onClick={nextTube}
                className="bg-teal-600 hover:bg-teal-500 px-3 py-1 rounded text-xs text-white"
              >
                Next Tube
              </button>
              
              {sequencer && sortedThreads[currentTubeIndex] && sequencer.getReadyStitch(sortedThreads[currentTubeIndex]?.thread_id) && (
                <button 
                  onClick={() => {
                    const threadId = sortedThreads[currentTubeIndex]?.thread_id;
                    const stitch = sequencer.getReadyStitch(threadId);
                    if (stitch) {
                      handleStitchCompletion(threadId, stitch.id, 20, 20);
                    }
                  }}
                  className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-xs text-white"
                >
                  Complete Ready Stitch
                </button>
              )}
              
              <button 
                onClick={() => {
                  if (sequencer) {
                    const integrityStatus = sequencer.verifyAllTubesIntegrity();
                    console.log('Tube Integrity Check:', integrityStatus);
                    
                    // Show a simple alert with the status
                    const statusText = Object.entries(integrityStatus)
                      .map(([tube, status]) => 
                        `Tube-${tube}: ${status.valid ? 'VALID' : 'INVALID'} (${status.readyStitchCount} ready stitches)`
                      )
                      .join('\n');
                    
                    alert(`Tube Integrity Check:\n${statusText}`);
                    
                    // Also verify our ready stitches
                    verifyTubeReadyStitches();
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-xs text-white"
              >
                Check Tube Integrity
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

// Display name for debugging
TubeCycler.displayName = 'TubeCycler';

export default TubeCycler;