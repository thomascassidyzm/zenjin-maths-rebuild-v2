# Record Session Flow

This document specifically outlines the flow for recording session data in the Zenjin Maths application. It details the exact process that should happen when a session is completed and how data should be saved to the database.

## Session Recording Process

When a user completes a learning session (by answering a set of questions for a stitch), the following should happen:

1. **Trigger**: User completes all questions for a stitch or clicks "Continue to Dashboard"/"Finish" button
2. **Initial Processing**: Calculate session metrics (points, accuracy, etc.)
3. **Database Storage**: Save data to appropriate tables
4. **State Updates**: Update user's progress state
5. **Navigation**: Either continue to next stitch or navigate to dashboard

## Data Flow Diagram

```
User completes session
         │
         ▼
Calculate session metrics
         │
         ▼
┌─────────────────────┐
│ Record in database  │
│                     │
│ 1. session_results  │◄───────┐
│ 2. user_stitch_progress     │
│ 3. profiles (if exists)     │
└─────────────────────┘       │
         │                    │
         ▼                    │
Continue or End Session       │
    │         │               │
    │         ▼               │
    │    Navigate to dashboard│
    │         │               │
    │         ▼               │
    │    End Session API ─────┘
    │
    ▼
Select next stitch
```

## Database Operations

### 1. `session_results` Table

**Purpose**: Records detailed data about each completed session.

**Required Fields**:
- `id`: Generated unique ID using format `session-{timestamp}-{random}` (must be provided, not auto-generated)
- `user_id`: User's ID (from auth or fallback)
- `thread_id`: The thread ID for this session
- `stitch_id`: The stitch ID for this session
- `results`: JSON array of question results
- `total_points`: Points earned in this session
- `accuracy`: Percentage of correct answers (0-100)
- `completed_at`: Timestamp of completion

**Example Record**:
```json
{
  "id": "session-1744851448662-726",
  "user_id": "e45b377a-9d72-4b6b-9b9e-ee8efb26b916",
  "thread_id": "thread-T1-001",
  "stitch_id": "stitch-T1-001-01",
  "results": [
    {
      "questionId": "stitch-T1-001-01-q1",
      "correct": true,
      "timeToAnswer": 2500,
      "firstTimeCorrect": true
    },
    // Additional question results...
  ],
  "total_points": 60,
  "accuracy": 100,
  "completed_at": "2025-04-26T14:30:45.662Z"
}
```

### 2. `user_stitch_progress` Table

**Purpose**: Tracks user's progression through stitches.

**Required Fields**:
- `user_id`: User's ID
- `thread_id`: Thread ID
- `stitch_id`: Stitch ID
- `order_number`: Position of stitch in sequence (0 = current, higher = future)
- `skip_number`: Number of positions to skip when completed
- `distractor_level`: Difficulty level of distractors (L1, L2, L3)
- `updated_at`: Last update timestamp

**Example Record**:
```json
{
  "user_id": "e45b377a-9d72-4b6b-9b9e-ee8efb26b916",
  "thread_id": "thread-T1-001",
  "stitch_id": "stitch-T1-001-01",
  "order_number": 0,
  "skip_number": 3,
  "distractor_level": "L1",
  "updated_at": "2025-04-26T14:30:45.662Z"
}
```

### 3. `profiles` Table (if exists)

**Purpose**: Stores user's aggregated statistics and progress.

**Required Fields**:
- `id`: User's ID
- `total_points`: Cumulative points earned
- `avg_blink_speed`: Average answer time (seconds)
- `evolution_level`: Current evolution level (1-15)
- `last_session_date`: Date of most recent session
- `updated_at`: Last update timestamp

**Example Record**:
```json
{
  "id": "e45b377a-9d72-4b6b-9b9e-ee8efb26b916",
  "total_points": 3450,
  "avg_blink_speed": 3.2,
  "evolution_level": 2,
  "last_session_date": "2025-04-26T14:30:45.662Z",
  "updated_at": "2025-04-26T14:30:45.662Z"
}
```

## Implementation Details

### Error Handling Strategy

1. **Attempt Full Insert**: Try to insert complete record with all fields
2. **Fallback to Minimal**: If full insert fails, try with minimal essential fields
3. **Detailed Logging**: Log all failures with detailed error messages
4. **Continue Execution**: Don't fail the entire operation if one part fails

### Session ID Generation

```javascript
const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
```

### Authentication Fallback Strategy

1. Use authenticated user ID from Supabase session if available
2. Fall back to ID from request headers/body
3. Use hardcoded ID for known user if needed
4. Generate random ID as absolute last resort

### Point Calculation

```javascript
// Basic points: 3 points per first-time correct, 1 for others
const basePoints = (firstTimeCorrect * 3) + ((correctAnswers - firstTimeCorrect) * 1);

// Apply multiplier (session-specific bonus)
const totalPoints = Math.round(basePoints * multiplier);
```

## Integration with Frontend

The frontend should:

1. Collect question results during the session
2. Call the `record-session` API endpoint when a stitch is completed
3. Call the `end-session` API endpoint when the user explicitly ends their session
4. Navigate to the dashboard when requested

## API Parameters

### record-session API

```typescript
interface SessionRequest {
  userId?: string;
  threadId: string;
  stitchId: string;
  questionResults: Array<{
    questionId: string;
    correct: boolean;
    timeToAnswer: number;
    firstTimeCorrect: boolean;
  }>;
  sessionDuration: number;
}
```

### end-session API

```typescript
interface EndSessionRequest {
  userId?: string;
  threadId: string;
  stitchId: string;
  questionResults?: Array<{
    questionId: string;
    correct: boolean;
    timeToAnswer: number;
    firstTimeCorrect: boolean;
  }>;
  sessionDuration?: number;
  correctAnswers?: number;
  totalQuestions?: number;
  points?: number;
  tubeUpdates?: Array<{
    tubeNumber: number;
    threadId: string;
  }>;
  stitchUpdates?: Array<{
    threadId: string;
    stitchId: string;
    orderNumber: number;
    skipNumber: number;
    distractorLevel: string;
  }>;
}
```

## Testing & Verification

To verify that session recording is working correctly:

1. Complete a stitch in the application
2. Check the server logs for successful `session_results` insertion
3. Query the `session_results` table to confirm the record exists
4. Verify that `user_stitch_progress` contains the updated progress information
5. Check that `profiles` table (if it exists) has updated aggregate statistics