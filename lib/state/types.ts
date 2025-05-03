/**
 * Core state types for the player application
 * Defines the minimal state model required for persistence
 */

/**
 * Represents the user's state across the application
 * This is the minimal model that must be persisted between sessions
 */
export interface UserState {
  // Tube positions - which thread is active in each tube
  tubes: {
    [tubeNumber: number]: {
      threadId: string;
      currentStitchId: string;
      position: number;
    }
  };
  // Currently active tube (1, 2, or 3)
  activeTube: number;
  // Number of complete cycles through all tubes
  cycleCount: number;
  // Points accumulated
  points: {
    session: number;
    lifetime: number;
  };
  // Last updated timestamp (ISO format)
  lastUpdated: string;
  // User identifier
  userId: string;
}

/**
 * Content-related types
 */
export interface Question {
  id: string;
  stitchId: string;
  text: string;
  correctAnswer: string;
  distractors: {
    L1: string;
    L2: string;
    L3: string;
  };
}

export interface StitchContent {
  id: string;
  threadId: string;
  name: string;
  description: string;
  orderNumber: number;
  skipNumber: number;
  distractorLevel: string;
  questions: Question[];
}

/**
 * Session results tracking
 */
export interface SessionResult {
  stitchId: string;
  threadId: string;
  correctAnswers: number;
  totalQuestions: number;
  firstTimeCorrect: number;
  totalPoints: number;
  completedAt: string;
}

/**
 * State update actions
 */
export type StateAction = 
  | { type: 'INITIALIZE_STATE'; payload: UserState }
  | { type: 'SET_ACTIVE_TUBE'; payload: number }
  | { type: 'COMPLETE_STITCH'; payload: { 
      tubeNumber: number; 
      threadId: string; 
      stitchId: string; 
      nextStitchId: string;
      score: number;
      totalQuestions: number;
      skipNumber?: number;
      distractorLevel?: string;
      isPerfectScore?: boolean;
    }}
  | { type: 'FORCE_STITCH_UPDATE'; payload: {
      tubeNumber: number;
      nextStitchId: string;
      position: number;
    }}
  | { type: 'CYCLE_TUBE'; payload: { 
      fromTube: number; 
      toTube: number; 
    }}
  | { type: 'UPDATE_CYCLE_COUNT'; payload: {
      cycleCount: number;
    }}
  | { type: 'UPDATE_POINTS'; payload: { 
      sessionPoints: number; 
      lifetimePoints: number; 
    }};