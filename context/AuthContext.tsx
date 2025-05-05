import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { loadUserData, clearUserData } from '../lib/loadUserData';
import { 
  cleanupAnonymousData, 
  transferAnonymousDataToUser,
  getAnonymousData,
  hasAnonymousData,
  withAuthHeaders 
} from '../lib/authUtils';
// Import the transferAnonymousData function directly to avoid confusion
import { transferAnonymousData as supabaseTransferData } from '../lib/auth/supabaseClient';

// Initialize the Supabase client with hardcoded values for build process
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylyxga.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5MTczNDAsImV4cCI6MjA1NzQ5MzM0MH0.gXtiM5b3YZoV5SMRrMmY59Qp7VjadOxkJ5an0Q3Og_c';
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
   * Create user profile in database
   */
  const createUserProfile = useCallback(async (userId: string, displayName: string = '') => {
    try {
      console.log('Creating user profile for:', userId);
      
      // Get current session to extract access token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.error('No access token available for profile creation');
        return;
      }
      
      // Call the API to create a profile with authorization header
      const response = await fetch('/api/auth/create-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          displayName: displayName || (session.user.email ? session.user.email.split('@')[0] : 'User'),
          anonymousId: localStorage.getItem('zenjin_anonymous_id') || null
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to create user profile:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('Failed to create user profile:', errorJson);
        } catch (e) {
          // Text wasn't JSON, already logged above
        }
      } else {
        console.log('User profile created successfully');
      }
    } catch (error) {
      console.error('Exception creating user profile:', error);
    }
  }, []);

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
      
      // Make sure we have a clean authentication state before proceeding
      // This is critical for ensuring API calls work correctly
      
      // First clean up any remaining anonymous data to prevent conflicts
      cleanupAnonymousData();
      
      // Ensure that zenjin_auth_state is 'authenticated' and user ID is set in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('zenjin_auth_state', 'authenticated');
        localStorage.setItem('zenjin_user_id', userId);
      }
      
      // Get session token for API calls that need authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        // Set auth headers for all upcoming API calls
        const defaultHeaders = {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store',
          'Authorization': `Bearer ${session.access_token}`
        };
        
        // Store the headers in localStorage for potential use by other components
        if (typeof window !== 'undefined') {
          localStorage.setItem('zenjin_auth_headers', JSON.stringify(defaultHeaders));
        }
      } else {
        console.warn('AuthContext: No access token available - API calls may fail');
      }
      
      // Create a profile for the user (will do nothing if profile already exists)
      await createUserProfile(userId);
      
      // Load user data using the authenticated user ID
      const userData = await loadUserData(userId);
      
      // Update state with loaded data
      setAuthState(prev => ({
        ...prev,
        userData,
        userDataLoading: false
      }));
      
      console.log('AuthContext: User data loaded successfully');
      return userData;
    } catch (error) {
      console.error('AuthContext: Failed to load user data after auth:', error);
      
      // Update state with error
      setAuthState(prev => ({
        ...prev,
        error: 'Failed to load user data',
        userDataLoading: false
      }));
      
      return null;
    }
  }, [createUserProfile]);
  
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
          
          // Transfer anonymous data and clean up properly
          if (typeof window !== 'undefined') {
            const currentAuthState = localStorage.getItem('zenjin_auth_state');
            const storedUserId = localStorage.getItem('zenjin_user_id');
            
            // If previously anonymous or different user, handle data migration
            if (currentAuthState === 'anonymous' || storedUserId !== session.user.id) {
              console.log('AuthContext: Detected auth state transition, handling data migration');
              
              // Store auth token for API calls
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              if (currentSession?.access_token) {
                const authHeaders = {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${currentSession.access_token}`
                };
                localStorage.setItem('zenjin_auth_headers', JSON.stringify(authHeaders));
              }
              
              // Update localStorage with new auth state BEFORE API calls
              // This ensures subsequent API calls use authenticated credentials
              localStorage.setItem('zenjin_auth_state', 'authenticated');
              localStorage.setItem('zenjin_user_id', session.user.id);
              if (session.user.email) {
                localStorage.setItem('zenjin_user_email', session.user.email);
              }
              
              // Attempt data migration - this will use the authentication we just set up
              await transferAnonymousData(session.user.id);
            }
          }
          
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
          
          // Clean up authenticated user data from localStorage
          if (typeof window !== 'undefined') {
            // Remove authenticated state markers
            localStorage.removeItem('zenjin_auth_state');
            localStorage.removeItem('zenjin_user_id');
            localStorage.removeItem('zenjin_user_email');
            localStorage.removeItem('zenjin_auth_headers');
            
            // Also remove auth-related cached data
            clearUserData();
          }
          
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
   * Transfer anonymous data to authenticated user account
   * @param userId - The authenticated user ID
   */
  const transferAnonymousData = useCallback(async (userId: string) => {
    try {
      console.log('AuthContext: Transferring anonymous data to authenticated user');
      
      // Check if we have anonymous data to transfer
      if (!hasAnonymousData()) {
        console.log('AuthContext: No anonymous data to transfer');
        return;
      }
      
      // Use the imported supabaseTransferData function directly for consistency
      const transferred = await supabaseTransferData(userId);
      
      if (transferred) {
        console.log('AuthContext: Anonymous data transferred successfully');
        // Clean up anonymous data after successful transfer
        cleanupAnonymousData();
      } else {
        console.log('AuthContext: Anonymous data transfer was not completed');
      }
    } catch (e) {
      console.error('AuthContext: Exception in anonymous data transfer:', e);
    }
  }, []);

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
      
      // If sign-in successful, check for anonymous data to transfer
      if (data.user) {
        // Attempt to transfer anonymous data to the authenticated account
        await transferAnonymousData(data.user.id);
        
        // Set proper auth state in localStorage
        localStorage.setItem('zenjin_auth_state', 'authenticated');
        localStorage.setItem('zenjin_user_email', email);
        localStorage.setItem('zenjin_user_id', data.user.id);
        
        // Clean up any remaining anonymous data
        cleanupAnonymousData();
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
      
      // Generate random credentials with more robust IDs
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000000);
      const anonymousEmail = `anonymous-${timestamp}-${randomSuffix}@example.com`;
      const password = `anon-${timestamp}-${randomSuffix}`;
      const anonymousId = `anonymous-${timestamp}-${randomSuffix}`;
      
      // Store anonymous ID in localStorage for tracking progress
      // Store in multiple locations for redundancy
      if (typeof window !== 'undefined') {
        // Store anonymous ID in all common locations
        localStorage.setItem('anonymousId', anonymousId);
        localStorage.setItem('zenjin_anonymous_id', anonymousId);
        
        // Also store for API access
        localStorage.setItem('zenjin_user_id', anonymousId);
        localStorage.setItem('zenjin_auth_state', 'anonymous');
        
        console.log(`AuthContext: Created anonymous ID ${anonymousId} and stored in localStorage`);
        
        // Initialize empty progress data for anonymous user
        const progressData = {
          totalPoints: 0,
          blinkSpeed: 2.5,
          blinkSpeedTrend: 'steady',
          evolution: {
            currentLevel: 'Mind Spark',
            levelNumber: 1,
            progress: 0,
            nextLevel: 'Thought Weaver'
          },
          lastSessionDate: new Date().toISOString()
        };
        
        // Save initial progress data in all possible locations for redundancy
        localStorage.setItem(`progressData_${anonymousId}`, JSON.stringify(progressData));
        localStorage.setItem('zenjin_anonymous_progress', JSON.stringify(progressData));
      }
      
      // Update loading state
      setAuthState(prev => ({
        ...prev,
        loading: true,
        error: null
      }));
      
      // Sign up anonymous user (with error handling)
      try {
        const { data, error } = await supabase.auth.signUp({
          email: anonymousEmail,
          password,
          options: {
            // Add data property to store anonymous ID with the user
            data: {
              anonymous_id: anonymousId
            }
          }
        });
        
        if (error) {
          console.error('AuthContext: Anonymous sign up error:', error);
          
          // Update error state
          setAuthState(prev => ({
            ...prev,
            loading: false,
            error: error.message
          }));
          
          // Fall back to local anonymous mode if signup fails
          if (typeof window !== 'undefined') {
            console.log('AuthContext: Falling back to local anonymous mode');
            // Create pseudo-user with the anonymous ID
            setAuthState(prev => ({
              ...prev,
              user: { 
                id: anonymousId,
                email: anonymousEmail
              },
              isAuthenticated: false, // Not truly authenticated but has an ID
              loading: false,
              error: null,
              userData: {
                progressData: {
                  totalPoints: 0,
                  blinkSpeed: 2.5,
                  evolution: {
                    currentLevel: 'Mind Spark',
                    levelNumber: 1,
                    progress: 0
                  }
                }
              },
              userDataLoading: false
            }));
            
            return { 
              success: true, 
              data: null, 
              anonymousId,
              localOnly: true 
            };
          }
          
          return { success: false, error };
        }
        
        // If successful registration but no session yet, manually set anonymous user
        if (!data.session) {
          console.log('AuthContext: No session after anonymous signup - creating manual anonymous state');
          
          // Set anonymous user in auth state
          setAuthState(prev => ({
            ...prev,
            user: { 
              id: anonymousId,
              email: anonymousEmail
            },
            isAuthenticated: false, // Not authenticated but has anonymous ID
            loading: false,
            error: null,
            userData: {
              progressData: {
                totalPoints: 0,
                blinkSpeed: 2.5,
                evolution: {
                  currentLevel: 'Mind Spark',
                  levelNumber: 1,
                  progress: 0
                }
              }
            },
            userDataLoading: false
          }));
        }
        
        // Auth state will be updated by onAuthStateChange listener if session exists
        return { success: true, data, anonymousId };
      } catch (signupError) {
        console.error('AuthContext: Exception during anonymous signup:', signupError);
        
        // Fall back to local anonymous mode
        if (typeof window !== 'undefined') {
          console.log('AuthContext: Falling back to local anonymous mode after exception');
          
          // Create pseudo-user with the anonymous ID
          setAuthState(prev => ({
            ...prev,
            user: { 
              id: anonymousId,
              email: anonymousEmail
            },
            isAuthenticated: false, // Not authenticated but has ID
            loading: false,
            error: null,
            userData: {
              progressData: {
                totalPoints: 0,
                blinkSpeed: 2.5,
                evolution: {
                  currentLevel: 'Mind Spark',
                  levelNumber: 1,
                  progress: 0
                }
              }
            },
            userDataLoading: false
          }));
          
          return { 
            success: true, 
            data: null, 
            anonymousId,
            localOnly: true 
          };
        }
        
        // Update error state if local fallback not possible
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: signupError.message || 'Error during anonymous sign up'
        }));
        
        return { success: false, error: signupError };
      }
    } catch (error: any) {
      console.error('AuthContext: Anonymous sign up outer exception:', error);
      
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
      
      // Store email in localStorage for the verification step
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_email', email);
        localStorage.setItem('zenjin_signup_email', email);
      }
      
      // Send OTP with redirect to callback page
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Create user if they don't exist
          shouldCreateUser: true,
          // Use relative URL for callback to avoid cross-domain issues
          emailRedirectTo: `/login-callback`,
        }
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
      
      console.log('AuthContext: OTP sent successfully');
      
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
      console.log('AuthContext: Verifying OTP code', code);
      
      // Update loading state
      setAuthState(prev => ({
        ...prev,
        loading: true,
        error: null
      }));
      
      // Get the email from localStorage (needed for Supabase OTP verification)
      const email = typeof window !== 'undefined' ? 
        localStorage.getItem('auth_email') || localStorage.getItem('zenjin_signup_email') : null;
      
      if (!email && !code.includes('@')) {
        console.error('AuthContext: Missing email for OTP verification');
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: 'Email not found. Please restart the sign-in process.'
        }));
        
        return { 
          success: false, 
          error: { message: 'Email not found. Please restart the sign-in process.' } 
        };
      }
      
      console.log(`AuthContext: Verifying OTP for email ${email || 'unknown'}`, code);
      
      // Verify OTP with the proper parameters
      const { data, error } = await supabase.auth.verifyOtp({
        email: email || (code.includes('@') ? code : undefined),
        token: code.length <= 6 ? code : undefined,
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
      
      console.log('AuthContext: OTP verification successful', data);
      
      // If verification successful, transfer anonymous data
      if (data?.user) {
        // Attempt to transfer anonymous data to the authenticated account
        await transferAnonymousData(data.user.id);
        
        // Store auth state for app
        if (typeof window !== 'undefined') {
          localStorage.setItem('zenjin_auth_state', 'authenticated');
          localStorage.setItem('zenjin_user_id', data.user.id);
          if (email) {
            localStorage.setItem('zenjin_user_email', email);
          }
        }
        
        // Clean up any remaining anonymous data
        cleanupAnonymousData();
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