-- Create the save_user_state_atomic function
CREATE OR REPLACE FUNCTION save_user_state_atomic(user_id_input UUID, state_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Or SECURITY INVOKER if the RLS policies are sufficient
AS $$
DECLARE
  tube_data JSONB;
  stitch_data JSONB;
  active_tube_id TEXT;
  current_stitch_order INTEGER;
  max_order_for_tube INTEGER;
BEGIN
  -- Start a transaction (implicitly started in plpgsql function, but good to be mindful)

  -- Upsert the core user state
  INSERT INTO user_state (user_id, state, last_updated)
  VALUES (user_id_input, state_payload, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET state = excluded.state,
      last_updated = NOW();

  -- Process tubeState.tubes and their stitches
  IF state_payload->'tubeState' IS NOT NULL AND state_payload->'tubeState'->'tubes' IS NOT NULL THEN
    FOR tube_data IN SELECT * FROM jsonb_array_elements(state_payload->'tubeState'->'tubes')
    LOOP
      IF tube_data->'stitches' IS NOT NULL THEN
        -- Conflict Resolution: Ensure unique order_number per tube for this user.
        -- This is a simplified example. A more robust solution might involve
        -- re-ordering existing stitches if a new one is inserted in between.
        -- For now, we assume order_numbers are managed client-side or are appended.

        -- Optional: Reset/clear existing stitches for this tube and user if the payload is considered authoritative
        -- DELETE FROM user_stitch_progress WHERE user_id = user_id_input AND thread_id = tube_data->>'thread_id';
        -- This depends on whether the client sends the full list of stitches for a tube or only deltas.
        -- Assuming the payload contains the complete list of stitches for tubes present in the payload.

        FOR stitch_data IN SELECT * FROM jsonb_array_elements(tube_data->'stitches')
        LOOP
          -- Ensure order_number is present and is an integer
          IF stitch_data->>'order_number' IS NULL OR NOT (stitch_data->>'order_number' ~ '^\d+$') THEN
            RAISE WARNING 'Stitch (%, %) for user % is missing or has invalid order_number. Skipping.',
                        tube_data->>'thread_id', stitch_data->>'stitch_id', user_id_input;
            CONTINUE;
          END IF;
          current_stitch_order := (stitch_data->>'order_number')::INTEGER;

          -- Example conflict resolution: if order_number is already taken by another stitch in the same tube for the same user,
          -- we might increment subsequent stitches or throw an error.
          -- For simplicity, this example assumes client manages this or uses upsert to overwrite.
          -- A more robust approach:
          -- SELECT MAX(order_number) INTO max_order_for_tube FROM user_stitch_progress
          -- WHERE user_id = user_id_input AND thread_id = tube_data->>'thread_id';
          -- IF current_stitch_order IS NULL OR current_stitch_order <= (SELECT COALESCE(MAX(usp.order_number), -1) FROM user_stitch_progress usp WHERE usp.user_id = user_id_input AND usp.thread_id = tube_data->>'thread_id' AND usp.stitch_id <> stitch_data->>'stitch_id') THEN
             -- Handle conflict: e.g., shift other stitches, or assign new order_number
             -- current_stitch_order := COALESCE(max_order_for_tube, -1) + 1;
          -- END IF;


          INSERT INTO user_stitch_progress (user_id, thread_id, stitch_id, order_number, skip_number, distractor_level, updated_at)
          VALUES (
            user_id_input,
            tube_data->>'tube_id', -- Assuming tube_id in tube_data corresponds to thread_id
            stitch_data->>'stitch_id',
            (stitch_data->>'order_number')::INTEGER,
            (stitch_data->>'skip_number')::INTEGER,
            stitch_data->>'distractor_level',
            NOW()
          )
          ON CONFLICT (user_id, thread_id, stitch_id) DO UPDATE
          SET order_number = excluded.order_number,
              skip_number = excluded.skip_number,
              distractor_level = excluded.distractor_level,
              updated_at = NOW();
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- Process activeTube for user_tube_positions (if still needed)
  -- This table might be redundant if tubeState in user_state.state is sufficient.
  -- The primary key of user_tube_positions (user_id, tube_number, position)
  -- implies a tube can have multiple stitches at different positions, which seems
  -- to contradict the idea of a single "active stitch" per tube.
  -- Assuming `activeTube` refers to the `tube_id` (or `thread_id`) and there's an
  -- implicit "current stitch" or "position" within that tube, perhaps tracked by the highest `order_number`.
  -- For this example, we'll assume `user_tube_positions` stores the *current* active stitch for a given tube_number (if tube_number is an index/identifier).
  -- This part needs clarification based on the exact purpose of user_tube_positions.
  -- If tubeState.activeTube stores the ID of the active tube, and the "position" is the latest stitch:

  active_tube_id := state_payload->'tubeState'->>'activeTube';
  IF active_tube_id IS NOT NULL AND state_payload->'tubeState'->'tubes' IS NOT NULL THEN
    -- Find the active tube in the tubes array to get its details
    FOR tube_data IN SELECT * FROM jsonb_array_elements(state_payload->'tubeState'->'tubes')
    LOOP
      IF tube_data->>'tube_id' = active_tube_id THEN
        -- Assuming 'position' here means the order_number of the latest stitch in this active tube.
        -- Or if there's a specific 'current_stitch_id' for the active tube in the payload.
        -- Let's assume for now it's the first stitch in the active tube for simplicity, or a specific field from payload.
        -- This part is speculative due to ambiguity of 'user_tube_positions' role.
        -- If 'position' is just an identifier for the tube (e.g. 0, 1, 2 for display order of tubes)
        -- and 'stitch_id' is the current viewed stitch in that tube.

        -- Example: Store the first stitch of the active tube as its "position"
        -- This is a placeholder logic. The actual logic for user_tube_positions needs to be defined by its usage.
        IF jsonb_array_length(tube_data->'stitches') > 0 THEN
          -- Let's assume tube_number for user_tube_positions is an index (e.g. 0 for first tube in UI)
          -- This would require the client to send a 'tube_display_order' or similar.
          -- For now, using a placeholder '0' for tube_number.
          -- And using the first stitch_id as the current position.
          -- DELETE FROM user_tube_positions WHERE user_id = user_id_input AND tube_number = 0; -- Example: only one active position per tube_number
          -- INSERT INTO user_tube_positions (user_id, tube_number, position, stitch_id)
          -- VALUES (user_id_input, 0, (tube_data->'stitches'->0->>'order_number')::INTEGER, tube_data->'stitches'->0->>'stitch_id')
          -- ON CONFLICT (user_id, tube_number, position) DO UPDATE
          -- SET stitch_id = excluded.stitch_id;
          RAISE WARNING 'Logic for user_tube_positions is not fully defined and is placeholder.';
        END IF;
        EXIT; -- Found active tube
      END IF;
    END LOOP;
  END IF;

  -- Update summary tables (e.g., profiles) if necessary
  -- This is highly dependent on what needs to be summarized.
  -- Example: if state_payload contains total_points directly.
  IF state_payload->'learningProgress'->>'total_points' IS NOT NULL THEN
    INSERT INTO profiles (user_id, total_points)
    VALUES (user_id_input, (state_payload->'learningProgress'->>'total_points')::INTEGER)
    ON CONFLICT (user_id) DO UPDATE
    SET total_points = excluded.total_points;
  END IF;

  -- Commit is implicit if the function completes without error. Rollback is automatic on error.
  RETURN jsonb_build_object('success', true, 'message', 'User state saved successfully.');
EXCEPTION
  WHEN others THEN
    -- Log the error
    RAISE WARNING 'Error in save_user_state_atomic for user %: %', user_id_input, SQLERRM;
    -- Rethrow the error to ensure transaction rollback
    RAISE;
    -- Or return a JSON error object if preferred (but this would commit the transaction up to the error point if not careful)
    -- RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'details', SQLSTATE);
END;
$$;

-- Grant execution permission to the authenticated role
-- Replace 'authenticated' with your actual role if different
GRANT EXECUTE ON FUNCTION save_user_state_atomic(UUID, JSONB) TO authenticated;

-- Example of how to call it (for testing in Supabase SQL editor):
-- SELECT save_user_state_atomic(
--   'your-user-id-uuid', -- Replace with an actual user_id
--   '{
--     "userInformation": {"name": "Test User", "settings": {"theme": "dark"}},
--     "tubeState": {
--       "activeTube": "thread_intro_to_python",
--       "tubes": [
--         {
--           "tube_id": "thread_intro_to_python",
--           "stitches": [
--             {"stitch_id": "stitch_python_vars", "order_number": 0, "skip_number": 0, "distractor_level": "low"},
--             {"stitch_id": "stitch_python_loops", "order_number": 1, "skip_number": 0, "distractor_level": "medium"}
--           ]
--         },
--         {
--           "tube_id": "thread_advanced_sql",
--           "stitches": [
--             {"stitch_id": "stitch_sql_joins", "order_number": 0, "skip_number": 1, "distractor_level": "high"}
--           ]
--         }
--       ]
--     },
--     "learningProgress": {"total_points": 150}
--   }'::JSONB
-- );

