import { useAppStore } from './store/appStore'; // Import the Zustand store
import type { UserState } from './store/types'; // Import UserState type, assuming it's defined in store/types

/**
 * User data loading utility
 * 
 * This centralizes the loading of user-specific data using the new /api/sync-user-state endpoint.
 * It fetches the complete user state and initializes the Zustand store.
 */
export async function loadUserData(userId?: string) { // userId might be optional or used for logging
  // The API /api/sync-user-state derives user from session, so explicit userId passing is not strictly for the API call.
  // It can be useful for logging or if client context about the user is needed before the call.
  console.log(`🚀 Loading user data for user: ${userId || 'current session user'}`);

  try {
    // Make a single GET request to /api/core_state_sync_v1
    // Assumes that the browser will send the necessary authentication cookies.
    const response = await fetch('/api/core_state_sync_v1', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Supabase client SDK usually handles Authorization header if this fetch is wrapped or configured.
        // For direct fetch to a Next.js API route using auth-helpers, cookies are the primary auth mechanism.
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to load user state from /api/core_state_sync_v1: ${response.status}`, errorText);
      // Depending on status, different actions can be taken.
      // e.g. 401 might mean user is not logged in.
      if (response.status === 401) {
        console.warn('User is not authenticated. Cannot load data.');
        // Potentially clear store or redirect to login
        // useAppStore.getState().resetState(); // Example if a reset action exists
      }
      throw new Error(`Failed to load user data: ${response.status} ${errorText}`);
    }

    const loadedState = (await response.json()) as UserState; // Cast to UserState
    console.log('✅ User state loaded successfully from /api/core_state_sync_v1:', loadedState);

    // Hydrate the Zustand store with the loaded state
    if (loadedState) {
      // Ensure the structure of loadedState is compatible with what initializeState expects.
      // The initializeState in appStore.ts takes Partial<AppState>.
      // UserState from API should map to { userInformation, tubeState, learningProgress }
      const appStateToInitialize = {
        userInformation: loadedState.userInformation,
        tubeState: loadedState.tubeState,
        learningProgress: loadedState.learningProgress,
        // lastUpdated and isInitialized will be set by initializeState or store logic
      };
      useAppStore.getState().initializeState(appStateToInitialize);
      console.log('🔄 Zustand store initialized with loaded user state.');
    } else {
      // This case should ideally not be hit if API guarantees a default state.
      console.warn('No state data received from API, or data was null. Initializing with default state.');
      useAppStore.getState().initializeState({}); // Initialize with empty/default if needed
    }
    
    // The old logic for saving individual items to localStorage (zenjin_tube_data, etc.)
    // is now handled by the Zustand persist middleware configured in appStore.ts.
    // Calling initializeState will update the store, and persist middleware will save 'zenjin-app-state'.

    // The function can return the loaded state or a success status.
    return { success: true, data: loadedState };

  } catch (error) {
    console.error('❌ Error in loadUserData:', error);
    // It might be useful to dispatch an action to the store indicating that loading failed
    // useAppStore.getState().setLoadingError(error); // Example
    throw error; // Re-throw for the caller to handle if necessary
  }
}

/**
 * Check if cached user data is available (checks Zustand store's persisted state).
 * This is a conceptual change: instead of checking disparate localStorage items,
 * we check if the store considers itself initialized, potentially after rehydration.
 */
export function hasLocalUserData(): boolean {
  // The store's `isInitialized` flag or presence of userInformation can indicate this.
  // This depends on how `isInitialized` is managed by useAppStore.
  // If useAppStore.persist.rehydrate() is asynchronous, this might not be immediately accurate on startup.
  const store = useAppStore.getState();
  // A simple check could be if userInformation is present after store hydration.
  return store.isInitialized && store.userInformation != null;
}

/**
 * Get cached user data from Zustand store.
 * The primary way to access state should be through store selectors/hooks in components.
 * This function might be for specific non-component scenarios.
 */
export function getLocalUserData(): UserState | null {
  const storeState = useAppStore.getState();
  if (storeState.isInitialized && storeState.userInformation) {
    return {
      userInformation: storeState.userInformation,
      tubeState: storeState.tubeState!, // Assuming tubeState is non-null if userInformation is present
      learningProgress: storeState.learningProgress!, // Same assumption
      // Note: This constructs a UserState object. The store itself is AppState.
    };
  }
  return null;
}

/**
 * Clear user data from Zustand store and its persisted storage.
 */
export function clearUserData() {
  // Option 1: Call a reset action in the store if it exists and handles clearing persisted state.
  // e.g., useAppStore.getState().resetToInitialStateAndClearPersistence();

  // Option 2: Manually clear the specific localStorage item used by persist middleware.
  // This is generally not recommended as it's an internal detail of the store.
  // The key is 'zenjin-app-state' as defined in appStore.ts.
  if (typeof window !== 'undefined') {
    localStorage.removeItem('zenjin-app-state');
    // Also clear any other related localStorage items if necessary, e.g., old ones.
    localStorage.removeItem('zenjin_user_id'); // From old logic
    localStorage.removeItem('zenjin_auth_state'); // From old logic
    localStorage.removeItem('zenjin_tube_data'); // Old
    localStorage.removeItem('zenjin_user_progress'); // Old
    localStorage.removeItem('zenjin_data_timestamp'); // Old
  }
  
  // Reset the store's in-memory state to initial values.
  // This requires an action in the store, e.g., initializeState with empty/initial values.
  useAppStore.getState().initializeState({
    userInformation: null,
    tubeState: null,
    learningProgress: null,
    // lastUpdated: new Date().toISOString(), // Let initializeState handle this
    // isInitialized: false // Let initializeState handle this
  });
  console.log('User data cleared from localStorage and store reset (conceptually).');
}