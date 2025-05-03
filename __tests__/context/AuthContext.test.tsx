import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Mock the supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(() => ({ 
        data: { subscription: { unsubscribe: jest.fn() } } 
      })),
      signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signUp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null })
    }
  })),
}));

// Mock the auth client functions
jest.mock('../../lib/auth/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signUp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null })
    }
  },
  signInWithEmail: jest.fn().mockResolvedValue({ success: true }),
  verifyOtp: jest.fn().mockResolvedValue({ success: true }),
  signOut: jest.fn().mockResolvedValue({ success: true }),
  transferAnonymousData: jest.fn().mockResolvedValue(true)
}));

// Mock service worker
global.navigator.serviceWorker = {
  controller: {
    postMessage: jest.fn()
  }
};

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({ success: true })
});

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    // Helper to inspect the mock state
    _getStore: () => store,
    // Helper for test setup
    _populateStore: (mockStore) => {
      store = { ...mockStore };
    }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock IndexedDB
const indexedDB = {
  open: jest.fn().mockReturnValue({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: {
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          clear: jest.fn()
        })
      }),
      objectStoreNames: {
        contains: jest.fn().mockReturnValue(true)
      }
    }
  })
};
Object.defineProperty(window, 'indexedDB', { value: indexedDB });

// Test component to access auth context
const TestComponent = () => {
  const { isAuthenticated, user, signOut } = useAuth();
  
  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
      <button onClick={signOut} data-testid="sign-out-button">
        Sign Out
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });
  
  test('signOut clears localStorage auth data', async () => {
    // Setup localStorage with mock auth data
    localStorageMock._populateStore({
      'supabase.auth.token': 'test-token',
      'supabase.auth.refreshToken': 'test-refresh-token',
      'auth_email': 'test@example.com',
      'zenjin_state_some-user-id': JSON.stringify({ test: 'data' }),
      'zenjin_anonymous_state': JSON.stringify({ anonymous: 'data' }),
      'unrelated_key': 'should-remain'
    });
    
    // Render the test component
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Click sign out button
    const signOutButton = screen.getByTestId('sign-out-button');
    await act(async () => {
      userEvent.click(signOutButton);
    });
    
    // Verify localStorage was cleared of auth items
    await waitFor(() => {
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('supabase.auth.token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('supabase.auth.refreshToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_email');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('zenjin_state_some-user-id');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('zenjin_anonymous_state');
      
      // The unrelated key should remain
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('unrelated_key');
    });
  });
  
  test('signOut instructs service worker to clear auth data', async () => {
    // Render the test component
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Click sign out button
    const signOutButton = screen.getByTestId('sign-out-button');
    await act(async () => {
      userEvent.click(signOutButton);
    });
    
    // Verify service worker was instructed to clear auth data
    await waitFor(() => {
      expect(navigator.serviceWorker.controller.postMessage).toHaveBeenCalledWith({
        type: 'CLEAR_AUTH_DATA'
      });
    });
  });
  
  test('signOut attempts to clear IndexedDB data', async () => {
    // Render the test component
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Click sign out button
    const signOutButton = screen.getByTestId('sign-out-button');
    await act(async () => {
      userEvent.click(signOutButton);
    });
    
    // Verify IndexedDB was opened
    await waitFor(() => {
      expect(window.indexedDB.open).toHaveBeenCalledWith('zenjin_state_db');
    });
  });
});