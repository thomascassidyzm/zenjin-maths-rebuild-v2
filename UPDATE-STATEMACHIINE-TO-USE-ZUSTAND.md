# Updating StateMachine to Use Zustand

This document outlines the approach for updating the StateMachine to use the Zustand store directly for content loading instead of bundled content.

## Overview

The current StateMachine implementation uses bundled content for loading stitch data. We'll modify it to use the Zustand store instead, creating a clean server-first approach that eliminates the need for bundled content.

## Implementation Plan

1. Update `StateMachine.js` to use the Zustand store for content fetching
2. Keep the same API and internal structure for backward compatibility
3. Update `MinimalDistinctionPlayer.tsx` to get stitch content from Zustand
4. Remove dependencies on bundled content files

## Simple Implementation

### 1. Create a utility wrapper for StateMachine

```javascript
// Create this file: /lib/triple-helix/zustand-stitch-adapter.js

// Import Zustand store
const { getStoreInstance } = require('../store/zenjin-store-instance');

/**
 * Get a stitch from the Zustand store
 * @param {string} stitchId - The ID of the stitch to fetch
 * @returns {Promise<Object|null>} The stitch content or null if not found
 */
async function getStitchFromStore(stitchId) {
  // Get the store instance (singleton)
  const store = getStoreInstance();
  
  // Use the fetchStitch method from the store
  return await store.getState().fetchStitch(stitchId);
}

/**
 * Get multiple stitches from the Zustand store
 * @param {string[]} stitchIds - Array of stitch IDs to fetch
 * @returns {Promise<Object>} Object mapping stitch IDs to stitch content
 */
async function getStitchBatchFromStore(stitchIds) {
  // Get the store instance
  const store = getStoreInstance();
  
  // Use the fetchStitchBatch method from the store
  return await store.getState().fetchStitchBatch(stitchIds);
}

/**
 * Get all stitches for a thread from the Zustand store
 * @param {number} tubeNumber - The tube number (1-3)
 * @param {string} threadId - The thread ID
 * @returns {Promise<Array>} Array of stitch objects with positions set
 */
async function getAllStitchesForThread(tubeNumber, threadId) {
  // Get the store instance
  const store = getStoreInstance();
  
  // Extract thread number from ID (format: thread-T{tubeNum}-{threadNum})
  const threadMatch = threadId.match(/thread-T\d+-(\d+)/);
  if (!threadMatch) {
    return [];
  }
  
  const threadNumber = threadMatch[1]; // e.g., "001"
  
  // Generate stitch IDs for this thread (assume up to 10 stitches per thread)
  const stitchIds = [];
  for (let i = 1; i <= 10; i++) {
    stitchIds.push(`stitch-T${tubeNumber}-${threadNumber}-${i.toString().padStart(2, '0')}`);
  }
  
  // Fetch all stitches in this thread
  const stitches = await getStitchBatchFromStore(stitchIds);
  
  // Convert to the format expected by StateMachine
  const formattedStitches = [];
  
  // For each stitch fetched, format it for the StateMachine
  Object.entries(stitches).forEach(([stitchId, stitchData], index) => {
    formattedStitches.push({
      id: stitchId,
      threadId: threadId,
      position: index, // Position is sequential for initial load
      skipNumber: 3, // Default skip number
      distractorLevel: 'L1', // Default distractor level
      tubeNumber: tubeNumber,
      content: stitchData.content,
      title: stitchData.title,
      questions: stitchData.questions || []
    });
  });
  
  // Sort stitches by position
  return formattedStitches.sort((a, b) => a.position - b.position);
}

/**
 * Load content for a state machine from the Zustand store
 * @param {Object} stateMachine - The state machine instance
 * @returns {Promise<boolean>} Success status
 */
async function loadContentIntoStateMachine(stateMachine) {
  if (!stateMachine || !stateMachine.state || !stateMachine.state.tubes) {
    console.error('Invalid state machine for loading content');
    return false;
  }
  
  console.log('Loading content into state machine from Zustand store');
  
  // Process each tube (1, 2, 3)
  for (let tubeNumber = 1; tubeNumber <= 3; tubeNumber++) {
    const tube = stateMachine.state.tubes[tubeNumber];
    
    if (!tube) {
      console.error(`Tube ${tubeNumber} not found in state machine`);
      continue;
    }
    
    // Set thread ID if not already set
    if (!tube.threadId) {
      tube.threadId = `thread-T${tubeNumber}-001`;
      console.log(`Set thread ID for tube ${tubeNumber} to ${tube.threadId}`);
    }
    
    try {
      // Load all stitches for this tube and thread
      const tubeStitches = await getAllStitchesForThread(tubeNumber, tube.threadId);
      
      if (tubeStitches.length > 0) {
        console.log(`Loaded ${tubeStitches.length} stitches for tube ${tubeNumber} from Zustand store`);
        
        // Add the stitches to the tube's stitches array, avoiding duplicates
        const existingStitchIds = new Set(tube.stitches.map(s => s.id));
        const newStitches = tubeStitches.filter(s => !existingStitchIds.has(s.id));
        
        if (newStitches.length > 0) {
          tube.stitches.push(...newStitches);
          console.log(`Added ${newStitches.length} new stitches to tube ${tubeNumber}`);
        }
        
        // If no current stitch is set, set the first stitch as current
        if (!tube.currentStitchId && tube.stitches.length > 0) {
          const firstStitch = tube.stitches.find(s => s.id.endsWith('-01'));
          if (firstStitch) {
            tube.currentStitchId = firstStitch.id;
            console.log(`Set current stitch for tube ${tubeNumber} to ${firstStitch.id}`);
          } else {
            // If no -01 stitch found, use the first stitch alphabetically
            tube.currentStitchId = tube.stitches[0].id;
            console.log(`Set current stitch for tube ${tubeNumber} to ${tube.stitches[0].id}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error loading stitches for tube ${tubeNumber}:`, error);
    }
  }
  
  // Save state after loading all stitches
  stateMachine._saveState();
  console.log('Saved state machine state after loading content');
  
  return true;
}

// Export the adapter functions
module.exports = {
  getStitchFromStore,
  getStitchBatchFromStore,
  getAllStitchesForThread,
  loadContentIntoStateMachine
};
```

