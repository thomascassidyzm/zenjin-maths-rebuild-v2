/**
 * Tube Configuration Management
 * 
 * Handles loading, saving, and maintaining tube configurations for different user types:
 * 1. Anonymous - Always uses default config, no persistence
 * 2. New Users - Starts with default config, saves to database
 * 3. Returning Users - Loads saved state from database
 */

import { createClient } from '@supabase/supabase-js';
import { generateAnonymousId, getAnonymousThreadData } from './anonymous-session';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Constants
const INITIAL_STITCH_COUNT = 3; // Initial number of active stitches
const LAZY_LOAD_BATCH_SIZE = 5; // Number of stitches to lazy load at a time

/**
 * Load the appropriate tube configuration based on user type
 * @param {Object} user - The current user object from Supabase Auth
 * @returns {Promise<Object>} - The tube configuration
 */
export async function loadTubeConfiguration(user) {
  // Case 1: Anonymous User
  if (!user) {
    console.log("Loading default tube configuration for anonymous user");
    return await loadDefaultTubeConfiguration();
  }
  
  console.log(`Loading tube configuration for user ${user.id}`);
  
  // For authenticated users, check if they have existing progress
  const { data: existingProgress } = await supabase
    .from('user_stitch_progress')
    .select('*')
    .eq('user_id', user.id)
    .limit(1);
  
  // Case 2: New User (no existing progress)
  if (!existingProgress || existingProgress.length === 0) {
    console.log("New user detected - initializing progress records");
    
    // Initialize the user with database records
    await initializeUserProgress(user.id);
    return await loadDefaultTubeConfiguration();
  }
  
  // Case 3: Returning User
  console.log("Returning user detected - loading saved state");
  return await loadSavedTubeConfiguration(user.id);
}

/**
 * Load the default initial tube configuration
 * @returns {Promise<Object>} - The default tube configuration
 */
export async function loadDefaultTubeConfiguration() {
  console.log("Loading default tube configuration");
  
  try {
    // Fetch default configuration from user-stitches API with prefetch=5
    const response = await fetch('/api/user-stitches?prefetch=5', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error("Error loading default tube configuration:", await response.text());
      return { tubes: [] };
    }
    
    const { data, tubePosition } = await response.json();
    
    if (!data || data.length === 0) {
      console.error("No thread data returned from API");
      return { tubes: [] };
    }
    
    console.log(`API returned ${data.length} threads`);
    
    // Process data to create a coherent tube configuration
    const tubes = [];
    
    // Group threads by tube number
    const threadsByTube = {};
    
    // Extract tube number from thread ID
    for (const thread of data) {
      // Extract tube number using the thread-T{tube_number}-{thread_order} format
      const match = thread.thread_id.match(/thread-T(\d+)-/);
      const tubeNumber = match ? parseInt(match[1], 10) : 1; // Default to tube 1 if no match
      
      if (!threadsByTube[tubeNumber]) {
        threadsByTube[tubeNumber] = [];
      }
      
      threadsByTube[tubeNumber].push(thread);
    }
    
    // Create tube configurations
    for (const [tubeNumber, threads] of Object.entries(threadsByTube)) {
      // Sort threads by ID to ensure correct order
      threads.sort((a, b) => a.thread_id.localeCompare(b.thread_id));
      
      const currentThread = threads[0]; // Start with the first thread in each tube
      
      // Get active stitches (those with order_number = 0, 1, 2)
      const activeStitches = currentThread.stitches
        .filter(stitch => stitch.order_number < INITIAL_STITCH_COUNT)
        .sort((a, b) => a.order_number - b.order_number);
      
      tubes.push({
        number: parseInt(tubeNumber, 10),
        currentThread: currentThread.thread_id,
        currentStitchIndex: 0,
        activeStitches: activeStitches.map(stitch => ({
          ...stitch,
          orderNumber: stitch.order_number,
          skipNumber: stitch.skip_number || 3,
          distractorLevel: stitch.distractor_level || 'L1'
        }))
      });
    }
    
    console.log(`Created configuration with ${tubes.length} tubes`);
    
    // If a specific tube position was returned, prioritize it
    if (tubePosition) {
      console.log(`Using saved tube position: Tube-${tubePosition.tubeNumber}, Thread-${tubePosition.threadId}`);
      
      // Find the tube that matches this position
      const tubeIndex = tubes.findIndex(tube => tube.number === tubePosition.tubeNumber);
      
      if (tubeIndex !== -1) {
        // Update the tube to use the saved thread
        tubes[tubeIndex].currentThread = tubePosition.threadId;
        
        // Find stitches for this thread from the data
        const threadData = data.find(t => t.thread_id === tubePosition.threadId);
        
        if (threadData) {
          // Get active stitches (those with order_number = 0, 1, 2)
          const activeStitches = threadData.stitches
            .filter(stitch => stitch.order_number < INITIAL_STITCH_COUNT)
            .sort((a, b) => a.order_number - b.order_number);
          
          tubes[tubeIndex].activeStitches = activeStitches.map(stitch => ({
            ...stitch,
            orderNumber: stitch.order_number,
            skipNumber: stitch.skip_number || 3,
            distractorLevel: stitch.distractor_level || 'L1'
          }));
        }
      }
    }
    
    return { tubes };
  } catch (error) {
    console.error("Error loading default tube configuration:", error);
    return { tubes: [] };
  }
}

