/**
 * Supabase client for Player application
 * Handles content access and progress tracking
 */
import { supabase } from './auth/supabaseClient';
import { ThreadData, SessionResult, StitchWithProgress } from './types/distinction-learning';

// Define global state for client-side persistence
declare global {
  interface Window {
    __STITCH_UPDATE_QUEUE?: Array<{
      userId: string;
      threadId: string;
      stitchId: string;
      orderNumber: number;
      skipNumber: number;
      distractorLevel: string;
    }>;
    __TUBE_POSITION_QUEUE?: Array<{
      userId: string;
      tubeNumber: number;
      threadId: string;
    }>;
    __TUBE_DEBUG_STATE?: Record<string, any>;
    __LAST_USER_STITCH?: {
      userId: string;
      threadId: string;
      stitchId: string;
      timestamp: number;
    };
  }
}

/**
 * Interface for tube position data
 */
export interface TubePositionData {
  tubeNumber: number;
  threadId: string;
  lastActive?: string;
}

/**
 * Fetch user's stitches from the API
 * This function calls our custom API endpoint which handles:
 * - Fetching user progress
 * - Initializing default progress if needed
 * - Getting stitch content with questions
 * - Combining progress and content data
 * 
 * @returns Array of thread data or null on error
 */
export async function fetchUserStitches(options: {prefetch?: number, mode?: string, userId?: string} = {}): Promise<{threads: ThreadData[], tubePosition: TubePositionData | null} | null> {
  try {
    // Build query parameters for more control
    const queryParams = new URLSearchParams();
    
    // Add prefetch count if provided
    if (options.prefetch) {
      queryParams.append('prefetch', options.prefetch.toString());
    }
    
    // Add mode if provided (e.g., 'restore')
    if (options.mode) {
      queryParams.append('mode', options.mode);
    }
    
    // Add user ID if provided (for accessing another user's data)
    if (options.userId) {
      queryParams.append('userId', options.userId);
    }
    
    const queryString = queryParams.toString();
    const url = `/api/user-stitches${queryString ? '?' + queryString : ''}`;
    
    // Make the API request with credentials to include cookies
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // This is the key change to include auth cookies
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching user stitches:', errorData);
      return null;
    }
    
    const responseData = await response.json();
    
    if (!responseData.success || !responseData.data) {
      console.error('Invalid response from user-stitches API:', responseData);
      return null;
    }
    
    return {
      threads: responseData.data as ThreadData[],
      tubePosition: responseData.tubePosition as TubePositionData | null
    };
  } catch (error) {
    console.error('Exception fetching user stitches:', error);
    return null;
  }
}

/**
 * Fetch stitches for anonymous users from the API
 * This function calls a dedicated API endpoint for anonymous users, which provides:
 * - Initialization of free tier content with default progress
 * - Getting stitch content with questions
 * - Combining progress and content data
 * 
 * Anonymous users get a subset of content based on free tier limitations
 * 
 * @returns Array of thread data or null on error
 */
export async function fetchAnonymousUserStitches(options: {prefetch?: number, mode?: string} = {}): Promise<{threads: ThreadData[], tubePosition: TubePositionData | null} | null> {
  try {
    console.log('Fetching stitches for anonymous user');
    
    // Build query parameters for anonymous request
    const queryParams = new URLSearchParams();
    
    // Add prefetch count if provided
    if (options.prefetch) {
      queryParams.append('prefetch', options.prefetch.toString());
    }
    
    // Add mode if provided (e.g., 'restore' or 'anonymous')
    if (options.mode) {
      queryParams.append('mode', options.mode);
    } else {
      // Default to anonymous mode
      queryParams.append('mode', 'anonymous');
    }
    
    // Add anonymous flag to indicate this is an anonymous request
    queryParams.append('anonymous', 'true');
    
    // Get anonymousId from localStorage if available
    if (typeof window !== 'undefined') {
      const anonymousId = localStorage.getItem('zenjin_anonymous_id');
      if (anonymousId) {
        queryParams.append('anonymousId', anonymousId);
      }
    }
    
    const queryString = queryParams.toString();
    const url = `/api/anonymous-stitches${queryString ? '?' + queryString : ''}`;
    
    // Make the API request
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      // No credentials for anonymous users
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching anonymous stitches:', errorData);
      return null;
    }
    
    const responseData = await response.json();
    
    if (!responseData.success || !responseData.data) {
      console.error('Invalid response from anonymous-stitches API:', responseData);
      return null;
    }
    
    // If this is the first anonymous session, store the anonymous ID
    if (responseData.anonymousId && typeof window !== 'undefined') {
      localStorage.setItem('zenjin_anonymous_id', responseData.anonymousId);
      console.log('Stored new anonymous ID:', responseData.anonymousId);
    }
    
    return {
      threads: responseData.data as ThreadData[],
      tubePosition: responseData.tubePosition as TubePositionData | null
    };
  } catch (error) {
    console.error('Exception fetching anonymous stitches:', error);
    return null;
  }
}

/**
 * Update user stitch progress with robust persistence
 * Uses multiple fallback mechanisms to ensure data is saved
 * Implements "Live Aid Rotating Stage" model: 
 * - If urgent=true, returns quickly for UI responsiveness
 * - Continues trying to save in the background
 * 
 * @param userId User ID
 * @param threadId Thread ID
 * @param stitchId Stitch ID
 * @param orderNumber New order number
 * @param skipNumber New skip number
 * @param distractorLevel New distractor level
 * @param urgent Whether this needs a fast return (default: false)
 * @returns Success boolean
 */
