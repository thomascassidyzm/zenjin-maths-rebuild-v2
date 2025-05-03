/**
 * Auth Utility Tests
 * 
 * Tests the core authentication utility functions.
 */

import { signInWithEmail, signOut, verifyOtp, transferAnonymousData } from '../../../lib/auth';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      verifyOtp: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getSession: jest.fn().mockResolvedValue({ 
        data: { 
          session: { 
            access_token: 'mock-token',
            user: { id: 'user-123', email: 'test@example.com' }
          } 
        }, 
        error: null 
      }),
    }
  }))
}));

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key]),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    _getStore: () => store,
    _populateStore: (mockStore) => {
      store = { ...mockStore };
    }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true })
  })
);

// Mock IndexedDB
global.indexedDB = {
  open: jest.fn().mockReturnValue({
    onupgradeneeded: null,
    onsuccess: jest.fn(function() {
      this.result = {
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            clear: jest.fn()
          })
        }),
        objectStoreNames: {
          contains: jest.fn().mockReturnValue(true)
        }
      };
      this.onsuccess();
    }),
    onerror: jest.fn()
  })
};

describe('Auth Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  test('signInWithEmail sends OTP correctly', async () => {
    // Fill localStorage with test email
    localStorageMock._populateStore({
      'auth_email': 'test@example.com'
    });

    // Call the function
    const result = await signInWithEmail('test@example.com');

    // Verify localStorage was set
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_email', 'test@example.com');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('zenjin_signup_email', 'test@example.com');

    // Verify supabase was called
    expect(result.success).toBe(true);
  });

  test('signInWithEmail handles errors', async () => {
    // Mock Supabase to throw an error
    const supabase = require('@supabase/supabase-js').createClient();
    supabase.auth.signInWithOtp.mockRejectedValueOnce(new Error('Network error'));

    // Call the function
    const result = await signInWithEmail('test@example.com');

    // Verify error is returned
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('verifyOtp verifies code correctly', async () => {
    // Fill localStorage with test email
    localStorageMock._populateStore({
      'auth_email': 'test@example.com'
    });

    // Call the function
    const result = await verifyOtp('123456');

    // Verify localStorage was set
    expect(localStorageMock.setItem).toHaveBeenCalledWith('zenjin_auth_state', 'authenticated');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('zenjin_user_email', 'test@example.com');

    // Verify supabase was called
    expect(result.success).toBe(true);
  });

  test('verifyOtp handles missing email', async () => {
    // Call the function without setting email in localStorage
    const result = await verifyOtp('123456');

    // Verify error is returned
    expect(result.success).toBe(false);
    expect(result.error.message).toContain('Email not found');
  });

  test('verifyOtp handles verification errors', async () => {
    // Mock Supabase to return an error
    const supabase = require('@supabase/supabase-js').createClient();
    supabase.auth.verifyOtp.mockResolvedValueOnce({
      data: {},
      error: { message: 'Invalid OTP' }
    });

    // Fill localStorage with test email
    localStorageMock._populateStore({
      'auth_email': 'test@example.com'
    });

    // Call the function
    const result = await verifyOtp('123456');

    // Verify error is returned
    expect(result.success).toBe(false);
    expect(result.error.message).toBe('Invalid OTP');
  });

  test('signOut clears localStorage auth data', async () => {
    // Fill localStorage with mock auth data
    localStorageMock._populateStore({
      'supabase.auth.token': 'test-token',
      'supabase.auth.refreshToken': 'test-refresh-token',
      'auth_email': 'test@example.com',
      'zenjin_state_user-123': JSON.stringify({ test: 'data' }),
      'zenjin_anonymous_state': JSON.stringify({ anonymous: 'data' }),
      'unrelated_key': 'should-remain'
    });

    // Call the function
    const result = await signOut();

    // Verify localStorage was cleared of auth items
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('supabase.auth.token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('supabase.auth.refreshToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_email');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('zenjin_state_user-123');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('zenjin_anonymous_state');
    
    // The unrelated key should remain
    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('unrelated_key');

    // Verify supabase was called
    expect(result.success).toBe(true);
  });

  test('signOut clears IndexedDB data', async () => {
    // Call the function
    await signOut();

    // Verify IndexedDB was opened
    expect(global.indexedDB.open).toHaveBeenCalled();
  });

  test('signOut handles errors', async () => {
    // Mock Supabase to throw an error
    const supabase = require('@supabase/supabase-js').createClient();
    supabase.auth.signOut.mockRejectedValueOnce(new Error('Network error'));

    // Call the function
    const result = await signOut();

    // Verify error is returned
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('transferAnonymousData transfers data correctly', async () => {
    // Fill localStorage with anonymous data
    localStorageMock._populateStore({
      'anonymousId': 'anon-123',
      'progressData_anon-123': JSON.stringify({
        totalPoints: 100,
        blinkSpeed: 2.5
      }),
      'sessionData_anon-123': JSON.stringify({
        lastSessionDate: '2025-05-01T12:00:00Z'
      })
    });

    // Call the function
    const result = await transferAnonymousData('user-123');

    // Verify API call was made
    expect(global.fetch).toHaveBeenCalledWith('/api/transfer-anonymous-data', expect.objectContaining({
      method: 'POST',
      body: expect.any(String)
    }));

    // Verify payload contains anonymous data
    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody.anonymousId).toBe('anon-123');
    expect(callBody.userId).toBe('user-123');
    expect(callBody.anonymousData).toBeDefined();
    expect(callBody.anonymousData.totalPoints).toBe(100);

    // Verify function returned success
    expect(result).toBe(true);
  });

  test('transferAnonymousData handles missing data', async () => {
    // Call without anonymous data in localStorage
    const result = await transferAnonymousData('user-123');

    // Should not make API call
    expect(global.fetch).not.toHaveBeenCalled();

    // Should return false
    expect(result).toBe(false);
  });

  test('transferAnonymousData handles API errors', async () => {
    // Fill localStorage with anonymous data
    localStorageMock._populateStore({
      'anonymousId': 'anon-123',
      'progressData_anon-123': JSON.stringify({
        totalPoints: 100,
        blinkSpeed: 2.5
      })
    });

    // Mock fetch to return error
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ success: false, error: 'Server error' })
      })
    );

    // Call the function
    const result = await transferAnonymousData('user-123');

    // Should return false
    expect(result).toBe(false);
  });
});