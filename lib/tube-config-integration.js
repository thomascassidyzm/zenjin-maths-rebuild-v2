/**
 * Tube Configuration Integration
 * 
 * This file provides integration with the Triple-Helix system and TubeCycler.
 * It adapts our new tube-config-loader to work with the existing architecture.
 * 
 * The system implements an offline-first approach:
 * - Initial configuration and content is bundled directly in the app
 * - No loading screens or waiting for API responses
 * - All state during gameplay is saved to localStorage
 * - Database updates only happen at explicit end of session
 */

import { 
  loadCompleteTubeConfiguration,
  preloadThreadStitches,
  saveToLocalStorage,
  loadFromLocalStorage,
  endSession as endSessionCore
} from './tube-config-loader';

// Import the offline-first content buffer
import { offlineFirstContentBuffer } from './client/offline-first-content-buffer';

/**
 * Initialize tube configuration for Triple-Helix system
 * @param {Object} user - User object (null for anonymous) 
 * @param {Function} handleSuccess - Success callback
 * @param {Function} handleError - Error callback
 */
export async function initializeTubeConfiguration(user, handleSuccess, handleError) {
  try {
    console.log(`Initializing tube configuration for ${user ? 'authenticated' : 'anonymous'} user`);
    
    // First try to load from localStorage for both user types
    const savedConfig = loadFromLocalStorage(user?.id);
    
    if (savedConfig) {
      console.log('Using saved configuration from localStorage');
      return handleSuccess(adaptConfigForTripleHelix(savedConfig));
    }
    
    // If no saved config, load from bundled content for anonymous/free users
    // or API for premium users
    try {
      // Load fresh configuration
      const config = await loadCompleteTubeConfiguration(user);
      
      // Adapt configuration for Triple-Helix system
      const adaptedConfig = adaptConfigForTripleHelix(config);
      
      // Call success callback with adapted configuration
      handleSuccess(adaptedConfig);
      
      // Save configuration to localStorage for all users
      saveToLocalStorage(user?.id, config);
    } catch (apiError) {
      console.error('Error loading from API, trying localStorage fallback:', apiError);
      
      // Final attempt: try localStorage even for authenticated users in case API fails
      const fallbackConfig = loadFromLocalStorage(user?.id);
      
      if (fallbackConfig) {
        console.log('Using fallback localStorage configuration due to API failure');
        return handleSuccess(adaptConfigForTripleHelix(fallbackConfig));
      }
      
      // If we get here, we couldn't load from API or localStorage
      throw apiError;
    }
  } catch (error) {
    console.error('Error initializing tube configuration:', error);
    
    if (handleError) {
      handleError(error);
    }
  }
}

/**
 * Initialize a new TubeCyclerAdapter with our configuration
 * @param {Object} user - User object (null for anonymous)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Initialized TubeCycler adapter
 */
