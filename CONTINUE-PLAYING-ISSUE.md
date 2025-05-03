# Continue Playing Button Navigation Issue

## Issue Description

The "Continue Playing" button in the session summary is sending users back to the start page instead of continuing with the player. This disrupts the learning flow and creates a confusing user experience, especially for anonymous users who want to keep playing.

## Technical Analysis

The issue has been identified in the way the session completion and continuation is handled across multiple components:

1. **Button Click Handler in MinimalDistinctionPlayer**:
   ```typescript
   <button 
     onClick={() => {
       // Hide summary and proceed with session ending
       setShowSessionSummary(false);
       const stats = {
         sessionId: `session-${Date.now()}`,
         threadId: thread.id,
         stitchId: thread.stitches[0].id,
         totalPoints: points
       };
       finishSession(stats);
     }}
     className="w-full py-3 px-6 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-colors"
   >
     Continue Playing
   </button>
   ```

2. **finishSession Function**:
   ```typescript
   const finishSession = (stats: any) => {
     // If onEndSession is provided, call it instead of regular completion
     if (onEndSession) {
       console.log('Using onEndSession callback for manual session ending');
       onEndSession(stats);
     } else {
       // Fallback to regular completion if onEndSession not provided
       completeSession();
     }
   };
   ```

3. **onEndSession Callback in Parent Component**:
   ```typescript
   onEndSession={(results) => {
     console.log('🚪 MinimalPlayer: onEndSession called with results', { points: results.totalPoints });
     // When user clicks "Finish" button, go directly to dashboard
     player.handleSessionComplete(results, true);
   }}
   ```

4. **handleSessionComplete in playerUtils.ts**:
   ```typescript
   // If end session is requested, handle based on user type
   if (isEndSession) {
     debug('End session requested - saving state before exit');
     
     if (isAnonymous) {
       // For anonymous users, just save to localStorage
       persistAnonymousState();
     } else {
       // For logged in users, persist to server
       persistStateToServer();
     }
     
     // Go to the home page with player options
     router.push('/');
     return;
   }
   ```

The key issue is that in `playerUtils.ts`, the `handleSessionComplete` function with `isEndSession=true` always navigates to the home page using `router.push('/')`, regardless of whether the user is anonymous or authenticated.

## Impact

This behavior creates a poor user experience because:

1. Anonymous users who click "Continue Playing" expect to continue with the player, not to be sent back to the start page
2. It creates an inconsistent experience with the button label and action
3. It disrupts the learning flow, potentially causing users to abandon the session

## Required Fix

To fix this issue:

1. **Modify the onEndSession Callback**:
   For anonymous users, the `isEndSession` parameter should be set to `false` when clicking "Continue Playing" to prevent navigation to the home page.

2. **Alternative Solution**:
   Create a separate handling path for anonymous users' "Continue Playing" button that doesn't trigger the same navigation behavior as the "End Session" functionality.

3. **Update playerUtils.ts**:
   Modify the `handleSessionComplete` function to only navigate to the home page when `isEndSession` is true AND the user is authenticated (not anonymous).

By implementing one of these fixes, the "Continue Playing" button will properly allow anonymous users to continue their learning session without being redirected to the start page.