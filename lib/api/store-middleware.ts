/**
 * Zustand Store API Middleware
 * 
 * This module provides middleware functions to ensure all API calls 
 * related to state go through the Zustand store. This creates a
 * single source of truth for state management.
 */
import { callAuthenticatedApi } from '../authUtils';
import { useZenjinStore } from '../store/zenjinStore';

/**
 * Ensures all state interactions flow through the Zustand store
 * rather than direct API calls.
 * 
 * @param storeUpdater - Function that updates the Zustand store
 * @param opts - Options for customizing the update behavior
 */
export async function withStoreSync<T>(
  storeUpdater: () => Promise<T>,
  opts: {
    syncToServer?: boolean;
    loadFromServer?: boolean;
    allowDirectApiCalls?: boolean; // For migration period only
  } = { syncToServer: true, allowDirectApiCalls: false }
): Promise<T> {
  try {
    console.log('store-middleware: withStoreSync called with options:', opts);
    
    // First, if loadFromServer is requested, load latest data
    if (opts.loadFromServer) {
      console.log('store-middleware: Loading latest state from server before update');
      const userId = useZenjinStore.getState().userInformation?.userId;
      
      if (userId) {
        // Use the store's built-in loadFromServer method
        await useZenjinStore.getState().loadFromServer(userId);
      }
    }
    
    // Execute the actual store updates
    const result = await storeUpdater();
    
    // After updating store, sync changes to server if requested
    if (opts.syncToServer) {
      console.log('store-middleware: Syncing updated state to server');
      
      // Use the store's built-in syncToServer method
      await useZenjinStore.getState().syncToServer();
    }
    
    return result;
  } catch (error) {
    console.error('store-middleware: Error in withStoreSync:', error);
    throw error;
  }
}

/**
 * DEPRECATED: Direct API call to user-state endpoint.
 * This function is kept temporarily for backwards compatibility
 * but will log warnings.
 */
export async function directUserStateCall(
  method: 'GET' | 'POST', 
  data: any, 
  bypassWarnings: boolean = false
): Promise<any> {
  if (!bypassWarnings) {
    console.warn('⚠️ DEPRECATED: Direct API call to user-state detected. Please use Zustand store instead.');
    console.warn('⚠️ Consider updating your code to use useZenjinStore().syncToServer() instead of direct API calls.');
  }
  
  try {
    // For GET requests
    if (method === 'GET') {
      const userId = data?.userId || useZenjinStore.getState().userInformation?.userId;
      
      if (!userId) {
        throw new Error('No userId provided for GET request');
      }
      
      const response = await callAuthenticatedApi(`/api/user-state?userId=${userId}`);
      const result = await response.json();
      
      // If successful, update Zustand with the retrieved data to keep in sync
      if (result.success && result.state) {
        console.log('store-middleware: Updating Zustand store with retrieved data');
        useZenjinStore.getState().setState(result.state);
      }
      
      return result;
    }
    
    // For POST requests
    if (method === 'POST') {
      // Get current optimized state from Zustand
      const optimizedState = useZenjinStore.getState().extractMinimalState(
        useZenjinStore.getState()
      );
      
      // Merge with provided data
      const mergedData = {
        ...optimizedState,
        ...data,
        // Ensure userId is consistent
        userId: data?.userId || optimizedState?.userId || useZenjinStore.getState().userInformation?.userId
      };
      
      const response = await callAuthenticatedApi('/api/user-state', {
        method: 'POST',
        body: JSON.stringify({ state: mergedData })
      });
      
      return await response.json();
    }
    
    throw new Error(`Unsupported method: ${method}`);
  } catch (error) {
    console.error('store-middleware: Error in directUserStateCall:', error);
    throw error;
  }
}

/**
 * Hook to monitor deprecated API calls that bypass Zustand.
 * This can be used as a temporary measure during the transition period.
 */
export function initializeApiMonitoring() {
  // In a more sophisticated implementation, this could patch fetch/XMLHttpRequest
  // to intercept and log direct calls to state-related endpoints
  
  console.log('store-middleware: API monitoring initialized');
  
  // Record that monitoring is active
  if (typeof window !== 'undefined') {
    window.__ZUSTAND_API_MONITOR_ACTIVE = true;
  }
  
  return {
    isActive: true,
    disableMonitoring: () => {
      if (typeof window !== 'undefined') {
        window.__ZUSTAND_API_MONITOR_ACTIVE = false;
      }
    }
  };
}