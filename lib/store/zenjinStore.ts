import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  UserInformation, TubeState, LearningProgress,
  SessionData, ContentCollection, StitchProgressionConfig,
  AppConfiguration, SubscriptionDetails, Stitch, TubePosition
} from './types';
import { fetchStitchBatch, fetchSingleStitch } from './stitchActions';
import { StitchContent } from '../client/offline-first-content-buffer';

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

  // Position-based tube actions
  getStitchPositions: (tubeNum: 1 | 2 | 3) => { [position: number]: TubePosition } | null;
  updateStitchPosition: (tubeNum: 1 | 2 | 3, position: number, tubePosition: TubePosition) => void;
  moveStitch: (tubeNum: 1 | 2 | 3, fromPosition: number, toPosition: number) => void;
  getStitchAtPosition: (tubeNum: 1 | 2 | 3, position: number) => TubePosition | null;
  createPositionsFromStitchOrder: (tubeNum: 1 | 2 | 3) => { [position: number]: TubePosition } | null;
  
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
  fetchStitch: (stitchId: string) => Promise<StitchContent | null>;
  fetchStitchBatch: (stitchIds: string[]) => Promise<Record<string, StitchContent>>;
  addStitchToCollection: (stitch: StitchContent) => void;

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

      // Position-based tube actions
      getStitchPositions: (tubeNum) => {
        const state = get();
        if (!state.tubeState?.tubes?.[tubeNum]) return null;

        const tube = state.tubeState.tubes[tubeNum];

        // If positions exist, return them
        if (tube.positions) {
          return tube.positions;
        }

        // Otherwise create positions from stitchOrder
        return get().createPositionsFromStitchOrder(tubeNum);
      },

      createPositionsFromStitchOrder: (tubeNum) => {
        const state = get();
        if (!state.tubeState?.tubes?.[tubeNum]) return null;

        const tube = state.tubeState.tubes[tubeNum];

        // If no stitchOrder, we can't create positions
        if (!tube.stitchOrder || !tube.stitchOrder.length) return null;

        // Create positions object from stitchOrder
        const positions: { [position: number]: TubePosition } = {};

        // Map each stitch in stitchOrder to a position (using index as position)
        tube.stitchOrder.forEach((stitchId, index) => {
          // Try to get stitch from content collection for its properties
          const stitch = state.contentCollection?.stitches?.[stitchId];

          positions[index] = {
            stitchId,
            // Use values from stitch if available, otherwise use defaults
            skipNumber: stitch?.skipNumber || state.stitchProgressionConfig.initialSkipNumber,
            distractorLevel: stitch?.distractorLevel || state.stitchProgressionConfig.initialDistractorLevel,
            perfectCompletions: (stitch?.completionHistory || []).filter(record => record.isPerfect).length || 0,
            lastCompleted: stitch?.completionHistory?.length ?
              stitch.completionHistory[stitch.completionHistory.length - 1].timestamp : undefined
          };
        });

        // Update the store with these positions but don't call this function again
        set((state) => {
          if (!state.tubeState) return { lastUpdated: new Date().toISOString() };

          return {
            tubeState: {
              ...state.tubeState,
              tubes: {
                ...state.tubeState.tubes,
                [tubeNum]: {
                  ...state.tubeState.tubes[tubeNum],
                  positions
                }
              }
            },
            lastUpdated: new Date().toISOString()
          };
        });

        return positions;
      },

      getStitchAtPosition: (tubeNum, position) => {
        const positions = get().getStitchPositions(tubeNum);
        if (!positions) return null;

        return positions[position] || null;
      },

      updateStitchPosition: (tubeNum, position, tubePosition) => set((state) => {
        if (!state.tubeState?.tubes?.[tubeNum]) return { lastUpdated: new Date().toISOString() };

        const tube = state.tubeState.tubes[tubeNum];

        // Create positions object if it doesn't exist
        const positions = tube.positions || get().createPositionsFromStitchOrder(tubeNum) || {};

        // Update the position
        const updatedPositions = {
          ...positions,
          [position]: tubePosition
        };

        // Also update stitchOrder for backward compatibility
        // Build array of stitchIds in position order
        const stitchOrder = Object.entries(updatedPositions)
          .sort(([posA], [posB]) => parseInt(posA) - parseInt(posB))
          .map(([_, tubPos]) => tubPos.stitchId);

        return {
          tubeState: {
            ...state.tubeState,
            tubes: {
              ...state.tubeState.tubes,
              [tubeNum]: {
                ...state.tubeState.tubes[tubeNum],
                positions: updatedPositions,
                stitchOrder,
                // If position 0 is updated, also update currentStitchId
                ...(position === 0 && { currentStitchId: tubePosition.stitchId })
              }
            }
          },
          lastUpdated: new Date().toISOString()
        };
      }),

      moveStitch: (tubeNum, fromPosition, toPosition) => {
        const state = get();
        if (!state.tubeState?.tubes?.[tubeNum]) return;

        const positions = get().getStitchPositions(tubeNum);
        if (!positions) return;

        // Get the stitch at fromPosition
        const stitchToMove = positions[fromPosition];
        if (!stitchToMove) return;

        // If moving to position 0, we need to update currentStitchId
        const isMovingToActivePosition = toPosition === 0;

        // First we need to shift all stitches in between
        // Create an updated positions object
        const updatedPositions: { [position: number]: TubePosition } = { ...positions };

        // Remove stitch from fromPosition
        delete updatedPositions[fromPosition];

        // When moving forward (lower position to higher position)
        if (fromPosition < toPosition) {
          // Shift all stitches between fromPosition+1 and toPosition one position lower
          for (let i = fromPosition + 1; i <= toPosition; i++) {
            if (updatedPositions[i]) {
              updatedPositions[i - 1] = updatedPositions[i];
              delete updatedPositions[i];
            }
          }
        }
        // When moving backward (higher position to lower position)
        else if (fromPosition > toPosition) {
          // Shift all stitches between toPosition and fromPosition-1 one position higher
          for (let i = fromPosition - 1; i >= toPosition; i--) {
            if (updatedPositions[i]) {
              updatedPositions[i + 1] = updatedPositions[i];
              delete updatedPositions[i];
            }
          }
        }
        // If fromPosition === toPosition, nothing to do

        // Put the stitch in its new position
        updatedPositions[toPosition] = stitchToMove;

        // Build a new stitchOrder array for backward compatibility
        const stitchOrder = Object.entries(updatedPositions)
          .sort(([posA], [posB]) => parseInt(posA) - parseInt(posB))
          .map(([_, tubPos]) => tubPos.stitchId);

        // Update the store
        set((state) => {
          if (!state.tubeState) return { lastUpdated: new Date().toISOString() };

          return {
            tubeState: {
              ...state.tubeState,
              tubes: {
                ...state.tubeState.tubes,
                [tubeNum]: {
                  ...state.tubeState.tubes[tubeNum],
                  positions: updatedPositions,
                  stitchOrder,
                  // If moving to position 0, update currentStitchId
                  ...(isMovingToActivePosition && { currentStitchId: stitchToMove.stitchId })
                }
              }
            },
            lastUpdated: new Date().toISOString()
          };
        });
      },
      
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

      // Fetch a single stitch by ID from the API
      fetchStitch: async (stitchId) => {
        const state = get();

        // Check if the stitch is already in the collection
        if (state.contentCollection?.stitches?.[stitchId]) {
          console.log(`Stitch ${stitchId} already in collection, using cached version`);
          return state.contentCollection.stitches[stitchId] as unknown as StitchContent;
        }

        try {
          console.log(`Fetching stitch ${stitchId} from API`);
          const stitch = await fetchSingleStitch(stitchId);

          if (stitch) {
            // Add the stitch to the collection
            get().addStitchToCollection(stitch);
            return stitch;
          }

          console.warn(`Stitch ${stitchId} not found`);
          return null;
        } catch (error) {
          console.error(`Error fetching stitch ${stitchId}:`, error);
          return null;
        }
      },

      // Fetch a batch of stitches from the API
      fetchStitchBatch: async (stitchIds) => {
        try {
          console.log(`Fetching ${stitchIds.length} stitches from API`);
          const stitches = await fetchStitchBatch(stitchIds);

          // Add all fetched stitches to the collection
          Object.values(stitches).forEach(stitch => {
            get().addStitchToCollection(stitch);
          });

          return stitches;
        } catch (error) {
          console.error('Error fetching stitch batch:', error);
          return {};
        }
      },

      // Add a stitch to the collection
      addStitchToCollection: (stitch) => set((state) => {
        if (!stitch || !stitch.id) return { lastUpdated: new Date().toISOString() };

        // Create content collection if it doesn't exist
        const collection = state.contentCollection || { stitches: {}, questions: {} };

        // Add the stitch to the collection
        const updatedCollection = {
          ...collection,
          stitches: {
            ...collection.stitches,
            [stitch.id]: {
              stitchId: stitch.id,
              title: stitch.title || '',
              content: stitch.content || '',
              questions: stitch.questions || [],
              threadId: stitch.threadId || '',
              order: stitch.order || 0,
              skipNumber: 3, // Default skip number
              distractorLevel: 1, // Default distractor level
              completionHistory: [],
              isRetired: false
            }
          }
        };

        return {
          contentCollection: updatedCollection,
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
      
      // Helper function to extract minimal stitch positions from the array format
      extractStitchPositions: (stitches = []) => {
        if (!Array.isArray(stitches)) return {};

        return stitches.reduce((acc, stitch) => {
          if (stitch && stitch.id) {
            acc[stitch.id] = {
              position: stitch.position || 0,
              skipNumber: stitch.skipNumber || 3,
              distractorLevel: stitch.distractorLevel || 'L1'
            };
          }
          return acc;
        }, {});
      },

      // Helper function to convert positions object to legacy stitches array
      convertPositionsToStitches: (positions = {}) => {
        if (!positions || typeof positions !== 'object') return [];

        return Object.entries(positions).map(([position, tubePosition]) => ({
          id: tubePosition.stitchId,
          position: parseInt(position),
          skipNumber: tubePosition.skipNumber,
          distractorLevel: tubePosition.distractorLevel,
          perfectCompletions: tubePosition.perfectCompletions
        }));
      },

      // Helper function to extract minimal state
      extractMinimalState: (state) => {
        const minimalState = {
          userId: state.userInformation?.userId,
          activeTube: state.tubeState?.activeTube || 1,
          activeTubeNumber: state.tubeState?.activeTubeNumber || 1,
          tubes: {},
          points: {
            session: state.learningProgress?.evoPoints || 0,
            lifetime: state.learningProgress?.evoPoints || 0
          },
          cycleCount: state.tubeState?.cycleCount || 0,
          lastUpdated: state.lastUpdated
        };

        // Include only essential tube data
        if (state.tubeState?.tubes) {
          Object.entries(state.tubeState.tubes).forEach(([tubeKey, tube]) => {
            if (tube) {
              // Get positions for this tube, either directly or by converting from stitchOrder
              const positions = tube.positions || get().getStitchPositions(Number(tubeKey) as 1 | 2 | 3);

              // Convert positions to the legacy stitches array format
              const stitches = positions ? get().convertPositionsToStitches(positions) : [];

              minimalState.tubes[tubeKey] = {
                currentStitchId: tube.currentStitchId,
                threadId: tube.threadId,
                // Include both legacy stitchPositions and the new positions format
                stitchPositions: positions || {},
                // Also include the legacy stitches array for backward compatibility
                stitches: stitches
              };
            }
          });
        }

        return minimalState;
      },

      syncToServer: async () => {
        const state = get();

        // Ensure state is saved to localStorage first
        get().saveToLocalStorage();

        if (!state.userInformation?.userId) {
          console.error('Cannot sync to server: No user ID available');
          return false;
        }

        try {
          // Extract minimal state for API call
          const minimalState = get().extractMinimalState(state);

          // Prepare the data for server sync
          const syncData = {
            state: minimalState
          };

          // Log payload size for debugging
          const payloadSize = JSON.stringify(syncData).length;
          console.log(`Syncing minimal state to server (payload: ${payloadSize} bytes)`);

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
          const isAnonymous = userId.startsWith('anonymous');
          console.log(`Loading state from server for ${isAnonymous ? 'anonymous' : 'authenticated'} user ${userId}`);

          // Fetch state from server - for both anonymous and authenticated users
          // The server will return default starting state for anonymous users
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

          // Extract tube state with position-based model
          const tubeState = {
            activeTube: loadedState.activeTube || loadedState.activeTubeNumber || 1,
            activeTubeNumber: loadedState.activeTubeNumber || loadedState.activeTube || 1,
            cycleCount: loadedState.cycleCount || 0,
            tubes: {}
          };

          // Process tube data with proper position handling
          if (loadedState.tubes) {
            Object.entries(loadedState.tubes).forEach(([tubeKey, tubeData]) => {
              if (!tubeData) return;

              // Cast to proper type
              const tube = tubeData as any;

              // Create the tube object with proper structure
              tubeState.tubes[tubeKey] = {
                currentStitchId: tube.currentStitchId || '',
                threadId: tube.threadId || '',
                stitchOrder: []
              };

              // Process positions based on what data is available
              if (tube.stitchPositions && typeof tube.stitchPositions === 'object') {
                // New format: explicit positions as an object
                tubeState.tubes[tubeKey].positions = {};

                // Convert to our TubePosition format
                Object.entries(tube.stitchPositions).forEach(([position, data]) => {
                  // Cast position to number and normalize to our format
                  const pos = parseInt(position);
                  const posData = data as any;

                  if (typeof posData === 'object' && posData.stitchId) {
                    // Direct format match
                    tubeState.tubes[tubeKey].positions[pos] = {
                      stitchId: posData.stitchId,
                      skipNumber: posData.skipNumber || get().stitchProgressionConfig.initialSkipNumber,
                      distractorLevel: posData.distractorLevel || get().stitchProgressionConfig.initialDistractorLevel,
                      perfectCompletions: posData.perfectCompletions || 0,
                      lastCompleted: posData.lastCompleted
                    };
                  } else if (typeof posData === 'string') {
                    // Simplified format, just the stitchId
                    tubeState.tubes[tubeKey].positions[pos] = {
                      stitchId: posData,
                      skipNumber: get().stitchProgressionConfig.initialSkipNumber,
                      distractorLevel: get().stitchProgressionConfig.initialDistractorLevel,
                      perfectCompletions: 0
                    };
                  }
                });

                // Also build stitchOrder array for backward compatibility
                tubeState.tubes[tubeKey].stitchOrder = Object.entries(tubeState.tubes[tubeKey].positions)
                  .sort(([posA], [posB]) => parseInt(posA) - parseInt(posB))
                  .map(([_, tubPos]) => tubPos.stitchId);
              } else if (tube.stitches && Array.isArray(tube.stitches)) {
                // Legacy format: array of stitch objects
                // Convert to positions object
                tubeState.tubes[tubeKey].positions = {};

                // First sort stitches by position (if available)
                const sortedStitches = [...tube.stitches].sort((a, b) =>
                  (a.position !== undefined ? a.position : 999) -
                  (b.position !== undefined ? b.position : 999)
                );

                // Build stitchOrder for backward compatibility
                const stitchOrder = [];

                // Process each stitch
                sortedStitches.forEach((stitch, index) => {
                  if (!stitch || !stitch.id) return;

                  // Use position from stitch if available, otherwise use array index
                  const position = stitch.position !== undefined ? stitch.position : index;

                  // Add to positions
                  tubeState.tubes[tubeKey].positions[position] = {
                    stitchId: stitch.id,
                    skipNumber: stitch.skipNumber || get().stitchProgressionConfig.initialSkipNumber,
                    distractorLevel: stitch.distractorLevel || get().stitchProgressionConfig.initialDistractorLevel,
                    perfectCompletions: stitch.perfectCompletions || 0,
                    lastCompleted: stitch.lastCompleted
                  };

                  // Add to stitchOrder
                  stitchOrder.push(stitch.id);
                });

                // Set stitchOrder for backward compatibility
                tubeState.tubes[tubeKey].stitchOrder = stitchOrder;
              } else if (tube.stitchOrder && Array.isArray(tube.stitchOrder)) {
                // Only stitchOrder array available
                // Build positions from stitchOrder
                tubeState.tubes[tubeKey].stitchOrder = tube.stitchOrder;
                tubeState.tubes[tubeKey].positions = {};

                // Create basic positions for each stitch in order
                tube.stitchOrder.forEach((stitchId, index) => {
                  if (!stitchId) return;

                  tubeState.tubes[tubeKey].positions[index] = {
                    stitchId,
                    skipNumber: get().stitchProgressionConfig.initialSkipNumber,
                    distractorLevel: get().stitchProgressionConfig.initialDistractorLevel,
                    perfectCompletions: 0
                  };
                });
              }

              // Ensure currentStitchId is set to position 0 if not specified
              if (!tubeState.tubes[tubeKey].currentStitchId &&
                  tubeState.tubes[tubeKey].positions &&
                  tubeState.tubes[tubeKey].positions[0]) {
                tubeState.tubes[tubeKey].currentStitchId = tubeState.tubes[tubeKey].positions[0].stitchId;
              }
            });
          }

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