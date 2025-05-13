/**
 * Zenjin State Types
 * 
 * Core type definitions for the Zenjin Maths app state, based on the
 * refined models from the handover documentation.
 */

// 1. User Information
export interface UserInformation {
  userId: string; // Unique identifier (anonymous or authenticated)
  isAnonymous: boolean; // Whether this is an anonymous user
  displayName?: string; // User's name (if available)
  email?: string; // User's email (for authenticated users)
  createdAt: string; // ISO 8601 timestamp - When the account was created
  lastActive: string; // ISO 8601 timestamp - Last activity timestamp
}

// 2. Tube State
export interface TubePosition {
  stitchId: string;
  skipNumber: number;
  distractorLevel: number;
  perfectCompletions: number;
  lastCompleted?: string; // ISO 8601 timestamp
}

export interface Tube {
  currentStitchId: string; // The stitchId currently at position zero of this tube.
  stitchOrder: string[]; // Maintained for backward compatibility
  threadId: string; // The thread this tube is currently showing
  positions?: { // New field for explicit position tracking
    [position: number]: TubePosition
  };
}

export interface TubeState {
  activeTube: 1 | 2 | 3; // Currently active tube
  tubes: {
    1: Tube;
    2: Tube;
    3: Tube;
  };
}

// 3. Learning Progress
export interface LearningProgress {
  userId: string; // To associate this progress with a user
  totalTimeSpentLearning: number; // e.g., in seconds. Sum of all SessionData.duration
  evoPoints: number; // Total accumulated raw score
  evolutionLevel: number; // Calculated: evoPoints / currentBlinkSpeed (or a default if blink speed is not yet available)
  currentBlinkSpeed: number; // Rolling average blink speed (e.g., average of previousSessionBlinkSpeeds)
  previousSessionBlinkSpeeds: number[]; // Array storing blink speeds of, e.g., the last 10 sessions
  completedStitchesCount: number; // Total number of unique stitches completed at least once
  perfectScoreStitchesCount: number; // Total number of unique stitches achieved a perfect score on at least once
  overallMasteryLevel?: number; // An aggregated mastery score (logic TBD)
}

// 4. Session Data
export interface SessionData {
  sessionId: string;
  userId: string;
  startTime: string; // ISO 8601
  endTime?: string; // ISO 8601 - When session formally ended
  durationSeconds?: number; // Active play duration in seconds for this session, calculated by endCurrentSession
  firstTimeCorrectAnswersInSessionCount: number; // Count of FTC answers in this session
  stitchesPlayedInSession: Array<{
    stitchId: string;
    score?: number;
    isPerfect?: boolean;
    interactions: number;
  }>;
}

// 5. Content Information
export interface DistractorChoice {
  level: number;         // e.g., 1, 2, 3, 4, 5 (numeric level)
  distractorText: string; // The actual distractor text for this level
}

export interface Question {
  id: string;                    // Unique ID for the question itself (e.g., "q_7x8")
  questionText: string;          // The actual question, e.g., "What is 7 × 8?"
  correctAnswer: string;         // e.g., "56"
  distractorChoices?: DistractorChoice[]; // An array of level-specific distractors (maintained for backward compatibility)
  distractors?: {                // New format matching database structure
    L1: string;
    L2: string;
    L3: string;
    L4?: string;
    L5?: string;
  };
}

export interface StitchCompletionRecord {
  timestamp: string;
  score: number;
  isPerfect: boolean; 
  timeTakenSeconds?: number;
}

export interface Stitch {
  stitchId: string; // Unique identifier (e.g., "stitch_T1_001_01")
  title: string; // The title of the stitch
  content: string; // Descriptive content of the stitch
  questions: Question[]; // Array of questions for this stitch (these are the fixed content)

  // User-specific dynamic properties for this stitch:
  skipNumber: number; // Spaced repetition parameter
  distractorLevel: number; // Current difficulty of distractors for this user
  completionHistory: StitchCompletionRecord[];
  lastPresentedTimestamp?: string; // ISO 8601
  isRetired: boolean; // True if skipNumber has reached the retiredThresholdSkipNumber
  currentScoreInCycle?: number; // Tracks score for the current 20-question cycle if needed
}

export interface ContentCollection {
  stitches: { [stitchId: string]: Stitch }; // All stitch data, including user-specific dynamic parts
  questions: { [questionId: string]: Question }; // All base question data (static)
}

// 6. Stitch Progression Configuration
export interface StitchProgressionConfig {
  initialSkipNumber: number;          // e.g., 3
  skipNumberSequence: number[];       // e.g., [3, 5, 10, 25, 100]
  retiredThresholdSkipNumber: number; // The skipNumber value that signifies a stitch is retired (e.g., 100)
  initialDistractorLevel: number; // e.g., 1. Stitch.distractorLevel starts here and ratchets up.
  perfectScoreCriteria: { required: number; total: number }; // e.g., 20/20
  retiredStitchCadence?: {
    reviewFrequency: string; // Placeholder, e.g., "monthly_first_session"
  };
}

// 7. App Configuration & Preferences
export interface AppConfiguration {
  soundEnabled: boolean; // Whether sounds are enabled
}

// 8. Analytics Data (Consider if this is needed or if LearningProgress/SessionData cover it)
export interface AnalyticsData {
  sessionCount: number; // Total number of sessions
  learningTimes?: { [dayOfWeek: string]: { [hour: string]: number } }; // When the user typically learns
  struggleAreas?: string[]; // Conceptual threads the user struggles with
  strengths?: string[]; // Conceptual threads the user excels at
}

// 9. Subscription & Account Details
export type SubscriptionTier = 'free' | 'premium';

export interface SubscriptionDetails {
  tier: SubscriptionTier;
  isActive: boolean;
  startDate?: string; // ISO 8601 - When this current tier/subscription period started
  endDate?: string;   // ISO 8601 - When this current tier/subscription period is scheduled to end
}