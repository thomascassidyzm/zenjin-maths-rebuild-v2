/**
 * Tube Configuration Loader
 * 
 * This module handles loading a complete snapshot of the tube configuration 
 * along with active stitches for all user types.
 * 
 * The system implements an offline-first approach:
 * - Initial configuration is loaded from API or localStorage
 * - All state during gameplay is saved to localStorage
 * - Database updates only happen at explicit end of session
 */

/**
 * Load complete tube configuration including active stitches for all tubes
 * @param {Object} user - User object (null for anonymous)
 * @returns {Promise<Object>} Complete tube configuration
 */
export async function loadCompleteTubeConfiguration(user) {
  console.log(`Loading complete tube configuration for ${user ? 'authenticated' : 'anonymous'} user`);
  
  try {
    // Parameters for the API call
    const params = new URLSearchParams({
      prefetch: '3', // Get 3 stitches per thread (active stitches)
      fullConfig: 'true', // Request full configuration
      isAnonymous: user ? 'false' : 'true'
    });

    if (user?.id) {
      params.append('userId', user.id);
    }
    
    // Make API call to get complete configuration
    const response = await fetch(`/api/user-stitches?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load configuration: ${response.status} ${response.statusText}`);
    }
    
    const { data, tubePosition } = await response.json();
    
    if (!data || data.length === 0) {
      console.error("No thread data returned from API");
      throw new Error("No thread data available");
    }
    
    console.log(`API returned ${data.length} threads with tube position:`, tubePosition);
    
    // Format the data into a coherent tube configuration
    const config = formatTubeConfiguration(data, tubePosition);
    
    return config;
  } catch (error) {
    console.error("Error loading complete tube configuration:", error);
    
    // If API fails, try to load from localStorage as fallback
    if (user) {
      console.log("Trying to load from localStorage as fallback for authenticated user");
      const savedConfig = loadFromLocalStorage(user.id);
      if (savedConfig) {
        return savedConfig;
      }
    }
    
    throw error;
  }
}

/**
 * Format API response into a structured tube configuration
 * @param {Array} threadData - Thread data from API
 * @param {Object} tubePosition - Current tube position
 * @returns {Object} Formatted tube configuration
 */
