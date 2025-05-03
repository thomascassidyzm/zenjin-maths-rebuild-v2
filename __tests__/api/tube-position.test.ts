/**
 * API Tube Position Tests
 * 
 * Tests the API endpoints for managing tube positions and stitch progress.
 */

import { createMocks } from 'node-mocks-http';
import saveTubePositionHandler from '../../pages/api/save-tube-position';
import userStitchesHandler from '../../pages/api/user-stitches';
import updateStitchPositionsHandler from '../../pages/api/update-stitch-positions';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
    },
    from: jest.fn().mockImplementation((table) => ({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'new-record-id' },
            error: null
          })
        })
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [{ id: 'updated-record-id' }],
            error: null
          })
        })
      }),
      upsert: jest.fn().mockResolvedValue({
        data: [{ id: 'upserted-record-id' }],
        error: null
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'stitch-record-1',
                  user_id: 'test-user-id',
                  thread_id: 'thread-T1-001',
                  stitch_id: 'stitch-T1-001-01',
                  order_number: 0,
                  skip_number: 3,
                  distractor_level: 'L1',
                  is_current_tube: true
                }
              ],
              error: null
            })
          })
        }),
        in: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      })
    }))
  }))
}));

// Mock Thread and Stitch data
jest.mock('../../lib/data/thread-data', () => ({
  getAllThreads: jest.fn().mockResolvedValue([
    {
      id: 'thread-T1-001',
      name: 'Addition Facts',
      tube_number: 1,
      stitches: [
        {
          id: 'stitch-T1-001-01',
          thread_id: 'thread-T1-001',
          title: 'Basic Addition',
          order: 1,
          questions: [
            {
              id: 'q1',
              text: '1 + 1',
              correctAnswer: '2',
              distractors: { L1: '3', L2: '4', L3: '11' }
            }
          ]
        }
      ]
    },
    {
      id: 'thread-T2-001',
      name: 'Subtraction Facts',
      tube_number: 2,
      stitches: [
        {
          id: 'stitch-T2-001-01',
          thread_id: 'thread-T2-001',
          title: 'Basic Subtraction',
          order: 1,
          questions: [
            {
              id: 'q1',
              text: '3 - 1',
              correctAnswer: '2',
              distractors: { L1: '1', L2: '4', L3: '3' }
            }
          ]
        }
      ]
    }
  ])
}));

describe('Tube Position API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('/api/save-tube-position', () => {
    test('saves tube position for valid request', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'test-user-id',
          tubeNumber: 1,
          threadId: 'thread-T1-001'
        },
        headers: {
          'content-type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });

      await saveTubePositionHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(200);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      
      // Verify function call arguments
      const supabase = require('@supabase/supabase-js').createClient();
      const userStitchProgressTable = supabase.from('user_stitch_progress');
      
      // Should update current tube flag
      expect(userStitchProgressTable.update).toHaveBeenCalled();
      
      // Should also insert a record for backward compatibility
      expect(userStitchProgressTable.upsert).toHaveBeenCalled();
    });

    test('rejects invalid tube number', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'test-user-id',
          tubeNumber: 5, // Invalid: must be 1-3
          threadId: 'thread-T1-001'
        },
        headers: {
          'content-type': 'application/json'
        }
      });

      await saveTubePositionHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(400);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Invalid tube number');
    });

    test('requires all required fields', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'test-user-id',
          // Missing tubeNumber and threadId
        },
        headers: {
          'content-type': 'application/json'
        }
      });

      await saveTubePositionHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(400);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
    });
  });

  describe('/api/user-stitches', () => {
    test('retrieves user stitches and tube position', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: {
          userId: 'test-user-id'
        },
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });

      // Mock the thread data retrieval
      const threadData = require('../../lib/data/thread-data');
      
      await userStitchesHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(200);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.data).toBeInstanceOf(Array);
      expect(responseData.tubePosition).toBeDefined();
      expect(responseData.tubePosition.tubeNumber).toBeDefined();
    });

    test('handles missing user ID', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: {
          // Missing userId
        }
      });

      await userStitchesHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(400);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('userId is required');
    });

    test('returns default tube position if none found', async () => {
      // Mock empty response from Supabase to simulate no tube position found
      const supabase = require('@supabase/supabase-js').createClient();
      const userStitchProgressTable = supabase.from('user_stitch_progress');
      userStitchProgressTable.select().eq().order().limit.mockResolvedValueOnce({
        data: [], // No records found
        error: null
      });
      
      const { req, res } = createMocks({
        method: 'GET',
        query: {
          userId: 'test-user-id'
        }
      });

      await userStitchesHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(200);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      
      // Should have default tube position (tube 1)
      expect(responseData.tubePosition).toBeDefined();
      expect(responseData.tubePosition.tubeNumber).toBe(1);
    });
  });

  describe('/api/update-stitch-positions', () => {
    test('updates stitch positions for valid request', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'test-user-id',
          stitches: [
            {
              threadId: 'thread-T1-001',
              stitchId: 'stitch-T1-001-01',
              orderNumber: 0,
              skipNumber: 3,
              distractorLevel: 'L1',
              is_current_tube: true
            },
            {
              threadId: 'thread-T1-001',
              stitchId: 'stitch-T1-001-02',
              orderNumber: 1,
              skipNumber: 3,
              distractorLevel: 'L1',
              is_current_tube: false
            }
          ]
        },
        headers: {
          'content-type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });

      await updateStitchPositionsHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(200);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      
      // Verify function call arguments
      const supabase = require('@supabase/supabase-js').createClient();
      const userStitchProgressTable = supabase.from('user_stitch_progress');
      
      // Should upsert the stitch positions
      expect(userStitchProgressTable.upsert).toHaveBeenCalled();
    });

    test('requires all required fields', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'test-user-id',
          // Missing stitches array
        },
        headers: {
          'content-type': 'application/json'
        }
      });

      await updateStitchPositionsHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(400);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
    });

    test('validates stitch data format', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'test-user-id',
          stitches: [
            {
              // Missing required fields
              stitchId: 'stitch-T1-001-01'
              // No threadId, orderNumber, etc.
            }
          ]
        },
        headers: {
          'content-type': 'application/json'
        }
      });

      await updateStitchPositionsHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(400);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Invalid stitch data');
    });
  });
});