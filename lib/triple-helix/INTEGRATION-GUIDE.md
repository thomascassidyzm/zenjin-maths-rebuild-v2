# Triple-Helix Integration Guide

This guide explains how to integrate the improved Triple-Helix components into the existing player UI.

## Core Components

The Triple-Helix system consists of several core components:

1. **StateMachine**: Core logic for tube cycling and stitch advancement
2. **ContentManager**: Handles content preloading and caching
3. **SessionManager**: Manages session state and persistence
4. **TubeCyclerAdapter**: Connects the core components to the UI

## Integration Steps

### 1. Import the Triple-Helix Components

```javascript
import { TubeCyclerAdapter } from '../lib/triple-helix';
```

### 2. Initialize the TubeCyclerAdapter

Replace the existing initialization code with:

```javascript
const [tubeCycler, setTubeCycler] = useState(null);

// Initialize on component mount
useEffect(() => {
  const adapter = new TubeCyclerAdapter({
    userId: 'user-123', // Replace with actual user ID
    onStateChange: handleStateChange,
    onTubeChange: handleTubeChange,
    debug: true // Set to false in production
  });
  
  setTubeCycler(adapter);
  setCurrentStitch(adapter.getCurrentStitch());
  setTubeStitches(adapter.getCurrentTubeStitches());
  setIsLoading(false);
}, []);
```

### 3. Use the Adapter for Player Operations

Replace the existing player operations with:

```javascript
// Complete stitch with perfect score (20/20)
const handlePerfectScore = () => {
  if (!tubeCycler || !currentStitch) return;
  
  // First, cycle to the next tube - this happens immediately on completion
  tubeCycler.nextTube();
  
  // Then, process the stitch completion in the previous tube
  setTimeout(() => {
    tubeCycler.handleStitchCompletion(
      currentStitch.threadId,
      currentStitch.id,
      20,  // Perfect score
      20   // Total questions
    );
    
    // Update UI state
    setCurrentStitch(tubeCycler.getCurrentStitch());
    setTubeStitches(tubeCycler.getCurrentTubeStitches());
  }, 500);
};

// Complete stitch with partial score (15/20)
const handlePartialScore = () => {
  if (!tubeCycler || !currentStitch) return;
  
  // First, cycle to the next tube - this happens immediately on completion
  tubeCycler.nextTube();
  
  // Then, process the stitch completion in the previous tube
  setTimeout(() => {
    tubeCycler.handleStitchCompletion(
      currentStitch.threadId,
      currentStitch.id,
      15,  // Partial score
      20   // Total questions
    );
    
    // Update UI state
    setCurrentStitch(tubeCycler.getCurrentStitch());
    setTubeStitches(tubeCycler.getCurrentTubeStitches());
  }, 500);
};

// Move to the next tube manually
const handleNextTube = () => {
  if (!tubeCycler) return;
  
  tubeCycler.nextTube();
  setCurrentStitch(tubeCycler.getCurrentStitch());
  setTubeStitches(tubeCycler.getCurrentTubeStitches());
};
```

### 4. Clean Up Resources on Unmount

```javascript
useEffect(() => {
  return () => {
    if (tubeCycler) {
      tubeCycler.destroy();
    }
  };
}, [tubeCycler]);
```

## Key Integration Points

### Stitch Completion Sequence

The critical sequence for perfect scores is:

1. First rotate to the next tube immediately
2. Then process the stitch completion in the previous tube
3. Update the UI to reflect both changes

This sequence ensures:
- Users immediately see the next content
- The completed stitch is properly advanced in its tube

### Skip Number Progression

The skip number progression follows this sequence:
1 → 3 → 5 → 10 → 25 → 100

### Content Preloading

Content preloading happens automatically:
- Initial stitches are loaded on mount
- Next stitches are preloaded in the background
- When a stitch is completed, the next potential stitches are preloaded

### Batch Persistence

