import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import SessionErrorHandler, { ErrorNamespace, ErrorSeverity } from '../errorHandler';

// Types for session data
export interface QuestionResult {
  id: string;
  correct: boolean;
  timeToAnswer: number;
  firstTimeCorrect: boolean;
}

export interface SessionState {
  isActive: boolean;
  startTime: number | null;
  threadId: string | null;
  stitchId: string | null;
  questionResults: QuestionResult[];
  points: number;
  blinkSpeed: number | null;
  userId: string | null;
}

export interface SessionSummary {
  totalQuestions: number;
  correctAnswers: number;
  firstTimeCorrect: number;
  basePoints: number;
  blinkSpeed: number;
  bonuses: {
    consistency: number;
    speed: number;
    accuracy: number;
    mastery: number;
    isEligible: boolean;
    messages: string[];
  };
  multiplier: number;
  totalPoints: number;
  evolutionLevel: number;
  evolutionProgress: number;
}

export interface SessionContextType {
  sessionState: SessionState;
  startSession: (params: Partial<SessionState>) => void;
  updateSessionState: (updates: Partial<SessionState>) => void;
  recordQuestionResult: (result: QuestionResult) => void;
  addPoints: (pointsToAdd: number) => void;
  completeSession: (params?: Partial<SessionState>) => Promise<{
    success: boolean;
    summary?: SessionSummary;
    error?: string;
  }>;
  endSession: (params?: Partial<SessionState>) => Promise<{
    success: boolean;
    summary?: SessionSummary;
    error?: string;
  }>;
  calculateSessionMetrics: () => {
    totalQuestions: number;
    correctAnswers: number;
    firstTimeCorrect: number;
    blinkSpeed: number;
    accuracy: number;
    sessionDuration: number;
  };
}

// Initial session state
const initialSessionState: SessionState = {
  isActive: false,
  startTime: null,
  threadId: null,
  stitchId: null,
  questionResults: [],
  points: 0,
  blinkSpeed: null,
  userId: null
};

// Create context with undefined default
const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Helper function to save session data to localStorage for anonymous users
const saveAnonymousSession = (userId: string, points: number, blinkSpeed: number | null, results: QuestionResult[]) => {
  if (typeof window === 'undefined') return false;

  try {
    if (!userId || !userId.startsWith('anon-')) return false;

    console.log('Saving anonymous session data for ID:', userId);

    // Store session data
    const sessionData = {
      totalPoints: points,
      blinkSpeed: blinkSpeed || 2.5,
      blinkSpeedTrend: 'steady',
      lastSessionDate: new Date().toISOString(),
      completedQuestions: results.length
    };

    // Save to localStorage
    localStorage.setItem(`sessionData_${userId}`, JSON.stringify(sessionData));

    // Get existing progress data or create new if doesn't exist
    const existingProgressData = localStorage.getItem(`progressData_${userId}`);
    let progressData = existingProgressData 
      ? JSON.parse(existingProgressData) 
      : {
          totalPoints: 0,
          blinkSpeed: 0,
          blinkSpeedTrend: 'steady',
          evolution: {
            currentLevel: 'Mind Spark',
            levelNumber: 1,
            progress: 0,
            nextLevel: 'Thought Weaver'
          }
        };

    // Update progress data
    progressData.totalPoints = (progressData.totalPoints || 0) + points;
    progressData.blinkSpeed = blinkSpeed || progressData.blinkSpeed;

    // Calculate evolution
    const totalPoints = progressData.totalPoints;
    const levelNumber = Math.floor(totalPoints / 1000) + 1; // Level up every 1000 points
    const progress = (totalPoints % 1000) / 10; // 0-100% within level

    // Update evolution data
    progressData.evolution = {
      currentLevel: getLevelName(levelNumber),
      levelNumber: levelNumber,
      progress: progress,
      nextLevel: getLevelName(levelNumber + 1)
    };

    // Save updated progress data
    localStorage.setItem(`progressData_${userId}`, JSON.stringify(progressData));

    console.log('Anonymous progress data saved successfully:', progressData);
    return true;
  } catch (error) {
    console.error('Failed to save anonymous session data:', error);
    return false;
  }
};

// Helper function to get level name based on level number
const getLevelName = (level: number): string => {
  const levels = [
    'Mind Spark',
    'Thought Weaver',
    'Pattern Seeker',
    'Vision Runner',
    'Logic Sculptor',
    'Equation Master',
    'Theorem Hunter',
    'Quantum Thinker',
    'Dimension Walker',
    'Math Oracle'
  ];

  // Ensure we don't go out of bounds
  if (level <= 0) return levels[0];
  if (level > levels.length) return levels[levels.length - 1];

  return levels[level - 1];
};

