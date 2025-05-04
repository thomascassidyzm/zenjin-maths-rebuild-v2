# Stitch Completion Points Analysis

## Problem Identified

We discovered that points were being accumulated at stitch completion in addition to the real-time point accumulation during gameplay. This was creating an unintended "in-play bonus" effect, where the same correct answers would contribute to the point total twice:

1. Once when the user answers questions correctly during gameplay (in MinimalDistinctionPlayer.tsx)
2. A second time when the stitch is completed (in StateMachine implementations)

This explains why a perfect score on a 20-question stitch was adding 60 points during gameplay (20 first-time correct × 3 points), and then another 57 points were being added at stitch completion.

## Implementation Details

### Root Cause

We identified that multiple StateMachine implementations were adding points at stitch completion:

1. `lib/triple-helix/StateMachine.js` (was already fixed)
2. `lib/triple-helix/PositionBasedStateMachine.js` 
3. `lib/triple-helix/InfinitePlayStateMachine.js`
4. `lib/triple-helix/core/StateMachine.js`

Each of these implementations contained a line in their `handleStitchCompletion` method that added points:

```javascript
// Add points
this.state.totalPoints = (this.state.totalPoints || 0) + score;
```

### Fix Implemented

We've commented out this line in all StateMachine implementations to prevent the double-counting of points:

```javascript
// We no longer accumulate points in the state machine
// Points are tracked in the player component
// and bonuses are only applied at session end
// this.state.totalPoints = (this.state.totalPoints || 0) + score;
```

### Points System Design

The points system in Zenjin Maths now follows a consistent pattern:

1. **During Gameplay**:
   - Points are incremented in real-time in the `MinimalDistinctionPlayer` component
   - First-time correct answers award 3 points
   - Eventually correct answers (after retry) award 1 point

2. **No Stitch Completion Points**:
   - No additional points are awarded at stitch completion
   - The total points displayed to the user are only from answering questions correctly

3. **End of Session**:
   - Bonuses are calculated only when a user manually ends a session by clicking "Finish"
   - Bonuses include consistency, speed, accuracy, and mastery multipliers
   - Bonuses are applied to the base points (accumulated during gameplay)

## Verification

This fix ensures that:

1. Points increase in real-time as users answer questions correctly
2. No duplicate points are added at stitch completion
3. The point accumulation during gameplay is accurate and intuitive
4. Bonuses are still calculated and applied correctly at session end

## Technical Implementation Details

The fix was implemented across all four StateMachine implementations:

1. `StateMachine.js`: Already fixed
2. `PositionBasedStateMachine.js`: Fixed in lines 466-469
3. `InfinitePlayStateMachine.js`: Fixed in lines 191-194
4. `core/StateMachine.js`: Fixed in lines 321-324

Point accumulation is now handled exclusively in the `handleOptionSelect` method of `MinimalDistinctionPlayer.tsx` (around line 414):

```javascript
// Update points in real-time (but no bonuses)
// First time correct gets 3 points, replay gets 1 point
if (correct) {
  const pointsToAdd = !isReplayQuestion ? 3 : 1;
  setPoints(prev => prev + pointsToAdd);
}
```

Combined with our previous points calculation fix (documented in POINTS-CALCULATION-FIX.md), this ensures that the points system now behaves as expected, with accurate real-time point accumulation and appropriate bonus application only at session end.