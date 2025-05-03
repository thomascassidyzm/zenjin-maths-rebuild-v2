-- Create user_state table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state JSONB NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient queries by user
CREATE INDEX IF NOT EXISTS idx_user_state_user_id ON user_state(user_id);
CREATE INDEX IF NOT EXISTS idx_user_state_last_updated ON user_state(last_updated);

-- Add RLS policies
ALTER TABLE user_state ENABLE ROW LEVEL SECURITY;

-- Users can only access their own state
CREATE POLICY user_state_select_policy ON user_state 
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY user_state_insert_policy ON user_state 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY user_state_update_policy ON user_state 
  FOR UPDATE USING (auth.uid() = user_id);

-- Table existence checker function
CREATE OR REPLACE FUNCTION table_exists(table_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  exists BOOLEAN;
BEGIN
  SELECT COUNT(*) > 0 INTO exists
  FROM information_schema.tables
  WHERE table_schema = 'public' 
    AND table_name = $1;
  RETURN exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create user_state table
CREATE OR REPLACE FUNCTION create_minimal_user_state_table()
RETURNS VOID AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.user_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    state JSONB NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  
  -- Create index for efficient queries
  CREATE INDEX IF NOT EXISTS idx_user_state_user_id ON user_state(user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;