export async function initializeTubeCycler(user, options = {}) {
  try {
    console.log(`Initializing TubeCycler for ${user ? 'authenticated' : 'anonymous'} user`);
    
    // Set the user tier on the offline-first content buffer
    const isAnonymousOrFree = !user || (user && !user.isPremium);
    offlineFirstContentBuffer.setUserTier(isAnonymousOrFree);
    
    // Load configuration from localStorage or API with proper fallbacks
    let config = null;
    
    // Try localStorage first for both user types
    config = loadFromLocalStorage(user?.id);
    
    if (config) {
      console.log(`Found saved state in localStorage for ${user ? 'authenticated' : 'anonymous'} user`);
    } else {
      try {
        // If no localStorage, try API
        console.log(`No localStorage state, loading from API for ${user ? 'authenticated' : 'anonymous'} user`);
        config = await loadCompleteTubeConfiguration(user);
        
        // Save immediately to localStorage as backup
        if (config) {
          saveToLocalStorage(user?.id, config);
        }
      } catch (apiError) {
        console.error('Error loading from API:', apiError);
        
        // For anonymous users, we could try to create a default config here
        if (!user) {
          console.log('Creating default configuration for anonymous user');
          config = createDefaultConfiguration();
        } else {
          // For authenticated users, we have to fail if both API and localStorage fail
          throw new Error('Failed to load tube configuration from API and no localStorage backup exists');
        }
      }
    }
    
    // If we still have no config, something went wrong
    if (!config) {
      throw new Error('Failed to load tube configuration');
    }
    
    // Validate that we have all three tubes with at least one stitch each
    if (config.tubes) {
      // Check for required tubes
      const hasTube1 = config.tubes.some(t => t.number === 1);
      const hasTube2 = config.tubes.some(t => t.number === 2);
      const hasTube3 = config.tubes.some(t => t.number === 3);
      
      console.log(`Configuration validation: Tube1=${hasTube1 ? 'exists' : 'missing'}, Tube2=${hasTube2 ? 'exists' : 'missing'}, Tube3=${hasTube3 ? 'exists' : 'missing'}`);
      
      // If any tube is missing, ensure it exists with at least a placeholder
      if (!hasTube1 || !hasTube2 || !hasTube3) {
        console.warn(`Missing tubes detected - adding placeholders to avoid sample content fallback`);
        
        // Add any missing tubes
        if (!hasTube1) {
          config.tubes.push({
            number: 1,
            currentThread: 'thread-T1-001',
            currentStitchIndex: 0,
            activeStitches: []
          });
        }
        
        if (!hasTube2) {
          config.tubes.push({
            number: 2,
            currentThread: 'thread-T2-001',
            currentStitchIndex: 0,
            activeStitches: []
          });
        }
        
        if (!hasTube3) {
          config.tubes.push({
            number: 3,
            currentThread: 'thread-T3-001',
            currentStitchIndex: 0,
            activeStitches: []
          });
        }
      }
    }
    
    // Convert to Triple-Helix format (for StateMachine)
    const tripleHelixConfig = adaptToStateMachineFormat(config);
    
    // Ensure all three tubes exist in the tripleHelixConfig
    ['1', '2', '3'].forEach(tubeNum => {
      if (!tripleHelixConfig.tubes[tubeNum]) {
        console.warn(`Adding missing tube ${tubeNum} to tripleHelixConfig`);
        
        tripleHelixConfig.tubes[tubeNum] = {
          threadId: `thread-T${tubeNum}-001`,
          currentStitchIndex: 0,
          stitches: []
        };
      }
    });
    
    // Create adapter instance with custom content manager
    const TubeCyclerAdapter = require('./triple-helix/adapters/TubeCyclerAdapter');
    const adapter = new TubeCyclerAdapter({
      userId: user?.id || 'anonymous',
      initialState: tripleHelixConfig,
      onStateChange: options.onStateChange,
      onTubeChange: options.onTubeChange,
      onContentLoad: options.onContentLoad,
      debug: options.debug || false,
      // Pass in our custom content manager that uses offlineFirstContentBuffer
      contentManager: createOfflineFirstContentManager()
    });
    
    // Set up auto-save for ALL users
    setupAutoSave(adapter, user?.id);
    
    // Start the content buffer monitoring and trigger an immediate check
    startContentBufferMonitoring(adapter);
    
    // CRITICAL FIX: Ensure all bundled stitches are loaded with proper positions
    // We use our unified loader utility for consistent position management
    setTimeout(() => {
      // Load all bundled stitches for each tube (10 per tube)
      console.log(`CRITICAL FIX: Loading bundled stitches into adapter state machine`);
      
      // Get access to the state machine
      const stateMachine = adapter._stateMachine;
      
      if (stateMachine) {
        // Use our utility to load all bundled stitches with correct positions
        const { loadBundledStitchesIntoStateMachine } = require('./load-bundled-stitches');
        loadBundledStitchesIntoStateMachine(stateMachine);
      } else {
        console.error(`CRITICAL ERROR: State machine not available in adapter`);
        
        // Fallback to preloading stitches directly into the adapter
        for (let tubeNumber = 1; tubeNumber <= 3; tubeNumber++) {
          // Get the thread ID for this tube
          const tube = adapter.getState().tubes[tubeNumber];
          const threadId = tube?.threadId || `thread-T${tubeNumber}-001`;
          
          // Load all bundled stitches for this tube
          console.log(`CRITICAL FIX: Preloading all stitches for tube ${tubeNumber} using adapter`);
          preloadStitchesIntoAdapter(adapter, tubeNumber, threadId, 0, 10);
        }
      }
      
      // Run the regular content buffer monitoring
      monitorContentBuffer(adapter, 5, 10);
    }, 500);
    
    return adapter;
  } catch (error) {
    console.error('Error initializing TubeCycler:', error);
    throw error;
  }
}

