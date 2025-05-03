-- Script to verify that the database is set up correctly
-- Run this after applying setup-database.sql and enable-rls.sql

-- 1. Check that all tables exist
SELECT table_name, 'Table exists' as status 
FROM information_schema.tables 
WHERE table_schema = 'public' AND 
      table_name IN ('threads', 'stitches', 'questions', 'user_stitch_progress',
                    'user_tube_position', 'user_sessions', 'session_results', 'sessions');

-- 2. Check that the anonymous_user_id function exists
SELECT proname, 'Function exists' as status
FROM pg_proc 
WHERE proname = 'anonymous_user_id';

-- 3. Test the function
SELECT anonymous_user_id() as anonymous_uuid;

-- 4. Verify Row Level Security policies
SELECT table_name, policy_name, cmd, roles, qual 
FROM pg_policies
WHERE tablename IN ('user_stitch_progress', 'user_tube_position', 'user_sessions', 'session_results', 'sessions');

-- 5. Test anonymous user data access
-- Try selecting data for the anonymous user
SELECT COUNT(*) as anonymous_progress_records
FROM user_stitch_progress 
WHERE user_id = anonymous_user_id();

-- Try with text comparison as fallback
SELECT COUNT(*) as anonymous_string_records 
FROM user_stitch_progress 
WHERE user_id::text = 'anonymous';

-- 6. Check sample data
SELECT 
  (SELECT COUNT(*) FROM threads) as thread_count,
  (SELECT COUNT(*) FROM stitches) as stitch_count,
  (SELECT COUNT(*) FROM questions) as question_count;

-- 7. Verify indexes for performance
SELECT 
  indexname,
  tablename,
  indexdef
FROM 
  pg_indexes
WHERE 
  tablename IN ('threads', 'stitches', 'questions', 'user_stitch_progress',
               'user_tube_position', 'user_sessions', 'session_results', 'sessions');

-- 8. Test diagnostic user pattern
SELECT 'Manual test required' as diagnostic_test,
       'Create a record with user_id like diag-* and verify access' as instruction;

-- 9. Check function permissions
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_def,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security
FROM 
  pg_proc p
JOIN 
  pg_namespace n ON p.pronamespace = n.oid
WHERE 
  n.nspname = 'public' AND
  p.proname IN ('anonymous_user_id', 'upsert_user_stitch_progress', 'transfer_anonymous_data');