export async function updateUserStitchProgress(
  userId: string,
  threadId: string,
  stitchId: string,
  orderNumber: number,
  skipNumber: number,
  distractorLevel: 'L1' | 'L2' | 'L3',
  urgent: boolean = false
): Promise<boolean> {
  try {
    // Validate parameters to prevent API errors
    if (!userId || typeof userId !== 'string') {
      console.error('Invalid userId provided to updateUserStitchProgress:', userId);
      return false;
    }
    
    if (!threadId || typeof threadId !== 'string') {
      console.error('Invalid threadId provided to updateUserStitchProgress:', threadId);
      return false;
    }
    
    if (!stitchId || typeof stitchId !== 'string') {
      console.error('Invalid stitchId provided to updateUserStitchProgress:', stitchId);
      return false;
    }
    
    if (orderNumber === undefined || typeof orderNumber !== 'number') {
      console.error('Invalid orderNumber provided to updateUserStitchProgress:', orderNumber);
      return false;
    }
    
    console.log(`Updating progress for user ${userId}, thread ${threadId}, stitch ${stitchId}: order=${orderNumber}, skip=${skipNumber}, level=${distractorLevel}, urgent=${urgent}`);
    
    // Keep track of the update record for retry logic
    const updateRecord = {
      userId,
      threadId,
      stitchId,
      orderNumber,
      skipNumber,
      distractorLevel
    };
    
    // Queue for storing this data in case of failure
    // Implemented as a module-level variable to persist across rendering cycles
    if (typeof window !== 'undefined') {
      window.__STITCH_UPDATE_QUEUE = window.__STITCH_UPDATE_QUEUE || [];
    }

    // If this is an urgent update (user needs to see next content immediately)
    // we'll store the data and return quickly, processing in the background
    if (urgent) {
      console.log('URGENT UPDATE: Storing progress update for background processing');
      
      // Store in localStorage as a backup in case of page refresh
      try {
        const backupKey = `stitch_update_${userId}_${threadId}_${stitchId}`;
        localStorage.setItem(backupKey, JSON.stringify({
          ...updateRecord,
          timestamp: Date.now()
        }));
      } catch (err) {
        console.warn('Could not store update in localStorage:', err);
      }
      
      // Add to in-memory queue
      if (typeof window !== 'undefined') {
        window.__STITCH_UPDATE_QUEUE = window.__STITCH_UPDATE_QUEUE || [];
        window.__STITCH_UPDATE_QUEUE.push(updateRecord);
      }
      
      // Process the queue in the background
      setTimeout(() => processStitchUpdateQueue(), 50);
      
      // Return true immediately for better UI responsiveness
      return true;
    }
    
    // For non-urgent updates, try to persist with multiple attempts
    return await persistStitchUpdate(updateRecord);
    
  } catch (error) {
    console.error('Exception updating user stitch progress:', error);
    
    // Store the failed update for retry if possible
    if (typeof window !== 'undefined') {
      window.__STITCH_UPDATE_QUEUE = window.__STITCH_UPDATE_QUEUE || [];
      window.__STITCH_UPDATE_QUEUE.push({
        userId,
        threadId,
        stitchId,
        orderNumber,
        skipNumber,
        distractorLevel
      });
      
      // Schedule retry in the background
      setTimeout(() => processStitchUpdateQueue(), 1000);
    }
    
    // Don't let this error break the application flow
    return false;
  }
}

/**
 * Process any queued stitch updates in the background
 * This ensures updates that failed due to API issues can be retried
 */
