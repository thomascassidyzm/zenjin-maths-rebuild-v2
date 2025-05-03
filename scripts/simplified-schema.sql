-- Drop old table if it exists
DROP TABLE IF EXISTS user_tube_positions;

-- Create simplified table for stitch positions in tubes
CREATE TABLE IF NOT EXISTS user_tube_positions (
  user_id UUID NOT NULL,
  tube_number INTEGER NOT NULL CHECK (tube_number BETWEEN 1 AND 3),
  position INTEGER NOT NULL,
  stitch_id TEXT NOT NULL,
  skip_number INTEGER DEFAULT 3,
  distractor_level TEXT DEFAULT 'L1',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Primary key: one stitch per position per tube per user
  PRIMARY KEY (user_id, tube_number, position)
);

-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_user_tube_positions_user_id ON user_tube_positions(user_id);

-- Create index for active (position 0) stitches
CREATE INDEX IF NOT EXISTS idx_user_tube_positions_active ON user_tube_positions(user_id, tube_number, position) 
WHERE position = 0;

-- RLS policies
ALTER TABLE user_tube_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_tube_positions_select ON user_tube_positions 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_tube_positions_insert ON user_tube_positions 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_tube_positions_update ON user_tube_positions 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_tube_positions_delete ON user_tube_positions 
  FOR DELETE USING (auth.uid() = user_id);

-- View to easily see active stitches (position 0) for each tube
CREATE OR REPLACE VIEW active_stitches AS
SELECT user_id, tube_number, stitch_id, skip_number, distractor_level
FROM user_tube_positions
WHERE position = 0
ORDER BY user_id, tube_number;