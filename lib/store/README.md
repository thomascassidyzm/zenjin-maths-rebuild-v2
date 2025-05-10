# Zenjin Maths State Management

This directory contains the new state management system for Zenjin Maths, implementing a clean architecture using Zustand.

## Overview

The state management system provides:

1. **Centralized state** - A single source of truth for all application state
2. **Type safety** - Comprehensive TypeScript interfaces for all state
3. **Persistence** - Automatic storage to localStorage with server sync
4. **Compatibility** - Adapters for gradual migration from legacy state

## Core Components

- `types.ts` - Type definitions for all state objects
- `zenjinStore.ts` - The main Zustand store with all slices and actions
- `legacyAdapter.ts` - Compatibility layer for working with legacy state

## Integration Guide

### 1. Quick Start for New Components

Use the store directly in new components:

```tsx
import useZenjinStore from '../lib/store/zenjinStore';

function NewComponent() {
  // Access state
  const userInfo = useZenjinStore(state => state.userInformation);
  const tubeState = useZenjinStore(state => state.tubeState);
  
  // Use actions
  const { setActiveTube, incrementPoints } = useZenjinStore();
  
  // ...component implementation
}
```

### 2. Gradual Migration for Existing Components

For existing components using the legacy state system:

```tsx
import { getLegacyState, updateZustandFromLegacyState } from '../lib/store/legacyAdapter';

function ExistingComponent({ legacyState }) {
  // Keep legacy state and new state in sync
  useEffect(() => {
    updateZustandFromLegacyState(legacyState);
  }, [legacyState]);
  
  // Use legacy state as before
  // ...
  
  // When updating state, also update Zustand
  const handleStateChange = (newState) => {
    // Update legacy state
    // ...
    
    // Also update Zustand
    updateZustandFromLegacyState(newState);
  };
}
```

### 3. Critical Events to Handle

#### User Authentication

```tsx
import useZenjinStore from '../lib/store/zenjinStore';

async function handleSignIn(user) {
  // Set user information
  useZenjinStore.getState().setUserInformation({
    userId: user.id,
    isAnonymous: false,
    displayName: user.user_metadata?.name,
    email: user.email,
    createdAt: user.created_at,
    lastActive: new Date().toISOString()
  });
  
  // Load state from server
  await fetchUserStateFromServer(user.id);
}
```

#### Session Completion

```tsx
import useZenjinStore from '../lib/store/zenjinStore';

async function handleSessionEnd() {
  // End current session
  useZenjinStore.getState().endCurrentSession();
  
  // Sync to server
  await useZenjinStore.getState().syncToServer();
}
```

## API Reference

### State Access

```ts
// Access full state
const state = useZenjinStore.getState();

// Access specific slices with selectors
const userInfo = useZenjinStore(state => state.userInformation);
const tubeState = useZenjinStore(state => state.tubeState);
```

### Common Actions

```ts
// User actions
useZenjinStore.getState().setUserInformation(userInfo);

// Tube actions
useZenjinStore.getState().setActiveTube(2);
useZenjinStore.getState().setCurrentStitch(1, "stitch-T1-001-01");

// Learning progress
useZenjinStore.getState().updateEvoPoints(10, 'add');
useZenjinStore.getState().updateBlinkSpeed(5.2);

// Session management
useZenjinStore.getState().startNewSession(userId);
useZenjinStore.getState().endCurrentSession();

// Server sync
await useZenjinStore.getState().syncToServer();
```

## Migration Strategy

The ideal migration path is:

1. First integrate with critical user flows (authentication, session completion)
2. Then update the player components to use the new state
3. Finally update dashboard and auxiliary components

For the quickest integration, focus on:

1. User authentication - ensure state loads properly from server
2. Session completion - ensure state saves properly to server
3. Stitch progression - ensure state updates correctly during gameplay

## Example: Updating the Player Component

```tsx
import useZenjinStore from '../lib/store/zenjinStore';
import { initializeZustandFromLegacy } from '../lib/store/legacyAdapter';

function PlayerComponent({ user, legacyState }) {
  // Initialize Zustand from legacy state if needed
  useEffect(() => {
    if (legacyState) {
      initializeZustandFromLegacy(legacyState);
    }
  }, [legacyState]);
  
  // Get state from Zustand
  const tubeState = useZenjinStore(state => state.tubeState);
  const { setActiveTube, updateStitchInCollection, recordStitchInteraction } = useZenjinStore();
  
  // ...component implementation using Zustand state and actions
}
```

## Feature Flag for Safe Rollout

If needed, you can use a feature flag to control the rollout:

```tsx
import { FLAGS } from '../lib/feature-flags';

// In components:
if (FLAGS.USE_ZUSTAND_STATE) {
  // Use new Zustand state
} else {
  // Use legacy state
}
```

## Troubleshooting

- **State not persisting**: Check that the user ID is consistent between sessions
- **State not syncing**: Verify server endpoints are correctly handling the new format
- **Components not updating**: Ensure you're using selectors correctly with useZenjinStore

For more information, see the detailed implementation in `zenjinStore.ts`.