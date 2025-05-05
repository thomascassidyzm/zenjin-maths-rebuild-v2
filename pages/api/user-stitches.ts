/**
 * EMERGENCY BYPASS VERSION (2025-05-05):
 * 
 * This is a HARDCODED EMERGENCY VERSION of the user-stitches endpoint
 * that returns static data without any database queries to avoid 504 timeouts.
 * 
 * This completely bypasses the database and returns minimal hardcoded data
 * sufficient to allow the app to function, though with limited functionality.
 * 
 * Once the root cause of the 504 issues is fixed, this should be replaced
 * with the proper implementation.
 */
import { NextApiRequest, NextApiResponse } from 'next';

// Function to generate a hardcoded response with minimal needed data
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Log the request
    console.log('EMERGENCY MODE: Bypassing database for user-stitches API', { query: req.query });
    
    // Extract user ID from query
    const userId = req.query.userId as string;
    
    // IMPROVED EMERGENCY RESPONSE: Every tube now has valid content
    // This ensures proper tube cycling in the Triple Helix player
    const improvedResponse = {
      success: true,
      // CRITICAL: The client expects a 'data' array of thread objects
      data: [
        {
          thread_id: 'thread-T1-001',
          tube_number: 1,
          stitches: [
            {
              id: 'stitch-T1-001-01',
              thread_id: 'thread-T1-001',
              content: 'Emergency content for Tube 1',
              description: 'First stitch',
              order_number: 0,
              skip_number: 3,
              distractor_level: 'L1',
              questions: [
                {
                  id: 'stitch-T1-001-01-q01',
                  question: 'Placeholder question for Tube 1',
                  answer: 'Continue',
                  distractors: { L1: 'Wait', L2: 'Retry', L3: 'Skip' }
                }
              ]
            }
          ],
          orderMap: [{ stitch_id: 'stitch-T1-001-01', order_number: 0 }]
        },
        {
          thread_id: 'thread-T2-001',
          tube_number: 2,
          stitches: [
            {
              id: 'stitch-T2-001-01',
              thread_id: 'thread-T2-001',
              content: 'Emergency content for Tube 2',
              description: 'First stitch in tube 2',
              order_number: 0,
              skip_number: 3,
              distractor_level: 'L1',
              questions: [
                {
                  id: 'stitch-T2-001-01-q01',
                  question: 'Placeholder question for Tube 2',
                  answer: 'Continue',
                  distractors: { L1: 'Wait', L2: 'Retry', L3: 'Skip' }
                }
              ]
            }
          ],
          orderMap: [{ stitch_id: 'stitch-T2-001-01', order_number: 0 }]
        },
        {
          thread_id: 'thread-T3-001',
          tube_number: 3,
          stitches: [
            {
              id: 'stitch-T3-001-01',
              thread_id: 'thread-T3-001',
              content: 'Emergency content for Tube 3',
              description: 'First stitch in tube 3',
              order_number: 0,
              skip_number: 3,
              distractor_level: 'L1',
              questions: [
                {
                  id: 'stitch-T3-001-01-q01',
                  question: 'Placeholder question for Tube 3',
                  answer: 'Continue',
                  distractors: { L1: 'Wait', L2: 'Retry', L3: 'Skip' }
                }
              ]
            }
          ],
          orderMap: [{ stitch_id: 'stitch-T3-001-01', order_number: 0 }]
        }
      ],
      // Default tube position
      tubePosition: { 
        tubeNumber: 1, 
        threadId: 'thread-T1-001'
      },
      isFreeTier: true,
      message: 'EMERGENCY MODE: Static data - database bypassed to avoid 504 timeouts'
    };
    
    // Add cache headers to prevent Vercel from repeatedly requesting this
    // This helps reduce load on the server during high traffic periods
    res.setHeader('Cache-Control', 'public, s-maxage=604800');
    
    // Add debugging headers so we can track when this endpoint is called
    res.setHeader('X-Zenjin-Emergency-Mode', 'true');
    res.setHeader('X-Zenjin-UserId', userId || 'unknown');
    
    // Debug output to help track issues
    console.log('EMERGENCY MODE: Returning valid response with thread data:', {
      threadCount: improvedResponse.data.length,
      tubePosition: improvedResponse.tubePosition
    });
    
    // Return the improved emergency data with all required fields
    return res.status(200).json(improvedResponse);
  } catch (error) {
    console.error('Error in emergency user-stitches handler', error);
    
    // Even in error case, provide a minimal valid response with data array
    // This ensures the client has something to work with even in error cases
    return res.status(200).json({
      success: true,
      data: [
        {
          thread_id: 'thread-T1-001',
          tube_number: 1,
          stitches: [
            {
              id: 'stitch-T1-001-01',
              thread_id: 'thread-T1-001',
              content: 'Fallback emergency content',
              description: 'Emergency stitch',
              order_number: 0,
              skip_number: 3,
              distractor_level: 'L1',
              questions: [
                {
                  id: 'stitch-T1-001-01-q01',
                  question: 'Emergency fallback question',
                  answer: 'Continue',
                  distractors: { L1: 'Wait', L2: 'Retry', L3: 'Skip' }
                }
              ]
            }
          ],
          orderMap: [{ stitch_id: 'stitch-T1-001-01', order_number: 0 }]
        },
        {
          thread_id: 'thread-T2-001',
          tube_number: 2,
          stitches: [
            {
              id: 'stitch-T2-001-01',
              thread_id: 'thread-T2-001',
              content: 'Fallback emergency content for Tube 2',
              description: 'Emergency stitch for tube 2',
              order_number: 0,
              skip_number: 3,
              distractor_level: 'L1',
              questions: [
                {
                  id: 'stitch-T2-001-01-q01',
                  question: 'Emergency fallback question for Tube 2',
                  answer: 'Continue',
                  distractors: { L1: 'Wait', L2: 'Retry', L3: 'Skip' }
                }
              ]
            }
          ],
          orderMap: [{ stitch_id: 'stitch-T2-001-01', order_number: 0 }]
        },
        {
          thread_id: 'thread-T3-001',
          tube_number: 3,
          stitches: [
            {
              id: 'stitch-T3-001-01',
              thread_id: 'thread-T3-001',
              content: 'Fallback emergency content for Tube 3',
              description: 'Emergency stitch for tube 3',
              order_number: 0,
              skip_number: 3,
              distractor_level: 'L1',
              questions: [
                {
                  id: 'stitch-T3-001-01-q01',
                  question: 'Emergency fallback question for Tube 3',
                  answer: 'Continue',
                  distractors: { L1: 'Wait', L2: 'Retry', L3: 'Skip' }
                }
              ]
            }
          ],
          orderMap: [{ stitch_id: 'stitch-T3-001-01', order_number: 0 }]
        }
      ],
      tubePosition: { tubeNumber: 1, threadId: 'thread-T1-001' },
      isFreeTier: true,
      message: 'Fallback emergency data'
    });
  }
}