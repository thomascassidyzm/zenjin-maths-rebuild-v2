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
    
    // Load tube configurations
    console.log('Step 1: Loading tube configuration');
    const tubeConfigRes = await fetch('/api/user-stitches?prefetch=10', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      },
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
    const progressRes = await fetch('/api/user-progress', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      },
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