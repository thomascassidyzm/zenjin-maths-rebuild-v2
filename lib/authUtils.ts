/**
 * Authentication Utilities
 * 
 * This file contains helper functions for handling authentication transitions and
 * ensuring consistent behavior between anonymous and authenticated states.
 */

/**
 * Cleans up anonymous user data from localStorage after authentication
 * This should be called after a user authenticates to prevent conflicts
 */
export function cleanupAnonymousData() {
  if (typeof window === 'undefined') return;
  
  console.log('AuthUtils: Cleaning up anonymous data after authentication');
  
  // Store the authenticated user ID before cleanup
  const authenticatedUserId = localStorage.getItem('zenjin_user_id');
  
  // Get all potential anonymous IDs
  const anonymousId = localStorage.getItem('anonymousId');
  const zenjinanonId = localStorage.getItem('zenjin_anonymous_id');
  
  // Define all anonymous related keys that should be removed
  const anonymousKeys = [
    // User identification
    'anonymousId',
    'zenjin_anonymous_id',
    'zenjin_auth_state',
    
    // Progress data keys
    'zenjin_anonymous_progress',
  ];
  
  // Add any dynamic keys based on anonymousId
  if (anonymousId) {
    anonymousKeys.push(`progressData_${anonymousId}`);
  }
  
  if (zenjinanonId) {
    anonymousKeys.push(`progressData_${zenjinanonId}`);
  }
  
  // Get all localStorage keys
  const allKeys = Object.keys(localStorage);
  
  // Find any keys that relate to anonymous data
  const dynamicAnonymousKeys = allKeys.filter(key => 
    key.startsWith('progressData_anonymous') || 
    key.includes('anonymous') ||
    key.startsWith('anon_')
  );
  
  // Combine with our predefined keys
  const allAnonymousKeys = [...new Set([...anonymousKeys, ...dynamicAnonymousKeys])];
  
  // Remove all anonymous data
  allAnonymousKeys.forEach(key => {
    try {
      localStorage.removeItem(key);
      console.log(`AuthUtils: Removed ${key} from localStorage`);
    } catch (e) {
      console.error(`AuthUtils: Error removing ${key} from localStorage:`, e);
    }
  });
  
  // Restore the authenticated user ID if it was removed
  if (authenticatedUserId) {
    localStorage.setItem('zenjin_user_id', authenticatedUserId);
    localStorage.setItem('zenjin_auth_state', 'authenticated');
  }
  
  // Force a cache refresh on user data
  localStorage.setItem('zenjin_data_timestamp', Date.now().toString());
  
  console.log('AuthUtils: Anonymous data cleanup complete');
}

/**
 * Ensures API requests have the correct authentication headers
 * @param options Fetch options to enhance with auth headers
 * @returns Enhanced fetch options with auth headers
 */
export function withAuthHeaders(options: RequestInit = {}): RequestInit {
  const headers = new Headers(options.headers || {});
  
  // Set default content type if not already set
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  // First check for stored auth headers (from a previous session)
  const storedAuthHeaders = localStorage.getItem('zenjin_auth_headers');
  if (storedAuthHeaders) {
    try {
      const parsedHeaders = JSON.parse(storedAuthHeaders);
      // Add authorization if available
      if (parsedHeaders.Authorization) {
        headers.set('Authorization', parsedHeaders.Authorization);
      }
    } catch (e) {
      console.error('AuthUtils: Error parsing stored auth headers:', e);
    }
  }
  
  // Add auth state information
  const authState = localStorage.getItem('zenjin_auth_state');
  if (authState) {
    headers.set('X-Zenjin-Auth-State', authState);
  }
  
  // Add user ID based on auth state
  if (authState === 'authenticated') {
    const userId = localStorage.getItem('zenjin_user_id');
    if (userId) {
      headers.set('X-Zenjin-User-Id', userId);
    }
  } else if (authState === 'anonymous') {
    const anonymousId = localStorage.getItem('zenjin_anonymous_id') || localStorage.getItem('anonymousId');
    if (anonymousId) {
      headers.set('X-Zenjin-Anonymous-Id', anonymousId);
    }
  }
  
  // Return enhanced options
  return {
    ...options,
    headers,
    credentials: 'include', // Always include credentials
  };
}