-- Remember to handle RLS policies for the tables being accessed by this function,
-- especially if using SECURITY DEFINER. If using SECURITY INVOKER, the calling user's
-- RLS policies will apply.
-- For SECURITY DEFINER, common practice is to give the function owner (usually 'postgres')
-- necessary permissions on the tables, and the function itself handles authorization
-- (e.g., by checking user_id_input against auth.uid()).
-- In this function, we are directly using user_id_input, so RLS should be set up
-- such that users can only modify their own data, or the function needs to
-- explicitly check `auth.uid() = user_id_input`.
-- If this function is called via the API with Supabase client, the user is authenticated,
-- and their JWT usually contains the user_id. The API handler should ensure user_id_input matches the authenticated user.
ALTER FUNCTION save_user_state_atomic(UUID, JSONB) OWNER TO postgres; -- Or your admin role
-- If using SECURITY DEFINER, ensure RLS policies on the tables allow the function owner to operate.
-- E.g., for user_state:
-- ALTER TABLE user_state ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable access for function owner" ON user_state FOR ALL TO postgres USING (true); -- If function owner is postgres
-- CREATE POLICY "Users can only access their own state" ON user_state FOR ALL
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);

-- Similar policies for user_stitch_progress, user_tube_positions, profiles.
-- If SECURITY INVOKER is used, the RLS policies for the 'authenticated' role must allow these operations.
