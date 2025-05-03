/**
 * Types for distinction-based learning player
 */

/**
 * Represents a distractor set for a question
 * L1: Obviously wrong (easy to distinguish)
 * L2: Common misconception (moderate distinction) 
 * L3: Subtle error (fine distinction)
 */
export interface Distractors {
  L1: string;
  L2: string;
  L3: string;
}

/**
 * Represents a single question in a stitch
 */
export interface Question {
  id: string;
  text: string;
  correctAnswer: string;
  distractors: Distractors;
}

/**
 * Skip sequence for spaced repetition progression
 * Each number represents positions to skip when a stitch is completed perfectly
 * The sequence is capped at 100 as the maximum skip value
 */
export const SKIP_SEQUENCE = [3, 5, 10, 25, 100];

/**
 * Represents a stitch (group of related questions)
 */
export interface Stitch {
  id: string;
  name: string;
  description: string;
  questions: Question[];
}

/**
 * Represents a thread (collection of stitches forming a conceptual learning journey)
 */
export interface Thread {
  id: string;
  name: string;
  description: string;
  stitches: Stitch[];
}

/**
 * Session results for tracking learning progress
 */
export interface SessionResult {
  contentId: string;
  threadId: string;
  stitchId: string;
  questions: {
    id: string;
    correct: boolean;
    timeToAnswer: number;
    firstTimeCorrect: boolean;
  }[];
  completedAt: string;
  totalPoints: number;
  accuracy: number;
}

/**
 * Stitch with user progress information
 */
export interface StitchWithProgress extends Stitch {
  order_number: number;  // 0 means it's the "ready stitch" (next to be played)
  skip_number: number;   // How far to move this stitch when completed perfectly
  distractor_level: 'L1' | 'L2' | 'L3';
}

/**
 * Order map entry for tracking stitch order
 */
export interface OrderMapEntry {
  stitch_id: string;
  order_number: number;
}

/**
 * Thread data with stitches and order map
 */
export interface ThreadData {
  thread_id: string;
  tube_number: number;    // 1, 2, or 3, representing Tube-01, Tube-02, Tube-03
  _virtualTube?: boolean;  // Flag to indicate tube_number was calculated virtually
  _savedTubePosition?: boolean; // Flag to indicate this thread is the saved tube position
  stitches: StitchWithProgress[];
  orderMap: OrderMapEntry[];
}

/**
 * Tube (A, B, or C) that contains threads in the player
 * Each tube has exactly one active thread, and each thread has exactly one ready stitch
 */
export interface TubeData {
  tube_id: string;               // 'tube-A', 'tube-B', 'tube-C'
  current_thread_id: string;     // The thread currently loaded into this tube
  threads: ThreadData[];         // All threads assigned to this tube (usually just one initially)
}

/**
 * Types of sync operations for progress persistence
 */
export enum SyncTiming {
  IMMEDIATE = 'immediate',  // Sync right away
  SCHEDULED = 'scheduled',  // Sync on the regular schedule
  END_OF_SESSION = 'end-of-session' // Sync when the session ends
}