/**
 * Create a content manager that uses our offline-first content buffer
 */
function createOfflineFirstContentManager() {
  return {
    // Cache is managed by the offlineFirstContentBuffer
    cache: {},
    
    // Use the offline-first buffer to get content
    async getContent(stitchId) {
      try {
        console.log(`ContentManager: Getting content for stitch ${stitchId}`);
        const stitch = await offlineFirstContentBuffer.getStitch(stitchId);
        
        if (stitch) {
          console.log(`ContentManager: Retrieved stitch ${stitchId} with ${stitch.questions?.length || 0} questions`);
          return stitch;
        } else {
          console.error(`ContentManager: Failed to retrieve stitch ${stitchId} - not found in buffer`);
          // Create emergency fallback stitch to avoid blank screen
          return this.createEmergencyFallbackStitch(stitchId);
        }
      } catch (error) {
        console.error(`ContentManager: Error getting stitch ${stitchId}:`, error);
        // Create emergency fallback stitch to avoid blank screen
        return this.createEmergencyFallbackStitch(stitchId);
      }
    },
    
    // Add to cache - stores in the offline-first buffer cache
    addToCache(stitches) {
      if (!stitches || stitches.length === 0) return;
      
      // Log what we're adding to cache
      console.log(`ContentManager: Adding ${stitches.length} stitches to cache`);
      
      // For each stitch, make sure it's cached in the offlineFirstContentBuffer
      stitches.forEach(stitch => {
        if (stitch && stitch.id) {
          console.log(`ContentManager: Adding stitch ${stitch.id} to buffer cache`);
          // Use the buffer's getStitch method to cache the stitch
          offlineFirstContentBuffer.getStitch(stitch.id);
        }
      });
    },
    
    // Clear cache passes through to the offline-first buffer
    clearCache() {
      offlineFirstContentBuffer.clearCache();
    },
    
    // Create an emergency fallback stitch when content is missing
    createEmergencyFallbackStitch(stitchId) {
      console.warn(`ContentManager: Creating emergency fallback stitch for ${stitchId}`);
      
      // Extract thread and tube info from stitch ID
      const match = stitchId.match(/stitch-T(\d+)-(\d+)-(\d+)/);
      const tubeNumber = match ? match[1] : '1';
      const threadNumber = match ? match[2] : '001';
      const stitchNumber = match ? match[3] : '01';
      
      // Create fallback questions - simple addition regardless of tube
      const questions = [];
      for (let i = 1; i <= 20; i++) {
        const a = Math.floor(Math.random() * 5) + 1;
        const b = Math.floor(Math.random() * 5) + 1;
        
        questions.push({
          id: `${stitchId}-fallback-q${i.toString().padStart(2, '0')}`,
          text: `What is ${a} + ${b}?`,
          correctAnswer: `${a + b}`,
          distractors: {
            L1: `${a + b + 1}`,
            L2: `${a + b - 1}`,
            L3: `${a * b}`
          }
        });
      }
      
      return {
        id: stitchId,
        threadId: `thread-T${tubeNumber}-${threadNumber}`,
        title: `Emergency Content for Tube ${tubeNumber}`,
        content: `Content for Tube ${tubeNumber}, Thread ${threadNumber}, Stitch ${stitchNumber}`,
        order: parseInt(stitchNumber, 10),
        questions: questions
      };
    }
  };
}

/**
 * Create default configuration for anonymous users when API fails
 * @returns {Object} Default configuration
 */
function createDefaultConfiguration() {
  // This is a fallback for anonymous users when everything else fails
  return {
    tubes: [
      {
        number: 1,
        currentThread: 'thread-T1-001',
        currentStitchIndex: 0,
        activeStitches: []
      },
      {
        number: 2,
        currentThread: 'thread-T2-001',
        currentStitchIndex: 0,
        activeStitches: []
      },
      {
        number: 3,
        currentThread: 'thread-T3-001',
        currentStitchIndex: 0,
        activeStitches: []
      }
    ]
  };
}