async function processStitchUpdateQueue() {
  if (typeof window === 'undefined') return;
  
  // Initialize queue if needed
  window.__STITCH_UPDATE_QUEUE = window.__STITCH_UPDATE_QUEUE || [];
  
  // Process all items in the queue
  const queue = window.__STITCH_UPDATE_QUEUE;
  if (queue.length === 0) return;
  
  console.log(`Processing stitch update queue (${queue.length} items)`);
  
  // Create a new queue for items that still fail
  const newQueue = [];
  
  // Process each update in sequence
  for (const update of queue) {
    try {
      const success = await persistStitchUpdate(update);
      if (!success) {
        console.log(`Update for ${update.stitchId} failed, queuing for retry`);
        newQueue.push(update);
      } else {
        console.log(`Successfully processed queued update for ${update.stitchId}`);
        
        // Remove from localStorage backup if it exists
        try {
          const backupKey = `stitch_update_${update.userId}_${update.threadId}_${update.stitchId}`;
          localStorage.removeItem(backupKey);
        } catch (err) {
          // Ignore localStorage errors
        }
      }
    } catch (err) {
      console.error('Error processing queued update:', err);
      newQueue.push(update);
    }
  }
  
  // Replace the queue with items that still need processing
  window.__STITCH_UPDATE_QUEUE = newQueue;
  
  // Schedule another processing round if needed
  if (newQueue.length > 0) {
    console.log(`${newQueue.length} updates still pending, scheduling retry`);
    setTimeout(() => processStitchUpdateQueue(), 5000);
  }
  
  // Also check localStorage for any backed up updates from previous sessions
  try {
    // Look for any keys that match our pattern
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('stitch_update_')) {
        try {
          const savedUpdate = JSON.parse(localStorage.getItem(key) || '{}');
          if (savedUpdate.userId && savedUpdate.threadId && savedUpdate.stitchId) {
            console.log(`Found backed up update from previous session: ${key}`);
            
            // Ensure distractorLevel is a valid enum value
            const level = savedUpdate.distractorLevel;
            const validLevel = (level === 'L1' || level === 'L2' || level === 'L3') 
              ? level as 'L1' | 'L2' | 'L3' 
              : 'L1';
            
            window.__STITCH_UPDATE_QUEUE = window.__STITCH_UPDATE_QUEUE || [];
            window.__STITCH_UPDATE_QUEUE.push({
              ...savedUpdate,
              distractorLevel: validLevel
            });
          }
        } catch (err) {
          console.warn(`Error parsing localStorage item ${key}:`, err);
        }
      }
    }
    
    // Also check for active_stitch data in localStorage and ensure it's persisted
    const activeStitchKey = 'zenjin_active_stitch';
    const activeStitchData = localStorage.getItem(activeStitchKey);
    if (activeStitchData) {
      try {
        const stitch = JSON.parse(activeStitchData);
        if (stitch && stitch.userId && stitch.threadId && stitch.stitchId) {
          console.log(`CRITICAL PERSISTENCE: Found active stitch in localStorage: ${stitch.stitchId}`);
          
          // Ensure this is persisted to the database
          window.__STITCH_UPDATE_QUEUE = window.__STITCH_UPDATE_QUEUE || [];
          window.__STITCH_UPDATE_QUEUE.push({
            userId: stitch.userId,
            threadId: stitch.threadId,
            stitchId: stitch.stitchId,
            orderNumber: stitch.orderNumber || 0,
            skipNumber: stitch.skipNumber || 3,
            distractorLevel: (stitch.distractorLevel === 'L1' || 
                             stitch.distractorLevel === 'L2' || 
                             stitch.distractorLevel === 'L3') 
                             ? stitch.distractorLevel as 'L1' | 'L2' | 'L3' 
                             : 'L1'
          });
          
          // Process the queue immediately
          setTimeout(() => processStitchUpdateQueue(), 50);
        }
      } catch (err) {
        console.warn(`Error parsing active stitch localStorage item:`, err);
      }
    }
    
    // Also check sessionStorage for even more recent data
    try {
      const sessionStitchKey = 'zenjin_active_stitch_session';
      const sessionStitchData = sessionStorage.getItem(sessionStitchKey);
      if (sessionStitchData) {
        const stitch = JSON.parse(sessionStitchData);
        if (stitch && stitch.userId && stitch.threadId && stitch.stitchId) {
          console.log(`CRITICAL PERSISTENCE: Found even more recent active stitch in sessionStorage: ${stitch.stitchId}`);
          
          // This is likely the most recent data, prioritize it highest
          window.__STITCH_UPDATE_QUEUE = window.__STITCH_UPDATE_QUEUE || [];
          
          // Insert at the beginning of the queue for priority processing
          window.__STITCH_UPDATE_QUEUE.unshift({
            userId: stitch.userId,
            threadId: stitch.threadId,
            stitchId: stitch.stitchId,
            orderNumber: stitch.orderNumber || 0,
            skipNumber: stitch.skipNumber || 3,
            distractorLevel: (stitch.distractorLevel === 'L1' || 
                             stitch.distractorLevel === 'L2' || 
                             stitch.distractorLevel === 'L3') 
                             ? stitch.distractorLevel as 'L1' | 'L2' | 'L3' 
                             : 'L1'
          });
          
          // Process immediately
          setTimeout(() => processStitchUpdateQueue(), 50);
        }
      }
    } catch (err) {
      console.warn(`Error checking sessionStorage for stitch data:`, err);
    }
  } catch (err) {
    console.warn('Error checking localStorage for backed up updates:', err);
  }
}

/**
 * Persist a stitch update with multiple fallback mechanisms
 * @param update The update record to persist
 * @returns Success boolean
 */
