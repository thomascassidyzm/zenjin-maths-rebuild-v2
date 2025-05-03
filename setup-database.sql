-- Zenjin Maths Schema Setup
-- This script creates the necessary tables for user progress tracking

-- Create profiles table to store user progress and stats
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  total_points INTEGER DEFAULT 0,
  avg_blink_speed REAL DEFAULT 2.5,
  evolution_level INTEGER DEFAULT 1,
  total_sessions INTEGER DEFAULT 0,
  last_session_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create session_results table to store completed sessions
CREATE TABLE IF NOT EXISTS session_results (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  stitch_id TEXT NOT NULL,
  results JSONB DEFAULT '[]'::jsonb,
  total_points INTEGER DEFAULT 0,
  accuracy REAL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_stitch_progress to track individual stitch progress
CREATE TABLE IF NOT EXISTS user_stitch_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  stitch_id TEXT NOT NULL,
  order_number INTEGER DEFAULT 0,
  skip_number INTEGER DEFAULT 1,
  distractor_level TEXT DEFAULT 'L1',
  completed BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, thread_id, stitch_id)
);

-- Create RLS policies to secure the tables

-- Profiles policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON profiles 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_insert ON profiles 
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update ON profiles 
  FOR UPDATE USING (auth.uid() = id);

-- Session results policies
ALTER TABLE session_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY session_results_select ON session_results 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY session_results_insert ON session_results 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User stitch progress policies
ALTER TABLE user_stitch_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_stitch_progress_select ON user_stitch_progress 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_stitch_progress_insert ON user_stitch_progress 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_stitch_progress_update ON user_stitch_progress 
  FOR UPDATE USING (auth.uid() = user_id);