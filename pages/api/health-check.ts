/**
 * Simple health check endpoint
 * Used by the offline page to detect when connectivity is restored
 */
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Simple health check response
  res.status(200).json({ 
    status: 'ok',
    timestamp: Date.now(),
    environment: process.env.NODE_ENV,
    version: '2.0.0'
  });
}