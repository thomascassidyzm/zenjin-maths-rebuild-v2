-- Dashboard Schema for Zenjin Maths
-- This file defines the database tables needed for the dashboard functionality

-- Table for storing individual session results
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  stitch_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration INTEGER NOT NULL, -- Session duration in seconds
  base_points INTEGER NOT NULL,
  multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  multiplier_type TEXT,
  total_points INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  first_time_correct INTEGER NOT NULL, -- Number of questions answered correctly on first attempt
  blink_speed NUMERIC(5,2), -- Average response time for correct answers in seconds
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient queries by user
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_timestamp ON user_sessions(timestamp);

-- Table for daily aggregated statistics per user
CREATE TABLE IF NOT EXISTS daily_user_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  avg_blink_speed NUMERIC(5,2),
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create index for efficient queries by date
CREATE INDEX IF NOT EXISTS idx_daily_user_stats_date ON daily_user_stats(date);
CREATE INDEX IF NOT EXISTS idx_daily_user_stats_user_date ON daily_user_stats(user_id, date);

-- Table for global daily statistics (for percentile calculations)
CREATE TABLE IF NOT EXISTS global_daily_stats (
  date DATE PRIMARY KEY,
  active_users INTEGER NOT NULL,
  percentile_10 INTEGER NOT NULL,
  percentile_25 INTEGER NOT NULL,
  percentile_50 INTEGER NOT NULL,
  percentile_75 INTEGER NOT NULL,
  percentile_90 INTEGER NOT NULL,
  percentile_95 INTEGER NOT NULL,
  percentile_99 INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add user profile extension for dashboard-specific user data
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_points INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_blink_speed NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS evolution_level INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_session_date TIMESTAMPTZ;

-- Create RLS policies for security

-- user_sessions policies
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_sessions_insert_policy ON user_sessions 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY user_sessions_select_policy ON user_sessions 
  FOR SELECT USING (auth.uid() = user_id);

-- daily_user_stats policies
ALTER TABLE daily_user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_user_stats_insert_policy ON daily_user_stats 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY daily_user_stats_select_policy ON daily_user_stats 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY daily_user_stats_update_policy ON daily_user_stats 
  FOR UPDATE USING (auth.uid() = user_id);

-- global_daily_stats accessible to all authenticated users (read-only)
ALTER TABLE global_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY global_daily_stats_select_policy ON global_daily_stats 
  FOR SELECT USING (auth.role() = 'authenticated');

-- Function to update daily stats when a session is recorded
CREATE OR REPLACE FUNCTION update_daily_stats_on_session_insert()
RETURNS TRIGGER AS $$
DECLARE
  session_date DATE;
BEGIN
  -- Get the date from the session timestamp
  session_date := date(NEW.timestamp);
  
  -- Insert or update daily stats
  INSERT INTO daily_user_stats (user_id, date, points_earned, avg_blink_speed, sessions_completed)
  VALUES (
    NEW.user_id, 
    session_date, 
    NEW.total_points,
    NEW.blink_speed,
    1
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    points_earned = daily_user_stats.points_earned + NEW.total_points,
    avg_blink_speed = (daily_user_stats.avg_blink_speed * daily_user_stats.sessions_completed + NEW.blink_speed) / (daily_user_stats.sessions_completed + 1),
    sessions_completed = daily_user_stats.sessions_completed + 1,
    updated_at = NOW();
  
  -- Update user profile
  UPDATE public.profiles
  SET 
    total_points = total_points + NEW.total_points,
    avg_blink_speed = CASE 
      WHEN avg_blink_speed IS NULL THEN NEW.blink_speed
      ELSE (avg_blink_speed * 0.9 + NEW.blink_speed * 0.1) -- Weighted average favoring recent sessions
    END,
    last_session_date = NEW.timestamp
  WHERE id = NEW.user_id;
  
  -- Calculate and update evolution level
  UPDATE public.profiles
  SET evolution_level = CASE
    -- Evolution formula: Points ÷ Blink Speed, then find appropriate level
    WHEN (total_points / NULLIF(avg_blink_speed, 0)) < 1000 THEN 1
    WHEN (total_points / NULLIF(avg_blink_speed, 0)) < 3000 THEN 2
    WHEN (total_points / NULLIF(avg_blink_speed, 0)) < 6000 THEN 3
    WHEN (total_points / NULLIF(avg_blink_speed, 0)) < 10000 THEN 4
    WHEN (total_points / NULLIF(avg_blink_speed, 0)) < 15000 THEN 5
    WHEN (total_points / NULLIF(avg_blink_speed, 0)) < 25000 THEN 6
    WHEN (total_points / NULLIF(avg_blink_speed, 0)) < 40000 THEN 7
    WHEN (total_points / NULLIF(avg_blink_speed, 0)) < 60000 THEN 8
    WHEN (total_points / NULLIF(avg_blink_speed, 0)) < 85000 THEN 9
    WHEN (total_points / NULLIF(avg_blink_speed, 0)) < 120000 THEN 10
    ELSE 11 -- Additional levels can be added as needed
  END
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stats when a session is inserted
CREATE TRIGGER after_session_insert
  AFTER INSERT ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_stats_on_session_insert();