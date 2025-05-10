/**
 * User State Adapter Hook
 * 
 * A drop-in replacement for the existing useUserState hook
 * that uses the Zustand store as the underlying state management.
 */
import { useState, useEffect, useCallback } from 'react';
import { UserState } from '../state/types';
import { useAppStore } from './appStore';
import { 
  convertStoreToLegacyState, 
  updateStoreFromLegacyState, 
  saveStateToServer 
} from './stateAdapter';

/**
 * Hook for accessing and updating user state
 * Compatible with the existing useUserState hook API
 */
export function useUserStateAdapter() {
  // Get state from Zustand
  const zustandState = useAppStore();
  
  // Convert to legacy format for compatibility
  const [userState, setUserState] = useState<UserState | null>(
    convertStoreToLegacyState()
  );
  
  // Update local state when Zustand state changes
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe(
      (state) => {
        setUserState(convertStoreToLegacyState());
      }
    );
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  /**
   * Initialize the user state
   * @param userId - The user ID to initialize state for
   */
  const initializeUserState = useCallback(async (userId: string) => {
    if (!userId) {
      console.error('Cannot initialize user state: No user ID provided');
      return;
    }
    
    // Check if we have local state already
    const existingState = localStorage.getItem(`zenjin_state_${userId}`);
    
    if (existingState) {
      try {
        const parsedState = JSON.parse(existingState) as UserState;
        
        // Update the Zustand store with this state
        updateStoreFromLegacyState(parsedState);
        
        console.log(`Initialized state for user ${userId} from localStorage`);
      } catch (err) {
        console.error('Error parsing localStorage state:', err);
      }
    } else {
      // Try to fetch from server
      try {
        const response = await fetch(`/api/user-state?userId=${encodeURIComponent(userId)}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.state) {
            // Update the Zustand store with this state
            updateStoreFromLegacyState(data.state);
            
            console.log(`Initialized state for user ${userId} from server`);
          } else {
            // Initialize with basic state
            useAppStore.getState().setUserInformation({
              userId,
              isAnonymous: userId.startsWith('anonymous') || userId.startsWith('anon-')
            });
            
            console.log(`Initialized basic state for user ${userId}`);
          }
        } else {
          console.error(`Error fetching state for user ${userId}: ${response.status}`);
        }
      } catch (err) {
        console.error('Error fetching state from server:', err);
      }
    }
  }, []);
  
  /**
   * Update the user state
   * @param newState - The new state to set
   */
  const updateUserState = useCallback(async (newState: UserState) => {
    if (!newState) {
      console.error('Cannot update user state: No state provided');
      return false;
    }
    
    // Update the Zustand store
    updateStoreFromLegacyState(newState);
    
    // Save to server
    const success = await saveStateToServer();
    
    return success;
  }, []);
  
  /**
   * Force a sync of the current state to the server
   */
  const syncState = useCallback(async () => {
    return saveStateToServer();
  }, []);
  
  return {
    userState,
    initializeUserState,
    updateUserState,
    syncState
  };
}