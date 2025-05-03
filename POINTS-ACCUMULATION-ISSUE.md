# Points Accumulation Issue in Zenjin Maths

## Issue Description

Points are not being accumulated over the entire session. Instead, they are reset when a new stitch starts, which is incorrect behavior. Points tallies should accumulate from the time the user starts playing until the time they click "Finish", representing the complete session length.

## Technical Analysis

The issue has been identified in how the MinimalDistinctionPlayer component manages points:

1. **State Initialization**: The `MinimalDistinctionPlayer` component initializes its `points` state to 0 each time it's mounted for a new stitch:
   ```typescript
   const [points, setPoints] = useState(0);
   ```

2. **Points Display**: The UI correctly shows the accumulated points by adding:
   ```typescript
   <p className="text-white text-2xl font-bold">{sessionTotalPoints + points}</p>
   ```
   This adds the current stitch points to the total accumulated points passed from the parent.

3. **Session Completion**: When a session is completed or ended, only the current stitch's points are sent in the results:
   ```typescript
   const stats = {
     sessionId: `session-${Date.now()}`,
     threadId: thread.id,
     stitchId: thread.stitches[0].id,
     totalPoints: points  // Only sending current stitch points
   };
   ```

4. **Parent Component**: The parent component in `minimal-player.tsx` correctly accumulates points across stitches:
   ```typescript
   setAccumulatedSessionData(prev => ({
     totalPoints: prev.totalPoints + (results.totalPoints || 0),
     // ...other properties
   }));
   ```
   But since only the current stitch points are being sent, the accumulated total is effectively lost.

## Impact

This issue affects the user experience as:
1. Points earned in previous stitches appear to be lost when moving to a new stitch
2. The session summary at the end may show fewer points than the user actually earned
3. It creates an inconsistent experience between the points shown during play and the final points total

## Required Fix

The fix should ensure that:
1. Points are properly accumulated across all stitches in a session
2. The same accumulated total is displayed during play, on session end, and in the session summary
3. The points are stored consistently for both anonymous and authenticated users