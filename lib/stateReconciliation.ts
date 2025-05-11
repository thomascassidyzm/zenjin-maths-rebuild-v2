/**
 * State Reconciliation Utilities
 * 
 * This module provides functions to reconcile state between localStorage and server,
 * ensuring data persistence even if server syncs fail.
 */

// Function to check for pending state backups in localStorage
export function checkForPendingStateBackup(): {
  hasPendingBackup: boolean;
  backupTimestamp: number | null;
  userId: string | null;
} {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return { hasPendingBackup: false, backupTimestamp: null, userId: null };
  }
  
  try {
    // Check if we have a pending backup flag
    const hasPendingBackup = localStorage.getItem('zenjin_pending_state_backup') === 'true';
    
    // Get backup timestamp if available
    const backupTimestampStr = localStorage.getItem('zenjin_state_backup_time');
    const backupTimestamp = backupTimestampStr ? parseInt(backupTimestampStr, 10) : null;
    
    // Get userId from localStorage
    const userId = localStorage.getItem('zenjin_user_id');
    
    return { hasPendingBackup, backupTimestamp, userId };
  } catch (error) {
    console.error('Error checking for pending state backup:', error);
    return { hasPendingBackup: false, backupTimestamp: null, userId: null };
  }
}

// Function to clear pending state backup markers
export function clearPendingStateBackup(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem('zenjin_pending_state_backup');
    localStorage.removeItem('zenjin_state_backup_time');
    console.log('Cleared pending state backup markers');
  } catch (error) {
    console.error('Error clearing pending state backup markers:', error);
  }
}

// Function to clear localStorage cache after confirming server sync
export function clearLocalStorageCache(userId: string, options = { preserveAnonymous: true }): void {
  if (typeof window === 'undefined') return;
  
  try {
    // Clear the authenticated user state from localStorage
    localStorage.removeItem(`triple_helix_state_${userId}`);
    
    // Only clear anonymous state if explicitly requested
    if (!options.preserveAnonymous) {
      localStorage.removeItem('zenjin_anonymous_state');
    }
    
    // Clear backup markers
    clearPendingStateBackup();
    
    console.log('Successfully cleared local state cache');
  } catch (error) {
    console.error('Error clearing localStorage cache:', error);
  }
}

// Function to try syncing pending state backup to server
export async function syncPendingStateBackupToServer(userId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  try {
    // Get backup state from localStorage
    const backupState = localStorage.getItem(`triple_helix_state_${userId}`) || 
                        localStorage.getItem('backup_complete_state');
    
    if (!backupState) {
      console.log('No pending state backup found in localStorage');
      return false;
    }
    
    // Parse the state
    const parsedState = JSON.parse(backupState);
    const stateData = parsedState.state || parsedState;
    
    // Ensure the userId is correct
    stateData.userId = userId;
    
    // Get auth token if available
    const authToken = getAuthToken();
    
    console.log('Syncing pending state backup to server...');
    
    // Send the state to the server
    const response = await fetch('/api/user-state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({ state: stateData })
    });
    
    if (!response.ok) {
      console.error(`Error syncing pending state: ${response.status}`);
      return false;
    }
    
    console.log('Successfully synced pending state backup to server');
    
    // Clear pending state markers
    clearPendingStateBackup();
    
    // Clear the backup state now that it's been synced
    localStorage.removeItem('backup_complete_state');
    
    return true;
  } catch (error) {
    console.error('Error syncing pending state backup to server:', error);
    return false;
  }
}

// Helper function to get auth token
function getAuthToken(): string | null {
  try {
    // Try to get auth token from multiple possible localStorage keys
    const accessTokenStr = 
      localStorage.getItem('sb-ggwoupzaruiaaliylxga-auth-token') || // New Supabase format
      localStorage.getItem('supabase.auth.token');                  // Older format
    
    if (!accessTokenStr) return null;
    
    try {
      // Parse the JWT if it's in JSON format
      const tokenData = JSON.parse(accessTokenStr);
      if (tokenData?.access_token) {
        return tokenData.access_token;
      }
    } catch {
      // If parsing fails, it might be a direct token string
      return accessTokenStr;
    }
    
    return null;
  } catch {
    return null;
  }
}