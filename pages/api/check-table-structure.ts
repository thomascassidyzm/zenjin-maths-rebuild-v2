import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Check Table Structure API endpoint
 * 
 * This diagnostic endpoint returns detailed information about table structures
 * in the database, focusing on the tables we need for our core functionality.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Create a direct admin client for cases where RLS is too restrictive
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylxga.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.3bvfZGkTc9nVtf1I7A0TwYy9pMFudJTrp974RZIwrq0'
    );

    // Tables we want to check in detail
    const tablesToCheck = [
      'session_results',
      'user_stitch_progress',
      'threads',
      'stitches',
      'questions',
      'profiles' // Check if this exists
    ];

    // Store results for each table
    const tableStructures: Record<string, any> = {};

    // Function to check a table's structure
    async function checkTableStructure(tableName: string) {
      try {
        // First try to get a sample record to check the structure
        const { data: sampleData, error: sampleError } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .limit(1);

        let sampleRecord = null;
        let exists = !sampleError;
        
        if (exists && sampleData && sampleData.length > 0) {
          sampleRecord = sampleData[0];
        }

        // Try to get column information from Postgres information schema
        // This may fail if we don't have permission
        const { data: columnData, error: columnError } = await supabaseAdmin
          .rpc('get_table_columns', { table_name: tableName });

        let columnInfo = columnData || [];

        // If RPC didn't work, try with a direct SQL query (may also fail)
        if (columnError || !columnData) {
          try {
            const { data: directColumns, error: directError } = await supabaseAdmin
              .from('information_schema.columns')
              .select('column_name, data_type, is_nullable')
              .eq('table_schema', 'public')
              .eq('table_name', tableName);
              
            if (!directError && directColumns) {
              columnInfo = directColumns;
            }
          } catch (directQueryError) {
            console.error(`Direct query error for ${tableName}:`, directQueryError);
          }
        }

        // Get record count for the table
        const { count, error: countError } = await supabaseAdmin
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        // Combine all the information
        return {
          exists,
          error: sampleError ? sampleError.message : null,
          columnInfo,
          count: countError ? null : count,
          sampleRecord,
          // For tables with known structure, infer the fields even if we can't get schema info
          inferred_structure: sampleRecord 
            ? Object.keys(sampleRecord).map(key => ({
                column_name: key,
                data_type: Array.isArray(sampleRecord[key]) 
                  ? 'array' 
                  : typeof sampleRecord[key] === 'object' && sampleRecord[key] !== null
                    ? 'json/jsonb'
                    : typeof sampleRecord[key]
              }))
            : []
        };
      } catch (error) {
        console.error(`Error checking ${tableName}:`, error);
        return {
          exists: false,
          error: error instanceof Error ? error.message : String(error),
          columnInfo: [],
          count: null,
          sampleRecord: null,
          inferred_structure: []
        };
      }
    }

    // Create stored procedure for getting table columns if it doesn't exist
    try {
      await supabaseAdmin.rpc('create_column_function', {
        function_sql: `
          CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
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
    } catch (rpcError) {
      console.log('Note: Could not create helper function - continuing anyway');
    }

    // Check each table
    for (const tableName of tablesToCheck) {
      tableStructures[tableName] = await checkTableStructure(tableName);
    }

    // Return combined results
    return res.status(200).json({
      success: true,
      message: 'Table structure check completed',
      tables: tableStructures
    });
  } catch (error) {
    console.error('API: Error in check-table-structure:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check table structures',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}