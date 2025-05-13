# Zenjin Maths App Data Flow Guide

This document outlines the complete data flow of the Zenjin Maths application, from initial load to session completion, for both anonymous and authenticated users.

## App Lifecycle Overview

```
┌───────────────────┐
│                   │
│    Initial Load   │
│                   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│                   │
│   Authentication  │
│                   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│                   │
│   Content Loading │
│                   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│                   │
│  Learning Session │
│                   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│                   │
│ Session Recording │
│                   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│                   │
│  State Persistence│
│                   │
└───────────────────┘
```

## 1. Initial Load

### Data Flow

```
Browser Load → _app.js → Zustand Initialization → Auth Check → Initial UI Render
```

### Anonymous Users

```
1. App loads in browser
2. Zustand store initializes with default values
3. Check localStorage for existing anonymous state
   - If found, load into Zustand store
   - If not found, create new anonymous state
4. Generate anonymous ID and store in Zustand
5. Initialize empty content collection
6. Set isAnonymous = true in userInformation
7. NO API calls are made at this point
```

### Authenticated Users

```
1. App loads in browser
2. Zustand store initializes with default values
3. Check for session cookie/token
4. If valid session found:
   a. Extract user ID and auth info
   b. Store in Zustand userInformation
   c. API call to /api/user-state to load server state
   d. Update Zustand store with server state
5. Initialize empty content collection
6. Set isAnonymous = false in userInformation
```

### State at This Point

```json
{
  "userInformation": {
    "userId": "user-123" or "anon-789",
    "isAnonymous": false or true,
    "createdAt": "timestamp",
    "lastActive": "timestamp"
  },
  "tubeState": {
    "activeTube": 1,
    "tubes": {} // Empty or loaded from storage
  },
  "contentCollection": {
    "stitches": {} // Empty initially
  },
  "sessionMetrics": {
    "isRecording": false,
    "lastSession": null,
    "error": null
  }
}
```

## 2. Dashboard Load

### Data Flow

```
Dashboard Component Mount → Load User Data → Load Tube Config → Render Dashboard
```

### Anonymous Users

```
1. Dashboard component mounts
2. StateManager sets up auto-sync (localStorage only)
3. Load tube configuration from bundled data
4. Initialize default tube state if none exists:
   a. activeTube = 1
   b. Create default positions for tube 1
   c. Set currentStitchId
5. Update Zustand store with tube state
6. NO API calls, all data from localStorage/bundled
```

### Authenticated Users

```
1. Dashboard component mounts
2. StateManager sets up auto-sync (includes server sync)
3. API call to /api/user-progress to get progress data
4. API call to /api/tube-configuration to get tube setup
5. API call to /api/user-state to get latest state
6. Initialize tube state from server data:
   a. activeTube from server
   b. positions for each tube
   c. currentStitchId for each tube
7. Update Zustand store with tube state
8. State is automatically synced back to server when changed
```

### State at This Point

```json
{
  "userInformation": {
    "userId": "user-123" or "anon-789",
    "isAnonymous": false or true,
    "createdAt": "timestamp",
    "lastActive": "timestamp" 
  },
  "tubeState": {
    "activeTube": 1,
    "tubes": {
      "1": {
        "currentStitchId": "stitch-T1-001-01",
        "threadId": "thread-T1-001",
        "positions": {
          "0": { "stitchId": "stitch-T1-001-01", "skipNumber": 3, "distractorLevel": 1 },
          "1": { "stitchId": "stitch-T1-001-02", "skipNumber": 3, "distractorLevel": 1 }
        }
      },
      "2": { /* tube 2 data */ },
      "3": { /* tube 3 data */ }
    }
  },
  "learningProgress": {
    "totalTimeSpentLearning": 0 or value,
    "evoPoints": 0 or value,
    "completedStitchesCount": 0 or value,
    "perfectScoreStitchesCount": 0 or value
  }
}
```

## 3. Player Load & Content Preparation

### Data Flow

```
Player Component Mount → SessionMetricsProvider → Content Loading → Player Initialization
```

### Anonymous Users

```
1. MinimalPlayer component mounts with the active tube and stitch
2. SessionMetricsProvider wraps player
3. ensureContentLoaded runs automatically:
   a. Check Zustand for cached stitch content
   b. If not found, load content from bundled data
   c. Process distractors/questions for format compatibility
   d. Add to Zustand contentCollection
4. Initialize player with current stitch content
5. NO API calls, all data from localStorage/bundled content
```

