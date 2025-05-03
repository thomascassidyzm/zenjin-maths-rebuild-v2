import { NextApiRequest, NextApiResponse } from 'next';

/**
 * DEPRECATED: This endpoint is being maintained for backward compatibility.
 * Please use /api/auth/update-password or /api/auth/set-password instead.
 * 
 * This handler redirects to the appropriate new endpoint based on the request.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.warn('DEPRECATED ENDPOINT: Using /api/update-password. Please use /api/auth/set-password or /api/auth/update-password');
  
  // Determine which endpoint to forward to
  const hasCurrentPassword = !!req.body.currentPassword;
  
  // Redirect the request to the proper endpoint
  const targetUrl = hasCurrentPassword ? '/api/auth/update-password' : '/api/auth/set-password';
  
  // Forward the request to the appropriate endpoint
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}${targetUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...req.headers as any
      },
      body: JSON.stringify(req.body)
    });
    
    // Return the same status and body from the forwarded request
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Error forwarding password update request:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error processing password update request'
    });
  }
}