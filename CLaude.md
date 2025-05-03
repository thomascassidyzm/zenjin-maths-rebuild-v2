# Zenjin Maths Player - Project Status & Documentation

## State Persistence Fixes

### 1. Issues Addressed

The following critical state persistence issues were identified and resolved:

- **Question ID Format Inconsistency**: Question IDs in the database used an obsolete letter-based format (stitch-A-01-q20) while stitch IDs used tube-based format (stitch-T1-001-01-q20)
- **Position Conflicts**: Multiple stitches within the same tube had identical position values, causing progression issues
- **Missing Tube Data**: Errors during tube transitions showed "Could not load content for Tube X"
- **Question Count Discrepancy**: Only 19 questions were shown in stitches instead of the expected 20
- **State Loading Failures**: Incomplete state loading when transitioning between sessions or tubes

### 2. Database Migrations

- Updated question IDs in the database to match the new tube-based format
- Successfully migrated all question IDs (780 in T1 and T2, 480 in T3)
- Implemented SQL scripts to automate the database migration process
- Added position conflict resolution during state loading

### 3. Key Files Modified

1. **StateMachine.js**
   - Added position conflict detection and resolution
   - Ensured unique stitch positions within each tube
   - Fixed stitch advancement logic to properly handle perfect scores

2. **playerUtils.ts**
   - Enhanced useTripleHelixPlayer hook with improved recovery mechanisms
   - Added emergency content for tubes to prevent transition errors
   - Fixed recovery logic to handle missing methods

3. **StateMachineTubeCyclerAdapter.js**
   - Added missing getStitchesForTube method to prevent reference errors
   - Implemented fallback mechanisms for determining active tube

4. **MinimalDistinctionPlayer.tsx**
   - Fixed question count discrepancy by using actual question count
   - Improved progress indicator logic

5. **dashboard.tsx**
   - Enhanced "Continue Learning" button to clear potentially conflicting localStorage cache
   - Improved session resumption handling

6. **user-stitches.ts & update-stitch-positions.ts**
   - Optimized API endpoints for loading and saving stitch positions
   - Improved error handling and added fallback mechanisms

### 4. Core Architectural Improvements

1. **Position Conflict Resolution**
   ```javascript
   // CRITICAL FIX: Verify that all stitch positions are unique
   const positionCounts = {};
   tube.stitches.forEach(s => {
     if (!positionCounts[s.position]) {
       positionCounts[s.position] = [];
     }
     positionCounts[s.position].push(s.id);
   });
   
   // Find positions with more than one stitch
   for (const [position, stitchIds] of Object.entries(positionCounts)) {
     if (stitchIds.length > 1) {
       console.warn(`CONFLICT DETECTED: ${stitchIds.length} stitches have position ${position}: ${stitchIds.join(', ')}`);
       
       // Keep the first one at this position, move others
       for (let i = 1; i < stitchIds.length; i++) {
         // Find the next available position
         let newPosition = parseInt(position) + i;
         while (positionCounts[newPosition] && positionCounts[newPosition].length > 0) {
           newPosition++;
         }
         
         // Move the stitch to the new position
         const stitch = tube.stitches.find(s => s.id === stitchIds[i]);
         if (stitch) {
           console.warn(`Resolving conflict: Moving stitch ${stitch.id} from position ${position} to ${newPosition}`);
           stitch.position = newPosition;
           
           // Update tracking
           if (!positionCounts[newPosition]) {
             positionCounts[newPosition] = [];
           }
           positionCounts[newPosition].push(stitch.id);
         }
       }
     }
   }
   ```

2. **Tube Transition Recovery**
   ```javascript
   // CRITICAL FIX: Check if method exists before calling it
   if (typeof tubeCycler.getStitchesForTube === 'function') {
     const recoveryStitches = tubeCycler.getStitchesForTube(nextTubeNum);
     
     if (recoveryStitches && recoveryStitches.length > 0) {
       // Just pick the first one to recover
       const recoveryStitch = recoveryStitches[0];
       debug(`Recovery succeeded with stitch ${recoveryStitch.id}`);
       
       // Attempt to update UI with recovery stitch
       setCurrentTube(nextTubeNum);
       setCurrentStitch(recoveryStitch);
       setTubeStitches(recoveryStitches);
       
       // Reset flags to allow normal operation
       setTimeout(() => {
         rotationInProgressRef.current = false;
         isInTransitionRef.current = false;
       }, 250);
       
       return;
     }
   } else {
     // Alternative recovery method if getStitchesForTube doesn't exist
     debug('getStitchesForTube not available, using alternative recovery method');
     
     // Try to get stitches from state directly
     const state = tubeCycler.getState();
     // ... additional recovery logic
   }
   ```

