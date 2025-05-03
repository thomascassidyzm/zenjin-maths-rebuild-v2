import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';
import { createRouteHandlerClient } from '../../lib/supabase/route';

/**
 * API endpoint to get user profile data
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('User Profile API: Starting request');
    console.log('User Profile API: Cookies:', req.cookies);
    
    // Create a Supabase client with proper auth context
    const supabaseClient = createRouteHandlerClient(req, res);
    const session = await supabaseClient.auth.getSession();
    
    console.log('User Profile API: Session present:', !!session?.data?.session);
    
    // If no authenticated session, return default profile instead of error
    if (!session || !session.data.session) {
      console.error('No authenticated session found in user-profile API');
      return res.status(200).json({ 
        displayName: 'Guest User' 
      });
    }

    const userId = session.data.session.user.id;
    console.log(`User Profile API: Fetching profile for user ${userId}`);

    try {
      // Fetch user profile
      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('User Profile API: Error fetching profile:', error);
        
        // If profile doesn't exist yet, create a default one
        if (error.code === 'PGRST116') {
          console.log('User Profile API: Profile not found, creating default');
          
          try {
            // Create default profile
            const { error: createError } = await supabaseClient
              .from('profiles')
              .upsert({
                id: userId,
                display_name: 'Learner',
                total_points: 50,
                avg_blink_speed: 2.5,
                evolution_level: 1,
                total_sessions: 1,
                last_session_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
              
            if (createError) {
              console.error('User Profile API: Error creating default profile:', createError);
            } else {
              console.log('User Profile API: Created default profile successfully');
            }
          } catch (createError) {
            console.error('User Profile API: Exception creating profile:', createError);
          }
          
          return res.status(200).json({ 
            displayName: 'Learner'
          });
        }
        
        // Return a default display name on error
        return res.status(200).json({ 
          displayName: 'User'
        });
      }

      // Return profile data
      return res.status(200).json({
        displayName: profile?.display_name || 'Learner'
      });
    } catch (profileError) {
      console.error('User Profile API: Exception fetching profile:', profileError);
      return res.status(200).json({ 
        displayName: 'Learner' 
      });
    }
  } catch (error) {
    console.error('User Profile API: Fatal error:', error);
    return res.status(200).json({ 
      displayName: 'Guest' 
    });
  }
}