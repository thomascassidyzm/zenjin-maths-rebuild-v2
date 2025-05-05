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
  
  // Preserve authenticated state
  const authenticatedUserId = localStorage.getItem('zenjin_user_id');
  const authHeaders = localStorage.getItem('zenjin_auth_headers');
  
  // Check if transfer is in progress - if so, don't cleanup yet
  if (localStorage.getItem('zenjin_auth_transfer_in_progress') === 'true') {
    console.log('AuthUtils: Transfer in progress - delaying cleanup');
    
    // If the flag has been set for more than 10 seconds, it's likely stuck
    const transferStartTime = parseInt(localStorage.getItem('zenjin_auth_transfer_start_time') || '0');
    const currentTime = Date.now();
    if (transferStartTime > 0 && (currentTime - transferStartTime > 10000)) {
      console.log('AuthUtils: Transfer flag appears stuck - clearing it');
      localStorage.removeItem('zenjin_auth_transfer_in_progress');
      localStorage.removeItem('zenjin_auth_transfer_start_time');
    } else {
      return;
    }
  } else {
    // Set a timestamp to track how long the transfer flag has been set
    localStorage.setItem('zenjin_auth_transfer_start_time', Date.now().toString());
  }
  
  // Get all potential anonymous IDs
  const anonymousId = localStorage.getItem('anonymousId');
  const zenjinanonId = localStorage.getItem('zenjin_anonymous_id');
  
  // Define all anonymous related keys that should be removed
  const anonymousKeys = [
    // User identification
    'anonymousId',
    'zenjin_anonymous_id',
    
    // Progress data keys
    'zenjin_anonymous_progress',
    'zenjin_anonymous_state',
    'zenjin_auth_transfer_in_progress',
  ];
  
  // Add any dynamic keys based on anonymousId
  if (anonymousId) {
    anonymousKeys.push(`progressData_${anonymousId}`);
    anonymousKeys.push(`zenjin_state_${anonymousId}`);
    anonymousKeys.push(`triple_helix_state_${anonymousId}`);
    anonymousKeys.push(`sessionData_${anonymousId}`);
  }
  
  if (zenjinanonId && zenjinanonId !== anonymousId) {
    anonymousKeys.push(`progressData_${zenjinanonId}`);
    anonymousKeys.push(`zenjin_state_${zenjinanonId}`);
    anonymousKeys.push(`triple_helix_state_${zenjinanonId}`);
    anonymousKeys.push(`sessionData_${zenjinanonId}`);
  }
  
  // Get all localStorage keys
  const allKeys = Object.keys(localStorage);
  
  // Find any keys that relate to anonymous data (use broad patterns to catch all)
  const dynamicAnonymousKeys = allKeys.filter(key => 
    key.startsWith('progressData_anonymous') || 
    key.includes('anonymous') ||
    key.startsWith('anon_') ||
    key.includes('_anonymous_') ||
    (anonymousId && key.includes(anonymousId)) ||
    (zenjinanonId && key.includes(zenjinanonId))
  );
  
  // Combine with our predefined keys and remove duplicates
  const allAnonymousKeys = [...new Set([...anonymousKeys, ...dynamicAnonymousKeys])];
  
  // Remove all anonymous data
  allAnonymousKeys.forEach(key => {
    // Skip explicitly authenticated keys
    if (key === 'zenjin_user_id' || key === 'zenjin_auth_headers') {
      return;
    }
    
    try {
      localStorage.removeItem(key);
      console.log(`AuthUtils: Removed ${key} from localStorage`);
    } catch (e) {
      console.error(`AuthUtils: Error removing ${key} from localStorage:`, e);
    }
  });
  
  // Restore the authenticated user state
  if (authenticatedUserId) {
    localStorage.setItem('zenjin_user_id', authenticatedUserId);
    localStorage.setItem('zenjin_auth_state', 'authenticated');
  }
  
  // Restore auth headers
  if (authHeaders) {
    localStorage.setItem('zenjin_auth_headers', authHeaders);
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
  
  // Ensure endpoint uses relative paths to avoid service worker URL transformation issues
  let apiEndpoint = endpoint;
  
  // If the endpoint starts with http or https, make it relative
  if (apiEndpoint.startsWith('http')) {
    try {
      const url = new URL(apiEndpoint);
      // Only modify our own domain URLs
      if (url.hostname === 'maths.zenjin.cymru' || 
          url.hostname === 'zenjin-maths-v1-zenjin.vercel.app') {
        // Convert to relative URL
        apiEndpoint = url.pathname + url.search;
        console.log(`AuthUtils: Converted absolute URL to relative: ${apiEndpoint}`);
      }
    } catch (e) {
      console.error('AuthUtils: Error parsing URL:', e);
    }
  }
  
  // Log the API call for debugging
  console.log(`AuthUtils: Calling authenticated API ${apiEndpoint}`);
  
  try {
    // Add a cache-busting parameter to avoid service worker caching
    const cacheBuster = `_cb=${Date.now()}`;
    const separator = apiEndpoint.includes('?') ? '&' : '?';
    const urlWithCacheBuster = `${apiEndpoint}${separator}${cacheBuster}`;
    
    const response = await fetch(urlWithCacheBuster, enhancedOptions);
    
    if (!response.ok) {
      console.error(`AuthUtils: API call to ${apiEndpoint} failed with status ${response.status}`);
      
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
    console.error(`AuthUtils: Exception calling API ${apiEndpoint}:`, error);
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
 * This leverages the existing transferAnonymousData function in supabaseClient.ts
 * 
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
    
    // Import the function from supabaseClient (using dynamic import to avoid circular dependencies)
    const { transferAnonymousData } = await import('./auth/supabaseClient');
    
    // Call the existing implementation that has been tested in production
    const result = await transferAnonymousData(userId);
    
    if (result) {
      console.log('AuthUtils: Anonymous data transferred successfully');
      return true;
    } else {
      console.error('AuthUtils: Failed to transfer anonymous data');
      return false;
    }
  } catch (error) {
    console.error('AuthUtils: Error transferring anonymous data:', error);
    return false;
  }
}