async function persistStitchUpdate(update: {
  userId: string,
  threadId: string,
  stitchId: string,
  orderNumber: number,
  skipNumber: number,
  distractorLevel: 'L1' | 'L2' | 'L3'
}): Promise<boolean> {
  const {userId, threadId, stitchId, orderNumber, skipNumber, distractorLevel} = update;
  
  // ATTEMPT 1: Use API route with credentials included to ensure authentication
  try {
    console.log(`ATTEMPT 1: Using API route to update stitch ${stitchId}`);
    const response = await fetch('/api/update-progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Include auth cookies
      body: JSON.stringify({
        userId,
        threadId,
        stitchId,
        orderNumber,
        skipNumber,
        distractorLevel
      })
    });
    
    if (response.ok) {
      console.log(`Successfully updated progress for stitch ${stitchId} via API`);
      return true;
    }
    
    let errorInfo = 'Unknown error';
    try {
      const error = await response.json();
      errorInfo = JSON.stringify(error);
    } catch (e) {
      // If we can't parse the error response, use status text
      errorInfo = response.statusText;
    }
    
    console.error(`ATTEMPT 1 FAILED: API update error (status ${response.status}):`, errorInfo);
  } catch (apiError) {
    console.error('ATTEMPT 1 FAILED: Exception during API call:', apiError);
  }
  
  // ATTEMPT 2: Use direct Supabase client as fallback
  try {
    console.log(`ATTEMPT 2: Using direct Supabase client to update stitch ${stitchId}`);
    
    // Try upsert with complete data
    const { error: upsertError } = await supabase
      .from('user_stitch_progress')
      .upsert({
        user_id: userId,
        thread_id: threadId,
        stitch_id: stitchId,
        order_number: orderNumber,
        skip_number: skipNumber,
        distractor_level: distractorLevel
      }, {
        onConflict: 'user_id,thread_id,stitch_id'
      });
    
    if (!upsertError) {
      console.log(`Successfully updated progress for stitch ${stitchId} via direct Supabase client`);
      return true;
    }
    
    console.error(`ATTEMPT 2 FAILED: Supabase upsert error:`, upsertError);
  } catch (supabaseError) {
    console.error('ATTEMPT 2 FAILED: Exception during Supabase call:', supabaseError);
  }
  
  // ATTEMPT 3: Try update then insert approach with minimal fields
  try {
    console.log(`ATTEMPT 3: Using update-then-insert approach for stitch ${stitchId}`);
    
    // First try to update with minimal fields
    const { error: updateError } = await supabase
      .from('user_stitch_progress')
      .update({ order_number: orderNumber })
      .eq('user_id', userId)
      .eq('thread_id', threadId)
      .eq('stitch_id', stitchId);
    
    if (!updateError) {
      console.log(`Successfully updated progress for stitch ${stitchId} via direct update`);
      return true;
    }
    
    console.log(`Update failed, trying insert:`, updateError);
    
    // Try insert if update fails
    const { error: insertError } = await supabase
      .from('user_stitch_progress')
      .insert({
        user_id: userId,
        thread_id: threadId,
        stitch_id: stitchId,
        order_number: orderNumber,
        skip_number: skipNumber,
        distractor_level: distractorLevel
      });
    
    if (!insertError) {
      console.log(`Successfully inserted progress for stitch ${stitchId}`);
      return true;
    }
    
    console.error(`ATTEMPT 3 FAILED: Insert error:`, insertError);
  } catch (dbError) {
    console.error('ATTEMPT 3 FAILED: Exception during database operations:', dbError);
  }
  
  // ATTEMPT 4: Try RPC call as a last resort
  try {
    console.log(`ATTEMPT 4: Using RPC call for stitch ${stitchId}`);
    
    const { error: rpcError } = await supabase.rpc('upsert_user_stitch_progress', {
      p_user_id: userId,
      p_thread_id: threadId,
      p_stitch_id: stitchId,
      p_order_number: orderNumber,
      p_skip_number: skipNumber,
      p_distractor_level: distractorLevel
    });
    
    if (!rpcError) {
      console.log(`Successfully updated progress for stitch ${stitchId} via RPC call`);
      return true;
    }
    
    console.error(`ATTEMPT 4 FAILED: RPC error:`, rpcError);
  } catch (rpcError) {
    console.error('ATTEMPT 4 FAILED: Exception during RPC call:', rpcError);
  }
  
  // All attempts failed
  console.error(`All attempts to update stitch ${stitchId} failed`);
  return false;
}

/**
 * Save a session result
 * @param sessionData Session result data
 * @param userId User ID (optional, defaults to 'anonymous')
 * @returns ID of saved session or null on error
 */
