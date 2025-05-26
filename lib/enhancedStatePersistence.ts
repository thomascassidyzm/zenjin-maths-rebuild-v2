/**
 * Enhanced State Persistence Module
 * 
 * This module provides improved state persistence functionality with better error handling,
 * retry logic, and diagnostics to ensure stitch positions are properly saved.
 */

// Method to save state with better error handling and logging
// This function now uses the new /api/sync-user-state endpoint.
// The `userId` argument is kept for consistency or potential future use, but the API
// derives user from the session. The `state` argument should conform to the UserState interface.
export async function saveStateWithRetry(
  userId: string, // May become redundant if API strictly uses session user. For logging/consistency now.
  state: any, // Should be the UserState object: { userInformation, tubeState, learningProgress }
  maxRetries: number = 3
): Promise<boolean> {
  console.log(`🔄 Saving state for user ${userId} with enhanced retry logic using /api/sync-user-state...`);
  
  let lastError: Error | null = null;
  
  // The payload should be the state itself, matching the UserState interface.
  // The API expects { userInformation, tubeState, learningProgress }
  // Ensure the passed 'state' object conforms to this.
  // If 'state' comes from appStore.get(), it might contain extra fields like 'lastUpdated', 'isInitialized'.
  // These should be stripped if not part of the UserState interface for the backend.
  // For now, we assume 'state' is already a clean UserState object.
  const payload = {
    userInformation: state.userInformation || {},
    tubeState: state.tubeState || { tubes: [], activeTube: null },
    learningProgress: state.learningProgress || {},
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} to save state for user ${userId}`);
      
      const response = await fetch('/api/sync-user-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Cache-Control': 'no-cache, no-store' // May not be necessary, server should control caching.
          // Authorization header is handled by Supabase client SDK.
        },
        body: JSON.stringify(payload) // Send the structured state
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        const errorDetails = response.headers.get('content-type')?.includes('application/json') ? JSON.parse(errorText) : errorText;
        console.error(`Attempt ${attempt} failed: Server returned error ${response.status}. Details:`, errorDetails);
        lastError = new Error(`Server error ${response.status}: ${typeof errorDetails === 'string' ? errorDetails : errorDetails?.error || JSON.stringify(errorDetails)}`);
        // Continue to next retry for server errors (5xx) or specific client errors (e.g., 429)
        // For other client errors (400, 401, 403), retrying might not help.
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            console.warn(`Client-side error ${response.status}. Not retrying.`);
            break; // Don't retry for most client-side errors like bad request or unauthorized
        }
        // For other errors, especially 5xx, proceed to retry.
      } else {
        const data = await response.json();
        if (data.success) {
          console.log(`✅ Attempt ${attempt}: Successfully saved state for user ${userId} via /api/sync-user-state.`);
          return true;
        } else {
          console.error(`Attempt ${attempt}: Server reported save was not successful. Response:`, data);
          lastError = new Error(`Server reported save failure: ${data.error || JSON.stringify(data)}`);
          // If server explicitly says not successful, it might be a data issue, consider not retrying.
          // For this example, we'll retry as it could be a transient issue with the RPC.
        }
      }
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed with exception for user ${userId}:`, error.message || error);
    }
    
    // If not the last attempt, wait before retrying
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // Exponential backoff
      console.log(`Waiting ${delay}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error(`❌ All ${maxRetries} attempts failed to save state for user ${userId}. Last error:`, lastError?.message || lastError);
  
  // Save to localStorage as a backup
  try {
    localStorage.setItem(`zenjin_state_backup_${userId}`, JSON.stringify({
      timestamp: new Date().toISOString(),
      state: payload, // Save the payload that was attempted
      reason: `Failed to sync after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`,
    }));
    console.log(`💾 Saved state backup to localStorage for user ${userId}`);
  } catch (localStorageError: any) {
    console.error(`Failed to save backup to localStorage for user ${userId}:`, localStorageError.message || localStorageError);
  }
  
  return false;
}

// Function to diagnose state persistence issues
export async function diagnoseStatePersistence(userId: string): Promise<any> {
  try {
    console.log('🔍 Running state persistence diagnostics...');
    
    // Check if user_stitch_progress table exists and has expected columns
    const schemaResponse = await fetch('/api/check-table-structure?table=user_stitch_progress');
    const schemaData = await schemaResponse.json();
    
    // Check for user's saved stitch positions
    const positionsResponse = await fetch(`/api/user-stitches?userId=${userId}&prefetch=10`);
    const positionsData = await positionsResponse.json();
    
    // Check for user's complete state
    const stateResponse = await fetch(`/api/user-state?userId=${userId}`);
    const stateData = await stateResponse.json();
    
    return {
      success: true,
      schema: schemaData,
      positions: positionsData,
      state: stateData,
      summary: {
        schemaOk: schemaData?.success || false,
        hasSavedPositions: positionsData?.data?.length > 0,
        hasSavedState: stateData?.data?.state != null,
        missingColumns: schemaData?.missingColumns || []
      }
    };
  } catch (error) {
    console.error('Diagnostics failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Function to correct stitches for a user - use this if state loading fails
export async function correctStitchPositions(userId: string): Promise<boolean> {
  try {
    console.log('🛠️ Correcting stitch positions...');
    
    // Request the server to reset and correct stitch positions
    const response = await fetch('/api/reset-stitch-positions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to correct stitch positions: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Stitch position correction complete:', data);
    
    return data.success;
  } catch (error) {
    console.error('❌ Stitch position correction failed:', error);
    return false;
  }
}