Changes are persisted in batches:
- During normal operation, changes are queued
- Periodically (every 5 minutes), changes are persisted to the server
- On page unload, all pending changes are persisted

## Example Implementation

```jsx
import React, { useState, useEffect } from 'react';
import { TubeCyclerAdapter } from '../lib/triple-helix';

function TripleHelixPlayer() {
  // State
  const [currentStitch, setCurrentStitch] = useState(null);
  const [tubeStitches, setTubeStitches] = useState([]);
  const [currentTube, setCurrentTube] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [tubeCycler, setTubeCycler] = useState(null);
  
  // Initialize the adapter on mount
  useEffect(() => {
    const adapter = new TubeCyclerAdapter({
      userId: 'user-123', // Replace with actual user ID
      onStateChange: handleStateChange,
      onTubeChange: handleTubeChange
    });
    
    setTubeCycler(adapter);
    setCurrentStitch(adapter.getCurrentStitch());
    setTubeStitches(adapter.getCurrentTubeStitches());
    setCurrentTube(adapter.getCurrentTube());
    setIsLoading(false);
    
    // Clean up on unmount
    return () => {
      adapter.destroy();
    };
  }, []);
  
  // State change handler
  const handleStateChange = (newState) => {
    // Update UI based on state changes
    setCurrentStitch(tubeCycler.getCurrentStitch());
    setTubeStitches(tubeCycler.getCurrentTubeStitches());
  };
  
  // Tube change handler
  const handleTubeChange = (tubeNumber) => {
    setCurrentTube(tubeNumber);
  };
  
  // Handle stitch completion
  const handleStitchCompletion = (score, totalQuestions) => {
    if (!tubeCycler || !currentStitch) return;
    
    // First, cycle to the next tube
    tubeCycler.nextTube();
    
    // Then process the completion
    setTimeout(() => {
      tubeCycler.handleStitchCompletion(
        currentStitch.threadId,
        currentStitch.id,
        score,
        totalQuestions
      );
      
      // Update UI
      setCurrentStitch(tubeCycler.getCurrentStitch());
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
    }, 500);
  };
  
  // Render
  return (
    <div className="triple-helix-player">
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div>
          {/* Display current tube */}
          <div>Current Tube: {currentTube}</div>
          
          {/* Display current stitch */}
          {currentStitch && (
            <div>
              <h2>{currentStitch.id}</h2>
              <p>{currentStitch.content}</p>
              
              {/* Display questions */}
              <div>
                {currentStitch.questions?.map(question => (
                  <div key={question.id}>
                    <p>{question.text}</p>
                    <p>Answer: {question.correctAnswer}</p>
                  </div>
                ))}
              </div>
              
              {/* Action buttons */}
              <div>
                <button onClick={() => handleStitchCompletion(20, 20)}>
                  Perfect Score
                </button>
                <button onClick={() => handleStitchCompletion(15, 20)}>
                  Partial Score
                </button>
                <button onClick={() => tubeCycler.nextTube()}>
                  Next Tube
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TripleHelixPlayer;
```

## Debugging

Enable debug mode to see detailed logs:

```javascript
const adapter = new TubeCyclerAdapter({
  userId: 'user-123',
  debug: true
});
```

You can also check the adapter's state and stats:

```javascript
// Get current state
const state = tubeCycler.getState();
console.log('Current state:', state);

// Get statistics
const stats = tubeCycler.getStats();
console.log('Statistics:', stats);
```

## Important Notes

1. **Rotation Lock**: The adapter implements a rotation lock to prevent double rotations. Do not attempt to override this mechanism.

2. **Stitch Sequence**: Always follow the sequence: tube rotation first, then stitch completion.

3. **Content Preloading**: The ContentManager automatically preloads content. No manual preloading is required.

4. **Batch Persistence**: Changes are automatically persisted. Call `tubeCycler.persist()` if you need to force immediate persistence.

5. **Clean Up**: Always call `tubeCycler.destroy()` when unmounting the component to ensure resources are properly cleaned up.