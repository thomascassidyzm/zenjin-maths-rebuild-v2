import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { 
  FREE_TIER_THREAD_IDS, 
  FREE_TIER_STITCH_LIMIT 
} from '../../lib/constants/free-tier';
import { UserTier } from '../../lib/tier-manager';

/**
 * API endpoint to initialize user data with default values
 * Sets up a fresh user with the first available thread in Tube 1
 * and initializes tier-specific data
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    // Get userId and tier from request body or query
    let userId = req.body.userId || req.query.userId;
    let tier: UserTier = req.body.tier || req.query.tier || 'free'; // Default to free tier
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    console.log(`Initializing user ${userId} with tier: ${tier}`);

    // Create admin Supabase client with service role for direct access
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // First, ensure the user has a profile with tier information
    try {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          tier,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (profileError) {
        console.warn('Error creating or updating user profile:', profileError);
        // Continue anyway as this is not critical
      } else {
        console.log(`User profile updated with tier: ${tier}`);
      }
    } catch (profileError) {
      console.error('Exception updating user profile:', profileError);
      // Continue anyway
    }

    // Clean up any existing tube positions for this user
    // This ensures a fresh start
    const { error: deleteError } = await supabaseAdmin
      .from('user_tube_position')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.warn('Error deleting existing tube positions:', deleteError);
      // Continue anyway as this is just cleanup
    }

    // Get appropriate threads based on user tier
    let availableThreads = [];
    
    // For now, all authenticated users get access to all free tier threads
    if (tier === 'anonymous') {
      // Anonymous users get free tier threads (this is mostly for testing)
      availableThreads = FREE_TIER_THREAD_IDS;
    } else {
      // Free and paid users get all free tier threads
      availableThreads = FREE_TIER_THREAD_IDS;
    }

    console.log(`Available threads for ${tier} tier:`, availableThreads);

    // If no available threads for this tier, return error
    if (availableThreads.length === 0) {
      return res.status(500).json({
        success: false,
        error: `No threads available for tier: ${tier}`
      });
    }

    // Find the first thread to use (prioritize 'thread-A' if available)
    const defaultThreadId = availableThreads.includes('thread-A') 
      ? 'thread-A' 
      : availableThreads[0];

    // Set up default tube position with the found thread
    const { data, error } = await supabaseAdmin
      .from('user_tube_position')
      .upsert({
        user_id: userId,
        tube_number: 1,
        thread_id: defaultThreadId,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error setting default tube position:', error);
      return res.status(500).json({
        success: false,
        error: `Error setting default tube position: ${error.message}`
      });
    }

    // Return success with the created position and tier info
    return res.status(200).json({
      success: true,
      message: `User data initialized with Tube-1/${defaultThreadId} as default position`,
      tier,
      availableThreads,
      data: {
        tubeNumber: 1,
        threadId: defaultThreadId
      }
    });
  } catch (error) {
    console.error('Error in initialize-user-data API:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Server error initializing user data'
    });
  }
}