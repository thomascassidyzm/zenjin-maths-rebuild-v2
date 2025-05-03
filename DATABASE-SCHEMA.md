# Zenjin Maths Database Schema & Data Flows

This document describes the verified database schema and data flows for the Zenjin Maths application, based on direct examination of the production database.

## Verified Database Tables

Based on our investigation using the `check-tables` API endpoint, these are the confirmed tables in the database:

### 1. `threads`
- **Purpose**: Stores main content threads (learning paths)
- **Status**: Exists with 4 records
- **Sample Schema**:
  ```
  {
    "id": "thread-T1-001",
    "name": "Multiplication (Ascending)",
    "description": "Progressive multiplication practice with ascending difficulty",
    "tube_number": 1,
    "created_at": "2025-04-13T17:39:06.034646+00:00",
    "updated_at": "2025-04-16T23:31:04.764314+00:00"
  }
  ```

### 2. `stitches`
- **Purpose**: Stores individual learning units within threads
- **Status**: Exists with 106 records
- **Sample Schema**:
  ```
  {
    "id": "stitch-T1-001-01",
    "thread_id": "thread-T1-001",
    "title": "Doubling (0, 5) [5-100]",
    "content": "Practice doubling numbers ending in 0 or 5, ranging from 5 to 100",
    "order": 1,
    "created_at": "2025-03-26T14:00:00+00:00",
    "updated_at": "2025-04-16T23:31:04.764314+00:00"
  }
  ```

### 3. `questions`
- **Purpose**: Stores individual questions for each stitch
- **Status**: Exists with 2040 records
- **Sample Schema**:
  ```
  {
    "id": "stitch-A-01-q20",
    "stitch_id": "stitch-T1-001-01",
    "text": "Double 100",
    "correct_answer": "200",
    "distractors": {
      "L1": "1000",
      "L2": "190",
      "L3": "198"
    },
    "created_at": "2025-04-16T23:31:04.764314+00:00",
    "updated_at": "2025-04-16T23:31:04.764314+00:00"
  }
  ```

### 4. `user_stitch_progress`
- **Purpose**: Tracks user progress through stitches and current tube focus
- **Status**: Exists but has 0 records
- **Schema** (inferred based on API usage):
  ```
  {
    "user_id": "string",
    "thread_id": "string",
    "stitch_id": "string", 
    "order_number": number,  // 0 = active stitch
    "skip_number": number,
    "distractor_level": "string",
    "is_current_tube": boolean,  // Flag for currently focused tube
    "updated_at": "timestamp"
  }
  ```
  
  **Note**: The `is_current_tube` field may not exist in all environments. The application code includes fallbacks.
  
  **Special Cases**: 
  - Active stitches (order_number = 0) represent the current learning point in each tube
  - The application marks one active stitch as the current tube focus with is_current_tube = true

### 5. `session_results`
- **Purpose**: Records session completion data
- **Status**: Exists with 165 records
- **Sample Schema**:
  ```
  {
    "id": "session-1744851448662-726",
    "user_id": "00000000-0000-0000-0000-000000000000",
    "thread_id": "thread-T1-001",
    "stitch_id": "stitch-A-01",
    "results": [],
    "total_points": 60,
    "accuracy": 100,
    "duration": null,
    "completed_at": "2025-04-17T00:57:28.662+00:00",
    "created_at": "2025-04-17T00:57:28.73788+00:00"
  }
  ```

### 6. `profiles` 
- **Purpose**: Stores user profile information
- **Status**: May exist but not confirmed in required tables list
- **Schema** (inferred based on API usage):
  ```
  {
    "id": "string", // User ID
    "total_points": number,
    "avg_blink_speed": number,
    "evolution_level": number,
    "last_session_date": "timestamp",
    "updated_at": "timestamp",
    "created_at": "timestamp"
  }
  ```

## Tables That DO NOT Exist (but were being referenced)

1. `user_tube_position` - Was being referenced in code but doesn't exist
   - **Fix**: We now store tube focus information in the `user_stitch_progress` table
   - **Implementation**: Using the `is_current_tube` flag on active stitches
2. `sessions` - Was being referenced in code but doesn't exist
   - **Fix**: Session data is stored in `session_results` table
3. `user_sessions` - Was being referenced as a fallback but doesn't exist
   - **Fix**: Not needed as we use `session_results` instead

## Data Flows

### 1. Session Completion Flow

When a user completes a session:

1. Record session data in `session_results` with:
   - Generated ID (format: `session-{timestamp}-{random}`)
   - User ID (from auth or fallback)
   - Thread ID and Stitch ID
   - Question results array
   - Total points and accuracy
   - Completion timestamp

2. Update user progress in `user_stitch_progress` with:
   - User ID
   - Thread ID and Stitch ID
   - Order number, skip number, and distractor level
   - Updated timestamp

3. Update user profile in `profiles` (if it exists) with:
   - Updated total points (accumulated)
   - Updated average blink speed
   - Last session date

### 2. User Progress Retrieval Flow

When loading user progress data:

1. Query `profiles` for overall stats:
   - Total points
   - Average blink speed
   - Evolution level

2. Query `session_results` for recent sessions:
   - Filter by user ID
   - Sort by completed_at (most recent first)
   - Limit to most recent 10

3. Query `user_stitch_progress` for stitch progression:
   - Filter by user ID
   - Get current order_number, skip_number, and distractor_level

## Key Insights & Requirements

1. **Primary State Storage**: The `session_results` table is the primary source of truth for session completion data.

2. **Stitch Progress**: The `user_stitch_progress` table should track progression through stitches, but currently has 0 records - we need to ensure we're correctly saving to this table.

3. **Profiles**: The profiles table may or may not exist, but we should attempt to create and update it to store aggregated user statistics.

4. **Tube Position**: The concept of "tubes" exists in the frontend and internal state management. While there's no dedicated tube position table:
   - Tubes are defined by the `tube_number` field in the `threads` table
   - Each tube has one active stitch (`order_number = 0`) in the `user_stitch_progress` table
   - The currently focused tube is marked with `is_current_tube = true` on its active stitch

5. **ID Generation**: For both `session_results` and possibly other tables, we must generate IDs with the format `{type}-{timestamp}-{random}`.

## Data Integrity Requirements

1. Session data must be saved in `session_results` to persist progress
2. Stitch progression must be saved in `user_stitch_progress` for continuity
3. Aggregate progress metrics should be saved in `profiles` if it exists
4. All updates should include proper error handling with fallbacks

## API Endpoint Documentation

### 1. `/api/record-session`
Records individual session data when a user completes a stitch.
- **Primary Table**: `session_results`
- **Required Fields**: id, user_id, thread_id, stitch_id, results, total_points, accuracy, completed_at

### 2. `/api/end-session`
Processes all data when a user explicitly ends their session.
- **Tables**: `session_results`, `user_stitch_progress`, possibly `profiles`
- **Actions**: Records session, updates stitch progress, updates user profile

### 3. `/api/user-progress`
Retrieves user progress data for display in dashboard.
- **Tables**: `profiles`, `session_results`
- **Returns**: Total points, evolution level, recent sessions

### 4. `/api/update-state`
Updates user state with current progress.
- **Table**: `user_stitch_progress`
- **Actions**: Updates stitch progress details

### 5. `/api/update-stitch-progress`
Directly updates specific stitch progress.
- **Table**: `user_stitch_progress`
- **Actions**: Updates stitch position, skip number, distractor level