3. **Question Count Fix**
   ```javascript
   // CRITICAL FIX: Use the actual question count rather than inferring from results
   const totalQuestions = Math.max(
     new Set(sessionResults.map(r => r.id)).size,
     sessionQuestions.length
   );
   ```

4. **Improved State Loading**
   ```javascript
   /**
    * Get stitches for a specific tube
    * CRITICAL FIX: Adding this method to prevent null reference errors
    * @param {number} tubeNumber - Tube number to get stitches for
    * @returns {Array} Array of stitches in the tube
    */
   getStitchesForTube(tubeNumber) {
     console.log(`Getting stitches for tube ${tubeNumber} (recovery method)`);
     
     // Get state from stateMachine
     const state = this.stateMachine.getState();
     
     // Check if tube exists in state
     if (!state || !state.tubes || !state.tubes[tubeNumber]) {
       console.log(`No tube ${tubeNumber} found in state`);
       return [];
     }
     
     // Get stitches from tube
     const tube = state.tubes[tubeNumber];
     const stitches = tube.stitches || [];
     
     // Return sorted stitches by position
     return [...stitches].sort((a, b) => a.position - b.position);
   }
   ```

### 5. Documentation Created

- **STATE-PERSISTENCE.md**: Comprehensive documentation of the state persistence system
- **ANONYMOUS-TO-AUTH-TEST-PLAN.md**: Test plan for anonymous to authenticated user conversion
- **ANONYMOUS-TO-FREE-USER-SUMMARY.md**: Summary of anonymous to free user conversion flow
- **AUTH-FIX-PRINCIPLES.md**: Core principles for authentication fixes
- **AUTH-FIX-SUMMARY.md**: Overview of authentication fixes implemented
- **AUTH-IMPLEMENTATION-PLAN.md**: Detailed implementation plan for authentication system
- **AUTH-IMPLEMENTATION-SUMMARY.md**: Summary of authentication implementation 

## Project Setup

1. **Repository Structure**
   - Main Player App: `/Users/tomcassidy/claude-code-experiments/zenjin-maths/clean-project`
   - Admin Dashboard: `/Users/tomcassidy/claude-code-experiments/zenjin-maths-admin`

2. **Workflow**
   - We use GitHub Desktop for version control
   - Commits are pushed to GitHub repository
   - The app builds automatically to Vercel when changes are committed

3. **Deployment**
   - Automatic deployment via Vercel when changes are pushed to GitHub
   - No manual deployment steps required - just commit and push

## Development Guidelines

1. **Code Style**
   - Consistent naming: Use "Zenjin Maths" (not "Math") throughout the application
   - Follow existing component patterns and style conventions
   - Use Tailwind CSS for styling components

2. **Current Project Focus**
   - Minimal Player: A clean, streamlined player UI without admin controls
   - Dashboard Metrics: Track Total Points and Blink Speed with Evolution Level calculations
   - User Experience: Remove unnecessary UI elements to keep focus on the learning experience

3. **Authentication & Security**
   - Improved sign-out functionality with proper cache/localStorage clearing
   - Admin access and Developer Mode links removed from main UI
   - Session persistence working with robust error handling

4. **Testing**
   - After making changes, run through a complete session flow
   - Verify points are awarded and saved to the dashboard
   - Test with Service Worker cache cleared to ensure changes are visible

## Component Structure

The player consists of three main layers:

1. **Page Layer** (`working-player.tsx` & `minimal-player.tsx`)
   - Sets up the full-screen background
   - Manages player state, tube cycling, and session data
   - Renders the appropriate player component

2. **Player Components** (`DistinctionPlayer.tsx` & `MinimalDistinctionPlayer.tsx`)
   - Handle question presentation, user answers, and feedback
   - Manage the card layout with fixed dimensions (iPhone 8 sized)
   - Include all UI elements for learning interaction
   - Import and use the shared BackgroundBubbles component