### Authenticated Users

```
1. MinimalPlayer component mounts with the active tube and stitch
2. SessionMetricsProvider wraps player
3. ensureContentLoaded runs automatically:
   a. Check Zustand for cached stitch content
   b. If not found, API call to /api/content/batch to load stitch
   c. Process distractors/questions for format compatibility
   d. Add to Zustand contentCollection
4. Initialize player with current stitch content
```

### State at This Point

```json
{
  "contentCollection": {
    "stitches": {
      "stitch-T1-001-01": {
        "id": "stitch-T1-001-01",
        "title": "Stitch Title",
        "content": "Stitch description...",
        "questions": [
          {
            "id": "stitch-T1-001-01-q1",
            "text": "What is 2+2?",
            "correctAnswer": "4",
            "distractors": {
              "L1": "3", 
              "L2": "5",
              "L3": "22"
            },
            "distractorChoices": [
              { "level": 1, "distractorText": "3" },
              { "level": 2, "distractorText": "5" },
              { "level": 3, "distractorText": "22" }
            ]
          },
          // More questions...
        ]
      }
    }
  },
  "sessionData": {
    "sessionId": "session-timestamp-random",
    "startTime": "timestamp",
    "firstTimeCorrectAnswersInSessionCount": 0,
    "stitchesPlayedInSession": []
  }
}
```

## 4. Learning Session

### Data Flow

```
User Interaction → Question Processing → Results Collection → Next Question
```

### All Users (Anonymous & Authenticated)

```
1. Player displays current question from stitch
2. User answers the question:
   a. Answer is processed locally
   b. Feedback is shown (correct/incorrect)
   c. Result is stored in local sessionResults array
3. Next question is loaded (from already cached stitch)
4. Process repeats until all questions are answered
5. NO API calls during question answering phase
```

### State Changes During Session

```json
// After each answer, the session results array grows:
{
  "localSessionResults": [
    {
      "id": "stitch-T1-001-01-q1",
      "correct": true,
      "timeToAnswer": 1500,
      "firstTimeCorrect": true
    },
    {
      "id": "stitch-T1-001-01-q2",
      "correct": false,
      "timeToAnswer": 2000,
      "firstTimeCorrect": false
    },
    // More results as user progresses...
  ]
}
```

## 5. Session Completion & Recording

### Data Flow

```
Last Question Answered → Session Completion → recordSession → API Call → Results Display
```

### Anonymous Users

```
1. User answers final question or clicks "Finish"
2. SessionMetricsProvider.recordSession is called:
   a. Prepares metrics data with tube & stitch IDs
   b. Calls Zustand store recordSession action
   c. Zustand derives threadId from tubeId
   d. API call to /api/record-session with metrics
   e. Session summary data returned
3. Session results stored in localStorage
4. Session summary displayed to user
5. ONE API call to record session metrics
```

### Authenticated Users

```
1. User answers final question or clicks "Finish"
2. SessionMetricsProvider.recordSession is called:
   a. Prepares metrics data with tube & stitch IDs
   b. Calls Zustand store recordSession action
   c. Zustand derives threadId from tubeId
   d. API call to /api/record-session with metrics
   e. Session summary data returned
3. Session results stored in Zustand
4. Session summary displayed to user
5. ONE API call to record session metrics
```

### Session Metrics Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│ Player Component│────▶│SessionMetrics   │────▶│ Zustand Store   │
│                 │     │Provider         │     │ recordSession   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
┌─────────────────┐     ┌─────────────────┐     ┌────────▼────────┐
│                 │     │                 │     │                 │
│ Session Summary │◀────│ API Response    │◀────│ /api/record-    │
│ Display         │     │ Processing      │     │ session API     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Session Metrics Data Structure

```json
// Data sent to API
{
  "tubeId": 1,
  "stitchId": "stitch-T1-001-01",
  "threadId": "thread-T1-001", // Derived from tubeId
  "questionResults": [
    {
      "questionId": "stitch-T1-001-01-q1",
      "correct": true,
      "timeToAnswer": 1500,
      "firstTimeCorrect": true
    },
    // More question results...
  ],
  "sessionDuration": 180 // in seconds
}

// Data returned from API
{
  "success": true,
  "sessionId": "session-1747167177186",
  "basePoints": 21,
  "multiplier": 1.1,
  "multiplierType": "Standard",
  "totalPoints": 23,
  "correctAnswers": 9,
  "totalQuestions": 10,
  "firstTimeCorrect": 7,
  "storageType": "database" // or "local_cache" for anonymous
}
```

