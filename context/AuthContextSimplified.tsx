import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { loadUserData } from '../lib/loadUserData';

// Initialize the Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type User = {
  id: string;
  email?: string;
} | null;

/**
 * Simplified auth state that serves as a single source of truth
 */
interface AuthState {
  user: User;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  userData: any | null;
  userDataLoading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<any>;
  signInAnonymously: () => Promise<any>;
  signOut: () => Promise<any>;
  signInWithEmail: (email: string) => Promise<any>;
  verifyCode: (code: string) => Promise<any>;
  refreshUserData: () => Promise<any>;
}

// Create the auth context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,
  userData: null,
  userDataLoading: false,
  signIn: async () => ({}),
  signInAnonymously: async () => ({}),
  signOut: async () => ({}),
  signInWithEmail: async () => ({}),
  verifyCode: async () => ({}),
  refreshUserData: async () => ({})
});

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // Single auth state object to maintain consistency
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    loading: true,
    error: null,
    userData: null,
    userDataLoading: false
  });
  
  /**
   * Load user data after successful authentication
   */
  const loadUserDataAfterAuth = useCallback(async (userId: string) => {
    try {
      // Set loading state 
      setAuthState(prev => ({
        ...prev,
        userDataLoading: true
      }));
      
      // Load user data
      const userData = await loadUserData(userId);
      
      // Update state with loaded data
      setAuthState(prev => ({
        ...prev,
        userData,
        userDataLoading: false
      }));
      
      return userData;
    } catch (error) {
      console.error('Failed to load user data after auth:', error);
      
      // Update state with error
      setAuthState(prev => ({
        ...prev,
        error: 'Failed to load user data',
        userDataLoading: false
      }));
      
      return null;
    }
  }, []);
  
  /**
   * Refresh user data on demand
   */
  const refreshUserData = useCallback(async () => {
    if (!authState.isAuthenticated || !authState.user?.id) {
      return null;
    }
    
    return loadUserDataAfterAuth(authState.user.id);
  }, [authState.isAuthenticated, authState.user?.id, loadUserDataAfterAuth]);
  
  /**
   * Check session on component mount
   */
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('AuthContext: Checking for active session');
        
        // Get session from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('AuthContext: Found active session for', session.user.email);
          
          // Set authenticated state
          setAuthState(prev => ({
            ...prev,
            user: session.user,
            isAuthenticated: true,
            loading: false
          }));
          
          // Load user data in the background
          loadUserDataAfterAuth(session.user.id);
        } else {
          console.log('AuthContext: No active session found');
          
          // Set unauthenticated state
          setAuthState(prev => ({
            ...prev,
            user: null,
            isAuthenticated: false,
            loading: false
          }));
        }
      } catch (error) {
        console.error('AuthContext: Error checking session:', error);
        
        // Set error state
        setAuthState({
          user: null,
          isAuthenticated: false,
          loading: false,
          error: 'Failed to verify authentication',
          userData: null,
          userDataLoading: false
        });
      }
    };
    
    // Check session on mount
    checkSession();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthContext: Auth state change:', event);
        
        // Handle sign in
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('AuthContext: User signed in:', session.user.email);
          
          // Update auth state
          setAuthState(prev => ({
            ...prev,
            user: session.user,
            isAuthenticated: true,
            loading: false,
            error: null
          }));
          
          // Load user data
          loadUserDataAfterAuth(session.user.id);
        } 
        // Handle sign out
        else if (event === 'SIGNED_OUT') {
          console.log('AuthContext: User signed out');
          
          // Reset auth state
          setAuthState({
            user: null,
            isAuthenticated: false,
            loading: false,
            error: null,
            userData: null,
            userDataLoading: false
          });
        }
      }
    );
    
    // Clean up subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [loadUserDataAfterAuth]);
  
  /**
   * Sign in with email and password
   */
  const signIn = async (email: string, password: string) => {
    try {
      console.log('AuthContext: Signing in with email and password');
      
      // Update loading state
      setAuthState(prev => ({
        ...prev,
        loading: true,
        error: null
      }));
      
      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('AuthContext: Sign in error:', error);
        
        // Update error state
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
        
        return { success: false, error };
      }
      
      // Auth state will be updated by onAuthStateChange listener
      return { success: true, data };
    } catch (error: any) {
      console.error('AuthContext: Sign in exception:', error);
      
      // Update error state
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'An error occurred during sign in'
      }));
      
      return { success: false, error };
    }
  };
  
  /**
   * Sign in anonymously
   */
  const signInAnonymously = async () => {
    try {
      console.log('AuthContext: Signing in anonymously');
      
      // Generate random credentials
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 10000);
      const anonymousEmail = `anonymous-${timestamp}-${randomSuffix}@example.com`;
      const password = `anon-${timestamp}-${randomSuffix}`;
      
      // Update loading state
      setAuthState(prev => ({
        ...prev,
        loading: true,
        error: null
      }));
      
      // Sign up anonymous user
      const { data, error } = await supabase.auth.signUp({
        email: anonymousEmail,
        password
      });
      
      if (error) {
        console.error('AuthContext: Anonymous sign up error:', error);
        
        // Update error state
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
        
        return { success: false, error };
      }
      
      // Auth state will be updated by onAuthStateChange listener
      return { success: true, data };
    } catch (error: any) {
      console.error('AuthContext: Anonymous sign up exception:', error);
      
      // Update error state
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'An error occurred during anonymous sign up'
      }));
      
      return { success: false, error };
    }
  };
  
  /**
   * Sign out
   */
  const signOut = async () => {
    try {
      console.log('AuthContext: Signing out');
      
      // Update loading state
      setAuthState(prev => ({
        ...prev,
        loading: true,
        error: null
      }));
      
      // Sign out with Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('AuthContext: Sign out error:', error);
        
        // Update error state
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
        
        return { success: false, error };
      }
      
      // Auth state will be updated by onAuthStateChange listener
      return { success: true };
    } catch (error: any) {
      console.error('AuthContext: Sign out exception:', error);
      
      // Update error state
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'An error occurred during sign out'
      }));
      
      return { success: false, error };
    }
  };
  
  /**
   * Sign in with email (OTP)
   */
  const signInWithEmail = async (email: string) => {
    try {
      console.log('AuthContext: Sending OTP to email', email);
      
      // Update loading state
      setAuthState(prev => ({
        ...prev,
        loading: true,
        error: null
      }));
      
      // Send OTP
      const { data, error } = await supabase.auth.signInWithOtp({
        email
      });
      
      if (error) {
        console.error('AuthContext: OTP send error:', error);
        
        // Update error state
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
        
        return { success: false, error };
      }
      
      // Update state - still not fully authenticated
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: null
      }));
      
      return { success: true, data };
    } catch (error: any) {
      console.error('AuthContext: OTP send exception:', error);
      
      // Update error state
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'An error occurred while sending verification code'
      }));
      
      return { success: false, error };
    }
  };
  
  /**
   * Verify OTP code
   */
  const verifyCode = async (code: string) => {
    try {
      console.log('AuthContext: Verifying OTP code');
      
      // Update loading state
      setAuthState(prev => ({
        ...prev,
        loading: true,
        error: null
      }));
      
      // Verify OTP
      const { data, error } = await supabase.auth.verifyOtp({
        token: code,
        type: 'email'
      });
      
      if (error) {
        console.error('AuthContext: OTP verification error:', error);
        
        // Update error state
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
        
        return { success: false, error };
      }
      
      // Auth state will be updated by onAuthStateChange listener
      return { success: true, data };
    } catch (error: any) {
      console.error('AuthContext: OTP verification exception:', error);
      
      // Update error state
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'An error occurred while verifying code'
      }));
      
      return { success: false, error };
    }
  };
  
  // Combine the auth state and methods for the context value
  const contextValue = {
    ...authState,
    signIn,
    signInAnonymously,
    signOut,
    signInWithEmail,
    verifyCode,
    refreshUserData
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use the auth context
export const useAuth = () => useContext(AuthContext);

export default AuthContext;