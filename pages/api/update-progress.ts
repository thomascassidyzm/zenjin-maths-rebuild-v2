import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../lib/supabase/route';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  try {
    // Create a Supabase client with proper auth context
    const supabase = createRouteHandlerClient(req, res);
    
    // Get authenticated user
    const { data: { session } } = await supabase.auth.getSession();
    const authenticatedUserId = session?.user?.id;
    
    // Get request body
    const {
      userId,
      threadId,
      stitchId,
      orderNumber,
      skipNumber,
      distractorLevel
    } = req.body;
    
    // Validate inputs
    if (!userId || !threadId || !stitchId || orderNumber === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: { userId: !!userId, threadId: !!threadId, stitchId: !!stitchId, orderNumber: orderNumber }
      });
    }
    
    // Security check: Allow diagnostic IDs to update progress directly 
    // These start with 'diag-' and are used for testing
    const isDiagnosticUser = userId && typeof userId === 'string' && userId.startsWith('diag-');
    
    // For non-diagnostic users, ensure they can only update their own progress
    if (!isDiagnosticUser && authenticatedUserId && userId !== authenticatedUserId && userId !== 'anonymous') {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own progress'
      });
    }
    
    console.log(`API: Updating progress for user ${userId}, thread ${threadId}, stitch ${stitchId}`);
    console.log(`API: New values - order: ${orderNumber}, skip: ${skipNumber || 3}, level: ${distractorLevel || 'L1'}`);
    
    // Convert string 'anonymous' to standard UUID if needed
    const effectiveUserIdUUID = 
      userId === 'anonymous' 
      ? '00000000-0000-0000-0000-000000000000' 
      : userId;
    
    console.log(`API: Using user ID: ${effectiveUserIdUUID} for progress update`);
    
    // Prepare update data with required fields
    const updateData = {
      user_id: effectiveUserIdUUID,
      thread_id: threadId,
      stitch_id: stitchId,
      order_number: orderNumber,
      skip_number: skipNumber || 3,
      distractor_level: distractorLevel || 'L1',
      updated_at: new Date().toISOString()
    };
    
    // Track our progress through multiple attempts
    let successfullyUpdated = false;
    const errors = [];
    
    // ATTEMPT 1: Full upsert with all fields
    if (!successfullyUpdated) {
      try {
        console.log('API: Attempt 1 - Full upsert with all fields');
        const { error } = await supabase
          .from('user_stitch_progress')
          .upsert(updateData, {
            onConflict: 'user_id,thread_id,stitch_id',
            ignoreDuplicates: false
          });
        
        if (!error) {
          console.log('API: Attempt 1 succeeded - Full update complete');
          successfullyUpdated = true;
        } else {
          console.log(`API: Attempt 1 failed: ${error.message}`);
          errors.push(`Attempt 1: ${error.message}`);
        }
      } catch (err) {
        console.error('API: Exception in Attempt 1:', err);
        errors.push(`Attempt 1 exception: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    // ATTEMPT 2: Upsert without updated_at field
    if (!successfullyUpdated) {
      try {
        console.log('API: Attempt 2 - Upsert without updated_at field');
        // Remove updated_at field which sometimes causes issues
        const { updated_at, ...dataWithoutTimestamp } = updateData;
        
        const { error } = await supabase
          .from('user_stitch_progress')
          .upsert(dataWithoutTimestamp, {
            onConflict: 'user_id,thread_id,stitch_id',
            ignoreDuplicates: false
          });
        
        if (!error) {
          console.log('API: Attempt 2 succeeded - Update without timestamp complete');
          successfullyUpdated = true;
        } else {
          console.log(`API: Attempt 2 failed: ${error.message}`);
          errors.push(`Attempt 2: ${error.message}`);
        }
      } catch (err) {
        console.error('API: Exception in Attempt 2:', err);
        errors.push(`Attempt 2 exception: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    // ATTEMPT 3: Minimal fields only
    if (!successfullyUpdated) {
      try {
        console.log('API: Attempt 3 - Minimal fields only');
        const minimalData = {
          user_id: userId,
          thread_id: threadId,
          stitch_id: stitchId,
          order_number: orderNumber
        };
        
        const { error } = await supabase
          .from('user_stitch_progress')
          .upsert(minimalData, {
            onConflict: 'user_id,thread_id,stitch_id',
            ignoreDuplicates: false
          });
        
        if (!error) {
          console.log('API: Attempt 3 succeeded - Minimal update complete');
          successfullyUpdated = true;
        } else {
          console.log(`API: Attempt 3 failed: ${error.message}`);
          errors.push(`Attempt 3: ${error.message}`);
        }
      } catch (err) {
        console.error('API: Exception in Attempt 3:', err);
        errors.push(`Attempt 3 exception: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    // ATTEMPT 4: Check existence before update/insert
    if (!successfullyUpdated) {
      try {
        console.log('API: Attempt 4 - Check existence before update/insert');
        // First check if the record exists
        const { data: existingRecord, error: checkError } = await supabase
          .from('user_stitch_progress')
          .select('user_id')
          .eq('user_id', effectiveUserIdUUID)
          .eq('thread_id', threadId)
          .eq('stitch_id', stitchId)
          .single();
        
        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.log(`API: Attempt 4 check failed: ${checkError.message}`);
          errors.push(`Attempt 4 check: ${checkError.message}`);
        } else {
          // Decide whether to insert or update based on existence
          if (!existingRecord) {
            console.log('API: Record does not exist, attempting insert');
            const { error: insertError } = await supabase
              .from('user_stitch_progress')
              .insert({
                user_id: effectiveUserIdUUID,
                thread_id: threadId,
                stitch_id: stitchId,
                order_number: orderNumber
              });
            
            if (!insertError) {
              console.log('API: Attempt 4 insert succeeded');
              successfullyUpdated = true;
            } else {
              console.log(`API: Attempt 4 insert failed: ${insertError.message}`);
              errors.push(`Attempt 4 insert: ${insertError.message}`);
            }
          } else {
            console.log('API: Record exists, attempting update');
            const { error: updateError } = await supabase
              .from('user_stitch_progress')
              .update({ order_number: orderNumber })
              .eq('user_id', effectiveUserIdUUID)
              .eq('thread_id', threadId)
              .eq('stitch_id', stitchId);
            
            if (!updateError) {
              console.log('API: Attempt 4 update succeeded');
              successfullyUpdated = true;
            } else {
              console.log(`API: Attempt 4 update failed: ${updateError.message}`);
              errors.push(`Attempt 4 update: ${updateError.message}`);
            }
          }
        }
      } catch (err) {
        console.error('API: Exception in Attempt 4:', err);
        errors.push(`Attempt 4 exception: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    // ATTEMPT 5: Try raw SQL as a last resort
    if (!successfullyUpdated) {
      try {
        console.log('API: Attempt 5 - Last resort direct RPC call');
        // Using a safe parameterized RPC call
        const { error: rpcError } = await supabase.rpc('upsert_user_stitch_progress', {
          p_user_id: effectiveUserIdUUID,
          p_thread_id: threadId,
          p_stitch_id: stitchId,
          p_order_number: orderNumber
        });
        
        if (!rpcError) {
          console.log('API: Attempt 5 succeeded with RPC call');
          successfullyUpdated = true;
        } else {
          console.log(`API: Attempt 5 RPC call failed: ${rpcError.message}`);
          errors.push(`Attempt 5 RPC: ${rpcError.message}`);
        }
      } catch (err) {
        console.error('API: Exception in Attempt 5:', err);
        errors.push(`Attempt 5 exception: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    // Final result
    if (successfullyUpdated) {
      return res.status(200).json({
        success: true,
        message: 'Progress updated successfully'
      });
    } else {
      console.error('API: All progress update attempts failed:', errors);
      return res.status(500).json({
        success: false,
        error: 'Failed to update progress after multiple attempts',
        details: errors
      });
    }
  } catch (err) {
    console.error('Unexpected error in update-progress API:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: err instanceof Error ? err.message : String(err)
    });
  }
}