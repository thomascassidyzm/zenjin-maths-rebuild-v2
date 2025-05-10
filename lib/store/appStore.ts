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
        if (!state.learningProgress) return state;
        
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
      
      // Server synchronization
      syncToServer: async () => {
        const state = get();
        
        if (!state.userInformation?.userId) {
          console.error('Cannot sync to server: No user ID available');
          return false;
        }
        
        try {
          // Prepare the data for server sync
          const syncData = {
            state: {
              userId: state.userInformation.userId,
              tubes: state.tubeState?.tubes || {},
              activeTube: state.tubeState?.activeTube || 1,
              activeTubeNumber: state.tubeState?.activeTubeNumber || 1,
              points: state.learningProgress?.points || { session: 0, lifetime: 0 },
              cycleCount: state.tubeState?.cycleCount || 0,
              lastUpdated: state.lastUpdated
            }
          };
          
          // Send to server - using existing API endpoint for compatibility
          const response = await fetch('/api/user-state', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(syncData)
          });
          
          if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
          }
          
          const data = await response.json();
          return data.success === true;
        } catch (error) {
          console.error('Error syncing state to server:', error);
          return false;
        }
      }
    }),
    {
      name: 'zenjin-app-state',
      storage: createJSONStorage(() => localStorage)
    }
  )
)