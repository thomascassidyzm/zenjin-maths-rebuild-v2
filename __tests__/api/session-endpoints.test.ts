/**
 * API Session Recording Tests
 * 
 * Tests the API endpoints for recording session results and managing user progress.
 */

import { createMocks } from 'node-mocks-http';
import recordSessionHandler from '../../pages/api/record-session';
import endSessionHandler from '../../pages/api/end-session';
import resetProgressHandler from '../../pages/api/reset-progress';
import userProgressHandler from '../../pages/api/user-progress';

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
                  id: 'session-record-1',
                  user_id: 'test-user-id',
                  thread_id: 'thread-T1-001',
                  stitch_id: 'stitch-T1-001-01',
                  total_points: 100,
                  completed_at: '2025-05-01T12:00:00Z'
                }
              ],
              error: null
            })
          }),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'profile-record-1',
              user_id: 'test-user-id',
              total_points: 100,
              avg_blink_speed: 2.5,
              evolution_level: 1
            },
            error: null
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

describe('Session API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('/api/record-session', () => {
    test('records session data for valid request', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'test-user-id',
          threadId: 'thread-T1-001',
          stitchId: 'stitch-T1-001-01',
          questionResults: [
            {
              questionId: 'q1',
              correct: true,
              timeToAnswer: 1500,
              firstTimeCorrect: true
            },
            {
              questionId: 'q2',
              correct: false,
              timeToAnswer: 2000,
              firstTimeCorrect: false
            },
            {
              questionId: 'q2',
              correct: true,
              timeToAnswer: 1800,
              firstTimeCorrect: false
            }
          ],
          sessionDuration: 60
        },
        headers: {
          'content-type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });

      await recordSessionHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(200);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.sessionId).toBeDefined();
      expect(responseData.totalPoints).toBeDefined();
      
      // Verify function call arguments
      const supabase = require('@supabase/supabase-js').createClient();
      const sessionResultsTable = supabase.from('session_results');
      
      // Should insert a new session record
      expect(sessionResultsTable.insert).toHaveBeenCalled();
      
      // Verify the insert call contains the correct data
      const insertCall = sessionResultsTable.insert.mock.calls[0][0];
      expect(insertCall.thread_id).toBe('thread-T1-001');
      expect(insertCall.stitch_id).toBe('stitch-T1-001-01');
      expect(insertCall.results).toBeInstanceOf(Array);
      expect(insertCall.results.length).toBe(3);
      expect(insertCall.total_points).toBeDefined();
      expect(insertCall.accuracy).toBeDefined();
      expect(insertCall.duration).toBe(60);
    });

    test('validates required fields', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'test-user-id',
          // Missing threadId and stitchId
          questionResults: []
        },
        headers: {
          'content-type': 'application/json'
        }
      });

      await recordSessionHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(400);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
    });

    test('handles empty question results gracefully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'test-user-id',
          threadId: 'thread-T1-001',
          stitchId: 'stitch-T1-001-01',
          questionResults: [], // Empty results
          sessionDuration: 60
        },
        headers: {
          'content-type': 'application/json'
        }
      });

      await recordSessionHandler(req, res);

      // Should still succeed with default values
      expect(res._getStatusCode()).toBe(200);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.totalPoints).toBe(0); // Default points for no results
    });
  });

  describe('/api/end-session', () => {
    test('processes full session end for valid request', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'test-user-id',
          threadId: 'thread-T1-001',
          stitchId: 'stitch-T1-001-01',
          points: 30,
          questionResults: [
            {
              questionId: 'q1',
              correct: true,
              timeToAnswer: 1500,
              firstTimeCorrect: true
            }
          ],
          correctAnswers: 10,
          totalQuestions: 10,
          sessionDuration: 60,
          tubeUpdates: [
            {
              tubeNumber: 2,
              threadId: 'thread-T2-001'
            }
          ],
          stitchUpdates: [
            {
              threadId: 'thread-T1-001',
              stitchId: 'stitch-T1-001-01',
              orderNumber: 3,
              skipNumber: 3,
              distractorLevel: 'L1'
            },
            {
              threadId: 'thread-T1-001',
              stitchId: 'stitch-T1-001-02',
              orderNumber: 0,
              skipNumber: 3,
              distractorLevel: 'L1'
            }
          ]
        },
        headers: {
          'content-type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });

      await endSessionHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(200);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.summary).toBeDefined();
      
      // Verify supabase calls
      const supabase = require('@supabase/supabase-js').createClient();
      
      // Should record session results
      expect(supabase.from('session_results').insert).toHaveBeenCalled();
      
      // Should update user profile
      expect(supabase.from('profiles').select().eq().single).toHaveBeenCalled();
      expect(supabase.from('profiles').upsert).toHaveBeenCalled();
      
      // Should update tube position
      expect(supabase.from('user_stitch_progress').update).toHaveBeenCalled();
      
      // Should update stitch positions
      expect(supabase.from('user_stitch_progress').upsert).toHaveBeenCalled();
    });

    test('validates required fields', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'test-user-id',
          // Missing other required fields
        },
        headers: {
          'content-type': 'application/json'
        }
      });

      await endSessionHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(400);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
    });

    test('handles database errors gracefully', async () => {
      // Mock a database error
      const supabase = require('@supabase/supabase-js').createClient();
      supabase.from('session_results').insert().select().single.mockRejectedValueOnce({
        error: 'Database error'
      });
      
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'test-user-id',
          threadId: 'thread-T1-001',
          stitchId: 'stitch-T1-001-01',
          points: 30,
          questionResults: [
            {
              questionId: 'q1',
              correct: true,
              timeToAnswer: 1500,
              firstTimeCorrect: true
            }
          ],
          correctAnswers: 10,
          totalQuestions: 10,
          sessionDuration: 60
        },
        headers: {
          'content-type': 'application/json'
        }
      });

      await endSessionHandler(req, res);

      // Should return an error
      expect(res._getStatusCode()).toBe(500);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
    });
  });

  describe('/api/reset-progress', () => {
    test('resets user progress', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'test-user-id'
        },
        headers: {
          'content-type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });

      await resetProgressHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(200);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      
      // Verify supabase calls
      const supabase = require('@supabase/supabase-js').createClient();
      
      // Should delete user stitch progress
      expect(supabase.from('user_stitch_progress').delete().eq).toHaveBeenCalled();
    });

    test('requires userId field', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          // Missing userId
        },
        headers: {
          'content-type': 'application/json'
        }
      });

      await resetProgressHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(400);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('userId is required');
    });
  });

  describe('/api/user-progress', () => {
    test('retrieves user progress data', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: {
          userId: 'test-user-id'
        },
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });

      await userProgressHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(200);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.totalPoints).toBeDefined();
      expect(responseData.evolution).toBeDefined();
      expect(responseData.recentSessions).toBeDefined();
      
      // Verify supabase calls
      const supabase = require('@supabase/supabase-js').createClient();
      
      // Should get user profile
      expect(supabase.from('profiles').select().eq().single).toHaveBeenCalled();
      
      // Should get recent sessions
      expect(supabase.from('session_results').select().eq().order().limit).toHaveBeenCalled();
    });

    test('handles missing profile gracefully', async () => {
      // Mock profile not found
      const supabase = require('@supabase/supabase-js').createClient();
      supabase.from('profiles').select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Record not found' }
      });
      
      const { req, res } = createMocks({
        method: 'GET',
        query: {
          userId: 'test-user-id'
        }
      });

      await userProgressHandler(req, res);

      // Should still succeed with default values
      expect(res._getStatusCode()).toBe(200);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.totalPoints).toBe(0); // Default for no profile
      expect(responseData.evolution).toBeDefined();
      expect(responseData.evolution.level).toBe(1); // Default level
    });

    test('requires userId parameter', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: {
          // Missing userId
        }
      });

      await userProgressHandler(req, res);

      // Check response
      expect(res._getStatusCode()).toBe(400);
      
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('userId is required');
    });
  });
});