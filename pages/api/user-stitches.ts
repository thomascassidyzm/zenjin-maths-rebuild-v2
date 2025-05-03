/**
 * User Stitches API Endpoint
 * 
 * This endpoint provides stitches for the specified user, respecting free tier limitations
 * and subscription status.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { createAdvancedHandler } from '../../lib/api/handlers';
import { formatSuccessResponse, formatErrorResponse } from '../../lib/api/responses';
import { logError, logInfo } from '../../lib/api/logging';
import { getFreeTierPositionLimit } from '../../lib/freeTierAccess';

// Maximum number of stitches available in each tube for free tier users
const FREE_TIER_STITCH_LIMIT = 10;

export default createAdvancedHandler(
  async (req: NextApiRequest, res: NextApiResponse, context) => {
    const { userId, db, isAuthenticated } = context;
    
    try {
      // Get query parameters
      const prefetchCount = parseInt(req.query.prefetch as string) || 5;
      const isAnonymous = req.query.isAnonymous === 'true';
      
      // Get user subscription status
      let hasSubscription = false;
      let isFreeTier = true;
      let isAdmin = false;
      
      if (isAuthenticated && !isAnonymous) {
        // Check subscription status from database
        const { data: userData, error: userError } = await db
          .from('profiles')
          .select('has_subscription, subscription_status, role')
          .eq('id', userId)
          .single();
        
        if (userError) {
          logError('UserStitches', 'Failed to fetch user profile', {
            userId,
            error: userError
          });
        } else if (userData) {
          hasSubscription = userData.has_subscription || false;
          isFreeTier = !hasSubscription;
          isAdmin = userData.role === 'admin';
          
          logInfo('UserStitches', 'User subscription status', {
            userId,
            hasSubscription,
            isFreeTier,
            isAdmin
          });
        }
      }
      
      // Fetch threads and stitches for all three tubes
      // This is a simplified version of the actual database queries
      
      // Tube 1: Foundational skills
      const { data: tube1ThreadsData, error: tube1Error } = await db
        .from('threads')
        .select('id, title')
        .eq('tube_number', 1)
        .order('order_number', { ascending: true });
      
      // Tube 2: Application
      const { data: tube2ThreadsData, error: tube2Error } = await db
        .from('threads')
        .select('id, title')
        .eq('tube_number', 2)
        .order('order_number', { ascending: true });
      
      // Tube 3: Extension
      const { data: tube3ThreadsData, error: tube3Error } = await db
        .from('threads')
        .select('id, title')
        .eq('tube_number', 3)
        .order('order_number', { ascending: true });
      
      if (tube1Error || tube2Error || tube3Error) {
        logError('UserStitches', 'Failed to fetch threads', {
          userId,
          tube1Error,
          tube2Error,
          tube3Error
        });
        return formatErrorResponse(res, 500, 'Failed to fetch content threads');
      }
      
      // Prepare response data
      const threadsData = [];
      
      // Process Tube 1
      if (tube1ThreadsData && tube1ThreadsData.length > 0) {
        for (const thread of tube1ThreadsData) {
          // Get stitches for this thread
          const { data: stitchesData, error: stitchesError } = await db
            .from('stitches')
            .select('*, questions(*)')
            .eq('thread_id', thread.id)
            .order('order_number', { ascending: true });
          
          if (stitchesError) {
            logError('UserStitches', 'Failed to fetch stitches for thread', {
              userId,
              threadId: thread.id,
              error: stitchesError
            });
            continue;
          }
          
          // Apply free tier limitations if needed
          let limitedStitches = stitchesData;
          if (isFreeTier && !isAdmin) {
            const positionLimit = getFreeTierPositionLimit(1, { freeTierStitchLimit: FREE_TIER_STITCH_LIMIT });
            
            // Filter stitches for free tier users
            limitedStitches = stitchesData.filter((stitch, index) => {
              // Allow first N stitches based on order_number (which is 0-based)
              return stitch.order_number <= positionLimit;
            });
            
            // Add prefetch count for smoother experience
            const additionalStitches = stitchesData
              .filter(stitch => stitch.order_number > positionLimit)
              .slice(0, prefetchCount);
            
            // Add a special flag to additional stitches to indicate they're premium
            additionalStitches.forEach(stitch => {
              stitch.is_premium = true;
              // Modify questions to include only basic info, not answers
              if (stitch.questions) {
                stitch.questions = stitch.questions.map(q => ({
                  id: q.id,
                  question: q.question,
                  options: q.options,
                  preview: true // Flag to indicate this is a preview
                }));
              }
            });
            
            // Combine free and teaser stitches
            limitedStitches = [...limitedStitches, ...additionalStitches];
          }
          
          // Add to threads data
          threadsData.push({
            thread_id: thread.id,
            tube_number: 1,
            stitches: limitedStitches,
            orderMap: limitedStitches.map(stitch => ({
              stitch_id: stitch.id,
              order_number: stitch.order_number
            }))
          });
        }
      }
      
      // Process Tube 2 - similar to Tube 1
      if (tube2ThreadsData && tube2ThreadsData.length > 0) {
        for (const thread of tube2ThreadsData) {
          // Get stitches for this thread
          const { data: stitchesData, error: stitchesError } = await db
            .from('stitches')
            .select('*, questions(*)')
            .eq('thread_id', thread.id)
            .order('order_number', { ascending: true });
          
          if (stitchesError) {
            logError('UserStitches', 'Failed to fetch stitches for thread', {
              userId,
              threadId: thread.id,
              error: stitchesError
            });
            continue;
          }
          
          // Apply free tier limitations if needed
          let limitedStitches = stitchesData;
          if (isFreeTier && !isAdmin) {
            const positionLimit = getFreeTierPositionLimit(2, { freeTierStitchLimit: FREE_TIER_STITCH_LIMIT });
            
            // Filter stitches for free tier users
            limitedStitches = stitchesData.filter((stitch, index) => {
              return stitch.order_number <= positionLimit;
            });
            
            // Add prefetch count for smoother experience
            const additionalStitches = stitchesData
              .filter(stitch => stitch.order_number > positionLimit)
              .slice(0, prefetchCount);
            
            // Add a special flag to additional stitches to indicate they're premium
            additionalStitches.forEach(stitch => {
              stitch.is_premium = true;
              // Modify questions to include only basic info, not answers
              if (stitch.questions) {
                stitch.questions = stitch.questions.map(q => ({
                  id: q.id,
                  question: q.question,
                  options: q.options,
                  preview: true
                }));
              }
            });
            
            // Combine free and teaser stitches
            limitedStitches = [...limitedStitches, ...additionalStitches];
          }
          
          // Add to threads data
          threadsData.push({
            thread_id: thread.id,
            tube_number: 2,
            stitches: limitedStitches,
            orderMap: limitedStitches.map(stitch => ({
              stitch_id: stitch.id,
              order_number: stitch.order_number
            }))
          });
        }
      }
      
      // Process Tube 3 - similar to other tubes
      if (tube3ThreadsData && tube3ThreadsData.length > 0) {
        for (const thread of tube3ThreadsData) {
          // Get stitches for this thread
          const { data: stitchesData, error: stitchesError } = await db
            .from('stitches')
            .select('*, questions(*)')
            .eq('thread_id', thread.id)
            .order('order_number', { ascending: true });
          
          if (stitchesError) {
            logError('UserStitches', 'Failed to fetch stitches for thread', {
              userId,
              threadId: thread.id,
              error: stitchesError
            });
            continue;
          }
          
          // Apply free tier limitations if needed
          let limitedStitches = stitchesData;
          if (isFreeTier && !isAdmin) {
            const positionLimit = getFreeTierPositionLimit(3, { freeTierStitchLimit: FREE_TIER_STITCH_LIMIT });
            
            // Filter stitches for free tier users
            limitedStitches = stitchesData.filter((stitch, index) => {
              return stitch.order_number <= positionLimit;
            });
            
            // Add prefetch count for smoother experience
            const additionalStitches = stitchesData
              .filter(stitch => stitch.order_number > positionLimit)
              .slice(0, prefetchCount);
            
            // Add a special flag to additional stitches to indicate they're premium
            additionalStitches.forEach(stitch => {
              stitch.is_premium = true;
              // Modify questions to include only basic info, not answers
              if (stitch.questions) {
                stitch.questions = stitch.questions.map(q => ({
                  id: q.id,
                  question: q.question,
                  options: q.options,
                  preview: true
                }));
              }
            });
            
            // Combine free and teaser stitches
            limitedStitches = [...limitedStitches, ...additionalStitches];
          }
          
          // Add to threads data
          threadsData.push({
            thread_id: thread.id,
            tube_number: 3,
            stitches: limitedStitches,
            orderMap: limitedStitches.map(stitch => ({
              stitch_id: stitch.id,
              order_number: stitch.order_number
            }))
          });
        }
      }
      
      // Get current tube position
      const { data: positionData, error: positionError } = await db
        .from('user_tube_positions')
        .select('tube_number, thread_id')
        .eq('user_id', userId)
        .single();
      
      // Default position if not found
      const tubePosition = positionError || !positionData 
        ? { tubeNumber: 1, threadId: tube1ThreadsData?.[0]?.id || 'thread-T1-001' }
        : { tubeNumber: positionData.tube_number, threadId: positionData.thread_id };
      
      // Return success response
      return formatSuccessResponse(res, {
        success: true,
        data: threadsData,
        tubePosition,
        isFreeTier
      });
    } catch (error) {
      logError('UserStitches', 'Failed to fetch user stitches', {
        userId,
        error
      });
      return formatErrorResponse(res, 500, 'Failed to fetch user content');
    }
  },
  {
    methods: ['GET'],
    context: 'UserStitches',
    requireAuth: false,
    allowAnonymous: true
  }
);