## 6. State Persistence & Tube Advancement

### Data Flow

```
Session Recorded → State Update → Tube Advancement → State Persistence
```

### Anonymous Users

```
1. After session recording, tube state is updated:
   a. Current stitch is moved to new position based on performance
   b. Next stitch becomes the current stitch
   c. Stitch statistics are updated
2. StateManager detects state change
3. State is persisted to localStorage
4. NO API calls for state persistence
```

### Authenticated Users

```
1. After session recording, tube state is updated:
   a. Current stitch is moved to new position based on performance
   b. Next stitch becomes the current stitch
   c. Stitch statistics are updated
2. StateManager detects state change
3. API call to /api/user-state to save updated state
4. Also persisted to localStorage as backup
```

### State Persistence Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│ State Change    │────▶│ StateManager    │────▶│ Zustand Store   │
│ Detection       │     │ Component       │     │ syncStateToServer│
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                ┌────────▼────────┐
┌─────────────────┐                            │                 │
│                 │                            │ userStateActions │
│ localStorage    │◀───────────────────────────│ API Module      │
│ Backup          │                            │                 │
└─────────────────┘                            └────────┬────────┘
                                                         │
                                                ┌────────▼────────┐
                                                │                 │
                                                │ /api/user-state │
                                                │ API Endpoint    │
                                                └─────────────────┘
```

### Final Updated State

```json
{
  "tubeState": {
    "activeTube": 1,
    "tubes": {
      "1": {
        "currentStitchId": "stitch-T1-001-02", // Advanced to next stitch
        "threadId": "thread-T1-001",
        "positions": {
          "0": { "stitchId": "stitch-T1-001-02", "skipNumber": 3, "distractorLevel": 1 },
          "1": { "stitchId": "stitch-T1-001-03", "skipNumber": 3, "distractorLevel": 1 },
          "3": { "stitchId": "stitch-T1-001-01", "skipNumber": 5, "distractorLevel": 1 } // Moved to position 3 based on performance
        }
      }
    }
  },
  "learningProgress": {
    "totalTimeSpentLearning": 3120, // Increased by session duration
    "evoPoints": 123, // Increased by points earned
    "completedStitchesCount": 7, // Increased if this was first completion
    "perfectScoreStitchesCount": 4 // Increased if this was a perfect score
  }
}
```

## API Call Summary

### Anonymous Users

1. **Initial Load**: No API calls
2. **Dashboard Load**: No API calls
3. **Player Load**: No API calls
4. **Learning Session**: No API calls
5. **Session Completion**: ONE API call to `/api/record-session`
6. **State Persistence**: No API calls

### Authenticated Users

1. **Initial Load**: ONE API call to `/api/user-state`
2. **Dashboard Load**: 
   - ONE API call to `/api/user-progress`
   - ONE API call to `/api/tube-configuration`
   - ONE API call to `/api/user-state`
3. **Player Load**: ONE API call to `/api/content/batch`
4. **Learning Session**: No API calls
5. **Session Completion**: ONE API call to `/api/record-session`
6. **State Persistence**: ONE API call to `/api/user-state`

## Data Storage Locations

| Data Type | Anonymous Users | Authenticated Users |
|-----------|-----------------|---------------------|
| User ID | localStorage | Server + localStorage |
| Tube State | localStorage | Server + localStorage |
| Stitch Content | In-memory cache | In-memory cache |
| Learning Progress | localStorage | Server + localStorage |
| Session Results | localStorage | Server + localStorage |

## Error Handling

### Content Loading Failures

```
1. Attempt to load content from server
2. If server error, check localStorage/bundled content
3. If no content available, generate emergency content
4. Continue with available content
```

### Session Recording Failures

```
1. Attempt to record session via API
2. If API fails, store results locally
3. Continue with local results
4. Retry API call on next session if authenticated
```

### State Persistence Failures

```
1. Always persist state to localStorage first
2. Then attempt server persistence if authenticated
3. If server persistence fails, log error
4. Continue with local state
5. Next load will attempt to resolve conflicts
```

## Testing This Flow

Use the test pages to verify different parts of the flow:

1. **Initial State**: `/test-zustand-store.tsx`
2. **Content Loading**: `/test-zustand-stitch.tsx`
3. **Session Metrics**: `/test-session-metrics.jsx`
4. **State Persistence**: `/server-persistence-test.tsx`
5. **Complete Flow**: `/minimal-player.tsx`