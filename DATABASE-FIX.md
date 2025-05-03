# Database Fix for Zenjin Maths Application

This document explains the recent database fixes implemented to address issues with progress data not being saved correctly.

## Problem Overview

The application was experiencing the following issues:

1. Progress data was not being saved to the database consistently
2. User sessions and points were not appearing in the dashboard
3. Type errors occurred in SQL operations with message like "operator does not exist: uuid = text"
4. API calls to save progress and sessions were failing with 404, 406, and 500 errors

## Root Causes Identified

After investigation, we identified several root causes:

1. **UUID/Text Type Mismatch**: Inconsistent handling of UUID vs text types in database comparisons
2. **Anonymous User Edge Case**: The 'anonymous' user ID was handled inconsistently
3. **Missing RLS Policies**: Some access policies were missing or incomplete 
4. **Function Availability**: The anonymous_user_id() function was sometimes not available during policy evaluation

## Solution Implemented

The database scripts have been updated with the following fixes:

1. **Consistent UUID Handling**: 
   - Created a dedicated function `anonymous_user_id()` that returns a fixed UUID for anonymous users
   - Added explicit type casting in SQL comparisons (e.g., `auth.uid()::uuid = user_id`)
   - Implemented multiple fallbacks for different user ID formats
   - Ensured all UUID comparisons use consistent types to avoid the "operator does not exist: uuid = text" error

2. **Enhanced Policies**:
   - Updated all Row Level Security (RLS) policies to include fallback conditions
   - Added support for both UUID and string representations of user IDs
   - Special handling for 'diag-' prefixed IDs used for testing

3. **Robust Data Transfer**:
   - Improved the transfer_anonymous_data function to handle edge cases
   - Added specific logic for diagnostic IDs
   - Better error handling and type conversion

4. **Simplified Permission Setup**:
   - Removed superuser commands from the enable-rls.sql script
   - Added compatibility with Supabase's security model

## How to Apply the Fix

1. **Update Database Schema and Policies**:
   - Log in to your Supabase project dashboard
   - Go to "SQL Editor"
   - Run the updated `setup-database.sql` script
   - After it completes, run the `enable-rls.sql` script
   
2. **If You're Still Seeing UUID Comparison Errors**:
   - Run the `ensure-anonymous-user.sql` script
   - This script will:
     - Ensure the anonymous_user_id() function exists
     - Convert any 'anonymous' string values to proper UUIDs in all tables

3. **Verify the Fix**:
   - Check that all tables have proper RLS policies:
     ```sql
     SELECT table_name, policy_name FROM pg_policies;
     ```
   - Test anonymous user access:
     ```sql
     SELECT * FROM user_stitch_progress 
     WHERE user_id = '00000000-0000-0000-0000-000000000000'::UUID;
     ```
   - Test the application by completing a learning session and verifying the data appears in the dashboard

4. **For Existing Data**:
   - If you have existing data with 'anonymous' as a string, you can migrate it:
     ```sql
     -- Convert 'anonymous' string to proper UUID
     UPDATE user_stitch_progress 
     SET user_id = '00000000-0000-0000-0000-000000000000'::UUID
     WHERE user_id::text = 'anonymous';
     
     -- Same for other tables
     UPDATE user_tube_position 
     SET user_id = '00000000-0000-0000-0000-000000000000'::UUID
     WHERE user_id::text = 'anonymous';
     
     UPDATE user_sessions 
     SET user_id = '00000000-0000-0000-0000-000000000000'::UUID
     WHERE user_id::text = 'anonymous';
     ```

## Technical Details

The RLS policies now include an additional condition to handle the case when the anonymous_user_id() function isn't available:

```sql
CREATE POLICY example_policy ON user_stitch_progress
    FOR SELECT USING (
        auth.uid() = user_id OR 
        user_id = anonymous_user_id() OR 
        user_id::text LIKE 'diag-%' OR
        (user_id::text = 'anonymous' AND anonymous_user_id() IS NULL)
    );
```

This ensures that:
1. Authenticated users can access their own data
2. The anonymous user ID is recognized in UUID form
3. Diagnostic IDs (diag-*) work for testing
4. The string 'anonymous' works as a fallback when the function isn't available

## Further Information

For more detailed information on the database architecture and setup, please refer to:
- `DATABASE-SETUP-GUIDE.md` - Comprehensive database setup guide
- `setup-database.sql` - Main database schema and policy script
- `enable-rls.sql` - Security permissions script