export async function saveSessionResult(sessionData: SessionResult, userId: string = 'anonymous'): Promise<string | null> {
  try {
    // Use API route with credentials included to ensure authentication
    const response = await fetch('/api/save-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Include auth cookies
      body: JSON.stringify({
        contentId: sessionData.contentId,
        threadId: sessionData.threadId,
        stitchId: sessionData.stitchId,
        userId: userId,
        results: sessionData.questions,
        totalPoints: sessionData.totalPoints,
        accuracy: sessionData.accuracy,
        completedAt: sessionData.completedAt || new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to save session via API:', error);
      return null;
    }
    
    const result = await response.json();
    return result.data?.id || null;
  } catch (error) {
    console.error('Exception saving session result:', error);
    return null;
  }
}

/**
 * Save a session result for anonymous users
 * Uses a dedicated API endpoint for anonymous users and stores
 * session data locally to allow for future synchronization if the user
 * creates an account later
 * 
 * @param sessionData Session result data
 * @returns ID of saved session or null on error
 */
export async function saveAnonymousSessionResult(sessionData: SessionResult): Promise<string | null> {
  try {
    console.log('Saving session result for anonymous user');
    
    // Get anonymousId from localStorage if available
    let anonymousId = 'unknown';
    if (typeof window !== 'undefined') {
      anonymousId = localStorage.getItem('zenjin_anonymous_id') || 'unknown';
    }
    
    // Store session result locally for potential future sync
    try {
      if (typeof window !== 'undefined') {
        // Get existing session data or initialize empty array
        const existingData = localStorage.getItem('zenjin_anonymous_sessions');
        const sessions = existingData ? JSON.parse(existingData) : [];
        
        // Add this session with timestamp
        sessions.push({
          ...sessionData,
          timestamp: Date.now(),
          anonymousId
        });
        
        // Only keep the latest 20 sessions to avoid storage limits
        const latestSessions = sessions.slice(-20);
        localStorage.setItem('zenjin_anonymous_sessions', JSON.stringify(latestSessions));
        
        console.log(`Stored anonymous session locally (${latestSessions.length} total sessions stored)`);
      }
    } catch (storageError) {
      console.warn('Could not store session in localStorage:', storageError);
    }
    
    // Use the anonymous-specific API endpoint
    const response = await fetch('/api/anonymous-save-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // No credentials for anonymous users
      body: JSON.stringify({
        contentId: sessionData.contentId,
        threadId: sessionData.threadId,
        stitchId: sessionData.stitchId,
        anonymousId: anonymousId,
        results: sessionData.questions,
        totalPoints: sessionData.totalPoints,
        accuracy: sessionData.accuracy,
        completedAt: sessionData.completedAt || new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      // Handle API error, but don't fail the client-side experience
      try {
        const error = await response.json();
        console.error('Failed to save anonymous session via API:', error);
      } catch (parseError) {
        console.error('Failed to save anonymous session - could not parse error response');
      }
      
      // Return a placeholder ID since we've stored locally
      return 'local-' + Date.now();
    }
    
    const result = await response.json();
    
    // If the API returned a new anonymousId, store it
    if (result.anonymousId && typeof window !== 'undefined') {
      localStorage.setItem('zenjin_anonymous_id', result.anonymousId);
    }
    
    return result.data?.id || ('local-' + Date.now());
  } catch (error) {
    console.error('Exception saving anonymous session result:', error);
    
    // Return a placeholder ID to avoid breaking the client flow
    return 'local-' + Date.now();
  }
}

/**
 * Update stitch progress for anonymous users
 * Stores progress in localStorage to persist between sessions
 * 
 * @param anonymousId Anonymous user identifier
 * @param threadId Thread ID
 * @param stitchId Stitch ID
 * @param orderNumber New order number
 * @param skipNumber New skip number
 * @param distractorLevel New distractor level
 * @param urgent Whether this needs a fast return (default: false)
 * @returns Success boolean
 */
export async function updateAnonymousStitchProgress(
  anonymousId: string,
  threadId: string,
  stitchId: string,
  orderNumber: number,
  skipNumber: number,
  distractorLevel: 'L1' | 'L2' | 'L3',
  urgent: boolean = false
): Promise<boolean> {
  try {
    // Validate parameters
    if (!anonymousId || typeof anonymousId !== 'string') {
      console.error('Invalid anonymousId provided to updateAnonymousStitchProgress:', anonymousId);
      return false;
    }
    
    if (!threadId || typeof threadId !== 'string') {
      console.error('Invalid threadId provided to updateAnonymousStitchProgress:', threadId);
      return false;
    }
    
    if (!stitchId || typeof stitchId !== 'string') {
      console.error('Invalid stitchId provided to updateAnonymousStitchProgress:', stitchId);
      return false;
    }
    
    if (orderNumber === undefined || typeof orderNumber !== 'number') {
      console.error('Invalid orderNumber provided to updateAnonymousStitchProgress:', orderNumber);
      return false;
    }
    
    console.log(`Updating anonymous progress for ${anonymousId}, thread ${threadId}, stitch ${stitchId}: order=${orderNumber}, skip=${skipNumber}, level=${distractorLevel}`);
    
    // Create update record
    const updateRecord = {
      anonymousId,
      threadId,
      stitchId,
      orderNumber,
      skipNumber,
      distractorLevel,
      timestamp: Date.now()
    };
    
    // Store progress in localStorage
    if (typeof window !== 'undefined') {
      try {
        // Get existing progress data
        const storageKey = 'zenjin_anonymous_progress';
        const existingData = localStorage.getItem(storageKey);
        const progressData = existingData ? JSON.parse(existingData) : { threads: {} };
        
        // Ensure threads object exists
        if (!progressData.threads) {
          progressData.threads = {};
        }
        
        // Ensure thread object exists
        if (!progressData.threads[threadId]) {
          progressData.threads[threadId] = { stitches: {} };
        }
        
        // Update stitch progress
        progressData.threads[threadId].stitches[stitchId] = {
          orderNumber,
          skipNumber,
          distractorLevel,
          timestamp: Date.now()
        };
        
        // Save updated progress
        localStorage.setItem(storageKey, JSON.stringify(progressData));
        console.log('Updated anonymous progress in localStorage');
      } catch (storageError) {
        console.error('Failed to store anonymous progress in localStorage:', storageError);
        return false;
      }
    } else {
      console.warn('Cannot save anonymous progress: window object not available');
      return false;
    }
    
    // If we're in urgent mode, we'll be done after saving to localStorage
    if (urgent) {
      // Try sending to API in the background
      setTimeout(() => sendAnonymousProgressToAPI(updateRecord), 100);
      return true;
    }
    
    // For non-urgent updates, try to persist to API too
    return await sendAnonymousProgressToAPI(updateRecord);
  } catch (error) {
    console.error('Exception updating anonymous stitch progress:', error);
    return false;
  }
}

/**
 * Send anonymous progress update to API
 * @param update The update record to send
 * @returns Success boolean
 */
async function sendAnonymousProgressToAPI(update: {
  anonymousId: string,
  threadId: string,
  stitchId: string,
  orderNumber: number,
  skipNumber: number,
  distractorLevel: 'L1' | 'L2' | 'L3',
  timestamp: number
}): Promise<boolean> {
  try {
    // Make API request to save progress
    const response = await fetch('/api/anonymous-update-progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(update)
    });
    
    if (!response.ok) {
      let errorInfo = 'Unknown error';
      try {
        const error = await response.json();
        errorInfo = JSON.stringify(error);
      } catch (e) {
        // If we can't parse the error response, use status text
        errorInfo = response.statusText;
      }
      
      console.error(`API error saving anonymous progress (status ${response.status}):`, errorInfo);
      return false;
    }
    
    console.log('Successfully sent anonymous progress to API');
    return true;
  } catch (apiError) {
    console.error('Exception during anonymous progress API call:', apiError);
    return false;
  }
}

/**
 * Save user's current tube position with robust persistence
 * @param userId User ID
 * @param tubeNumber Current tube number (1-3)
 * @param threadId Current thread ID
 * @param urgent Whether this is an urgent update (returns quickly in background mode)
 * @returns Success boolean
 */
export async function saveTubePosition(
  userId: string,
  tubeNumber: number,
  threadId: string,
  urgent: boolean = false
): Promise<boolean> {
  try {
    // Validate parameters to prevent API errors
    if (!userId || typeof userId !== 'string') {
      console.error('Invalid userId provided to saveTubePosition:', userId);
      return false;
    }
    
    // Allow implicit conversion of tubeNumber to handle edge cases
    const normalizedTubeNumber = Number(tubeNumber);
    if (isNaN(normalizedTubeNumber) || normalizedTubeNumber < 1 || normalizedTubeNumber > 3) {
      console.error('Invalid tubeNumber provided to saveTubePosition:', tubeNumber, 'normalized to', normalizedTubeNumber);
      return false;
    }
    
    if (!threadId || typeof threadId !== 'string') {
      console.error('Invalid threadId provided to saveTubePosition:', threadId);
      return false;
    }
    
    console.log(`Saving tube position for user ${userId}: Tube-${normalizedTubeNumber}, Thread-${threadId}, Urgent=${urgent}`);
    
    // Create a position record for persistence and retries
    const positionRecord = {
      userId,
      tubeNumber: normalizedTubeNumber,
      threadId
    };
    
    // Queue for tube position updates if they fail
    if (typeof window !== 'undefined') {
      window.__TUBE_POSITION_QUEUE = window.__TUBE_POSITION_QUEUE || [];
    }
    
    // "Live Aid Rotating Stage" model - if urgent, store and return quickly
    if (urgent) {
      console.log('URGENT SAVE: Storing tube position for background processing');
      
      // Store in localStorage as a backup
      try {
        const backupKey = `tube_position_${userId}`;
        localStorage.setItem(backupKey, JSON.stringify({
          ...positionRecord,
          timestamp: Date.now()
        }));
      } catch (err) {
        console.warn('Could not store tube position in localStorage:', err);
      }
      
      // Add to in-memory queue for background processing
      if (typeof window !== 'undefined') {
        window.__TUBE_POSITION_QUEUE = window.__TUBE_POSITION_QUEUE || [];
        window.__TUBE_POSITION_QUEUE.push(positionRecord);
      }
      
      // Schedule background processing
      setTimeout(() => processTubePositionQueue(), 100);
      
      // Return immediately for better UI responsiveness
      return true;
    }
    
    // For non-urgent updates, persist with multiple attempts
    return await persistTubePosition(positionRecord);
  } catch (error) {
    console.error('Top-level exception saving tube position:', error);
    
    // Store the failed save for retry if possible
    if (typeof window !== 'undefined') {
      window.__TUBE_POSITION_QUEUE = window.__TUBE_POSITION_QUEUE || [];
      window.__TUBE_POSITION_QUEUE.push({
        userId,
        tubeNumber,
        threadId
      });
      
      // Schedule retry
      setTimeout(() => processTubePositionQueue(), 1000);
    }
    
    // Don't let this error break the application flow
    return false;
  }
}

/**
 * Process queued tube position updates in the background
 */
async function processTubePositionQueue() {
  if (typeof window === 'undefined') return;
  
  // Initialize queue if needed
  window.__TUBE_POSITION_QUEUE = window.__TUBE_POSITION_QUEUE || [];
  
  // Get the queue
  const queue = window.__TUBE_POSITION_QUEUE;
  if (queue.length === 0) return;
  
  console.log(`Processing tube position queue (${queue.length} items)`);
  
  // Create a new queue for failed saves
  const newQueue = [];
  
  // Process each position in sequence
  for (const position of queue) {
    try {
      const success = await persistTubePosition(position);
      if (!success) {
        console.log(`Position save for user ${position.userId} failed, queuing for retry`);
        newQueue.push(position);
      } else {
        console.log(`Successfully processed queued tube position for user ${position.userId}`);
        
        // Remove from localStorage if it exists
        try {
          const backupKey = `tube_position_${position.userId}`;
          localStorage.removeItem(backupKey);
        } catch (err) {
          // Ignore localStorage errors
        }
      }
    } catch (err) {
      console.error('Error processing queued position:', err);
      newQueue.push(position);
    }
  }
  
  // Replace the queue with positions that still need processing
  window.__TUBE_POSITION_QUEUE = newQueue;
  
  // Schedule another processing round if needed
  if (newQueue.length > 0) {
    console.log(`${newQueue.length} tube positions still pending, scheduling retry`);
    setTimeout(() => processTubePositionQueue(), 5000);
  }
  
  // Also check localStorage for backed up positions from previous sessions
  try {
    const backupKey = `tube_position_${queue[0]?.userId}`;
    const savedPosition = localStorage.getItem(backupKey);
    if (savedPosition) {
      try {
        const parsedPosition = JSON.parse(savedPosition);
        if (parsedPosition.userId && parsedPosition.tubeNumber && parsedPosition.threadId) {
          console.log(`Found backed up tube position from previous session`);
          window.__TUBE_POSITION_QUEUE = window.__TUBE_POSITION_QUEUE || [];
          window.__TUBE_POSITION_QUEUE.push(parsedPosition);
        }
      } catch (err) {
        console.warn(`Error parsing localStorage tube position:`, err);
      }
    }
  } catch (err) {
    console.warn('Error checking localStorage for backed up tube position:', err);
  }
}

/**
 * Persist a tube position with multiple fallback mechanisms
 * @param position The position record to persist
 * @returns Success boolean
 */
async function persistTubePosition(position: {
  userId: string,
  tubeNumber: number,
  threadId: string
}): Promise<boolean> {
  const {userId, tubeNumber, threadId} = position;
  
  // ATTEMPT 1: Use API route with credentials
  try {
    console.log(`ATTEMPT 1: Using API route to save tube position for user ${userId}`);
    const response = await fetch('/api/save-tube-position', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Include auth cookies
      body: JSON.stringify({
        userId,
        tubeNumber,
        threadId
      })
    });
    
    if (response.ok) {
      console.log(`Successfully saved tube position via API: User-${userId}, Tube-${tubeNumber}`);
      return true;
    }
    
    let errorInfo = 'Unknown error';
    try {
      const error = await response.json();
      errorInfo = JSON.stringify(error);
    } catch (e) {
      // If we can't parse the error response, use status text
      errorInfo = response.statusText;
    }
    
    console.error(`ATTEMPT 1 FAILED: API save error (status ${response.status}):`, errorInfo);
  } catch (apiError) {
    console.error('ATTEMPT 1 FAILED: Exception during API call:', apiError);
  }
  
  // ATTEMPT 2: Use direct Supabase client
  try {
    console.log(`ATTEMPT 2: Using direct Supabase client to save tube position`);
    
    // Try upsert with all fields
    const { error: upsertError } = await supabase
      .from('user_tube_position')
      .upsert(
        {
          user_id: userId,
          tube_number: tubeNumber,
          thread_id: threadId,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'user_id'
        }
      );
    
    if (!upsertError) {
      console.log(`Successfully saved tube position via direct Supabase client`);
      return true;
    }
    
    console.error(`ATTEMPT 2 FAILED: Supabase upsert error:`, upsertError);
  } catch (supabaseError) {
    console.error('ATTEMPT 2 FAILED: Exception during Supabase call:', supabaseError);
  }
  
  // ATTEMPT 3: Try upsert without timestamp
  try {
    console.log(`ATTEMPT 3: Using upsert without timestamp`);
    
    const { error: upsertError } = await supabase
      .from('user_tube_position')
      .upsert(
        {
          user_id: userId,
          tube_number: tubeNumber,
          thread_id: threadId
        },
        {
          onConflict: 'user_id'
        }
      );
    
    if (!upsertError) {
      console.log(`Successfully saved tube position via upsert without timestamp`);
      return true;
    }
    
    console.error(`ATTEMPT 3 FAILED: Upsert without timestamp error:`, upsertError);
  } catch (upsertError) {
    console.error('ATTEMPT 3 FAILED: Exception during upsert without timestamp:', upsertError);
  }
  
  // ATTEMPT 4: Check exists then update/insert
  try {
    console.log(`ATTEMPT 4: Using update-then-insert approach`);
    
    // First check if the record exists
    const { data: existingRecord, error: checkError } = await supabase
      .from('user_tube_position')
      .select('user_id')
      .eq('user_id', userId)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.log(`ATTEMPT 4 check failed: ${checkError.message}`);
    } else {
      // Decide whether to insert or update based on existence
      if (!existingRecord) {
        console.log('Record does not exist, attempting insert');
        const { error: insertError } = await supabase
          .from('user_tube_position')
          .insert({
            user_id: userId,
            tube_number: tubeNumber,
            thread_id: threadId
          });
        
        if (!insertError) {
          console.log(`Successfully inserted tube position`);
          return true;
        }
        
        console.error(`ATTEMPT 4 insert failed: ${insertError.message}`);
      } else {
        console.log('Record exists, attempting update');
        const { error: updateError } = await supabase
          .from('user_tube_position')
          .update({
            tube_number: tubeNumber,
            thread_id: threadId
          })
          .eq('user_id', userId);
        
        if (!updateError) {
          console.log(`Successfully updated tube position`);
          return true;
        }
        
        console.error(`ATTEMPT 4 update failed: ${updateError.message}`);
      }
    }
  } catch (dbError) {
    console.error('ATTEMPT 4 FAILED: Exception during database operations:', dbError);
  }
  
  // All attempts failed
  console.error(`All attempts to save tube position for user ${userId} failed`);
  return false;
}

/**
 * Get user's last tube position
 * @param userId User ID
 * @returns Tube position data or null if not found
 */
export async function getTubePosition(userId: string): Promise<TubePositionData | null> {
  try {
    // Use direct Supabase client to get tube position
    const { data, error } = await supabase
      .from('user_tube_position')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      console.log('No saved tube position found for user', userId);
      return null;
    }
    
    return {
      tubeNumber: data.tube_number,
      threadId: data.thread_id,
      lastActive: data.updated_at
    };
  } catch (error) {
    console.error('Exception getting tube position:', error);
    return null;
  }
}

