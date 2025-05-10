/**
 * State Adapter
 * 
 * Provides a compatibility layer between the new Zustand store and existing code.
 * Allows gradual migration without breaking existing functionality.
 */
import { useAppStore } from './appStore';
import { UserState } from '../state/types';
import { TubeState, UserInformation, LearningProgress } from './types';

/**
 * Converts current state format to Zustand store format
 */
export function convertLegacyStateToStore(legacyState: UserState) {
  if (!legacyState) return null;
  
  // Extract user information
  const userInformation: UserInformation = {
    userId: legacyState.userId || '',
    isAnonymous: legacyState.userId?.startsWith('anonymous') || legacyState.userId?.startsWith('anon-') || false,
  };
  
  // Extract tube state
  const tubeState: TubeState = {
    tubes: legacyState.tubes || {},
    activeTube: legacyState.activeTube || legacyState.activeTubeNumber || 1,
    activeTubeNumber: legacyState.activeTubeNumber || legacyState.activeTube || 1,
    cycleCount: legacyState.cycleCount || 0
  };
  
  // Extract learning progress
  const learningProgress: LearningProgress = {
    points: legacyState.points || { session: 0, lifetime: 0 },
    blinkSpeed: 0, // Default values, will be populated from profile later
    evolutionLevel: 0,
    totalStitchesCompleted: 0,
    perfectScores: 0
  };
  
  return {
    userInformation,
    tubeState,
    learningProgress,
    lastUpdated: legacyState.lastUpdated || new Date().toISOString()
  };
}

/**
 * Converts Zustand store format to current state format
 */
export function convertStoreToLegacyState(): UserState {
  const state = useAppStore.getState();
  
  if (!state.userInformation || !state.tubeState) {
    console.error('Cannot convert store state: Missing required data');
    return {
      tubes: {},
      activeTube: 1,
      activeTubeNumber: 1,
      cycleCount: 0,
      points: {
        session: 0,
        lifetime: 0
      },
      lastUpdated: new Date().toISOString(),
      userId: ''
    };
  }
  
  return {
    tubes: state.tubeState.tubes,
    activeTube: state.tubeState.activeTube,
    activeTubeNumber: state.tubeState.activeTubeNumber,
    cycleCount: state.tubeState.cycleCount,
    points: state.learningProgress?.points || { session: 0, lifetime: 0 },
    lastUpdated: state.lastUpdated,
    userId: state.userInformation.userId
  };
}

/**
 * Updates the Zustand store with data from the existing state manager
 */
export function updateStoreFromLegacyState(legacyState: UserState) {
  if (!legacyState) return;
  
  const convertedState = convertLegacyStateToStore(legacyState);
  if (!convertedState) return;
  
  const { 
    userInformation,
    tubeState,
    learningProgress
  } = convertedState;
  
  const store = useAppStore.getState();
  
  if (userInformation) {
    store.setUserInformation(userInformation);
  }
  
  if (tubeState) {
    store.setTubeState(tubeState);
  }
  
  if (learningProgress) {
    store.setLearningProgress(learningProgress);
  }
}

/**
 * Hook to initialize the Zustand store from the legacy state
 */
export function useInitializeStoreFromLegacy(legacyState: UserState) {
  // Only update if we have valid legacy state and the store isn't already initialized
  const isInitialized = useAppStore(state => state.isInitialized);
  
  if (legacyState && !isInitialized) {
    updateStoreFromLegacyState(legacyState);
    useAppStore.getState().initializeState({ isInitialized: true });
  }
}

/**
 * Enhanced version of SaveStateToServer that uses Zustand
 */
export async function saveStateToServer(): Promise<boolean> {
  return useAppStore.getState().syncToServer();
}

/**
 * Retrieves state in legacy format from the Zustand store
 */
export function getLegacyState(): UserState {
  return convertStoreToLegacyState();
}