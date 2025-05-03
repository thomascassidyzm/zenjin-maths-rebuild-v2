import { useState, useEffect, useCallback } from 'react';
import { UserState } from './types';
import { stateManager } from './stateManager';

/**
 * Hook for accessing and updating user state
 * 
 * Provides a React interface to the state manager with proper subscription handling
 */
export function useUserState() {
  const [userState, setUserState] = useState<UserState | null>(stateManager.getState() || null);
  
  // Subscribe to state changes
  useEffect(() => {
    // Update state when the state manager notifies of changes
    const unsubscribe = stateManager.subscribe((newState) => {
      setUserState(newState);
    });
    
    // Set initial state
    setUserState(stateManager.getState());
    
    // Unsubscribe when component unmounts
    return () => {
      unsubscribe();
    };
  }, []);
  
  /**
   * Initialize the user state
   * @param userId - The user ID to initialize state for
   */
  const initializeUserState = useCallback(async (userId: string) => {
    await stateManager.initialize(userId);
  }, []);
  
  /**
   * Update the user state
   * @param newState - The new state to set
   */
  const updateUserState = useCallback(async (newState: UserState) => {
    stateManager.dispatch({ type: 'INITIALIZE_STATE', payload: newState });
    
    // Force a sync to the server for important state changes
    await stateManager.forceSyncToServer();
    
    return true;
  }, []);
  
  /**
   * Force a sync of the current state to the server
   */
  const syncState = useCallback(async () => {
    return stateManager.forceSyncToServer();
  }, []);
  
  return {
    userState,
    initializeUserState,
    updateUserState,
    syncState
  };
}