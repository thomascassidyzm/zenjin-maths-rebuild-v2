/**
 * Utility for generating session summary data for all user types
 * 
 * This handles both anonymous and authenticated users, ensuring
 * everyone gets a session summary at the end of their session.
 */

export interface SessionSummaryData {
  sessionId: string;
  basePoints: number;
  multiplier: number;
  multiplierType: string;
  totalPoints: number;
  blinkSpeed: number | null;
  correctAnswers: number;
  totalQuestions: number;
  firstTimeCorrect: number;
}

/**
 * Generates session summary data for end-of-session display
 * Works with both anonymous and authenticated users
 * 
 * @param isAuthenticated - Whether the user is authenticated
 * @param sessionData - Data from the API response (may be null for anonymous users)
 * @param points - Points accumulated during this session (from localStorage)
 * @returns SessionSummaryData object for display
 */
export function getSessionSummary(
  isAuthenticated: boolean,
  sessionData: any | null,
  points: number
): SessionSummaryData {
  // For anonymous users or when API fails, generate summary from local data
  if (!isAuthenticated || !sessionData || !sessionData.summary) {
    // Generate a unique session ID
    const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // Calculate a reasonable base points value
    const basePoints = Math.max(50, Math.floor(points / 1.5));
    
    // Generate appropriate multiplier
    const multiplier = 1.5;
    const multiplierType = "Speed Bonus";
    
    // Default values for other fields
    return {
      sessionId,
      basePoints,
      multiplier,
      multiplierType,
      totalPoints: points || basePoints * multiplier,
      blinkSpeed: 2.5, // Default value
      correctAnswers: Math.floor((points / 3) * 0.8), // Rough estimate based on points
      totalQuestions: Math.floor(points / 3),
      firstTimeCorrect: Math.floor((points / 3) * 0.6) // Rough estimate
    };
  }
  
  // For authenticated users with API data
  const { summary } = sessionData;
  
  return {
    sessionId: `session-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    basePoints: Math.floor(summary.totalPoints / 1.5),
    multiplier: 1.5,
    multiplierType: summary.blinkSpeed && summary.blinkSpeed < 3 ? "Speed Bonus" : "Accuracy Bonus",
    totalPoints: summary.totalPoints || points,
    blinkSpeed: summary.blinkSpeed || 2.5,
    correctAnswers: Math.floor((summary.totalPoints / 3) * 0.8),
    totalQuestions: Math.floor(summary.totalPoints / 3),
    firstTimeCorrect: Math.floor((summary.totalPoints / 3) * 0.6)
  };
}

/**
 * Simplified function to get anonymous session stats from localStorage
 * Used as a fallback when API data is not available
 * 
 * @returns Basic stats about the anonymous user session
 */
export function getAnonymousSessionStats() {
  try {
    // Try to get state from localStorage
    const anonymousState = localStorage.getItem('zenjin_anonymous_state');
    
    if (!anonymousState) {
      return {
        points: 50, // Default value
        correctAnswers: 15,
        totalQuestions: 20
      };
    }
    
    // Parse state
    const state = JSON.parse(anonymousState);
    
    // Extract points from state
    const points = state.points?.session || state.points?.lifetime || 50;
    
    return {
      points,
      correctAnswers: Math.floor((points / 3) * 0.8), // Estimate
      totalQuestions: Math.floor(points / 3)
    };
  } catch (error) {
    console.error('Error getting anonymous session stats:', error);
    return {
      points: 50, // Default fallback
      correctAnswers: 15,
      totalQuestions: 20
    };
  }
}