/**
 * Save tube position for anonymous users
 * Stores position in localStorage to persist between sessions
 * 
 * @param anonymousId Anonymous user identifier
 * @param tubeNumber Current tube number (1-3)
 * @param threadId Current thread ID
 * @returns Success boolean
 */
export async function saveAnonymousTubePosition(
  anonymousId: string,
  tubeNumber: number,
  threadId: string
): Promise<boolean> {
  try {
    // Validate parameters
    if (!anonymousId || typeof anonymousId !== 'string') {
      console.error('Invalid anonymousId provided to saveAnonymousTubePosition:', anonymousId);
      return false;
    }
    
    // Allow implicit conversion of tubeNumber to handle edge cases
    const normalizedTubeNumber = Number(tubeNumber);
    if (isNaN(normalizedTubeNumber) || normalizedTubeNumber < 1 || normalizedTubeNumber > 3) {
      console.error('Invalid tubeNumber provided to saveAnonymousTubePosition:', tubeNumber);
      return false;
    }
    
    if (!threadId || typeof threadId !== 'string') {
      console.error('Invalid threadId provided to saveAnonymousTubePosition:', threadId);
      return false;
    }
    
    console.log(`Saving tube position for anonymous user ${anonymousId}: Tube-${normalizedTubeNumber}, Thread-${threadId}`);
    
    // Store position in localStorage
    if (typeof window !== 'undefined') {
      try {
        const positionData = {
          anonymousId,
          tubeNumber: normalizedTubeNumber,
          threadId,
          timestamp: Date.now()
        };
        
        // Save to localStorage
        localStorage.setItem('zenjin_anonymous_tube_position', JSON.stringify(positionData));
        console.log('Saved anonymous tube position to localStorage');
        
        // Try to save to API in background
        sendAnonymousTubePositionToAPI(positionData);
        
        return true;
      } catch (storageError) {
        console.error('Failed to save anonymous tube position to localStorage:', storageError);
        return false;
      }
    } else {
      console.warn('Cannot save anonymous tube position: window object not available');
      return false;
    }
  } catch (error) {
    console.error('Exception saving anonymous tube position:', error);
    return false;
  }
}