/**
 * Adapt our tube configuration format to work with Triple-Helix
 * @param {Object} config - Tube configuration from tube-config-loader
 * @returns {Object} - Configuration in Triple-Helix format
 */
function adaptConfigForTripleHelix(config) {
  if (!config || !config.tubes || config.tubes.length === 0) {
    throw new Error('Invalid tube configuration');
  }
  
  // Convert to Triple-Helix format
  const tripleHelixConfig = {
    tubes: {},
    activeTubeNumber: 1 // Default to tube 1
  };
  
  // Process each tube
  config.tubes.forEach(tube => {
    const tubeNumber = tube.number;
    
    // Find active stitch (the one with order_number = 0)
    const activeStitch = tube.activeStitches.find(stitch => 
      stitch.orderNumber === 0 || stitch.order_number === 0
    ) || tube.activeStitches[0];
    
    // Format stitches for Triple-Helix
    const stitches = tube.activeStitches.map(stitch => ({
      id: stitch.id,
      threadId: tube.currentThread,
      tubeNumber,
      content: stitch.content,
      title: stitch.title,
      position: stitch.orderNumber || stitch.order_number || 0,
      skipNumber: stitch.skipNumber || stitch.skip_number || 3,
      distractorLevel: stitch.distractorLevel || stitch.distractor_level || 'L1',
      questions: formatQuestions(stitch.questions || [])
    }));
    
    // Sort stitches by position
    stitches.sort((a, b) => a.position - b.position);
    
    // Create tube entry
    tripleHelixConfig.tubes[tubeNumber] = {
      stitches,
      currentStitchId: activeStitch?.id,
      threadId: tube.currentThread,
      tubeNumber
    };
  });
  
  return tripleHelixConfig;
}

/**
 * Adapt our configuration to StateMachine format
 * @param {Object} config - Tube configuration from tube-config-loader
 * @returns {Object} - Configuration in StateMachine format
 */
function adaptToStateMachineFormat(config) {
  // The StateMachine requires a slightly different format than the UI
  const stateMachineState = {
    currentTube: 1, // Default to tube 1
    cycleCount: 0,  // Start at cycle 0
    tubes: {}
  };
  
  // Process each tube
  for (const tube of config.tubes) {
    // Extract tube number
    const tubeNumber = tube.number;
    
    // Find the current/active thread for this tube
    const currentThread = tube.currentThread;
    
    // Set up tube state
    stateMachineState.tubes[tubeNumber] = {
      threadId: currentThread,
      currentStitchIndex: tube.currentStitchIndex || 0,
      stitches: []
    };
    
    // Add active stitches
    if (tube.activeStitches && tube.activeStitches.length > 0) {
      stateMachineState.tubes[tubeNumber].stitches = tube.activeStitches.map((stitch, index) => ({
        id: stitch.id,
        threadId: currentThread,
        content: stitch.content || '',
        position: stitch.orderNumber || stitch.order_number || index,
        skipNumber: stitch.skipNumber || stitch.skip_number || 3,
        distractorLevel: stitch.distractorLevel || stitch.distractor_level || 'L1',
        questions: formatQuestions(stitch.questions || [])
      }));
    }
    
    // If this is tube 1, set it as the current tube
    if (tubeNumber === 1) {
      stateMachineState.currentTube = 1;
    }
  }
  
  return stateMachineState;
}

/**
 * Format questions in the expected structure
 * @param {Array} questions - Raw questions data
 * @returns {Array} - Formatted questions
 */
function formatQuestions(questions) {
  return questions.map(question => {
    // If question has correct_answer, adapt to correctAnswer
    if (question.correct_answer && !question.correctAnswer) {
      question.correctAnswer = question.correct_answer;
    }
    
    // Ensure distractors are in the expected format (L1, L2, L3 structure)
    if (question.distractors && typeof question.distractors === 'object') {
      // If distractors is an array, convert to object
      if (Array.isArray(question.distractors)) {
        const distractorsArray = question.distractors;
        question.distractors = {
          L1: distractorsArray[0] || '',
          L2: distractorsArray[1] || '',
          L3: distractorsArray[2] || ''
        };
      } 
      // If distractors is missing L1,L2,L3 structure
      else if (!question.distractors.L1) {
        // Try to extract values assuming it's a JSON object
        const values = Object.values(question.distractors).filter(v => v);
        question.distractors = {
          L1: values[0] || '',
          L2: values[1] || '',
          L3: values[2] || ''
        };
      }
    } else {
      // No distractors or invalid format, create empty structure
      question.distractors = { L1: '', L2: '', L3: '' };
    }
    
    return question;
  });
}

