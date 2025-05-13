# Zustand-Based Content Approach

This document explains the new server-first content approach that uses Zustand as the single source of truth for stitch content in the Zenjin Maths application.

## Overview

The new architecture completely eliminates bundled content dependencies by using the Zustand store as a central content provider. All components, including the StateMachine, now fetch content from the Zustand store, which in turn fetches it from the server API.

## Key Components

1. **Zustand Store (`zenjinStore.ts`)**
   - Central state management with content fetching capabilities
   - Stores fetched stitch content in its state
   - Provides `fetchStitch` and `fetchStitchBatch` methods for content access

2. **Zustand Store Instance (`zenjin-store-instance.js`)**
   - Utility for accessing the Zustand store outside of React components
   - Provides a singleton reference to the store for non-React contexts (like the StateMachine)

3. **Zustand Stitch Adapter (`zustand-stitch-adapter.js`)**
   - Adapter that connects the StateMachine to the Zustand store
   - Provides the same interface as the old bundled content loader
   - Translates between Zustand store content format and StateMachine content format

4. **StateMachine (`StateMachine.js`)**
   - Now uses the Zustand Stitch Adapter instead of bundled content
   - Maintains the same API and behavior, but with server content

5. **MinimalDistinctionPlayer (`MinimalDistinctionPlayer.tsx`)**
   - Gets stitch content directly from the Zustand store
   - No longer relies on bundled content or separate server provider

## Data Flow

1. User state (tube/stitch structure) is loaded from the server or localStorage
2. When a stitch's content is needed:
   - Component calls `useZenjinStore(state => state.fetchStitch)(stitchId)`
   - Or StateMachine calls `zustandStitchAdapter.getStitchFromStore(stitchId)`
3. The Zustand store checks its cache for the stitch
   - If found, returns immediately
   - If not found, fetches from server API, caches, and returns
4. Components render the content from the Zustand store

## Benefits

1. **Single Source of Truth**:
   - All content is managed in one place (Zustand store)
   - No duplicate caching or content loading logic
   - Consistent content across all components

2. **Server-First**:
   - All content comes from the server API
   - No bundled content dependencies
   - Content can be updated without redeploying the application

3. **Efficient Caching**:
   - Zustand store caches content for efficient access
   - Components don't need to implement their own caching
   - Cache is shared across all components

4. **Clean Separation**:
   - StateMachine handles learning algorithms
   - Zustand handles content management
   - Components focus on rendering

5. **Compatibility**:
   - Maintains the same API for existing code
   - No changes needed to other components

## Implementation Details

### 1. Zustand Store Instance

```javascript
// zenjin-store-instance.js
const { useZenjinStore } = require('./zenjinStore');

let storeInstance = null;

function getStoreInstance() {
  if (!storeInstance) {
    storeInstance = useZenjinStore;
  }
  return storeInstance;
}

module.exports = { getStoreInstance };
```

### 2. Zustand Stitch Adapter

```javascript
// zustand-stitch-adapter.js
const { getStoreInstance } = require('../store/zenjin-store-instance');

async function getStitchFromStore(stitchId) {
  const store = getStoreInstance();
  return await store.getState().fetchStitch(stitchId);
}

async function getAllStitchesForThread(tubeNumber, threadId) {
  // Generate stitch IDs for this thread
  const stitchIds = [];
  for (let i = 1; i <= 10; i++) {
    stitchIds.push(`stitch-T${tubeNumber}-${threadNumber}-${i.toString().padStart(2, '0')}`);
  }
  
  // Fetch stitches from store
  const stitches = await getStitchBatchFromStore(stitchIds);
  
  // Format for StateMachine
  return formattedStitches.sort((a, b) => a.position - b.position);
}

// ... additional functions

module.exports = {
  getStitchFromStore,
  getStitchBatchFromStore,
  getAllStitchesForThread,
  loadContentIntoStateMachine,
  createEmergencyStitch
};
```

### 3. Using in StateMachine

```javascript
// StateMachine.js
const zustandStitchAdapter = require('./zustand-stitch-adapter');
const { loadContentIntoStateMachine } = require('./zustand-stitch-adapter');

// In constructor
setTimeout(async () => {
  await loadContentIntoStateMachine(this);
}, 100);

// In advanceStitchInTube
const allThreadStitches = await zustandStitchAdapter.getAllStitchesForThread(tubeNumber, currentStitch.threadId);
```

### 4. Using in MinimalDistinctionPlayer

```typescript
// MinimalDistinctionPlayer.tsx
import { useZenjinStore } from '../lib/store/zenjinStore';

// Inside component
const fetchStitch = useZenjinStore.getState().fetchStitch;

// When loading stitch content
fetchStitch(stitch.id).then(storeStitch => {
  if (storeStitch && storeStitch.questions) {
    stitch.questions = [...storeStitch.questions];
    // Use the questions...
  }
});
```

## Emergency Content Generation

For network failures or missing content, the system generates emergency fallback content:

1. The Zustand store has error handling that creates emergency content
2. The Zustand Stitch Adapter also has emergency content generation
3. The MinimalDistinctionPlayer has its own fallback question generation

This ensures a seamless experience even during network outages or server problems.

## Deployment and Testing

After making these changes:

1. Deploy the updated code to Vercel
2. Test the minimal player page to verify content loading
3. Check console logs for "Fetching stitch from Zustand store" messages
4. Verify that stitch advancement and question loading work correctly

## Conclusion

This new architecture provides a clean, efficient, and maintainable way to handle content in the Zenjin Maths application. By using Zustand as the single source of truth, we eliminate bundled content dependencies and ensure a consistent experience across all components.