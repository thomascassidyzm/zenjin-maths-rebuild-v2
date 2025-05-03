-- Migration to enforce unique stitch positions at the database level
-- This prevents conflicts where multiple stitches have the same position in a tube

-- First, add a function to extract tube number from stitch_id or thread_id
CREATE OR REPLACE FUNCTION extract_tube_number(stitch_id TEXT, thread_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  tube_number INTEGER := NULL;
  tube_match TEXT[];
BEGIN
  -- First try to extract from stitch_id (format: stitch-T{tubeNum}-...)
  tube_match := regexp_matches(stitch_id, 'stitch-T(\d+)-', 'i');
  IF array_length(tube_match, 1) > 0 THEN
    tube_number := tube_match[1]::INTEGER;
    RETURN tube_number;
  END IF;
  
  -- If that fails, try to extract from thread_id (format: thread-T{tubeNum}-...)
  tube_match := regexp_matches(thread_id, 'thread-T(\d+)-', 'i');
  IF array_length(tube_match, 1) > 0 THEN
    tube_number := tube_match[1]::INTEGER;
    RETURN tube_number;
  END IF;
  
  -- If all extraction methods fail, return NULL
  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- If any error occurs during extraction, return NULL
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a temporary function to find and fix conflicts
CREATE OR REPLACE FUNCTION fix_stitch_position_conflicts()
RETURNS void AS $$
DECLARE
  conflicting_record RECORD;
  current_user_id UUID;
  current_tube_number INTEGER;
  next_position INTEGER;
  position_map JSONB := '{}'::jsonb;
  stitch_tube INTEGER;
BEGIN
  -- Add a temporary column to help with analysis
  ALTER TABLE user_stitch_progress ADD COLUMN IF NOT EXISTS temp_tube_number INTEGER;
  
  -- Populate the temporary column with tube numbers
  UPDATE user_stitch_progress
  SET temp_tube_number = extract_tube_number(stitch_id, thread_id);
  
  -- Process each user_id, tube_number group separately
  FOR current_user_id, current_tube_number IN 
    SELECT DISTINCT user_id, temp_tube_number 
    FROM user_stitch_progress 
    WHERE temp_tube_number IS NOT NULL
  LOOP
    -- Reset position map for this user/tube combo
    position_map := '{}'::jsonb;
    
    -- Process stitches in order of position
    FOR conflicting_record IN 
      SELECT * FROM user_stitch_progress 
      WHERE user_id = current_user_id 
        AND temp_tube_number = current_tube_number
      ORDER BY order_number
    LOOP
      -- Check if this position is already taken in our map
      IF position_map ? conflicting_record.order_number::text THEN
        -- Position conflict - find next available position
        next_position := conflicting_record.order_number + 1;
        WHILE position_map ? next_position::text LOOP
          next_position := next_position + 1;
        END LOOP;
        
        -- Update the record with the new position
        UPDATE user_stitch_progress 
        SET order_number = next_position 
        WHERE user_id = conflicting_record.user_id 
          AND stitch_id = conflicting_record.stitch_id;
        
        -- Add to position map
        position_map := jsonb_set(position_map, ARRAY[next_position::text], to_jsonb(conflicting_record.stitch_id));
        
        RAISE NOTICE 'Fixed conflict: Moving stitch % from position % to % (user: %, tube: %)', 
                      conflicting_record.stitch_id, 
                      conflicting_record.order_number, 
                      next_position,
                      current_user_id,
                      current_tube_number;
      ELSE
        -- Position not taken yet - add to map
        position_map := jsonb_set(position_map, ARRAY[conflicting_record.order_number::text], to_jsonb(conflicting_record.stitch_id));
      END IF;
    END LOOP;
  END LOOP;
  
  -- Remove the temporary column
  ALTER TABLE user_stitch_progress DROP COLUMN IF EXISTS temp_tube_number;
END;
$$ LANGUAGE plpgsql;

-- Run the function to fix existing conflicts
SELECT fix_stitch_position_conflicts();

-- Clean up the temporary function
DROP FUNCTION fix_stitch_position_conflicts();
DROP FUNCTION extract_tube_number(TEXT, TEXT);

-- Add a function-based index to efficiently extract tube numbers
CREATE OR REPLACE FUNCTION tube_number_from_stitch_id(stitch_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  tube_match TEXT[];
BEGIN
  tube_match := regexp_matches(stitch_id, 'stitch-T(\d+)-', 'i');
  IF array_length(tube_match, 1) > 0 THEN
    RETURN tube_match[1]::INTEGER;
  ELSE
    RETURN NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create the index to enforce uniqueness at the database level
CREATE UNIQUE INDEX IF NOT EXISTS unique_tube_stitch_position 
ON user_stitch_progress (user_id, tube_number_from_stitch_id(stitch_id), order_number)
WHERE tube_number_from_stitch_id(stitch_id) IS NOT NULL;

-- For backward compatibility, maintain the thread-based index as well
CREATE UNIQUE INDEX IF NOT EXISTS unique_thread_stitch_position 
ON user_stitch_progress (user_id, thread_id, order_number);

-- Add a comment explaining the uniqueness constraint
COMMENT ON INDEX unique_tube_stitch_position IS 
'Ensures each stitch has a unique position within a tube for a user.
This prevents the issue where multiple stitches end up with the same position/order in a tube.';

COMMENT ON INDEX unique_thread_stitch_position IS 
'Legacy index that ensures each stitch has a unique position within a thread for a user.
Maintained for backward compatibility.';