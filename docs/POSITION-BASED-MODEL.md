# Position-Based Model and Server Persistence

This document explains the implementation of the position-based model in the Triple Helix learning system and how it persists state to the server.

## Overview

The position-based model uses explicit position keys (like "0", "1", "4", "5") to store stitches in tubes, rather than relying on array indices. This allows stitches to move between positions as they are completed, without affecting other stitches.

## State Structure

The position data is stored in the Zustand store with the following structure:

```typescript
tubeState: {
  activeTube: 1,
  tubes: {
    1: {
      threadId: "thread-T1-001",
      currentStitchId: "stitch-T1-001-01",
      stitchOrder: ["stitch-T1-001-01", "stitch-T1-001-02"],
      positions: {
        "4": { 
          stitchId: "stitch-T1-001-01", 
          skipNumber: 5,
          distractorLevel: 1,
          perfectCompletions: 1 
        },
        "5": { 
          stitchId: "stitch-T1-001-02", 
          skipNumber: 5,
          distractorLevel: 1,
          perfectCompletions: 1 
        }
      }
    }
  }
}
```

## Server Persistence Fix

When implementing server persistence for the position-based model, we encountered an issue where position keys were being transformed during the load process. The database correctly stored positions with keys like "4" and "5", but the application was rebuilding them as "0" and "1" based on array indices.

### The Problem

1. Saving the state to the database worked correctly - positions "4" and "5" were properly stored
2. Loading the state from the database also retrieved the correct position keys
3. However, the transformation logic that processed the loaded state was rebuilding positions based on array indices, resulting in positions "0" and "1" instead of "4" and "5"

### The Solution

The fix was to preserve the original position structure during loading by directly copying tube objects without rebuilding them:

```typescript
// In loadFromServer method of zenjinStore.ts
if (tube.positions && Object.keys(tube.positions).length > 0) {
  // Deep copy the entire tube to preserve all properties, especially positions
  tubeState.tubes[tubeKey] = JSON.parse(JSON.stringify(tube));
  
  // Skip the rest of the processing for this tube
  return;
}
```

This change prevents the position rebuilding logic from replacing position keys with array indices.

## Key Learnings

1. **Avoid Unnecessary Transformations**: When working with position-based data, avoid rebuilding the structure unnecessarily.

2. **Preserve Original Data Structures**: When loading state from the server, preserve the original keys and structure.

3. **Deep Copy for Nested Objects**: Use `JSON.parse(JSON.stringify())` for proper deep copying of nested state objects.

4. **Direct Storage and Retrieval**: The database stores JSON objects correctly - transformation issues happen in application code.

## Testing Server Persistence

The `/pages/server-persistence-test.tsx` page provides a test environment for verifying server persistence with the position-based model. It allows:

1. Creating a test user with initial positions
2. Moving stitches between positions (e.g., from position 0 to position 5)
3. Saving the state to the server
4. Clearing local state
5. Loading the state back from the server

When working correctly, position keys like "4" and "5" should be preserved throughout the save/load cycle.

## Database Structure

The `user_state` table in the database stores the state as a JSONB field, preserving the exact structure including position keys. A query to verify the positions:

```sql
SELECT state->'tubeState'->'tubes'->'1'->'positions' as tube1_positions 
FROM user_state 
WHERE user_id = 'test-user-id' 
ORDER BY created_at DESC LIMIT 1;
```

Should return the positions object with the correct keys.