import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Check User Data API endpoint
 * 
 * This diagnostic endpoint checks all tables for data related to a specific user.
 * It helps verify that data is being properly saved to all relevant tables.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Get user ID from query or body
    const userId = req.method === 'GET' 
      ? req.query.userId as string 
      : req.body.userId as string;
      
    // Use hardcoded ID if none provided
    const effectiveUserId = userId || 'e45b377a-9d72-4b6b-9b9e-ee8efb26b916';
    
    if (!effectiveUserId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required (provide in query or body)' 
      });
    }

    console.log(`Checking data for user: ${effectiveUserId}`);

    // Create a direct admin client for cases where RLS is too restrictive
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylxga.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.3bvfZGkTc9nVtf1I7A0TwYy9pMFudJTrp974RZIwrq0'
    );

    // Results object to collect all data
    const results: any = {
      userId: effectiveUserId,
      timestamp: new Date().toISOString(),
      tables: {}
    };

    // 1. Check session_results table
    try {
      const { data: sessionResults, error: sessionError } = await supabaseAdmin
        .from('session_results')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('completed_at', { ascending: false });
        
      results.tables.session_results = {
        exists: !sessionError,
        error: sessionError ? sessionError.message : null,
        count: sessionResults ? sessionResults.length : 0,
        records: sessionResults ? sessionResults.slice(0, 5) : [] // Show up to 5 most recent records
      };
    } catch (error) {
      results.tables.session_results = {
        exists: false,
        error: error instanceof Error ? error.message : String(error),
        count: 0,
        records: []
      };
    }

    // 2. Check user_stitch_progress table
    try {
      const { data: progressData, error: progressError } = await supabaseAdmin
        .from('user_stitch_progress')
        .select('*')
        .eq('user_id', effectiveUserId);
        
      results.tables.user_stitch_progress = {
        exists: !progressError,
        error: progressError ? progressError.message : null,
        count: progressData ? progressData.length : 0,
        records: progressData ? progressData.slice(0, 10) : [] // Show up to 10 progress records
      };
    } catch (error) {
      results.tables.user_stitch_progress = {
        exists: false,
        error: error instanceof Error ? error.message : String(error),
        count: 0,
        records: []
      };
    }

    // 3. Check profiles table
    try {
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', effectiveUserId);
        
      results.tables.profiles = {
        exists: !profileError,
        error: profileError ? profileError.message : null,
        count: profileData ? profileData.length : 0,
        records: profileData || [] // Show the full profile
      };
    } catch (error) {
      results.tables.profiles = {
        exists: false,
        error: error instanceof Error ? error.message : String(error),
        count: 0,
        records: []
      };
    }

    // 4. Check for any other tables that might exist (based on tables we know about)
    try {
      // Try to check for a user_tube_position table (shouldn't exist, but let's verify)
      const { data: tubeData, error: tubeError } = await supabaseAdmin
        .from('user_tube_position')
        .select('*')
        .eq('user_id', effectiveUserId);
        
      results.tables.user_tube_position = {
        exists: !tubeError,
        error: tubeError ? tubeError.message : null,
        count: tubeData ? tubeData.length : 0,
        records: tubeData || []
      };
    } catch (error) {
      results.tables.user_tube_position = {
        exists: false,
        error: error instanceof Error ? error.message : String(error),
        count: 0,
        records: []
      };
    }

    // Check for a sessions table (shouldn't exist, but let's verify)
    try {
      const { data: sessionsData, error: sessionsError } = await supabaseAdmin
        .from('sessions')
        .select('*')
        .eq('user_id', effectiveUserId);
        
      results.tables.sessions = {
        exists: !sessionsError,
        error: sessionsError ? sessionsError.message : null,
        count: sessionsData ? sessionsData.length : 0,
        records: sessionsData || []
      };
    } catch (error) {
      results.tables.sessions = {
        exists: false,
        error: error instanceof Error ? error.message : String(error),
        count: 0,
        records: []
      };
    }

    // Return all collected results
    return res.status(200).json({
      success: true,
      message: `Data check complete for user ${effectiveUserId}`,
      results
    });
  } catch (error) {
    console.error('API: Error in check-user-data:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check user data',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}