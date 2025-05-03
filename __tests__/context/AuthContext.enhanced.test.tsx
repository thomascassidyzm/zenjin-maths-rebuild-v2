/**
 * Enhanced AuthContext Tests
 * 
 * Tests the comprehensive AuthContext implementation, including:
 * - Authentication state management
 * - User data loading
 * - Anonymous user support
 * - Offline mode functionality
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Mock the supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockImplementation(() => ({
        data: { 
          session: { 
            user: { id: 'test-user-id', email: 'test@example.com' }, 
            access_token: 'test-token' 
          } 
        },
        error: null
      })),
      onAuthStateChange: jest.fn(() => ({ 
        data: { subscription: { unsubscribe: jest.fn() } } 
      })),
      signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      verifyOtp: jest.fn().mockResolvedValue({ 
        data: { user: { id: 'test-user-id', email: 'test@example.com' } }, 
        error: null 
      }),
      signUp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null })
    }
  })),
}));

// Mock user data loading function
jest.mock('../../lib/loadUserData', () => ({
  loadUserData: jest.fn().mockResolvedValue({
    tubeData: { success: true, data: [] },
    progressData: { totalPoints: 100, blinkSpeed: 2.5 },
    dataTimestamp: Date.now()
  }),
  hasLocalUserData: jest.fn().mockReturnValue(true),
  getLocalUserData: jest.fn().mockReturnValue({
    tubeData: { success: true, data: [] },
    progressData: { totalPoints: 100, blinkSpeed: 2.5 },
    dataTimestamp: Date.now()
  }),
  clearUserData: jest.fn()
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

// Test component to access auth context
const TestAuthComponent = () => {
  const { 
    user, 
    isAuthenticated, 
    loading, 
    userData,
    userDataLoading,
    signIn, 
    signInWithEmail,
    verifyCode,
    signInAnonymously,
    signOut,
    refreshUserData
  } = useAuth();
  
  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
      <div data-testid="loading-status">
        {loading ? 'Loading' : 'Not Loading'}
      </div>
      <div data-testid="user-data-loading">
        {userDataLoading ? 'Loading User Data' : 'User Data Ready'}
      </div>
      <div data-testid="user-id">
        {user ? user.id : 'No User'}
      </div>
      <div data-testid="user-data">
        {userData ? `Total Points: ${userData.progressData.totalPoints}` : 'No User Data'}
      </div>
      
      <button 
        onClick={() => signIn('test@example.com', 'password')}
        data-testid="sign-in-button"
      >
        Sign In
      </button>
      
      <button 
        onClick={() => signInWithEmail('test@example.com')}
        data-testid="send-otp-button"
      >
        Send OTP
      </button>
      
      <button 
        onClick={() => verifyCode('123456')}
        data-testid="verify-code-button"
      >
        Verify Code
      </button>
      
      <button 
        onClick={signInAnonymously}
        data-testid="anonymous-button"
      >
        Anonymous
      </button>
      
      <button 
        onClick={signOut}
        data-testid="sign-out-button"
      >
        Sign Out
      </button>
      
      <button 
        onClick={refreshUserData}
        data-testid="refresh-button"
      >
        Refresh Data
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });
  
  test('initializes and checks session on mount', async () => {
    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );
    
    // Initial state should be loading
    expect(screen.getByTestId('loading-status')).toHaveTextContent('Loading');
    
    // After session check, should be authenticated
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Not Loading');
    });
    
    // User data should be loaded automatically after auth
    await waitFor(() => {
      expect(screen.getByTestId('user-data')).toHaveTextContent('Total Points: 100');
    });
  });
  
  test('signs in with email and password', async () => {
    const { loadUserData } = require('../../lib/loadUserData');
    
    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );
    
    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Not Loading');
    });
    
    // Reset mocks to check calls during sign in
    loadUserData.mockClear();
    
    // Click sign in button
    const signInButton = screen.getByTestId('sign-in-button');
    await act(async () => {
      userEvent.click(signInButton);
    });
    
    // Should call Supabase signInWithPassword and load user data
    await waitFor(() => {
      const supabase = require('@supabase/supabase-js').createClient();
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password'
      });
    });
  });
  
  test('handles OTP email verification flow', async () => {
    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );
    
    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Not Loading');
    });
    
    // Step 1: Send OTP
    const sendOtpButton = screen.getByTestId('send-otp-button');
    await act(async () => {
      userEvent.click(sendOtpButton);
    });
    
    // Should call Supabase signInWithOtp
    await waitFor(() => {
      const supabase = require('@supabase/supabase-js').createClient();
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: expect.anything()
      });
    });
    
    // Should store email in localStorage
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_email', 'test@example.com');
    
    // Step 2: Verify OTP code
    const verifyButton = screen.getByTestId('verify-code-button');
    await act(async () => {
      userEvent.click(verifyButton);
    });
    
    // Should call Supabase verifyOtp
    await waitFor(() => {
      const supabase = require('@supabase/supabase-js').createClient();
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        token: '123456',
        type: 'email'
      });
    });
  });
  
  test('handles anonymous sign in', async () => {
    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );
    
    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Not Loading');
    });
    
    // Click anonymous sign in button
    const anonymousButton = screen.getByTestId('anonymous-button');
    await act(async () => {
      userEvent.click(anonymousButton);
    });
    
    // Should call Supabase signUp
    await waitFor(() => {
      const supabase = require('@supabase/supabase-js').createClient();
      expect(supabase.auth.signUp).toHaveBeenCalled();
    });
    
    // Should store anonymous ID in localStorage
    expect(localStorageMock.setItem).toHaveBeenCalledWith('anonymousId', expect.stringContaining('anon-'));
    
    // Should initialize empty progress data for anonymous user
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      expect.stringContaining('progressData_anon-'),
      expect.stringContaining('totalPoints')
    );
  });
  
  test('signs out and clears data', async () => {
    // Populate localStorage with auth data
    localStorageMock._populateStore({
      'supabase.auth.token': 'test-token',
      'auth_email': 'test@example.com',
      'zenjin_user_email': 'test@example.com',
      'zenjin_auth_state': 'authenticated',
      'zenjin_state_test-user-id': JSON.stringify({ testData: true }),
      'unrelated_key': 'should-remain'
    });
    
    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );
    
    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Not Loading');
    });
    
    // Click sign out button
    const signOutButton = screen.getByTestId('sign-out-button');
    await act(async () => {
      userEvent.click(signOutButton);
    });
    
    // Should call Supabase signOut
    await waitFor(() => {
      const supabase = require('@supabase/supabase-js').createClient();
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
    
    // Should clear auth data from localStorage
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('supabase.auth.token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_email');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('zenjin_user_email');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('zenjin_auth_state');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('zenjin_state_test-user-id');
    
    // Should not remove unrelated data
    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('unrelated_key');
    
    // Should clear user data
    await waitFor(() => {
      expect(screen.getByTestId('user-data')).toHaveTextContent('No User Data');
    });
  });
  
  test('refreshes user data on demand', async () => {
    const { loadUserData } = require('../../lib/loadUserData');
    
    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );
    
    // Wait for initial loading to complete and user data to be loaded
    await waitFor(() => {
      expect(screen.getByTestId('user-data')).toHaveTextContent('Total Points: 100');
    });
    
    // Reset the mock to track future calls
    loadUserData.mockClear();
    
    // Mock a different response for the refresh call
    loadUserData.mockResolvedValueOnce({
      tubeData: { success: true, data: [] },
      progressData: { totalPoints: 200, blinkSpeed: 3.0 }, // Different points value
      dataTimestamp: Date.now()
    });
    
    // Click refresh button
    const refreshButton = screen.getByTestId('refresh-button');
    await act(async () => {
      userEvent.click(refreshButton);
    });
    
    // Should call loadUserData again
    expect(loadUserData).toHaveBeenCalledTimes(1);
    
    // Should update user data with new values
    await waitFor(() => {
      expect(screen.getByTestId('user-data')).toHaveTextContent('Total Points: 200');
    });
  });
  
  test('creates user profile after authentication', async () => {
    // Make Supabase auth return a new session to trigger profile creation
    const supabase = require('@supabase/supabase-js').createClient();
    supabase.auth.getSession.mockImplementationOnce(() => ({
      data: { 
        session: { 
          user: { id: 'new-user-id', email: 'new@example.com' }, 
          access_token: 'new-token' 
        } 
      },
      error: null
    }));
    
    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );
    
    // Wait for auth to complete
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    });
    
    // Should call the profile creation API
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/create-profile', expect.anything());
    });
  });
});