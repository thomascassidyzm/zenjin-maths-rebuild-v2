-- Creates a function to execute SQL statements
-- This is used for migrations and schema updates

-- Create the function if it doesn't exist
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run as the function owner
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Execute the SQL statement
  EXECUTE sql;
  
  -- Return a success message
  result := jsonb_build_object('success', true, 'message', 'SQL executed successfully');
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Return error information
  result := jsonb_build_object(
    'success', false,
    'message', 'SQL execution failed',
    'error', SQLERRM,
    'code', SQLSTATE
  );
  
  RETURN result;
END;
$$;