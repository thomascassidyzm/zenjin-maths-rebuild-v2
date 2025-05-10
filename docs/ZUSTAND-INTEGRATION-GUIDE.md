# Zustand State Management Integration Guide

This guide provides detailed instructions for integrating the new Zustand-based state management system into the Zenjin Maths application.

## Overview

The new state management system provides:

1. **Centralized state management** - A single source of truth for all application state
2. **Reliable persistence** - Automatic storage to localStorage with server sync
3. **Type safety** - Comprehensive TypeScript interfaces for all state
4. **Backward compatibility** - Seamless transition from the legacy state system

## Key Files

- `/lib/store/zenjinStore.ts` - The main Zustand store implementation
- `/lib/store/types.ts` - TypeScript interfaces for the state
- `/lib/store/legacyAdapter.ts` - Utilities for working with legacy state
- `/lib/store/migrationUtils.ts` - Helpers for gradual migration
- `/lib/hooks/useZustandTripleHelixPlayer.ts` - Enhanced player hook using Zustand

## Getting Started

### 1. Using the Zustand Store Directly

```tsx
import useZenjinStore from '../lib/store/zenjinStore';

function MyComponent() {
  // Access state with selectors
  const userInfo = useZenjinStore(state => state.userInformation);
  const tubeState = useZenjinStore(state => state.tubeState);
  
  // Use actions
  const { 
    setUserInformation,
    setActiveTube,
    incrementPoints,
    syncToServer
  } = useZenjinStore();
  
  // ...component implementation
}
```

### 2. Using the Zustand Triple Helix Player

```tsx
import { useZustandTripleHelixPlayer } from '../lib/hooks/useZustandTripleHelixPlayer';

function PlayerPage() {
  // Use the enhanced player hook
  const player = useZustandTripleHelixPlayer({
    debug: console.log,
    continuePreviousState: true
  });
  
  // Player provides:
  // - player.currentStitch
  // - player.currentTube
  // - player.isLoading
  // - player.completeStitch()
  // - player.handleSessionComplete()
  // - etc.
  
  // ...component implementation
}
```

### 3. Migrating Existing Components

For components still using the legacy state system:

```tsx
import { updateZustandFromLegacyState } from '../lib/store/legacyAdapter';
import { useMigratedComponent } from '../lib/store/migrationUtils';

function ExistingComponent({ legacyState }) {
  // Mark this component as migrated
  useMigratedComponent('ExistingComponent');
  
  // Update Zustand whenever legacy state changes
  useEffect(() => {
    if (legacyState) {
      updateZustandFromLegacyState(legacyState);
    }
  }, [legacyState]);
  
  // ...component implementation using legacy state
}
```

## Testing the Implementation

Use the provided test pages to verify the implementation:

1. `/pages/zustand-store-test.tsx` - Tests the basic store functionality
2. `/pages/zustand-player-test.tsx` - Tests the player integration

Key aspects to test:

- State persistence to localStorage
- Seamless tube cycling
- Stitch completion with point accumulation
- Session completion with server sync
- Compatibility with legacy components

## Migration Strategy

The recommended migration approach is:

1. **Start with critical flows**
   - Authentication and user information
   - Session completion and state persistence
   - Player component integration

2. **Gradually update components**
   - Use the legacy adapter for transitional period
   - Mark components as migrated with `useMigratedComponent`
   - Ensure both state systems remain in sync during transition

3. **Complete transition**
   - Move all components to Zustand
   - Remove legacy state management
   - Clean up adapters and compatibility layers

## Implementation Notes

### State Structure

The Zustand store is organized into slices:

```typescript
interface AppState {
  userInformation: UserInformation;
  tubeState: TubeState;
  learningProgress: LearningProgress;
  sessionData: SessionData;
  lastUpdated: string;
  isInitialized: boolean;
}
```

### Persistence

The store automatically persists to localStorage using Zustand's `persist` middleware.

For server synchronization:

```typescript
// Sync state to server
await useZenjinStore.getState().syncToServer();
```

### Working with User Authentication

When a user signs in:

```typescript
// Update user information in Zustand store
useZenjinStore.getState().setUserInformation({
  userId: user.id,
  isAnonymous: false,
  displayName: user.user_metadata?.display_name,
  email: user.email,
  createdAt: user.created_at,
  lastActive: new Date().toISOString()
});

// Load state from server if needed
await useZenjinStore.getState().loadFromServer(user.id);
```

### Handling Stitch Completion

```typescript
// Using the Zustand player hook
await player.completeStitch(
  currentStitch.threadId,
  currentStitch.id,
  correctAnswers,
  totalQuestions
);

// Or manually with the store
useZenjinStore.getState().incrementPoints(points);
useZenjinStore.getState().setActiveTube(nextTubeNumber);
```

### Session Completion

```typescript
// Using the Zustand player hook
await player.handleSessionComplete(results);

// Or manually with the store
useZenjinStore.getState().endCurrentSession();
await useZenjinStore.getState().syncToServer();
```

## Troubleshooting

### State Not Persisting

- Ensure user ID is consistent across sessions
- Check localStorage access (private browsing can block it)
- Verify the store is properly initialized

### Points Not Updating

- Use store selectors correctly: `useZenjinStore(state => state.learningProgress?.points)`
- Ensure `incrementPoints` is being called with the correct amount
- Check for state slices being `null` or `undefined` (use optional chaining)

### Server Sync Issues

- Verify the API endpoint at `/api/user-state` is working
- Check network tab for sync request failures
- Ensure auth credentials are available for authenticated users

## Best Practices

1. **Use selectors for performance**
   ```typescript
   // Good (only re-renders when points change)
   const points = useZenjinStore(state => state.learningProgress?.points);
   
   // Bad (re-renders on any state change)
   const store = useZenjinStore();
   const points = store.learningProgress?.points;
   ```

2. **Keep state transforms in the store**
   ```typescript
   // Good
   useZenjinStore.getState().incrementPoints(10);
   
   // Bad
   const points = useZenjinStore.getState().learningProgress.points;
   useZenjinStore.getState().setLearningProgress({
     ...useZenjinStore.getState().learningProgress,
     points: { ...points, session: points.session + 10 }
   });
   ```

3. **Use the adapter during transition**
   ```typescript
   // Keep both systems in sync
   updateZustandFromLegacyState(legacyState);
   ```

4. **Initialize slices before using**
   ```typescript
   // Check if slice exists before accessing properties
   const tubeState = useZenjinStore(state => state.tubeState);
   const activeTube = tubeState?.activeTube || 1;
   ```

## Next Steps

1. Deploy `play-zustand.tsx` as a test environment
2. Gather user feedback on state persistence
3. Monitor performance and reliability
4. Gradually replace the legacy state system
5. Remove compatibility layers when transition is complete