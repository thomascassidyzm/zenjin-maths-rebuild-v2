import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Debug Session API endpoint
 * 
 * This diagnostic endpoint helps test the session_results table by
 * attempting to insert a record with different combinations of fields.
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

    // Generate a unique session ID
    const sessionId = `debug-session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Extract fields to test from request or use defaults
    const {
      userId = 'debug-user-id',
      threadId = 'thread-T1-001',
      stitchId = 'stitch-T1-001-01',
      includeResults = true,
      includeTotalPoints = true,
      includeAccuracy = true,
      includeCompletedAt = true,
      
      // Additional optional fields
      includeContentId = false,
      includeDuration = false,
    } = req.body;

    // Base payload that should always work
    const basePayload = {
      id: sessionId,
      user_id: userId,
      thread_id: threadId,
      stitch_id: stitchId
    };

    // Add optional fields based on flags
    const fullPayload = {
      ...basePayload,
      ...(includeResults ? { results: [] } : {}),
      ...(includeTotalPoints ? { total_points: 0 } : {}),
      ...(includeAccuracy ? { accuracy: 0 } : {}),
      ...(includeCompletedAt ? { completed_at: new Date().toISOString() } : {}),
      
      // Additional optional fields
      ...(includeContentId ? { content_id: threadId } : {}),
      ...(includeDuration ? { duration: 60 } : {})
    };

    console.log('Attempting session_results insert with payload:', fullPayload);

    // Try the insert with the full payload
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('session_results')
      .insert(fullPayload)
      .select();

    // If successful, clean up the test record
    if (!insertError && insertData) {
      await supabaseAdmin
        .from('session_results')
        .delete()
        .eq('id', sessionId);
    }

    // Return results
    return res.status(200).json({
      success: !insertError,
      message: insertError ? 'Error inserting session record' : 'Successfully inserted and removed test record',
      payload: fullPayload,
      data: insertData,
      error: insertError ? {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details
      } : null
    });
  } catch (error) {
    console.error('API: Error in debug-session:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to execute debug session',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}