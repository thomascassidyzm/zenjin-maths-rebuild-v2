/**
 * EMERGENCY BYPASS VERSION (2025-05-05):
 * 
 * This is a SMARTER EMERGENCY VERSION of the user-stitches endpoint
 * that tries to use locally cached state data if available, or returns
 * hardcoded emergency data if necessary. It avoids database queries to 
 * prevent 504 timeouts.
 * 
 * Once the root cause of the 504 issues is fixed, this should be replaced
 * with the proper implementation.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// Read from localStorage-cache directory if available
const readFromCache = (userId: string) => {
  try {
    // Check if we have a cached version of this user's state
    const cacheDir = path.join(process.cwd(), 'localStorage-cache');
    if (!fs.existsSync(cacheDir)) {
      return null;
    }
    
    const userStatePath = path.join(cacheDir, `user_state_${userId}.json`);
    if (!fs.existsSync(userStatePath)) {
      return null;
    }
    
    // Read the cached state
    const cachedState = JSON.parse(fs.readFileSync(userStatePath, 'utf8'));
    return cachedState;
  } catch (error) {
    console.error('Error reading from cache:', error);
    return null;
  }
};

// Save to localStorage-cache directory for future use
const saveToCache = (userId: string, data: any) => {
  try {
    // Create cache directory if it doesn't exist
    const cacheDir = path.join(process.cwd(), 'localStorage-cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    // Write the data to cache
    const userStatePath = path.join(cacheDir, `user_state_${userId}.json`);
    fs.writeFileSync(userStatePath, JSON.stringify(data, null, 2));
    console.log(`Cached state data for user ${userId}`);
  } catch (error) {
    console.error('Error saving to cache:', error);
  }
};

// Function to generate a hardcoded response with minimal needed data
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Log the request
    console.log('EMERGENCY MODE: Bypassing database for user-stitches API', { query: req.query });
    
    // Extract user ID from query
    const userId = req.query.userId as string;
    
    // Try to read from cache first
    let cachedUserState = null;
    if (userId && !userId.startsWith('anonymous')) {
      cachedUserState = readFromCache(userId);
      
      if (cachedUserState) {
        console.log(`EMERGENCY MODE: Using cached state data for user ${userId}`);
        
        // Add emergency headers
        res.setHeader('X-Zenjin-Emergency-Mode', 'true');
        res.setHeader('X-Zenjin-Cache-Hit', 'true');
        res.setHeader('X-Zenjin-UserId', userId);
        
        // Return the cached data with a short cache time (1 hour)
        res.setHeader('Cache-Control', 'public, s-maxage=3600');
        return res.status(200).json(cachedUserState);
      }
    }
    
    // If we're here, there was no cache hit. Create baseline response.
    const baselineResponse = {
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
    
    // Check for continuation mode - if this is a request with continue=true, 
    // add position data from the request if available
    const continueMode = req.query.continue === 'true';
    if (continueMode) {
      const tubeNumber = parseInt(req.query.tubeNumber as string) || 1;
      const threadId = req.query.threadId as string || 'thread-T1-001';
      
      console.log(`EMERGENCY MODE: Continue mode detected - using position data from request: tube=${tubeNumber}, thread=${threadId}`);
      
      baselineResponse.tubePosition = {
        tubeNumber,
        threadId
      };
    }
    
    // Cache this response for authenticated users
    if (userId && !userId.startsWith('anonymous')) {
      saveToCache(userId, baselineResponse);
    }
    
    // Add cache headers to prevent Vercel from repeatedly requesting this
    // This helps reduce load on the server during high traffic periods
    // Use a moderate cache time since this is just the emergency fallback
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    
    // Add debugging headers so we can track when this endpoint is called
    res.setHeader('X-Zenjin-Emergency-Mode', 'true');
    res.setHeader('X-Zenjin-Cache-Miss', 'true');
    res.setHeader('X-Zenjin-UserId', userId || 'anonymous');
    
    // Debug output to help track issues
    console.log('EMERGENCY MODE: Returning valid response with thread data:', {
      threadCount: baselineResponse.data.length,
      tubePosition: baselineResponse.tubePosition,
      continueMode
    });
    
    // Return the baseline emergency data with all required fields
    return res.status(200).json(baselineResponse);
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