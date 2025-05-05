/**
 * User data loading utility
 * 
 * This centralizes the loading of all user-specific data needed for the application.
 * It ensures that tube configurations, active stitches, and progress data are all
 * loaded in a clean, predictable sequence.
 */

export async function loadUserData(userId: string) {
  try {
    console.log(`Loading essential data for user ${userId}`);
    
    // Get auth headers if available
    let headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store'
    };
    
    // Try to get stored auth headers
    try {
      const storedHeaders = localStorage.getItem('zenjin_auth_headers');
      if (storedHeaders) {
        headers = JSON.parse(storedHeaders);
      }
      
      // Always include user ID and auth state headers
      if (userId) {
        headers['X-User-ID'] = userId;
      }
      
      // Add auth state header - this helps APIs determine if this is an authenticated or anonymous request
      const authState = localStorage.getItem('zenjin_auth_state') || 'anonymous';
      headers['X-Zenjin-Auth-State'] = authState;
      
      console.log(`Loading user data with auth state: ${authState}`);
    } catch (e) {
      console.warn('Failed to parse auth headers from localStorage', e);
    }
    
    // Load tube configurations
    console.log('Step 1: Loading tube configuration');
    
    // For authenticated users, ensure we're not sending the isAnonymous flag
    const authState = localStorage.getItem('zenjin_auth_state');
    const queryParams = new URLSearchParams();
    queryParams.append('prefetch', '10');
    
    if (userId) {
      queryParams.append('userId', userId);
      // Only include isAnonymous flag if we're actually anonymous
      if (authState === 'anonymous' || userId.startsWith('anonymous-')) {
        queryParams.append('isAnonymous', 'true');
      }
    }
    
    // Log the API request for debugging
    console.log(`API Request: /api/user-stitches?${queryParams.toString()}`);
    console.log('Headers:', JSON.stringify(headers));
    
    const tubeConfigRes = await fetch(`/api/user-stitches?${queryParams.toString()}`, {
      method: 'GET',
      headers: headers,
      credentials: 'include'
    });
    
    if (!tubeConfigRes.ok) {
      console.error('Failed to load tube configuration:', tubeConfigRes.status);
      throw new Error('Failed to load tube configuration');
    }
    
    const tubeConfigData = await tubeConfigRes.json();
    console.log('Tube configuration loaded successfully');
    
    // Load user progress data
    console.log('Step 2: Loading user progress data');
    
    // Create query params for progress API
    const progressQueryParams = new URLSearchParams();
    
    if (userId) {
      progressQueryParams.append('userId', userId);
      // Only include isAnonymous flag if we're actually anonymous
      if (authState === 'anonymous' || userId.startsWith('anonymous-')) {
        progressQueryParams.append('isAnonymous', 'true');
      }
    }
    
    // Log the API request for debugging
    console.log(`API Request: /api/user-progress?${progressQueryParams.toString()}`);
    
    const progressRes = await fetch(`/api/user-progress?${progressQueryParams.toString()}`, {
      method: 'GET',
      headers: headers,
      credentials: 'include'
    });
    
    let progressData = null;
    if (progressRes.ok) {
      progressData = await progressRes.json();
      console.log('User progress loaded successfully');
    } else {
      console.warn('No existing progress data found, using defaults');
      progressData = {
        totalPoints: 0,
        blinkSpeed: 0,
        evolution: {
          level: 1,
          name: 'Mind Spark',
          progress: 0
        }
      };
    }
    
    // Store in localStorage for offline use
    console.log('Step 3: Storing data in localStorage for offline use');
    localStorage.setItem('zenjin_tube_data', JSON.stringify(tubeConfigData));
    localStorage.setItem('zenjin_user_progress', JSON.stringify(progressData));
    localStorage.setItem('zenjin_data_timestamp', Date.now().toString());
    
    // Store user ID for offline mode
    localStorage.setItem('zenjin_user_id', userId);
    localStorage.setItem('zenjin_auth_state', 'authenticated');
    
    console.log('All user data loaded and cached successfully');
    
    return { 
      tubeData: tubeConfigData,
      progressData,
      dataTimestamp: Date.now()
    };
  } catch (error) {
    console.error('Error loading user data:', error);
    throw error;
  }
}

/**
 * Check if cached user data is available
 */
export function hasLocalUserData(): boolean {
  const tubeData = localStorage.getItem('zenjin_tube_data');
  const progressData = localStorage.getItem('zenjin_user_progress');
  return !!tubeData && !!progressData;
}

/**
 * Get cached user data from localStorage
 */
export function getLocalUserData() {
  try {
    const tubeData = localStorage.getItem('zenjin_tube_data');
    const progressData = localStorage.getItem('zenjin_user_progress');
    const dataTimestamp = localStorage.getItem('zenjin_data_timestamp');
    
    if (!tubeData || !progressData) {
      return null;
    }
    
    return {
      tubeData: JSON.parse(tubeData),
      progressData: JSON.parse(progressData),
      dataTimestamp: dataTimestamp ? parseInt(dataTimestamp) : Date.now()
    };
  } catch (error) {
    console.error('Error retrieving local user data:', error);
    return null;
  }
}

/**
 * Clear user data from localStorage
 */
export function clearUserData() {
  localStorage.removeItem('zenjin_tube_data');
  localStorage.removeItem('zenjin_user_progress');
  localStorage.removeItem('zenjin_data_timestamp');
}