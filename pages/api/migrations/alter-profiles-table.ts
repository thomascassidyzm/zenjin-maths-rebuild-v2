/**
 * Migration API: Alter profiles table to add has_password column
 * 
 * Adds the has_password column to the profiles table if it doesn't exist
 * This column is used to track whether users have set a password
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { logApiInfo, logApiError } from '../../../lib/api/logging';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  // Admin key is required for security
  const adminKey = req.headers['x-admin-key'] as string;
  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: Admin key required' 
    });
  }

  try {
    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // SQL to add has_password column if it doesn't exist
    const sql = `
    DO $$
    BEGIN
      -- Check if the column already exists
      IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'has_password'
      ) THEN
        -- Add the has_password column with a default of false
        ALTER TABLE profiles 
        ADD COLUMN has_password BOOLEAN DEFAULT false;
        
        -- Set has_password to true for existing users who likely have passwords
        UPDATE profiles 
        SET has_password = true 
        WHERE auth.users.id = profiles.id 
        AND auth.users.created_at < NOW() - INTERVAL '1 day';
      END IF;
    END $$;

    -- Return the column info to confirm it exists
    SELECT column_name, data_type, column_default
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'has_password';
    `;

    // Execute SQL directly
    const { data, error } = await supabaseAdmin.rpc('execute_sql', { sql_query: sql });

    if (error) {
      logApiError('Migration: has_password column', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message
      });
    }

    // Log the migration
    logApiInfo('Migration', 'Added has_password column to profiles table', null, {
      columnInfo: data
    });

    // Return success with data
    return res.status(200).json({
      success: true,
      operation: 'add-has-password-column',
      result: data
    });

  } catch (error: any) {
    logApiError('Migration: has_password column', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error executing migration'
    });
  }
}