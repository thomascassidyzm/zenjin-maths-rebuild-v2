# Points Calculation Fix

## Problem

The points calculation system had one key inconsistency:

1. **Bonus Calculations During Gameplay**:
   - We want to show points accumulating in real-time during gameplay (3 pts for first-time correct, 1 pt for retry)
   - However, bonus multipliers should only be applied at the end of a session when the user clicks "Finish"
   - We need to ensure no bonuses are calculated during gameplay

## Solution

We've verified and confirmed the following elements of the points system:

1. **Real-Time Point Accumulation**:
   - Maintained the code in `handleOptionSelect` that increments points during gameplay
   - Points visibly increase by 3 for first-time correct answers and 1 for eventually correct answers
   - The UI shows sessionTotalPoints + points to display the running total

2. **Bonus Application Only at End**:
   - Confirmed that `calculateBonuses` is only called in the `handleEndSession` function
   - Bonus multipliers are only applied when the user manually ends the session by clicking "Finish"
   - The session summary shows a detailed breakdown of base points, bonuses, and final multiplied total

3. **No Premature Bonus Application**:
   - Verified that the accumulated points during gameplay are never multiplied by bonuses
   - Ensured that `completeSession` uses accumulated points without applying bonuses

## Benefits

1. **Engaging UX**: Users see immediate feedback as their points increase with each correct answer

2. **Clear Bonus System**: Bonuses are only calculated and displayed at the end of a session

3. **Expected Behavior**: Point accumulation follows established patterns from other educational apps

## Technical Implementation

The key elements of the implementation are:

1. Real-time points accumulation in `handleOptionSelect`:
   ```javascript
   // Update points in real-time (but no bonuses)
   // First time correct gets 3 points, replay gets 1 point
   if (correct) {
     const pointsToAdd = !isReplayQuestion ? 3 : 1;
     setPoints(prev => prev + pointsToAdd);
   }
   ```

2. Display running total in the UI:
   ```javascript
   <p className="text-white text-2xl font-bold">{sessionTotalPoints + points}</p>
   ```

3. Bonus calculation only at manual session end:
   ```javascript
   // Calculate bonuses
   const bonuses = calculateBonuses(sessionData, sessionResults, isAnonymous);
   
   // Calculate final points with multiplier
   const { totalPoints, multiplier } = calculateTotalPoints(basePoints, bonuses);
   ```

This implementation maintains the engaging experience of seeing points increase during play while ensuring that bonuses are only applied at the end of a session.