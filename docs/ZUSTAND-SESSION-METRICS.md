# Zustand Session Metrics Integration

This document outlines the implementation of session metrics recording using the Zustand store with the tube-stitch model.

## Overview

We've redesigned the session metrics recording system to:

1. Use the Zustand store as the central point for all server interactions
2. Support the tube-stitch model that replaces the legacy thread-based approach
3. Maintain backward compatibility with existing API endpoints
4. Ensure visual consistency with the teal color scheme and bubble animations
5. Add resilience for offline and error scenarios

## Core Components

The implementation consists of these key components:

1. **Types**: Defined in `lib/store/types.ts`
2. **Actions**: Implemented in `lib/store/sessionActions.ts`
3. **Store Slice**: Added to the Zustand store in `lib/store/zenjinStore.ts`
4. **React Hook**: Created in `lib/hooks/useSessionMetrics.ts`
5. **API Compatibility**: Updated in `pages/api/record-session.ts`
6. **UI Integration**: Updated in player components

## Implementation Details

### Session Metrics Data Flow

```
                                  ┌───────────────────┐
┌───────────────────┐            │                   │
│                   │            │  Zustand Store    │
│  Player Component │──────────▶│  (sessionMetrics) │
│                   │            │                   │
└───────────────────┘            └──────────┬────────┘
                                           │
                                           ▼
                                  ┌───────────────────┐
                                  │                   │
                                  │  sessionActions   │
                                  │                   │
                                  └──────────┬────────┘
                                           │
                                           ▼
                                  ┌───────────────────┐
                                  │                   │
                                  │  API Endpoint     │
                                  │  (record-session) │
                                  │                   │
                                  └───────────────────┘
```

### Tube-Based Data Model

The new session metrics use tube IDs directly instead of thread IDs:

```typescript
interface SessionMetricsData {
  sessionId?: string;
  tubeId: number;        // Using tube number directly (e.g., 1, 2, 3)
  stitchId: string;
  questionResults: SessionQuestionResult[];
  sessionDuration?: number;
  totalPoints?: number;
  accuracy?: number;
}
```

### Backwards Compatibility

For API compatibility, the system:

1. Derives a thread ID from the tube ID: `thread-T${tubeId}-001`
2. Includes this derived thread ID when making API calls
3. Allows the API endpoint to accept either format

## Using the Session Metrics

### Basic Usage

```typescript
import { useSessionMetrics } from '../lib/hooks/useSessionMetrics';

function MyComponent({ tubeNumber, stitchId }) {
  const { recordSessionMetrics, isRecording } = useSessionMetrics();
  
  const handleSessionComplete = async (results) => {
    await recordSessionMetrics({
      tubeId: tubeNumber,
      stitchId,
      questionResults: results.map(r => ({
        questionId: r.id,
        correct: r.correct,
        timeToAnswer: r.timeToAnswer,
        firstTimeCorrect: r.firstTimeCorrect
      })),
      sessionDuration: 300 // Example: 5 minutes
    });
  };
  
  return (
    <div>
      {/* Component content */}
      {isRecording && <div>Recording session...</div>}
    </div>
  );
}
```

### Error Handling

The system has built-in error handling and fallbacks:

1. API errors are caught and logged
2. Emergency metrics are generated for offline scenarios
3. The Zustand store tracks recording status and errors

## Visual Consistency

To maintain visual consistency:

1. The session metrics system doesn't interfere with CSS variables
2. Global animations (like bubbles) are maintained in persistent components
3. The teal color scheme is preserved through CSS variables

## Testing

Test the implementation by:

1. Completing a session and verifying metrics are recorded
2. Checking the API response format
3. Confirming the session summary displays correctly
4. Testing offline scenarios with network disconnected

## Future Improvements

Potential future enhancements:

1. Add telemetry to track API success/failure rates
2. Implement a retry mechanism for failed API calls
3. Add more detailed analytics for session metrics
4. Enhance the offline experience with IndexedDB for persistence