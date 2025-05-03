import { NextApiRequest, NextApiResponse } from 'next';
import { createAdminClient } from '../../lib/supabase/route';

/**
 * API endpoint to create the user_state table if it doesn't exist
 * This provides a web-accessible way to initialize the required DB structure
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST to create the table.' 
    });
  }
  
  try {
    // Always use admin client for database structure operations
    // This is appropriate for table creation which requires elevated privileges
    const supabase = createAdminClient();
    
    console.log('Using admin client to ensure we can create tables and bypass RLS');
    
    console.log('Creating user_state table...');
    
    // Direct table creation approach - simpler and more reliable
    try {
      // Create table using raw SQL
      const { error } = await supabase.from('user_state').insert({
        // This is a dummy insert that will fail, but it will create the table if it doesn't exist
        user_id: '00000000-0000-0000-0000-000000000000',
        state: {},
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString()
      }).select();
      
      if (error) {
        console.error('Error inserting dummy record:', error);
        
        // If table doesn't exist, create it
        if (error.code === '42P01') {
          console.log('Table does not exist, creating it...');
          
          // Create the table without id column since it doesn't exist in the schema
          const createTableResult = await supabase.query(`
            CREATE TABLE IF NOT EXISTS public.user_state (
              user_id TEXT NOT NULL,
              state JSONB NOT NULL,
              last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              PRIMARY KEY (user_id, last_updated)
            );
            
            -- Create index for efficient queries by user
            CREATE INDEX IF NOT EXISTS idx_user_state_user_id ON user_state(user_id);
          `);
          
          console.log('Table creation result:', createTableResult);
          
          // Try to add RLS policies
          try {
            const rlsResult = await supabase.query(`
              -- Add RLS policies if table exists
              ALTER TABLE user_state ENABLE ROW LEVEL SECURITY;
              
              -- Users can only access their own state (handle text type for user_id)
              CREATE POLICY IF NOT EXISTS user_state_select_policy ON user_state 
                FOR SELECT USING (auth.uid()::text = user_id);
                
              CREATE POLICY IF NOT EXISTS user_state_insert_policy ON user_state 
                FOR INSERT WITH CHECK (auth.uid()::text = user_id);
                
              CREATE POLICY IF NOT EXISTS user_state_update_policy ON user_state 
                FOR UPDATE USING (auth.uid()::text = user_id);
            `);
            
            console.log('RLS policy creation result:', rlsResult);
          } catch (rlsError) {
            console.error('Error adding RLS policies:', rlsError);
          }
        }
      }
      
      // Verify the table exists now with correct schema
      console.log('Verifying the table exists with correct schema...');
      const { error: checkError } = await supabase.from('user_state').select('user_id,last_updated').limit(1);
      
      if (checkError) {
        console.error('Table verification error:', checkError);
      } else {
        console.log('Table verification successful');
      }
      
      if (checkError) {
        return res.status(500).json({
          success: false,
          error: 'Failed to verify table creation: ' + checkError.message
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'user_state table created or verified successfully'
      });
    } catch (error) {
      console.error('Error creating table:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Failed to create table: ' + (error as Error).message
      });
    }
  } catch (error) {
    console.error('Unexpected error in handler:', error);
    
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred'
    });
  }
}