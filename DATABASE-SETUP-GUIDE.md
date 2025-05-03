# Database Setup Guide for Zenjin Maths

This guide explains how to set up the database for the Zenjin Maths application using the provided SQL script.

## Overview

The application requires several database tables to store and track:
- Learning content (tubes, threads, stitches, questions)
- User progress and position in the learning journey
- Session history and results

## Database Issues Fixed

The setup script addresses several issues that were causing the application to not save progress:

1. **Missing Tables**: Creating all required tables with proper structure
2. **Row Level Security (RLS)**: Setting up appropriate policies for data access
3. **Sample Data**: Providing initial content for testing
4. **Helper Functions**: Adding utility functions for data operations
5. **UUID Handling**: Proper handling of UUID comparisons for anonymous and diagnostic users
6. **String/UUID Compatibility**: Ensuring compatibility between text and UUID data types for user IDs
7. **Defensive Coding**: Adding fallback conditions for when anonymous_user_id() function isn't available

## Setup Instructions

### Using the Supabase Web Interface

1. Navigate to your Supabase project dashboard
2. Go to "SQL Editor" in the left menu
3. Copy the entire contents of `setup-database.sql`
4. Paste it into the SQL Editor
5. Click "Run" to execute the script
6. After the main script completes successfully, run the `enable-rls.sql` script to set up permissions

### Two-Step Setup Process

The database setup is split into two scripts for maximum compatibility:

1. **setup-database.sql** - Creates tables, policies, indexes, and sample data
2. **enable-rls.sql** - Sets up permissions and enables RLS security

This two-step approach avoids issues with restricted commands that require special privileges.

### Alternative: Using the Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase db reset --db-url [your-db-url]
```

Then:

```bash
cat setup-database.sql | supabase db execute --db-url [your-db-url]
cat enable-rls.sql | supabase db execute --db-url [your-db-url]
```

## Schema Details

The database contains the following key tables:

1. **threads** - Main content organization (mapped to "topics" in the UI)
2. **stitches** - Individual learning units (mapped to "lessons" in the UI)
3. **questions** - Questions for each stitch
4. **user_stitch_progress** - Tracks user progress through stitches
5. **user_tube_position** - Stores the current tube (subject area) position
6. **user_sessions** - Records of learning sessions
7. **session_results** - Detailed session data with answers
8. **sessions** - Legacy session format for backward compatibility

## Testing the Setup

After running the script, you can verify the setup with:

1. Check that tables exist and have sample data:
   ```sql
   SELECT * FROM threads LIMIT 5;
   SELECT * FROM stitches LIMIT 5;
   ```

2. Test inserting a user session:
   ```sql
   INSERT INTO user_sessions (
     session_id, user_id, thread_id, stitch_id, score, 
     total_questions, points
   ) VALUES (
     'test-session-1', 
     auth.uid(), -- current user
     'thread-A', 
     'stitch-A-01', 
     10, 
     10, 
     50
   );
   ```

3. Test retrieving user progress:
   ```sql
   SELECT * FROM user_stitch_progress WHERE user_id = auth.uid();
   ```

## UUID Handling

The database script implements robust handling of different user ID formats:

1. **Anonymous User IDs**: 
   - A dedicated function `anonymous_user_id()` returns a fixed UUID (`00000000-0000-0000-0000-000000000000`) for anonymous users
   - Policies include fallback logic for handling 'anonymous' as a string when the function isn't yet available

2. **Diagnostic User IDs**:
   - Special handling for IDs starting with 'diag-' which are used for testing
   - Policies use `user_id::text LIKE 'diag-%'` to match these without requiring UUID conversion

3. **Authenticated User IDs**:
   - Standard UUID comparison with `auth.uid()` for authenticated users

4. **Multiple Fallbacks**:
   - Data transfer function handles various ID formats safely
   - Multiple safety checks to prevent type conversion errors

## Troubleshooting

### Common Issues

1. **Permissions Errors**: Make sure the RLS policies are in place and working correctly
   ```sql
   SELECT table_name, policy_name FROM pg_policies;
   ```

2. **Missing Tables**: Verify all tables were created
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

3. **Data Access Issues**: If users can't access their data, check:
   ```sql
   -- Check if authenticated user can see their data
   SELECT auth.uid() as current_user;
   SELECT * FROM user_sessions WHERE user_id = auth.uid();
   ```

4. **UUID/Text Comparison Issues**: If you see errors about UUID/text comparisons:
   ```sql
   -- Check if the anonymous_user_id function exists
   SELECT * FROM pg_proc WHERE proname = 'anonymous_user_id';
   
   -- Test the function if it exists
   SELECT anonymous_user_id();
   
   -- Test a policy with both formats
   SELECT * FROM user_stitch_progress WHERE user_id = '00000000-0000-0000-0000-000000000000'::UUID;
   SELECT * FROM user_stitch_progress WHERE user_id::text = 'anonymous';
   ```

### Resetting Data

To clear user data but keep content:
```sql
TRUNCATE user_stitch_progress, user_tube_position, user_sessions, session_results, sessions;
```

## Support

For additional help with database setup, please refer to:
- [Supabase Documentation](https://supabase.com/docs)
- Project maintainers at [contact@zenjin.com](mailto:contact@zenjin.com)