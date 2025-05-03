-- Script to ensure anonymous user records exist
-- Run this if you're seeing "operator does not exist: uuid = text" errors

-- First, make sure our anonymous_user_id function works
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'anonymous_user_id'
  ) THEN
    RAISE NOTICE 'Creating anonymous_user_id function';
    -- Create the function if it doesn't exist
    CREATE OR REPLACE FUNCTION anonymous_user_id() RETURNS UUID AS $$
    BEGIN
      RETURN '00000000-0000-0000-0000-000000000000'::UUID;
    END;
    $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;
  ELSE
    RAISE NOTICE 'anonymous_user_id function already exists';
  END IF;
END $$;

-- Convert any 'anonymous' string values to proper UUIDs
DO $$
BEGIN
  -- Update user_stitch_progress
  UPDATE user_stitch_progress 
  SET user_id = anonymous_user_id()
  WHERE user_id::text = 'anonymous';
  
  RAISE NOTICE 'Updated % records in user_stitch_progress', FOUND;
  
  -- Update user_tube_position
  UPDATE user_tube_position 
  SET user_id = anonymous_user_id()
  WHERE user_id::text = 'anonymous';
  
  RAISE NOTICE 'Updated % records in user_tube_position', FOUND;
  
  -- Update user_sessions
  UPDATE user_sessions 
  SET user_id = anonymous_user_id()
  WHERE user_id::text = 'anonymous';
  
  RAISE NOTICE 'Updated % records in user_sessions', FOUND;
  
  -- Update session_results
  UPDATE session_results 
  SET user_id = anonymous_user_id()
  WHERE user_id::text = 'anonymous';
  
  RAISE NOTICE 'Updated % records in session_results', FOUND;
  
  -- Update sessions
  UPDATE sessions 
  SET user_id = anonymous_user_id()
  WHERE user_id::text = 'anonymous';
  
  RAISE NOTICE 'Updated % records in sessions', FOUND;
END $$;