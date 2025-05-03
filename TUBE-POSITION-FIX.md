# Tube Position Implementation Fix

This document explains the fixes implemented to handle tube position data without relying on the non-existent `user_tube_position` table.

## Problem

Several API endpoints were attempting to use a table called `user_tube_position` which doesn't exist in the database schema. This was causing 500 errors whenever the app tried to:

1. Save the current tube position
2. Retrieve the user's last tube position
3. Reset user progress (which includes tube position)

## Solution

We've implemented a comprehensive solution with fallbacks to ensure tube positions are properly saved and retrieved using existing tables:

### 1. Using Existing Tables

Instead of a separate `user_tube_position` table, we now store tube position information using the existing `user_stitch_progress` table in two ways:

a) **Active Stitch with Current Tube Flag**:
   - Each tube has one active stitch (order_number = 0)
   - We set `is_current_tube = true` on the active stitch in the focused tube
   - All other active stitches have `is_current_tube = false`

b) **For Schema Compatibility**:
   - We maintain backward compatibility with special `tube:{tubeNumber}` stitch_id entries
   - This allows old code paths to continue working even though the table structure has changed

### 2. Retrieving Tube Position

We've implemented a multi-level approach to finding the current tube position:

1. First try to find active stitches with `is_current_tube = true`
2. If that fails, use the most recently updated active stitch
3. Check for special stitch_id entries (`tube:{tubeNumber}`)
4. Try the legacy `user_tube_position` table as a last resort
5. Default to Tube 1 if all other approaches fail

### 3. Validating Thread/Tube Consistency

We now verify that the requested thread actually belongs to the specified tube by checking the `tube_number` field on the thread record. This prevents inconsistent state.

### 4. Schema Flexibility

The solution handles various schema variations that might exist in different environments:

- Gracefully handles missing `is_current_tube` column
- Works with different versions of the schema
- Provides progressive fallbacks at each step

## Files Modified

1. `pages/api/save-tube-position.ts` - Completely refactored to use existing tables
2. `pages/api/user-stitches.ts` - Updated tube position retrieval logic
3. `pages/api/reset-user-progress.ts` - Fixed reset logic to work with new approach

## Testing

You can test the implementation by:

1. Saving a tube position via the API:
   ```
   POST /api/save-tube-position
   {
     "userId": "your-user-id", 
     "tubeNumber": 1,
     "threadId": "thread-T1-001"
   }
   ```

2. Retrieving user stitches, which will include the tube position:
   ```
   GET /api/user-stitches?userId=your-user-id
   ```

3. Resetting user progress:
   ```
   POST /api/reset-user-progress
   {
     "userId": "your-user-id"
   }
   ```

## Documentation Updates

The DATABASE-SCHEMA.md file should be updated to note that tube positions are managed through active stitches in the user_stitch_progress table rather than a separate dedicated table.

The API-DOCUMENTATION.md file should be updated to describe the new approach for saving tube positions using active stitches.