3. **Shared Components** 
   - `BackgroundBubbles.tsx`: Persistent animated bubbles that don't reset with state changes
   - Uses React refs to maintain bubble data across renders

4. **Styling Layer** (`player.css` & Tailwind classes)
   - Contains animations, layout sizing, and responsive adjustments
   - Defines the bubble animation keyframes and appearance

## Core Architecture Principles

### 1. Offline-First Architecture

The application implements an offline-first approach which must be maintained:

- During normal gameplay, all state is saved to `localStorage` (both anonymous and authenticated users)
- For authenticated users, server persistence ONLY happens when a user explicitly ends a session via the "Finish" button
- Never implement automatic server synchronization during normal gameplay
- Dashboard and reporting views reflect data that has been explicitly saved to the server

### 2. React Component Guidelines

When working with React components:

- Keep components focused on a single responsibility
- Avoid complex state management patterns with circular dependencies
- Use proper cleanup in useEffect hooks to prevent memory leaks
- Don't implement automatic polling or refresh intervals without explicit user action
- Handle component lifecycle properly, especially unmounting

### 3. Performance Considerations

To maintain performance:

- Avoid recursive rendering patterns or state updates that trigger effects in loops
- Never implement continuous API polling without proper safeguards
- Watch for memory leaks, especially with timers and event listeners
- Test changes with reduced CPU/network capacity to catch performance issues early

## Danger Zones And Anti-Patterns

### 1. Browser-Crashing Patterns To Avoid

The following patterns have caused serious issues and should never be implemented:

- Recursive render loops where state updates trigger effects that update state again
- Auto-refresh mechanisms with short intervals (particularly under 5 seconds)
- Nested intervals or timers that accumulate without proper cleanup
- Navigation logic that sets up timers or intervals before changing routes

```jsx
// DANGEROUS PATTERN - Will crash the browser!
function DangerousComponent() {
  useEffect(() => {
    // No cleanup, creates a new interval on every render
    setInterval(() => {
      // Updates state, which triggers re-render, which creates more intervals
      setData(newData);
    }, 1000);
  }); // Missing dependency array - runs on EVERY render!
}
```

### 2. Safe Alternatives

Instead, use these safe patterns:

```jsx
// SAFE PATTERN - Single interval with proper cleanup
function SafeComponent() {
  useEffect(() => {
    // Create a single interval
    const intervalId = setInterval(() => {
      // Update state
      setData(newData);
    }, 5000); // Reasonable interval (5 seconds)
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, []); // Empty dependency array - runs only once on mount
}
```

## Dashboard and Navigation

The dashboard implementation should follow these principles:

1. **Dashboard Navigation**: 
   - Use simple, direct navigation without complex pre-navigation logic
   - CORRECT: `onClick={() => router.push('/dashboard')}`
   - AVOID: Complex operations or state updates before navigation

2. **Data Fetching**:
   - Fetch data once on initial component mount
   - Provide explicit refresh button for user-initiated updates
   - Never implement automatic refresh intervals
   - Always clean up fetch requests on component unmount

3. **State Updates**:
   - Use functional state updates to prevent race conditions
   - Batch related state updates where possible
   - Avoid cascading state updates

## Latest Updates (Bubbles and Layout)

We've made the following improvements:

1. **Fixed Layout**
   - Set player dimensions to iPhone 8 size (375px × 500px)
   - Enforced consistent dimensions across all states (loading, playing, complete)
   - Ensured buttons always display side-by-side with `grid-template-columns: 1fr 1fr !important`
   - Improved z-index layering for proper element stacking

2. **Persistent Background Bubbles**
   - Created a shared `BackgroundBubbles.tsx` component imported by player components
   - Used `useRef` to prevent bubbles from resetting on re-renders or question changes
   - Added more randomness to bubble animations (size, opacity, speed, direction)
   - Implemented horizontal movement with CSS variables for unique bubble paths
   - Increased bubble count from 20 to 50 for more visual interest
   - Made bubbles persist across the entire session without resetting
   - Optimized animation speed for more bubble-like movement (15-40s vs. previous 30-80s)

