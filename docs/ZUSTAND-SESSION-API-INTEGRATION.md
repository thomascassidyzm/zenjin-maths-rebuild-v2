# Zustand Session API Integration

This document outlines the integration of session metrics recording with the Zustand store, using the tube-stitch model instead of the legacy thread-based approach.

## Overview

The implementation solves the "Missing thread ID" error by:

1. Using Zustand as the single source of truth for all API interactions
2. Automatically deriving `threadId` from `tubeId` when needed for API compatibility
3. Providing a simple component-based API for recording session metrics
4. Ensuring compatibility between tube-stitch model and the legacy thread-based API

## Key Components

### 1. Types and Interfaces (`/lib/store/types.ts`)

- `SessionQuestionResult`: Defines the structure for individual question results
- `SessionMetricsData`: Defines the data structure for recording session metrics
- `SessionMetricsState`: Defines the state structure for the Zustand store slice

### 2. API Actions (`/lib/store/sessionActions.ts`)

- `recordSessionMetrics`: Sends session data to the API, adding a derived `threadId` for backward compatibility
- `formatQuestionResults`: Ensures consistent format for question results
- `formatDistractors`: Helps convert between object and array distractor formats
- `createEmergencySessionMetrics`: Provides fallback metrics for offline scenarios

### 3. Zustand Slice (`/lib/store/sessionMetricsSlice.ts`)

- Creates a Zustand store slice for session metrics functionality
- Handles API interactions and state updates
- Ensures all session data flows through Zustand
- Updates learning progress when sessions are recorded

### 4. Component Integration (`/lib/components/SessionMetricsProvider.jsx`)

- Provider component that simplifies integration with player components
- Handles content prefetching to ensure data is available for recording
- Normalizes data formats between different component implementations
- Provides a clean, simplified API for player components

### 5. API Endpoint (`/pages/api/record-session.ts`)

- Modified to support both thread-based and tube-based models
- Adds tube-stitch support by deriving `threadId` from `tubeId` when needed
- Ensures backward compatibility with existing code
- Includes robust error handling and data validation

## Usage Example

In a player component:

```jsx
// Import the provider
import SessionMetricsProvider from '../lib/components/SessionMetricsProvider';
import { useZenjinStore } from '../lib/store';

// Wrap your player component with the provider
const PlayerPage = () => {
  const { userInformation } = useZenjinStore();

  return (
    <SessionMetricsProvider 
      tubeId={1}
      stitchId="stitch-T1-001-01"
      onSessionRecorded={(result) => {
        console.log('Session recorded:', result);
      }}
    >
      <YourPlayerComponent />
    </SessionMetricsProvider>
  );
};
```

Your player component will receive these props:

```jsx
const YourPlayerComponent = (props) => {
  // When the session is complete, call recordSession with the results
  const handleCompleteSession = async () => {
    const sessionResults = {
      results: [
        { id: "question1", correct: true, timeToAnswer: 1500, firstTimeCorrect: true },
        // ...more question results
      ],
      sessionDuration: 60 // in seconds
    };
    
    try {
      const response = await props.recordSession(sessionResults);
      console.log('Session recorded successfully:', response);
    } catch (error) {
      console.error('Failed to record session:', error);
    }
  };
  
  // Rest of your component...
};
```

## Visual Features

The implementation includes:

1. Teal color scheme (instead of blue)
2. Bubble animations for visual engagement
3. Smooth transitions and effects
4. Responsive design for all screen sizes

## Testing

Use the test page at `/test-session-metrics` to verify:
- Session metrics recording through the Zustand store
- Fix for "Missing thread ID" error
- Visual elements like bubble animations and teal color scheme

## Implementation Notes

1. All API calls now go through Zustand as the single source of truth
2. The tube-stitch model is fully supported alongside the legacy thread model
3. The solution maintains backward compatibility with existing API endpoints
4. Visual styles use CSS modules with teal color scheme
5. State persistence is handled through the Zustand store
EOF < /dev/null