function formatTubeConfiguration(threadData, tubePosition) {
  // Group threads by tube number
  const threadsByTube = {};
  
  // Extract tube number from thread ID and group
  for (const thread of threadData) {
    // Extract tube number from thread-T{tube_number}-{thread_order} format
    const match = thread.thread_id.match(/thread-T(\d+)-/);
    const tubeNumber = match ? parseInt(match[1], 10) : 1; // Default to tube 1
    
    if (!threadsByTube[tubeNumber]) {
      threadsByTube[tubeNumber] = [];
    }
    
    threadsByTube[tubeNumber].push(thread);
  }
  
  // Create tube configurations
  const tubes = [];
  
  // Process each tube
  for (const [tubeNum, threads] of Object.entries(threadsByTube)) {
    const tubeNumber = parseInt(tubeNum, 10);
    
    // Sort threads by thread order from thread ID: thread-T{tube_number}-{thread_order}
    threads.sort((a, b) => {
      // Extract thread order from thread ID
      const getThreadOrder = (threadId) => {
        const match = threadId.match(/thread-T\d+-(\d+)/);
        return match ? parseInt(match[1], 10) : 999; // Default to high number for non-matching
      };
      
      const orderA = getThreadOrder(a.thread_id);
      const orderB = getThreadOrder(b.thread_id);
      
      return orderA - orderB; // Sort numerically by thread order
    });
    
    // Determine active thread based on tube position
    let activeThreadId = null;
    if (tubePosition && tubePosition.tubeNumber === tubeNumber) {
      activeThreadId = tubePosition.threadId;
    }
    
    // Find the active thread or default to first thread
    let activeThread = threads.find(t => t.thread_id === activeThreadId);
    if (!activeThread) {
      activeThread = threads[0];
    }
    
    // Make sure activeThread.stitches exists
    if (!activeThread.stitches || !Array.isArray(activeThread.stitches)) {
      console.error(`No stitches found for thread ${activeThread.thread_id} in tube ${tubeNumber}`);
      activeThread.stitches = [];
    }
    
    // Get active stitches and sort by order_number
    let activeStitches = activeThread.stitches
      .filter(stitch => stitch.order_number < 3) // Get first 3 stitches
      .sort((a, b) => a.order_number - b.order_number);
    
    // Ensure we have at least one active stitch
    if (activeStitches.length === 0 && activeThread.stitches.length > 0) {
      // If no active stitches, use the first stitch
      activeStitches = [activeThread.stitches[0]];
      console.log(`Using first stitch for thread ${activeThread.thread_id}: ${activeStitches[0].id}`);
    } else if (activeStitches.length === 0) {
      // If still no active stitches (empty stitches array), log a warning
      console.warn(`No stitches available for thread ${activeThread.thread_id} in tube ${tubeNumber}`);
      activeStitches = [];
    }
    
    // Format active stitches
    const formattedActiveStitches = activeStitches.map(stitch => ({
      ...stitch,
      orderNumber: stitch.order_number,
      skipNumber: stitch.skip_number || 3,
      distractorLevel: stitch.distractor_level || 'L1'
    }));
    
    // Add tube to configuration
    tubes.push({
      number: tubeNumber,
      currentThread: activeThread.thread_id,
      currentStitchIndex: 0, // Start with first active stitch
      activeStitches: formattedActiveStitches,
      // Include the full thread list for this tube
      threads: threads.map(thread => ({
        id: thread.thread_id,
        orderMap: thread.orderMap || []
      }))
    });
  }
  
  // Sort tubes by number
  tubes.sort((a, b) => a.number - b.number);
  
  console.log(`Created configuration with ${tubes.length} tubes`);
  
  return { tubes };
}

/**
 * Preload additional stitches for a specific thread
 * @param {number} tubeNumber - Tube number
 * @param {string} threadId - Thread ID
 * @param {number} currentStitchIndex - Current stitch index
 * @param {number} count - Number of stitches to preload
 * @returns {Promise<Array>} - Preloaded stitches
 */
export async function preloadThreadStitches(tubeNumber, threadId, currentStitchIndex, count = 5) {
  console.log(`Preloading ${count} stitches for thread ${threadId} in tube ${tubeNumber}`);
  
  try {
    const params = new URLSearchParams({
      thread: threadId,
      prefetch: count.toString(),
      startAfter: currentStitchIndex.toString()
    });
    
    const response = await fetch(`/api/thread-stitches?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to preload stitches: ${response.status} ${response.statusText}`);
    }
    
    const { stitches } = await response.json();
    
    if (!stitches || stitches.length === 0) {
      console.log(`No additional stitches found for thread ${threadId}`);
      return [];
    }
    
    // Format the stitches to match expected structure
    const formattedStitches = stitches.map(stitch => ({
      ...stitch,
      orderNumber: stitch.order_number,
      skipNumber: stitch.skip_number || 3,
      distractorLevel: stitch.distractor_level || 'L1'
    }));
    
    console.log(`Preloaded ${formattedStitches.length} stitches for thread ${threadId}`);
    
    // After successfully loading from API, save to localStorage
    const config = loadFromLocalStorage() || { tubes: [] };
    updateConfigWithNewStitches(config, tubeNumber, threadId, formattedStitches);
    saveToLocalStorage(null, config);
    
    return formattedStitches;
  } catch (error) {
    console.error(`Error preloading stitches for thread ${threadId}:`, error);
    return [];
  }
}

/**
 * Update config with newly loaded stitches
 * @param {Object} config - Tube configuration
 * @param {number} tubeNumber - Tube number
 * @param {string} threadId - Thread ID
 * @param {Array} newStitches - Newly loaded stitches
 */
