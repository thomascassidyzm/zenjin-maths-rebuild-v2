# Database Setup for Zenjin Maths

The progress tracking system requires a few tables to be created in your Supabase database. This guide will help you set them up.

## Required Tables

1. **profiles** - Stores user progress data and statistics
2. **session_results** - Stores completed session data 
3. **user_stitch_progress** - Tracks progress through individual stitches

## Setup Instructions

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Create a new query
4. Copy and paste the contents of `setup-database.sql` file
5. Run the query

This will create all necessary tables with the correct permissions.

## Manual SQL Setup

If you prefer to run the SQL statements manually, you can copy them below:

```sql
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
```

## Checking Table Status

After running the setup, you can verify the tables exist by running:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see the three tables listed in the results.

## Table Structure

### profiles

This table stores the user's progress and performance metrics:

- `id` - User ID (from auth.users)
- `display_name` - User's display name
- `total_points` - Total points accumulated
- `avg_blink_speed` - Average time to answer questions 
- `evolution_level` - Current evolution level
- `total_sessions` - Number of completed sessions
- `last_session_date` - When the user last played
- `created_at` - When the profile was created
- `updated_at` - When the profile was last updated

### session_results

This table records every completed session:

- `id` - Unique session ID
- `user_id` - User ID (from auth.users)
- `thread_id` - Thread ID for the session
- `stitch_id` - Stitch ID for the session
- `results` - JSON array of question results
- `total_points` - Points earned in the session
- `accuracy` - Percentage of correct answers
- `completed_at` - When the session was completed

### user_stitch_progress

This table tracks progress through individual stitches:

- `user_id` - User ID (from auth.users)
- `thread_id` - Thread ID for the stitch
- `stitch_id` - Unique stitch identifier
- `order_number` - Position in the sequence
- `skip_number` - Spacing interval for repetition
- `distractor_level` - Current distractor difficulty 
- `completed` - Whether the stitch is completed
- `updated_at` - When the stitch progress was last updated