import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Check Table Fields API endpoint
 * 
 * This simplified diagnostic endpoint checks the fields of important tables
 * by querying a sample record and examining its structure.
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
    const tableFields: Record<string, any> = {};

    // Check each table's fields by examining a sample record
    for (const tableName of tablesToCheck) {
      try {
        // Try to get a sample record
        const { data: sampleData, error: sampleError } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .limit(1);

        // Get count of records
        const { count, error: countError } = await supabaseAdmin
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (sampleError) {
          tableFields[tableName] = {
            exists: false,
            error: sampleError.message,
            count: 0,
            fields: [],
            sample: null
          };
        } else {
          tableFields[tableName] = {
            exists: true,
            count: countError ? 0 : count,
            fields: sampleData && sampleData.length > 0 
              ? Object.keys(sampleData[0]).map(key => ({
                  name: key,
                  type: typeof sampleData[0][key],
                  isArray: Array.isArray(sampleData[0][key]),
                  isObject: !Array.isArray(sampleData[0][key]) && 
                           typeof sampleData[0][key] === 'object' && 
                           sampleData[0][key] !== null,
                  sample: sampleData[0][key]
                }))
              : [],
            sample: sampleData && sampleData.length > 0 ? sampleData[0] : null
          };
        }
      } catch (error) {
        console.error(`Error checking table ${tableName}:`, error);
        tableFields[tableName] = {
          exists: false,
          error: error instanceof Error ? error.message : String(error),
          count: 0,
          fields: [],
          sample: null
        };
      }
    }

    // Return the combined results
    return res.status(200).json({
      success: true,
      message: 'Table fields check completed',
      tables: tableFields
    });
  } catch (error) {
    console.error('API: Error in check-table-fields:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check table fields',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}