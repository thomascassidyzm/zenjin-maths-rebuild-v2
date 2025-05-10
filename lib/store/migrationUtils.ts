/**
 * Migration Utilities
 * 
 * Helper functions for gradually migrating components to use the Zustand store
 */
import { useAppStore } from './appStore';
import { stateManager } from '../state/stateManager';
import { UserState } from '../state/types';
import { updateStoreFromLegacyState, convertStoreToLegacyState } from './stateAdapter';

/**
 * Ensures state is synchronized between the legacy state manager and Zustand
 * Call this in components that might access both systems during migration
 */
export function useSynchronizeStores() {
  // Subscribe to the legacy state manager
  const unsubscribeFromLegacy = stateManager.subscribe((newState) => {
    updateStoreFromLegacyState(newState);
  });
  
  // Subscribe to the Zustand store
  const unsubscribeFromZustand = useAppStore.subscribe((newState) => {
    const legacyFormat = convertStoreToLegacyState();
    
    // Only dispatch if there's a meaningful difference to avoid loops
    const currentLegacy = stateManager.getState();
    if (
      legacyFormat.activeTube !== currentLegacy.activeTube ||
      legacyFormat.cycleCount !== currentLegacy.cycleCount ||
      legacyFormat.points.lifetime !== currentLegacy.points.lifetime ||
      legacyFormat.lastUpdated !== currentLegacy.lastUpdated
    ) {
      stateManager.dispatch({ type: 'INITIALIZE_STATE', payload: legacyFormat });
    }
  });
  
  // Unsubscribe on cleanup
  return () => {
    unsubscribeFromLegacy();
    unsubscribeFromZustand();
  };
}

/**
 * Initialize both stores from localStorage or server
 * This is a transitional function for the migration period
 */
export async function initializeBothStores(userId: string) {
  if (!userId) {
    console.error('Cannot initialize stores: No user ID provided');
    return;
  }
  
  // First try to initialize the legacy state manager
  await stateManager.initialize(userId);
  
  // Then synchronize to Zustand
  updateStoreFromLegacyState(stateManager.getState());
  
  // Mark Zustand store as initialized
  useAppStore.getState().initializeState({ isInitialized: true });
  
  console.log(`Both stores initialized for user ${userId}`);
}

/**
 * Save state from both stores to ensure consistency
 * This is a transitional function for the migration period
 */
export async function saveBothStores() {
  try {
    // First save from Zustand
    const zustandSuccess = await useAppStore.getState().syncToServer();
    
    // Then from legacy state manager
    const legacySuccess = await stateManager.saveState();
    
    return zustandSuccess && legacySuccess;
  } catch (err) {
    console.error('Error saving state from both stores:', err);
    return false;
  }
}

/**
 * Hook for components to indicate they've been migrated to Zustand
 * This helps track progress and can be used for analytics or debugging
 */
export function useMigratedComponent(componentName: string) {
  if (typeof window !== 'undefined') {
    // Store a list of migrated components in localStorage for monitoring
    try {
      const migratedList = localStorage.getItem('zustand_migrated_components');
      const components = migratedList ? JSON.parse(migratedList) : [];
      
      if (!components.includes(componentName)) {
        components.push(componentName);
        localStorage.setItem('zustand_migrated_components', JSON.stringify(components));
        
        console.log(`Component migrated to Zustand: ${componentName}`);
      }
    } catch (err) {
      // Ignore storage errors
    }
  }
}