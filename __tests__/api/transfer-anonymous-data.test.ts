import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/transfer-anonymous-data';
import { getFreeUserAccessProfile } from '../../lib/tier-manager';

// Mock tier manager
jest.mock('../../lib/tier-manager', () => ({
  getFreeUserAccessProfile: jest.fn(() => ({
    tier: 'free',
    hasAccessToThreads: ['thread-A', 'thread-B', 'thread-C'],
    threadAccessMap: {
      'thread-A': { threadId: 'thread-A', accessLevel: 'full' },
      'thread-B': { threadId: 'thread-B', accessLevel: 'full' },
      'thread-C': { threadId: 'thread-C', accessLevel: 'full' }
    },
    maxPoints: null
  }))
}));

// Mock the Supabase client
jest.mock('../../lib/supabase/route', () => ({
  createRouteHandlerClient: jest.fn(() => ({
    from: jest.fn((table) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: { id: 'test-user-id' }, error: null })
        }))
      })),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null })
    }))
  }))
}));

describe('transfer-anonymous-data API', () => {
  let req: Partial<NextApiRequest>;
  let res: Partial<NextApiResponse>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    req = {
      method: 'POST',
      body: {
        userId: 'test-user-id',
        anonymousData: {
          state: {
            activeTubeNumber: 1,
            tubes: {
              1: {
                threadId: 'thread-A',
                stitches: [
                  { id: 'stitch-1', position: 0, skipNumber: 3, distractorLevel: 'L1' },
                  { id: 'stitch-2', position: 1, skipNumber: 3, distractorLevel: 'L1' }
                ]
              }
            }
          },
          totalPoints: 100
        }
      }
    };
    
    res = {
      status: statusMock
    };
  });

  it('should transfer anonymous data to authenticated user', async () => {
    await handler(req as NextApiRequest, res as NextApiResponse);
    
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      recordsTransferred: 2
    }));
  });

  it('should handle missing required fields', async () => {
    req.body = {};
    await handler(req as NextApiRequest, res as NextApiResponse);
    
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Missing required fields'
    }));
  });

  it('should handle invalid session format', async () => {
    req.body = {
      userId: 'test-user-id',
      anonymousData: {
        state: {},
        totalPoints: 100
      }
    };
    
    await handler(req as NextApiRequest, res as NextApiResponse);
    
    expect(statusMock).toHaveBeenCalledWith(expect.any(Number));
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      success: false
      // Any error message is acceptable
    }));
  });
});