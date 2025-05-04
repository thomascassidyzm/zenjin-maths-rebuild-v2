# In-Play Bonus Fix

## Summary

This document explains the fixes made to address the unintended "in-play bonus" effect in the Zenjin Maths application, where points were being accumulated twice during gameplay.

## Problem Description

We identified a double-counting issue in the points calculation system:

1. Points were accumulating in real-time in the MinimalDistinctionPlayer component as users answered questions correctly (3 points for first-time correct, 1 point for retry)
2. Additional points were being added at stitch completion in the StateMachine implementations

This resulted in players seeing more points than expected. For example, a perfect score on a 20-question stitch would add:
- 60 points during gameplay (20 questions × 3 points each)
- Then an additional 57 points at stitch completion

## Root Cause Analysis

The issue existed because multiple StateMachine implementations were adding points in their `handleStitchCompletion` method:

```javascript
// Add points
this.state.totalPoints = (this.state.totalPoints || 0) + score;
```

While the main `StateMachine.js` file had already been fixed, three other implementations were still adding points:

1. `lib/triple-helix/PositionBasedStateMachine.js`
2. `lib/triple-helix/InfinitePlayStateMachine.js`
3. `lib/triple-helix/core/StateMachine.js`

## Fix Implementation

We've commented out the problematic line in all StateMachine implementations to prevent the double-counting of points:

```javascript
// We no longer accumulate points in the state machine
// Points are tracked in the player component
// and bonuses are only applied at session end
// this.state.totalPoints = (this.state.totalPoints || 0) + score;
```

The line numbers where changes were made:
1. `PositionBasedStateMachine.js`: Lines 466-469
2. `InfinitePlayStateMachine.js`: Lines 191-194
3. `core/StateMachine.js`: Lines 321-324

## Corrected Points System Flow

After these changes, the points system now follows a clean, consistent pattern:

1. **During Gameplay**:
   - Points increment in real-time as users answer questions correctly
   - First-time correct answers award 3 points
   - Eventually correct answers award 1 point
   - This provides immediate feedback to users

2. **At Stitch Completion**:
   - No additional points are added
   - Progress state is updated
   - The next stitch is loaded

3. **At Session End** (when user clicks "Finish"):
   - Bonus multipliers are calculated based on:
     - Consistency of practice
     - Speed of answers
     - Accuracy
     - Mastery level
   - Bonuses are applied to the base points accumulated during gameplay
   - Final total is displayed in the session summary

This creates a cleaner, more intuitive experience where points only increment when the user answers questions correctly, and bonuses are only applied at explicit session end.

## Verification

To verify this fix:
1. Play through a stitch, achieving a perfect score (20/20)
2. Observe that only 60 points are accumulated (20 questions × 3 points)
3. No additional points should be added when the stitch completes and tube rotations
4. End the session to see bonuses applied properly

## Related Documents

For more details, see:
- [POINTS-CALCULATION-FIX.md](./POINTS-CALCULATION-FIX.md) - Details on the points calculation system
- [STITCH-POINTS-ANALYSIS.md](./STITCH-POINTS-ANALYSIS.md) - Analysis of how points were previously calculated at stitch completion