/**
 * Set up auto-save for all users (anonymous and authenticated)
 * @param {Object} adapter - TubeCyclerAdapter instance
 * @param {string|null} userId - User ID or null for anonymous
 */
function setupAutoSave(adapter, userId) {
  // Save state every 30 seconds
  const SAVE_INTERVAL = 30 * 1000;
  
  const intervalId = setInterval(() => {
    try {
      // Get current state from adapter
      const state = adapter.getState();
      
      // Convert to our format
      const config = adaptFromStateMachine(state);
      
      // Save to localStorage only (database save is only on endSession)
      saveToLocalStorage(userId, config);
    } catch (error) {
      console.error('Error auto-saving state:', error);
    }
  }, SAVE_INTERVAL);
  
  // Clean up interval on adapter destroy
  const originalDestroy = adapter.destroy;
  adapter.destroy = function() {
    clearInterval(intervalId);
    
    // Save one last time
    try {
      const state = adapter.getState();
      const config = adaptFromStateMachine(state);
      saveToLocalStorage(userId, config);
    } catch (error) {
      console.error('Error saving state during destroy:', error);
    }
    
    // Call original destroy
    if (originalDestroy && typeof originalDestroy === 'function') {
      originalDestroy.call(adapter);
    }
  };
  
  // Handle window unload to save final state
  const handleUnload = () => {
    try {
      const state = adapter.getState();
      const config = adaptFromStateMachine(state);
      saveToLocalStorage(userId, config);
    } catch (error) {
      console.error('Error saving state on unload:', error);
    }
  };
  
  window.addEventListener('beforeunload', handleUnload);
  
  // Keep reference to the event listener for cleanup
  adapter._unloadHandler = handleUnload;
  
  // Override destroy to also remove event listener
  const parentDestroy = adapter.destroy;
  adapter.destroy = function() {
    window.removeEventListener('beforeunload', handleUnload);
    if (parentDestroy && typeof parentDestroy === 'function') {
      parentDestroy.call(adapter);
    }
  };
}

/**
 * Start monitoring content buffer to ensure we always have 10+ stitches
 * @param {Object} adapter - TubeCyclerAdapter instance
 */
function startContentBufferMonitoring(adapter) {
  // Monitor content buffer every 30 seconds
  const MONITOR_INTERVAL = 30 * 1000;
  
  const intervalId = setInterval(() => {
    monitorContentBuffer(adapter);
  }, MONITOR_INTERVAL);
  
  // Clean up interval on adapter destroy
  const originalDestroy = adapter.destroy;
  adapter.destroy = function() {
    clearInterval(intervalId);
    
    // Call original destroy
    if (originalDestroy && typeof originalDestroy === 'function') {
      originalDestroy.call(adapter);
    }
  };
}

/**
 * Monitor the content buffer and load more stitches if needed
 * @param {Object} adapter - TubeCyclerAdapter instance
 * @param {number} minBuffer - Minimum stitches to maintain after current position
 * @param {number} desiredBuffer - Desired number of stitches to load
 */
