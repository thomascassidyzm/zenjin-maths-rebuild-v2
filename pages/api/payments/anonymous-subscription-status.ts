/**
 * EMERGENCY BYPASS VERSION (2025-05-06):
 * 
 * This is a simplified version of the anonymous subscription status endpoint
 * that returns hardcoded subscription data without any handler dependencies.
 * 
 * It ensures anonymous users always have access to free tier content.
 */
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get anonymous ID from body or query
    const anonymousId = req.query.anonymousId as string || 
                       req.body?.anonymousId || 
                       'anonymous';
    
    console.log('EMERGENCY MODE: Processing anonymous subscription status for ID:', anonymousId);
    
    // Set headers for debugging
    res.setHeader('X-Zenjin-Emergency-Mode', 'true');
    res.setHeader('X-Zenjin-Anonymous-Id', anonymousId);
    
    // Simple caching to reduce load - 1 day cache
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    
    // Return a standard free tier subscription status
    return res.status(200).json({
      success: true,
      data: {
        active: false,
        status: 'free',
        subscription: null,
        tier: 'free',
        features: ['content_tier_1', 'content_tier_2', 'content_tier_3'],
        updatedAt: new Date().toISOString(),
        isAnonymous: true,
        anonymousId,
        message: 'EMERGENCY MODE: Free tier access for anonymous user'
      }
    });
  } catch (error) {
    console.error('Error in emergency anonymous-subscription-status handler:', error);
    
    // Even in case of error, return a valid free tier response
    return res.status(200).json({
      success: true,
      data: {
        active: false,
        status: 'free',
        subscription: null,
        tier: 'free',
        features: ['content_tier_1', 'content_tier_2', 'content_tier_3'],
        updatedAt: new Date().toISOString(),
        isAnonymous: true,
        anonymousId: 'anonymous-fallback',
        message: 'EMERGENCY FALLBACK: Default anonymous free tier access'
      }
    });
  }
}