### 2. Create a Zustand store instance utility

```javascript
// Create this file: /lib/store/zenjin-store-instance.js

// Import Zustand store
const { useZenjinStore } = require('./zenjinStore');

// Store instance reference for non-React contexts
let storeInstance = null;

/**
 * Get the Zustand store instance
 * Can be used outside of React components
 * @returns {Object} The store instance
 */
function getStoreInstance() {
  if (!storeInstance) {
    storeInstance = useZenjinStore;
  }
  return storeInstance;
}

module.exports = {
  getStoreInstance
};
```

### 3. Update the StateMachine.js file

```javascript
// Update the imports at the top of StateMachine.js

// Remove these lines:
// const stitchLoader = require('../stitch-loader');
// const { loadBundledStitchesIntoStateMachine } = require('../load-bundled-stitches');

// Add these lines:
const zustandStitchAdapter = require('./zustand-stitch-adapter');
const { loadContentIntoStateMachine } = require('./zustand-stitch-adapter');
```

Then update the initialization in the constructor:

```javascript
// Replace this in the constructor:
setTimeout(() => {
  loadBundledStitchesIntoStateMachine(this);
}, 100);

// With this:
setTimeout(async () => {
  await loadContentIntoStateMachine(this);
}, 100);
```

Finally, update the advanceStitchInTube method to use the Zustand adapter:

```javascript
// Replace stitchLoader references with zustandStitchAdapter

// Replace:
const allThreadStitches = stitchLoader.getAllStitchesForThread(tubeNumber, currentStitch.threadId);

// With:
const allThreadStitches = await zustandStitchAdapter.getAllStitchesForThread(tubeNumber, currentStitch.threadId);
```

### 4. Update MinimalDistinctionPlayer.tsx

```typescript
// In MinimalDistinctionPlayer.tsx

// Remove this import:
import { BUNDLED_FULL_CONTENT } from '../lib/server-content-provider';

// Add this import:
import { useZenjinStore } from '../lib/store/zenjinStore';

// Inside the component, get the fetchStitch function from Zustand:
const fetchStitch = useZenjinStore(state => state.fetchStitch);
```

Then update the stitch content loading logic:

```typescript
// Replace the section that tries to load from BUNDLED_FULL_CONTENT with:

// Simple debug logging
console.log(`DEBUG: Fetching stitch ${stitch.id} from Zustand store`);

// Check if the stitch already has questions
if (stitch.questions && stitch.questions.length > 0) {
  console.log(`DEBUG: Stitch ${stitch.id} already has ${stitch.questions.length} questions`);
} else {
  try {
    // Fetch the stitch from the Zustand store
    fetchStitch(stitch.id).then(serverStitch => {
      if (serverStitch && serverStitch.questions && serverStitch.questions.length > 0) {
        console.log(`SUCCESS: Fetched ${serverStitch.questions.length} questions for stitch ${stitch.id}`);
        stitch.questions = [...serverStitch.questions];
        
        // If we're initializing a session, load the first question
        if (sessionQs && sessionQs.length === 0 && stitch.questions.length > 0) {
          const allQuestions = [...stitch.questions];
          const sessionQuestions = allQuestions.slice(0, Math.min(questionsPerSession, allQuestions.length));
          setSessionQuestions(sessionQuestions);
          
          // Start with the first question
          if (sessionQuestions.length > 0) {
            setIsInitialized(true);
            loadQuestion(sessionQuestions[0], false);
          }
        }
      } else {
        console.warn(`ERROR: Failed to fetch valid questions for stitch ${stitch.id}`);
        useFallbackQuestions();
      }
    }).catch(error => {
      console.error(`ERROR: Failed to fetch stitch ${stitch.id}:`, error);
      useFallbackQuestions();
    });
  } catch (error) {
    console.error(`ERROR: Exception while fetching stitch ${stitch.id}:`, error);
    useFallbackQuestions();
  }
}
```

## Summary of Changes

1. **New Files**:
   - `/lib/triple-helix/zustand-stitch-adapter.js`: Bridge between StateMachine and Zustand
   - `/lib/store/zenjin-store-instance.js`: Utility to access store outside React

2. **Modified Files**:
   - `StateMachine.js`: Updated to use Zustand adapter instead of bundled content
   - `MinimalDistinctionPlayer.tsx`: Updated to fetch content from Zustand

3. **No Longer Used**:
   - `stitch-loader.js`: Replaced by Zustand store functions
   - `load-bundled-stitches.js`: Replaced by Zustand adapter
   - `expanded-bundled-content.ts`: No longer needed, content comes from server via Zustand

This approach preserves the same StateMachine API and behavior while eliminating the dependency on bundled content. All content is now fetched from the server via the Zustand store, which serves as a single source of truth for the application state.

## Benefits

1. **Single Source of Truth**: All content is managed by Zustand
2. **Clean Separation**: StateMachine handles learning algorithms, Zustand handles content
3. **Server-First**: All content comes from the server, no bundling required
4. **Compatibility**: Maintains the same API for existing code
5. **Caching**: Leverages Zustand's built-in state management for efficient content access