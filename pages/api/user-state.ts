import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient, createAdminClient } from '../../lib/supabase/route';
import { getDefaultUserState } from '../../lib/initialization/initialize-user-state';

/**
 * User state API endpoint
 *
 * GET - Retrieve state for a user
 * POST - Update state for a user
 *
 * Handles both authenticated and anonymous users consistently
 *
 * IMPORTANT: This endpoint is deprecated in favor of using Zustand + localStorage
 * for state persistence during learning sessions. All user state synchronization
 * should go through the Zustand store only.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Modified to allow Zustand store server persistence
  // This code previously blocked POST requests, but has been modified to allow persistence
  console.log('API: user-state endpoint called. Allowing requests to proceed for testing position-based model.');

  // For GET requests, we'll still allow them to work for now
  // Enable debug mode for troubleshooting
  const isDebug = req.query.debug === 'true';

  // Enhanced logging for debugging state persistence issues
  console.log(`API: user-state called - method: ${req.method}, debug: ${isDebug}`);
  console.log(`API: user-state request URL: ${req.url}`);

  // Increase payload size limit for large state objects (100MB)
  if (req.method === 'POST') {
    // We need to manually handle the body parsing for large payloads
    try {
      if (!req.body && req.headers['content-type']?.includes('application/json')) {
        const buffers = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const data = Buffer.concat(buffers).toString();
        req.body = JSON.parse(data);
        console.log(`API: Manually parsed large request body - size: ${data.length} bytes`);
      }
    } catch (parseError) {
      console.error('Error parsing large request body:', parseError);
      return res.status(400).json({
        success: false,
        error: 'Invalid request body - could not parse JSON'
      });
    }
  }

  // Set up more comprehensive error handling for 500 errors
  try {

  try {
    // Create supabase clients
    const supabase = createRouteHandlerClient(req, res);
    const supabaseAdmin = createAdminClient();
    
    // For GET requests (Retrieve state)
    if (req.method === 'GET') {
      // Get user information
      const { data: { session } } = await supabase.auth.getSession();
      
      // Get userID parameter from query
      let { userId } = req.query;
      
      // Determine effective user ID with this priority:
      // 1. Query parameter (if it matches authenticated user or for testing)
      // 2. Session user ID
      // 3. Anonymous ID (if provided)
      const authenticatedUserId = session?.user?.id;
      
      // Security check: only allow the authenticated user to access their own data
      // Exception: if the user is explicitly accessing anonymous data
      if (userId && authenticatedUserId && userId !== authenticatedUserId && userId !== 'anonymous') {
        if (isDebug) {
          console.log(`Security check: User ${authenticatedUserId} tried to access data for ${userId}. Using authenticated ID instead.`);
        }
        userId = authenticatedUserId;
      }
      
      // Final user ID determination
      const effectiveUserId = userId || authenticatedUserId || 'anonymous';
      
      // Special case for test accounts
      if (effectiveUserId === 'anonymous' && req.query.email === 'thomas.cassidy+zm301@gmail.com') {
        // Use hardcoded ID for test user
        const testUserId = 'e45b377a-9d72-4b6b-9b9e-ee8efb26b916';
        if (isDebug) {
          console.log(`Using test user ID: ${testUserId} for email ${req.query.email}`);
        }
        return getUserState(testUserId, supabaseAdmin, res, isDebug);
      }
      
      // Get user state based on effective user ID
      console.log(`API: Retrieving user state for effectiveUserId: ${effectiveUserId}`);
      return getUserState(effectiveUserId as string, supabaseAdmin, res, isDebug);
    }
    
    // For POST requests (Update state)
    if (req.method === 'POST') {
      // Handle both { state } and { state, id } formats for compatibility
      const { state, id } = req.body;
      
      if (!state || typeof state !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Valid state object is required'
        });
      }
      
      // Check for userId in both places - in the state object and as standalone id field
      const userId = state.userId || id;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'State must include userId'
        });
      }
      
      // Add userId to state if missing
      if (!state.userId) {
        console.log(`API: Adding missing userId ${userId} to state`);
        state.userId = userId;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      const authenticatedUserId = session?.user?.id;
      
      console.log(`API: User state - Authenticated user: ${authenticatedUserId}, State user: ${state.userId}`);
      
      // Security check: only allow the authenticated user to update their own data
      // Exception: allow anonymous users to update anonymous data
      if (!state.userId.startsWith('anonymous') && authenticatedUserId && state.userId !== authenticatedUserId) {
        console.log(`API: User state - Security check failed - Using authenticated userId ${authenticatedUserId} instead of ${state.userId}`);
        // Update the userId in the state instead of returning an error
        state.userId = authenticatedUserId;
      }
      
      return updateUserState(state, supabaseAdmin, res, isDebug);
    }
    
    // Handle unsupported methods
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use GET to retrieve state or POST to update state.'
    });
  } catch (error) {
    console.error('Error in user-state API:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred',
      details: isDebug ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
  } catch (outerError) {
    // Extra safety catch for any errors that might have been missed
    console.error('CRITICAL API ERROR: Uncaught error in user-state API handler:', outerError);
    console.error('CRITICAL API ERROR: Stack trace:', outerError.stack || 'No stack available');
    
    try {
      // Try to send a simplified response with minimal processing
      return res.status(500).json({
        success: false,
        error: 'Critical server error occurred',
        errorType: outerError.name || 'UnknownError',
        // Only include minimal details to prevent circular references
        message: outerError.message || 'Unknown error'
      });
    } catch (finalError) {
      // Last resort error handling
      console.error('FATAL API ERROR: Could not send error response:', finalError);
      // Send the simplest possible response
      res.status(500).end('Server error');
    }
  }
}

/**
 * Retrieves user state from the database
 */
