import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * API endpoint for executing SQL maintenance scripts securely.
 * IMPORTANT: This endpoint should only be accessible to authenticated admin users.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
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

    // Get SQL to execute
    const { sql, operation } = req.body;
    
    if (!sql) {
      return res.status(400).json({ 
        success: false, 
        error: 'SQL query is required' 
      });
    }

    console.log(`Executing SQL operation: ${operation || 'custom query'}`);
    
    // Execute SQL directly
    const { data, error } = await supabaseAdmin.rpc('execute_sql', { sql_query: sql });

    if (error) {
      console.error('SQL execution error:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message
      });
    }

    // Return success with data
    return res.status(200).json({
      success: true,
      operation: operation || 'custom query',
      result: data
    });

  } catch (error) {
    console.error('Error executing SQL:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error executing SQL'
    });
  }
}