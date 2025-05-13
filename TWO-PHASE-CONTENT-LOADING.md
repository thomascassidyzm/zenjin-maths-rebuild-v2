# Two-Phase Content Loading

## Overview

This document outlines a simple two-phase approach to content loading that minimizes initial payload while ensuring adequate content is available for both online and offline use.

## Two-Phase Approach

### Phase 1: Active Content Load

When a user starts a session:

1. Load **ONLY** the active stitch for the current tube (about 3KB)
2. Start the player immediately with this content
3. This ensures the fastest possible startup time

### Phase 2: Session Content Load

As soon as the player starts:

1. Load the next 9 stitches for the active tube (total 10 stitches including active stitch)
2. Load 5 stitches each for the other two tubes
3. This provides enough content for a typical session (~20 stitches total)

## Implementation

This can be implemented with minimal changes to the existing code:

```typescript
// In ZustandDistinctionPlayer or similar component
useEffect(() => {
  // Phase 1: Only the active stitch is loaded via useStitchContent
  if (stitch && tubeNumber) {
    // Phase 2: Once active stitch is loaded, fetch additional content
    fetchSessionContent(tubeNumber);
  }
}, [stitch, tubeNumber]);

// Function to fetch session content
const fetchSessionContent = async (activeTubeNumber) => {
  try {
    // Get the active tube's state
    const state = useZenjinStore.getState();
    const activeTube = state.tubeState?.tubes?.[activeTubeNumber];
    
    if (!activeTube || !activeTube.stitchOrder) return;
    
    // Phase 2a: Load additional stitches for active tube (total 10)
    const activeStitchIndex = activeTube.stitchOrder.findIndex(id => id === stitch.id);
    if (activeStitchIndex !== -1) {
      const nextStitches = activeTube.stitchOrder.slice(activeStitchIndex + 1, activeStitchIndex + 10);
      if (nextStitches.length > 0) {
        useZenjinStore.getState().fetchStitchBatch(nextStitches);
      }
    }
    
    // Phase 2b: Load 5 stitches for each inactive tube
    [1, 2, 3].filter(num => num !== activeTubeNumber).forEach(tubeNum => {
      const tube = state.tubeState?.tubes?.[tubeNum];
      if (tube && tube.stitchOrder && tube.stitchOrder.length > 0) {
        const tubeStitches = tube.stitchOrder.slice(0, 5);
        useZenjinStore.getState().fetchStitchBatch(tubeStitches);
      }
    });
  } catch (error) {
    console.error('Error fetching session content:', error);
  }
};
```

## Benefits

1. **Fast Initial Load**: Only the absolute minimum content required to start
2. **Predictable Content Loading**: Just two distinct phases, not continuous fetches
3. **Efficient Session Support**: Enough content for a typical session without wasting bandwidth
4. **Simple Implementation**: Uses existing Zustand store functions with minimal changes

## Future Enhancement

If needed, a third phase for extended offline support could be added:

- After a quiet period (e.g., 30 seconds of inactivity)
- Fetch up to 50 stitches per tube for comprehensive offline support
- This would only happen when the user has a stable connection and isn't actively using the app

## Implementation Steps

1. Modify the `ZustandDistinctionPlayer` component to implement the two-phase approach
2. Add session content loading after the active stitch is loaded
3. Ensure the batch fetch functions in the Zustand store handle proper prioritization
4. Add indicators to show loading progress (optional)

This approach gives you the best balance of initial loading speed, predictable content fetching, and sufficient content for normal usage.