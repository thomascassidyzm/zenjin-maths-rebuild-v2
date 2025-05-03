import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Create a fresh client instance
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const results: Record<string, { success: boolean; message: string }> = {};

    // 1. Try basic SQL to check connectivity
    try {
      const { data: authUser, error: authError } = await supabase.auth.getUser();
      results.auth = {
        success: !authError,
        message: authError ? authError.message : `Auth working, user: ${authUser?.user?.email || 'none'}`
      };
    } catch (error) {
      results.auth = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error checking authentication'
      };
    }

    // 2. First create test thread and stitch
    try {
      // Create a test thread first (using upsert to ensure it exists)
      const { error: threadError } = await supabase
        .from('threads')
        .upsert({
          id: 'test-thread',
          name: 'Test Thread',
          description: 'A thread for testing',
          created_at: new Date().toISOString()
        });

      if (threadError) {
        results.create_prerequisites = {
          success: false,
          message: `Failed to create thread: ${threadError.message}`
        };
      } else {
        // Only try to create stitch if thread creation succeeded
        const { error: stitchError } = await supabase
          .from('stitches')
          .upsert({
            id: 'test-stitch',
            thread_id: 'test-thread',
            name: 'Test Stitch',
            description: 'A stitch for testing',
            created_at: new Date().toISOString()
          });

        results.create_prerequisites = {
          success: !stitchError,
          message: stitchError ? `Failed to create stitch: ${stitchError.message}` : 'Created test thread and stitch'
        };

        // Only try to create progress if stitch creation succeeded
        if (!stitchError) {
          const { error: createError } = await supabase
            .from('user_stitch_progress')
            .upsert({
              user_id: req.body?.userId || '00000000-0000-0000-0000-000000000000',
              thread_id: 'test-thread',
              stitch_id: 'test-stitch',
              order_number: 0,
              skip_number: 3,
              distractor_level: 'L1',
              updated_at: new Date().toISOString()
            });

          results.create_progress = {
            success: !createError,
            message: createError ? createError.message : 'Created test progress entry'
          };
        } else {
          results.create_progress = {
            success: false,
            message: 'Skipped creating progress entry due to stitch creation failure'
          };
        }
      }
    } catch (error) {
      results.create_progress = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error creating test records'
      };
    }

    // 3. Try to update the record (only if creation succeeded)
    if (results.create_progress?.success) {
      try {
        const { error: updateError } = await supabase
          .from('user_stitch_progress')
          .update({
            order_number: 1,
            updated_at: new Date().toISOString()
          })
          .eq('thread_id', 'test-thread')
          .eq('stitch_id', 'test-stitch');

        results.update_progress = {
          success: !updateError,
          message: updateError ? updateError.message : 'Updated test progress entry'
        };
      } catch (error) {
        results.update_progress = {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error updating test record'
        };
      }

      // 4. Check if we can read the record
      try {
        const { data, error: readError } = await supabase
          .from('user_stitch_progress')
          .select('*')
          .eq('thread_id', 'test-thread')
          .eq('stitch_id', 'test-stitch');

        results.read_progress = {
          success: !readError && data && data.length > 0,
          message: readError ? readError.message : `Read ${data?.length || 0} records`
        };
      } catch (error) {
        results.read_progress = {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error reading test record'
        };
      }
    } else {
      // Skip update and read tests if creation failed
      results.update_progress = {
        success: false,
        message: 'Skipped updating progress entry due to creation failure'
      };
      results.read_progress = {
        success: false,
        message: 'Skipped reading progress entry due to creation failure'
      };
    }

    // 5. Based on results, provide solutions
    const hasDatabaseIssues = Object.values(results).some(r => !r.success);
    let recommendedAction = '';

    if (hasDatabaseIssues) {
      if (results.auth.success && !results.create_prerequisites.success) {
        // Auth works but database tables don't exist
        recommendedAction = 'Go to the Supabase dashboard, SQL Editor, and run the setup script in our solution section to create the necessary tables.';
      } else if (results.auth.success && results.create_prerequisites.success && !results.create_progress.success) {
        // Auth works, tables exist, but constraints or schema is wrong
        recommendedAction = 'Foreign key constraints appear to be missing or corrupted. Run the complete setup script in our solution section to fix the database schema.';
      } else if (!results.auth.success) {
        // Auth doesn't work - likely configuration issue
        recommendedAction = 'Check your Supabase URL and anon key in the Vercel environment variables. Authentication is not working properly.';
      } else {
        // Other issues
        recommendedAction = 'Database connection has issues. Check the SQL script in our solution section and run it in the Supabase SQL Editor to fix the schema.';
      }
    } else {
      recommendedAction = 'Database connection is working! You can use the application normally.';
    }

    // Include SQL setup script in response - now with proper foreign key constraints and sequential operations
    const sqlSetupScript = `
-- Run this in the Supabase SQL Editor to fix database issues
-- Enable UUID extension first
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Create tables with proper relationships
-- Create threads table first (no dependencies)
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stitches table (depends on threads)
CREATE TABLE IF NOT EXISTS stitches (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create questions table (depends on stitches)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stitch_id TEXT NOT NULL REFERENCES stitches(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  "correctAnswer" TEXT NOT NULL,
  distractors JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user progress table
CREATE TABLE IF NOT EXISTS user_stitch_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  stitch_id TEXT NOT NULL REFERENCES stitches(id) ON DELETE CASCADE,
  order_number INTEGER NOT NULL DEFAULT 0,
  skip_number INTEGER NOT NULL DEFAULT 3,
  distractor_level TEXT NOT NULL DEFAULT 'L1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, thread_id, stitch_id)
);

-- Create session results table
CREATE TABLE IF NOT EXISTS session_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  content_id TEXT,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  stitch_id TEXT NOT NULL REFERENCES stitches(id) ON DELETE CASCADE,
  results JSONB NOT NULL,
  total_points INTEGER,
  accuracy FLOAT,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Enable Row Level Security
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE stitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stitch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_results ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policies
DROP POLICY IF EXISTS allow_all_threads ON threads;
CREATE POLICY allow_all_threads ON threads USING (true);

DROP POLICY IF EXISTS allow_all_stitches ON stitches;
CREATE POLICY allow_all_stitches ON stitches USING (true);

DROP POLICY IF EXISTS allow_all_questions ON questions;
CREATE POLICY allow_all_questions ON questions USING (true);

DROP POLICY IF EXISTS allow_all_progress ON user_stitch_progress;
CREATE POLICY allow_all_progress ON user_stitch_progress USING (true);

DROP POLICY IF EXISTS allow_all_results ON session_results;
CREATE POLICY allow_all_results ON session_results USING (true);

-- Step 4: Insert test data with proper sequence
-- First insert test thread
INSERT INTO threads (id, name, description)
VALUES ('test-thread', 'Test Thread', 'A thread for testing')
ON CONFLICT (id) DO NOTHING;

-- Then insert test stitch that references the thread
INSERT INTO stitches (id, thread_id, name, description, order_number)
VALUES ('test-stitch', 'test-thread', 'Test Stitch', 'A stitch for testing', 0)
ON CONFLICT (id) DO NOTHING;

-- Finally insert test progress that references both thread and stitch
INSERT INTO user_stitch_progress (user_id, thread_id, stitch_id, order_number, skip_number, distractor_level)
VALUES ('00000000-0000-0000-0000-000000000000', 'test-thread', 'test-stitch', 0, 3, 'L1')
ON CONFLICT (user_id, thread_id, stitch_id) DO NOTHING;
`;

    return res.status(200).json({
      success: !hasDatabaseIssues,
      results,
      recommendedAction,
      sqlSetupScript
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({
      success: false,
      message: 'Unexpected error occurred',
      error: err instanceof Error ? err.message : String(err)
    });
  }
}