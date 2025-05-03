import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/end-session';
import { SessionSummaryResponse } from '../../pages/api/end-session';

// Mock Supabase client
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
    from: jest.fn().mockImplementation((tableName) => {
      // Simulate table existence checks
      const mockResponse = {
        data: tableName === 'profiles' ? { total_points: 100, avg_blink_speed: 2.0, evolution_level: 2 } : null,
        error: null
      };
      
      return {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(mockResponse)
      };
    })
  })
}));

describe('end-session API', () => {
  let req: Partial<NextApiRequest>;
  let res: Partial<NextApiResponse>;
  
  beforeEach(() => {
    req = {
      method: 'POST',
      body: {
        userId: 'test-user-id',
        tubeUpdates: [
          {
            tubeNumber: 1,
            threadId: 'test-thread'
          }
        ],
        stitchUpdates: [
          {
            threadId: 'test-thread',
            stitchId: 'test-stitch',
            orderNumber: 0,
            skipNumber: 1,
            distractorLevel: 'L1'
          }
        ]
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
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Method not allowed' });
  });
  
  test('validates required parameters', async () => {
    req.body = {}; // Missing required parameters
    await handler(req as NextApiRequest, res as NextApiResponse);
    expect(res.status).toHaveBeenCalledWith(400);
  });
  
  test('returns session summary with profile data', async () => {
    await handler(req as NextApiRequest, res as NextApiResponse);
    
    expect(res.status).toHaveBeenCalledWith(200);
    
    // Verify the response contains the expected summary
    const jsonResponse = (res.json as jest.Mock).mock.calls[0][0] as SessionSummaryResponse;
    expect(jsonResponse.success).toBe(true);
    expect(jsonResponse.summary).toBeDefined();
    if (jsonResponse.summary) {
      expect(jsonResponse.summary.totalPoints).toBeDefined();
      expect(jsonResponse.summary.blinkSpeed).toBeDefined();
      expect(jsonResponse.summary.evolutionLevel).toBeDefined();
    }
  });
  
  test('handles table existence checks gracefully', async () => {
    // Mock implementation that simulates missing tables
    const createRouteHandlerClient = require('../../lib/supabase/route').createRouteHandlerClient;
    createRouteHandlerClient.mockImplementationOnce(() => ({
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
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Table does not exist' } })
      }))
    }));
    
    await handler(req as NextApiRequest, res as NextApiResponse);
    
    // Even with missing tables, the API should return a 200 response with default values
    expect(res.status).toHaveBeenCalledWith(200);
    const jsonResponse = (res.json as jest.Mock).mock.calls[0][0] as SessionSummaryResponse;
    expect(jsonResponse.success).toBe(true);
    expect(jsonResponse.summary).toBeDefined();
  });
});