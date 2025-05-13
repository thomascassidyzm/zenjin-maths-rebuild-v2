import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  UserInformation, TubeState, LearningProgress,
  SessionData, ContentCollection, StitchProgressionConfig,
  AppConfiguration, SubscriptionDetails, Stitch, TubePosition
} from './types';
import { fetchStitchBatch, fetchSingleStitch } from './stitchActions';
import { StitchContent } from '../client/content-buffer';
import { fillInitialBuffer, fillCompleteBuffer } from '../server-content-provider';

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
  contentBufferStatus: ContentBufferStatus;

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
  
  // Two-phase content buffer loading
  fillInitialContentBuffer: () => Promise<void>;
  fillCompleteContentBuffer: () => Promise<void>;
  getActiveStitch: () => Promise<StitchContent | null>;
  updateContentBufferStatus: (updates: Partial<ContentBufferStatus>) => void;

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

// Content buffer status tracking
interface ContentBufferStatus {
  phase1Loaded: boolean;
  phase2Loaded: boolean;
  phase1Loading: boolean;
  phase2Loading: boolean;
  activeStitchLoaded: boolean;
  lastUpdated: string;
  stats: {
    totalStitchesLoaded: number;
    phase1StitchCount: number;
    phase2StitchCount: number;
  };
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

const defaultContentBufferStatus: ContentBufferStatus = {
  phase1Loaded: false,
  phase2Loaded: false,
  phase1Loading: false,
  phase2Loading: false,
  activeStitchLoaded: false,
  lastUpdated: new Date().toISOString(),
  stats: {
    totalStitchesLoaded: 0,
    phase1StitchCount: 0,
    phase2StitchCount: 0
  }
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
      contentBufferStatus: defaultContentBufferStatus,
      
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
        const previousSpeeds = [...(state.learningProgress.previousSessionBlinkSpeeds || []), newSessionBlinkSpeed];
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
            completedStitchesCount: (state.learningProgress.completedStitchesCount || 0) + 1,
            perfectScoreStitchesCount: isPerfectScore 
              ? (state.learningProgress.perfectScoreStitchesCount || 0) + 1 
              : (state.learningProgress.perfectScoreStitchesCount || 0)
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
            
            // Update buffer statistics
            get().updateContentBufferStatus({
              stats: {
                ...state.contentBufferStatus.stats,
                totalStitchesLoaded: state.contentBufferStatus.stats.totalStitchesLoaded + 1
              }
            });
            
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
        const state = get();
        
        try {
          console.log(`Fetching ${stitchIds.length} stitches from API`);
          const stitches = await fetchStitchBatch(stitchIds);

          // Add all fetched stitches to the collection
          Object.values(stitches).forEach(stitch => {
            get().addStitchToCollection(stitch);
          });
          
          // Update buffer statistics
          get().updateContentBufferStatus({
            stats: {
              ...state.contentBufferStatus.stats,
              totalStitchesLoaded: state.contentBufferStatus.stats.totalStitchesLoaded + stitchIds.length
            }
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
      
      // Two-phase content buffer loading
      fillInitialContentBuffer: async () => {
        const state = get();
        
        // Skip if no tube state or already loading
        if (!state.tubeState || state.contentBufferStatus.phase1Loading) {
          return;
        }
        
        // Update loading status
        get().updateContentBufferStatus({
          phase1Loading: true
        });
        
        try {
          // Count stitches before loading
          const beforeCount = state.contentCollection ? 
            Object.keys(state.contentCollection.stitches || {}).length : 0;
          
          // Fill the initial buffer with 10 stitches per tube
          await fillInitialBuffer(state.tubeState, get().fetchStitchBatch);
          
          // Count stitches after loading
          const afterCount = state.contentCollection ? 
            Object.keys(state.contentCollection.stitches || {}).length : 0;
          
          // Calculate how many new stitches were loaded
          const newStitchesLoaded = afterCount - beforeCount;
          
          // Update buffer status
          get().updateContentBufferStatus({
            phase1Loading: false,
            phase1Loaded: true,
            activeStitchLoaded: true,
            stats: {
              ...state.contentBufferStatus.stats,
              phase1StitchCount: newStitchesLoaded
            }
          });
          
          console.log(`Phase 1 loading complete. Loaded ${newStitchesLoaded} stitches.`);
        } catch (error) {
          console.error('Error filling initial content buffer:', error);
          
          // Update status to show loading failed
          get().updateContentBufferStatus({
            phase1Loading: false
          });
        }
      },
      
      fillCompleteContentBuffer: async () => {
        const state = get();
        
        // Skip if no tube state, already loaded, or already loading
        if (!state.tubeState || state.contentBufferStatus.phase2Loaded || 
            state.contentBufferStatus.phase2Loading) {
          return;
        }
        
        // Make sure Phase 1 is loaded first
        if (!state.contentBufferStatus.phase1Loaded) {
          await get().fillInitialContentBuffer();
        }
        
        // Update loading status
        get().updateContentBufferStatus({
          phase2Loading: true
        });
        
        try {
          // Count stitches before loading
          const beforeCount = state.contentCollection ? 
            Object.keys(state.contentCollection.stitches || {}).length : 0;
          
          // Fill the complete buffer with up to 50 stitches per tube
          await fillCompleteBuffer(state.tubeState, get().fetchStitchBatch);
          
          // Count stitches after loading
          const afterCount = state.contentCollection ? 
            Object.keys(state.contentCollection.stitches || {}).length : 0;
          
          // Calculate how many new stitches were loaded
          const newStitchesLoaded = afterCount - beforeCount;
          
          // Update buffer status
          get().updateContentBufferStatus({
            phase2Loading: false,
            phase2Loaded: true,
            stats: {
              ...state.contentBufferStatus.stats,
              phase2StitchCount: newStitchesLoaded
            }
          });
          
          console.log(`Phase 2 loading complete. Loaded ${newStitchesLoaded} additional stitches.`);
        } catch (error) {
          console.error('Error filling complete content buffer:', error);
          
          // Update status to show loading failed
          get().updateContentBufferStatus({
            phase2Loading: false
          });
        }
      },
      
      // Get the active stitch (the stitch at position 0 in the active tube)
      getActiveStitch: async () => {
        const state = get();
        
        // Ensure we have tube state
        if (!state.tubeState) {
          console.warn('Cannot get active stitch: No tube state available');
          return null;
        }
        
        // Get the active tube
        const activeTubeNum = state.tubeState.activeTube;
        const tube = state.tubeState.tubes[activeTubeNum];
        
        if (!tube) {
          console.warn(`Cannot get active stitch: Active tube ${activeTubeNum} not found`);
          return null;
        }
        
        // Get the current stitch ID from the active tube
        const currentStitchId = tube.currentStitchId;
        
        if (!currentStitchId) {
          console.warn(`Cannot get active stitch: No current stitch ID in tube ${activeTubeNum}`);
          return null;
        }
        
        // Check if we already have this stitch in the collection
        if (state.contentCollection?.stitches?.[currentStitchId]) {
          // Mark the active stitch as loaded
          if (!state.contentBufferStatus.activeStitchLoaded) {
            get().updateContentBufferStatus({
              activeStitchLoaded: true
            });
          }
          
          return state.contentCollection.stitches[currentStitchId] as unknown as StitchContent;
        }
        
        // Fetch the stitch if not in collection
        console.log(`Fetching active stitch ${currentStitchId} for tube ${activeTubeNum}`);
        const stitch = await get().fetchStitch(currentStitchId);
        
        if (stitch) {
          // Mark the active stitch as loaded
          get().updateContentBufferStatus({
            activeStitchLoaded: true
          });
          
          return stitch;
        }
        
        console.warn(`Failed to fetch active stitch ${currentStitchId}`);
        return null;
      },
      
      // Update content buffer status
      updateContentBufferStatus: (updates) => set((state) => ({
        contentBufferStatus: {
          ...state.contentBufferStatus,
          ...updates,
          lastUpdated: new Date().toISOString()
        }
      })),
      
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
          // Use the FULL state - no need to extract a minimal version
          // The API will handle extracting what it needs

          // Prepare the data for server sync - just pass the full state with explicit userId
          // First make extra sure the positions are present in tube 1
          console.log('SYNC TO SERVER - State check before sync:');
          console.log('UserID:', state.userInformation.userId);
          console.log('Has tubeState:', !!state.tubeState);
          console.log('Has tubes:', state.tubeState && !!state.tubeState.tubes);

          // Check tube 1 specifically
          if (state.tubeState?.tubes?.[1]) {
            console.log('Tube 1 exists with properties:', Object.keys(state.tubeState.tubes[1]));
            console.log('Tube 1 has positions object:', !!state.tubeState.tubes[1].positions);

            // Log detailed position info
            if (state.tubeState.tubes[1].positions) {
              const positions = state.tubeState.tubes[1].positions;
              console.log('TUBES BEFORE SYNC - Tube 1 positions:', Object.keys(positions));

              // Log each position's content
              Object.entries(positions).forEach(([pos, data]) => {
                console.log(`Position ${pos} contains stitch: ${data.stitchId} with skipNumber: ${data.skipNumber}`);
              });
            }
          } else {
            console.log('Tube 1 does not exist in state');
          }

          // Build a clean object with only the necessary fields
          // This avoids any potential issues with circular references or getters
          const stateToSync = {
            userId: state.userInformation.userId,
            userInformation: {
              ...state.userInformation
            },
            tubeState: state.tubeState ? {
              activeTube: state.tubeState.activeTube,
              tubes: {}
            } : null,
            lastUpdated: new Date().toISOString()
          };

          // Manually copy tube data to ensure positions are properly included
          if (state.tubeState?.tubes) {
            for (const tubeKey in state.tubeState.tubes) {
              const tube = state.tubeState.tubes[tubeKey];
              if (!tube) continue;

              // Create a clean tube object
              stateToSync.tubeState.tubes[tubeKey] = {
                threadId: tube.threadId,
                currentStitchId: tube.currentStitchId,
                stitchOrder: [...(tube.stitchOrder || [])],
                positions: {}
              };

              // Explicitly copy positions to ensure they're included
              if (tube.positions) {
                for (const position in tube.positions) {
                  const pos = tube.positions[position];
                  stateToSync.tubeState.tubes[tubeKey].positions[position] = {
                    stitchId: pos.stitchId,
                    skipNumber: pos.skipNumber,
                    distractorLevel: pos.distractorLevel,
                    perfectCompletions: pos.perfectCompletions,
                    lastCompleted: pos.lastCompleted
                  };
                }

                console.log(`Manually copied ${Object.keys(tube.positions).length} positions for tube ${tubeKey}`);
              }
            }
          }

          // Use JSON stringify/parse for a clean deep copy
          const clonedState = JSON.parse(JSON.stringify(stateToSync));

          // Log tube 1 positions after cloning to verify they were preserved
          if (clonedState.tubeState?.tubes?.[1]?.positions) {
            console.log('TUBES AFTER CLONE - Tube 1 positions:', Object.keys(clonedState.tubeState.tubes[1].positions));
          }

          // Create the sync data with our cloned state
          const syncData = {
            state: clonedState,
            id: state.userInformation.userId  // Also add as explicit id field
          };

          // Log debug info
          console.log(`Syncing state to server for user ${state.userInformation.userId}`);

          // Send to server - using simplified API endpoint
          const response = await fetch('/api/simple-state', {
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

          // Fetch state from server - using simplified API endpoint
          const response = await fetch(`/api/simple-state?userId=${encodeURIComponent(userId)}`, {
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

          console.log('Server returned state:', data.state);

          // The server might return a nested state object where state.state contains the actual data
          // Or it might be directly in state
          let loadedState = data.state;

          // Check for nested state structure
          if (data.state.state && typeof data.state.state === 'object') {
            console.log('Detected nested state structure, using state.state');
            loadedState = data.state.state;
          }

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

          // Check for different structures that might contain tube data
          console.log('Looking for tube data in:', loadedState);

          // Log all possible tube data paths for debugging
          console.log('Direct tubes path exists:', !!loadedState.tubes);
          console.log('tubeState.tubes path exists:', !!loadedState.tubeState?.tubes);
          console.log('state.tubeState.tubes path exists:', !!loadedState.state?.tubeState?.tubes);

          // Get detailed info about tube 1 from all possible paths
          if (loadedState.tubes?.[1]) {
            console.log('DIRECT PATH - Tube 1 positions:',
              loadedState.tubes[1].positions ? Object.keys(loadedState.tubes[1].positions) : 'No positions');
          }

          if (loadedState.tubeState?.tubes?.[1]) {
            console.log('TUBESTATE PATH - Tube 1 positions:',
              loadedState.tubeState.tubes[1].positions ? Object.keys(loadedState.tubeState.tubes[1].positions) : 'No positions');
          }

          if (loadedState.state?.tubeState?.tubes?.[1]) {
            console.log('STATE.TUBESTATE PATH - Tube 1 positions:',
              loadedState.state.tubeState.tubes[1].positions ? Object.keys(loadedState.state.tubeState.tubes[1].positions) : 'No positions');
          }

          // Focus on tubeState.tubes since that's where we save the position data
      // Log more debug info about what we're loading
      console.log('LOAD SOURCE EXAMINATION:',
        'tubeState exists:', !!loadedState.tubeState,
        'tubes path exists:', !!loadedState.tubes,
        'state.tubeState exists:', !!loadedState.state?.tubeState);

      // Prioritize path with positions data - examine each path to find the one with positions
      let tubeDataSource = {};

      // Look at all possible paths and prefer the one that has position data for tube 1
      if (loadedState.tubeState?.tubes?.[1]?.positions &&
          Object.keys(loadedState.tubeState.tubes[1].positions).length > 0) {
        console.log('Using tubeState.tubes path with positions:',
          Object.keys(loadedState.tubeState.tubes[1].positions).join(', '));
        tubeDataSource = loadedState.tubeState.tubes;
      } else if (loadedState.tubes?.[1]?.positions &&
                Object.keys(loadedState.tubes[1].positions).length > 0) {
        console.log('Using direct tubes path with positions:',
          Object.keys(loadedState.tubes[1].positions).join(', '));
        tubeDataSource = loadedState.tubes;
      } else if (loadedState.state?.tubeState?.tubes?.[1]?.positions &&
                Object.keys(loadedState.state.tubeState.tubes[1].positions).length > 0) {
        console.log('Using state.tubeState.tubes path with positions:',
          Object.keys(loadedState.state.tubeState.tubes[1].positions).join(', '));
        tubeDataSource = loadedState.state.tubeState.tubes;
      } else {
        // Fallback to any path that has tube data
        console.log('No positions found in any path, falling back to first available tubes data');
        tubeDataSource = loadedState.tubeState?.tubes ||
                       loadedState.tubes ||
                       loadedState.state?.tubeState?.tubes ||
                       {};
      }

          console.log('Using tube data source with tubes:', Object.keys(tubeDataSource));

          // Process tube data with proper position handling
          if (tubeDataSource) {
            Object.entries(tubeDataSource).forEach(([tubeKey, tubeData]) => {
              if (!tubeData) return;

              // Cast to proper type
              const tube = tubeData as any;

              // CRITICAL FIX: PRESERVE POSITIONS BY DIRECTLY COPYING THE TUBE
              // Don't try to rebuild the tube structure, just copy it directly
              // This avoids the position rebuilding logic that's causing positions [4,5] to be replaced with [0,1]
              if (tube.positions && Object.keys(tube.positions).length > 0) {
                console.log(`CRITICAL FIX: Tube ${tubeKey} has positions:`, Object.keys(tube.positions).join(', '));

                // Deep copy the entire tube to preserve all properties, especially positions
                tubeState.tubes[tubeKey] = JSON.parse(JSON.stringify(tube));

                // Verify positions were preserved
                if (tubeState.tubes[tubeKey].positions) {
                  console.log(`CRITICAL FIX: Preserved positions:`, Object.keys(tubeState.tubes[tubeKey].positions).join(', '));
                }

                // Skip the rest of the processing for this tube
                return;
              }

              // For tubes without positions, create standard structure
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

          // Do one final verification of tube positions before setting state
          console.log('FINAL VERIFICATION - Tube state to be loaded:');

          if (tubeState?.tubes?.[1]?.positions) {
            console.log('FINAL VERIFICATION - Tube 1 positions before setting state:',
              Object.keys(tubeState.tubes[1].positions).join(', '));

            // Verify position 5 existence and data
            if (tubeState.tubes[1].positions[5]) {
              console.log('FINAL VERIFICATION - Position 5 exists with data:', {
                stitchId: tubeState.tubes[1].positions[5].stitchId,
                skipNumber: tubeState.tubes[1].positions[5].skipNumber
              });
            } else {
              console.log('FINAL VERIFICATION - Position 5 DOES NOT EXIST in final state');
            }
          } else {
            console.log('FINAL VERIFICATION - No positions found in tube 1');
          }

          // Update the store with the loaded state
          set({
            userInformation,
            tubeState,
            learningProgress,
            lastUpdated: loadedState.lastUpdated || new Date().toISOString(),
            isInitialized: true,
            // Reset buffer status - we'll need to load content after loading state
            contentBufferStatus: {
              ...defaultContentBufferStatus,
              lastUpdated: new Date().toISOString()
            }
          });

          // Verify state was set correctly
          const newState = get();

          console.log('STATE VERIFICATION - After setting state');
          if (newState.tubeState?.tubes?.[1]?.positions) {
            console.log('STATE VERIFICATION - Tube 1 positions after setting state:',
              Object.keys(newState.tubeState.tubes[1].positions).join(', '));

            // Verify position 5 existence and data
            if (newState.tubeState.tubes[1].positions[5]) {
              console.log('STATE VERIFICATION - Position 5 exists with data:', {
                stitchId: newState.tubeState.tubes[1].positions[5].stitchId,
                skipNumber: newState.tubeState.tubes[1].positions[5].skipNumber
              });
            } else {
              console.log('STATE VERIFICATION - Position 5 DOES NOT EXIST in state after setting');
            }
          }

          // Immediately load the active stitch after loading state
          setTimeout(() => {
            get().getActiveStitch().then(() => {
              // Once active stitch is loaded, start phase 1 loading
              get().fillInitialContentBuffer();
            });
          }, 0);

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
        isInitialized: false,
        contentBufferStatus: defaultContentBufferStatus
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
            isInitialized: state.isInitialized,
            contentBufferStatus: state.contentBufferStatus
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
            
            // Immediately load the active stitch after loading state from localStorage
            setTimeout(() => {
              get().getActiveStitch();
            }, 0);
            
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
        isInitialized: state.isInitialized,
        contentBufferStatus: state.contentBufferStatus
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
export const useContentBufferStatus = () => useZenjinStore(state => state.contentBufferStatus);

// Export default for primary usage
export default useZenjinStore;