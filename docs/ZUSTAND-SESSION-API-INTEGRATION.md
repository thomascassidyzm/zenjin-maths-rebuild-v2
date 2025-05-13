# Zustand Session API Integration Guide

This guide explains how to integrate the new Zustand-based session management components with existing code, ensuring all API calls go through the Zustand store as a single source of truth.

## Core Components

We've created several new components to streamline API interactions:

1. **SessionMetricsProvider**: Handles session metrics recording
2. **StateManager**: Manages state persistence and synchronization
3. **Zustand Store**: Centralized state management with API integration

## Integration Steps

### 1. Recording Session Metrics

Replace direct API calls to `/api/record-session` with the SessionMetricsProvider:

```jsx
// Before
const handleSessionComplete = async (results) => {
  try {
    const response = await fetch('/api/record-session', {
      method: 'POST',
      body: JSON.stringify({
        threadId: thread.id,
        stitchId: stitch.id,
        questionResults: results.results
      })
    });
    // Handle response...
  } catch (error) {
    console.error('Error recording session:', error);
  }
};

// After
import SessionMetricsProvider from '../lib/components/SessionMetricsProvider';

// In your component
return (
  <SessionMetricsProvider 
    tubeId={tubeNumber}
    stitchId={stitchId}
    onSessionRecorded={(result) => {
      console.log('Session recorded:', result);
      // Show session summary or navigate
    }}
  >
    <YourPlayerComponent />
  </SessionMetricsProvider>
);

// In YourPlayerComponent
const handleSessionComplete = (results, isEndSession) => {
  if (isEndSession && props.recordSession) {
    props.recordSession(results);
  }
};
```

The `SessionMetricsProvider` automatically:
- Handles content loading and format validation
- Derives thread IDs from tube IDs (for backwards compatibility)
- Records sessions through the Zustand store
- Provides loading/error states to child components

### 2. Managing State Persistence

Replace direct API calls to `/api/user-state` with the StateManager:

```jsx
// Before
const syncState = async () => {
  try {
    await fetch('/api/user-state', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        state: currentState
      })
    });
  } catch (error) {
    console.error('Error syncing state:', error);
  }
};

// After
import StateManager from '../lib/components/StateManager';

// In your component
return (
  <StateManager 
    autoSync={true} 
    syncInterval={60000}
    onStateChange={(state) => console.log('State updated:', state)}
  >
    <YourAppComponent />
  </StateManager>
);

// In YourAppComponent
const handleSaveProgress = () => {
  if (props.syncState) {
    props.syncState();
  }
};
```

The `StateManager` component:
- Handles automatic state synchronization
- Provides manual sync/load methods to child components
- Ensures all API interactions go through Zustand

### 3. Loading Content

Replace direct API calls to fetch content with Zustand hooks:

```jsx
// Before
const [stitch, setStitch] = useState(null);
useEffect(() => {
  const fetchStitch = async () => {
    const response = await fetch(`/api/content?id=${stitchId}`);
    const data = await response.json();
    setStitch(data);
  };
  fetchStitch();
}, [stitchId]);

// After
import { useZenjinStore } from '../lib/store';

const { fetchStitch, contentCollection } = useZenjinStore();
const [loading, setLoading] = useState(true);

useEffect(() => {
  const loadStitch = async () => {
    setLoading(true);
    await fetchStitch(stitchId);
    setLoading(false);
  };
  loadStitch();
}, [stitchId, fetchStitch]);

// Access content from the store
const stitch = contentCollection?.stitches?.[stitchId];
```

## Converting from Thread-Based to Tube-Based Model

The new system supports both models, but prefers the tube-stitch model:

```jsx
// Thread-based (legacy)
const threadId = "thread-T1-001";
const stitchId = "stitch-T1-001-01";

// Tube-based (preferred)
const tubeId = 1;
const stitchId = "stitch-T1-001-01";
```

