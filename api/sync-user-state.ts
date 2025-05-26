import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

// Initialize Supabase client
// Ensure environment variables are set for SUPABASE_URL and SUPABASE_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface StitchProgress {
  thread_id: string;
  stitch_id: string;
  order_number: number;
  skip_number: number;
  distractor_level: string;
}

interface Tube {
  tube_id: string; // Or number, depending on your data model
  stitches: StitchProgress[];
}

interface TubeState {
  tubes: Tube[];
  activeTube?: string; // Or number
  // ... other tube-related state
}

interface UserInformation {
  // ... user profile, settings, etc.
  [key: string]: any;
}

interface LearningProgress {
  // ... learning metrics, achievements, etc.
  [key: string]: any;
}

interface UserState {
  userInformation: UserInformation;
  tubeState: TubeState;
  learningProgress: LearningProgress;
  // ... other major state sections
  [key: string]: any;
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  // Get user from Supabase Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));

  if (authError || !user) {
    console.error('Authentication error:', authError);
    return res.status(401).json({ error: 'Authentication failed', details: authError?.message });
  }

  const userId = user.id;

  switch (method) {
    case 'POST':
      // Save user state
      try {
        const statePayload: UserState = req.body;

        // Basic payload validation
        if (!statePayload || typeof statePayload !== 'object' || !statePayload.tubeState || !statePayload.userInformation) {
          console.error('Invalid payload structure:', statePayload);
          return res.status(400).json({ error: 'Invalid payload structure' });
        }

        const { data, error } = await supabase.rpc('save_user_state_atomic', {
          user_id_input: userId,
          state_payload: statePayload,
        });

        if (error) {
          console.error('Error saving user state (RPC):', error);
          return res.status(500).json({ error: 'Failed to save user state', details: error.message });
        }

        return res.status(200).json({ success: true, data });
      } catch (e: any) {
        console.error('Error in POST /api/sync-user-state:', e);
        return res.status(500).json({ error: 'Internal server error', details: e.message });
      }

    case 'GET':
      // Load user state
      try {
        const { data, error } = await supabase.rpc('get_user_state_comprehensive', {
          user_id_input: userId,
        });

        if (error) {
          console.error('Error loading user state (RPC):', error);
          return res.status(500).json({ error: 'Failed to load user state', details: error.message });
        }

        if (!data) {
            // It's possible a new user doesn't have state yet.
            // Return a default or empty state structure.
            console.log(`No state found for user ${userId}, returning default initial state.`);
            const initialUserState: UserState = {
                userInformation: {},
                tubeState: { tubes: [] },
                learningProgress: {},
                // Initialize other parts of the state as needed
            };
            return res.status(200).json(initialUserState);
        }

        return res.status(200).json(data);
      } catch (e: any) {
        console.error('Error in GET /api/sync-user-state:', e);
        return res.status(500).json({ error: 'Internal server error', details: e.message });
      }

    default:
      res.setHeader('Allow', ['POST', 'GET']);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}
