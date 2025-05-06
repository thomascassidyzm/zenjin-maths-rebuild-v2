# Session State Persistence Improvements

This document outlines the changes made to improve session state persistence in the Zenjin Maths application.

## Problem Background

The previous implementation had several issues:

1. **Split API Calls**: Both `/api/record-session` and `/api/end-session` were called separately, creating race conditions and potential data inconsistency.

2. **Redundant Logic**: Session recording logic was duplicated across multiple components.

3. **Inconsistent Error Handling**: API failures weren't properly addressed, potentially causing data loss.

4. **Different Paths for User Types**: Anonymous and authenticated users followed completely different code paths.

5. **Global State Communication**: Using `window.__SESSION_STATS__` for data sharing created potential issues.

## Solution Overview

We've implemented a comprehensive, centralized approach to session state management:

1. **SessionContext**: A React context that manages all session state
2. **Consolidated API**: A single `/api/session/complete` endpoint for all persistence
3. **Comprehensive Error Handling**: Centralized error logging and recovery
4. **Backward Compatibility**: Maintained support for both anonymous and authenticated users

## Implementation Details

### 1. Session Context

The new `SessionContext` in `lib/context/SessionContext.tsx` provides:

- Session state management via React Context API
- Methods for recording question results and managing points
- Session completion and error handling
- Fallback mechanisms for offline or error scenarios

Usage example:

```tsx
const { 
  sessionState,
  recordQuestionResult,
  addPoints,
  endSession 
} = useSession();

// Record a question result
recordQuestionResult({
  id: questionId,
  correct: isCorrect,
  timeToAnswer: answerTime,
  firstTimeCorrect: isFirstAttempt && isCorrect
});

// End a session
const result = await endSession({
  threadId: threadId,
  stitchId: stitchId,
  points: totalPoints
});
```

### 2. Consolidated API Endpoint

The new `/api/session/complete` endpoint in `pages/api/session/complete.ts`:

- Handles all session persistence in a single request
- Implements transaction-like operations for consistency
- Provides detailed error information
- Includes fallbacks for different scenarios

### 3. Error Handling

The new `errorHandler.ts` module provides:

- Standardized error logging and classification
- Error severity levels and namespaces
- Recovery mechanisms for session data
- Local storage of errors for potential sync later

### 4. Integration with Player Component

The `MinimalDistinctionPlayer` component has been refactored to:

- Use the SessionContext for state management
- Maintain backward compatibility with legacy code
- Improve error handling and resilience
- Provide clear separation between UI and data layers

## Backward Compatibility

The improvements maintain backward compatibility by:

1. Supporting both new context-based and legacy API approaches
2. Preserving anonymous user localStorage persistence
3. Maintaining the same UI flow and user experience
4. Supporting smooth transition from old to new code paths

## Integration Guide

### 1. Wrap Your Application

First, wrap your application with the `SessionProviderWrapper`:

```tsx
// In _app.tsx
import SessionProviderWrapper from '../components/SessionProviderWrapper';

function MyApp({ Component, pageProps }) {
  return (
    <SessionProviderWrapper>
      <Component {...pageProps} />
    </SessionProviderWrapper>
  );
}
```

### 2. Use the Session Hook in Components

In your components, use the `useSession` hook:

```tsx
import { useSession } from '../lib/context/SessionContext';

function MyComponent() {
  const { 
    sessionState, 
    startSession,
    recordQuestionResult,
    endSession 
  } = useSession();
  
  // Your component logic
}
```

### 3. API Migration

For existing API calls:

1. Replace `/api/record-session` and `/api/end-session` with `/api/session/complete`
2. Use the consolidated request format with all session data
3. Handle responses consistently, checking the `success` flag

## Testing

Test all scenarios thoroughly:

1. Anonymous and authenticated users
2. Online and offline usage
3. Session interruptions and resumption
4. Error scenarios and recovery

## Future Improvements

Future work could include:

1. Enhanced session recovery mechanisms
2. Better offline support with service workers
3. More detailed analytics integration
4. Improved user session visualization in dashboards
5. Full transition away from legacy API endpoints