-- Function to directly upsert user state for large payloads
CREATE OR REPLACE FUNCTION upsert_user_state(
  p_user_id TEXT,
  p_state JSONB,
  p_last_updated TIMESTAMPTZ DEFAULT NOW()
)
RETURNS VOID AS $$
BEGIN
  -- Attempt to insert the state
  INSERT INTO user_state (user_id, state, last_updated, created_at)
  VALUES (p_user_id, p_state, p_last_updated, NOW())
  ON CONFLICT (user_id, last_updated) DO UPDATE
  SET state = p_state;
  
  -- If no rows were affected (might happen with exact timestamp collision), 
  -- insert with a slightly later timestamp
  IF NOT FOUND THEN
    INSERT INTO user_state (user_id, state, last_updated, created_at)
    VALUES (p_user_id, p_state, p_last_updated + INTERVAL '1 millisecond', NOW());
  END IF;
END;
$$ LANGUAGE plpgsql;