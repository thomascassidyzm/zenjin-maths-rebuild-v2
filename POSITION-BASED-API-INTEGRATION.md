# Position-Based Model API Integration

## Overview

This document outlines how to integrate the position-based model with the existing API infrastructure, leveraging the Zustand store for content fetching.

## Key Components

1. **Zustand Store**: Continue using the existing Zustand store for all API calls, which has now been fixed to properly preserve position data during server persistence.

2. **User State Table**: Ensure the user_state table exists and is properly structured for both anonymous and authenticated users.

3. **Position Data**: Maintain position-based model with keys like "4" and "5" throughout the persistence cycle.

## Implementation Plan

### 1. Ensure User State Table Creation

When a new user (anonymous or authenticated) accesses the application:

```typescript
// In AuthContext or user initialization
import { ensureUserStateTableExists } from '../lib/initialization/initialize-unified-state';

// When user first accessed
const initializeNewUser = async (userId) => {
  // Make sure the table exists
  await ensureUserStateTableExists();
  
  // Initialize default state with position data
  const defaultState = getDefaultPositionBasedState(userId);
  
  // Set in Zustand store
  useZenjinStore.setState({
    userInformation: defaultState.userInformation,
    tubeState: defaultState.tubeState,
    learningProgress: defaultState.learningProgress,
    lastUpdated: new Date().toISOString(),
    isInitialized: true
  });
  
  // Sync to server
  await useZenjinStore.getState().syncToServer();
};
```

### 2. Content Loading Approach

Rather than preloading all content upfront, use a just-in-time approach:

1. Load only the active stitch initially
2. Fetch adjacent stitches as needed (e.g., when the user is about to navigate to them)
3. Use the Zustand store's `fetchStitch` method for individual stitches

This can be implemented with minimal changes to the existing codebase:

```typescript
// In MinimalDistinctionPlayer or similar
const loadActiveStitch = async () => {
  const state = useZenjinStore.getState();
  const activeTube = state.tubeState?.activeTube || 1;
  const activeStitchId = state.tubeState?.tubes?.[activeTube]?.currentStitchId;
  
  if (activeStitchId) {
    // Load just the active stitch
    const stitch = await state.fetchStitch(activeStitchId);
    
    // Start preloading adjacent stitches in the background
    preloadAdjacentStitches(activeTube, activeStitchId);
  }
};

const preloadAdjacentStitches = async (tubeNumber, currentStitchId) => {
  const state = useZenjinStore.getState();
  const positions = state.tubeState?.tubes?.[tubeNumber]?.positions;
  
  if (!positions) return;
  
  // Get adjacent positions based on current position
  const currentPosition = Object.entries(positions)
    .find(([_, data]) => data.stitchId === currentStitchId)?.[0];
  
  if (currentPosition) {
    // Preload next 2-3 stitches
    const pos = parseInt(currentPosition);
    const nextPositions = [pos + 1, pos + 2, pos + 3];
    
    // Load each stitch in the background
    nextPositions.forEach(nextPos => {
      const nextStitch = positions[nextPos];
      if (nextStitch) {
        state.fetchStitch(nextStitch.stitchId)
          .catch(err => console.error(`Error preloading stitch ${nextStitch.stitchId}:`, err));
      }
    });
  }
};
```

### 3. Enhanced API Error Handling

Add fallback mechanisms in the Zustand store's API methods:

```typescript
// In zenjinStore.ts
fetchStitch: async (stitchId: string) => {
  const state = get();
  
  // Check if we have it already cached
  if (state.contentCollection?.stitches?.[stitchId]) {
    return state.contentCollection.stitches[stitchId];
  }
  
  try {
    // Fetch from server API
    const stitch = await fetch(`/api/content/stitch/${stitchId}`).then(r => r.json());
    
    // Add to collection
    set((state) => ({
      contentCollection: {
        ...state.contentCollection || { stitches: {}, questions: {} },
        stitches: {
          ...state.contentCollection?.stitches || {},
          [stitchId]: stitch
        }
      }
    }));
    
    return stitch;
  } catch (error) {
    console.error(`Error fetching stitch ${stitchId}:`, error);
    
    // Table creation error - try to ensure table exists
    if (state.userInformation?.userId) {
      try {
        // Create table if needed
        await fetch('/api/create-user-state-table', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        // Retry fetch once
        return await fetchSingleStitch(stitchId);
      } catch (err) {
        console.error('Failed to create table or fetch stitch:', err);
        return null;
      }
    }
    
    return null;
  }
}
```

## Benefits

1. **Simplified Architecture**: Leverage existing Zustand store for content fetching
2. **Automatic Table Creation**: Ensure user_state table exists when needed
3. **Optimized Content Loading**: Load only what's needed when it's needed
4. **Preserved Position Data**: Fix the position data preservation issue
5. **Unified Treatment**: Both anonymous and authenticated users get the same experience

## Implementation Steps

1. Extract the `ensureUserStateTableExists` function from `initialize-unified-state.ts`
2. Add the user state table creation API endpoint
3. Fix the position data preservation in the store's `loadFromServer` method
4. Enhance error handling in the fetchStitch method
5. Update player components to use just-in-time content loading