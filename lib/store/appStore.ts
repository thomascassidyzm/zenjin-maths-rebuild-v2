/**
 * App Store using Zustand
 *
 * This provides a centralized state management solution that serves as
 * a single source of truth for application state.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { AppState, UserInformation, TubeState, LearningProgress } from './types'

// Initial state values
const initialState: AppState = {
  userInformation: null,
  tubeState: null,
  learningProgress: null,
  lastUpdated: new Date().toISOString(),
  isInitialized: false
}

// Create the store with persistence
export const useAppStore = create<
  AppState & {
    // State setters
    setUserInformation: (userInfo: UserInformation | null) => void;
    setTubeState: (tubeState: TubeState) => void;
    setActiveTube: (tubeNumber: number) => void;
    setLearningProgress: (progress: LearningProgress) => void;
    updatePoints: (sessionPoints: number, lifetimePoints: number) => void;
    incrementPoints: (points: number) => void;

    // Complete state operations
    initializeState: (state: Partial<AppState>) => void;
    syncToServer: () => Promise<boolean>;

    // Manual localStorage operations for testing
    saveToLocalStorage: () => void;
    loadFromLocalStorage: () => boolean;
  }
>(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // User information actions
      setUserInformation: (userInfo) => set({
        userInformation: userInfo,
        lastUpdated: new Date().toISOString()
      }),

      // Tube state actions
      setTubeState: (tubeState) => set({
        tubeState,
        lastUpdated: new Date().toISOString()
      }),

      setActiveTube: (tubeNumber) => set((state) => {
        if (!state.tubeState) return state;

        return {
          tubeState: {
            ...state.tubeState,
            activeTube: tubeNumber,
            activeTubeNumber: tubeNumber
          },
          lastUpdated: new Date().toISOString()
        }
      }),

      // Learning progress actions
      setLearningProgress: (progress) => set({
        learningProgress: progress,
        lastUpdated: new Date().toISOString()
      }),

      updatePoints: (sessionPoints, lifetimePoints) => set((state) => {
        if (!state.learningProgress) return state;

        return {
          learningProgress: {
            ...state.learningProgress,
            points: {
              session: sessionPoints,
              lifetime: lifetimePoints
            }
          },
          lastUpdated: new Date().toISOString()
        }
      }),

      incrementPoints: (points) => set((state) => {
        if (!state.learningProgress) {
          // If learningProgress is null, create it with default values
          return {
            learningProgress: {
              points: {
                session: points,
                lifetime: points
              },
              blinkSpeed: 0,
              evolutionLevel: 0,
              totalStitchesCompleted: 0,
              perfectScores: 0
            },
            lastUpdated: new Date().toISOString()
          };
        }

        const currentSessionPoints = state.learningProgress.points.session || 0;
        const currentLifetimePoints = state.learningProgress.points.lifetime || 0;

        return {
          learningProgress: {
            ...state.learningProgress,
            points: {
              session: currentSessionPoints + points,
              lifetime: currentLifetimePoints + points
            }
          },
          lastUpdated: new Date().toISOString()
        }
      }),

      // Complete state operations
      initializeState: (state) => set({
        ...state,
        isInitialized: true,
        lastUpdated: new Date().toISOString()
      }),

      // Explicit localStorage operations for testing
      saveToLocalStorage: () => {
        try {
          const state = get();
          const userId = state.userInformation?.userId || 'anonymous';

          // Save directly to localStorage using legacy format for compatibility
          localStorage.setItem(`zenjin_state_${userId}`, JSON.stringify({
            userId: userId,
            tubes: state.tubeState?.tubes || {},
            activeTube: state.tubeState?.activeTube || 1,
            activeTubeNumber: state.tubeState?.activeTubeNumber || 1,
            cycleCount: state.tubeState?.cycleCount || 0,
            points: state.learningProgress?.points || { session: 0, lifetime: 0 },
            lastUpdated: state.lastUpdated
          }));

          console.log(`Explicitly saved state to localStorage for user ${userId}`);
          return true;
        } catch (error) {
          console.error('Error saving to localStorage:', error);
          return false;
        }
      },

      loadFromLocalStorage: () => {
        try {
          const state = get();
          const userId = state.userInformation?.userId || 'anonymous';

          const storedState = localStorage.getItem(`zenjin_state_${userId}`);
          if (!storedState) return false;

          const parsedState = JSON.parse(storedState);
          if (!parsedState) return false;

          // Update the store with loaded state
          set({
            tubeState: {
              tubes: parsedState.tubes || {},
              activeTube: parsedState.activeTube || 1,
              activeTubeNumber: parsedState.activeTubeNumber || 1,
              cycleCount: parsedState.cycleCount || 0
            },
            learningProgress: {
              points: parsedState.points || { session: 0, lifetime: 0 },
              blinkSpeed: 0,
              evolutionLevel: 0,
              totalStitchesCompleted: 0,
              perfectScores: 0
            },
            lastUpdated: parsedState.lastUpdated || new Date().toISOString()
          });

          console.log(`Explicitly loaded state from localStorage for user ${userId}`);
          return true;
        } catch (error) {
          console.error('Error loading from localStorage:', error);
          return false;
        }
      },

      // Server synchronization
      syncToServer: async () => {
        const { userInformation, tubeState, learningProgress, lastUpdated, isInitialized, ...rest } = get();

        if (!userInformation?.userId) {
          console.error('Cannot sync to server: No user ID or userInformation available.');
          return false;
        }
        
        // Construct the payload according to UserState interface for /api/sync-user-state
        // Ensure all necessary top-level properties are included.
        // The API expects: UserInformation, TubeState, LearningProgress.
        // If any of these are null in the store, send them as such or as empty objects
        // if the backend expects non-null objects. The API types suggest they can be objects or null/undefined.
        // The SQL functions are designed to handle potentially missing parts of the payload.
        const payload = {
          userInformation: userInformation || {}, // Send empty object if null
          tubeState: tubeState || { tubes: [], activeTube: null }, // Send default structure if null
          learningProgress: learningProgress || {}, // Send empty object if null
          // Include any other top-level properties that are part of the UserState definition
          // and are directly available in the store (e.g. lastUpdated if it's part of UserState)
          // For now, assuming UserState only contains the three main properties.
        };

        // The `lastUpdated` and `isInitialized` fields from AppState are not part of the UserState interface for the backend.
        // The backend will set its own `last_updated` timestamp.

        console.log('Syncing state to server with payload:', payload);

        try {
          const response = await fetch('/api/sync-user-state', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Authorization header will be handled by Supabase client-side SDK if session exists
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Server returned error ${response.status} during sync: ${errorText}`);
            throw new Error(`Server returned ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          console.log('Server sync response:', data);
          
          if (data.success) {
            set({ lastUpdated: new Date().toISOString() }); // Update local lastUpdated on successful sync
            return true;
          } else {
            console.error('Server sync was not successful:', data.error, data.details);
            return false;
          }
        } catch (error: any) {
          console.error('Error syncing state to server:', error.message || error);
          return false;
        }
      }
    }),
    {
      name: 'zenjin-app-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        userInformation: state.userInformation,
        tubeState: state.tubeState,
        learningProgress: state.learningProgress,
        lastUpdated: state.lastUpdated,
        isInitialized: state.isInitialized
      })
    }
  )
)