/**
 * Send anonymous tube position to API
 * @param position Tube position data
 * @returns Success boolean
 */
async function sendAnonymousTubePositionToAPI(position: {
  anonymousId: string,
  tubeNumber: number,
  threadId: string,
  timestamp: number
}): Promise<boolean> {
  try {
    // Make API request to save position
    const response = await fetch('/api/anonymous-save-tube-position', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(position)
    });
    
    if (!response.ok) {
      console.error('Failed to save anonymous tube position to API:', response.statusText);
      return false;
    }
    
    console.log('Successfully sent anonymous tube position to API');
    return true;
  } catch (apiError) {
    console.error('Exception during anonymous tube position API call:', apiError);
    return false;
  }
}

/**
 * Get anonymous user's tube position from localStorage
 * @returns Tube position data or null if not found
 */
export function getAnonymousTubePosition(): TubePositionData | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    
    // Get position from localStorage
    const positionData = localStorage.getItem('zenjin_anonymous_tube_position');
    if (!positionData) {
      return null;
    }
    
    // Parse the position data
    const position = JSON.parse(positionData);
    if (!position || !position.tubeNumber || !position.threadId) {
      console.warn('Invalid anonymous tube position data in localStorage');
      return null;
    }
    
    return {
      tubeNumber: position.tubeNumber,
      threadId: position.threadId,
      lastActive: new Date(position.timestamp || Date.now()).toISOString()
    };
  } catch (error) {
    console.error('Exception getting anonymous tube position:', error);
    return null;
  }
}