When using the new components:
- If you provide `tubeId`, it will automatically derive `threadId` if needed
- If your API still requires `threadId`, it will be generated from `tubeId`

## Handling Visual Elements

### Bubbles Animation

Ensure the bubbles animation is loaded once and persists across the app:

```jsx
// In your main layout or player component
<div className={styles.playerContainer}>
  {/* Persistent bubble animation */}
  <div className={styles.bubblesContainer}>
    {Array.from({ length: 20 }).map((_, i) => (
      <div 
        key={i} 
        className={styles.bubble}
        style={{
          width: `${20 + Math.random() * 40}px`,
          height: `${20 + Math.random() * 40}px`,
          left: `${Math.random() * 100}%`,
          animationDuration: `${3 + Math.random() * 8}s`,
          animationDelay: `${Math.random() * 5}s`,
        }}
      />
    ))}
  </div>
  
  {/* Your content */}
  <div className={styles.content}>
    {/* Questions, answers, etc. */}
  </div>
</div>
```

### Teal Color Scheme

Set the teal color variables in your root CSS:

```css
:root {
  --primary-color: #008080; /* Teal */
  --primary-light: #00a0a0;
  --primary-dark: #006060;
}
```

## Question Format Compatibility

The new system handles both distractor formats automatically:

```javascript
// Database format (object-based)
{
  "distractors": {
    "L1": "315",
    "L2": "7",
    "L3": "5"
  }
}

// Player format (array-based)
{
  "distractorChoices": [
    { "level": 1, "distractorText": "315" },
    { "level": 2, "distractorText": "7" },
    { "level": 3, "distractorText": "5" }
  ]
}
```

The `SessionMetricsProvider` automatically converts between these formats to ensure compatibility.

## Troubleshooting

### Missing Thread ID Error

If you encounter the "Missing thread ID" error:
1. Ensure you're using the `SessionMetricsProvider` component
2. Verify you're providing a valid `tubeId` prop

### Content Not Loading

If content isn't loading:
1. Check the console for errors from `ensureContentLoaded`
2. Verify the `stitchId` is correct
3. Try manually calling `props.ensureContentLoaded()` before recording the session

### State Sync Errors

If state sync fails:
1. Check that `userInformation.userId` is properly set in the Zustand store
2. Verify the `/api/user-state` endpoint is accepting the new format
3. Try manually calling `props.syncState()` to debug the issue

## Complete Implementation

### Components

The implementation consists of these files:

1. `/lib/store/types.ts`: Type definitions for session metrics and state
2. `/lib/store/sessionActions.ts`: API communication functions
3. `/lib/store/sessionMetricsSlice.ts`: Zustand slice for session metrics
4. `/lib/store/userStateActions.ts`: State persistence functions
5. `/lib/components/SessionMetricsProvider.jsx`: Provider component for session recording
6. `/lib/components/StateManager.jsx`: Component for state persistence

### API Integration

The system integrates with these API endpoints:

1. `/api/record-session`: Records session metrics
2. `/api/user-state`: Saves and loads user state
3. `/api/content/batch`: Fetches stitch content

All API calls are now routed through the Zustand store, ensuring a single source of truth for all data operations.

## Migration Checklist

- [ ] Replace direct API calls with Zustand store methods
- [ ] Wrap player components with `SessionMetricsProvider`
- [ ] Wrap app with `StateManager` for state persistence
- [ ] Update CSS to use the teal color scheme
- [ ] Add the persistent bubbles animation container
- [ ] Update question handling to support both distractor formats

## Testing

Use the `/pages/test-session-metrics.jsx` page to verify:

1. Session metrics recording through Zustand
2. Fix for "Missing thread ID" error
3. Bubble animations for visual consistency
4. Teal color scheme (instead of blue)

This approach ensures all API calls go through Zustand as the single source of truth, providing:
- Consistent data flow
- Improved error handling
- Better state management
- Seamless backwards compatibility