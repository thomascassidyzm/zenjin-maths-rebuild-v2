-- Create the get_user_state_comprehensive function
CREATE OR REPLACE FUNCTION get_user_state_comprehensive(user_id_input UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  base_state JSONB;
  stitch_progress_records JSONB;
  user_profile_data JSONB;
  assembled_tube_state JSONB;
  tube_record RECORD;
  stitch_record RECORD;
  question_record RECORD;
  final_tubes JSONB := '[]'::JSONB;
  current_tube_stitches JSONB;
  current_stitch_questions JSONB;
  active_tube_id TEXT;
BEGIN
  -- 1. Fetch the primary state object from user_state
  SELECT state INTO base_state FROM user_state WHERE user_id = user_id_input;

  IF base_state IS NULL THEN
    -- Return a default initial state if no state is found for the user
    RETURN jsonb_build_object(
      'userInformation', jsonb_build_object(),
      'tubeState', jsonb_build_object('tubes', '[]'::JSONB, 'activeTube', null),
      'learningProgress', jsonb_build_object()
      -- Initialize other parts of the state as needed
    );
  END IF;

  -- 2. Fetch all records from user_stitch_progress for user_id_input
  -- We'll integrate this into the tube assembly later.

  -- 3. Fetch summary data from profiles (e.g., total_points)
  SELECT row_to_json(p.*) INTO user_profile_data FROM profiles p WHERE p.user_id = user_id_input;
  IF user_profile_data IS NULL THEN
    user_profile_data := '{}'::JSONB; -- Default if no profile entry
  END IF;

  -- 4. Assemble tubeState by combining base_state.tubeState with stitch details and content
  active_tube_id := base_state->'tubeState'->>'activeTube';
  assembled_tube_state := jsonb_build_object('activeTube', active_tube_id, 'tubes', '[]'::JSONB);

  IF base_state->'tubeState'->'tubes' IS NOT NULL AND jsonb_typeof(base_state->'tubeState'->'tubes') = 'array' THEN
    FOR tube_record IN SELECT jsonb_array_elements(base_state->'tubeState'->'tubes') AS tube_data
    LOOP
      current_tube_stitches := '[]'::JSONB;
      -- Fetch stitch progress for the current tube_id (thread_id)
      FOR stitch_record IN
        SELECT
          usp.stitch_id,
          usp.order_number,
          usp.skip_number,
          usp.distractor_level,
          s.content AS stitch_content -- Join with stitches table for content
          -- Add any other stitch-specific fields from 'stitches' table needed by client
        FROM user_stitch_progress usp
        JOIN stitches s ON usp.stitch_id = s.stitch_id AND usp.thread_id = s.thread_id
        WHERE usp.user_id = user_id_input AND usp.thread_id = tube_record.tube_data->>'tube_id'
        ORDER BY usp.order_number ASC
      LOOP
        current_stitch_questions := '[]'::JSONB;
        -- Fetch questions for the current stitch_id
        FOR question_record IN
          SELECT
            q.question_id,
            q.question_text
            -- Add any other question-specific fields from 'questions' table
          FROM questions q
          WHERE q.stitch_id = stitch_record.stitch_id
        LOOP
          current_stitch_questions := current_stitch_questions || jsonb_build_object(
            'question_id', question_record.question_id,
            'question_text', question_record.question_text
            -- ... other question fields
          );
        END LOOP;

        current_tube_stitches := current_tube_stitches || jsonb_build_object(
          'stitch_id', stitch_record.stitch_id,
          'order_number', stitch_record.order_number,
          'skip_number', stitch_record.skip_number,
          'distractor_level', stitch_record.distractor_level,
          'content', stitch_record.stitch_content,
          'questions', current_stitch_questions
          -- ... other stitch progress fields
        );
      END LOOP;

      -- Add thread content/details for the tube
      DECLARE
        thread_details JSONB;
      BEGIN
        SELECT row_to_json(t.*) INTO thread_details FROM threads t WHERE t.thread_id = tube_record.tube_data->>'tube_id';
        IF thread_details IS NULL THEN
            thread_details := '{}'::JSONB;
        END IF;

        final_tubes := final_tubes || (tube_record.tube_data - 'stitches' || jsonb_build_object(
            'stitches', current_tube_stitches,
            'thread_details', thread_details -- Add full thread details here
            -- Potentially merge fields from tube_record.tube_data if it contains overrides or UI-specific info
            ));
      END;
    END LOOP;
  END IF;

  assembled_tube_state := assembled_tube_state || jsonb_build_object('tubes', final_tubes);

  -- 5. Assemble the final state object
  RETURN jsonb_build_object(
    'userInformation', COALESCE(base_state->'userInformation', '{}'::JSONB),
    'tubeState', assembled_tube_state,
    'learningProgress', COALESCE(base_state->'learningProgress', '{}'::JSONB) || user_profile_data -- Merge profile data like total_points
    -- Add other top-level state sections as needed
  );

EXCEPTION
  WHEN others THEN
    -- Log the error
    RAISE WARNING 'Error in get_user_state_comprehensive for user %: %', user_id_input, SQLERRM;
    -- Rethrow the error
    RAISE;
    -- RETURN jsonb_build_object('error', SQLERRM, 'details', SQLSTATE);
END;
$$;

-- Grant execution permission to the authenticated role
-- Replace 'authenticated' with your actual role if different
GRANT EXECUTE ON FUNCTION get_user_state_comprehensive(UUID) TO authenticated;
ALTER FUNCTION get_user_state_comprehensive(UUID) OWNER TO postgres; -- Or your admin role

-- Example of how to call it (for testing in Supabase SQL editor):
-- SELECT get_user_state_comprehensive('your-user-id-uuid'); -- Replace with an actual user_id

-- Ensure RLS is in place for all accessed tables if this function uses SECURITY INVOKER.
-- If SECURITY DEFINER, the function owner (postgres) must have permissions.
-- Tables accessed: user_state, user_stitch_progress, profiles, threads, stitches, questions.
-- Example RLS for 'threads' table (if not public):
-- ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Authenticated users can read all threads" ON threads FOR SELECT TO authenticated USING (true);
-- Similar policies for stitches, questions.
-- For user_state, user_stitch_progress, profiles, RLS should restrict access to the user's own data.
-- E.g., for user_stitch_progress:
-- ALTER TABLE user_stitch_progress ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can access their own stitch progress" ON user_stitch_progress FOR SELECT
--   USING (auth.uid() = user_id);

-- Note on Optimization:
-- The nested loops for fetching stitches and questions can lead to N+1 query problems if not careful.
-- In a high-performance scenario, one might:
-- 1. Fetch all relevant user_stitch_progress records.
-- 2. Gather all unique stitch_ids and thread_ids.
-- 3. Fetch all relevant stitches, threads, and questions in bulk queries using IN clauses.
-- 4. Assemble the structure in PL/pgSQL or even at the application layer (though PL/pgSQL is preferred for atomicity here).
-- This example uses simpler loops for clarity but might need optimization for very large datasets.
-- Ensure indexes are present on:
-- user_state(user_id)
-- user_stitch_progress(user_id, thread_id, order_number)
-- profiles(user_id)
-- threads(thread_id)
-- stitches(stitch_id, thread_id)
-- questions(stitch_id)
-- user_tube_positions(user_id, tube_number) -- if used.
