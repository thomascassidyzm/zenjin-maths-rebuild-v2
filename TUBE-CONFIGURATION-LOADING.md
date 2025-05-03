# Tube Configuration Loading System

This document explains how the tube configuration loading system works in the Zenjin Maths player, following an offline-first approach.

## Core Design Principles

1. **Offline-First**: The system is designed to work without constant database connectivity
2. **localStorage for All Users**: All state changes are saved to localStorage during gameplay
3. **Database Persistence Only at End of Session**: Only save to database when explicitly ending the session
4. **Content Buffering**: Always maintain a buffer of 10+ stitches per tube
5. **Consistent API**: Identical API for anonymous and authenticated users

## User Types and Behavior

### Anonymous Users

Anonymous users always start with the default initial tube configuration:

1. First check if there's a saved configuration in localStorage (expires after 24 hours)
2. If no localStorage state, load the default configuration from the API
3. All state changes are saved to localStorage only
4. No database updates ever happen for anonymous users
5. A gentle reminder to create an account is shown

### Authenticated Users (New & Returning)

1. For first-time users:
   - Load the default configuration from the API
   - Save all state changes to localStorage during gameplay
   - Only save to database when explicitly ending the session

2. For returning users:
   - Load their personalized configuration from the API
   - If offline, fall back to the localStorage version
   - Save all state changes to localStorage during gameplay
   - Only save to database when explicitly ending the session

## System Components

### 1. Tube Configuration Loader (`lib/tube-config-loader.js`)

This module handles the loading of complete tube configurations and provides core functionality:

- `loadCompleteTubeConfiguration(user)` - Loads a complete snapshot of the tube configuration with active stitches for a given user
- `preloadThreadStitches(tubeNumber, threadId, currentStitchIndex, count)` - Lazy loads additional stitches for a specific thread
- `saveToLocalStorage(userId, config)` - Saves state to localStorage for all user types
- `loadFromLocalStorage(userId)` - Loads state from localStorage
- `endSession(userId, config)` - Saves all progress to the database (only for authenticated users)

### 2. Tube Configuration Integration (`lib/tube-config-integration.js`)

This integration layer adapts the tube configuration loader to work with the Triple-Helix architecture:

- `initializeTubeCycler(user, options)` - Creates and initializes a TubeCyclerAdapter with the correct configuration
- `monitorContentBuffer(adapter, minBuffer, desiredBuffer)` - Ensures 10-stitch buffer is maintained
- `endSession(user, adapter)` - Batch save to database at end of session
- `createStitchCompletionHandler(adapter, updateUI)` - Handle stitch completion with proper sequence

### 3. API Endpoints

- `/api/user-stitches` - Returns the complete tube configuration
- `/api/thread-stitches` - Lazy loads additional stitches
- `/api/end-session` - Batch saves all progress to database at end of session

## Content Buffer Management

To ensure smooth gameplay even with intermittent connectivity:

1. Initial load includes prefetching 3 stitches per thread
2. Content buffer monitoring ensures 10+ stitches are available per tube
3. When the user progresses to within 5 stitches of the buffer end, more stitches are loaded
4. If connectivity is lost, the system can continue with already loaded stitches
5. All loaded content is saved to localStorage as backup

## State Persistence

### During Gameplay:

- **Every 30 seconds**: All state is saved to localStorage
- **After stitch completion**: State is saved to localStorage
- **Page unload**: Final state is saved to localStorage
- **No database updates**: Database is not updated during active gameplay

### End of Session:

- User explicitly ends session by clicking "End Session" button
- All state is batch-saved to database (authenticated users only)
- Final state also saved to localStorage as fallback

## Example Usage

Here's a simple example of using the system in a React component:

```jsx
import { useEffect, useState } from 'react';
import { 
  initializeTubeCycler, 
  createStitchCompletionHandler,
  endSession
} from '../lib/tube-config-integration';

function PlayerComponent({ user }) {
  const [tubeCycler, setTubeCycler] = useState(null);
  const [currentStitch, setCurrentStitch] = useState(null);
  
  // Initialize on component mount
  useEffect(() => {
    async function initialize() {
      const adapter = await initializeTubeCycler(user, {
        onStateChange: handleStateChange
      });
      
      setTubeCycler(adapter);
      setCurrentStitch(adapter.getCurrentStitch());
    }
    
    initialize();
    
    return () => {
      if (tubeCycler) tubeCycler.destroy();
    };
  }, [user]);
  
  // Handle perfect score
  const handlePerfectScore = createStitchCompletionHandler(tubeCycler, 
    (adapter) => setCurrentStitch(adapter.getCurrentStitch())
  );

  // End session
  const handleEndSession = async () => {
    await endSession(user, tubeCycler);
    alert('Progress saved!');
  };
  
  return (
    <div>
      {currentStitch && (
        <div>
          <h2>{currentStitch.id}</h2>
          <p>{currentStitch.content}</p>
          
          <button onClick={() => 
            handlePerfectScore(currentStitch.threadId, currentStitch.id, 20, 20)
          }>
            Perfect Score
          </button>
          
          <button onClick={handleEndSession}>
            End Session & Save Progress
          </button>
        </div>
      )}
    </div>
  );
}
```

## Recovery from Connection Issues

The system is designed to handle various connection scenarios:

1. **No connectivity at startup**: 
   - Anonymous users get default configuration from localStorage or default
   - Authenticated users get saved state from localStorage or fail

2. **Loss of connectivity during gameplay**:
   - Continue with already loaded stitches
   - All state changes saved to localStorage
   - Next batch of stitches will load when connectivity returns

3. **Connectivity returns after being offline**:
   - Resume normal operation with existing state
   - Load additional stitches when needed

## Troubleshooting

Common issues and solutions:

1. **No content loads**: 
   - Check network connectivity
   - Check if localStorage is available and not full
   - Try clearing browser cache

2. **End Session button doesn't save**:
   - Check network connectivity
   - Verify user is properly authenticated
   - Check browser console for errors

3. **Missing stitches in buffer**:
   - Manually trigger buffer check
   - Check network connectivity
   - Verify API endpoints are responding

4. **State not persisting between sessions**:
   - Check if localStorage is enabled
   - Verify the storage key format is correct
   - Check browser storage limits