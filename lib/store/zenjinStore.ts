import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { 
  UserInformation, TubeState, LearningProgress, 
  SessionData, ContentCollection, StitchProgressionConfig,
  AppConfiguration, SubscriptionDetails
} from './types';

// Define the combined store state
interface ZenjinStore {
  // Core state slices
  userInformation: UserInformation | null;
  tubeState: TubeState | null;
  learningProgress: LearningProgress | null;
  sessionData: SessionData | null;
  contentCollection: ContentCollection | null;
  stitchProgressionConfig: StitchProgressionConfig;
  appConfiguration: AppConfiguration;
  subscriptionDetails: SubscriptionDetails | null;
  lastUpdated: string;
  isInitialized: boolean;

  // User Information actions
  setUserInformation: (userInfo: UserInformation | null) => void;
  updateUserProfile: (updates: Partial<UserInformation>) => void;
  
  // Tube State actions
  setTubeState: (tubeState: TubeState) => void;
  setActiveTube: (tubeNum: 1 | 2 | 3) => void;
  setCurrentStitch: (tubeNum: 1 | 2 | 3, stitchId: string) => void;
  updateStitchOrder: (tubeNum: 1 | 2 | 3, stitchOrder: string[]) => void;
  
  // Learning Progress actions
  setLearningProgress: (progress: LearningProgress) => void;
  incrementTotalTimeSpent: (seconds: number) => void;
  updateEvoPoints: (points: number, operation: 'add' | 'set') => void;
  incrementPoints: (points: number) => void; // Simpler alias for adding points
  updateBlinkSpeed: (newSessionBlinkSpeed: number) => void;
  incrementStitchesCompleted: (isPerfectScore: boolean) => void;
  
  // Session Data actions
  startNewSession: (userId: string) => void;
  endCurrentSession: () => void;
  recordStitchInteraction: (stitchId: string, isCorrect: boolean, isFirstTimeCorrect: boolean) => void;
  
  // Content Collection actions
  setContentCollection: (collection: ContentCollection) => void;
  updateStitchInCollection: (stitchId: string, updates: Partial<import('./types').Stitch>) => void;
  
  // App Configuration actions
  setAppConfiguration: (config: AppConfiguration) => void;
  toggleSound: () => void;
  
  // Stitch Progression Config actions
  setStitchProgressionConfig: (config: StitchProgressionConfig) => void;
  
  // Subscription Details actions
  setSubscriptionDetails: (details: SubscriptionDetails | null) => void;
  
  // Complete state operations
  initializeState: (partialState: Partial<ZenjinStore>) => void;
  syncToServer: () => Promise<boolean>;
  loadFromServer: (userId: string) => Promise<boolean>;
  resetStore: () => void;

  // Direct persistence helpers
  saveToLocalStorage: () => boolean;
  loadFromLocalStorage: () => boolean;
}

// Default values for required state slices
const defaultStitchProgressionConfig: StitchProgressionConfig = {
  initialSkipNumber: 3,
  skipNumberSequence: [3, 5, 10, 25, 100],
  retiredThresholdSkipNumber: 100,
  initialDistractorLevel: 1,
  perfectScoreCriteria: { required: 20, total: 20 }
};

const defaultAppConfiguration: AppConfiguration = {
  soundEnabled: true
};

