/**
 * Zustand Store Types
 * 
 * Core types for the state management system that mirror existing structure
 * while providing improved typesafety
 */

// Base tube structure
export interface Tube {
  threadId: string;
  currentStitchId: string;
  position: number;
  stitches?: StitchPosition[];
}

// Maps to existing tube objects for compatibility
export interface TubeState {
  tubes: {
    [tubeNumber: string]: Tube;
  };
  activeTube: number;
  activeTubeNumber: number; // Duplicated for compatibility
  cycleCount: number;
}

// Learning progress data
export interface LearningProgress {
  points: {
    session: number;
    lifetime: number;
  };
  blinkSpeed: number;
  evolutionLevel: number;
  totalStitchesCompleted: number;
  perfectScores: number;
}

// User identification information
export interface UserInformation {
  userId: string;
  isAnonymous: boolean;
  displayName?: string;
  email?: string;
  lastLogin?: string;
}

// Stitch position within a tube
export interface StitchPosition {
  id: string;
  threadId: string;
  position: number;
  skipNumber: number;
  distractorLevel: string;
  isCurrentTube?: boolean;
}

// Complete app state
export interface AppState {
  userInformation: UserInformation | null;
  tubeState: TubeState | null;
  learningProgress: LearningProgress | null;
  lastUpdated: string;
  isInitialized: boolean;
}