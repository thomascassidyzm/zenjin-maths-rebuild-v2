/**
 * Session Metrics Actions for Zustand Store
 * 
 * This file provides API interaction functions for recording session metrics
 * using the tube-stitch model.
 */

import { SessionMetricsData, SessionQuestionResult } from './types';

/**
 * Record session metrics to the server API
 * 
 * @param metrics Session metrics data with tube-based structure
 * @returns Promise resolving to the API response
 */
export const recordSessionMetrics = async (metrics: SessionMetricsData): Promise<any> => {
  try {
    console.log('Recording session metrics:', metrics);
    
    // Convert tube-based metrics to include a derived threadId for backward compatibility
    const tubeId = metrics.tubeId;
    const threadId = `thread-T${tubeId}-001`;
    
    const response = await fetch('/api/record-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...metrics,
        threadId, // Add threadId derived from tubeId for API compatibility
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to record session:', errorData);
      throw new Error(errorData.error || 'Failed to record session');
    }
    
    const data = await response.json();
    console.log('Session metrics recorded successfully:', data);
    return data;
  } catch (error) {
    console.error('Error recording session metrics:', error instanceof Error ? error.message : String(error));
    throw error;
  }
};

/**
 * Creates emergency metrics for offline and fallback scenarios
 */
export const createEmergencySessionMetrics = (metrics: SessionMetricsData): any => {
  // Calculate basic metrics for local handling
  const questionResults = metrics.questionResults || [];
  const totalQuestions = questionResults.length;
  const correctAnswers = questionResults.filter(q => q.correct).length;
  const firstTimeCorrect = questionResults.filter(q => q.firstTimeCorrect).length;
  
  // Calculate points using standard formula
  const basePoints = (firstTimeCorrect * 3) + ((correctAnswers - firstTimeCorrect) * 1);
  const totalPoints = Math.round(basePoints * 1); // Standard multiplier of 1
  
  return {
    success: true,
    sessionId: `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    basePoints,
    multiplier: 1,
    multiplierType: "Standard",
    totalPoints,
    correctAnswers,
    totalQuestions,
    firstTimeCorrect,
    savedToAccount: false,
    storageType: 'local_emergency',
    message: 'Session recorded locally - server connection unavailable'
  };
};

/**
 * Format question results to ensure consistency between different formats
 * Handles both array-based distractorChoices and object-based distractors
 */
export const formatQuestionResults = (questionResults: any[]): SessionQuestionResult[] => {
  return questionResults.map(result => {
    // Basic validation
    if (!result || !result.id) {
      console.warn('Invalid question result format:', result);
      return null;
    }
    
    // Return standardized format
    return {
      questionId: result.id,
      correct: !!result.correct,
      timeToAnswer: result.timeToAnswer || 0,
      firstTimeCorrect: !!result.firstTimeCorrect
    };
  }).filter(Boolean) as SessionQuestionResult[]; // Remove any null results
};

/**
 * Formats question distractors to ensure consistency between different formats
 * Converts between array-based distractorChoices and object-based distractors
 */
export const formatDistractors = (question: any) => {
  // Check which format is being used
  if (question.distractors) {
    // Object-based format from database - convert to array format if needed
    return [
      { level: 1, distractorText: question.distractors.L1 || '' },
      { level: 2, distractorText: question.distractors.L2 || '' },
      { level: 3, distractorText: question.distractors.L3 || '' },
      ...(question.distractors.L4 ? [{ level: 4, distractorText: question.distractors.L4 }] : []),
      ...(question.distractors.L5 ? [{ level: 5, distractorText: question.distractors.L5 }] : [])
    ];
  } else if (question.distractorChoices && Array.isArray(question.distractorChoices)) {
    // Legacy array-based format - convert to object format if needed
    const distractors: Record<string, string> = {};
    question.distractorChoices.forEach((choice: any) => {
      if (choice && typeof choice.level === 'number' && choice.distractorText) {
        distractors[`L${choice.level}`] = choice.distractorText;
      }
    });
    return distractors;
  }
  
  // Fallback for missing distractors
  return {};
};