// Create the Zustand store with persistence
export const useZenjinStore = create<ZenjinStore>()(
  persist(
    (set, get) => ({
      // Initial state values
      userInformation: null,
      tubeState: null,
      learningProgress: null,
      sessionData: null,
      contentCollection: null,
      stitchProgressionConfig: defaultStitchProgressionConfig,
      appConfiguration: defaultAppConfiguration,
      subscriptionDetails: null,
      lastUpdated: new Date().toISOString(),
      isInitialized: false,
      
      // User Information actions
      setUserInformation: (userInfo) => set({
        userInformation: userInfo,
        lastUpdated: new Date().toISOString()
      }),
      
      updateUserProfile: (updates) => set((state) => ({
        userInformation: state.userInformation ? {
          ...state.userInformation,
          ...updates,
          lastActive: new Date().toISOString()
        } : null,
        lastUpdated: new Date().toISOString()
      })),
      
      // Tube State actions
      setTubeState: (tubeState) => set({
        tubeState,
        lastUpdated: new Date().toISOString()
      }),
      
      setActiveTube: (tubeNum) => set((state) => ({
        tubeState: state.tubeState ? {
          ...state.tubeState,
          activeTube: tubeNum
        } : null,
        lastUpdated: new Date().toISOString()
      })),
      
      setCurrentStitch: (tubeNum, stitchId) => set((state) => {
        if (!state.tubeState) return { lastUpdated: new Date().toISOString() };
        
        return {
          tubeState: {
            ...state.tubeState,
            tubes: {
              ...state.tubeState.tubes,
              [tubeNum]: {
                ...state.tubeState.tubes[tubeNum],
                currentStitchId: stitchId
              }
            }
          },
          lastUpdated: new Date().toISOString()
        };
      }),
      
      updateStitchOrder: (tubeNum, stitchOrder) => set((state) => {
        if (!state.tubeState) return { lastUpdated: new Date().toISOString() };
        
        return {
          tubeState: {
            ...state.tubeState,
            tubes: {
              ...state.tubeState.tubes,
              [tubeNum]: {
                ...state.tubeState.tubes[tubeNum],
                stitchOrder
              }
            }
          },
          lastUpdated: new Date().toISOString()
        };
      }),
      
      // Learning Progress actions
      setLearningProgress: (progress) => set({
        learningProgress: progress,
        lastUpdated: new Date().toISOString()
      }),
      
      incrementTotalTimeSpent: (seconds) => set((state) => {
        if (!state.learningProgress) return { lastUpdated: new Date().toISOString() };
        
        return {
          learningProgress: {
            ...state.learningProgress,
            totalTimeSpentLearning: state.learningProgress.totalTimeSpentLearning + seconds
          },
          lastUpdated: new Date().toISOString()
        };
      }),
      
      updateEvoPoints: (points, operation = 'add') => set((state) => {
        if (!state.learningProgress) return { lastUpdated: new Date().toISOString() };

        const newPoints = operation === 'add'
          ? state.learningProgress.evoPoints + points
          : points;

        // Recalculate evolution level
        const currentBlinkSpeed = state.learningProgress.currentBlinkSpeed || 1;
        const evolutionLevel = Math.floor(newPoints / currentBlinkSpeed);

        return {
          learningProgress: {
            ...state.learningProgress,
            evoPoints: newPoints,
            evolutionLevel
          },
          lastUpdated: new Date().toISOString()
        };
      }),

      // Simpler alias for incrementing points
      incrementPoints: (points) => set((state) => {
        if (!state.learningProgress) {
          // If learningProgress is null, create it with default values
          return {
            learningProgress: {
              evoPoints: points,
              evolutionLevel: points,
              blinkSpeed: 1,
              totalStitchesCompleted: 0,
              perfectScores: 0
            },
            lastUpdated: new Date().toISOString()
          };
        }

        // Just update evoPoints by adding points
        const newPoints = state.learningProgress.evoPoints + points;

        // Recalculate evolution level
        const currentBlinkSpeed = state.learningProgress.currentBlinkSpeed || 1;
        const evolutionLevel = Math.floor(newPoints / currentBlinkSpeed);

        return {
          learningProgress: {
            ...state.learningProgress,
            evoPoints: newPoints,
            evolutionLevel
          },
          lastUpdated: new Date().toISOString()
        };
      }),
      
      updateBlinkSpeed: (newSessionBlinkSpeed) => set((state) => {
        if (!state.learningProgress) return { lastUpdated: new Date().toISOString() };
        
        // Add to history and limit to last 10
        const previousSpeeds = [...state.learningProgress.previousSessionBlinkSpeeds, newSessionBlinkSpeed];
        const limitedSpeeds = previousSpeeds.slice(-10);
        
        // Calculate rolling average
        const sum = limitedSpeeds.reduce((a, b) => a + b, 0);
        const average = limitedSpeeds.length > 0 ? sum / limitedSpeeds.length : 1;
        
        // Recalculate evolution level with new blink speed
        const evolutionLevel = Math.floor(state.learningProgress.evoPoints / average);
        
        return {
          learningProgress: {
            ...state.learningProgress,
            previousSessionBlinkSpeeds: limitedSpeeds,
            currentBlinkSpeed: average,
            evolutionLevel
          },
          lastUpdated: new Date().toISOString()
        };
      }),
      
      incrementStitchesCompleted: (isPerfectScore) => set((state) => {
        if (!state.learningProgress) return { lastUpdated: new Date().toISOString() };
        
        return {
          learningProgress: {
            ...state.learningProgress,
            completedStitchesCount: state.learningProgress.completedStitchesCount + 1,
            perfectScoreStitchesCount: isPerfectScore 
              ? state.learningProgress.perfectScoreStitchesCount + 1 
              : state.learningProgress.perfectScoreStitchesCount
          },
          lastUpdated: new Date().toISOString()
        };
      }),
      
      // Session Data actions
      startNewSession: (userId) => set({
        sessionData: {
          sessionId: `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          userId,
          startTime: new Date().toISOString(),
          firstTimeCorrectAnswersInSessionCount: 0,
          stitchesPlayedInSession: []
        },
        lastUpdated: new Date().toISOString()
      }),
      
      endCurrentSession: () => set((state) => {
        if (!state.sessionData) return { lastUpdated: new Date().toISOString() };
        
        const endTime = new Date().toISOString();
        const startTime = new Date(state.sessionData.startTime);
        const endTimeDate = new Date(endTime);
        const durationSeconds = Math.floor((endTimeDate.getTime() - startTime.getTime()) / 1000);
        
        // Calculate session blink speed
        const totalQuestions = state.sessionData.stitchesPlayedInSession.length * 20; // Assuming 20 questions per stitch
        const correctAnswers = state.sessionData.firstTimeCorrectAnswersInSessionCount;
        const blinkSpeed = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 10 : 1;
        
        // Update blink speed in learning progress
        get().updateBlinkSpeed(blinkSpeed);
        
        // Increment total time spent
        get().incrementTotalTimeSpent(durationSeconds);
        
        return {
          sessionData: {
            ...state.sessionData,
            endTime,
            durationSeconds
          },
          lastUpdated: new Date().toISOString()
        };
      }),
      
      recordStitchInteraction: (stitchId, isCorrect, isFirstTimeCorrect) => set((state) => {
        if (!state.sessionData) return { lastUpdated: new Date().toISOString() };
        
        // Update first time correct count if applicable
        const newFirstTimeCorrectCount = isFirstTimeCorrect 
          ? state.sessionData.firstTimeCorrectAnswersInSessionCount + 1 
          : state.sessionData.firstTimeCorrectAnswersInSessionCount;
        
        // Check if this stitch is already in the session
        const existingIndex = state.sessionData.stitchesPlayedInSession.findIndex(
          s => s.stitchId === stitchId
        );
        
        let updatedStitches = [...state.sessionData.stitchesPlayedInSession];
        
        if (existingIndex >= 0) {
          // Update existing stitch record
          const existing = updatedStitches[existingIndex];
          updatedStitches[existingIndex] = {
            ...existing,
            interactions: existing.interactions + 1,
            // Update score if provided
            ...(isCorrect && { score: (existing.score || 0) + 1 }),
            // Update perfect status if applicable
            ...(existing.score === 19 && isCorrect && { isPerfect: true })
          };
        } else {
          // Add new stitch record
          updatedStitches.push({
            stitchId,
            score: isCorrect ? 1 : 0,
            isPerfect: false,
            interactions: 1
          });
        }
        
        return {
          sessionData: {
            ...state.sessionData,
            firstTimeCorrectAnswersInSessionCount: newFirstTimeCorrectCount,
            stitchesPlayedInSession: updatedStitches
          },
          lastUpdated: new Date().toISOString()
        };
      }),
      
      // Content Collection actions
      setContentCollection: (collection) => set({
        contentCollection: collection,
        lastUpdated: new Date().toISOString()
      }),
      
      updateStitchInCollection: (stitchId, updates) => set((state) => {
        if (!state.contentCollection?.stitches) return { lastUpdated: new Date().toISOString() };
        
        const existingStitch = state.contentCollection.stitches[stitchId];
        if (!existingStitch) return { lastUpdated: new Date().toISOString() };
        
        return {
          contentCollection: {
            ...state.contentCollection,
            stitches: {
              ...state.contentCollection.stitches,
              [stitchId]: {
                ...existingStitch,
                ...updates
              }
            }
          },
          lastUpdated: new Date().toISOString()
        };
      }),
      
      // App Configuration actions
      setAppConfiguration: (config) => set({
        appConfiguration: config,
        lastUpdated: new Date().toISOString()
      }),
      
      toggleSound: () => set((state) => ({
        appConfiguration: {
          ...state.appConfiguration,
          soundEnabled: !state.appConfiguration.soundEnabled
        },
        lastUpdated: new Date().toISOString()
      })),
      
      // Stitch Progression Config actions
      setStitchProgressionConfig: (config) => set({
        stitchProgressionConfig: config,
        lastUpdated: new Date().toISOString()
      }),
      
      // Subscription Details actions
      setSubscriptionDetails: (details) => set({
        subscriptionDetails: details,
        lastUpdated: new Date().toISOString()
      }),
      
      // Complete state operations
      initializeState: (partialState) => set({
        ...partialState,
        isInitialized: true,
        lastUpdated: new Date().toISOString()
      }),
      
      syncToServer: async () => {
        const state = get();

        // Ensure state is saved to localStorage first
        get().saveToLocalStorage();

        if (!state.userInformation?.userId) {
          console.error('Cannot sync to server: No user ID available');
          return false;
        }

        try {
          // Prepare the data for server sync - Use legacy format for compatibility
          // with the existing API endpoint
          const syncData = {
            state: {
              userId: state.userInformation.userId,
              tubes: state.tubeState?.tubes || {},
              activeTube: state.tubeState?.activeTube || 1,
              activeTubeNumber: state.tubeState?.activeTubeNumber || 1,
              points: {
                session: state.learningProgress?.evoPoints || 0,
                lifetime: state.learningProgress?.evoPoints || 0
              },
              cycleCount: state.tubeState?.cycleCount || 0,
              lastUpdated: state.lastUpdated
            }
          };

          console.log('Syncing state to server:', syncData);

          // Send to server - using existing user-state API endpoint
          const response = await fetch('/api/user-state', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(syncData)
          });

          if (!response.ok) {
            console.error(`Server returned error ${response.status} during sync`);
            console.error('Response text:', await response.text());
            throw new Error(`Server returned ${response.status}`);
          }

          const data = await response.json();
          console.log('Server sync response:', data);
          return data.success === true;
        } catch (error) {
          console.error('Error syncing state to server:', error);
          return false;
        }
      },

      // Load state from server using the user-state endpoint
      loadFromServer: async (userId) => {
        if (!userId) {
          console.error('Cannot load from server: No user ID provided');
          return false;
        }

        try {
          console.log(`Loading state from server for user ${userId}`);

          // Fetch state from server
          const response = await fetch(`/api/user-state?userId=${encodeURIComponent(userId)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            console.error(`Server returned error ${response.status} while loading state`);
            console.error('Response text:', await response.text());
            throw new Error(`Server returned ${response.status}`);
          }

          const data = await response.json();
          console.log('Server load response:', data);

          if (!data.success || !data.state) {
            console.error('Failed to load state from server:', data);
            return false;
          }

          const loadedState = data.state;

          // Convert from legacy format to Zustand format
          // Basic user information
          const userInformation = {
            userId: loadedState.userId,
            isAnonymous: loadedState.userId?.startsWith('anonymous') || false,
            createdAt: loadedState.createdAt || new Date().toISOString(),
            lastActive: new Date().toISOString()
          };

          // Extract tube state
          const tubeState = {
            activeTube: loadedState.activeTube || loadedState.activeTubeNumber || 1,
            activeTubeNumber: loadedState.activeTubeNumber || loadedState.activeTube || 1,
            tubes: loadedState.tubes || {},
            cycleCount: loadedState.cycleCount || 0
          };

          // Extract learning progress
          let evoPoints = 0;
          if (loadedState.points) {
            // Extract from legacy format
            evoPoints = loadedState.points.lifetime || 0;
          }

          const learningProgress = {
            evoPoints,
            evolutionLevel: Math.floor(evoPoints / 1), // Simple calculation
            blinkSpeed: 1,
            totalStitchesCompleted: 0,
            perfectScores: 0
          };

          // Update the store with the loaded state
          set({
            userInformation,
            tubeState,
            learningProgress,
            lastUpdated: loadedState.lastUpdated || new Date().toISOString(),
            isInitialized: true
          });

          console.log('Successfully loaded state from server');
          return true;
        } catch (error) {
          console.error('Error loading state from server:', error);
          return false;
        }
      },
      
      resetStore: () => set({
        userInformation: null,
        tubeState: null,
        learningProgress: null,
        sessionData: null,
        contentCollection: null,
        stitchProgressionConfig: defaultStitchProgressionConfig,
        appConfiguration: defaultAppConfiguration,
        subscriptionDetails: null,
        lastUpdated: new Date().toISOString(),
        isInitialized: false
      }),
      
      // Direct persistence helpers
      saveToLocalStorage: () => {
        try {
          const state = get();
          const userId = state.userInformation?.userId || 'anonymous';
          
          // Save to localStorage directly
          localStorage.setItem(`zenjin_state_${userId}`, JSON.stringify({
            userInformation: state.userInformation,
            tubeState: state.tubeState,
            learningProgress: state.learningProgress,
            contentCollection: state.contentCollection,
            stitchProgressionConfig: state.stitchProgressionConfig,
            appConfiguration: state.appConfiguration,
            subscriptionDetails: state.subscriptionDetails,
            lastUpdated: state.lastUpdated,
            isInitialized: state.isInitialized
          }));
          
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
          
          // Try to load from localStorage
          const stored = localStorage.getItem(`zenjin_state_${userId}`);
          if (!stored) return false;
          
          try {
            const parsedState = JSON.parse(stored);
            
            // Update the store with the loaded state
            set({
              ...parsedState,
              lastUpdated: new Date().toISOString()
            });
            
            return true;
          } catch (parseError) {
            console.error('Error parsing stored state:', parseError);
            return false;
          }
        } catch (error) {
          console.error('Error loading from localStorage:', error);
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
        // Skip sessionData - no need to persist active session
        contentCollection: state.contentCollection,
        stitchProgressionConfig: state.stitchProgressionConfig,
        appConfiguration: state.appConfiguration,
        subscriptionDetails: state.subscriptionDetails,
        lastUpdated: state.lastUpdated,
        isInitialized: state.isInitialized
      })
    }
  )
);

// Utility hooks for accessing specific slices of state
export const useUserInfo = () => useZenjinStore(state => state.userInformation);
export const useTubeState = () => useZenjinStore(state => state.tubeState);
export const useLearningProgress = () => useZenjinStore(state => state.learningProgress);
export const useSessionData = () => useZenjinStore(state => state.sessionData);
export const useAppConfig = () => useZenjinStore(state => state.appConfiguration);
export const useSubscription = () => useZenjinStore(state => state.subscriptionDetails);

// Export default for primary usage
export default useZenjinStore;