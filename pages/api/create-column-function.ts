import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Create Column Function API endpoint
 * 
 * This creates a helper function in the database to query column information.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Create a direct admin client for cases where RLS is too restrictive
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylxga.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.3bvfZGkTc9nVtf1I7A0TwYy9pMFudJTrp974RZIwrq0'
    );

    // Try direct SQL approach for creating the function
    const { data, error } = await supabaseAdmin
      .rpc('execute_sql', {
        sql: `
          CREATE OR REPLACE FUNCTION public.get_table_columns(table_name text)
          RETURNS TABLE(column_name text, data_type text, is_nullable text) AS $$
          BEGIN
            RETURN QUERY
            SELECT c.column_name::text, c.data_type::text, c.is_nullable::text
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
            AND c.table_name = table_name;
          END;
          $$ LANGUAGE plpgsql;
        `
      });

    if (error) {
      // Try alternative approach with simpler RPC
      try {
        const { data: altData, error: altError } = await supabaseAdmin.rpc('run_sql', {
          sql: `
            CREATE OR REPLACE FUNCTION public.get_table_columns(table_name text)
            RETURNS TABLE(column_name text, data_type text, is_nullable text) AS $$
            BEGIN
              RETURN QUERY
              SELECT c.column_name::text, c.data_type::text, c.is_nullable::text
              FROM information_schema.columns c
              WHERE c.table_schema = 'public'
              AND c.table_name = table_name;
            END;
            $$ LANGUAGE plpgsql;
          `
        });

        if (altError) {
          return res.status(500).json({
            success: false,
            message: 'Could not create function using both methods',
            error: error.message,
            altError: altError.message
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Function created using alternative method',
        });
      } catch (e) {
        return res.status(500).json({
          success: false,
          message: 'Could not create function using both methods',
          error: error.message,
          exception: e instanceof Error ? e.message : String(e)
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Helper function created successfully'
    });
  } catch (error) {
    console.error('API: Error creating helper function:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create helper function',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}