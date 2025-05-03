# Position-Based StateMachine Implementation

This document explains the new position-based StateMachine implementation for the Triple-Helix learning system, which eliminates stitch position conflicts by design.

## Overview

The position-based StateMachine uses a fundamentally different data structure to represent stitch positions within tubes:

- Positions are used as the primary keys in an object
- Stitches are assigned to positions, not positions to stitches
- The active stitch is always at position 0
- When advancing stitches, positions are rearranged

This approach makes position conflicts impossible, as positions are keys in a map and can't be duplicated.

## Implementation Details

### State Structure

```javascript
// New position-based structure
state = {
  userId: "user-123",
  activeTubeNumber: 1,
  cycleCount: 0,
  tubes: {
    1: { 
      threadId: "thread-T1-001",
      positions: {
        0: { stitchId: "stitch-001", skipNumber: 3, distractorLevel: "L1" },
        1: { stitchId: "stitch-002", skipNumber: 1, distractorLevel: "L1" },
        2: { stitchId: "stitch-003", skipNumber: 5, distractorLevel: "L2" },
        // ... and so on
      }
    },
    // ... tubes 2 and 3
  }
}
```

### Key Operations

#### 1. Getting Current Stitch

```javascript
getCurrentStitch() {
  const tubeNumber = this.state.activeTubeNumber;
  const tube = this.state.tubes[tubeNumber];
  
  if (!tube || !tube.positions || !tube.positions[0]) return null;
  
  const currentPosition = tube.positions[0];
  
  return {
    id: currentPosition.stitchId,
    tubeNumber,
    skipNumber: currentPosition.skipNumber,
    distractorLevel: currentPosition.distractorLevel
  };
}
```

#### 2. Advancing Stitches

```javascript
advanceStitchInTube(tubeNumber) {
  const tube = this.state.tubes[tubeNumber];
  
  // Get current and next positions
  const currentPosition = tube.positions[0];
  const nextPosition = tube.positions[1];
  const skipNumber = currentPosition.skipNumber;
  
  // Create new positions mapping
  const newPositions = {};
  
  // Move next stitch to position 0
  newPositions[0] = { ...nextPosition };
  
  // Shift other stitches forward, skipping the spot for completed stitch
  for (let i = 2; i <= maxPosition; i++) {
    if (i < skipNumber) {
      newPositions[i - 1] = { ...tube.positions[i] };
    } else if (i > skipNumber) {
      newPositions[i] = { ...tube.positions[i] };
    }
  }
  
  // Place completed stitch at its skip position
  newPositions[skipNumber] = { ...currentPosition };
  
  // Update the tube
  tube.positions = newPositions;
}
```

#### 3. Cycling Tubes

```javascript
cycleTubes() {
  const prevTube = this.state.activeTubeNumber;
  
  // Cycle 1->2->3->1
  this.state.activeTubeNumber = prevTube === 3 ? 1 : prevTube + 1;
  
  // Increment cycle count if completing a full cycle
  if (prevTube === 3) {
    this.state.cycleCount += 1;
  }
}
```

## Migration from Legacy Format

The PositionBasedStateMachine includes a migration function to convert from the legacy array-based format:

```javascript
_migrateLegacyState(legacyState) {
  // Create new state object
  const newState = { /* base properties */ };
  
  // For each tube
  Object.entries(legacyState.tubes).forEach(([tubeNum, tube]) => {
    // Create positions object
    const positions = {};
    
    // Place current stitch at position 0
    const currentStitch = tube.stitches.find(s => s.id === tube.currentStitchId);
    positions[0] = {
      stitchId: currentStitch.id,
      skipNumber: currentStitch.skipNumber,
      distractorLevel: currentStitch.distractorLevel
    };
    
    // Place other stitches at positions 1+
    const otherStitches = tube.stitches.filter(s => s.id !== tube.currentStitchId);
    otherStitches.forEach((stitch, index) => {
      positions[index + 1] = {
        stitchId: stitch.id,
        skipNumber: stitch.skipNumber,
        distractorLevel: stitch.distractorLevel
      };
    });
    
    // Add converted tube to new state
    newState.tubes[tubeNum] = {
      threadId: tube.threadId,
      positions: positions
    };
  });
  
  return newState;
}
```

## Backward Compatibility

For backward compatibility, the position-based implementation provides a conversion method to the legacy format:

```javascript
toLegacyFormat() {
  // Create legacy state object
  const legacyState = { /* base properties */ };
  
  // For each tube
  Object.entries(this.state.tubes).forEach(([tubeNum, tube]) => {
    // Convert positions to stitches array
    const stitches = [];
    
    Object.entries(tube.positions).forEach(([position, data]) => {
      stitches.push({
        id: data.stitchId,
        position: parseInt(position),
        skipNumber: data.skipNumber,
        distractorLevel: data.distractorLevel
      });
    });
    
    // Add converted tube to legacy state
    legacyState.tubes[tubeNum] = {
      threadId: tube.threadId,
      currentStitchId: tube.positions[0]?.stitchId,
      stitches: stitches
    };
  });
  
  return legacyState;
}
```

## Integration Strategy

To adopt the position-based StateMachine with minimal risk:

1. **Feature Flag**: Add a feature flag to control which implementation is used
2. **Gradual Rollout**: Roll out to a small subset of users first
3. **Monitoring**: Monitor for any issues or discrepancies
4. **Full Adoption**: Once stable, roll out to all users

Example integration with feature flag:

```javascript
function createTripleHelixStateMachine(initialState, options = {}) {
  if (options.usePositionBasedStateMachine) {
    return new PositionBasedStateMachine(initialState);
  } else {
    return new StateMachine(initialState); // Legacy implementation
  }
}
```

## Benefits

1. **Zero Position Conflicts**: By design, position conflicts are impossible
2. **Cleaner Mental Model**: "Stitches fill positions" is more intuitive
3. **Better Performance**: Direct position lookups without searching
4. **Simpler Code**: No need for conflict detection or normalization
5. **More Robust**: Fewer edge cases and potential failure points

## Testing

The implementation includes comprehensive tests to ensure compatibility with the legacy implementation. All core operations (stitch completion, tube cycling) work identically.

Run the test driver with:

```
node test-position-based.js
```