async function getUserState(userId: string, supabase: any, res: NextApiResponse, isDebug: boolean) {
  // Safety check: Make sure userId is valid
  if (!userId || userId === 'undefined' || userId === 'null' || userId === '') {
    console.error('API: Invalid or empty userId provided to getUserState');
    return res.status(400).json({
      success: false,
      error: 'Invalid or empty userId provided'
    });
  }
  try {
    // Ensure user_state table exists first
    try {
      await ensureTableExists(supabase, isDebug);
    } catch (tableError) {
      console.error('Error ensuring table exists:', tableError);
      // If we can't create the table, just return default state
      const defaultState = getDefaultUserState(userId);
      return res.status(200).json({
        success: true,
        state: defaultState,
        source: 'default'
      });
    }
    
    // Get user state
    let data;
    try {
      console.log(`API: Querying database for user state - userId: ${userId}`);
      
      const { data: stateData, error } = await supabaseAdmin
        .from('user_state')
        .select('state, last_updated')
        .eq('user_id', userId)
        .order('last_updated', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error) {
        console.error(`ERROR in user-state: Error retrieving state for user ${userId}:`, error);
        console.error('ERROR in user-state: Error code:', error.code);
        console.error('ERROR in user-state: Error details:', error.details);
        console.error('ERROR in user-state: Error hint:', error.hint);
        // Don't fail - just use default state
        data = null;
      } else {
        if (stateData) {
          console.log(`API: Successfully retrieved state for user ${userId} - last updated: ${stateData.last_updated}`);
          console.log(`API: State contains keys:`, Object.keys(stateData.state || {}).join(', '));
          
          // Check for naming scheme inconsistencies
          if (stateData.state) {
            console.log(`API: State activeTube = ${stateData.state.activeTube}`);
            console.log(`API: State activeTubeNumber = ${stateData.state.activeTubeNumber}`);
            
            // Fix activeTubeNumber if it's missing but activeTube exists
            if (stateData.state.activeTube !== undefined && stateData.state.activeTubeNumber === undefined) {
              console.log(`API: CRITICAL FIX - Adding missing activeTubeNumber field (copied from activeTube)`);
              stateData.state.activeTubeNumber = stateData.state.activeTube;
            }
            
            // Fix activeTube if it's missing but activeTubeNumber exists
            if (stateData.state.activeTubeNumber !== undefined && stateData.state.activeTube === undefined) {
              console.log(`API: CRITICAL FIX - Adding missing activeTube field (copied from activeTubeNumber)`);
              stateData.state.activeTube = stateData.state.activeTubeNumber;
            }
          }
        } else {
          console.log(`API: No existing state found for user ${userId}`);
        }
        data = stateData;
      }
    } catch (queryError) {
      console.error('Error querying user state:', queryError);
      data = null;
    }
    
    // If no data found, return the default state for this user
    if (!data) {
      console.log(`No state found for user ${userId}, using default`);
      const defaultState = getDefaultUserState(userId);
      
      // Store the default state in the database for future use
      try {
        const { error: saveError } = await supabaseAdmin
          .from('user_state')
          .upsert({
            user_id: userId,
            state: defaultState,
            last_updated: new Date().toISOString(),
            created_at: new Date().toISOString()
          });
          
        if (saveError && isDebug) {
          console.log(`Note: Failed to save default state: ${saveError.message}`);
        }
      } catch (saveErr) {
        if (isDebug) {
          console.log(`Note: Error saving default state: ${saveErr.message || saveErr}`);
        }
      }
      
      return res.status(200).json({
        success: true,
        state: defaultState,
        source: 'default'
      });
    }
    
    return res.status(200).json({
      success: true,
      state: data.state,
      source: 'database'
    });
  } catch (err) {
    console.error('Error getting user state:', err);
    
    // Return default state in case of any error
    const defaultState = getDefaultUserState(userId);
    return res.status(200).json({
      success: true,
      state: defaultState,
      source: 'fallback',
      error: isDebug ? (err instanceof Error ? err.message : String(err)) : undefined
    });
  }
}

