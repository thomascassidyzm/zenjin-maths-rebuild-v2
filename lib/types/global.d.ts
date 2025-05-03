// Global type definitions
interface Window {
  __STITCH_UPDATE_QUEUE: Array<{
    userId: string;
    threadId: string;
    stitchId: string;
    orderNumber: number;
    skipNumber: number;
    distractorLevel: 'L1' | 'L2' | 'L3';
    timestamp?: number;
  }>;
  __TUBE_POSITION_QUEUE: Array<{
    userId: string;
    tubeNumber: number;
    threadId: string;
    timestamp?: number;
  }>;
  __TUBE_DEBUG_STATE: any;
  __SESSION_STATS?: {
    sessionId: string;
    threadId: string;
    stitchId: string;
    totalQuestions: number;
    totalAttempts: number;
    correctAnswers: number;
    firstTimeCorrect: number;
    totalPoints: number;
    blinkSpeed: number; // in seconds
    sessionDuration: number; // in seconds
    multiplier: number;
    goDashboard: boolean;
    questionResults: Array<{
      questionId: string;
      correct: boolean;
      timeToAnswer: number; // in milliseconds
      firstTimeCorrect: boolean;
    }>;
    results: Array<{
      id: string;
      correct: boolean;
      timeToAnswer: number; // in milliseconds
      firstTimeCorrect: boolean;
    }>;
    completedAt: string; // ISO date string
  };
}