export function monitorContentBuffer(adapter, minBuffer = 5, desiredBuffer = 10) {
  if (!adapter || !adapter.getState) return;
  
  try {
    const state = adapter.getState();
    
    // Make sure all three tubes exist
    const tubeNumbers = [1, 2, 3];
    
    for (const tubeNumber of tubeNumbers) {
      const tube = state.tubes[tubeNumber];
      
      // If tube doesn't exist, that's a critical issue
      if (!tube) {
        console.error(`Critical: Tube ${tubeNumber} is missing from state - this should never happen`);
        continue;
      }
      
      const currentIndex = tube.currentStitchIndex || 0;
      const stitchCount = tube.stitches?.length || 0;
      
      // First, log the current buffer status
      console.log(`Tube ${tubeNumber} buffer status: ${stitchCount} stitches, current index ${currentIndex}, buffer: ${stitchCount - currentIndex}`);
      
      // IMPORTANT: Make sure the current stitch has content loaded
      if (stitchCount > 0 && currentIndex < stitchCount) {
        const currentStitch = tube.stitches[currentIndex];
        
        // Verify the current stitch has content and questions
        if (currentStitch && currentStitch.id) {
          console.log(`Checking content for current stitch ${currentStitch.id}`);
          
          // Force-preload the current stitch content to ensure it's ready
          adapter.contentManager.getContent(currentStitch.id)
            .then(stitch => {
              if (stitch) {
                console.log(`Confirmed stitch ${currentStitch.id} is loaded with ${stitch.questions?.length || 0} questions`);
              } else {
                console.warn(`Failed to verify content for stitch ${currentStitch.id}`);
              }
            })
            .catch(error => {
              console.error(`Error verifying stitch ${currentStitch.id}:`, error);
            });
        }
      }
      
      // If buffer is running low, load more stitches
      if (stitchCount - currentIndex <= minBuffer) {
        console.log(`Buffer running low for tube ${tubeNumber}, loading more stitches`);
        
        // Calculate how many stitches to load
        const loadCount = Math.max(5, desiredBuffer - (stitchCount - currentIndex));
        
        // Trigger loading of additional stitches
        preloadStitchesIntoAdapter(
          adapter,
          tubeNumber,
          tube.threadId,
          stitchCount,
          loadCount
        );
      }
      
      // If tube has no stitches at all, that's a critical issue
      if (stitchCount === 0) {
        console.error(`Critical: Tube ${tubeNumber} has no stitches - trying to load initial stitches`);
        
        // Emergency load for this tube
        preloadStitchesIntoAdapter(
          adapter,
          tubeNumber,
          tube.threadId || `thread-T${tubeNumber}-001`, // Try default thread ID if none exists
          0,
          desiredBuffer
        );
      }
      
      // Prefetch the next stitch in this tube, even if buffer is not low
      if (currentIndex + 1 < stitchCount) {
        const nextStitch = tube.stitches[currentIndex + 1];
        if (nextStitch && nextStitch.id) {
          console.log(`Prefetching next stitch ${nextStitch.id} in tube ${tubeNumber}`);
          
          // Force-load the next stitch content to ensure it's available
          adapter.contentManager.getContent(nextStitch.id)
            .then(stitch => {
              console.log(`Successfully prefetched next stitch ${nextStitch.id} with ${stitch?.questions?.length || 0} questions`);
            })
            .catch(error => {
              console.warn(`Error prefetching next stitch ${nextStitch.id}:`, error);
            });
        }
      }
    }
    
    // Final check: make sure the active tube has the current stitch available
    const activeTubeNumber = state.currentTube;
    const activeTube = state.tubes[activeTubeNumber];
    
    if (activeTube) {
      const currentIndex = activeTube.currentStitchIndex || 0;
      if (activeTube.stitches && activeTube.stitches.length > currentIndex) {
        const activeStitch = activeTube.stitches[currentIndex];
        
        if (activeStitch && activeStitch.id) {
          console.log(`Ensuring active stitch ${activeStitch.id} content is loaded`);
          
          // Force immediate load of the active stitch
          adapter.contentManager.getContent(activeStitch.id)
            .then(stitch => {
              console.log(`Verified active stitch ${activeStitch.id} has ${stitch?.questions?.length || 0} questions`);
            })
            .catch(error => {
              console.error(`Error verifying active stitch ${activeStitch.id}:`, error);
            });
        }
      }
    }
    
    // Final check: make sure each tube has at least one active stitch with questions
    for (const tubeNumber of tubeNumbers) {
      const tube = state.tubes[tubeNumber];
      
      // Verify there's at least one stitch with questions
      if (tube?.stitches?.length > 0) {
        const hasQuestions = tube.stitches.some(s => 
          s.questions && Array.isArray(s.questions) && s.questions.length > 0
        );
        
        if (!hasQuestions) {
          console.warn(`Tube ${tubeNumber} has stitches but no questions - preloading may be incomplete`);
          
          // Attempt to load questions for the current stitch
          if (tube.stitches.length > 0) {
            const firstStitch = tube.stitches[0];
            console.log(`Attempting to load questions for stitch ${firstStitch.id} in tube ${tubeNumber}`);
            
            // Force-load the stitch content to ensure it has questions
            adapter.contentManager.getContent(firstStitch.id)
              .then(stitch => {
                console.log(`Loaded stitch ${firstStitch.id} with ${stitch?.questions?.length || 0} questions`);
              })
              .catch(error => {
                console.error(`Error loading stitch ${firstStitch.id}:`, error);
              });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error monitoring content buffer:', error);
  }
}

/**
 * Adapt from Triple-Helix format to our configuration format
 * @param {Object} tripleHelixConfig - Configuration in Triple-Helix format
 * @returns {Object} - Our tube configuration format
 */
function adaptFromTripleHelix(tripleHelixConfig) {
  if (!tripleHelixConfig || !tripleHelixConfig.tubes) {
    throw new Error('Invalid Triple-Helix configuration');
  }
  
  const tubes = [];
  
  // Process each tube
  Object.entries(tripleHelixConfig.tubes).forEach(([tubeNumber, tube]) => {
    const number = parseInt(tubeNumber, 10);
    
    // Format stitches
    const activeStitches = (tube.stitches || []).map(stitch => ({
      ...stitch,
      orderNumber: stitch.position,
      skipNumber: stitch.skipNumber,
      distractorLevel: stitch.distractorLevel
    }));
    
    // Sort by position
    activeStitches.sort((a, b) => a.position - b.position);
    
    tubes.push({
      number,
      currentThread: tube.threadId,
      currentStitchIndex: tube.currentStitchIndex || 0,
      activeStitches
    });
  });
  
  // Sort tubes by number
  tubes.sort((a, b) => a.number - b.number);
  
  return { tubes };
}

/**
 * Adapt from StateMachine format to our configuration format
 * @param {Object} stateMachineState - State from StateMachine
 * @returns {Object} - Our tube configuration format
 */
function adaptFromStateMachine(stateMachineState) {
  if (!stateMachineState || !stateMachineState.tubes) {
    throw new Error('Invalid StateMachine state');
  }
  
  const tubes = [];
  
  // Process each tube
  for (const [tubNum, tube] of Object.entries(stateMachineState.tubes)) {
    const tubeNumber = parseInt(tubNum, 10);
    
    // Skip tubes without a thread ID
    if (!tube.threadId) continue;
    
    // Format stitches
    const activeStitches = (tube.stitches || []).map(stitch => ({
      id: stitch.id,
      thread_id: tube.threadId,
      content: stitch.content || '',
      order_number: stitch.position,
      orderNumber: stitch.position,
      skip_number: stitch.skipNumber || 3,
      skipNumber: stitch.skipNumber || 3,
      distractor_level: stitch.distractorLevel || 'L1',
      distractorLevel: stitch.distractorLevel || 'L1',
      questions: stitch.questions || []
    }));
    
    tubes.push({
      number: tubeNumber,
      currentThread: tube.threadId,
      currentStitchIndex: tube.currentStitchIndex || 0,
      activeStitches
    });
  }
  
  // Sort tubes by number
  tubes.sort((a, b) => a.number - b.number);
  
  return { tubes };
}

/**
 * Preload stitches for a specific thread
 * @param {number} tubeNumber - Tube number
 * @param {string} threadId - Thread ID
 * @param {number} currentIndex - Current index
 * @param {number} count - Number of stitches to load
 * @returns {Promise<Array>} - Loaded stitches in Triple-Helix format
 */
export async function preloadStitches(tubeNumber, threadId, currentIndex, count = 5) {
  try {
    // Load stitches using the tube-config-loader
    const stitches = await preloadThreadStitches(tubeNumber, threadId, currentIndex, count);
    
    // Format stitches for Triple-Helix
    return stitches.map(stitch => ({
      id: stitch.id,
      threadId,
      tubeNumber,
      content: stitch.content,
      title: stitch.title,
      position: stitch.orderNumber,
      skipNumber: stitch.skipNumber,
      distractorLevel: stitch.distractorLevel,
      questions: formatQuestions(stitch.questions || [])
    }));
  } catch (error) {
    console.error(`Error preloading stitches for thread ${threadId}:`, error);
    return [];
  }
}

/**
 * Preload stitches directly into a TubeCycler adapter's cache
 * @param {Object} adapter - TubeCyclerAdapter instance
 * @param {number} tubeNumber - Tube number
 * @param {string} threadId - Thread ID
 * @param {number} currentIndex - Current index
 * @param {number} count - Number of stitches to load
 * @returns {Promise<boolean>} - Success status
 */
export async function preloadStitchesIntoAdapter(adapter, tubeNumber, threadId, currentIndex, count = 5) {
  try {
    // Check if adapter has contentManager
    if (!adapter || !adapter.contentManager) {
      console.error('Invalid adapter or missing contentManager');
      return false;
    }
    
    // Load and format stitches - using offlineFirstContentBuffer internally
    const stitches = await preloadStitches(tubeNumber, threadId, currentIndex, count);
    
    if (!stitches || stitches.length === 0) {
      return false;
    }
    
    // Add to adapter's cache
    adapter.contentManager.addToCache(stitches);
    
    // Also save to localStorage
    try {
      const state = adapter.getState();
      const config = adaptFromStateMachine(state);
      saveToLocalStorage(state.userId, config);
    } catch (saveError) {
      console.error('Error saving after preload:', saveError);
    }
    
    return true;
  } catch (error) {
    console.error(`Error preloading stitches into adapter for thread ${threadId}:`, error);
    return false;
  }
}

/**
 * End the session and save all progress to the database
 * @param {Object} user - User object (contains user.id)
 * @param {Object} adapter - TubeCyclerAdapter instance
 * @returns {Promise<boolean>} - Success status
 */
export async function endSession(user, adapter) {
  if (!adapter) return false;
  
  try {
    // Get current state from adapter
    const state = adapter.getState();
    
    // Convert to our format
    const config = adaptFromStateMachine(state);
    
    // First save to localStorage as backup
    saveToLocalStorage(user?.id, config);
    
    // If user is authenticated, save to database
    if (user?.id) {
      return await endSessionCore(user.id, config);
    }
    
    return true; // Return true for anonymous users
  } catch (error) {
    console.error('Error ending session:', error);
    return false;
  }
}

/**
 * Create a stitch completion handler that follows the Triple-Helix sequence
 * @param {Object} adapter - TubeCyclerAdapter instance
 * @param {Function} updateUI - Function to update UI after completion
 * @returns {Function} - Stitch completion handler
 */
export function createStitchCompletionHandler(adapter, updateUI) {
  return (threadId, stitchId, score, totalQuestions) => {
    if (!adapter) return;
    
    // Step 1: Cycle to the next tube first (happens immediately)
    adapter.nextTube();
    
    // Step 2: Process the stitch completion after a short delay
    setTimeout(() => {
      adapter.handleStitchCompletion(
        threadId,
        stitchId,
        score,
        totalQuestions
      );
      
      // After completion, save to localStorage but not database
      try {
        const state = adapter.getState();
        const config = adaptFromStateMachine(state);
        saveToLocalStorage(state.userId, config);
        
        // Monitor content buffer after stitch completion
        monitorContentBuffer(adapter);
        
        // Get the current tube and preload the active stitch content
        const currentTube = state.currentTube;
        const tubeState = state.tubes[currentTube];
        if (tubeState && tubeState.stitches && tubeState.stitches.length > 0) {
          // Ensure the current stitch content is preloaded
          const currentStitchIndex = tubeState.currentStitchIndex || 0;
          if (currentStitchIndex < tubeState.stitches.length) {
            const currentStitchId = tubeState.stitches[currentStitchIndex].id;
            console.log(`Pre-loading content for next stitch: ${currentStitchId}`);
            
            // Force-load the stitch content to ensure it's available
            adapter.contentManager.getContent(currentStitchId)
              .then(stitch => {
                console.log(`Successfully preloaded stitch ${currentStitchId} with ${stitch?.questions?.length || 0} questions`);
              })
              .catch(error => {
                console.error(`Error preloading stitch ${currentStitchId}:`, error);
              });
          }
        }
      } catch (saveError) {
        console.error('Error saving after stitch completion:', saveError);
      }
      
      // Step 3: Update UI if callback provided
      if (typeof updateUI === 'function') {
        // Delay the UI update slightly to ensure content is loaded
        setTimeout(() => {
          updateUI(adapter);
        }, 100);
      }
    }, 500); // 500ms delay as recommended in integration guide
  };
}