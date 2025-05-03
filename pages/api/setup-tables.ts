import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/auth/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('Setting up database tables...');
    
    // Step 1: Try to create a SQL helper function
    try {
      console.log('Creating SQL helper function...');
      await supabase.rpc('execute_sql', {
        sql: `
          -- Create SQL execution helper
          CREATE OR REPLACE FUNCTION public.run_sql(sql text)
          RETURNS void
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          BEGIN
            EXECUTE sql;
          END;
          $$;
          
          -- Grant permissions
          GRANT EXECUTE ON FUNCTION public.run_sql(text) TO authenticated;
          GRANT EXECUTE ON FUNCTION public.run_sql(text) TO anon;
        `
      });
    } catch (error) {
      console.log('Note: SQL helper function creation skipped -', error);
      // Continue anyway - this is expected to fail on some Supabase instances
    }
    
    // Step 2: Execute SQL to create or update tables
    console.log('Creating database tables...');
    
    // Try different methods to run SQL
    let setupResult;
    let success = false;
    
    // Method 1: Try using run_sql RPC
    try {
      setupResult = await supabase.rpc('run_sql', {
        sql: getFullSetupScript()
      });
      success = !setupResult.error;
    } catch (rpcError) {
      console.log('RPC method failed:', rpcError);
      
      // Method 2: Try direct SQL
      try {
        const directResult = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/run_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`
          },
          body: JSON.stringify({
            sql: getFullSetupScript()
          })
        });
        
        if (directResult.ok) {
          success = true;
          console.log('Direct REST API call succeeded');
        } else {
          console.log('Direct REST API call failed:', await directResult.text());
        }
      } catch (directError) {
        console.log('Direct method failed:', directError);
      }
    }
    
    // Step 3: If methods failed, try sequence of operations (fallback)
    if (!success) {
      console.log('Using fallback approach (sequence of operations)...');
      try {
        // Create tables one by one using individual calls
        // 1. Create threads table
        const { error: threadsError } = await supabase
          .from('threads')
          .insert({ id: 'setup-test', name: 'Setup Test', description: 'Testing table creation' })
          .select()
          .limit(1);
          
        if (threadsError && !threadsError.message.includes('already exists')) {
          // Try to create the table explicitly
          await directExecuteSql(`
            CREATE TABLE IF NOT EXISTS threads (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
          `);
        }
        
        // 2. Create stitches table
        const { error: stitchesError } = await supabase
          .from('stitches')
          .insert({ 
            id: 'setup-test-stitch', 
            thread_id: 'setup-test',
            name: 'Setup Test Stitch', 
            description: 'Testing stitch creation',
            order_number: 0
          })
          .select()
          .limit(1);
          
        if (stitchesError && !stitchesError.message.includes('already exists')) {
          // Try to create the table explicitly
          await directExecuteSql(`
            CREATE TABLE IF NOT EXISTS stitches (
              id TEXT PRIMARY KEY,
              thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
              name TEXT NOT NULL,
              description TEXT,
              order_number INTEGER,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
          `);
        }
        
        // 3. Create questions table
        const { error: questionsError } = await supabase
          .from('questions')
          .insert({ 
            stitch_id: 'setup-test-stitch',
            text: 'Test question',
            correctAnswer: 'Test answer',
            distractors: { L1: 'Distractor' }
          })
          .select()
          .limit(1);
          
        if (questionsError && !questionsError.message.includes('already exists')) {
          // Try to create the table explicitly
          await directExecuteSql(`
            CREATE TABLE IF NOT EXISTS questions (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              stitch_id TEXT NOT NULL REFERENCES stitches(id) ON DELETE CASCADE,
              text TEXT NOT NULL,
              "correctAnswer" TEXT NOT NULL,
              distractors JSONB NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
          `);
        }
        
        // 4. Create user_stitch_progress table
        const { error: progressError } = await supabase
          .from('user_stitch_progress')
          .insert({ 
            user_id: '00000000-0000-0000-0000-000000000000',
            thread_id: 'setup-test',
            stitch_id: 'setup-test-stitch',
            order_number: 0,
            skip_number: 3,
            distractor_level: 'L1',
            updated_at: new Date().toISOString()
          })
          .select()
          .limit(1);
          
        if (progressError && !progressError.message.includes('already exists')) {
          // Try to create the table explicitly
          await directExecuteSql(`
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
          `);
        }
        
        // 5. Create session_results table
        const { error: resultsError } = await supabase
          .from('session_results')
          .insert({ 
            user_id: '00000000-0000-0000-0000-000000000000',
            thread_id: 'setup-test',
            stitch_id: 'setup-test-stitch',
            results: { test: true },
            total_points: 0,
            accuracy: 0
          })
          .select()
          .limit(1);
          
        if (resultsError && !resultsError.message.includes('already exists')) {
          // Try to create the table explicitly
          await directExecuteSql(`
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
          `);
        }
        
        // 6. Set up RLS policies
        await directExecuteSql(`
          -- Enable RLS but allow all operations for now
          ALTER TABLE IF EXISTS threads ENABLE ROW LEVEL SECURITY;
          ALTER TABLE IF EXISTS stitches ENABLE ROW LEVEL SECURITY;
          ALTER TABLE IF EXISTS questions ENABLE ROW LEVEL SECURITY;
          ALTER TABLE IF EXISTS user_stitch_progress ENABLE ROW LEVEL SECURITY;
          ALTER TABLE IF EXISTS session_results ENABLE ROW LEVEL SECURITY;
          
          -- Create policies that allow all operations
          CREATE POLICY IF NOT EXISTS allow_all_threads ON threads FOR ALL USING (true);
          CREATE POLICY IF NOT EXISTS allow_all_stitches ON stitches FOR ALL USING (true);
          CREATE POLICY IF NOT EXISTS allow_all_questions ON questions FOR ALL USING (true);
          CREATE POLICY IF NOT EXISTS allow_all_progress ON user_stitch_progress FOR ALL USING (true);
          CREATE POLICY IF NOT EXISTS allow_all_results ON session_results FOR ALL USING (true);
        `);
        
        success = true;
        console.log('Fallback approach succeeded');
      } catch (fallbackError) {
        console.error('Fallback approach also failed:', fallbackError);
        return res.status(500).json({
          success: false,
          message: 'Database setup failed with fallback method',
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
      }
    }
    
    // Return success
    return res.status(200).json({
      success: true,
      message: 'Database tables created/updated successfully',
      method: success ? 'main' : 'fallback'
    });
    
  } catch (error) {
    console.error('Unexpected error setting up database:', error);
    return res.status(500).json({
      success: false,
      message: 'Database setup failed with unexpected error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Helper function for direct SQL execution
async function directExecuteSql(sql: string) {
  try {
    const { data, error } = await supabase.rpc('run_sql', { sql });
    if (error) throw error;
    return data;
  } catch (rpcError) {
    console.log('Direct SQL via RPC failed, trying REST API:', rpcError);
    
    // Fallback to fetch API
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/run_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`
      },
      body: JSON.stringify({ sql })
    });
    
    if (!response.ok) {
      throw new Error(`Direct SQL execution failed: ${await response.text()}`);
    }
    
    return await response.json();
  }
}

