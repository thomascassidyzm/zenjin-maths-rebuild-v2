# Tube-Stitch Adapter Documentation

## Overview

This document outlines our approach for adapting the tube-stitch data model to work with our existing MinimalDistinctionPlayer component. Instead of completely rewriting the player, we've implemented an adapter pattern that preserves the excellent functionality of the existing player while moving toward a cleaner underlying data structure.

## Why Adapter Pattern?

1. **Preserve Working Functionality**: The MinimalDistinctionPlayer performs exceptionally well with great UX and animations.
2. **Gradual Migration**: Allows us to modernize our data model without a disruptive rewrite.
3. **Reduced Risk**: Minimizes the chance of introducing bugs into a critical component.
4. **Clean Separation**: Keeps the adapter logic in the page component, leaving the player component unchanged.
5. **Best of Both Worlds**: Modern data model in the backend, proven UI component for users.

## Implementation Details

### The Adapter Function

We've implemented `createThreadFromTube`, a function that transforms our modern tube-stitch data into the thread format the player expects:

```typescript
const createThreadFromTube = (tubeData, tubeNumber) => {
  const activeTube = tubeData[tubeNumber];
  if (!activeTube) return null;
  
  // Get stitches from either positions or stitches array
  let stitches = [];
  
  // Handle position-based format
  if (activeTube.positions && Object.keys(activeTube.positions).length > 0) {
    stitches = Object.entries(activeTube.positions)
      .map(([position, data]) => ({
        id: data.stitchId,
        position: parseInt(position),
        skipNumber: data.skipNumber || 3,
        distractorLevel: data.distractorLevel || 'L1',
        questions: data.questions || []
      }))
      .sort((a, b) => a.position - b.position);
  }
  // Handle legacy format
  else if (activeTube.stitches && activeTube.stitches.length > 0) {
    stitches = [...activeTube.stitches];
  }
  
  if (stitches.length === 0) return null;
  
  // Create thread object
  return {
    id: `thread-T${tubeNumber}-001`,
    tubeId: tubeNumber,
    stitches,
    currentStitchId: activeTube.currentStitchId || stitches[0].id
  };
};
```

### Usage in Pages

The adapter is used in the minimal-player.tsx page:

```typescript
// Create thread from tube data
const thread = createThreadFromTube(tubeData, activeTubeNumber);

// Pass the thread to the player
return (
  <MinimalDistinctionPlayer
    thread={thread}
    onComplete={handleComplete}
    questionsPerSession={10}
    sessionTotalPoints={totalPoints || 0}
    userId={user?.id}
  />
);
```

## Benefits of This Approach

1. **Zero Player Changes**: We keep the player code that's working well exactly as-is.
2. **Simplified Data Model**: We can use the cleaner tube-stitch model throughout the app.
3. **Gradual Migration**: We can refactor other components at our own pace.
4. **Improved Maintainability**: Clear separation between data model and UI components.
5. **Future-Proofing**: Prepares us for full migration to tube-stitch model when appropriate.

## Data Model Comparison

### Thread Model (Legacy)
```
threads → stitches → questions
```

### Tube-Stitch Model (Modern)
```
tubes → (positions) → stitches → questions
```

The adapter transforms the modern format into the legacy format the player expects, creating a seamless experience.

## Position-Based Format Support

The adapter handles both modern position-based and legacy array-based stitch formats:

1. **Position-Based Format** (preferred):
```typescript
tube = {
  positions: {
    0: { stitchId: "stitch-T1-001-01", ... },
    1: { stitchId: "stitch-T1-001-02", ... },
  }
}
```

2. **Legacy Stitches Array Format**:
```typescript
tube = {
  stitches: [
    { id: "stitch-T1-001-01", ... },
    { id: "stitch-T1-001-02", ... },
  ]
}
```

## Next Steps

1. **Continue Using Both Models**: Use tube-stitch model in Zustand store but maintain thread model for player.
2. **Gradually Update API Calls**: Update API endpoints to work with the tube-stitch model.
3. **Create Tube-Specific Components**: New components should use the tube-stitch model directly.
4. **Documentation**: Ensure all new code is documented to explain the adapter pattern.
5. **Future Migration**: Eventually, we may fully migrate the player to use the tube-stitch model directly if needed.

## Conclusion

Our adapter approach provides a pragmatic path forward - we maintain the excellent player functionality that delivers great user experience while gradually modernizing our underlying data structures. This balances immediate user needs with long-term code maintainability.