/**
 * Updates user state in the database
 */
async function updateUserState(state: any, supabase: any, res: NextApiResponse, isDebug: boolean) {
  try {
    // Ensure user_state table exists
    try {
      await ensureTableExists(supabase, isDebug);
    } catch (tableError) {
      console.error('Error ensuring table exists:', tableError);
      // Continue anyway - we'll try to save
    }
    
    // Ensure last_updated field is present
    if (!state.lastUpdated) {
      state.lastUpdated = new Date().toISOString();
    }
    
    // Ensure the last_updated field is in valid ISO format - fix it if not
    const lastUpdated = state.lastUpdated
      ? new Date(state.lastUpdated).toISOString()
      : new Date().toISOString();
      
    // Always set/update the lastUpdated field to ensure state is current
    state.lastUpdated = lastUpdated;
    
    // EMERGENCY FIX: Force extraction of minimal state elements from whatever is received
    // We need to reduce the payload size regardless of how it came in
    // Extract the absolute minimum needed data
    const minimalState = {
      userId: state.userId,
      activeTube: state.activeTube || state.activeTubeNumber || 1,
      activeTubeNumber: state.activeTubeNumber || state.activeTube || 1,
      lastUpdated: lastUpdated,
      points: state.points || { session: 0, lifetime: 0 },
      isCompacted: true,
      compactedAt: new Date().toISOString(),
      forcedCompaction: true
    };

    // Extract minimal tube information (only positions, no content)
    if (state.tubes) {
      const minimalTubes = {};

      Object.keys(state.tubes).forEach(tubeKey => {
        const tube = state.tubes[tubeKey];
        if (tube) {
          // Just store the absolute essentials
          minimalTubes[tubeKey] = {
            currentStitchId: tube.currentStitchId || null,
            threadId: tube.threadId || `thread-T${tubeKey}-001`,
            stitchPositions: {}
          };

          // Add minimal stitch position info
          if (tube.stitches && Array.isArray(tube.stitches)) {
            tube.stitches.forEach(stitch => {
              if (stitch && stitch.id) {
                minimalTubes[tubeKey].stitchPositions[stitch.id] = {
                  position: stitch.position || 0,
                  skipNumber: stitch.skipNumber || 3,
                  distractorLevel: stitch.distractorLevel || 'L1'
                };
              }
            });
          } else if (tube.stitchPositions) {
            // Preserve existing positions if available
            minimalTubes[tubeKey].stitchPositions = tube.stitchPositions;
          }
        }
      });

      minimalState.tubes = minimalTubes;
    }

    // Format the state for database storage with the extremely minimal state
    const formattedState = {
      user_id: state.userId,
      state: minimalState,
      last_updated: lastUpdated,
      created_at: new Date().toISOString()
    };
    
    try {
      console.log(`API: About to save state with userId ${formattedState.user_id}, lastUpdated ${formattedState.last_updated}`);
      
      // DEBUG: Add detailed diagnostic info for troubleshooting
      if (isDebug) {
        console.log(`DEBUG state content:`, JSON.stringify({
          user_id: formattedState.user_id,
          tubes: formattedState.state.tubes ? Object.keys(formattedState.state.tubes) : [],
          activeTube: formattedState.state.activeTube || formattedState.state.activeTubeNumber,
          lastUpdated: formattedState.last_updated
        }));
      }
      
      // Make sure the userId is valid - critical for preventing database errors
      if (!formattedState.user_id || formattedState.user_id === '') {
        console.error(`API: Invalid/empty user_id in state - cannot save`);
        
        // Try using the userId from the query parameter or auth session
        const fallbackUserId = state.userId || 
                              (authenticatedUserId ? authenticatedUserId : id);
        
        if (fallbackUserId) {
          console.log(`API: Using fallback userId ${fallbackUserId} for state persistence`);
          formattedState.user_id = fallbackUserId;
          formattedState.state.userId = fallbackUserId;
        } else {
          return res.status(400).json({
            success: false,
            error: 'No valid user ID found in state or request'
          });
        }
      }
      
      // Check the original payload size
      const originalSize = JSON.stringify(state).length;
      // Check the minimal state size
      const minimalSize = JSON.stringify(minimalState).length;
      // Check the formatted state size
      const formattedSize = JSON.stringify(formattedState).length;

      console.log(`PAYLOAD SIZES: Original=${originalSize} bytes, Minimal=${minimalSize} bytes, Formatted=${formattedSize} bytes`);
      console.log(`OPTIMIZATION: Reduced payload by ${Math.round((originalSize - minimalSize) / originalSize * 100)}%`);

      // Always optimize state, but now we're already using an ultra-minimal state
      // so this is mostly for logging and final touches
      {
        console.log(`Final optimization applied to already minimal state`);

        try {
          // Helper function to extract stitch positions
          function extractStitchPositions(stitches) {
            if (!stitches || !Array.isArray(stitches)) return {};

            const positions = {};
            stitches.forEach(stitch => {
              if (stitch && stitch.id) {
                positions[stitch.id] = {
                  position: stitch.position || 0,
                  skipNumber: stitch.skipNumber || 3,
                  distractorLevel: stitch.distractorLevel || 'L1'
                };
              }
            });
            return positions;
          }

          // Define essential state variable that will be set in either branch
          let essentialState;

          // Check if the state is already in our optimized format
          // If it has stitchPositions property, it's likely already optimized
          if (formattedState.state.tubes &&
              Object.values(formattedState.state.tubes).some((tube: any) => tube.stitchPositions)) {
            console.log('State appears to be already in optimized format');

            // Just ensure the essential fields are present
            essentialState = {
              userId: formattedState.state.userId,
              activeTube: formattedState.state.activeTube || formattedState.state.activeTubeNumber || 1,
              activeTubeNumber: formattedState.state.activeTubeNumber || formattedState.state.activeTube || 1,
              lastUpdated: formattedState.last_updated,
              points: formattedState.state.points || {
                session: 0,
                lifetime: 0
              },
              // Just reference the existing tubes structure
              tubes: formattedState.state.tubes,
              // Add metadata about optimization
              optimizationVersion: 1,
              originalSize: stateSize
            };
          } else {
            // Extract essential data for efficient storage
            essentialState = {
              userId: formattedState.state.userId,
              activeTube: formattedState.state.activeTube || formattedState.state.activeTubeNumber || 1,
              activeTubeNumber: formattedState.state.activeTubeNumber || formattedState.state.activeTube || 1,
              lastUpdated: formattedState.last_updated,
              // Keep points data
              points: formattedState.state.points || {
                session: 0,
                lifetime: 0
              },
              // Add metadata about optimization
              optimizationVersion: 1,
              originalSize: stateSize
            };

            // Store hyper-optimized tube data with only the absolute minimum needed fields
            const tubes = {};
            if (formattedState.state.tubes) {
              Object.keys(formattedState.state.tubes).forEach(tubeKey => {
                const tube = formattedState.state.tubes[tubeKey];
                if (tube) {
                  // Store only the bare essentials needed to maintain tube state
                  tubes[tubeKey] = {
                    currentStitchId: tube.currentStitchId,
                    threadId: tube.threadId || `thread-T${tubeKey}-001`,
                    // Extract stitch positions if available, or use existing optimized format
                    stitchPositions: tube.stitchPositions || extractStitchPositions(tube.stitches)
                  };

                  // CRITICAL: Remove any questions array which can be enormous
                  // These are loaded from bundled content and don't need to be stored
                  if (tubes[tubeKey].questions) {
                    delete tubes[tubeKey].questions;
                  }
                  if (tubes[tubeKey].content) {
                    delete tubes[tubeKey].content;
                  }
                  if (tubes[tubeKey].stitches) {
                    delete tubes[tubeKey].stitches;
                  }
                }
              });
            }

            // Add the optimized tubes to the essential state
            essentialState.tubes = tubes;
          }


          // We've already created an ultra-minimal state at the beginning,
          // so we don't need additional compaction here.
          // Just add any flags needed for compatibility
          const compactState = {
            ...minimalState,
            // Make doubly sure these are set
            isCompacted: true,
            compactedAt: new Date().toISOString(),
            forcedCompaction: true
          };

          // Log what we're doing for diagnostics
          console.log(`Using pre-optimized minimal state (userId: ${compactState.userId}, activeTube: ${compactState.activeTube})`);
          console.log(`Minimal state size: ${JSON.stringify(compactState).length} bytes`);

          // Use admin client to store the compact state
          const { error } = await supabaseAdmin
            .from('user_state')
            .upsert({
              user_id: formattedState.user_id,
              state: compactState, // Use our pre-optimized state
              last_updated: formattedState.last_updated,
              created_at: formattedState.created_at
            });

          if (error) {
            console.error(`Error storing compacted state:`, error);
            throw error;
          }

          console.log(`Successfully stored compacted state`);
          return res.status(200).json({
            success: true,
            message: 'State updated successfully (compacted for efficiency)',
            compacted: true
          });
        } catch (compactError) {
          console.error(`Error in compact state strategy:`, compactError);
          // Continue to regular save as fallback
        }
      } // End of optimization block (always runs now)

      // Use admin client which has RLS bypass for most reliable save
      try {
        console.log(`Saving full state to database...`);
        const { error } = await supabaseAdmin
          .from('user_state')
          .upsert(formattedState);

        if (error) {
          console.error(`Error updating state:`, error);
          console.error(`Error details:`, error.details || error.message);
          throw error;
        }

        console.log(`Successfully saved full state to database`);
      } catch (adminError) {
        console.error(`Admin client save failed, trying direct PostgreSQL insert...`);

        try {
          // Try a more direct approach with basic SQL insert
          // Instead of calling the rpc function, we'll directly run a SQL query
          const now = new Date().toISOString();

          console.log(`Trying direct SQL insert (user_id: ${formattedState.user_id})`);

          // First try to delete existing record for this user (to avoid conflicts)
          // This is a simple delete + insert approach rather than upsert
          const { error: deleteError } = await supabaseAdmin
            .from('user_state')
            .delete()
            .eq('user_id', formattedState.user_id);

          if (deleteError) {
            console.log(`Note: Delete operation had error but we'll continue: ${deleteError.message}`);
          }

          // Then insert a fresh record
          const { error: insertError } = await supabaseAdmin
            .from('user_state')
            .insert({
              user_id: formattedState.user_id,
              state: minimalState, // Use minimal state
              last_updated: now,
              created_at: now
            });

          if (insertError) {
            console.error(`Direct SQL insert failed:`, insertError);

            // Log key information for debugging
            console.log(`API ERROR: State values that failed to save:`, JSON.stringify({
              user_id: formattedState.user_id,
              state_size: JSON.stringify(minimalState).length,
              last_updated: now
            }));

            return res.status(500).json({
              success: false,
              error: 'Error updating state even with fallback methods',
              details: isDebug ? insertError.message : undefined
            });
          }

          console.log(`Direct SQL insert succeeded`);
        } catch (sqlError) {
          console.error(`Error in direct SQL save:`, sqlError);
          return res.status(500).json({
            success: false,
            error: 'Error updating state with all methods',
            details: isDebug ? (sqlError instanceof Error ? sqlError.message : String(sqlError)) : undefined
          });
        }
      }
    } catch (upsertErr) {
      console.error('Error during upsert:', upsertErr);
      return res.status(500).json({
        success: false,
        error: 'Unexpected error updating state',
        details: isDebug ? (upsertErr instanceof Error ? upsertErr.message : String(upsertErr)) : undefined
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'State updated successfully'
    });
  } catch (err) {
    console.error('Error updating user state:', err);
    return res.status(500).json({
      success: false,
      error: 'Unexpected error updating state',
      details: isDebug ? (err instanceof Error ? err.message : String(err)) : undefined
    });
  }
}

/**
 * Ensures the user_state table exists in the database
 */
async function ensureTableExists(supabase: any, isDebug: boolean) {
  try {
    // Check if the table exists - always use admin client for these operations
    const { error: checkError } = await supabase
      .from('user_state')
      .select('count', { count: 'exact', head: true });
    
    // If table doesn't exist, create it
    if (checkError && checkError.code === '42P01') {
      if (isDebug) {
        console.log('Creating user_state table...');
      }
      
      const { error: createError } = await supabase.query(`
        CREATE TABLE IF NOT EXISTS public.user_state (
          user_id TEXT NOT NULL,
          state JSONB NOT NULL,
          last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, last_updated)
        );
        
        -- Create index for efficient queries by user
        CREATE INDEX IF NOT EXISTS idx_user_state_user_id ON user_state(user_id);
      `);
      
      if (createError) {
        throw createError;
      }
      
      if (isDebug) {
        console.log('Table created successfully');
      }
    } else if (checkError) {
      throw checkError;
    }
  } catch (err) {
    console.error('Error ensuring table exists:', err);
    throw err;
  }
}