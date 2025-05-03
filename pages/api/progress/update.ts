/**
 * Update Progress Endpoint
 * 
 * Updates a user's progress on a specific stitch.
 * Works for both authenticated and anonymous users.
 */
import { createAnonymousHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { logApiInfo, logApiError } from '../../../lib/api/logging';

export default createAnonymousHandler(
  async (req, res, userId, db, isAuthenticated) => {
    // Extract parameters from request body
    const {
      threadId,
      stitchId,
      orderNumber,
      skipNumber,
      distractorLevel
    } = req.body;

    // Validate required fields
    if (!threadId || !stitchId || orderNumber === undefined) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        errorResponse('Thread ID, stitch ID, and order number are required')
      );
    }

    try {
      logApiInfo('Progress/Update', 
        `Updating progress for ${threadId}/${stitchId}`, 
        userId, 
        { orderNumber, skipNumber, distractorLevel }
      );

      // Prepare update data
      const updateData = {
        user_id: userId,
        thread_id: threadId,
        stitch_id: stitchId,
        order_number: orderNumber,
        skip_number: skipNumber || 3,
        distractor_level: distractorLevel || 'L1',
        is_anonymous: !isAuthenticated,
        updated_at: new Date().toISOString()
      };
      
      // Use progressive approach from most complete to most basic
      // Track success through multiple attempts
      let isSuccess = false;
      const errors = [];

      // ATTEMPT 1: Full upsert with all fields
      if (!isSuccess) {
        const { error } = await db
          .from('user_stitch_progress')
          .upsert(updateData, {
            onConflict: 'user_id,thread_id,stitch_id',
            ignoreDuplicates: false
          });
        
        if (!error) {
          isSuccess = true;
          logApiInfo('Progress/Update/Attempt1', 'Full upsert successful', userId);
        } else {
          errors.push({ attempt: 1, error: error.message });
          logApiError('Progress/Update/Attempt1', error, userId);
        }
      }

      // ATTEMPT 2: Upsert without timestamp
      if (!isSuccess) {
        const { updated_at, ...dataWithoutTimestamp } = updateData;
        
        const { error } = await db
          .from('user_stitch_progress')
          .upsert(dataWithoutTimestamp, {
            onConflict: 'user_id,thread_id,stitch_id',
            ignoreDuplicates: false
          });
        
        if (!error) {
          isSuccess = true;
          logApiInfo('Progress/Update/Attempt2', 'Upsert without timestamp successful', userId);
        } else {
          errors.push({ attempt: 2, error: error.message });
          logApiError('Progress/Update/Attempt2', error, userId);
        }
      }

      // ATTEMPT 3: Minimal fields only
      if (!isSuccess) {
        const minimalData = {
          user_id: userId,
          thread_id: threadId,
          stitch_id: stitchId,
          order_number: orderNumber
        };
        
        const { error } = await db
          .from('user_stitch_progress')
          .upsert(minimalData, {
            onConflict: 'user_id,thread_id,stitch_id',
            ignoreDuplicates: false
          });
        
        if (!error) {
          isSuccess = true;
          logApiInfo('Progress/Update/Attempt3', 'Minimal upsert successful', userId);
        } else {
          errors.push({ attempt: 3, error: error.message });
          logApiError('Progress/Update/Attempt3', error, userId);
        }
      }

      // ATTEMPT 4: Check existence then insert/update
      if (!isSuccess) {
        const { data: existingRecord, error: checkError } = await db
          .from('user_stitch_progress')
          .select('user_id')
          .eq('user_id', userId)
          .eq('thread_id', threadId)
          .eq('stitch_id', stitchId)
          .single();
        
        if (checkError && checkError.code !== 'PGRST116') {
          errors.push({ attempt: 4, stage: 'check', error: checkError.message });
          logApiError('Progress/Update/Attempt4/Check', checkError, userId);
        } else {
          if (!existingRecord) {
            // Record doesn't exist, insert
            const { error: insertError } = await db
              .from('user_stitch_progress')
              .insert({
                user_id: userId,
                thread_id: threadId,
                stitch_id: stitchId,
                order_number: orderNumber,
                is_anonymous: !isAuthenticated
              });
            
            if (!insertError) {
              isSuccess = true;
              logApiInfo('Progress/Update/Attempt4', 'Insert successful', userId);
            } else {
              errors.push({ attempt: 4, stage: 'insert', error: insertError.message });
              logApiError('Progress/Update/Attempt4/Insert', insertError, userId);
            }
          } else {
            // Record exists, update
            const { error: updateError } = await db
              .from('user_stitch_progress')
              .update({ order_number: orderNumber })
              .eq('user_id', userId)
              .eq('thread_id', threadId)
              .eq('stitch_id', stitchId);
            
            if (!updateError) {
              isSuccess = true;
              logApiInfo('Progress/Update/Attempt4', 'Update successful', userId);
            } else {
              errors.push({ attempt: 4, stage: 'update', error: updateError.message });
              logApiError('Progress/Update/Attempt4/Update', updateError, userId);
            }
          }
        }
      }

      // ATTEMPT 5: RPC call
      if (!isSuccess) {
        // Try RPC call as last resort (assuming it exists in the database)
        try {
          const { error: rpcError } = await db.rpc('upsert_user_stitch_progress', {
            p_user_id: userId,
            p_thread_id: threadId,
            p_stitch_id: stitchId,
            p_order_number: orderNumber
          });
          
          if (!rpcError) {
            isSuccess = true;
            logApiInfo('Progress/Update/Attempt5', 'RPC call successful', userId);
          } else {
            errors.push({ attempt: 5, error: rpcError.message });
            logApiError('Progress/Update/Attempt5', rpcError, userId);
          }
        } catch (rpcError) {
          errors.push({ attempt: 5, error: 'RPC call exception' });
          logApiError('Progress/Update/Attempt5', rpcError, userId);
        }
      }

      if (isSuccess) {
        return res.status(HTTP_STATUS.OK).json(
          successResponse({}, 'Progress updated successfully')
        );
      } else {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
          errorResponse('Failed to update progress after multiple attempts', errors)
        );
      }
    } catch (error) {
      // Error is logged by the handler
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('Failed to update progress')
      );
    }
  },
  {
    methods: ['POST'],
    context: 'Progress/Update'
  }
);