/**
 * Load a saved tube configuration for a returning user
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - The saved tube configuration
 */
export async function loadSavedTubeConfiguration(userId) {
  console.log(`Loading saved tube configuration for user ${userId}`);
  
  try {
    // Fetch user's saved configuration from API
    const response = await fetch(`/api/user-stitches?userId=${userId}&prefetch=5`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error("Error loading saved tube configuration:", await response.text());
      return await loadDefaultTubeConfiguration();
    }
    
    const { data, tubePosition } = await response.json();
    
    if (!data || data.length === 0) {
      console.warn("No saved thread data found - falling back to default");
      return await loadDefaultTubeConfiguration();
    }
    
    console.log(`API returned ${data.length} threads with saved state`);
    
    // Process data to create a coherent tube configuration
    // (similar to default configuration but using saved progress)
    const tubes = [];
    
    // Group threads by tube number
    const threadsByTube = {};
    
    // Extract tube number from thread ID
    for (const thread of data) {
      // Extract tube number using the thread-T{tube_number}-{thread_order} format
      const match = thread.thread_id.match(/thread-T(\d+)-/);
      const tubeNumber = match ? parseInt(match[1], 10) : 1; // Default to tube 1 if no match
      
      if (!threadsByTube[tubeNumber]) {
        threadsByTube[tubeNumber] = [];
      }
      
      threadsByTube[tubeNumber].push(thread);
    }
    
    // Create tube configurations
    for (const [tubeNumber, threads] of Object.entries(threadsByTube)) {
      // Get the active thread from tube position, or use first thread if not specified
      let activeThreadId = null;
      
      if (tubePosition && tubePosition.tubeNumber === parseInt(tubeNumber, 10)) {
        activeThreadId = tubePosition.threadId;
      }
      
      // Find the active thread or default to first thread
      let activeThread = threads.find(t => t.thread_id === activeThreadId);
      
      if (!activeThread) {
        // Sort threads by ID and use the first one
        threads.sort((a, b) => a.thread_id.localeCompare(b.thread_id));
        activeThread = threads[0];
      }
      
      // Get active stitches (those with order_number = 0, 1, 2)
      const activeStitches = activeThread.stitches
        .filter(stitch => stitch.order_number < INITIAL_STITCH_COUNT)
        .sort((a, b) => a.order_number - b.order_number);
      
      tubes.push({
        number: parseInt(tubeNumber, 10),
        currentThread: activeThread.thread_id,
        currentStitchIndex: 0,
        activeStitches: activeStitches.map(stitch => ({
          ...stitch,
          orderNumber: stitch.order_number,
          skipNumber: stitch.skip_number || 3,
          distractorLevel: stitch.distractor_level || 'L1'
        }))
      });
    }
    
    console.log(`Created configuration with ${tubes.length} tubes from saved state`);
    
    return { tubes };
  } catch (error) {
    console.error("Error loading saved tube configuration:", error);
    return await loadDefaultTubeConfiguration();
  }
}

