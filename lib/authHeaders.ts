/**
 * Authentication headers utility
 * 
 * Provides consistent auth headers for API requests across the application.
 */

/**
 * Get authentication headers for API requests
 * Ensures proper authorization is included based on the current auth state
 */
export function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {
      'Content-Type': 'application/json'
    };
  }
  
  // Check for stored auth headers first
  try {
    const storedHeaders = localStorage.getItem('zenjin_auth_headers');
    if (storedHeaders) {
      return JSON.parse(storedHeaders);
    }
  } catch (e) {
    console.warn('Failed to parse auth headers from localStorage', e);
  }
  
  // Get auth state and user ID
  const authState = localStorage.getItem('zenjin_auth_state');
  const userId = localStorage.getItem('zenjin_user_id');
  
  // Basic headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store'
  };
  
  // Add user identification if available
  if (userId) {
    headers['X-User-ID'] = userId;
  }
  
  // Add auth state if available
  if (authState) {
    headers['X-Auth-State'] = authState;
  }
  
  return headers;
}

/**
 * Create fetch options with proper authentication headers
 */
export function createAuthFetchOptions(
  method: string = 'GET', 
  body?: any
): RequestInit {
  const options: RequestInit = {
    method,
    headers: getAuthHeaders(),
    credentials: 'include'
  };
  
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  return options;
}

/**
 * Helper for making authenticated API calls
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const fetchOptions = options || createAuthFetchOptions();
  
  // Ensure headers include auth information
  if (!options?.headers) {
    fetchOptions.headers = getAuthHeaders();
  }
  
  // Always include credentials
  fetchOptions.credentials = 'include';
  
  return fetch(url, fetchOptions);
}