/**
 * Helper to make authenticated API calls
 * @param endpoint API endpoint to call
 * @param options Fetch options
 * @returns Response from the API
 */
export async function callAuthenticatedApi(
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> {
  const enhancedOptions = withAuthHeaders(options);
  
  // Log the API call for debugging
  console.log(`AuthUtils: Calling authenticated API ${endpoint}`);
  
  try {
    const response = await fetch(endpoint, enhancedOptions);
    
    if (!response.ok) {
      console.error(`AuthUtils: API call to ${endpoint} failed with status ${response.status}`);
      
      // Attempt to get error details
      try {
        const errorData = await response.json();
        console.error('AuthUtils: API error details:', errorData);
      } catch (e) {
        // Error response wasn't JSON
        console.error('AuthUtils: API error response:', await response.text());
      }
    }
    
    return response;
  } catch (error) {
    console.error(`AuthUtils: Exception calling API ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Checks if local storage contains anonymous user data
 * @returns Whether anonymous data exists
 */
export function hasAnonymousData(): boolean {
  if (typeof window === 'undefined') return false;
  
  const anonymousId = localStorage.getItem('anonymousId') || localStorage.getItem('zenjin_anonymous_id');
  const anonymousProgress = localStorage.getItem('zenjin_anonymous_progress');
  
  // Also check for any progress data keys
  const progressKey = anonymousId ? `progressData_${anonymousId}` : null;
  const hasProgressData = progressKey ? localStorage.getItem(progressKey) !== null : false;
  
  return !!(anonymousId && (anonymousProgress || hasProgressData));
}

/**
 * Extracts anonymous data from localStorage
 * @returns Object containing anonymous user data
 */
export function getAnonymousData(): any {
  if (typeof window === 'undefined') return null;
  
  // Get the anonymous ID
  const anonymousId = localStorage.getItem('anonymousId') || localStorage.getItem('zenjin_anonymous_id');
  
  if (!anonymousId) return null;
  
  // Collect various data sources
  let anonymousData: any = { tubes: {} };
  
  // Try multiple possible storage locations
  const progressDataKey = `progressData_${anonymousId}`;
  const anonymousProgress = localStorage.getItem('zenjin_anonymous_progress');
  const specificProgress = localStorage.getItem(progressDataKey);
  
  // Get tube data if available
  const tubeData = localStorage.getItem('zenjin_tube_data');
  
  // Parse data from localStorage
  try {
    if (specificProgress) {
      const parsed = JSON.parse(specificProgress);
      anonymousData = {
        ...anonymousData,
        ...parsed,
        totalPoints: parsed.totalPoints || 0,
      };
    } else if (anonymousProgress) {
      const parsed = JSON.parse(anonymousProgress);
      anonymousData = {
        ...anonymousData,
        ...parsed,
        totalPoints: parsed.totalPoints || 0,
      };
    }
    
    // Add tube data if available
    if (tubeData) {
      anonymousData.tubes = JSON.parse(tubeData);
    }
  } catch (e) {
    console.error('AuthUtils: Error parsing anonymous data:', e);
  }
  
  return anonymousData;
}

/**
 * Transfers anonymous data to an authenticated user
 * @param userId Authenticated user ID to transfer data to
 * @returns Promise with the transfer result
 */
export async function transferAnonymousDataToUser(userId: string): Promise<boolean> {
  try {
    console.log('AuthUtils: Transferring anonymous data to user', userId);
    
    // Check if we have anonymous data to transfer
    if (!hasAnonymousData()) {
      console.log('AuthUtils: No anonymous data to transfer');
      return false;
    }
    
    // Collect anonymous data
    const anonymousData = getAnonymousData();
    
    if (!anonymousData || Object.keys(anonymousData).length === 0) {
      console.log('AuthUtils: No valid anonymous data found');
      return false;
    }
    
    // Call the transfer API
    const response = await callAuthenticatedApi('/api/transfer-anonymous-data', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        anonymousData
      })
    });
    
    if (response.ok) {
      console.log('AuthUtils: Anonymous data transferred successfully');
      return true;
    } else {
      console.error('AuthUtils: Failed to transfer anonymous data:', await response.text());
      return false;
    }
  } catch (error) {
    console.error('AuthUtils: Error transferring anonymous data:', error);
    return false;
  }
}