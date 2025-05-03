# User Initialization Fix

This document explains how to fix issues with new users not seeing content from the database in the Zenjin Maths application.

## The Problem

When new users access the app for the first time, the app is generating sample content instead of using the content from the database. This happens because:

1. **Missing Progress Records**: New users don't have entries in the `user_stitch_progress` table, which associates users with stitches and tracks their progress.

2. **Missing Tube Position**: New users don't have entries in the `user_tube_position` table, which tracks which thread they should start with.

3. **Table Initialization**: In some cases, the necessary database tables might not be created correctly.

4. **Invalid Stitch References**: Some tube configurations refer to stitches that don't exist in the database (like stitch "8" and "9").

## The Solution

We've created a comprehensive solution with three parts:

### Part 1: Fix User Initialization Script

A script that:
1. Verifies that all necessary database tables exist and creates them if they don't.
2. Creates proper user progress records for a test user.
3. Sets up tube position records to ensure content is loaded from the database.

### Part 2: Reset Tube Configuration Script

A script that:
1. Removes references to non-existent stitches from user progress.
2. Resets tube configurations to only use valid stitches.
3. Fixes ordering of stitches within tubes.

### Part 3: Automatic User Initialization (NEW)

Modified `AuthContext.tsx` to:
1. Automatically initialize user data when a new user signs up.
2. Make an API call to the user-stitches endpoint to set up proper tube configurations.
3. Ensure new users immediately have valid stitch references.

This ensures that the app correctly loads content from the database instead of generating sample content.

## How to Apply the Manual Fixes

### Fix User Initialization

1. Run the provided script:
   ```
   ./scripts/fix-user-initialization.sh
   ```

2. The script will prompt you for your Supabase URL and service role key if they're not already set as environment variables.

### Reset Tube Configuration

1. Run the provided script:
   ```
   ./scripts/reset-tube-configuration.sh [optional-user-id]
   ```

2. This will reset tube configurations to only use valid stitch references.

### Automatic Fix

The automatic fix happens whenever a new user signs up:
1. User authentication triggers the `onAuthStateChange` event in AuthContext.tsx
2. The handler detects a sign-in event and calls the user-stitches API
3. The API initializes proper tube configurations for the new user
4. New users should now automatically see database content instead of sample content

## Troubleshooting

If you still see sample content being generated after applying the fix:

1. **Check Application Logs**: Look for messages about "generating sample content" or "no valid questions found".

2. **Verify Content Exists**: Ensure that threads, stitches, and questions exist in the database.

3. **Browser Console**: Check for any errors during user sign-up by examining browser console logs.

4. **Database User Permissions**: Make sure the application has proper permissions to access the database tables.

5. **Authentication Flow**: Verify that user authentication is working and user IDs are being passed correctly.

## Technical Details

This fix modifies:

1. **Schema Setup**: Ensures the database has the correct tables and fields.

2. **User Initialization**: Proper initialization of progress and position records for new users.

3. **Content Loading**: Tests that content can be loaded from the database instead of being generated.

4. **Authentication Flow**: Adds automatic initialization during user sign-up.

By correctly initializing user data, we ensure that all new users start with the same default content:

- **Tube-1**: Will start with `stitch-A-01` as the active stitch (order_number = 0)
- **Tube-2**: Will start with `stitch-B-01` as the active stitch (order_number = 0)
- **Tube-3**: Will start with `stitch-C-01` as the active stitch (order_number = 0)

This provides a consistent starting experience for all users.