function updateConfigWithNewStitches(config, tubeNumber, threadId, newStitches) {
  // Find the tube
  const tube = config.tubes.find(t => t.number === tubeNumber);
  if (!tube) return;
  
  // Only update if this is the current thread
  if (tube.currentThread !== threadId) return;
  
  // Merge new stitches with existing ones
  const existingStitchIds = tube.activeStitches.map(s => s.id);
  
  // Add only stitches that don't already exist
  for (const stitch of newStitches) {
    if (!existingStitchIds.includes(stitch.id)) {
      tube.activeStitches.push(stitch);
    }
  }
  
  // Sort stitches by orderNumber
  tube.activeStitches.sort((a, b) => a.orderNumber - b.orderNumber);
}

/**
 * End session and save all progress to the database
 * @param {string} userId - User ID
 * @param {Object} config - Tube configuration
 * @returns {Promise<boolean>} - Success status
 */
export async function endSession(userId, config) {
  if (!userId || !config?.tubes) {
    return false;
  }
  
  console.log(`Ending session and saving all progress for user ${userId}`);
  
  try {
    // Prepare data for batch save
    const tubeUpdates = [];
    const stitchUpdates = [];
    
    // Extract updates from configuration
    for (const tube of config.tubes) {
      // Add tube position update
      tubeUpdates.push({
        userId,
        tubeNumber: tube.number,
        threadId: tube.currentThread
      });
      
      // Add stitch progress updates
      if (tube.activeStitches?.length > 0) {
        for (const stitch of tube.activeStitches) {
          stitchUpdates.push({
            userId,
            threadId: tube.currentThread,
            stitchId: stitch.id,
            orderNumber: stitch.orderNumber,
            skipNumber: stitch.skipNumber,
            distractorLevel: stitch.distractorLevel
          });
        }
      }
    }
    
    // Send batch update to API
    const response = await fetch('/api/end-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        tubeUpdates,
        stitchUpdates
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save session: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error("Error ending session:", error);
    // Always save to localStorage as backup
    saveToLocalStorage(userId, config);
    return false;
  }
}

/**
 * Save state to localStorage for ALL users (anonymous and authenticated)
 * @param {string|null} userId - User ID or null for anonymous
 * @param {Object} config - Tube configuration
 * @returns {boolean} - Success status
 */
export function saveToLocalStorage(userId, config) {
  if (!config?.tubes) {
    return false;
  }
  
  try {
    const storageKey = userId ? `zenjin_${userId}_state` : 'zenjin_anonymous_state';
    const state = {
      tubes: config.tubes,
      timestamp: Date.now(),
      userId
    };
    
    localStorage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Error saving state to localStorage:", error);
    return false;
  }
}

/**
 * Load state from localStorage
 * @param {string|null} userId - User ID or null for anonymous
 * @returns {Object|null} - Saved configuration or null
 */
export function loadFromLocalStorage(userId) {
  try {
    const storageKey = userId ? `zenjin_${userId}_state` : 'zenjin_anonymous_state';
    const savedState = localStorage.getItem(storageKey);
    
    if (!savedState) {
      return null;
    }
    
    const state = JSON.parse(savedState);
    
    // Check if state is too old (24 hours)
    const MAX_AGE = 24 * 60 * 60 * 1000;
    if (state.timestamp && Date.now() - state.timestamp > MAX_AGE) {
      localStorage.removeItem(storageKey);
      return null;
    }
    
    return state.tubes ? { tubes: state.tubes } : null;
  } catch (error) {
    console.error("Error loading state from localStorage:", error);
    return null;
  }
}

/**
 * Save anonymous user configuration to localStorage
 * @param {Object} config - Tube configuration
 * @returns {boolean} - Success status
 * @deprecated Use saveToLocalStorage instead
 */
export function saveAnonymousConfiguration(config) {
  return saveToLocalStorage(null, config);
}

/**
 * Load anonymous configuration from localStorage
 * @returns {Object|null} - Saved configuration or null
 * @deprecated Use loadFromLocalStorage instead
 */
export function loadAnonymousConfiguration() {
  return loadFromLocalStorage(null);
}