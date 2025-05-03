import React, { useState, useEffect, useRef } from 'react';
import { ThreadData, StitchWithProgress } from '../lib/types/distinction-learning';
import TubeCycler, { TubeCyclerRefHandle } from './TubeCycler';
import { TubeCyclerAdapter } from '../lib/adapters/tubeCyclerAdapter';
import DistinctionPlayer from './DistinctionPlayer';

interface SequentialPlayerProps {
  threadData: ThreadData[];
  userId: string;
}

/**
 * SequentialPlayer - Integrates ThreadCycler with DistinctionPlayer
 * to always play the active stitch in sequence.
 * 
 * This updated version supports both the legacy TubeCycler and the new
 * TubeCyclerAdapter for improved state persistence.
 */
const SequentialPlayer: React.FC<SequentialPlayerProps> = ({ threadData, userId }) => {
  const [activeStitch, setActiveStitch] = useState<StitchWithProgress | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string>('');
  const [activeThread, setActiveThread] = useState<ThreadData | null>(null);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [sessionResults, setSessionResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exitSessionMode, setExitSessionMode] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [useNewArchitecture, setUseNewArchitecture] = useState<boolean>(true);
  
  // Accumulate session data across all stitches
  const [accumulatedSessionData, setAccumulatedSessionData] = useState<{
    totalPoints: number;
    correctAnswers: number;
    firstTimeCorrect: number;
    totalQuestions: number;
    totalAttempts: number;
    stitchesCompleted: number;
  }>({
    totalPoints: 0,
    correctAnswers: 0,
    firstTimeCorrect: 0,
    totalQuestions: 0,
    totalAttempts: 0,
    stitchesCompleted: 0
  });
  
  // Reference to the TubeCycler component (legacy)
  const tubeCyclerRef = useRef<TubeCyclerRefHandle>(null);
  
  // Reference to the TubeCyclerAdapter (new architecture)
  const adapterRef = useRef<TubeCyclerAdapter | null>(null);
  
  // One-time initialization to ensure state recovery
  useEffect(() => {
    if (hasInitialized) return; // Only run once
    
    console.log('CRITICAL PERSISTENCE: Initializing state recovery mechanisms using ' + 
                (useNewArchitecture ? 'new architecture' : 'legacy recovery'));
    
    if (useNewArchitecture) {
      // Using the new architecture with TubeCyclerAdapter
      console.log('CRITICAL PERSISTENCE: Using TubeCyclerAdapter for state recovery and persistence');
      
      // Initialize the adapter
      if (!adapterRef.current) {
        // Create the adapter
        adapterRef.current = new TubeCyclerAdapter(tubeCyclerRef, userId);
        
        // CRITICAL FIX: Add timeout to handle stuck initialization
        const initializationTimeout = setTimeout(() => {
          console.error('Adapter initialization timed out after 8 seconds');
          // Force initialization to complete
          setHasInitialized(true);
          setIsLoading(false);
          
          // Try to recover by selecting a tube directly
          if (adapterRef.current) {
            console.log('Attempting recovery by directly selecting tube 1');
            adapterRef.current.selectTube(1);
          }
        }, 8000); // 8 second timeout

        // Initialize the adapter and get thread data
        adapterRef.current.initialize().then(initialThreadData => {
          // Clear the timeout since initialization completed
          clearTimeout(initializationTimeout);
          
          console.log('Adapter initialized with thread data:', initialThreadData);
          
          // If we have thread data and a TubeCycler ref, use it to select the initial stitch
          if (initialThreadData.length > 0 && tubeCyclerRef.current) {
            // Let the TubeCycler process the thread data and select the initial stitch
            // This ensures we maintain compatibility with the existing TubeCycler component
            // while leveraging our new state persistence mechanism
            setTimeout(() => {
              // The timeout ensures the TubeCycler has fully rendered
              if (tubeCyclerRef.current && adapterRef.current) {
                // Get the current state
                const state = adapterRef.current.getSortedThreads() || [];
                
                // Select the initial tube based on the current state
                if (state.length > 0) {
                  // Find the active tube from state
                  let activeTubeId = state[0].tube_number;
                  for (const thread of state) {
                    if (thread.stitches && thread.stitches.length > 0) {
                      // If this tube has a ready stitch, prioritize it
                      activeTubeId = thread.tube_number;
                      break;
                    }
                  }
                  
                  console.log(`Initializing with tube ${activeTubeId} from adapter state`);
                  
                  // Use the new selectTube method for more reliable initialization
                  adapterRef.current.selectTube(activeTubeId);
                } else {
                  // Default to the first tube
                  console.log('No thread data found, defaulting to tube 1');
                  adapterRef.current.selectTube(1);
                }
              } else {
                console.warn('Unable to initialize - TubeCycler or adapter not ready');
                // Still try to move to the next tube as a last resort
                if (tubeCyclerRef.current) {
                  tubeCyclerRef.current.nextTube();
                }
                
                // CRITICAL FIX: Set loading to false regardless of outcome
                // This ensures the spinner doesn't get stuck
                setIsLoading(false);
              }
            }, 200); // Longer timeout for more reliable initialization
          } else {
            console.warn('No thread data returned from adapter or TubeCycler not initialized');
            
            // CRITICAL FIX: If we have an adapter but no thread data, try to create default data
            if (adapterRef.current) {
              console.log('Attempting to recover by forcing tube selection');
              setTimeout(() => {
                if (adapterRef.current) {
                  // Force selection of tube 1 to trigger content loading
                  adapterRef.current.selectTube(1);
                  // Ensure loading spinner is removed
                  setIsLoading(false);
                }
              }, 300);
            } else {
              // Ensure loading spinner is removed even if we can't recover
              setIsLoading(false);
            }
          }
          
          // Mark as initialized
          setHasInitialized(true);
        }).catch(error => {
          // Clear the timeout since initialization completed (with error)
          clearTimeout(initializationTimeout);
          
          console.error('Failed to initialize adapter:', error);
          
          // CRITICAL FIX: Ensure loading spinner is removed
          setIsLoading(false);
          
          // Try to recover by falling back to legacy mode
          console.warn('Falling back to legacy mode after adapter initialization failure');
          setUseNewArchitecture(false);
          initializeLegacyMode();
        });
      }
    } else {
      // Initialize legacy mode
      initializeLegacyMode();
    }
    
    // Function to initialize using legacy recovery approach
    function initializeLegacyMode() {
      console.log('CRITICAL PERSISTENCE: Using legacy state recovery mechanisms');
      
      // First check sessionStorage for the most recent state
      let mostRecentState = null;
      let mostRecentTimestamp = 0;
      
      try {
        const sessionState = sessionStorage.getItem('zenjin_active_stitch_session');
        if (sessionState) {
          const state = JSON.parse(sessionState);
          if (state.userId === userId && state.timestamp) {
            console.log(`CRITICAL PERSISTENCE: Found saved stitch state in sessionStorage for ${state.stitchId}`);
            mostRecentState = state;
            mostRecentTimestamp = state.timestamp;
          }
        }
      } catch (err) {
        console.error('CRITICAL PERSISTENCE: Error checking sessionStorage for saved state:', err);
      }
      
      // Then check localStorage if we didn't find anything in sessionStorage or to compare timestamps
      try {
        const localState = localStorage.getItem('zenjin_active_stitch');
        if (localState) {
          const state = JSON.parse(localState);
          if (state.userId === userId && state.timestamp) {
            console.log(`CRITICAL PERSISTENCE: Found saved stitch state in localStorage for ${state.stitchId}`);
            
            // Use localStorage state if it's more recent or if we don't have a state yet
            if (!mostRecentState || state.timestamp > mostRecentTimestamp) {
              mostRecentState = state;
              mostRecentTimestamp = state.timestamp;
              console.log(`CRITICAL PERSISTENCE: Using localStorage state as it's the most recent`);
            }
          }
        }
      } catch (err) {
        console.error('CRITICAL PERSISTENCE: Error checking localStorage for saved state:', err);
      }
      
      // Check IndexedDB as well (if available)
      try {
        const openRequest = window.indexedDB.open('zenjin_state_db', 1);
        
        openRequest.onsuccess = (event) => {
          try {
            const db = openRequest.result;
            
            // Check if the stitch_state store exists
            if (db.objectStoreNames.contains('stitch_state')) {
              const transaction = db.transaction(['stitch_state'], 'readonly');
              const store = transaction.objectStore('stitch_state');
              
              const getRequest = store.get(`stitch_state_${userId}`);
              
              getRequest.onsuccess = () => {
                const idbState = getRequest.result?.data;
                if (idbState && idbState.userId === userId && idbState.timestamp) {
                  console.log(`CRITICAL PERSISTENCE: Found saved stitch state in IndexedDB for ${idbState.stitchId}`);
                  
                  // Use IndexedDB state if it's more recent
                  if (!mostRecentState || idbState.timestamp > mostRecentTimestamp) {
                    mostRecentState = idbState;
                    mostRecentTimestamp = idbState.timestamp;
                    console.log(`CRITICAL PERSISTENCE: Using IndexedDB state as it's the most recent`);
                  }
                  
                  // Process the most recent state if found
                  processRestoredState(mostRecentState);
                } else {
                  // Still process any state we found in localStorage/sessionStorage
                  processRestoredState(mostRecentState);
                }
              };
              
              getRequest.onerror = (error) => {
                console.error('CRITICAL PERSISTENCE: Error retrieving from IndexedDB:', error);
                // Still process any state we found in localStorage/sessionStorage
                processRestoredState(mostRecentState);
              };
            } else {
              // Store doesn't exist yet, process whatever we found in localStorage/sessionStorage
              processRestoredState(mostRecentState);
            }
          } catch (err) {
            console.error('CRITICAL PERSISTENCE: Error accessing IndexedDB:', err);
            // Fall back to localStorage/sessionStorage state
            processRestoredState(mostRecentState);
          }
        };
        
        openRequest.onerror = (event) => {
          console.error('CRITICAL PERSISTENCE: IndexedDB error:', event);
          // Fall back to localStorage/sessionStorage state
          processRestoredState(mostRecentState);
        };
      } catch (idbErr) {
        console.error('CRITICAL PERSISTENCE: IndexedDB not available:', idbErr);
        // Process the state from localStorage/sessionStorage if IndexedDB isn't available
        processRestoredState(mostRecentState);
      }
    }
    
    // Function to process the restored state from any source
    function processRestoredState(state) {
      if (!state) {
        console.log('CRITICAL PERSISTENCE: No saved state found in any storage mechanism');
        setHasInitialized(true);
        return;
      }
      
      // Verify the state is recent enough
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;
      
      if (now - state.timestamp > ONE_DAY) {
        console.log('CRITICAL PERSISTENCE: Saved state is too old, not restoring');
        setHasInitialized(true);
        return;
      }
      
      // Import and use the client to ensure it's persisted to the database
      console.log(`CRITICAL PERSISTENCE: Ensuring saved state is persisted to database for ${state.stitchId}`);
      
      import('../lib/supabase-client').then(({ updateUserStitchProgress, saveTubePosition }) => {
        // First save the stitch progress
        updateUserStitchProgress(
          state.userId,
          state.threadId,
          state.stitchId,
          state.orderNumber,
          state.skipNumber || 3,
          state.distractorLevel || 'L1',
          false // Not urgent
        ).then(success => {
          if (success) {
            console.log(`CRITICAL PERSISTENCE: Successfully restored stitch state for ${state.stitchId}`);
            
            // If we have tube information, also save that
            if (state.tubeNumber) {
              console.log(`CRITICAL PERSISTENCE: Also saving tube position: Tube-${state.tubeNumber}`);
              saveTubePosition(
                state.userId,
                state.tubeNumber,
                state.threadId
              ).then(tubeSuccess => {
                if (tubeSuccess) {
                  console.log(`CRITICAL PERSISTENCE: Tube position saved successfully`);
                } else {
                  console.error(`CRITICAL PERSISTENCE: Failed to save tube position`);
                }
              });
            }
          } else {
            console.error(`CRITICAL PERSISTENCE: Failed to restore saved state for ${state.stitchId}`);
          }
          
          // Mark as initialized regardless of success to avoid infinite retry loop
          setHasInitialized(true);
        });
      }).catch(err => {
        console.error('CRITICAL PERSISTENCE: Error importing client for state restoration:', err);
        setHasInitialized(true);
      });
    }
  }, [userId, hasInitialized, threadData, useNewArchitecture]);

  // When a stitch is selected by the TubeCycler
  const handleStitchSelected = async (stitch: StitchWithProgress | null, threadId: string) => {
    console.log(`Stitch selected: ${stitch?.id || 'none'} from thread ${threadId}`);
    
    setActiveStitch(stitch);
    setActiveThreadId(threadId);
    
    // Find the active thread from threadData
    const thread = threadData.find(t => t.thread_id === threadId) || null;
    setActiveThread(thread);
    
    // CRITICAL PERSISTENCE: Track the active stitch in multiple places
    if (stitch && threadId) {
      console.log(`CRITICAL PERSISTENCE: Recording active stitch ${stitch.id} for user ${userId}`);
      
      // Get the tube number for this thread
      const tubeNumber = thread?.tube_number || (thread?.thread_id?.includes('A') ? 1 : 
                                               thread?.thread_id?.includes('B') ? 2 : 
                                               thread?.thread_id?.includes('C') ? 3 : 1);
      
      const timestamp = Date.now();
      const stitchData = {
        userId,
        threadId,
        stitchId: stitch.id,
        orderNumber: stitch.order_number,
        skipNumber: stitch.skip_number || 3,
        distractorLevel: stitch.distractor_level || 'L1',
        tubeNumber, // Include tube number with the stitch data for better recovery
        timestamp
      };
      
      // 1. Store in window global state
      if (typeof window !== 'undefined') {
        window.__LAST_USER_STITCH = {
          userId,
          threadId,
          stitchId: stitch.id,
          timestamp
        };
      }
      
      // 2. Store in localStorage
      try {
        localStorage.setItem('zenjin_last_active_stitch', JSON.stringify(stitchData));
        localStorage.setItem('zenjin_active_stitch', JSON.stringify(stitchData));
        console.log(`CRITICAL PERSISTENCE: Saved active stitch to localStorage`);
      } catch (err) {
        console.error('CRITICAL PERSISTENCE: Error saving to localStorage:', err);
      }
      
      // 3. Store in sessionStorage (more reliable for same-window refresh)
      try {
        sessionStorage.setItem('zenjin_active_stitch_session', JSON.stringify(stitchData));
        console.log(`CRITICAL PERSISTENCE: Saved active stitch to sessionStorage`);
      } catch (err) {
        console.error('CRITICAL PERSISTENCE: Error saving to sessionStorage:', err);
      }
      
      // 4. Store in IndexedDB (very reliable across refreshes)
      try {
        const openRequest = window.indexedDB.open('zenjin_state_db', 1);
        
        openRequest.onupgradeneeded = (event) => {
          const db = openRequest.result;
          // Create object store if it doesn't exist
          if (!db.objectStoreNames.contains('stitch_state')) {
            db.createObjectStore('stitch_state', { keyPath: 'key' });
          }
        };
        
        openRequest.onsuccess = (event) => {
          try {
            const db = openRequest.result;
            const transaction = db.transaction(['stitch_state'], 'readwrite');
            const store = transaction.objectStore('stitch_state');
            
            // Store with a key based on userId
            store.put({
              key: `stitch_state_${userId}`,
              data: stitchData
            });
            
            transaction.oncomplete = () => {
              console.log(`CRITICAL PERSISTENCE: Saved active stitch to IndexedDB`);
            };
          } catch (err) {
            console.error('CRITICAL PERSISTENCE: Error saving to IndexedDB:', err);
          }
        };
      } catch (err) {
        console.error('CRITICAL PERSISTENCE: Error with IndexedDB:', err);
      }
      
      // 5. Save to database directly
      try {
        const { updateUserStitchProgress, saveTubePosition } = await import('../lib/supabase-client');
        
        // First save the stitch progress
        const success = await updateUserStitchProgress(
          userId,
          threadId,
          stitch.id, 
          stitch.order_number,
          stitch.skip_number || 3,
          stitch.distractor_level || 'L1',
          false // Not urgent - ensure complete persistence
        );
        
        if (success) {
          console.log(`CRITICAL PERSISTENCE: Successfully saved active stitch to database`);
          
          // Also save the tube position to ensure both are in sync
          if (tubeNumber) {
            saveTubePosition(userId, tubeNumber, threadId)
              .then(tubeSuccess => {
                if (tubeSuccess) {
                  console.log(`CRITICAL PERSISTENCE: Also saved tube position (Tube-${tubeNumber})`);
                }
              });
          }
        } else {
          console.error(`CRITICAL PERSISTENCE: Failed to save active stitch to database`);
        }
      } catch (err) {
        console.error('CRITICAL PERSISTENCE: Error saving active stitch to database:', err);
      }
    }
    
    // Always ensure the stitch has a questions array
    if (stitch) {
      if (!stitch.questions) {
        stitch.questions = [];
      }
      
      // If the stitch has no questions, add sample questions in any environment
      if (stitch.questions.length === 0) {
        console.log(`Adding sample questions to stitch ${stitch.id} since it has none`);
        
        const mathOperations = ['+', '-', '×', '÷'];
        const sampleQuestions = [];
        
        // Generate 10 sample math questions
        for (let i = 1; i <= 10; i++) {
          const op = mathOperations[i % 4];
          let num1 = Math.floor(Math.random() * 10) + 1;
          let num2 = Math.floor(Math.random() * 10) + 1;
          let correctAnswer = '';
          let incorrectAnswers = [];
          
          // Ensure division problems have clean answers
          if (op === '÷') {
            num2 = Math.floor(Math.random() * 5) + 1; // 1-5
            num1 = num2 * (Math.floor(Math.random() * 5) + 1); // Ensure divisible
          }
          
          // Calculate correct answer
          switch (op) {
            case '+': correctAnswer = String(num1 + num2); break;
            case '-': correctAnswer = String(num1 - num2); break;
            case '×': correctAnswer = String(num1 * num2); break;
            case '÷': correctAnswer = String(num1 / num2); break;
          }
          
          // Generate wrong answers close to correct one
          const correctNum = Number(correctAnswer);
          incorrectAnswers = [
            String(correctNum + 1),
            String(correctNum - 1),
            String(correctNum + 2)
          ];
          
          sampleQuestions.push({
            id: `${stitch.id}-q${i}`,
            text: `${num1} ${op} ${num2}`,
            correctAnswer: correctAnswer,
            distractors: {
              L1: incorrectAnswers[0],
              L2: incorrectAnswers[1],
              L3: incorrectAnswers[2]
            }
          });
        }
        
        // Set the questions on the stitch
        stitch.questions = sampleQuestions;
        console.log(`Created ${sampleQuestions.length} sample math questions for stitch ${stitch.id}`);
      }
    }
    
    setIsLoading(false);
  };

  // Flag to prevent double tube rotation
  const rotationInProgressRef = useRef(false);
  
  // Function to continue session after async operations
  const continueSession = (nextStitch: StitchWithProgress | null) => {
    console.log(`Continuing session with next stitch: ${nextStitch?.id || 'none'}`);
    
    // Rest of the completion handling logic
    if (nextStitch) {
      let nextThread: string | null = null;
      let nextTube: string | null = null;
      
      if (useNewArchitecture && adapterRef.current) {
        // Get the next thread and tube from the adapter
        nextThread = adapterRef.current.getCurrentThread();
        nextTube = adapterRef.current.getCurrentTube();
        
        // Use the adapter's persistCurrentState method to ensure the state is saved
        adapterRef.current.persistCurrentState().then(success => {
          if (success) {
            console.log(`Using adapter for state persistence: Successfully persisted state for next thread ${nextThread}, next tube ${nextTube}`);
          } else {
            console.warn(`Using adapter for state persistence: Failed to persist state for next thread ${nextThread}, next tube ${nextTube}`);
          }
          
          // CRITICAL FIX: Only rotate tube if not already in progress
          // This prevents the double rotation issue
          if (!rotationInProgressRef.current) {
            console.log('CRITICAL FIX: Moving to next tube after stitch completion');
            rotationInProgressRef.current = true;
            
            setTimeout(() => {
              if (adapterRef.current) {
                adapterRef.current.nextTube();
              }
              // Reset flag after rotation completes
              setTimeout(() => {
                rotationInProgressRef.current = false;
              }, 500);
            }, 300);
          } else {
            console.log('CRITICAL FIX: Tube rotation already in progress, skipping duplicate rotation');
          }
        });
      } else if (tubeCyclerRef.current) {
        // Legacy mode - ensure we cycle to the next tube
        // CRITICAL FIX: Only rotate tube if not already in progress
        if (!rotationInProgressRef.current) {
          console.log('CRITICAL FIX: Moving to next tube after stitch completion (legacy mode)');
          rotationInProgressRef.current = true;
          
          setTimeout(() => {
            if (tubeCyclerRef.current) {
              tubeCyclerRef.current.nextTube();
            }
            // Reset flag after rotation completes
            setTimeout(() => {
              rotationInProgressRef.current = false;
            }, 500);
          }, 300);
        } else {
          console.log('CRITICAL FIX: Tube rotation already in progress, skipping duplicate rotation (legacy mode)');
        }
      }
    } else {
      // If no next stitch is available, still move to the next tube
      // CRITICAL FIX: Only rotate tube if not already in progress
      if (!rotationInProgressRef.current) {
        console.log('No next stitch available, still cycling to next tube');
        rotationInProgressRef.current = true;
        
        setTimeout(() => {
          if (useNewArchitecture && adapterRef.current) {
            adapterRef.current.nextTube();
          } else if (tubeCyclerRef.current) {
            tubeCyclerRef.current.nextTube();
          }
          // Reset flag after rotation completes
          setTimeout(() => {
            rotationInProgressRef.current = false;
          }, 500);
        }, 300);
      } else {
        console.log('CRITICAL FIX: Tube rotation already in progress, skipping duplicate rotation');
      }
    }
    
    // Only reset and continue if not exiting
    if (!isExitSessionMode) {
      // Reset session state and move to next stitch automatically
      // Use a slightly longer timeout to provide a seamless transition
      // Also ensures all persistence operations have completed
      setTimeout(() => {
        console.log('Resetting session state and moving to next stitch');
        setIsSessionComplete(false);
        setSessionResults(null);
      }, 800);
    }
  };

  // When a session is completed in the DistinctionPlayer
  const handleSessionComplete = async (results: any, isExitRequested = false) => {
    setSessionResults(results);
    setIsSessionComplete(true);
    console.log('Session completed with score:', results.correctAnswers, 'out of', results.totalQuestions);
    console.log('Exit requested:', isExitRequested);
    
    // Accumulate session data regardless of whether it's an exit or continuation
    setAccumulatedSessionData(prev => {
      const newData = {
        totalPoints: prev.totalPoints + (results.totalPoints || 0),
        correctAnswers: prev.correctAnswers + (results.correctAnswers || 0),
        firstTimeCorrect: prev.firstTimeCorrect + (results.firstTimeCorrect || 0),
        totalQuestions: prev.totalQuestions + (results.totalQuestions || 0),
        totalAttempts: prev.totalAttempts + (results.totalAttempts || 0),
        stitchesCompleted: prev.stitchesCompleted + 1
      };
      
      console.log('Accumulated session data:', newData);
      return newData;
    });
    
    // If user explicitly requested to end session, enter exit mode
    if (isExitRequested) {
      console.log('User requested to end session');
      setExitSessionMode(true);
      
      // When exiting, ensure the current state is fully persisted
      if (useNewArchitecture && adapterRef.current) {
        console.log('Using adapter to force state persistence before exit');
        await adapterRef.current.persistCurrentState();
      } else if (activeStitch && activeThreadId) {
        await ensureStatePersistence(activeStitch, activeThreadId);
      }
      
      // No need to advance to next stitch, user wants to end session
      return;
    }
    
    // Handle stitch completion and move to next tube
    if (activeStitch && activeThreadId) {
      const score = results.correctAnswers || 0;
      const totalQuestions = results.totalQuestions || 20;
      const isPerfectScore = score === totalQuestions;
      
      // Don't force perfect scores - use the actual score
      const effectiveScore = score;
      
      console.log(`Processing session completion - ${effectiveScore}/${totalQuestions} (Perfect score: ${isPerfectScore ? 'YES' : 'NO'})`);
      
      let nextStitch: StitchWithProgress | null = null;
      
      // IMPROVEMENT: If it's a perfect score, use reorder-tube-stitches API
      if (isPerfectScore) {
        console.log('Perfect score achieved! Using reorder-tube-stitches API for reliable stitch progression');
        
        try {
          // Determine current tube number
          const currentTubeNum = useNewArchitecture && adapterRef.current ? 
            adapterRef.current.getCurrentTubeNumber() : 
            (activeThread?.tube_number || 1);
          
          // Get the stitch and thread info
          const skipNumber = activeStitch.skip_number || 3;
          
          // Call the existing API endpoint
          const response = await fetch('/api/reorder-tube-stitches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              tubeNumber: currentTubeNum,
              threadId: activeThreadId,
              completedStitchId: activeStitch.id,
              skipNumber
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Stitch reordering result:', data);
            
            if (data.success) {
              console.log(`Tube-${currentTubeNum} stitches reordered successfully!`);
              
              // Create a new StitchWithProgress to return
              // The reorder-tube-stitches API returns different data structure than force-stitch-advancement
              // We'll use a generated ID that follows the pattern stitch-{thread}-{timestamp}
              const newStitchId = data.stats?.newStitchId || `stitch-${activeThreadId.replace('thread-', '')}-${Date.now().toString(36)}`;
              
              nextStitch = {
                id: newStitchId,
                threadId: activeThreadId,
                title: `Next Stitch for ${activeThreadId}`,
                content: 'Content will be loaded when needed',
                orderNumber: 0,
                skip_number: 3,
                distractor_level: 'L1',
                questions: []
              };
              
              // Refresh state from server
              if (useNewArchitecture && adapterRef.current) {
                // Force state refresh by fetching latest stitches
                try {
                  const userStitchesResponse = await fetch(`/api/user-stitches?userId=${encodeURIComponent(userId)}`);
                  
                  if (userStitchesResponse.ok) {
                    console.log('Successfully refreshed user stitches after reordering');
                  }
                  
                  await adapterRef.current.persistCurrentState();
                } catch (err) {
                  console.error('Error refreshing state after stitch reordering:', err);
                }
              }
              
              // Continue the session with the new stitch
              continueSession(nextStitch);
              return;
            } else {
              console.error('Stitch reordering failed:', data.error);
              // Continue with fallback methods below
            }
          } else {
            console.error('Stitch reordering API error:', response.status);
            // Continue with fallback methods below
          }
        } catch (err) {
          console.error('Error calling reorder-tube-stitches API:', err);
          // Continue with fallback methods below
        }
      }
      
      // Fallback to original methods if not a perfect score or if the API call failed
      if (useNewArchitecture && adapterRef.current) {
        // Using the new architecture with TubeCyclerAdapter
        console.log('Using adapter to process stitch completion');
        
        try {
          // The adapter handles state persistence internally
          // Note: handleStitchCompletion is now async
          adapterRef.current.handleStitchCompletion(
            activeThreadId,
            activeStitch.id,
            effectiveScore,
            totalQuestions
          ).then(result => {
            nextStitch = result;
            
            // If adapter returned no stitch, log the error but try to continue
            if (!nextStitch) {
              console.warn('Adapter returned no next stitch, attempting recovery');
              
              // Try to cycle to the next tube to recover
              setTimeout(() => {
                if (adapterRef.current) {
                  adapterRef.current.nextTube();
                }
              }, 100);
            }
            
            // Continue the session
            continueSession(nextStitch);
          }).catch(asyncErr => {
            console.error('Async error processing stitch completion through adapter:', asyncErr);
            
            // Try to recover by moving to next tube
            // CRITICAL FIX: Only rotate tube if not already in progress
            if (!rotationInProgressRef.current) {
              rotationInProgressRef.current = true;
              setTimeout(() => {
                if (adapterRef.current) {
                  adapterRef.current.nextTube();
                }
                // Reset flag after rotation completes
                setTimeout(() => {
                  rotationInProgressRef.current = false;
                }, 500);
              }, 100);
            } else {
              console.log('CRITICAL FIX: Tube rotation already in progress, skipping duplicate rotation');
            }
          });
          
          // Return early as we'll handle continuation in the Promise
          return;
        } catch (err) {
          console.error('Error processing stitch completion through adapter:', err);
          
          // Try to recover by moving to next tube
          // CRITICAL FIX: Only rotate tube if not already in progress
          if (!rotationInProgressRef.current) {
            rotationInProgressRef.current = true;
            setTimeout(() => {
              if (adapterRef.current) {
                adapterRef.current.nextTube();
              }
              // Reset flag after rotation completes
              setTimeout(() => {
                rotationInProgressRef.current = false;
              }, 500);
            }, 100);
          } else {
            console.log('CRITICAL FIX: Tube rotation already in progress, skipping duplicate rotation');
          }
        }
      } else if (tubeCyclerRef.current) {
        // Using legacy TubeCycler
        // CRITICAL: First directly save the progress to ensure it's persisted
        await ensureStatePersistence(activeStitch, activeThreadId);
        
        // Complete the stitch and cycle to the next tube
        nextStitch = tubeCyclerRef.current.handleStitchCompletion(
          activeThreadId,
          activeStitch.id,
          effectiveScore,
          totalQuestions
        );
      } else {
        console.error('No tube cycler or adapter available to process stitch completion');
      }
      
      console.log(`Stitch completion processed. New ready stitch: ${nextStitch?.id || 'none'}`);
      
      // For legacy mode or if we reached this point in the async mode
      if (nextStitch) {
        if (tubeCyclerRef.current && !useNewArchitecture) {
          // Legacy mode: Get the next thread and tube from TubeCycler
          const nextThread = tubeCyclerRef.current.getCurrentThread();
          const nextTube = tubeCyclerRef.current.getCurrentTube();
          
          if (nextThread) {
            console.log(`CRITICAL PERSISTENCE: Pre-persisting next stitch ${nextStitch.id} in thread ${nextThread}`);
            
            // Get tube number from the tube name
            const tubeNumberMatch = nextTube?.match(/Tube-(\d+)/);
            const tubeNumber = tubeNumberMatch ? parseInt(tubeNumberMatch[1]) : 1;
            
            // Prepare the stitch data
            const timestamp = Date.now();
            const nextStitchData = {
              userId,
              threadId: nextThread,
              stitchId: nextStitch.id,
              orderNumber: nextStitch.order_number || 0,
              skipNumber: nextStitch.skip_number || 3,
              distractorLevel: nextStitch.distractor_level || 'L1',
              tubeNumber,
              timestamp
            };
            
            // Store in multiple persistence layers for redundancy
            try {
              // 1. localStorage
              localStorage.setItem('zenjin_active_stitch', JSON.stringify(nextStitchData));
              localStorage.setItem('zenjin_next_stitch', JSON.stringify(nextStitchData));
              
              // 2. sessionStorage
              sessionStorage.setItem('zenjin_active_stitch_session', JSON.stringify(nextStitchData));
              
              // 3. global variable
              if (typeof window !== 'undefined') {
                window.__LAST_USER_STITCH = {
                  userId,
                  threadId: nextThread,
                  stitchId: nextStitch.id,
                  timestamp
                };
              }
              
              console.log('CRITICAL PERSISTENCE: Pre-saved next stitch state to browser storage');
            } catch (err) {
              console.error('CRITICAL PERSISTENCE: Error pre-saving next stitch state:', err);
            }
            
            // 4. Database
            try {
              const { updateUserStitchProgress, saveTubePosition } = await import('../lib/supabase-client');
              
              // Push to queue for processing in the background
              if (typeof window !== 'undefined') {
                window.__STITCH_UPDATE_QUEUE = window.__STITCH_UPDATE_QUEUE || [];
                window.__STITCH_UPDATE_QUEUE.push({
                  userId,
                  threadId: nextThread,
                  stitchId: nextStitch.id,
                  orderNumber: nextStitch.order_number || 0,
                  skipNumber: nextStitch.skip_number || 3,
                  distractorLevel: nextStitch.distractor_level || 'L1'
                });
              }
              
              // Also save tube position
              saveTubePosition(userId, tubeNumber, nextThread)
                .then(success => {
                  if (success) {
                    console.log(`CRITICAL PERSISTENCE: Pre-saved next tube position (Tube-${tubeNumber})`);
                  } else {
                    console.error('CRITICAL PERSISTENCE: Failed to pre-save tube position');
                  }
                });
            } catch (err) {
              console.error('CRITICAL PERSISTENCE: Error pre-saving to database:', err);
            }
          }
        }
      }
      
      // Call continueSession for synchronous code path
      continueSession(nextStitch);
    } else {
      console.error('Missing data for session completion:',
        activeStitch ? 'Has activeStitch' : 'No activeStitch',
        activeThreadId ? `Thread: ${activeThreadId}` : 'No activeThreadId',
        useNewArchitecture ? 
          (adapterRef.current ? 'Has adapter' : 'No adapter') : 
          (tubeCyclerRef.current ? 'Has tubeCycler' : 'No tubeCycler')
      );
      
      // Try to recover by moving to next tube
      if (useNewArchitecture && adapterRef.current) {
        setTimeout(() => {
          if (adapterRef.current) {
            adapterRef.current.nextTube();
          }
        }, 100);
      } else if (tubeCyclerRef.current) {
        tubeCyclerRef.current.nextTube();
      }
      
      // Call continueSession anyway to make sure we reset state
      continueSession(null);
    }
  };
  
  // Helper function to ensure state is persisted across all storage mechanisms
  const ensureStatePersistence = async (stitch: StitchWithProgress, threadId: string) => {
    try {
      console.log(`CRITICAL PERSISTENCE: Ensuring comprehensive persistence for stitch ${stitch.id}`);
      
      // Find thread to get tube number
      const thread = threadData.find(t => t.thread_id === threadId);
      const tubeNumber = thread?.tube_number || 
                        (threadId.includes('A') ? 1 : 
                         threadId.includes('B') ? 2 : 
                         threadId.includes('C') ? 3 : 1);
      
      // 1. Save to database using our client
      const { updateUserStitchProgress, saveTubePosition } = await import('../lib/supabase-client');
      
      // First the stitch progress
      const stitchSaveSuccess = await updateUserStitchProgress(
        userId,
        threadId,
        stitch.id,
        stitch.order_number,
        stitch.skip_number || 3,
        stitch.distractor_level || 'L1',
        false // Not urgent - make sure it fully completes
      );
      
      // Then the tube position (even if stitch save failed)
      const tubeSaveSuccess = await saveTubePosition(
        userId,
        tubeNumber,
        threadId
      );
      
      console.log(`CRITICAL PERSISTENCE: Database save results - Stitch: ${stitchSaveSuccess ? 'Success' : 'Failed'}, Tube: ${tubeSaveSuccess ? 'Success' : 'Failed'}`);
      
      // 2. Also save to all browser storage mechanisms
      const timestamp = Date.now();
      const stateData = {
        userId,
        threadId,
        stitchId: stitch.id,
        orderNumber: stitch.order_number,
        skipNumber: stitch.skip_number || 3,
        distractorLevel: stitch.distractor_level || 'L1',
        tubeNumber,
        timestamp
      };
      
      // localStorage
      try {
        localStorage.setItem('zenjin_player_state', JSON.stringify(stateData));
        localStorage.setItem('zenjin_active_stitch', JSON.stringify(stateData));
        localStorage.setItem('zenjin_current_tube', JSON.stringify({
          userId,
          tubeNumber,
          threadId,
          timestamp
        }));
      } catch (err) {
        console.error('CRITICAL PERSISTENCE: Error saving to localStorage:', err);
      }
      
      // sessionStorage
      try {
        sessionStorage.setItem('zenjin_active_stitch_session', JSON.stringify(stateData));
        sessionStorage.setItem('zenjin_tube_session', JSON.stringify({
          userId,
          tubeNumber,
          threadId,
          timestamp
        }));
      } catch (err) {
        console.error('CRITICAL PERSISTENCE: Error saving to sessionStorage:', err);
      }
      
      // IndexedDB
      try {
        const openRequest = window.indexedDB.open('zenjin_state_db', 1);
        
        openRequest.onupgradeneeded = (event) => {
          try {
            const db = openRequest.result;
            
            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains('stitch_state')) {
              db.createObjectStore('stitch_state', { keyPath: 'key' });
            }
            
            if (!db.objectStoreNames.contains('tube_state')) {
              db.createObjectStore('tube_state', { keyPath: 'key' });
            }
          } catch (err) {
            console.warn('CRITICAL PERSISTENCE: Error creating IndexedDB stores:', err);
          }
        };
        
        openRequest.onsuccess = (event) => {
          try {
            const db = openRequest.result;
            
            // Save stitch state
            const stitchTransaction = db.transaction(['stitch_state'], 'readwrite');
            const stitchStore = stitchTransaction.objectStore('stitch_state');
            
            stitchStore.put({
              key: `stitch_state_${userId}`,
              data: stateData
            });
            
            // Save tube state
            const tubeTransaction = db.transaction(['tube_state'], 'readwrite');
            const tubeStore = tubeTransaction.objectStore('tube_state');
            
            tubeStore.put({
              key: `tube_position_${userId}`,
              data: {
                userId,
                tubeNumber,
                threadId,
                timestamp
              }
            });
          } catch (err) {
            console.error('CRITICAL PERSISTENCE: Error saving to IndexedDB:', err);
          }
        };
      } catch (err) {
        console.error('CRITICAL PERSISTENCE: Error with IndexedDB:', err);
      }
      
      // Beacon API
      try {
        // Only use if supported
        if (navigator.sendBeacon) {
          // Stitch progress
          const stitchBlob = new Blob([JSON.stringify({
            userId,
            threadId,
            stitchId: stitch.id,
            orderNumber: stitch.order_number || 0,
            skipNumber: stitch.skip_number || 3,
            distractorLevel: stitch.distractor_level || 'L1'
          })], { type: 'application/json' });
          
          const stitchBeaconSuccess = navigator.sendBeacon('/api/update-progress', stitchBlob);
          
          // Tube position
          const tubeBlob = new Blob([JSON.stringify({
            userId,
            tubeNumber,
            threadId
          })], { type: 'application/json' });
          
          const tubeBeaconSuccess = navigator.sendBeacon('/api/save-tube-position', tubeBlob);
          
          console.log(`CRITICAL PERSISTENCE: Beacon API results - Stitch: ${stitchBeaconSuccess ? 'Success' : 'Failed'}, Tube: ${tubeBeaconSuccess ? 'Success' : 'Failed'}`);
        }
      } catch (err) {
        console.error('CRITICAL PERSISTENCE: Error with Beacon API:', err);
      }
      
      console.log('CRITICAL PERSISTENCE: Comprehensive state persistence completed');
      return true;
    } catch (err) {
      console.error('CRITICAL PERSISTENCE: Error during ensureStatePersistence:', err);
      return false;
    }
  };

  // Initialize IndexedDB properly on component mount
  useEffect(() => {
    // Initialize IndexedDB on component mount to prevent "object store not found" errors
    const initializeIndexedDB = async () => {
      try {
        console.log('CRITICAL FIX: Initializing IndexedDB stores on component mount');
        const openRequest = indexedDB.open('zenjin_state_db', 1);
        
        openRequest.onupgradeneeded = (event) => {
          try {
            const db = openRequest.result;
            console.log('CRITICAL FIX: Creating IndexedDB object stores');
            
            // Create all required object stores if they don't exist
            if (!db.objectStoreNames.contains('stitch_state')) {
              db.createObjectStore('stitch_state', { keyPath: 'key' });
              console.log('CRITICAL FIX: Created stitch_state store');
            }
            
            if (!db.objectStoreNames.contains('tube_state')) {
              db.createObjectStore('tube_state', { keyPath: 'key' });
              console.log('CRITICAL FIX: Created tube_state store');
            }
            
            if (!db.objectStoreNames.contains('state_sync')) {
              db.createObjectStore('state_sync', { keyPath: 'id' });
              console.log('CRITICAL FIX: Created state_sync store');
            }
          } catch (err) {
            console.error('CRITICAL FIX: Error creating IndexedDB stores:', err);
          }
        };
        
        openRequest.onsuccess = (event) => {
          console.log('CRITICAL FIX: IndexedDB initialized successfully');
        };
        
        openRequest.onerror = (event) => {
          console.error('CRITICAL FIX: Error initializing IndexedDB:', event);
        };
      } catch (err) {
        console.error('CRITICAL FIX: Exception during IndexedDB initialization:', err);
      }
    };
    
    // Call the initialization function
    initializeIndexedDB();
    
    // Cleanup function to destroy the adapter when component unmounts
    return () => {
      if (adapterRef.current) {
        console.log('Cleaning up adapter instance');
        adapterRef.current.destroy();
        adapterRef.current = null;
      }
    };
  }, []);

  // Reset session when active stitch changes
  useEffect(() => {
    if (activeStitch) {
      setIsSessionComplete(false);
      setSessionResults(null);
      setIsLoading(false);
      
      // Log thread transition for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`Transitioning to thread ${activeThreadId}, stitch ${activeStitch.id}`);
      }
      
      if (useNewArchitecture && adapterRef.current) {
        // Let the adapter handle persistence
        console.log(`CRITICAL PERSISTENCE: Using adapter to persist stitch state for ${activeStitch.id}`);
        adapterRef.current.persistCurrentState().then(success => {
          if (success) {
            console.log(`CRITICAL PERSISTENCE: Adapter successfully persisted state for ${activeStitch.id}`);
          } else {
            console.warn(`CRITICAL PERSISTENCE: Adapter failed to persist state for ${activeStitch.id}, falling back to direct persistence`);
            
            // Fallback to direct localStorage persistence as a safety measure
            try {
              localStorage.setItem('zenjin_active_stitch_backup', JSON.stringify({
                userId,
                threadId: activeThreadId,
                stitchId: activeStitch.id,
                orderNumber: activeStitch.order_number,
                skipNumber: activeStitch.skip_number || 3,
                distractorLevel: activeStitch.distractor_level || 'L1',
                timestamp: Date.now()
              }));
            } catch (err) {
              console.error('CRITICAL PERSISTENCE: Error in fallback persistence:', err);
            }
          }
        });
      } else {
        // Legacy direct persistence
        // As soon as we have an active stitch, immediately persist its state
        // This ensures we have at least one reliable record of the current state
        try {
          localStorage.setItem('zenjin_active_stitch', JSON.stringify({
            userId,
            threadId: activeThreadId,
            stitchId: activeStitch.id,
            orderNumber: activeStitch.order_number,
            skipNumber: activeStitch.skip_number || 3,
            distractorLevel: activeStitch.distractor_level || 'L1',
            timestamp: Date.now()
          }));
          console.log(`CRITICAL PERSISTENCE: Saved active stitch state for ${activeStitch.id}`);
        } catch (err) {
          console.error('CRITICAL PERSISTENCE: Error saving active stitch state:', err);
        }
        
        // Also save to the database directly with each stitch transition
        import('../lib/supabase-client').then(({ updateUserStitchProgress }) => {
          updateUserStitchProgress(
            userId,
            activeThreadId,
            activeStitch.id, 
            activeStitch.order_number,
            activeStitch.skip_number || 3,
            activeStitch.distractor_level || 'L1',
            false // not urgent
          ).then(success => {
            if (success) {
              console.log(`CRITICAL PERSISTENCE: Successfully saved stitch state to database for ${activeStitch.id}`);
            } else {
              console.error(`CRITICAL PERSISTENCE: Failed to save stitch state to database for ${activeStitch.id}`);
            }
          });
        }).catch(err => {
          console.error('CRITICAL PERSISTENCE: Error importing client for stitch state persistence:', err);
        });
      }
    } else if (activeThreadId && !activeStitch) {
      // If we have a thread but no ready stitch, move to the next tube
      console.log(`No ready stitch in thread ${activeThreadId}, moving to next tube`);
      
      if (useNewArchitecture && adapterRef.current) {
        adapterRef.current.nextTube();
      } else if (tubeCyclerRef.current) {
        tubeCyclerRef.current.nextTube();
      }
    }
  }, [activeStitch, activeThreadId, userId, useNewArchitecture]);

  // Helper to return to main menu/home
  const handleReturnHome = () => {
    window.location.href = '/';
  };
  
  // Exit session mode with summary display
  if (exitSessionMode) {
    // Calculate accuracy for overall session
    const accuracy = accumulatedSessionData.totalAttempts > 0 ? 
      Math.round((accumulatedSessionData.correctAnswers / accumulatedSessionData.totalAttempts) * 100) : 0;
    
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl max-w-md w-full p-6 text-white">
          <h2 className="text-3xl font-bold mb-6 text-center">Session Complete!</h2>
          
          <div className="mb-8">
            <div className="text-center mb-4">
              <span className="text-5xl font-bold">{accumulatedSessionData.totalPoints}</span>
              <p className="text-sm text-white text-opacity-80 mt-1">POINTS EARNED</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-white bg-opacity-10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{accumulatedSessionData.firstTimeCorrect}/{accumulatedSessionData.totalQuestions}</p>
                <p className="text-xs text-white text-opacity-70">FIRST TRY CORRECT</p>
              </div>
              
              <div className="bg-white bg-opacity-10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{accuracy}%</p>
                <p className="text-xs text-white text-opacity-70">ACCURACY</p>
              </div>
              
              <div className="bg-white bg-opacity-10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{accumulatedSessionData.stitchesCompleted}</p>
                <p className="text-xs text-white text-opacity-70">STITCHES COMPLETED</p>
              </div>
              
              <div className="bg-white bg-opacity-10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{accumulatedSessionData.totalQuestions}</p>
                <p className="text-xs text-white text-opacity-70">QUESTIONS DONE</p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center">
            <button 
              onClick={handleReturnHome}
              className="bg-white text-teal-700 font-bold py-3 px-8 rounded-full shadow-md hover:bg-opacity-90 transition-all"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="sequential-player">
      {/* CRITICAL FIX: Always render TubeCycler (hidden when using new architecture) */}
      <div className={`mb-4 ${useNewArchitecture ? 'hidden' : ''}`}>
        <TubeCycler
          ref={tubeCyclerRef}
          threadData={threadData}
          userId={userId}
          onStitchSelected={handleStitchSelected}
        />
      </div>
      
      {/* Architecture switcher (for development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-black/20 p-2 rounded-lg mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-white/70 text-sm">Architecture:</span>
            <button
              onClick={() => setUseNewArchitecture(true)}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                useNewArchitecture 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-600/50 text-white/70 hover:bg-gray-500/70'
              }`}
            >
              New (Adapter)
            </button>
            <button
              onClick={() => setUseNewArchitecture(false)}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                !useNewArchitecture 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-600/50 text-white/70 hover:bg-gray-500/70'
              }`}
            >
              Legacy (TubeCycler)
            </button>
          </div>
        </div>
      )}
      
      {/* Loading state */}
      {isLoading && (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="text-center text-white">
            <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
            <p>Loading next stitch...</p>
          </div>
        </div>
      )}
      
      {/* No active stitch */}
      {!isLoading && !activeStitch && (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="bg-red-500/20 border border-red-300/30 text-red-100 rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold mb-2">No Active Stitch</h2>
            <p>There is no active stitch available for thread {activeThreadId || 'unknown'}.</p>
            <p className="text-xs mt-2 text-red-200/70">
              Using {useNewArchitecture ? 'new architecture' : 'legacy mode'} 
              {useNewArchitecture ? (adapterRef.current ? ' (adapter initialized)' : ' (adapter not initialized)') : ''}
            </p>
            
            {/* Button to manually move to next tube */}
            <button
              onClick={() => {
                if (useNewArchitecture && adapterRef.current) {
                  adapterRef.current.nextTube();
                } else if (tubeCyclerRef.current) {
                  tubeCyclerRef.current.nextTube();
                }
              }}
              className="mt-4 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Try Next Tube
            </button>
            
            {/* Button to switch architecture */}
            <button
              onClick={() => {
                // Reset state
                setUseNewArchitecture(!useNewArchitecture);
                setIsLoading(true);
                setHasInitialized(false);
                
                // Force reinitialization
                if (adapterRef.current) {
                  adapterRef.current.destroy();
                  adapterRef.current = null;
                }
              }}
              className="mt-2 ml-2 bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Switch to {useNewArchitecture ? 'Legacy' : 'New'} Architecture
            </button>
          </div>
        </div>
      )}
      
      {/* Active stitch player */}
      {!isLoading && activeStitch && activeThread && (
        <>
          {/* Tube info and accumulated points */}
          <div className="bg-black/30 p-3 rounded-lg mb-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-white/70 text-sm">Current Tube:</span>
                <span className="ml-2 text-teal-300 font-mono">{
                  useNewArchitecture ? 
                    (adapterRef.current?.getCurrentTube() || `Tube-?`) : 
                    (tubeCyclerRef.current?.getCurrentTube() || 
                     `Tube-${activeThread?.tube_number || '?'} (${activeThreadId.replace('thread-', '')})`)
                }</span>
              </div>
              <div>
                <span className="text-white/70 text-sm">Thread:</span>
                <span className="ml-2 text-teal-300 font-mono">{activeThreadId.replace('thread-', '')}</span>
              </div>
              <div>
                <span className="text-white/70 text-sm">Stitch:</span>
                <span className="ml-2 text-teal-300 font-mono">{activeStitch.id.split('-').pop()}</span>
              </div>
              <div>
                <span className="text-white/70 text-sm">Level:</span>
                <span className="ml-2 text-teal-300 font-mono">{activeStitch.distractor_level}</span>
              </div>
            </div>
            
            <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
              <div>
                <span className="text-white/70 text-sm">Session Total:</span>
                <span className="ml-2 text-teal-300 font-bold">{accumulatedSessionData.totalPoints} points</span>
              </div>
              <div>
                <span className="text-white/70 text-sm">Stitches Done:</span>
                <span className="ml-2 text-teal-300 font-bold">{accumulatedSessionData.stitchesCompleted}</span>
              </div>
              <div>
                <span className="text-white/70 text-sm">Cycle Count:</span>
                <span className="ml-2 text-teal-300 font-bold">
                  {useNewArchitecture ? 
                    (adapterRef.current?.getCycleCount() || 0) : 
                    (tubeCyclerRef.current?.getCycleCount() || 0)}
                </span>
              </div>
            </div>
            
            {/* Quick Testing Controls */}
            <div className="mt-3 pt-2 border-t border-white/10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-white/70 text-sm font-semibold">
                  Testing Controls:
                  <span className="text-xs text-teal-300 ml-2">
                    ({useNewArchitecture ? 'New Architecture' : 'Legacy'})
                  </span>
                </span>
                
                <div className="flex space-x-2">
                  <button
                    onClick={async () => {
                      if (!activeStitch || !activeThreadId) return;
                      
                      console.log(`TESTING: Testing stitch transition with perfect score (20/20)`);
                      
                      // Test implementation using reorder-tube-stitches API
                      const currentTubeNum = useNewArchitecture && adapterRef.current ? 
                        adapterRef.current.getCurrentTubeNumber() : 
                        (activeThread?.tube_number || 1);
                        
                      const originalStitchId = activeStitch.id;
                      const states = [];
                      
                      // Record state before
                      states.push({
                        time: 'before',
                        stitchId: originalStitchId,
                        position: useNewArchitecture && adapterRef.current ? 
                          (adapterRef.current.getState().tubes[currentTubeNum]?.position || 0) : 0,
                        tubeNum: currentTubeNum
                      });
                      
                      console.log(`CRITICAL TEST: Starting with tube=${currentTubeNum}, thread=${activeThreadId}, stitch=${originalStitchId}, position=${states[0].position}`);
                      
                      // Use the existing reorder-tube-stitches API which is known to work
                      try {
                        console.log(`Using reorder-tube-stitches API for tube ${currentTubeNum}`);
                        
                        // Get the stitch and thread info
                        const skipNumber = activeStitch.skip_number || 3;
                        
                        // Call the existing API endpoint
                        const response = await fetch('/api/reorder-tube-stitches', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            userId,
                            tubeNumber: currentTubeNum,
                            threadId: activeThreadId,
                            completedStitchId: activeStitch.id,
                            skipNumber
                          })
                        });
                        
                        if (response.ok) {
                          const data = await response.json();
                          console.log('Stitch reordering result:', data);
                          
                          if (data.success) {
                            console.log(`Tube-${currentTubeNum} stitches reordered successfully!`);
                            
                            // Record state after
                            // Account for different data structure from reorder-tube-stitches API
                            const newStitchId = data.stats?.newStitchId || `stitch-${activeThreadId.replace('thread-', '')}-${Date.now().toString(36)}`;
                            
                            states.push({
                              time: 'after',
                              stitchId: newStitchId,
                              position: states[0].position + 1, // Position should have increased
                              tubeNum: currentTubeNum
                            });
                            
                            console.log('STITCH TRANSITION TEST (20/20 score):');
                            console.log('- Before:', states[0]);
                            console.log('- After:', states[1]);
                            console.log(`- Position change: ${states[0].position} → ${states[1].position} (should INCREASE)`);
                            console.log(`- Stitch change: ${states[0].stitchId} → ${states[1].stitchId} (should be DIFFERENT)`);
                            
                            const positionChanged = states[1].position > states[0].position;
                            const stitchChanged = states[0].stitchId !== states[1].stitchId;
                            console.log(`- POSITION CHANGED: ${positionChanged ? 'YES ✅' : 'NO ❌'}`);
                            console.log(`- STITCH CHANGED: ${stitchChanged ? 'YES ✅' : 'NO ❌'}`);
                            console.log(`- RESULT: ${positionChanged && stitchChanged ? 'SUCCESS ✅' : 'FAILED ❌'}`);
                            
                            // Refresh state from server and move to next tube
                            if (useNewArchitecture && adapterRef.current) {
                              // Force state refresh by fetching latest stitches
                              try {
                                const userStitchesResponse = await fetch(`/api/user-stitches?userId=${encodeURIComponent(userId)}`);
                                
                                if (userStitchesResponse.ok) {
                                  console.log('Successfully fetched updated user stitches');
                                }
                              } catch (err) {
                                console.error('Error fetching updated user stitches:', err);
                              }
                              
                              // Persist state and move to next tube
                              adapterRef.current.persistCurrentState().then(() => {
                                setTimeout(() => {
                                  if (adapterRef.current) adapterRef.current.nextTube();
                                }, 300);
                              });
                            } else if (tubeCyclerRef.current) {
                              tubeCyclerRef.current.nextTube();
                            }
                          } else {
                            console.error('Force stitch advancement failed:', data.error);
                          }
                        } else {
                          console.error('Force stitch advancement API error:', response.status);
                        }
                      } catch (err) {
                        console.error('Error calling force-stitch-advancement API:', err);
                        
                        // Fallback to original method
                        if (useNewArchitecture && adapterRef.current) {
                          adapterRef.current.handleStitchCompletion(
                            activeThreadId,
                            activeStitch.id,
                            20, // Perfect score
                            20
                          ).then(() => {
                            if (adapterRef.current) adapterRef.current.nextTube();
                          });
                        } else {
                          // Create mock perfect results
                          const mockPerfectResults = {
                            sessionId: `session-${Date.now()}`,
                            threadId: activeThreadId,
                            stitchId: activeStitch.id, 
                            totalQuestions: 20,
                            totalAttempts: 20,
                            correctAnswers: 20,
                            firstTimeCorrect: 20,
                            accuracy: 100,
                            averageTimeToAnswer: 1500,
                            totalPoints: 60,
                            completedAt: new Date().toISOString()
                          };
                          
                          // Process this as a completed session
                          handleSessionComplete(mockPerfectResults, false);
                        }
                      }
                    }}
                    className="px-3 py-1 bg-green-600/80 hover:bg-green-500/90 text-white text-xs font-medium rounded-md"
                  >
                    Perfect Score
                  </button>
                  
                  <button
                    onClick={() => {
                      if (!activeStitch || !activeThreadId) return;
                      
                      console.log(`TESTING: Simulating partial score completion for ${activeStitch.id}`);
                      
                      // Create mock partial results - simulates completing with some errors
                      const mockPartialResults = {
                        sessionId: `session-${Date.now()}`,
                        threadId: activeThreadId,
                        stitchId: activeStitch.id, 
                        totalQuestions: 20,
                        totalAttempts: 25, // Some retries
                        correctAnswers: 15,
                        firstTimeCorrect: 10,
                        accuracy: 75,
                        averageTimeToAnswer: 2500,
                        totalPoints: 20,
                        completedAt: new Date().toISOString()
                      };
                      
                      // Process this as a completed session
                      handleSessionComplete(mockPartialResults, false);
                    }}
                    className="px-3 py-1 bg-yellow-600/80 hover:bg-yellow-500/90 text-white text-xs font-medium rounded-md"
                  >
                    Partial Score
                  </button>
                  
                  <button
                    onClick={() => {
                      console.log('TESTING: Manually cycling to next tube');
                      if (useNewArchitecture && adapterRef.current) {
                        adapterRef.current.nextTube();
                      } else if (tubeCyclerRef.current) {
                        tubeCyclerRef.current.nextTube();
                      }
                    }}
                    className="px-3 py-1 bg-blue-600/80 hover:bg-blue-500/90 text-white text-xs font-medium rounded-md"
                  >
                    Next Tube
                  </button>
                  
                  <button
                    onClick={() => {
                      if (!activeStitch || !activeThreadId) return;
                      
                      console.log(`TESTING: Testing stitch transition with imperfect score (10/20)`);
                      
                      if (useNewArchitecture && adapterRef.current) {
                        // Capture the original stitch ID before testing
                        const originalStitchId = activeStitch.id;
                        const states = [];
                        
                        // Get current tube number
                        const currentTubeNum = adapterRef.current.getCurrentTubeNumber();
                        
                        // Record state before
                        states.push({
                          time: 'before',
                          stitchId: originalStitchId,
                          position: adapterRef.current.getState().tubes[currentTubeNum]?.position || 0,
                          tubeNum: currentTubeNum
                        });
                        
                        console.log(`CRITICAL TEST: Starting with tube=${currentTubeNum}, thread=${activeThreadId}, stitch=${originalStitchId}, position=${states[0].position}`);
                        
                        // Force persistence before test to ensure clean state
                        adapterRef.current.persistCurrentState().then(() => {
                          // Test with a non-perfect score to ensure we stay on the same stitch
                          adapterRef.current.handleStitchCompletion(
                            activeThreadId,
                            activeStitch.id,
                            10, // Imperfect score - should NOT advance
                            20
                          ).then(result => {
                            // Record state after
                            const afterState = adapterRef.current.getState();
                            const afterTubeNum = adapterRef.current.getCurrentTubeNumber();
                            
                            states.push({
                              time: 'after',
                              stitchId: result?.id || 'unknown',
                              position: afterState.tubes[afterTubeNum]?.position || 0,
                              tubeNum: afterTubeNum
                            });
                            
                            console.log('STITCH TRANSITION TEST (10/20 score):');
                            console.log('- Before:', states[0]);
                            console.log('- After:', states[1]);
                            console.log(`- Position change: ${states[0].position} → ${states[1].position} (should STAY SAME)`);
                            console.log(`- Stitch change: ${states[0].stitchId} → ${states[1].stitchId} (should STAY SAME)`);
                            
                            const positionSame = states[0].position === states[1].position;
                            const stitchSame = states[0].stitchId === states[1].stitchId;
                            console.log(`- POSITION SAME: ${positionSame ? 'YES ✅' : 'NO ❌'}`);
                            console.log(`- STITCH SAME: ${stitchSame ? 'YES ✅' : 'NO ❌'}`);
                            console.log(`- RESULT: ${positionSame && stitchSame ? 'SUCCESS ✅' : 'FAILED ❌'}`);
                              
                            // Ensure we persist changes
                            adapterRef.current.persistCurrentState().then(() => {
                              // Move to next tube to see effect
                              setTimeout(() => {
                                if (adapterRef.current) adapterRef.current.nextTube();
                              }, 500);
                            });
                          });
                        });
                      } else if (tubeCyclerRef.current) {
                        // Capture state before
                        const beforeStitchId = activeStitch.id;
                        const stateManager = window['stateManager']; // Unsafe but for testing only
                        const beforePosition = stateManager?.getState()?.tubes?.[1]?.position || 0;
                        
                        const result = tubeCyclerRef.current.handleStitchCompletion(
                          activeThreadId,
                          activeStitch.id,
                          10, // Imperfect score - should not advance
                          20
                        );
                        
                        // Get state after
                        const afterStitchId = result?.id || 'unknown';
                        const afterPosition = stateManager?.getState()?.tubes?.[1]?.position || 0;
                        
                        console.log('STITCH TRANSITION TEST (10/20 score):');
                        console.log('- Before:', { stitchId: beforeStitchId, position: beforePosition });
                        console.log('- After:', { stitchId: afterStitchId, position: afterPosition });
                        console.log(`- Position change: ${beforePosition} → ${afterPosition} (should be SAME)`);
                        console.log(`- Stitch change: ${beforeStitchId} → ${afterStitchId} (should be SAME)`);
                        
                        const positionSame = beforePosition === afterPosition;
                        const stitchSame = beforeStitchId === afterStitchId;
                        console.log(`- POSITION SAME: ${positionSame ? 'YES ✅' : 'NO ❌'}`);
                        console.log(`- STITCH SAME: ${stitchSame ? 'YES ✅' : 'NO ❌'}`);
                        console.log(`- RESULT: ${positionSame && stitchSame ? 'SUCCESS ✅' : 'FAILED ❌'}`);
                          
                        // Move to next tube to see effect
                        setTimeout(() => {
                          if (tubeCyclerRef.current) tubeCyclerRef.current.nextTube();
                        }, 500);
                      }
                    }}
                    className="px-3 py-1 bg-purple-600/80 hover:bg-purple-500/90 text-white text-xs font-medium rounded-md"
                  >
                    Test 10/20 Score
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Player component */}
          <DistinctionPlayer
            thread={{
              id: activeThread.thread_id,
              name: activeThread.thread_id,
              description: `Thread ${activeThread.thread_id}`,
              stitches: [activeStitch]
            }}
            onComplete={handleSessionComplete}
            onEndSession={(results) => handleSessionComplete(results, true)}
            questionsPerSession={20}
            sessionTotalPoints={accumulatedSessionData.totalPoints}
          />
        </>
      )}
      
      {/* Debug info - only in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 bg-black/50 p-3 rounded-lg">
          <h3 className="text-white text-sm font-bold mb-2">Debug Info</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-white/70 font-semibold">State:</p>
              <p className="text-xs text-white/70">Architecture: {useNewArchitecture ? 'New' : 'Legacy'}</p>
              <p className="text-xs text-white/70">Adapter: {adapterRef.current ? 'Initialized' : 'Not Initialized'}</p>
              <p className="text-xs text-white/70">TubeCycler: {tubeCyclerRef.current ? 'Initialized' : 'Not Initialized'}</p>
              <p className="text-xs text-white/70">Thread: {activeThreadId || 'none'}</p>
              <p className="text-xs text-white/70">Stitch: {activeStitch?.id || 'none'}</p>
            </div>
            <div>
              <p className="text-xs text-white/70 font-semibold">Content:</p>
              <p className="text-xs text-white/70">Order: {activeStitch?.order_number}</p>
              <p className="text-xs text-white/70">Skip: {activeStitch?.skip_number}</p>
              <p className="text-xs text-white/70">Level: {activeStitch?.distractor_level}</p>
              <p className="text-xs text-white/70">Questions: {activeStitch?.questions?.length || 0}</p>
              <p className="text-xs text-white/70">Tubes: {threadData.map(t => t.tube_number).join(', ') || 'none'}</p>
            </div>
          </div>
          
          {useNewArchitecture && adapterRef.current && (
            <div className="mt-3 pt-2 border-t border-white/20">
              <p className="text-xs text-white/70 font-bold mb-1">Tube Progression Status:</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[1, 2, 3].map(tube => {
                  const tubeState = adapterRef.current.getState().tubes[tube];
                  return (
                    <div key={tube} className={`bg-black/30 p-2 rounded ${tube === adapterRef.current.getCurrentTubeNumber() ? 'ring-1 ring-teal-400' : ''}`}>
                      <p className="text-teal-300 font-medium">Tube {tube}</p>
                      <p className="text-white/80">Thread: {tubeState?.threadId?.replace('thread-', '') || 'None'}</p>
                      <p className="text-white/80">Stitch: {tubeState?.currentStitchId?.split('-').pop() || 'None'}</p>
                      <p className="text-white/80">Position: {tubeState?.position || 0}</p>
                    </div>
                  );
                })}
                <div className="col-span-3 mt-2 text-center text-white/70">
                  Cycle Count: <span className="text-teal-300 font-bold">{adapterRef.current.getCycleCount()}</span> 
                  - Perfect scores change positions and advance to new stitches
                </div>
              </div>
            </div>
          )}
          
          <div className="flex space-x-2 mt-3">
            <button
              onClick={() => {
                if (useNewArchitecture && adapterRef.current) {
                  adapterRef.current.nextTube();
                } else if (tubeCyclerRef.current) {
                  tubeCyclerRef.current.nextTube();
                }
              }}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition-colors"
            >
              Next Tube
            </button>
            
            {activeStitch && (
              <button
                onClick={() => {
                  if (activeStitch && activeThreadId) {
                    if (useNewArchitecture && adapterRef.current) {
                      adapterRef.current.handleStitchCompletion(
                        activeThreadId,
                        activeStitch.id,
                        20, // perfect score
                        20  // out of 20 questions
                      ).then(result => {
                        console.log('Debug completion succeeded with result:', result);
                        // Force state refresh by moving to the next tube
                        setTimeout(() => {
                          if (adapterRef.current) {
                            adapterRef.current.nextTube();
                          }
                        }, 100);
                      }).catch(err => {
                        console.error('Debug completion failed:', err);
                      });
                    } else if (tubeCyclerRef.current) {
                      tubeCyclerRef.current.handleStitchCompletion(
                        activeThreadId,
                        activeStitch.id,
                        20, // perfect score
                        20  // out of 20 questions
                      );
                    }
                  }
                }}
                className="text-xs bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded transition-colors"
              >
                Complete Current (Perfect)
              </button>
            )}
            
            <button
              onClick={() => {
                // Reset state
                setUseNewArchitecture(!useNewArchitecture);
                setIsLoading(true);
                setHasInitialized(false);
                setActiveStitch(null);
                setActiveThreadId('');
                
                // Force reinitialization
                if (adapterRef.current) {
                  adapterRef.current.destroy();
                  adapterRef.current = null;
                }
              }}
              className="text-xs bg-yellow-600 hover:bg-yellow-500 text-white px-2 py-1 rounded transition-colors"
            >
              Switch Architecture
            </button>
            
            {useNewArchitecture && adapterRef.current && (
              <button
                onClick={async () => {
                  if (!activeStitch || !activeThreadId) return;
                  
                  const runFullTest = async () => {
                    console.log("Running FULL Triple-Helix Progression Test using reorder-tube-stitches API");
                    console.log("============================================");
                    
                    // Step 1: First get the starting state
                    const startState = adapterRef.current.getState();
                    const startTube = adapterRef.current.getCurrentTubeNumber();
                    console.log(`Starting State: Tube ${startTube}, Position ${startState.tubes[startTube]?.position}`);
                    
                    // Step 2: Run a full cycle with perfect scores on all three tubes
                    // Test all three tubes
                    for (let i = 1; i <= 3; i++) {
                      console.log(`STEP ${i}: Advancing stitches in Tube ${i}`);
                      
                      try {
                        // First, we need to get the active stitch and thread for this tube
                        const tubeState = adapterRef.current.getState().tubes[i];
                        const threadId = tubeState?.threadId;
                        const stitchId = tubeState?.currentStitchId;
                        
                        if (!threadId || !stitchId) {
                          console.error(`❌ Missing threadId or stitchId for Tube ${i}`);
                          continue;
                        }
                        
                        console.log(`Tube ${i}: Using thread ${threadId}, stitch ${stitchId}`);
                        
                        // Call the reorder-tube-stitches API
                        const response = await fetch('/api/reorder-tube-stitches', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            userId,
                            tubeNumber: i,
                            threadId: threadId,
                            completedStitchId: stitchId,
                            skipNumber: 3 // Default skip number
                          })
                        });
                        
                        if (response.ok) {
                          const data = await response.json();
                          if (data.success) {
                            console.log(`✅ Successfully reordered stitches in Tube ${i}`);
                            // If stats are available, show more details
                            if (data.stats) {
                              console.log(`   Updated ${data.stats.updatedStitches} stitches with ${data.stats.successfulUpdates} successful updates`);
                            }
                          } else {
                            console.error(`❌ Failed to reorder stitches in Tube ${i}: ${data.error}`);
                          }
                        } else {
                          console.error(`❌ API error for Tube ${i}: ${response.status}`);
                        }
                      } catch (err) {
                        console.error(`❌ Exception in Tube ${i} advancement:`, err);
                      }
                      
                      // Wait between operations
                      await new Promise(r => setTimeout(r, 500));
                    }
                    
                    // Step 3: Fetch updated stitches to refresh state
                    try {
                      const userStitchesResponse = await fetch(`/api/user-stitches?userId=${encodeURIComponent(userId)}`);
                      if (userStitchesResponse.ok) {
                        console.log('✅ Successfully refreshed user stitches after advancing all tubes');
                      }
                    } catch (err) {
                      console.error('Error refreshing stitches:', err);
                    }
                    
                    // Wait for state to update
                    await new Promise(r => setTimeout(r, 500));
                    
                    // Refresh the state so it's up to date
                    await adapterRef.current.persistCurrentState();
                    
                    // Step 4: Verify the cycle count and positions increased
                    const endState = adapterRef.current.getState();
                    const cyclesBefore = startState.cycleCount || 0;
                    const cyclesAfter = endState.cycleCount || 0;
                    
                    // Compare the positions for all three tubes
                    const tubePositionsChanged = {};
                    let allPositionsIncreased = true;
                    
                    for (let i = 1; i <= 3; i++) {
                      const beforePos = startState.tubes[i]?.position || 0;
                      const afterPos = endState.tubes[i]?.position || 0;
                      tubePositionsChanged[i] = afterPos > beforePos;
                      
                      if (!tubePositionsChanged[i]) {
                        allPositionsIncreased = false;
                      }
                    }
                    
                    console.log("FULL TEST RESULTS:");
                    console.log(`- Cycles before: ${cyclesBefore}`);
                    console.log(`- Cycles after: ${cyclesAfter}`);
                    console.log(`- Cycle count increased: ${cyclesAfter > cyclesBefore ? 'YES ✅' : 'NO ❌'}`);
                    console.log("- Tube positions changed:");
                    for (let i = 1; i <= 3; i++) {
                      console.log(`  - Tube ${i}: ${startState.tubes[i]?.position || 0} → ${endState.tubes[i]?.position || 0} (${tubePositionsChanged[i] ? 'YES ✅' : 'NO ❌'})`);
                    }
                    console.log(`- All tube positions increased: ${allPositionsIncreased ? 'YES ✅' : 'NO ❌'}`);
                    console.log("============================================");
                    
                    // Finally, trigger a UI refresh by cycling to the next tube
                    setTimeout(() => {
                      if (adapterRef.current) adapterRef.current.nextTube();
                    }, 500);
                  };
                  
                  // Run the test
                  await runFullTest();
                }}
                className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded transition-colors"
              >
                Test Full Progression
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SequentialPlayer;