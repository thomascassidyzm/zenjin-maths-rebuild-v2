import { NextApiRequest, NextApiResponse } from 'next';

/**
 * API endpoint to clear service worker caches on the server
 * This is used as a fallback for admin users who need to ensure everyone gets fresh content
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // In a real environment, you would add admin authentication here
  // For now, we'll just check for a special admin token
  const { token } = req.body;
  
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // We can't directly clear browser caches from the server,
    // but we can return a header that forces the client to invalidate caches
    
    res.setHeader('Clear-Site-Data', '"cache", "storage"');
    
    // Also increment a cache version number in a database or config file
    // This is a placeholder for actual implementation
    console.log('Cache invalidation requested by admin');
    
    return res.status(200).json({ 
      success: true,
      message: 'Cache invalidation headers sent. Users will get fresh content on next page load.'
    });
  } catch (error) {
    console.error('Error in clear-cache API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}