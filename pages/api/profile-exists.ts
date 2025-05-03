import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Profile Exists API endpoint
 * 
 * This endpoint checks if the profiles table exists
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

    // Check profiles table
    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .limit(1);
      
    const hasProfiles = !profilesError;
    console.log('profiles table exists:', hasProfiles);
    
    if (profilesError) {
      console.log('profiles error:', profilesError.message);
    }

    return res.status(200).json({
      success: !profilesError,
      hasProfiles,
      error: profilesError ? profilesError.message : null,
      sample: profilesData && profilesData.length > 0 ? profilesData[0] : null
    });
  } catch (error) {
    console.error('API: Error checking profiles table:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check profiles table',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}