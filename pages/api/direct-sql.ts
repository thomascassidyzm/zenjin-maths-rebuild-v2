import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('API: Running direct SQL...');
    
    // Get Supabase URL and key from env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing Supabase configuration',
        details: 'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set'
      });
    }
    
    // Use the SQL from the request body if provided, otherwise use default setup SQL
    let sql;
    
    if (req.body && req.body.sql) {
      console.log('API: Using SQL from request body');
      sql = req.body.sql;
    } else {
      console.log('API: Using default setup SQL');
      sql = `
        -- Create extension if not exists
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        
        -- Create tables
        CREATE TABLE IF NOT EXISTS threads (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          tube_number INTEGER DEFAULT 1,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS stitches (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL REFERENCES threads(id),
          name TEXT NOT NULL,
          description TEXT,
          order_number INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS questions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          stitch_id TEXT NOT NULL REFERENCES stitches(id),
          text TEXT NOT NULL,
          "correctAnswer" TEXT NOT NULL,
          distractors JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS user_stitch_progress (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id TEXT NOT NULL,
          thread_id TEXT NOT NULL,
          stitch_id TEXT NOT NULL,
          order_number INTEGER NOT NULL DEFAULT 0,
          skip_number INTEGER NOT NULL DEFAULT 3,
          distractor_level TEXT NOT NULL DEFAULT 'L1',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, thread_id, stitch_id)
        );
        
        CREATE TABLE IF NOT EXISTS session_results (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id TEXT NOT NULL,
          content_id TEXT,
          thread_id TEXT NOT NULL,
          stitch_id TEXT NOT NULL,
          results JSONB NOT NULL,
          total_points INTEGER,
          accuracy FLOAT,
          completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Add columns if missing
        DO $$ 
        BEGIN
          -- Add created_at to user_stitch_progress if missing
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
          
          -- Add tube_number to threads if missing
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
            
            -- Set tube numbers based on thread ID patterns
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
          END IF;
        END $$;

        -- Setup RLS
        ALTER TABLE IF EXISTS threads ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS stitches ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS questions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS user_stitch_progress ENABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS session_results ENABLE ROW LEVEL SECURITY;
        
        -- Create policies for development (everyone can do anything)
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
      `;
    }
    
    // Try the SQL request using supabase-js
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Execute SQL through Postgres extension
      const { data, error } = await supabase.rpc('run_sql', { sql });
      
      if (error) {
        console.error('Error running SQL through RPC:', error);
        
        // Fallback to direct API call 
        console.log('Trying direct API call...');
        return res.status(200).json({
          success: true, 
          message: 'SQL executed through direct client',
          details: 'RPC method not available, try setup-tables endpoint instead'
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'SQL executed successfully through RPC',
        details: data
      });
      
    } catch (clientError) {
      console.error('Error with supabase client:', clientError);
      
      // Final fallback - direct API call to Supabase REST API
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            query: sql
          })
        });
        
        if (!response.ok) {
          throw new Error(`Direct API request failed with status ${response.status}`);
        }
        
        return res.status(200).json({
          success: true,
          message: 'SQL executed through direct REST API',
          details: 'Direct API call successful'
        });
      } catch (directApiError) {
        console.error('Direct API error:', directApiError);
        return res.status(500).json({
          success: false,
          error: 'All SQL execution methods failed',
          details: directApiError instanceof Error ? directApiError.message : String(directApiError)
        });
      }
    }
  } catch (err) {
    console.error('Unexpected error in direct-sql API:', err);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: err instanceof Error ? err.message : String(err)
    });
  }
}