// Full setup script
function getFullSetupScript() {
  return `
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    -- Step 1: Create tables with proper relationships in correct order
    -- Create threads table first (no dependencies)
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      tube_number INTEGER DEFAULT 1,   -- Add tube_number column (1, 2, or 3)
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
    
    -- Create user progress table with references
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
    
    -- Add created_at column if it doesn't exist
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_stitch_progress'
      ) AND NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_stitch_progress' 
        AND column_name = 'created_at'
      ) THEN
        ALTER TABLE public.user_stitch_progress 
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      END IF;
    END $$;
    
    -- Add tube_number column if it doesn't exist
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'threads'
      ) AND NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'threads' 
        AND column_name = 'tube_number'
      ) THEN
        ALTER TABLE public.threads 
        ADD COLUMN tube_number INTEGER DEFAULT 1;
        
        -- Set default tube numbers based on thread ID patterns
        UPDATE public.threads
        SET tube_number = 
          CASE 
            WHEN id LIKE '%A%' THEN 1
            WHEN id LIKE '%B%' THEN 2
            WHEN id LIKE '%C%' THEN 3
            WHEN id LIKE '%D%' THEN 1
            WHEN id LIKE '%E%' THEN 2
            WHEN id LIKE '%F%' THEN 3
            ELSE 1
          END;
          
        -- Log that migration happened
        RAISE NOTICE 'Added tube_number column and set default values based on thread ID patterns';
      END IF;
    END $$;
    
    -- Setup RLS policies
    ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
    ALTER TABLE stitches ENABLE ROW LEVEL SECURITY;
    ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_stitch_progress ENABLE ROW LEVEL SECURITY;
    ALTER TABLE session_results ENABLE ROW LEVEL SECURITY;
    
    -- Create development policies (allow all for testing)
    DROP POLICY IF EXISTS "allow_all_threads" ON threads;
    CREATE POLICY "allow_all_threads" ON threads USING (true);
    
    DROP POLICY IF EXISTS "allow_all_stitches" ON stitches;
    CREATE POLICY "allow_all_stitches" ON stitches USING (true);
    
    DROP POLICY IF EXISTS "allow_all_questions" ON questions;
    CREATE POLICY "allow_all_questions" ON questions USING (true);
    
    DROP POLICY IF EXISTS "allow_all_progress" ON user_stitch_progress;
    CREATE POLICY "allow_all_progress" ON user_stitch_progress USING (true);
    
    DROP POLICY IF EXISTS "allow_all_results" ON session_results;
    CREATE POLICY "allow_all_results" ON session_results USING (true);
    
    -- Insert test records to verify everything works
    INSERT INTO threads (id, name, description)
    VALUES ('setup-test', 'Setup Test', 'Testing table creation')
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO stitches (id, thread_id, name, description, order_number)
    VALUES ('setup-test-stitch', 'setup-test', 'Setup Test Stitch', 'Testing stitch creation', 0)
    ON CONFLICT (id) DO NOTHING;
  `;
}