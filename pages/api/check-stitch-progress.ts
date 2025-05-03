import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Check Stitch Progress API endpoint
 * 
 * This endpoint checks the structure of the user_stitch_progress table
 * by attempting to create a test record and then displaying its structure.
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

    // First, check if there are any existing records
    const { data: existingRecords, error: existingError } = await supabaseAdmin
      .from('user_stitch_progress')
      .select('*')
      .limit(1);

    // If we have records, return the structure
    if (!existingError && existingRecords && existingRecords.length > 0) {
      // Return the existing record structure
      return res.status(200).json({
        success: true,
        message: 'Found existing user_stitch_progress record',
        structure: {
          fields: Object.keys(existingRecords[0]),
          sample: existingRecords[0]
        }
      });
    }

    // Try to create a test record to understand the structure
    // Use values we know should work based on the threads/stitches tables
    const testRecord = {
      user_id: 'test-user-id',
      thread_id: 'thread-T1-001',
      stitch_id: 'stitch-T1-001-01',
      order_number: 0,
      skip_number: 3,
      distractor_level: 'L1',
      updated_at: new Date().toISOString()
    };

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('user_stitch_progress')
      .insert(testRecord)
      .select();

    if (insertError) {
      // If insert fails, try with a minimal record
      const minimalRecord = {
        user_id: 'test-user-id',
        thread_id: 'thread-T1-001',
        stitch_id: 'stitch-T1-001-01'
      };

      const { data: minimalData, error: minimalError } = await supabaseAdmin
        .from('user_stitch_progress')
        .insert(minimalRecord)
        .select();

      if (minimalError) {
        // Try to get table information directly
        try {
          const { data: tableInfo, error: tableError } = await supabaseAdmin
            .rpc('execute_sql', {
              sql: `
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'user_stitch_progress'
              `
            });

          return res.status(200).json({
            success: false,
            message: 'Could not create record, but retrieved schema information',
            insertError: insertError.message,
            minimalError: minimalError.message,
            schemaInfo: tableInfo || [],
            schemaError: tableError ? tableError.message : null
          });
        } catch (schemaError) {
          return res.status(500).json({
            success: false,
            message: 'Could not create record or get schema information',
            insertError: insertError.message,
            minimalError: minimalError.message,
            schemaError: schemaError instanceof Error ? schemaError.message : String(schemaError)
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Created minimal test record',
        structure: {
          fields: minimalData && minimalData.length > 0 ? Object.keys(minimalData[0]) : [],
          sample: minimalData && minimalData.length > 0 ? minimalData[0] : null,
          error: insertError.message
        }
      });
    }

    // Clean up the test record
    await supabaseAdmin
      .from('user_stitch_progress')
      .delete()
      .eq('user_id', 'test-user-id');

    return res.status(200).json({
      success: true,
      message: 'Created and deleted test record',
      structure: {
        fields: insertData && insertData.length > 0 ? Object.keys(insertData[0]) : [],
        sample: insertData && insertData.length > 0 ? insertData[0] : null
      }
    });
  } catch (error) {
    console.error('API: Error in check-stitch-progress:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check stitch progress table',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}