# Tube-Stitch Model Documentation

## Overview

The Tube-Stitch model is a simplified architecture for the Zenjin Maths application, eliminating the unnecessary "thread" abstraction layer. This document outlines the implementation, benefits, and migration guide for this model.

## Core Concept

The Tube-Stitch model directly connects tubes to stitches, reflecting the natural relationship in the application's content structure:

```
Tubes → Stitches → Questions
```

Instead of going through a "thread" intermediary layer, we directly access stitches that belong to tubes.

## Why This Approach?

1. **Simplified Data Model**: Removes unnecessary abstractions, making the code more maintainable
2. **Direct Relationship**: Matches the conceptual model of how content is organized 
3. **Improved Performance**: Reduces indirection and object transformation
4. **Better Compatibility**: Works directly with both position-based and legacy formats
5. **Cleaner Code**: Reduces boilerplate and unnecessary adapters

## Implementation Details

### Data Model

Tubes contain references to their stitches in one of two formats:

1. **Position-based format** (preferred):
```typescript
tube = {
  positions: {
    0: { stitchId: "stitch-T1-001-01", skipNumber: 3, distractorLevel: "L1" },
    1: { stitchId: "stitch-T1-001-02", skipNumber: 3, distractorLevel: "L1" },
    // ...etc
  }
}
```

2. **Legacy stitches array format**:
```typescript
tube = {
  stitches: [
    { id: "stitch-T1-001-01", skipNumber: 3, distractorLevel: "L1" },
    { id: "stitch-T1-001-02", skipNumber: 3, distractorLevel: "L1" },
    // ...etc
  ]
}
```

### Component Interface

The new `TubeStitchPlayer` component has a clean and direct interface:

```typescript
interface TubeStitchPlayerProps {
  tubeNumber: number;        // Which tube to display
  tubeData: any;             // Contains tube data with positions or stitches
  onComplete: (results: any) => void;
  onEndSession?: (results: any) => void;
  questionsPerSession?: number;
  sessionTotalPoints?: number;
  userId?: string;           // User ID for API authentication
}
```

### Data Flow

1. The page loads tube data directly from the Zustand store
2. The player component extracts stitches from the tube
3. Questions are loaded from the stitch data
4. All interaction operates directly on the tube-stitch model
5. Results are reported in a tube-centric format

## Migrating From the Thread Model

### Before (Thread Model)

```typescript
// API expecting thread structure
const thread = {
  id: "thread-T1-001",
  stitches: [
    { id: "stitch-T1-001-01", ... }
  ]
};

// Rendering with thread dependency
<ThreadBasedPlayer 
  thread={thread}
  onComplete={handleComplete}
/>
```

### After (Tube-Stitch Model)

```typescript
// Direct tube data
const tubeData = {
  1: {
    positions: {
      0: { stitchId: "stitch-T1-001-01", ... }
    }
  }
};

// Rendering with tube-stitch approach
<TubeStitchPlayer
  tubeNumber={1}
  tubeData={tubeData}
  onComplete={handleComplete}
/>
```

## API Changes

When using the tube-stitch model, APIs should expect:

1. `tubeId` instead of `threadId`
2. Direct references to `stitchId` without thread context
3. Parameters like `skipNumber` and `distractorLevel` at the stitch level

Example API structure:
```json
{
  "tubeId": 1,
  "stitchId": "stitch-T1-001-01",
  "questionResults": [
    {
      "questionId": "question-123",
      "correct": true,
      "timeToAnswer": 1500,
      "firstTimeCorrect": true
    }
  ]
}
```

## Error Handling

The tube-stitch model provides more robust error handling:

1. Explicit checks for missing tube data
2. Direct stitch retrieval from Zustand store
3. Clear error messages for debugging
4. Graceful fallbacks when content isn't available
5. No reliance on complex fallback mechanisms

## Benefits Over Previous Implementation

1. **No Thread Dependencies**: Eliminates the entire thread abstraction layer
2. **Cleaner API Surface**: More straightforward props and data structure
3. **Better Performance**: Fewer transformations and indirection
4. **Improved Error States**: More specific error handling and diagnostics
5. **Direct Zustand Integration**: Uses Zustand store directly without adapters

## Core Components

1. **TubeStitchPlayer**: Main player component for tube-stitch model
2. **minimal-player.tsx**: Page that uses the tube-stitch player
3. **zenjinStore.ts**: Zustand store with direct tube-stitch access

## Usage Guidelines

1. Always use `tubeNumber` and `tubeData` props directly
2. Process both position-based and legacy formats as needed
3. Extract stitches directly from the tube data
4. Use the Zustand store for fetching stitch content
5. Report results with tube and stitch IDs explicitly

## Next Steps

1. Update remaining pages to use the tube-stitch model
2. Migrate all thread-based APIs to tube-stitch format
3. Clean up deprecated thread-related code
4. Update documentation to reflect the simplified model
5. Ensure all tests work with the new model

## Conclusion

The tube-stitch model represents a significant simplification of our architecture, removing unnecessary abstractions and aligning the code more closely with the conceptual model of our application. By eliminating the thread layer, we've made the code more maintainable, easier to understand, and better aligned with our actual data model.