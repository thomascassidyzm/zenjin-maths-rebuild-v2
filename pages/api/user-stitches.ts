import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient, createAdminClient } from '../../lib/supabase/route';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log("API: user-stitches endpoint called");
    
    // Create both client types for different auth needs
    const supabase = createRouteHandlerClient(req, res);
    const supabaseAdmin = createAdminClient();
    
    // Get authenticated user or use anonymous
    const { data: { session } } = await supabase.auth.getSession();
    
    // Get userId from query parameter if provided
    let paramUserId = req.query.userId as string;
    
    // Security check: Allow diagnostic IDs to fetch any user's data
    // These start with 'diag-' and are used for testing
    const isDiagnosticRequest = paramUserId && paramUserId.toString().startsWith('diag-');
    
    // Check for JWT token in request headers (for direct API calls)
    let tokenUserId = null;
    try {
      const authHeader = req.headers.authorization;
      console.log(`API: Auth header present: ${!!authHeader}`);
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        console.log(`API: Validating token from Authorization header`);
        
        const { data: userData, error } = await supabase.auth.getUser(token);
        if (!error && userData?.user) {
          tokenUserId = userData.user.id;
          console.log(`API: Valid token for user: ${tokenUserId}`);
        } else if (error) {
          console.log(`API: Token validation error: ${error.message}`);
        }
      }
    } catch (e) {
      console.error('API: Error checking authorization header:', e);
    }
    
    // For security, only allow override of userId for diagnostic users,
    // when token validates, or if the authenticated user is accessing their own data
    if (paramUserId && !isDiagnosticRequest) {
      // If token user ID is available, that takes precedence
      if (tokenUserId) {
        if (paramUserId !== tokenUserId) {
          console.log(`API: Security check - Token user ${tokenUserId} tried to access data for ${paramUserId}. Using token userId instead.`);
          paramUserId = tokenUserId;
        }
      } 
      // Otherwise check session user ID
      else if (session?.user?.id && paramUserId !== session.user.id) {
        console.log(`API: Security check - Session user ${session?.user?.id} tried to access data for ${paramUserId}. Using session userId instead.`);
        paramUserId = session.user.id;
      }
    }
    
    // Determine final user ID with this priority:
    // 1. Param user ID (after security checks)
    // 2. Token user ID (from Authorization header)
    // 3. Session user ID (from cookies)
    // 4. Anonymous
    const userId = paramUserId || tokenUserId || session?.user?.id || 'anonymous';
    console.log(`API: Final determined userId: ${userId}`);
    
    // Log auth details for debugging
    res.setHeader('X-Auth-Method', tokenUserId ? 'token' : (session?.user ? 'session' : 'anonymous'));
    
    console.log(`API: Using user ID: ${userId} ${isDiagnosticRequest ? '(diagnostic user)' : (session?.user ? '(authenticated)' : '(anonymous)')}`);
    
    // Check if prefetch parameter is present
    const prefetchCount = req.query.prefetch ? parseInt(req.query.prefetch as string, 10) : 1;
    const isPrefetchingMultiple = prefetchCount > 1;
    
    // Check if full configuration is requested
    const requestFullConfig = req.query.fullConfig === 'true';
    
    // Check initialization mode
    const initMode = req.query.mode as string || 'default';
    const isRestoreMode = initMode === 'restore';
    
    // For authenticated users, default to restore mode unless explicitly specified otherwise
    const effectiveRestoreMode = session?.user ? (isRestoreMode || initMode === 'default') : isRestoreMode;
    
    // Check if user is explicitly anonymous via query param
    const isAnonymous = (req.query.isAnonymous === 'true' || userId === 'anonymous');
    
    // Set free tier limits
    const FREE_TIER_STITCH_LIMIT = 5; // Maximum stitches per thread for free tier
    // Threads included in free tier (first thread in each tube)
    const FREE_TIER_THREAD_IDS = ['thread-T1-001', 'thread-T2-001', 'thread-T3-001'];
    
    console.log(`API: Using userId: ${userId} ${session?.user ? '(authenticated)' : '(anonymous)'}, prefetching ${prefetchCount} stitches per thread, mode: ${initMode}`);
    console.log(`API: Effective restore mode: ${effectiveRestoreMode ? 'true' : 'false'} (will prioritize saved progress)`);
    console.log(`API: User access type: ${isAnonymous ? 'anonymous (free tier)' : 'authenticated (full access)'}`);
    
    // Add authentication details to response headers for debugging
    res.setHeader('X-User-ID', userId);
    res.setHeader('X-Restore-Mode', effectiveRestoreMode ? 'true' : 'false');
    
    // Add extra debug header for troubleshooting
    res.setHeader('X-Debug-Auth', session?.user ? 'authenticated' : 'anonymous');
    
    // First try to get all available threads with tube_number
    let threadsData;
    let threadsError;
    
    try {
      // First try with tube_number column (might fail if column doesn't exist yet)
      // Use admin client to bypass RLS for reliable data access
      const { data, error } = await supabaseAdmin
        .from('threads')
        .select('*')
        .order('id');
      
      threadsData = data;
      threadsError = error;
      
      // If the query succeeds, try to get tube_number status
      if (!error && data) {
        console.log('API: Successfully retrieved threads, checking tube_number column existence');
        
        // Check if tube_number column exists in threads table
        const { data: columnData, error: columnError } = await supabaseAdmin
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_schema', 'public')
          .eq('table_name', 'threads')
          .eq('column_name', 'tube_number')
          .single();
          
        const tubeNumberExists = !columnError || columnError.code !== 'PGRST116'; // PGRST116 = no rows
        
        if (tubeNumberExists) {
          console.log('API: tube_number column exists, getting threads with tube info');
          
          // If tube_number exists, get all threads with tube_number included
          const { data: threadsWithTube, error: tubeError } = await supabaseAdmin
            .from('threads')
            .select('*');
            
          if (!tubeError) {
            threadsData = threadsWithTube;
            threadsError = null;
          }
        } else {
          console.log('API: tube_number column does not exist yet, using default thread ordering');
          // Calculate virtual tube_number based on thread ID
          if (threadsData) {
            threadsData = threadsData.map(thread => {
              // Extract letter from thread ID (e.g., thread-A -> A)
              const letter = thread.id.match(/thread-([A-Z])/)?.[1] || '';
              
              // Calculate tube number with specific assignments
              let tubeNumber = 1; // Default
              if (letter) {
                // Direct letter to tube mapping based on curriculum design
                if (letter === 'A') tubeNumber = 1;
                else if (letter === 'B') tubeNumber = 2;
                else if (letter === 'C') tubeNumber = 3;
                else if (letter === 'D') tubeNumber = 3; // Thread D should go to Tube 3
                else if (letter === 'E') tubeNumber = 2;
                else if (letter === 'F') tubeNumber = 1;
                else {
                  // Fallback for any other letters
                  const charCode = letter.charCodeAt(0) - 65; // A=0, B=1, C=2, etc.
                  tubeNumber = (charCode % 3) + 1; // 1, 2, or 3 with wraparound
                }
              }
              
              return {
                ...thread,
                tube_number: tubeNumber
              };
            });
            
            // Sort by calculated tube_number
            threadsData.sort((a, b) => a.tube_number - b.tube_number);
          }
        }
      }
    } catch (fetchError) {
      console.error('API: Error in thread fetching logic:', fetchError);
      // Fallback to basic query
      const { data, error } = await supabaseAdmin
        .from('threads')
        .select('*');
      
      threadsData = data;
      threadsError = error;
    }
    
    if (threadsError) {
      console.error('API: Error fetching threads:', threadsError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch threads',
        details: threadsError.message 
      });
    }
    
    console.log(`API: Found ${threadsData?.length || 0} threads`);
    
    // Log tube assignments for debugging
    threadsData?.forEach(thread => {
      console.log(`API: Thread ${thread.id} is assigned to Tube-${thread.tube_number || '?'}`);
    });
    
    // If no threads, return empty data
    if (!threadsData || threadsData.length === 0) {
      return res.status(200).json({ 
        success: true, 
        data: [] 
      });
    }
    
    // Get only stitches for the threads we have
    // Extract thread IDs from threadsData
    const threadIds = threadsData?.map(thread => thread.id) || [];
    
    // If no threads, return empty response
    if (threadIds.length === 0) {
      console.log('API: No threads found, returning empty response');
      return res.status(200).json({ 
        success: true, 
        data: [] 
      });
    }
    
    console.log(`API: Fetching stitches for ${threadIds.length} threads: ${threadIds.join(', ')}`);
    
    // For anonymous users, only fetch stitches for free tier threads
    const effectiveThreadIds = isAnonymous ? 
      threadIds.filter(id => FREE_TIER_THREAD_IDS.includes(id)) : 
      threadIds;
    
    // Get stitches only for the threads we need
    console.log(`API: Fetching stitches for threads: ${effectiveThreadIds.join(', ')}`);
    
    // For anonymous users, make sure we always include at least one thread per tube
    // (essential to prevent sample content fallback)
    const requiredThreadIds = ['thread-T1-001', 'thread-T2-001', 'thread-T3-001'];
    
    // Combine required threads with effective threads (no duplicates)
    const finalThreadIds = Array.from(new Set([
      ...effectiveThreadIds,
      ...(isAnonymous ? requiredThreadIds : [])
    ]));
    
    console.log(`API: Final thread IDs for stitch query: ${finalThreadIds.join(', ')}`);
    
    const { data: stitchesData, error: stitchesError } = await supabaseAdmin
      .from('stitches')
      .select('*, questions(*)')
      .in('thread_id', finalThreadIds);
    
    if (stitchesError) {
      console.error('API: Error fetching stitches:', stitchesError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch stitches',
        details: stitchesError.message 
      });
    }
    
    console.log(`API: Found ${stitchesData?.length || 0} stitches`);
    
    // Log the structure of a sample stitch with questions to help debug format
    if (stitchesData && stitchesData.length > 0) {
      const sampleStitch = stitchesData.find(s => s.questions && s.questions.length > 0);
      if (sampleStitch) {
        console.log('API: Sample stitch structure:', {
          id: sampleStitch.id,
          content: sampleStitch.content,
          thread_id: sampleStitch.thread_id,
          questionCount: sampleStitch.questions.length
        });
        
        // If there are questions, log the structure of the first question
        if (sampleStitch.questions && sampleStitch.questions.length > 0) {
          console.log('API: Sample question structure:', JSON.stringify(sampleStitch.questions[0]));
        } else {
          console.log('API: No questions found for the sample stitch');
        }
      } else {
        console.log('API: No stitches with questions found');
      }
    }
    
    // Get user progress or create default progress
    const { data: progressData, error: progressError } = await supabaseAdmin
      .from('user_stitch_progress')
      .select('*')
      .eq('user_id', userId);
    
    if (progressError) {
      console.error('API: Error fetching user progress:', progressError);
      // Continue anyway, we'll use default values
    }
    
    console.log(`API: Found ${progressData?.length || 0} progress entries for user`);
    
    // If this is a new user, we'll need to initialize progress records
    const isNewUser = !progressData || progressData.length === 0;
    console.log(`API: User appears to be ${isNewUser ? 'new' : 'returning'}`);
    
    // Create progress records for a new user if they're authenticated
    // Also create records if in restore mode and there are no progress records
    if ((isNewUser || effectiveRestoreMode) && userId !== 'anonymous') {
      console.log(`API: Initializing progress records for ${isNewUser ? 'new user' : 'existing user (restore mode)'}`);
      console.log(`API: User ID: ${userId}, Authentication status: ${session?.user ? 'Authenticated' : 'Anonymous'}`);
      const progressRecords: Array<{
        user_id: string;
        thread_id: string;
        stitch_id: string;
        order_number: number;
        skip_number: number;
        distractor_level: string;
        updated_at?: string; // Make updated_at optional
      }> = [];
      
      // For each thread/stitch combination, create an initial progress record
      for (const thread of threadsData) {
        const threadStitches = stitchesData.filter(stitch => stitch.thread_id === thread.id);
        
        // Sort by database order if available
        let sortedStitches = [...threadStitches];
        if (sortedStitches.length > 0 && sortedStitches[0].order !== undefined) {
          sortedStitches.sort((a, b) => (a.order || 0) - (b.order || 0));
        }
        
        // Create progress records for each stitch
        sortedStitches.forEach((stitch, index) => {
          progressRecords.push({
            user_id: userId,
            thread_id: thread.id,
            stitch_id: stitch.id,
            order_number: index === 0 ? 0 : index, // First stitch is active (0), rest are sequential
            skip_number: 3,
            distractor_level: 'L1'
            // Do not include updated_at field as it might not exist in all database instances
          });
        });
      }
      
      // Insert the progress records if we have any
      if (progressRecords.length > 0) {
        try {
          const { error: insertError } = await supabaseAdmin
            .from('user_stitch_progress')
            .upsert(progressRecords);
            
          if (insertError) {
            console.error('API: Error inserting progress records:', insertError);
            
            // If we get a column error, try with minimal fields
            if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
              console.log('API: Schema error detected, trying minimal insert');
              
              // Create minimal records with only essential fields
              const minimalRecords = progressRecords.map(record => ({
                user_id: record.user_id,
                thread_id: record.thread_id,
                stitch_id: record.stitch_id,
                order_number: record.order_number
              }));
              
              // Try again with minimal fields
              const { error: minimalError } = await supabaseAdmin
                .from('user_stitch_progress')
                .upsert(minimalRecords);
                
              if (minimalError) {
                console.error('API: Even minimal insert failed:', minimalError);
              } else {
                console.log(`API: Successfully initialized ${minimalRecords.length} progress records with minimal fields`);
              }
            }
          } else {
            console.log(`API: Successfully initialized ${progressRecords.length} progress records`);
          }
        } catch (err) {
          console.error('API: Exception inserting progress records:', err);
          // Continue anyway - we'll use in-memory data
        }
      }
    }
    
    // Try to get the user's last tube position from active stitches
    // Each tube should have one active stitch (order_number = 0)
    // We want to find which one is currently in focus by:
    // 1. Checking for state in user_state table (primary source)
    // 2. Checking if any have is_current_tube = true
    // 3. Falling back to the most recently updated active stitch
    let lastTubePosition = null;
    
    try {
      console.log(`API: Checking multiple sources for user ${userId}'s state`);
      
      // CRITICAL FIX: First check user_state table which has highest priority
      // This is where the complete state is saved at the end of sessions
      try {
        // Use admin client to bypass RLS for most reliable data access
        const { data: userStateData, error: userStateError } = await supabaseAdmin
          .from('user_state')
          .select('state')
          .eq('user_id', userId)
          .single();
        
        if (!userStateError && userStateData && userStateData.state) {
          const state = userStateData.state;
          console.log(`API: Found complete state in user_state table`);
          
          // Extract active tube from state
          if (state.activeTubeNumber && state.tubes) {
            const tubeNumber = state.activeTubeNumber;
            const tube = state.tubes[tubeNumber];
            
            if (tube && tube.threadId) {
              lastTubePosition = {
                tubeNumber: tubeNumber,
                threadId: tube.threadId
              };
              console.log(`API: Found current tube from user_state: Tube-${lastTubePosition.tubeNumber}, Thread-${lastTubePosition.threadId}`);
              
              // Also use the state to determine active stitches for loading
              for (const [tubNum, tubeData] of Object.entries(state.tubes)) {
                if (tubeData && tubeData.stitches && Array.isArray(tubeData.stitches)) {
                  console.log(`API: Using tube ${tubNum} configuration from user_state table`);
                  
                  // Create/update user_stitch_progress records to match saved state
                  // This ensures stitch positions are synchronized when loading state
                  for (const stitch of tubeData.stitches) {
                    if (stitch.id && typeof stitch.position !== 'undefined') {
                      try {
                        // Fire and forget - we'll continue even if this fails
                        supabaseAdmin
                          .from('user_stitch_progress')
                          .upsert({
                            user_id: userId,
                            thread_id: stitch.threadId,
                            stitch_id: stitch.id,
                            order_number: stitch.position,
                            skip_number: stitch.skipNumber || 1,
                            distractor_level: stitch.distractorLevel || 'L1',
                            is_current_tube: tubNum == tubeNumber && stitch.id === tubeData.currentStitchId
                          }, { onConflict: 'user_id,thread_id,stitch_id' })
                          .then(({ error }) => {
                            if (error) {
                              console.log(`API: Error updating stitch ${stitch.id} from state: ${error.message}`);
                            }
                          });
                      } catch (err) {
                        console.error(`API: Error updating stitch ${stitch.id}:`, err);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (stateErr) {
        console.log(`API: Error checking user_state table: ${stateErr.message}`);
      }
      
      // Only continue with other methods if we didn't find state in user_state
      if (!lastTubePosition) {
        // First check if any stitches have is_current_tube = true
        const { data: currentTubeData, error: currentTubeError } = await supabaseAdmin
          .from('user_stitch_progress')
          .select('*, threads!inner(*)')
          .eq('user_id', userId)
          .eq('order_number', 0)
          .eq('is_current_tube', true)
          .order('updated_at', { ascending: false })
          .limit(1);
        
        if (!currentTubeError && currentTubeData && currentTubeData.length > 0) {
          // Get tube number from the thread
          const stitch = currentTubeData[0];
          const thread = stitch.threads;
          
          if (thread && thread.tube_number) {
            lastTubePosition = {
              tubeNumber: thread.tube_number,
              threadId: thread.id
            };
            console.log(`API: Found current tube (from is_current_tube) for user ${userId}: Tube-${lastTubePosition.tubeNumber}, Thread-${lastTubePosition.threadId}`);
          }
        } else if (currentTubeError && !currentTubeError.message.includes('does not exist')) {
          // If error is not just about missing column, log it
          console.log(`API: is_current_tube may not exist, using recent active stitch instead: ${currentTubeError.message}`);
        }
        
        // If we didn't find a tube with is_current_tube, use the most recently updated active stitch
        if (!lastTubePosition) {
          const { data: recentStitchData, error: recentStitchError } = await supabaseAdmin
            .from('user_stitch_progress')
            .select('*, threads!inner(*)')
            .eq('user_id', userId)
            .eq('order_number', 0)
            .order('updated_at', { ascending: false })
            .limit(1);
            
          if (!recentStitchError && recentStitchData && recentStitchData.length > 0) {
            // Get tube number from the thread
            const stitch = recentStitchData[0];
            const thread = stitch.threads;
            
            if (thread && thread.tube_number) {
              lastTubePosition = {
                tubeNumber: thread.tube_number,
                threadId: thread.id
              };
              console.log(`API: Found current tube (from recent active stitch) for user ${userId}: Tube-${lastTubePosition.tubeNumber}, Thread-${lastTubePosition.threadId}`);
            }
          } else if (recentStitchError) {
            console.error('API: Error getting recent active stitch:', recentStitchError);
          }
        }
        
        // Fallback to legacy methods if we still don't have a tube position
        if (!lastTubePosition) {
          // Try special format in user_stitch_progress first
          const { data: tubeStitchData, error: tubeStitchError } = await supabaseAdmin
            .from('user_stitch_progress')
            .select('*')
            .eq('user_id', userId)
            .like('stitch_id', 'tube:%')
            .order('updated_at', { ascending: false })
            .limit(1);
            
          if (!tubeStitchError && tubeStitchData && tubeStitchData.length > 0) {
            // Extract tube number from the special stitch_id format
            const tubeNumberMatch = tubeStitchData[0].stitch_id.match(/tube:(\d+)/);
            const tubeNumber = tubeNumberMatch ? parseInt(tubeNumberMatch[1], 10) : null;
            
            if (tubeNumber) {
              lastTubePosition = {
                tubeNumber: tubeNumber,
                threadId: tubeStitchData[0].thread_id
              };
              console.log(`API: Found saved tube position (from special stitch) for user ${userId}: Tube-${lastTubePosition.tubeNumber}, Thread-${lastTubePosition.threadId}`);
            }
          }
          
          // Last resort: try legacy table
          if (!lastTubePosition) {
            try {
              const { data: legacyPositionData, error: legacyError } = await supabaseAdmin
                .from('user_tube_position')
                .select('*')
                .eq('user_id', userId)
                .single();
                
              if (!legacyError && legacyPositionData) {
                lastTubePosition = {
                  tubeNumber: legacyPositionData.tube_number,
                  threadId: legacyPositionData.thread_id
                };
                console.log(`API: Found saved tube position (from legacy table) for user ${userId}: Tube-${lastTubePosition.tubeNumber}, Thread-${lastTubePosition.threadId}`);
              } else {
                console.log(`API: No saved tube position found for user ${userId}`);
              }
            } catch (legacyErr) {
              console.log('API: Legacy tube position table not available');
            }
          }
        }
      }
    } catch (posErr) {
      console.error('API: Error fetching tube position:', posErr);
      // Continue without tube position
    }
    
    // If we still have no tube position, default to tube 1
    if (!lastTubePosition) {
      const firstThreadInTube1 = threadsData.find(t => t.tube_number === 1);
      if (firstThreadInTube1) {
        lastTubePosition = {
          tubeNumber: 1,
          threadId: firstThreadInTube1.id
        };
        console.log(`API: Using default tube position for user ${userId}: Tube-1, Thread-${firstThreadInTube1.id}`);
      }
    }
    
    // Format the data for the client
    const threadData = threadsData.map(thread => {
      // If this thread matches the saved tube position, mark it
      const isSavedPosition = lastTubePosition && 
                             lastTubePosition.threadId === thread.id &&
                             lastTubePosition.tubeNumber === thread.tube_number;
      
      if (isSavedPosition) {
        console.log(`API: Thread ${thread.id} is the saved tube position (Tube-${thread.tube_number})`);
        // Mark this thread as the saved tube position
        thread._savedTubePosition = true;
      }
      
      // Find stitches for this thread
      const threadStitches = stitchesData.filter(stitch => 
        stitch.thread_id === thread.id
      );
      
      console.log(`API: Found ${threadStitches.length} stitches for thread ${thread.id}`);
      
      // Sort stitches by database order if no progress exists
      let sortedStitches = [...threadStitches];
      if (sortedStitches.length > 0 && sortedStitches[0].order !== undefined) {
        // Sort by the 'order' field from the database
        sortedStitches.sort((a, b) => (a.order || 0) - (b.order || 0));
        console.log(`API: Sorted stitches by database order field`);
      }
      
      // Double check that exactly one stitch is ready (order_number = 0) for this thread
      // This ensures we always have a starting point even if database is in odd state
      const readyStitches = progressData?.filter(p => 
        p.thread_id === thread.id && p.order_number === 0
      ) || [];
      
      // Critical validation: Every thread must have exactly one ready stitch
      // If there's no ready stitch or we're in restore mode, force one to be ready
      if ((readyStitches.length === 0 || effectiveRestoreMode) && sortedStitches.length > 0 && userId !== 'anonymous') {
        console.log(`API: Thread ${thread.id} has ${readyStitches.length} ready stitches, fixing...`);
        console.log(`API: Restore mode is ${effectiveRestoreMode ? 'active' : 'inactive'} for this operation`);
        
        if (sortedStitches.length > 0) {
          // Select the first stitch to make ready
          const firstStitch = sortedStitches[0];
          console.log(`API: Setting stitch ${firstStitch.id} as ready for thread ${thread.id}`);
          
          // If progressData exists, update it in memory
          if (progressData) {
            // First, ensure no other stitches are marked as ready
            progressData.forEach(p => {
              if (p.thread_id === thread.id && p.order_number === 0) {
                p.order_number = 1; // Push it back in the queue
                console.log(`API: Demoting previously ready stitch ${p.stitch_id}`);
              }
            });
            
            // Now make the selected stitch ready
            const progressEntry = progressData.find(p => 
              p.thread_id === thread.id && p.stitch_id === firstStitch.id
            );
            
            if (progressEntry) {
              progressEntry.order_number = 0;
              console.log(`API: Updated progress entry for stitch ${firstStitch.id} to be ready`);
            } else {
              console.log(`API: No progress entry found for stitch ${firstStitch.id}, creating one`);
              // Add a new progress entry
              progressData.push({
                user_id: userId,
                thread_id: thread.id,
                stitch_id: firstStitch.id,
                order_number: 0,
                skip_number: 3,
                distractor_level: 'L1'
                // Do not include updated_at field as it might not exist in all database instances
              } as any); // Cast to any to avoid TypeScript error
            }
            
            // Attempt to persist these changes to the database
            try {
              // Find entries that need updates
              const entriesToUpdate = progressData.filter(p => 
                p.thread_id === thread.id && 
                // Either it's the ready stitch or it was previously ready
                (p.stitch_id === firstStitch.id || p.order_number === 1)
              );
              
              // Fire the updates without waiting
              for (const entry of entriesToUpdate) {
                // Fire and forget - we're already in a try/catch block
                // Try to update with defensive approach - use Promise.resolve to ensure we can chain properly
                Promise.resolve().then(async () => {
                  try {
                    const { error } = await supabaseAdmin
                      .from('user_stitch_progress')
                      .upsert({
                        user_id: entry.user_id,
                        thread_id: entry.thread_id,
                        stitch_id: entry.stitch_id,
                        order_number: entry.order_number,
                        skip_number: entry.skip_number,
                        distractor_level: entry.distractor_level
                      });
                    
                    if (error && error.message.includes('column') && error.message.includes('does not exist')) {
                      // If there's a column error, retry with minimal fields
                      await supabaseAdmin
                        .from('user_stitch_progress')
                        .upsert({
                          user_id: entry.user_id,
                          thread_id: entry.thread_id,
                          stitch_id: entry.stitch_id,
                          order_number: entry.order_number
                        });
                    }
                  } catch (err) {
                    console.error(`API: Error updating stitch ${entry.stitch_id}:`, err);
                  }
                });
                  
                console.log(`API: Sent update for stitch ${entry.stitch_id}`);
              }
              
              console.log(`API: Successfully persisted ready stitch changes to database`);
            } catch (err) {
              console.error('API: Error persisting ready stitch changes:', err);
              // Continue anyway - the in-memory changes will still be returned
            }
          }
        }
      } else if (readyStitches.length > 1) {
        // Multiple ready stitches detected - fix this issue
        console.log(`API: Thread ${thread.id} has ${readyStitches.length} ready stitches, fixing...`);
        
        // Keep only the first one as ready
        const keepReadyStitchId = readyStitches[0].stitch_id;
        let counter = 1;
        
        // Update in memory first
        readyStitches.slice(1).forEach(entry => {
          entry.order_number = counter++;
          console.log(`API: Demoting extra ready stitch ${entry.stitch_id} to order ${entry.order_number}`);
        });
        
        // Attempt to persist these changes to the database
        try {
          for (const entry of readyStitches.slice(1)) {
            // Fire and forget - we're already in a try/catch block
            Promise.resolve().then(async () => {
              try {
                const { error } = await supabase
                  .from('user_stitch_progress')
                  .update({ 
                    order_number: entry.order_number
                  })
                  .eq('user_id', userId)
                  .eq('thread_id', thread.id)
                  .eq('stitch_id', entry.stitch_id);
                
                if (error) {
                  // If update fails, try upsert instead which is sometimes more reliable
                  console.error(`API: Update failed for stitch ${entry.stitch_id}, trying upsert:`, error);
                  await supabase
                    .from('user_stitch_progress')
                    .upsert({
                      user_id: userId,
                      thread_id: thread.id,
                      stitch_id: entry.stitch_id,
                      order_number: entry.order_number
                    });
                }
              } catch (err) {
                console.error(`API: Error demoting stitch ${entry.stitch_id}:`, err);
              }
            });
              
            console.log(`API: Sent demotion for extra ready stitch ${entry.stitch_id}`);
          }
          console.log(`API: Successfully fixed multiple ready stitches issue in database`);
        } catch (err) {
          console.error('API: Error fixing multiple ready stitches:', err);
          // Continue anyway - the in-memory changes will still be returned
        }
      }

      // Map stitches with progress information
      const stitchesWithProgress = sortedStitches.map((stitch, index) => {
        // Find progress for this stitch
        const progress = progressData?.find(p => 
          p.stitch_id === stitch.id && p.thread_id === thread.id
        );
        
        // If user progress exists, use it; otherwise use default ordering
        // First stitch (by database order) gets 0, rest get sequential numbers
        const orderNumber = progress?.order_number !== undefined
          ? progress.order_number
          : (index === 0 ? 0 : index);
        
        return {
          ...stitch,
          order_number: orderNumber,
          skip_number: progress?.skip_number ?? 3,
          distractor_level: progress?.distractor_level ?? 'L1'
        };
      });
      
      // Create order map for all stitches
      const orderMap = stitchesWithProgress.map(stitch => ({
        stitch_id: stitch.id,
        order_number: stitch.order_number
      }));
      
      // If prefetching multiple stitches, return the full list of stitches
      // Otherwise, filter to just include the first few stitches based on order_number
      let includedStitches = stitchesWithProgress;
      
      if (!isPrefetchingMultiple) {
        // Only include the active stitch (order_number = 0) if not prefetching multiple
        includedStitches = stitchesWithProgress.filter(stitch => stitch.order_number === 0);
      } else {
        // Sort by order_number to get the next N stitches
        includedStitches = stitchesWithProgress
          .sort((a, b) => a.order_number - b.order_number)
          .slice(0, prefetchCount);
        
        console.log(`API: Prefetching ${includedStitches.length} stitches for thread ${thread.id}`);
      }
      
      return {
        thread_id: thread.id,
        stitches: includedStitches,
        orderMap: orderMap // Always include the full order map
      };
    });
    
    // Apply free tier filtering for anonymous users
    let responseData = threadData;
    
    if (isAnonymous) {
      console.log(`API: Applying free tier filtering for anonymous user`);
      
      // Filter to only include free tier threads
      responseData = threadData
        .filter(thread => FREE_TIER_THREAD_IDS.includes(thread.thread_id))
        .map(thread => {
          // For each thread, limit to FREE_TIER_STITCH_LIMIT stitches
          const limitedStitches = thread.stitches.slice(0, FREE_TIER_STITCH_LIMIT);
          
          // Sort stitches by thread_id and order_number to ensure proper sequencing
          // This ensures that thread-T3-001 stitches come before thread-T3-002 stitches
          limitedStitches.sort((a, b) => {
            // First compare by thread ID
            const threadCompare = a.thread_id.localeCompare(b.thread_id);
            if (threadCompare !== 0) return threadCompare;
            
            // Then compare by order_number
            return a.order_number - b.order_number;
          });
          
          console.log(`API: Including thread ${thread.thread_id} with ${limitedStitches.length} stitches`);
          return {
            ...thread,
            stitches: limitedStitches
          };
        });
        
      console.log(`API: Filtered to ${responseData.length} free tier threads`);
    }
    
    // Log prefetch stats
    const totalPrefetchedStitches = responseData.reduce((sum, thread) => sum + thread.stitches.length, 0);
    console.log(`API: Returning ${responseData.length} threads with a total of ${totalPrefetchedStitches} prefetched stitches`);
    
    // Add the last tube position to the response if available
    return res.status(200).json({
      success: true,
      data: responseData,
      tubePosition: lastTubePosition,
      isFreeTier: isAnonymous
    });
    
  } catch (err) {
    console.error('Unexpected error in user-stitches API:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: err instanceof Error ? err.message : String(err)
    });
  }
}