/**
 * Initialize progress records for a new user
 * @param {string} userId - The user's ID
 * @returns {Promise<boolean>} - Success or failure
 */
export async function initializeUserProgress(userId) {
  console.log(`Initializing progress records for user ${userId}`);
  
  try {
    // Call the API endpoint that handles user initialization
    const response = await fetch('/api/initialize-user-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });
    
    if (!response.ok) {
      console.error("Error initializing user progress:", await response.text());
      return false;
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log("Successfully initialized user progress records");
      return true;
    } else {
      console.error("API returned error during initialization:", result.error);
      return false;
    }
  } catch (error) {
    console.error("Exception during user initialization:", error);
    return false;
  }
}

/**
 * Save the current tube configuration to the database
 * @param {string} userId - The user's ID
 * @param {Object} tubeConfig - The current tube configuration
 * @returns {Promise<boolean>} - Success or failure
 */
export async function saveTubeConfiguration(userId, tubeConfig) {
  if (!userId || !tubeConfig || !tubeConfig.tubes) {
    console.warn("Cannot save tube configuration - invalid parameters");
    return false;
  }
  
  console.log(`Saving tube configuration for user ${userId}`);
  
  try {
    // For each tube, save the tube position
    for (const tube of tubeConfig.tubes) {
      // Save tube position
      const tubeResponse = await fetch('/api/save-tube-position', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          tubeNumber: tube.number,
          threadId: tube.currentThread
        })
      });
      
      if (!tubeResponse.ok) {
        console.error(`Error saving tube position for tube ${tube.number}:`, await tubeResponse.text());
      }
      
      // Save stitch progress
      if (tube.activeStitches && tube.activeStitches.length > 0) {
        const progressUpdates = tube.activeStitches.map(stitch => ({
          userId,
          threadId: tube.currentThread,
          stitchId: stitch.id,
          orderNumber: stitch.orderNumber,
          skipNumber: stitch.skipNumber,
          distractorLevel: stitch.distractorLevel
        }));
        
        const progressResponse = await fetch('/api/update-stitch-positions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ updates: progressUpdates })
        });
        
        if (!progressResponse.ok) {
          console.error(`Error saving stitch progress for tube ${tube.number}:`, await progressResponse.text());
        }
      }
    }
    
    console.log("Successfully saved tube configuration");
    return true;
  } catch (error) {
    console.error("Error saving tube configuration:", error);
    return false;
  }
}

/**
 * Preload the next batch of stitches for a given tube
 * @param {number} tubeNumber - The tube number
 * @param {string} threadId - The current thread ID
 * @param {number} currentStitchIndex - The current stitch index
 * @param {number} count - How many stitches to preload
 * @returns {Promise<Array>} - The preloaded stitches
 */
