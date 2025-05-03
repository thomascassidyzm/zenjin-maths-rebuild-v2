import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/auth/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only POST requests allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    console.log('Checking schema and fixing user_stitch_progress table...');
    
    // Check if table exists
    const { data: tableExists, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'user_stitch_progress')
      .single();
    
    if (tableError) {
      console.error('Error checking if table exists:', tableError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to check if table exists',
        error: tableError.message
      });
    }
    
    if (!tableExists) {
      console.log('user_stitch_progress table does not exist, creating it...');
      
      // Create the table with proper schema including created_at
      const { error: createError } = await supabase.rpc('create_tables_if_not_exist', {
        create_progress: true
      });
      
      if (createError) {
        console.error('Error creating user_stitch_progress table:', createError);
        return res.status(500).json({
          success: false,
          message: 'Failed to create user_stitch_progress table',
          error: createError.message
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Created user_stitch_progress table with proper schema'
      });
    }
    
    // Check if created_at column exists
    const { data: columnExists, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'user_stitch_progress')
      .eq('column_name', 'created_at')
      .single();
    
    if (columnError && columnError.code !== 'PGRST116') { // PGRST116 is "Results contain 0 rows"
      console.error('Error checking if column exists:', columnError);
      return res.status(500).json({
        success: false,
        message: 'Failed to check if column exists',
        error: columnError.message
      });
    }
    
    if (!columnExists) {
      console.log('created_at column does not exist, adding it...');
      
      // Execute raw SQL to add the missing column with default value
      const { error: alterError } = await supabase.rpc('execute_sql', {
        sql: `
          ALTER TABLE public.user_stitch_progress 
          ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        `
      });
      
      if (alterError) {
        console.error('Error adding created_at column:', alterError);
        
        // If the RPC method doesn't exist, try direct SQL (less secure but may work)
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              query: `
                ALTER TABLE public.user_stitch_progress 
                ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
              `
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to execute SQL: ${JSON.stringify(errorData)}`);
          }
          
          return res.status(200).json({
            success: true,
            message: 'Added created_at column to user_stitch_progress table',
            method: 'direct SQL'
          });
        } catch (directError) {
          console.error('Error executing direct SQL:', directError);
          return res.status(500).json({
            success: false,
            message: 'Failed to add created_at column via direct SQL',
            error: String(directError)
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Added created_at column to user_stitch_progress table'
      });
    }
    
    // Step 2: Check if tube_number column exists in threads table
    const { data: threadsColumnExists, error: threadsColumnError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'threads')
      .eq('column_name', 'tube_number')
      .single();
    
    if (threadsColumnError && threadsColumnError.code !== 'PGRST116') { // PGRST116 is "Results contain 0 rows"
      console.error('Error checking if threads.tube_number column exists:', threadsColumnError);
      return res.status(500).json({
        success: false,
        message: 'Failed to check if tube_number column exists',
        error: threadsColumnError.message
      });
    }
    
    if (!threadsColumnExists) {
      console.log('tube_number column does not exist in threads table, adding it...');
      
      // Execute raw SQL to add the tube_number column
      const { error: alterThreadsError } = await supabase.rpc('execute_sql', {
        sql: `
          -- Add tube_number column to threads table
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
        `
      });
      
      if (alterThreadsError) {
        console.error('Error adding tube_number column:', alterThreadsError);
        
        // If the RPC method doesn't exist, try direct SQL (less secure but may work)
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              query: `
                -- Add tube_number column to threads table
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
              `
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to execute SQL: ${JSON.stringify(errorData)}`);
          }
          
          return res.status(200).json({
            success: true,
            message: 'Added tube_number column to threads table and assigned values',
            method: 'direct SQL'
          });
        } catch (directError) {
          console.error('Error executing direct SQL:', directError);
          return res.status(500).json({
            success: false,
            message: 'Failed to add tube_number column via direct SQL',
            error: String(directError)
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Added tube_number column to threads table and assigned values'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Schema is already correct, no changes needed'
    });
    
  } catch (err) {
    console.error('Unexpected error fixing schema:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err instanceof Error ? err.message : String(err)
    });
  }
}