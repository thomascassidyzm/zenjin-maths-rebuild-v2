/**
 * Bonus Calculator Utility
 * 
 * Calculates session bonuses based on user performance and consistency.
 * Handles both anonymous and authenticated users with appropriate bonuses.
 */

interface SessionData {
  totalQuestions: number;
  totalAttempts: number;
  correctAnswers: number;
  firstTimeCorrect: number;
  averageTimeToAnswer: number;
  sessionDuration: number;
  threadId: string;
  stitchId: string;
}

interface SessionResult {
  id: string;
  correct: boolean;
  timeToAnswer: number;
  firstTimeCorrect: boolean;
  stitchId?: string;
}

interface BonusResult {
  consistency: number;
  speed: number;
  accuracy: number;
  mastery: number;
  isEligible: boolean;
  messages: string[];
}

/**
 * Count number of days with practice in the given window
 */
function countPracticeDays(savedDates: string[], windowDays: number): number {
  // Generate array of last N days
  const daysWindow = [];
  for (let i = 0; i < windowDays; i++) {
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - i);
    daysWindow.push(checkDate.toLocaleDateString());
  }
  
  // Count days with practice
  return daysWindow.filter(date => savedDates.includes(date)).length;
}

/**
 * Calculate all bonuses for a session
 * 
 * @param sessionData - Summary data about the session
 * @param sessionResults - Detailed results of each question
 * @param isAnonymous - Whether the user is anonymous
 * @returns Bonus multipliers and eligibility
 */
export function calculateBonuses(
  sessionData: SessionData, 
  sessionResults: SessionResult[],
  isAnonymous: boolean = false
): BonusResult {
  const bonuses: BonusResult = {
    consistency: 1,    // Consistency bonus multiplier
    speed: 1,          // Speed bonus multiplier
    accuracy: 1,       // Accuracy bonus multiplier
    mastery: 1,        // Mastery bonus multiplier
    isEligible: true,  // Flag for minimum requirements
    messages: []       // Messages to display
  };
  
  // --- ELIGIBILITY CHECK ---
  // Hidden threshold (100 questions) to prevent gaming
  if (sessionData.totalAttempts < 100) {
    bonuses.isEligible = false;
    // No explicit message about the threshold
    bonuses.messages.push("Complete more questions to earn bonus multipliers!");
    return bonuses;
  }
  
  // --- CONSISTENCY BONUS (not for anonymous users) ---
  if (!isAnonymous) {
    try {
      const savedDates = JSON.parse(localStorage.getItem('sessionDates') || '[]');
      const today = new Date().toLocaleDateString();
      
      // Add today if not already present
      if (!savedDates.includes(today)) {
        savedDates.push(today);
        localStorage.setItem('sessionDates', JSON.stringify(savedDates));
      }
      
      // Calculate with forgiveness window
      let daysWithPractice = countPracticeDays(savedDates, 32);
      
      if (daysWithPractice >= 28) {         // 28+ days out of 32
        bonuses.consistency = 30;
        bonuses.messages.push("🌟 LEGENDARY Consistency Bonus! ×30 🌟");
      } else if (daysWithPractice >= 8) {   // 8+ days out of 12
        bonuses.consistency = 10;
        bonuses.messages.push("✨ Incredible Consistency Bonus! ×10 ✨");
      } else if (daysWithPractice >= 3) {   // 3+ days out of 5  
        bonuses.consistency = 3;
        bonuses.messages.push("⭐ Amazing Consistency Bonus! ×3 ⭐");
      }
    } catch (error) {
      console.error("Error calculating consistency bonus:", error);
      // Fail gracefully - just don't apply the bonus
    }
  }
  
  // --- SPEED BONUS ---
  const avgSpeed = sessionData.averageTimeToAnswer / 1000; // convert to seconds
  
  if (avgSpeed < 1.0) {
    bonuses.speed = 2;
    bonuses.messages.push("🚀 Lightning Speed Bonus! ×2 🚀");
  } else if (avgSpeed < 1.5) {
    bonuses.speed = 1.5;
    bonuses.messages.push("⚡ Quick Response Bonus! ×1.5 ⚡");
  }
  
  // --- ACCURACY BONUS ---
  const firstTimeCorrectRate = sessionData.firstTimeCorrect / sessionData.totalQuestions;
  
  if (firstTimeCorrectRate >= 0.9) {
    bonuses.accuracy = 2;
    bonuses.messages.push("🎯 Exceptional Accuracy Bonus! ×2 🎯");
  } else if (firstTimeCorrectRate >= 0.75) {
    bonuses.accuracy = 1.5;
    bonuses.messages.push("🎯 High Accuracy Bonus! ×1.5 🎯");
  }
  
  // --- MASTERY BONUS ---
  // Group results by stitch
  const stitchResults: {[key: string]: {total: number, correct: number}} = {};
  
  // First gather info about each stitch
  sessionResults.forEach(result => {
    // Use stitchId if available, otherwise use result id as proxy
    const stitchId = result.stitchId || result.id.split('-')[0];
    
    if (!stitchResults[stitchId]) {
      stitchResults[stitchId] = {
        total: 0,
        correct: 0
      };
    }
    
    stitchResults[stitchId].total++;
    if (result.correct) {
      stitchResults[stitchId].correct++;
    }
  });
  
  // Count perfect stitches (all questions correct)
  let perfectStitches = 0;
  Object.values(stitchResults).forEach(stitch => {
    if (stitch.total >= 20 && stitch.correct === stitch.total) {
      perfectStitches++;
    }
  });
  
  // Apply mastery bonus based on number of perfect stitches
  if (perfectStitches >= 5) {
    bonuses.mastery = 3;
    bonuses.messages.push("🏆 Advanced Mastery Bonus! ×3 🏆");
  } else if (perfectStitches >= 3) {
    bonuses.mastery = 2;
    bonuses.messages.push("🏆 Topic Mastery Bonus! ×2 🏆");
  } else if (perfectStitches >= 1) {
    bonuses.mastery = 1.5;
    bonuses.messages.push("🏆 Topic Progress Bonus! ×1.5 🏆");
  }
  
  return bonuses;
}

/**
 * Calculate final points with bonuses
 */
export function calculateTotalPoints(
  basePoints: number,
  bonuses: BonusResult
): { totalPoints: number, multiplier: number } {
  if (!bonuses.isEligible) {
    return {
      totalPoints: basePoints,
      multiplier: 1
    };
  }
  
  // Calculate combined multiplier (round to 1 decimal place)
  const multiplier = Math.round(
    (bonuses.consistency * bonuses.speed * bonuses.accuracy * bonuses.mastery) * 10
  ) / 10;
  
  // Apply the multiplier
  const totalPoints = Math.round(basePoints * multiplier);
  
  return {
    totalPoints,
    multiplier
  };
}

/**
 * Helper function to calculate base points from session results
 */
export function calculateBasePoints(
  firstTimeCorrect: number,
  eventuallyCorrect: number
): number {
  // First time correct = 3 points each
  // Eventually correct = 1 point each
  return (firstTimeCorrect * 3) + (eventuallyCorrect * 1);
}