import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Check Session Results API endpoint
 * 
 * This endpoint checks the structure of the session_results table
 * and retrieves a sample record to understand its fields.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Create a direct admin client for cases where RLS is too restrictive
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylxga.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.3bvfZGkTc9nVtf1I7A0TwYy9pMFudJTrp974RZIwrq0'
    );

    // Get table information
    const { data: tableInfo, count, error: countError } = await supabaseAdmin
      .from('session_results')
      .select('*', { count: 'exact' })
      .limit(1);

    if (countError) {
      return res.status(500).json({
        success: false,
        message: 'Error accessing session_results table',
        error: countError.message
      });
    }

    // Get a few sample records
    const { data: sampleRecords, error: sampleError } = await supabaseAdmin
      .from('session_results')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);

    // Try to insert a test record to verify writable fields
    const testSessionId = `test-session-${Date.now()}`;
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('session_results')
      .insert({
        id: testSessionId,
        user_id: 'test-user-id',
        thread_id: 'thread-T1-001',
        stitch_id: 'stitch-T1-001-01',
        results: [],
        total_points: 0,
        accuracy: 0,
        completed_at: new Date().toISOString()
      })
      .select();

    // If successful, clean up the test record
    if (!insertError && insertData) {
      await supabaseAdmin
        .from('session_results')
        .delete()
        .eq('id', testSessionId);
    }

    // Did our insert work? If not, try with different fields
    let alternativeInsert = null;
    let alternativeError = null;

    if (insertError) {
      const { data: altData, error: altError } = await supabaseAdmin
        .from('session_results')
        .insert({
          id: `alt-${testSessionId}`,
          user_id: 'test-user-id',
          thread_id: 'thread-T1-001',
          stitch_id: 'stitch-T1-001-01',
          // Try with minimal fields
        })
        .select();

      alternativeInsert = altData;
      alternativeError = altError;

      // Clean up if successful
      if (!altError && altData) {
        await supabaseAdmin
          .from('session_results')
          .delete()
          .eq('id', `alt-${testSessionId}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Session results table structure check completed',
      table: {
        name: 'session_results',
        recordCount: count,
        fields: tableInfo && tableInfo.length > 0 ? Object.keys(tableInfo[0]) : [],
        sample: tableInfo && tableInfo.length > 0 ? tableInfo[0] : null,
        insertTest: {
          success: !insertError,
          error: insertError ? insertError.message : null,
          data: insertData
        },
        alternativeInsert: {
          success: !alternativeError,
          error: alternativeError ? alternativeError.message : null,
          data: alternativeInsert
        },
        sampleRecords: sampleRecords || []
      }
    });
  } catch (error) {
    console.error('API: Error in check-session-results:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check session results table',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}