// Calculate a fallback session summary when the API fails
const calculateFallbackSummary = (
  sessionState: SessionState,
  params?: Partial<SessionState>
): SessionSummary => {
  const allResults = [...sessionState.questionResults];
  const totalQuestions = new Set(allResults.map(r => r.id)).size;
  const correctAnswers = allResults.filter(r => r.correct).length;
  const firstTimeCorrect = allResults.filter(r => r.firstTimeCorrect).length;
  const eventuallyCorrect = correctAnswers - firstTimeCorrect;

  // Calculate base points
  const basePoints = (firstTimeCorrect * 3) + eventuallyCorrect;

  // Simple blink speed calculation
  const correctTimes = allResults
    .filter(r => r.correct)
    .map(r => r.timeToAnswer);
  const blinkSpeed = correctTimes.length > 0 
    ? correctTimes.reduce((sum, time) => sum + time, 0) / correctTimes.length / 1000
    : 2.5;

  // Basic multiplier calculation
  const bonuses = {
    consistency: 0,
    speed: correctTimes.length > 0 && blinkSpeed < 2 ? 0.5 : 0,
    accuracy: correctAnswers / Math.max(totalQuestions, 1) > 0.8 ? 0.5 : 0,
    mastery: firstTimeCorrect / Math.max(totalQuestions, 1) > 0.7 ? 0.5 : 0,
    isEligible: true,
    messages: []
  };

  // Add appropriate bonus messages
  if (bonuses.speed > 0) bonuses.messages.push('Speed Bonus: Quick answers earn extra points!');
  if (bonuses.accuracy > 0) bonuses.messages.push('Accuracy Bonus: Great precision earns extra points!');
  if (bonuses.mastery > 0) bonuses.messages.push('Mastery Bonus: First-time correct answers earn extra points!');

  // Calculate multiplier - start with 1.0 base and add bonuses
  const multiplier = 1.0 + bonuses.consistency + bonuses.speed + bonuses.accuracy + bonuses.mastery;

  // Calculate total points
  const totalPoints = Math.round(basePoints * multiplier);

  // Calculate evolution level based on total points (including current session)
  // This is a simplified calculation compared to what the server might do
  const cumulativePoints = (sessionState.points || 0) + (params?.points || 0) + totalPoints;
  const evolutionLevel = Math.floor(cumulativePoints / 1000) + 1;
  const evolutionProgress = (cumulativePoints % 1000) / 10;

  return {
    totalQuestions,
    correctAnswers,
    firstTimeCorrect,
    basePoints,
    blinkSpeed,
    bonuses,
    multiplier,
    totalPoints,
    evolutionLevel,
    evolutionProgress
  };
};

