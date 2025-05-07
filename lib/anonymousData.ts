/**
 * Utility functions for managing anonymous user data
 * 
 * These functions help with creating, accessing, and clearing anonymous user data
 * stored in localStorage, ensuring that anonymous sessions are properly isolated
 * from authenticated sessions.
 */

/**
 * Creates a new anonymous user ID and initializes empty progress data
 * In the unified approach, this sets up storage in all relevant locations
 * @returns The newly created anonymous ID
 */
export const createAnonymousUser = (): string => {
  // Generate new anonymous ID with timestamp and random number for uniqueness
  const newAnonymousId = `anon-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  
  // Store the ID in ALL possible locations for maximum compatibility
  if (typeof window !== 'undefined') {
    // Legacy ID storage
    localStorage.setItem('anonymousId', newAnonymousId);
    
    // Current app standard
    localStorage.setItem('zenjin_anonymous_id', newAnonymousId);
    
    // For API access and unified approach
    localStorage.setItem('zenjin_user_id', newAnonymousId);
    localStorage.setItem('zenjin_auth_state', 'anonymous');
    
    console.log(`Created new anonymous ID: ${newAnonymousId} and stored in multiple locations`);
  }
  
  // Initialize progress data structure with default values
  const progressData = {
    totalPoints: 0,
    blinkSpeed: 2.5,
    blinkSpeedTrend: 'steady',
    evolution: {
      currentLevel: 'Mind Spark',
      levelNumber: 1,
      progress: 0,
      nextLevel: 'Thought Weaver'
    },
    lastSessionDate: new Date().toISOString()
  };
  
  // Save initial progress data in multiple locations for redundancy
  if (typeof window !== 'undefined') {
    localStorage.setItem(`progressData_${newAnonymousId}`, JSON.stringify(progressData));
    localStorage.setItem('zenjin_anonymous_progress', JSON.stringify(progressData));
    
    // Initialize empty state for tube tracking in unified format
    localStorage.setItem(`zenjin_state_${newAnonymousId}`, JSON.stringify({
      userId: newAnonymousId,
      activeTube: 1,
      tubes: {
        '1': { currentStitchId: '', stitchPositions: [] },
        '2': { currentStitchId: '', stitchPositions: [] },
        '3': { currentStitchId: '', stitchPositions: [] }
      },
      points: {
        session: 0,
        lifetime: 0
      },
      lastUpdated: new Date().toISOString()
    }));
  }
  
  return newAnonymousId;
};

/**
 * Gets the current anonymous user ID or creates a new one if none exists
 * @param forceNew If true, creates a new anonymous ID even if one already exists
 * @returns The anonymous user ID
 */
export const getAnonymousId = (forceNew = false): string => {
  if (typeof window === 'undefined') return '';
  
  // Get existing ID
  const existingId = localStorage.getItem('anonymousId');
  
  // If we have an ID and don't need to force a new one, return it
  if (existingId && !forceNew) {
    return existingId;
  }
  
  // Otherwise create a new ID
  return createAnonymousUser();
};

/**
 * Clears all anonymous user data from localStorage
 * @returns boolean indicating success
 */
export const clearAnonymousData = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    // Get the anonymous ID
    const anonymousId = localStorage.getItem('anonymousId');
    
    // If no ID exists, nothing to clean up
    if (!anonymousId) return true;
    
    // Remove all related data
    localStorage.removeItem('anonymousId');
    localStorage.removeItem(`progressData_${anonymousId}`);
    localStorage.removeItem(`sessionData_${anonymousId}`);
    
    // Remove any other anonymous-related keys (for future-proofing)
    const keysToRemove: string[] = [];
    
    // Find all keys related to this anonymous ID
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes(anonymousId) || key.startsWith('anon-'))) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all found keys
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    return true;
  } catch (error) {
    console.error('Error clearing anonymous data:', error);
    return false;
  }
};

/**
 * Starts a completely fresh anonymous session by clearing all existing data
 * and creating a new anonymous user
 * @returns The new anonymous user ID
 */
export const startFreshAnonymousSession = (): string => {
  if (typeof window === 'undefined') return '';
  
  // In our unified approach, we want to preserve data between anonymous and authenticated users
  // Instead of clearing all existing data, we'll just create a new anonymous user if needed
  // This allows for a seamless transition between anonymous and authenticated states
  
  // Check if we already have an anonymous ID
  const existingId = localStorage.getItem('anonymousId') || localStorage.getItem('zenjin_anonymous_id');
  
  // If we have an existing ID, use it instead of creating a new one
  if (existingId) {
    console.log(`Using existing anonymous ID: ${existingId}`);
    // Store in standard format for consistency
    localStorage.setItem('anonymousId', existingId);
    localStorage.setItem('zenjin_anonymous_id', existingId);
    localStorage.setItem('zenjin_user_id', existingId);
    localStorage.setItem('zenjin_auth_state', 'anonymous');
    return existingId;
  }
  
  // Create a new anonymous user
  return createAnonymousUser();
};

/**
 * Gets anonymous user progress data
 * @param anonymousId The anonymous user ID to get progress for
 * @returns The progress data or null if not found
 */
export const getAnonymousProgressData = (anonymousId?: string): any => {
  if (typeof window === 'undefined') return null;
  
  // Use provided ID or get from localStorage
  const id = anonymousId || localStorage.getItem('anonymousId');
  if (!id) return null;
  
  // Get progress data
  const progressData = localStorage.getItem(`progressData_${id}`);
  
  // Try to parse the progress data
  let parsedData = null;
  try {
    parsedData = progressData ? JSON.parse(progressData) : null;
  } catch (e) {
    console.error('Error parsing anonymous progress data:', e);
    return null;
  }
  
  // Check for legacy format (with zenjin_anonymous_progress)
  if (!parsedData) {
    try {
      const legacyData = localStorage.getItem('zenjin_anonymous_progress');
      if (legacyData) {
        console.log('Found legacy anonymous progress data format');
        parsedData = JSON.parse(legacyData);
      }
    } catch (e) {
      console.error('Error parsing legacy anonymous progress data:', e);
    }
  }
  
  // Ensure it has the expected shape
  if (parsedData) {
    // Add default values for any missing properties
    return {
      totalPoints: parsedData.totalPoints || 0,
      blinkSpeed: parsedData.blinkSpeed || 2.5,
      blinkSpeedTrend: parsedData.blinkSpeedTrend || 'steady',
      evolution: parsedData.evolution || {
        currentLevel: 'Mind Spark',
        levelNumber: 1,
        progress: 0,
        nextLevel: 'Thought Weaver'
      },
      lastSessionDate: parsedData.lastSessionDate || new Date().toISOString()
    };
  }
  
  return null;
};

/**
 * Checks if any anonymous session data exists in localStorage
 * In our unified approach, we check multiple storage locations
 * @returns boolean indicating if anonymous data exists
 */
export const hasAnonymousData = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Check all possible ID locations
  const anonymousId = 
    localStorage.getItem('anonymousId') || 
    localStorage.getItem('zenjin_anonymous_id');
  
  if (!anonymousId) return false;
  
  // Check for either type of state data
  const hasStateData = 
    localStorage.getItem(`progressData_${anonymousId}`) !== null ||
    localStorage.getItem(`zenjin_state_${anonymousId}`) !== null ||
    localStorage.getItem('zenjin_anonymous_progress') !== null;
  
  return hasStateData;
};