## BackgroundBubbles Implementation

The improved background bubbles are now implemented as a separate component:

```tsx
// BackgroundBubbles.tsx
import React, { useEffect, useRef } from 'react';

const BackgroundBubbles: React.FC = () => {
  // Use ref to ensure the bubbles data persists across renders
  const bubblesRef = useRef<Array<{/*...*/}> | null>(null);
  
  // Generate bubbles only once
  useEffect(() => {
    if (!bubblesRef.current) {
      bubblesRef.current = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        size: Math.floor(Math.random() * 100) + 10, // 10-110px
        left: `${Math.random() * 100}%`,
        delay: Math.random() * 15, // Reduced delays for quicker start (0-15s)
        duration: Math.random() * 25 + 15, // 15-40s for faster, more bubble-like animation
        direction: Math.floor(Math.random() * 3) - 1, // Random direction (-1, 0, 1)
        sway: Math.random() * 5, // Random sway amount
        opacity: Math.random() * 0.1 + 0.05, // Random opacity
      }));
    }
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{zIndex: 2}}>
      {bubblesRef.current?.map((bubble) => (
        <div
          key={bubble.id}
          className="bubble"
          style={{
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            left: bubble.left,
            bottom: '-100px',
            animationDelay: `${bubble.delay}s`,
            animationDuration: `${bubble.duration}s`,
            background: `rgba(255, 255, 255, ${bubble.opacity})`,
            '--direction': bubble.direction,
            '--sway': bubble.sway,
            '--bubble-opacity': bubble.opacity
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

export default BackgroundBubbles;
```

The animation in `player.css` was updated to use CSS variables for more randomized movement:

```css
@keyframes float {
  0% {
    transform: translateY(0) translateX(0);
    opacity: 0;
  }
  3% { /* Faster fade-in */
    opacity: var(--bubble-opacity, 0.1); /* Fade in using CSS variable for random opacity */
  }
  20% { /* Faster vertical movement */
    transform: translateY(-300px) translateX(calc(var(--direction) * var(--sway) * 1vw));
  }
  40% {
    transform: translateY(-600px) translateX(calc(var(--direction) * var(--sway) * 0.5vw));
  }
  60% {
    transform: translateY(-900px) translateX(calc(var(--direction) * var(--sway) * -0.5vw));
  }
  80% {
    opacity: var(--bubble-opacity, 0.1);
    transform: translateY(-1100px) translateX(calc(var(--direction) * var(--sway) * -1vw));
  }
  90% { /* Earlier fade-out */
    opacity: 0; /* Start fading out */
  }
  100% {
    transform: translateY(-1300px) translateX(0);
    opacity: 0; /* Completely fade out at top */
  }
}
```

## Development Tips

When continuing work on this project:

1. **Maintain Fixed Layout**
   - Keep the fixed dimensions (375px × 500px) consistent
   - Preserve the side-by-side button layout

2. **Animation Considerations**
   - The BackgroundBubbles component uses useRef to maintain persistent state
   - CSS variables provide randomness for each bubble's animation
   - Animation timing is optimized for a balance of visual interest and performance

3. **Component Architecture**
   - Player components import the shared BackgroundBubbles component
   - Player structure is designed to be self-contained
   - The bubbles don't reset between question changes due to useRef implementation

4. **Testing Requirements**
   - After making changes, test with throttled CPU and network to catch performance issues
   - Verify all cleanup functions work properly (no memory leaks)
   - Test that browser back/forward navigation works as expected
   - Validate that localStorage and server data are properly synchronized

## Common Operations

1. **Fixing Cache Issues**
   - Service Worker cache version in `public/service-worker.js` should be incremented
   - LocalStorage auth data can be cleared via URL parameter: `/?clear_auth=true`
   - Manual cache clearing is available through browser dev tools

2. **Running Commands**
   - Install dependencies: `npm install`
   - Start development server: `npm run dev`
   - Build production: `npm run build`

3. **QA Checklist**
   - Consistent branding: "Zenjin Maths" used throughout
   - Clean minimal player UI with no admin/developer links
   - Points calculation working correctly
   - Authentication state persisting properly
   - Service worker caching fresh content after updates
   - No recursive render loops or memory leaks