// Provider component
export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Session state
  const [sessionState, setSessionState] = useState<SessionState>(initialSessionState);
  
  // Track API requests to prevent duplicates
  const pendingApiRequestRef = useRef<boolean>(false);

  // Start a new session with given parameters
  const startSession = useCallback((params: Partial<SessionState>) => {
    setSessionState({
      ...initialSessionState,
      isActive: true,
      startTime: Date.now(),
      ...params,
      questionResults: []
    });
    console.log('Started new session:', params);
  }, []);

  // Update session state with partial updates
  const updateSessionState = useCallback((updates: Partial<SessionState>) => {
    setSessionState(prevState => ({
      ...prevState,
      ...updates
    }));
  }, []);

  // Record a question result
  const recordQuestionResult = useCallback((result: QuestionResult) => {
    setSessionState(prevState => ({
      ...prevState,
      questionResults: [...prevState.questionResults, result]
    }));
  }, []);

  // Add points to the session
  const addPoints = useCallback((pointsToAdd: number) => {
    setSessionState(prevState => ({
      ...prevState,
      points: (prevState.points || 0) + pointsToAdd
    }));
  }, []);

  // Calculate session metrics
  const calculateSessionMetrics = useCallback(() => {
    const results = sessionState.questionResults;
    const uniqueQuestionIds = new Set(results.map(r => r.id));
    const totalQuestions = uniqueQuestionIds.size;
    const correctAnswers = results.filter(r => r.correct).length;
    const firstTimeCorrect = results.filter(r => r.firstTimeCorrect).length;
    
    // Calculate blink speed (average time for correct answers)
    const correctTimes = results
      .filter(r => r.correct)
      .map(r => r.timeToAnswer);
    const blinkSpeed = correctTimes.length > 0 
      ? correctTimes.reduce((sum, time) => sum + time, 0) / correctTimes.length / 1000
      : sessionState.blinkSpeed || 2.5;
    
    // Calculate accuracy
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    
    // Calculate session duration (in seconds)
    const sessionDuration = sessionState.startTime 
      ? Math.round((Date.now() - sessionState.startTime) / 1000)
      : 0;
    
    return {
      totalQuestions,
      correctAnswers,
      firstTimeCorrect,
      blinkSpeed,
      accuracy,
      sessionDuration
    };
  }, [sessionState]);

  // Complete a session (internal API call)
  const completeSession = useCallback(async (params?: Partial<SessionState>) => {
    // Prevent duplicate API calls
    if (pendingApiRequestRef.current) {
      console.log('API request already in progress, skipping duplicate call');
      return { 
        success: false, 
        error: 'API request already in progress' 
      };
    }

    // Mark session as inactive
    setSessionState(prevState => ({
      ...prevState,
      isActive: false,
      ...params
    }));

    // Get effective userId, preferring the one from params if provided
    const effectiveUserId = params?.userId || sessionState.userId;
    const isAnonymous = !effectiveUserId || effectiveUserId.startsWith('anon-');

    // Calculate session metrics
    const metrics = calculateSessionMetrics();
    const { 
      totalQuestions, 
      correctAnswers, 
      firstTimeCorrect, 
      blinkSpeed, 
      accuracy, 
      sessionDuration 
    } = metrics;

    // Calculate total points for this session
    const points = sessionState.points || 0;

    // For anonymous users, save to localStorage
    if (isAnonymous && effectiveUserId) {
      saveAnonymousSession(
        effectiveUserId,
        points,
        blinkSpeed,
        sessionState.questionResults
      );
      
      // Return success with calculated summary
      return {
        success: true,
        summary: calculateFallbackSummary(sessionState, params)
      };
    }

    // For authenticated users, make API call
    try {
      pendingApiRequestRef.current = true;

      // Use the consolidated session complete endpoint
      const response = await fetch('/api/session/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: effectiveUserId,
          threadId: sessionState.threadId,
          stitchId: sessionState.stitchId,
          questionResults: sessionState.questionResults,
          sessionDuration,
          correctAnswers,
          totalQuestions,
          firstTimeCorrect,
          points,
          blinkSpeed,
          isExplicitEnd: !!params // If params provided, this is explicit end
        }),
        credentials: 'include'
      });

      pendingApiRequestRef.current = false;

      if (!response.ok) {
        console.error('Error completing session, status:', response.status);
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        summary: result.summary
      };
    } catch (error) {
      pendingApiRequestRef.current = false;
      
      // Use the error handler for consistent logging
      SessionErrorHandler.logError(
        'Error completing session via API',
        ErrorNamespace.SESSION,
        ErrorSeverity.ERROR,
        error,
        {
          userId: effectiveUserId,
          threadId: sessionState.threadId || params?.threadId,
          stitchId: sessionState.stitchId || params?.stitchId,
          action: 'completeSession',
          metadata: {
            questionCount: sessionState.questionResults.length,
            points: sessionState.points,
            isAnonymous
          }
        }
      );

      // Fallback to localStorage for anonymous users on API failure
      if (isAnonymous && effectiveUserId) {
        try {
          saveAnonymousSession(
            effectiveUserId,
            points,
            blinkSpeed,
            sessionState.questionResults
          );
        } catch (storageError) {
          // Log storage error but continue with fallback summary
          SessionErrorHandler.logError(
            'Failed to save anonymous session data as fallback',
            ErrorNamespace.STORAGE,
            ErrorSeverity.CRITICAL,
            storageError,
            { userId: effectiveUserId }
          );
        }
      }

      // Return error with fallback summary
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: calculateFallbackSummary(sessionState, params)
      };
    }
  }, [sessionState, calculateSessionMetrics]);

  // End session (user-initiated)
  const endSession = useCallback(async (params?: Partial<SessionState>) => {
    console.log('User explicitly ending session');
    
    // Complete the session with explicit end flag
    const result = await completeSession({
      ...params,
      isActive: false
    });
    
    return result;
  }, [completeSession]);

  // Create context value
  const contextValue: SessionContextType = {
    sessionState,
    startSession,
    updateSessionState,
    recordQuestionResult,
    addPoints,
    completeSession,
    endSession,
    calculateSessionMetrics
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
};

// Custom hook to use session context
export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};