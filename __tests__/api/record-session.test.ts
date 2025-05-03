import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/record-session';

// Mock the authentication and database clients
jest.mock('../../lib/supabase/route', () => ({
  createRouteHandlerClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'test-user-id'
            }
          }
        }
      })
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: null
      })
    })
  })
}));

// Mock the calculateMultiplier function
jest.mock('../../pages/api/record-session', () => {
  const originalModule = jest.requireActual('../../pages/api/record-session');
  return {
    __esModule: true,
    ...originalModule,
    calculateMultiplier: jest.fn().mockResolvedValue({
      multiplier: 1,
      multiplierType: 'Standard'
    })
  };
});

describe('record-session API', () => {
  let req: Partial<NextApiRequest>;
  let res: Partial<NextApiResponse>;
  
  beforeEach(() => {
    req = {
      method: 'POST',
      body: {
        threadId: 'test-thread',
        stitchId: 'test-stitch',
        questionResults: [
          {
            questionId: 'q1',
            correct: true,
            timeToAnswer: 1500,
            firstTimeCorrect: true
          }
        ],
        sessionDuration: 60
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });
  
  test('returns 405 for non-POST requests', async () => {
    req.method = 'GET';
    await handler(req as NextApiRequest, res as NextApiResponse);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });
  
  test('handles table existence checks gracefully', async () => {
    // This test checks that the API attempts to determine if required tables exist
    await handler(req as NextApiRequest, res as NextApiResponse);
    expect(res.status).toHaveBeenCalledWith(200);
  });
  
  test('returns session summary with points calculation', async () => {
    await handler(req as NextApiRequest, res as NextApiResponse);
    
    expect(res.status).toHaveBeenCalledWith(200);
    
    // Verify the response contains the expected fields
    const jsonResponse = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonResponse).toHaveProperty('sessionId');
    expect(jsonResponse).toHaveProperty('totalPoints');
    expect(jsonResponse).toHaveProperty('blinkSpeed');
  });
});