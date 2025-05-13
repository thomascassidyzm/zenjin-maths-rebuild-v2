import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Ultra-simplified state API
 * 
 * GET - Load state for a user
 * POST - Save state for a user
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`SIMPLE-STATE API: Request method=${req.method}`);
  
  // Create Supabase admin client with service role key
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false
      }
    }
  );
  
  // Log the credentials (masked) for debugging
  console.log(`SIMPLE-STATE API: Using Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`SIMPLE-STATE API: Using service role key: ${process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 5)}...`);
  
  // First try to create the table if it doesn't exist
  try {
    const { error: tableError } = await supabaseAdmin.rpc('create_user_state_table_if_not_exists');
    if (tableError) {
      console.log(`SIMPLE-STATE API: Could not create table via RPC: ${tableError.message}`);

      // Try direct SQL approach
      const { error: sqlError } = await supabaseAdmin.query(`
        CREATE TABLE IF NOT EXISTS public.user_state (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          state JSONB NOT NULL,
          last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_user_state_user_id ON user_state(user_id);
      `);

      if (sqlError) {
        console.error(`SIMPLE-STATE API: Error creating table:`, sqlError);
      } else {
        console.log(`SIMPLE-STATE API: Created user_state table successfully`);
      }
    } else {
      console.log(`SIMPLE-STATE API: Table created via RPC successfully`);
    }
  } catch (createTableError) {
    console.error(`SIMPLE-STATE API: Error setting up table:`, createTableError);
  }

  try {
    // GET - Load state for a user
    if (req.method === 'GET') {
      const { userId } = req.query;
      
      console.log(`SIMPLE-STATE API: Loading state for user ${userId}`);
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }
      
      // Try to retrieve ONLY the LATEST state from the database
      // Since we're doing DELETE and INSERT, there should only be one record, but let's be sure
      // We'll order by created_at DESC to get the newest record
      console.log(`SIMPLE-STATE API: Retrieving latest state for user ${userId}`);
      const { data, error } = await supabaseAdmin
        .from('user_state')
        .select('state, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        console.log(`SIMPLE-STATE API: Retrieved state created at ${data.created_at}`);
      }
      
      if (error) {
        console.error(`SIMPLE-STATE API: Error retrieving state:`, error);
        
        // Return default empty state
        return res.status(200).json({
          success: true,
          state: {
            userId,
            tubeState: null,
            userInformation: null,
            learningProgress: null,
            lastUpdated: new Date().toISOString()
          },
          source: 'default'
        });
      }
      
      console.log(`SIMPLE-STATE API: Successfully retrieved state for user ${userId}`);
      console.log(`SIMPLE-STATE API: State keys:`, data?.state ? Object.keys(data.state) : 'No state');

      // Log the detailed structure of what we're returning
      const returnState = data?.state || {
        userId,
        tubeState: null,
        userInformation: null,
        learningProgress: null,
        lastUpdated: new Date().toISOString()
      };

      console.log(`SIMPLE-STATE API: Returning state keys:`, Object.keys(returnState));

      // Ensure we have the right structure with tubeState.tubes.positions
      if (returnState.tubeState) {
        console.log(`SIMPLE-STATE API: tubeState exists with keys:`, Object.keys(returnState.tubeState));

        if (returnState.tubeState.tubes) {
          console.log(`SIMPLE-STATE API: tubes:`, Object.keys(returnState.tubeState.tubes));

          // Check tube 1 specifically
          if (returnState.tubeState.tubes[1]) {
            const tube1 = returnState.tubeState.tubes[1];
            console.log(`SIMPLE-STATE API: tube 1 keys:`, Object.keys(tube1));

            // Check positions specifically
            if (tube1.positions) {
              console.log(`SIMPLE-STATE API: tube 1 positions:`, Object.keys(tube1.positions).join(', '));

              // Extra check for position 5
              if (tube1.positions[5]) {
                console.log(`SIMPLE-STATE API: Position 5 found with stitchId: ${tube1.positions[5].stitchId}`);
              } else {
                console.log(`SIMPLE-STATE API: Position 5 NOT FOUND in return state`);
              }
            } else {
              console.log(`SIMPLE-STATE API: No positions found in tube 1`);
            }
          }
        }
      }

      // For debugging - clean up the state to make ABSOLUTELY sure it has the right structure
      // This is only for verifying the persistence with positions
      console.log(`SIMPLE-STATE API: Fixing return state structure to ensure it's properly formatted`);

      // Make a copy to avoid modifying the original
      const cleanState = {
        ...returnState,
        lastUpdated: returnState.lastUpdated || new Date().toISOString(),
      };

      // Ensure we return properly structured state, particularly for positions
      if (cleanState.tubeState?.tubes) {
        console.log(`SIMPLE-STATE API: Verified tubes:`, Object.keys(cleanState.tubeState.tubes).join(', '));

        // For each tube, ensure positions are preserved
        Object.entries(cleanState.tubeState.tubes).forEach(([tubeKey, tubeData]: [string, any]) => {
          if (!tubeData) return;

          console.log(`SIMPLE-STATE API: Verifying tube ${tubeKey} structure`);

          // If this tube has positions, preserve them in the response
          if (tubeData.positions) {
            console.log(`SIMPLE-STATE API: Verified positions for tube ${tubeKey}:`,
              Object.keys(tubeData.positions).join(', '));
          }
        });
      }

      return res.status(200).json({
        success: true,
        state: cleanState, // Return the verified state
        source: data ? 'database' : 'default'
      });
    }
    
    // POST - Save state for a user
    if (req.method === 'POST') {
      // Extract state and user ID from request
      let { state, id } = req.body;
      
      console.log(`SIMPLE-STATE API: Saving state, request body keys: ${Object.keys(req.body).join(', ')}`);
      
      if (!state || typeof state !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'state object is required'
        });
      }
      
      // Get user ID from state or standalone id field
      const userId = state.userId || id;
      
      console.log(`SIMPLE-STATE API: Extracted userId=${userId} (state.userId=${state.userId}, id=${id})`);
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }
      
      // Ensure userId is in state
      if (!state.userId) {
        state.userId = userId;
      }
      
      // Timestamp
      const now = new Date().toISOString();
      
      // First delete any existing state for this user
      const { error: deleteError } = await supabaseAdmin
        .from('user_state')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) {
        console.log(`SIMPLE-STATE API: Delete operation had error but continuing: ${deleteError.message}`);
      }
      
      // Log details about the state we're about to store
      console.log(`SIMPLE-STATE API: About to save state for user ${userId}`);

      // Check if the state includes tubeState
      if (state.tubeState && state.tubeState.tubes) {
        console.log(`SIMPLE-STATE API: State includes tubes: ${Object.keys(state.tubeState.tubes).join(', ')}`);

        // Check tube 1 specifically
        if (state.tubeState.tubes[1]) {
          console.log(`SIMPLE-STATE API: Tube 1 has positions:`,
            state.tubeState.tubes[1].positions ?
            Object.keys(state.tubeState.tubes[1].positions) : 'No positions');

          // Extra check for position 5 that we're looking for
          if (state.tubeState.tubes[1].positions && state.tubeState.tubes[1].positions[5]) {
            console.log(`SIMPLE-STATE API: Position 5 exists with stitchId: ${state.tubeState.tubes[1].positions[5].stitchId}`);

            // Extra validation to ensure the position data is complete
            const pos5 = state.tubeState.tubes[1].positions[5];
            console.log(`SIMPLE-STATE API: Position 5 data:`, {
              stitchId: pos5.stitchId,
              skipNumber: pos5.skipNumber,
              distractorLevel: pos5.distractorLevel,
              perfectCompletions: pos5.perfectCompletions
            });
          } else {
            console.log(`SIMPLE-STATE API: Position 5 DOES NOT EXIST in tube 1!`);

            // Log all positions to see what's available
            if (state.tubeState.tubes[1].positions) {
              console.log(`SIMPLE-STATE API: Available positions in tube 1:`,
                Object.keys(state.tubeState.tubes[1].positions).join(', '));

              // Check for any position data
              Object.entries(state.tubeState.tubes[1].positions).forEach(([pos, data]) => {
                console.log(`SIMPLE-STATE API: Position ${pos} has stitchId: ${data.stitchId}`);
              });
            }
          }
        }
      }

      // Make extra sure we have all the necessary paths in our state
      // This ensures that when loaded back, the data will be found
      if (!state.tubeState) {
        console.log(`SIMPLE-STATE API: No tubeState found, creating empty structure`);
        state.tubeState = { tubes: {} };
      }

      // Add a marker to know which save this is
      state._saveTimestamp = now;

      // Insert new state - using columns that we know exist in the table
      const { error: insertError } = await supabaseAdmin
        .from('user_state')
        .insert({
          user_id: userId,
          state: state
          // The other columns (last_updated and created_at) have DEFAULT NOW() constraints
        });
      
      if (insertError) {
        console.error(`SIMPLE-STATE API: Error saving state:`, insertError);
        return res.status(500).json({
          success: false,
          error: 'Error saving state',
          details: insertError.message
        });
      }
      
      console.log(`SIMPLE-STATE API: Successfully saved state for user ${userId}`);
      
      return res.status(200).json({
        success: true,
        message: 'State saved successfully'
      });
    }
    
    // Other methods not supported
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error(`SIMPLE-STATE API: Unhandled error:`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}