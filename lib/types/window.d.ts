/**
 * Global window extensions for Zenjin Maths application
 */

/**
 * Session statistics collected during gameplay
 */
interface SessionStats {
  sessionId: string;
  threadId: string;
  stitchId: string;
  totalQuestions: number;
  totalAttempts: number;
  correctAnswers: number;
  firstTimeCorrect: number;
  totalPoints: number;
  blinkSpeed: number; // Average time in seconds for correct answers
  sessionDuration: number; // Session duration in seconds
  multiplier?: number; // Bonus multiplier
  goDashboard: boolean; // Flag to indicate navigation to dashboard
  questionResults: Array<{
    questionId: string;
    correct: boolean;
    timeToAnswer: number;
    firstTimeCorrect: boolean;
  }>;
  results: Array<{
    id: string;
    correct: boolean;
    timeToAnswer: number;
    firstTimeCorrect: boolean;
  }>;
  completedAt: string;
}

/**
 * Window interface extension to include Zenjin-specific global properties
 */
interface Window {
  __SESSION_STATS__?: SessionStats;
}