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
    
    // Create a minimal response with default tube position
    const minimalResponse = {
      success: true,
      // Minimal thread data - just enough for the app to function
      threads: [
        { id: 'thread-T1-001', tube_number: 1, title: 'Number Facts', order_number: 1 },
        { id: 'thread-T2-001', tube_number: 2, title: 'Using Numbers', order_number: 1 },
        { id: 'thread-T3-001', tube_number: 3, title: 'Number Patterns', order_number: 1 }
      ],
      // Default tube position
      tubePosition: { 
        tubeNumber: 1, 
        threadId: 'thread-T1-001'
      },
      isFreeTier: true,
      message: 'EMERGENCY MODE: Static data - database bypassed to avoid 504 timeouts'
    };
    
    // Add a cache header to prevent Vercel from repeatedly requesting this
    res.setHeader('Cache-Control', 'public, s-maxage=604800');
    
    // Return the minimal data
    return res.status(200).json(minimalResponse);
  } catch (error) {
    console.error('Error in emergency user-stitches handler', error);
    return res.status(200).json({
      success: true,
      threads: [],
      tubePosition: { tubeNumber: 1, threadId: 'thread-T1-001' },
      isFreeTier: true,
      message: 'Fallback emergency data'
    });
  }
}