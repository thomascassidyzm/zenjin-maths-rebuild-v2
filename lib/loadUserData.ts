/**
 * User data loading utility
 * 
 * This centralizes the loading of all user-specific data needed for the application.
 * It ensures that tube configurations, active stitches, and progress data are all
 * loaded in a clean, predictable sequence.
 */

export async function loadUserData(userId: string) {
  try {
    // CRITICAL FIX: Safety check and recovery for empty userId
    if (!userId || userId === '') {
      console.error('CRITICAL ERROR: Empty userId provided to loadUserData');
      
      // Try to recover from localStorage
      if (typeof window !== 'undefined') {
        const storedUserId = localStorage.getItem('zenjin_user_id');
        if (storedUserId && storedUserId !== '') {
          console.log(`CRITICAL RECOVERY: Using userId ${storedUserId} from localStorage instead of empty value`);
          userId = storedUserId;
          
          // Save to window.__CURRENT_USER_ID__
          (window as any).__CURRENT_USER_ID__ = userId;
        } else {
          // Check Supabase token as a fallback
          try {
            const supabaseToken = localStorage.getItem('sb-ggwoupzaruiaaliylxga-auth-token');
            if (supabaseToken) {
              const parsedToken = JSON.parse(supabaseToken);
              if (parsedToken?.user?.id) {
                userId = parsedToken.user.id;
                console.log(`CRITICAL RECOVERY: Using userId ${userId} from Supabase token`);
                
                // Save to localStorage
                localStorage.setItem('zenjin_user_id', userId);
                
                // Save to window.__CURRENT_USER_ID__
                (window as any).__CURRENT_USER_ID__ = userId;
              }
            }
          } catch (e) {
            console.error('Error parsing Supabase token:', e);
          }
        }
        
        // If still no userId, generate an anonymous one as last resort
        if (!userId || userId === '') {
          userId = `anonymous-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
          console.log(`CRITICAL RECOVERY: Generated new anonymous ID ${userId} as last resort`);
          
          // Save to localStorage
          localStorage.setItem('zenjin_user_id', userId);
          
          // Save to window.__CURRENT_USER_ID__
          (window as any).__CURRENT_USER_ID__ = userId;
        }
      }
    }
    
    console.log(`Loading essential data for user ${userId}`);
    
    // Import our authUtils helper functions
    const { withAuthHeaders, callAuthenticatedApi } = await import('./authUtils');
    
    // For authenticated users, ensure we're not sending the isAnonymous flag
    const authState = localStorage.getItem('zenjin_auth_state');
    
    // Load tube configurations
    console.log('Step 1: Loading tube configuration (lightweight version)');
    
    // Create query parameters - NO NEED for prefetch parameter anymore
    // The API has been simplified to only return position data for free tier users
    const queryParams = new URLSearchParams();
    
    if (userId) {
      queryParams.append('userId', userId);
      // Only include isAnonymous flag if we're actually anonymous
      if (authState === 'anonymous' || userId.startsWith('anonymous-')) {
        queryParams.append('isAnonymous', 'true');
      }
    }
    
    // Log the API request for debugging
    console.log(`API Request: /api/user-stitches?${queryParams.toString()}`);
    
    // Use our helper function that ensures relative URLs and adds cache busting
    const tubeConfigRes = await callAuthenticatedApi(`/api/user-stitches?${queryParams.toString()}`, {
      method: 'GET'
    });
    
    if (!tubeConfigRes.ok) {
      console.error('Failed to load tube configuration:', tubeConfigRes.status);
      throw new Error('Failed to load tube configuration');
    }
    
    const tubeConfigData = await tubeConfigRes.json();
    console.log('Tube configuration loaded successfully (lightweight version)');
    
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
    
    // Use our helper function that ensures relative URLs
    const progressRes = await callAuthenticatedApi(`/api/user-progress?${progressQueryParams.toString()}`, {
      method: 'GET'
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