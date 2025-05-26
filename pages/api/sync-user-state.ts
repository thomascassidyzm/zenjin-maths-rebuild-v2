import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import type { NextApiRequest, NextApiResponse } from 'next';
// Assuming Database interface might be in a central place like 'lib/database.types.ts'
// If it's not yet created, this import might cause issues later, but the type helps with RPC calls.
// For now, we'll assume it might exist or will be created. If not, Supabase types RPC calls as 'any'.
import type { Database } from '@/lib/database.types'; 

// Define the expected structure of the state payload
// These interfaces should ideally be shared with the frontend (e.g., in a 'types' or 'interfaces' directory)
interface StitchProgress {
  thread_id: string;
  stitch_id: string;
  order_number: number;
  skip_number: number;
  distractor_level: string;
}

interface Tube {
  tube_id: string;
  stitches: StitchProgress[];
  // other tube-specific fields that are part of the state but not in user_stitch_progress
  [key: string]: any;
}

interface TubeState {
  tubes: Tube[];
  activeTube?: string | null; // Changed from string | undefined to allow null
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

// This UserState interface should align with the structure managed by the Zustand store on the client
export interface UserState {
  userInformation: UserInformation;
  tubeState: TubeState;
  learningProgress: LearningProgress;
  // ... other major state sections
  [key: string]: any;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  // Create a Supabase client for server-side operations in Pages API routes.
  // The <Database> generic type argument enables typed RPC calls if '@/lib/database.types.ts' exists and is correct.
  const supabase = createPagesServerClient<Database>({ req, res });

  // Get user session to identify the user.
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('Supabase session error:', sessionError.message);
    return res.status(500).json({ error: 'Server error while fetching session', details: sessionError.message });
  }

  if (!session || !session.user) {
    console.warn('No active session or user found. Client should handle redirection to login.');
    return res.status(401).json({ error: 'Authentication required: No active session' });
  }

  const user = session.user;
  const userId = user.id;
  // Logging the request method and user ID for audit/debugging.
  console.log(`[${method}] /api/sync-user-state called by user: ${userId}`);

  switch (method) {
    case 'POST':
      try {
        const statePayload: UserState = req.body;

        // Basic payload validation: Check if it's an object.
        if (!statePayload || typeof statePayload !== 'object') {
          console.error(`User ${userId}: Invalid payload structure - not an object. Received:`, statePayload);
          return res.status(400).json({ error: 'Invalid payload: Expected an object.' });
        }
        // More specific structural checks for essential parts of the state.
        if (!statePayload.tubeState || !statePayload.userInformation || !statePayload.learningProgress) {
            console.error(`User ${userId}: Invalid payload - missing one or more core state properties (tubeState, userInformation, learningProgress). Received:`, statePayload);
            return res.status(400).json({ error: 'Invalid payload: Missing core state properties.' });
        }

        console.log(`User ${userId}: Attempting to save state via RPC 'save_user_state_atomic'.`);
        // Call the Supabase database function 'save_user_state_atomic'.
        // The user_id_input is passed explicitly to the RPC function.
        const { data, error: rpcError } = await supabase.rpc('save_user_state_atomic', {
          user_id_input: userId, // Ensure the RPC function uses this for operations
          state_payload: statePayload,
        });

        if (rpcError) {
          console.error(`User ${userId}: Error calling save_user_state_atomic RPC:`, rpcError);
          // Provide a generic error message to the client, log detailed error on server.
          return res.status(500).json({ error: 'Failed to save user state', details: rpcError.message });
        }

        console.log(`User ${userId}: State saved successfully via RPC. Response:`, data);
        return res.status(200).json({ success: true, data }); // 'data' here is the response from the RPC
      } catch (e: any) {
        console.error(`User ${userId}: Unexpected error in POST /api/sync-user-state:`, e);
        return res.status(500).json({ error: 'Internal server error', details: e.message });
      }

    case 'GET':
      try {
        console.log(`User ${userId}: Attempting to load state via RPC 'get_user_state_comprehensive'.`);
        // Call the Supabase database function 'get_user_state_comprehensive'.
        // The user_id_input is passed explicitly to the RPC function.
        const { data, error: rpcError } = await supabase.rpc('get_user_state_comprehensive', {
          user_id_input: userId, // Ensure the RPC function uses this for fetching data
        });

        if (rpcError) {
          console.error(`User ${userId}: Error calling get_user_state_comprehensive RPC:`, rpcError);
          return res.status(500).json({ error: 'Failed to load user state', details: rpcError.message });
        }

        // The 'get_user_state_comprehensive' SQL function is designed to return a default initial state
        // if no state is found for the user, so 'data' should ideally always be present.
        if (!data) {
            // This case implies the SQL function might not have returned the expected default.
            console.warn(`User ${userId}: No state data returned from get_user_state_comprehensive RPC, even a default was expected. Returning a minimal fallback.`);
            // Constructing a minimal default here as a safety fallback.
            const minimalDefaultState: UserState = {
                userInformation: {},
                tubeState: { tubes: [], activeTube: null },
                learningProgress: {},
            };
            return res.status(200).json(minimalDefaultState);
        }
        
        console.log(`User ${userId}: State loaded successfully via RPC.`);
        return res.status(200).json(data); // 'data' is the comprehensive user state from the RPC
      } catch (e: any) {
        console.error(`User ${userId}: Unexpected error in GET /api/sync-user-state:`, e);
        return res.status(500).json({ error: 'Internal server error', details: e.message });
      }

    default:
      // Handle any other HTTP methods.
      console.log(`User ${userId}: Method ${method} not allowed for /api/sync-user-state.`);
      res.setHeader('Allow', ['POST', 'GET']);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}