export async function preloadNextStitches(tubeNumber, threadId, currentStitchIndex, count = LAZY_LOAD_BATCH_SIZE) {
  console.log(`Preloading next ${count} stitches for tube ${tubeNumber}, thread ${threadId}`);
  
  try {
    // Call the API to load more stitches
    const response = await fetch(`/api/user-stitches?thread=${threadId}&prefetch=${count}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error("Error preloading stitches:", await response.text());
      return [];
    }
    
    const { data } = await response.json();
    
    // Find the thread in the response
    const thread = data.find(t => t.thread_id === threadId);
    
    if (!thread) {
      console.error(`Thread ${threadId} not found in API response`);
      return [];
    }
    
    // Get stitches after the current index
    const nextStitches = thread.stitches
      .filter(stitch => stitch.order_number > currentStitchIndex)
      .sort((a, b) => a.order_number - b.order_number)
      .slice(0, count)
      .map(stitch => ({
        ...stitch,
        orderNumber: stitch.order_number,
        skipNumber: stitch.skip_number || 3,
        distractorLevel: stitch.distractor_level || 'L1'
      }));
      
    console.log(`Preloaded ${nextStitches.length} additional stitches`);
    
    return nextStitches;
  } catch (error) {
    console.error("Error preloading stitches:", error);
    return [];
  }
}

/**
 * Save state for anonymous users in browser storage
 * @param {Object} tubeConfig - The current tube configuration
 * @returns {boolean} - Success or failure
 */
export function saveAnonymousState(tubeConfig) {
  if (!tubeConfig || !tubeConfig.tubes) {
    return false;
  }
  
  try {
    // Create serializable state object
    const state = {
      tubes: tubeConfig.tubes.map(tube => ({
        number: tube.number,
        currentThread: tube.currentThread,
        currentStitchIndex: tube.currentStitchIndex,
        activeStitches: tube.activeStitches.map(stitch => ({
          id: stitch.id,
          thread_id: stitch.thread_id,
          orderNumber: stitch.orderNumber,
          skipNumber: stitch.skipNumber,
          distractorLevel: stitch.distractorLevel
        }))
      })),
      timestamp: Date.now()
    };
    
    // Save to localStorage
    localStorage.setItem('zenjin_anonymous_state', JSON.stringify(state));
    console.log("Saved anonymous state to localStorage");
    
    return true;
  } catch (error) {
    console.error("Error saving anonymous state:", error);
    return false;
  }
}

/**
 * Load state for anonymous users from browser storage
 * @returns {Object|null} - The loaded tube configuration or null if none exists
 */
export function loadAnonymousState() {
  try {
    const savedState = localStorage.getItem('zenjin_anonymous_state');
    
    if (!savedState) {
      console.log("No saved anonymous state found");
      return null;
    }
    
    const state = JSON.parse(savedState);
    
    // Check if state is too old (24 hours)
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    if (state.timestamp && Date.now() - state.timestamp > MAX_AGE) {
      console.log("Anonymous state is too old, discarding");
      localStorage.removeItem('zenjin_anonymous_state');
      return null;
    }
    
    console.log("Loaded anonymous state from localStorage");
    return { tubes: state.tubes };
  } catch (error) {
    console.error("Error loading anonymous state:", error);
    return null;
  }
}

/**
 * Handle session state for all user types
 * @param {Object} user - The current user object from Supabase Auth
 * @returns {Object} - Functions for managing tube configuration
 */
export function useTubeConfiguration(user) {
  return {
    // Load the appropriate configuration based on user type
    loadConfiguration: async () => {
      if (!user) {
        // For anonymous users, try to load from localStorage first
        const savedState = loadAnonymousState();
        if (savedState) {
          return savedState;
        }
        
        // Otherwise load default configuration
        return await loadDefaultTubeConfiguration();
      }
      
      // For authenticated users
      return await loadTubeConfiguration(user);
    },
    
    // Save configuration
    saveConfiguration: async (config) => {
      if (user) {
        // For authenticated users, save to database
        return await saveTubeConfiguration(user.id, config);
      } else {
        // For anonymous users, save to localStorage
        return saveAnonymousState(config);
      }
    },
    
    // Preload next batch of stitches
    preloadNextStitches: async (tubeNumber, threadId, currentStitchIndex, count) => {
      return await preloadNextStitches(tubeNumber, threadId, currentStitchIndex, count);
    },
    
    // Check if user is authenticated
    isAuthenticated: !!user,
    
    // Get user ID (or anonymous ID)
    getUserId: () => user ? user.id : generateAnonymousId()
  };
}