# State Persistence Technical Documentation

## Architecture Overview

The Zenjin Maths application implements a Triple-Helix learning system with three "tubes" containing educational stitches that rotate between tubes as learners complete them. The state persistence system is responsible for maintaining the positions of stitches between sessions.

### Core Components

1. **StateMachine** (`lib/triple-helix/StateMachine.js`)
   - Core logic for the Triple-Helix learning system
   - Handles stitch advancement and position calculations
   - Implements the spaced repetition algorithm

2. **StateMachineTubeCyclerAdapter** (`lib/adapters/StateMachineTubeCyclerAdapter.js`)
   - Adapter that connects the StateMachine to UI components  
   - Prevents double rotation with locking mechanisms
   - Provides interface methods for the player component

3. **useTripleHelixPlayer** Hook (`lib/playerUtils.ts`)
   - Main hook used by the player component
   - Manages state loading and persistence
   - Handles session completion and tube transitions

4. **API Endpoints**
   - `/api/user-stitches`: Loads stitch data and user progress
   - `/api/update-stitch-positions`: Saves stitch positions
   - `/api/user-state`: Saves complete state
   - `/api/save-tube-position`: Saves current tube position

## State Persistence Flow

### Loading State (Read Path)

1. When `useTripleHelixPlayer` initializes, it calls `/api/user-stitches` to load:
   - Thread data
   - Stitch content and questions
   - User progress (stitch positions from `user_stitch_progress` table)
   - Tube position (from multiple sources with fallback mechanisms)

2. The API endpoint attempts to load tube position data from multiple sources in this order:
   - `user_state` table (highest priority)
   - Stitches with `is_current_tube = true`
   - Most recently updated active stitch 
   - Special format in `user_stitch_progress`
   - Legacy `user_tube_position` table

3. Stitch position data is loaded from the `user_stitch_progress` table, which contains:
   - `user_id`: The user identifier
   - `thread_id`: The thread identifier
   - `stitch_id`: The stitch identifier
   - `order_number`: The position in the tube (0 = active)
   - `skip_number`: The spacing factor for the spaced repetition algorithm
   - `distractor_level`: Difficulty level of distractors

4. For anonymous users, state is loaded from localStorage, with pre-embedded data as fallback.

### Saving State (Write Path)

1. State persistence happens primarily when a user explicitly ends a session via the "Finish" button.

2. The `handleSessionComplete` function with `isEndSession = true` triggers persistence:
   ```typescript
   handleSessionComplete(results, true);
   ```

3. The `persistStateToServer` function saves state in this sequence:
   - First saves complete state to `user_state` table (highest priority)
   - Then persists tube position via `/api/save-tube-position`
   - Finally saves stitch positions via `/api/update-stitch-positions`

4. The `update-stitch-positions` endpoint processes stitches in batches of 10 to prevent database overload:
   ```typescript
   const { data, error } = await supabaseAdmin
     .from('user_stitch_progress')
     .upsert({
       user_id: userId,
       thread_id: threadId,
       stitch_id: stitchId,
       order_number: orderNumber,
       skip_number: skipNumber || 1, 
       distractor_level: distractorLevel || 'L1',
       updated_at: new Date().toISOString()
     }, { onConflict: 'user_id,thread_id,stitch_id' });
   ```

5. For anonymous users, state is saved to localStorage instead of the server.

## Spaced Repetition Algorithm

When a user completes a stitch with a perfect score:

1. The stitch is moved from position 0 to position `skipNumber` (e.g., 3)
2. All stitches between positions 2 and `skipNumber` shift down one position
3. The stitch at position 1 becomes the new active stitch (position 0)
4. The `skipNumber` value increases on a ratchet: 1 → 3 → 5 → 10 → 25 → 100

This creates a spaced repetition effect where stitches with perfect scores are seen less frequently.

## Known Issues and Solutions

### Position Conflicts

**Issue**: Multiple stitches can sometimes have the same position value within a tube, causing progression issues.

**Solution**: Added position conflict detection and resolution in multiple places:
- During state loading in `useTripleHelixPlayer`
- During stitch advancement in `StateMachine.advanceStitchInTube`
- Added verification step to ensure unique positions 

### Missing Tube Data

**Issue**: Sometimes tube data is missing during transitions, causing errors like "Error: No data available for tube X".

**Solutions**:
1. Added defensive checks before tube transitions
2. Improved error recovery mechanism in `useTripleHelixPlayer`
3. Added `getStitchesForTube` method to `StateMachineTubeCyclerAdapter` to prevent null reference errors

### Question Count Discrepancy

**Issue**: Sometimes only 19 out of 20 questions are reported as completed.

**Solution**: Fixed the question counting logic to use the actual session question count rather than inferring it from results.

## Future Improvements

1. **Simplify Architecture**: The current system has many layers and complex interactions. A more straightforward architecture would be easier to maintain.

2. **Unified Data Loading**: Consolidate the multiple ways data is loaded (pre-embedded, localStorage, APIs) into a more consistent approach.

3. **Improved Debugging**: Add more comprehensive logging and diagnostic tools to identify state persistence issues more quickly.

4. **Proactive Validation**: Further strengthen the validation of stitch positions to prevent conflicts before they occur.

5. **Root Cause Analysis**: Investigate why tube data is sometimes missing during transitions instead of just adding recovery mechanisms.

## Current Stability Status

The state persistence system is now functioning reliably, with robust fallback mechanisms in place. Users can:
- Log out and log back in with their stitch positions maintained
- Complete stitches with proper progression through the spaced repetition algorithm
- Navigate between tubes without encountering errors

While the system has redundant recovery paths that add complexity, it ensures a smooth learning experience even in edge cases.