/**
 * Synchronize anonymous data to authenticated user
 * This function collects anonymous user data from localStorage
 * and sends it to the server to be associated with an authenticated user
 * 
 * @param userId Authenticated user ID to synchronize data to
 * @returns Success status
 */
export async function synchronizeAnonymousData(userId: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !userId) {
      return false;
    }
    
    console.log(`Synchronizing anonymous data to authenticated user ${userId}`);
    
    // Collect all anonymous data from localStorage
    const anonymousData = {
      anonymousId: localStorage.getItem('zenjin_anonymous_id') || 'unknown',
      progress: localStorage.getItem('zenjin_anonymous_progress'),
      sessions: localStorage.getItem('zenjin_anonymous_sessions'),
      tubePosition: localStorage.getItem('zenjin_anonymous_tube_position'),
      timestamp: Date.now()
    };
    
    // Check if we have any data to synchronize
    if (!anonymousData.progress && !anonymousData.sessions && !anonymousData.tubePosition) {
      console.log('No anonymous data to synchronize');
      return false;
    }
    
    // Send data to API for synchronization
    const response = await fetch('/api/synchronize-anonymous-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Include auth cookies
      body: JSON.stringify({
        userId,
        anonymousData
      })
    });
    
    if (!response.ok) {
      console.error('Failed to synchronize anonymous data:', response.statusText);
      return false;
    }
    
    console.log('Successfully synchronized anonymous data to user account');
    
    // Clear anonymous data after successful synchronization
    localStorage.removeItem('zenjin_anonymous_id');
    localStorage.removeItem('zenjin_anonymous_progress');
    localStorage.removeItem('zenjin_anonymous_sessions');
    localStorage.removeItem('zenjin_anonymous_tube_position');
    
    return true;
  } catch (error) {
    console.error('Exception synchronizing anonymous data:', error);
    return false;
  }
}