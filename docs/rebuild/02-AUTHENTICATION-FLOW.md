# Authentication Flow

This document outlines the authentication flow in the Zenjin Maths application, covering the journey from anonymous users to authenticated users.

## User States

### 1. Anonymous User
- Temporary ID generated client-side
- Progress stored in localStorage only
- Limited access to content
- Prompted to create account after engagement

### 2. Free User
- Authenticated with email/OTP
- Progress synced from local to server
- Full access to basic content
- Ability to upgrade to paid tier

### 3. Paid User
- Authenticated with valid subscription
- Full access to all content
- Progress tracked and synced with server
- Additional features unlocked

## Authentication Endpoints

### Magic Link / OTP Request

```typescript
// pages/api/auth/magic-link.ts
import { createClient } from '@supabase/supabase-js';
import { logApiError } from '../../../lib/api/logging';
import { successResponse, errorResponse } from '../../../lib/api/responses';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(
      errorResponse('Method not allowed')
    );
  }
  
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json(
      errorResponse('Email required')
    );
  }
  
  try {
    // Send magic link/OTP
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        // Set options for the magic link
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
      }
    });
    
    if (error) {
      logApiError('Magic Link', error, null);
      return res.status(400).json(
        errorResponse(error.message)
      );
    }
    
    return res.status(200).json(
      successResponse({}, 'Verification email sent')
    );
  } catch (error) {
    logApiError('Magic Link Exception', error, null);
    return res.status(500).json(
      errorResponse('Failed to send verification email')
    );
  }
}
```

### OTP Verification

```typescript
// pages/api/auth/verify.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { logApiError } from '../../../lib/api/logging';
import { successResponse, errorResponse } from '../../../lib/api/responses';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(
      errorResponse('Method not allowed')
    );
  }
  
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json(
      errorResponse('Verification code required')
    );
  }
  
  try {
    const supabaseClient = createRouteHandlerClient({ req, res });
    
    // Verify OTP code
    const { data, error } = await supabaseClient.auth.verifyOtp({
      token: code,
      type: 'email'
    });
    
    if (error) {
      logApiError('OTP Verification', error, null);
      return res.status(400).json(
        errorResponse(error.message)
      );
    }
    
    // Successfully verified
    return res.status(200).json(
      successResponse({
        user: {
          id: data.user.id,
          email: data.user.email
        }
      }, 'Successfully verified')
    );
  } catch (error) {
    logApiError('OTP Verification Exception', error, null);
    return res.status(500).json(
      errorResponse('Verification service unavailable')
    );
  }
}
```

## Profile Creation

When a user signs up, we need to create their profile and sync any existing anonymous progress.

```typescript
// pages/api/auth/create-profile.ts
import { withAuth } from '../../../lib/api/auth';
import { logApiError } from '../../../lib/api/logging';
import { successResponse, errorResponse } from '../../../lib/api/responses';

async function profileHandler(req, res, userId, db) {
  if (req.method !== 'POST') {
    return res.status(405).json(
      errorResponse('Method not allowed')
    );
  }
  
  const { displayName = '', anonymousId = null } = req.body;
  
  try {
    // Check if profile already exists
    const { data: existingProfile } = await db
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (existingProfile) {
      // Update existing profile
      const { error: updateError } = await db
        .from('profiles')
        .update({
          display_name: displayName || existingProfile.display_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (updateError) {
        logApiError('Profile Update', updateError, userId);
        return res.status(500).json(
          errorResponse('Failed to update profile')
        );
      }
      
      // Profile already exists and was updated if needed
      return res.status(200).json(
        successResponse({}, 'Profile updated')
      );
    }
    
    // Create new profile
    const { error: createError } = await db
      .from('profiles')
      .insert({
        id: userId,
        display_name: displayName,
        total_points: 0,
        avg_blink_speed: 2.5,
        evolution_level: 1,
        total_sessions: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (createError) {
      logApiError('Profile Creation', createError, userId);
      return res.status(500).json(
        errorResponse('Failed to create profile')
      );
    }
    
    // If anonymous ID provided, migrate anonymous progress
    if (anonymousId) {
      await migrateAnonymousProgress(db, anonymousId, userId);
    }
    
    return res.status(201).json(
      successResponse({}, 'Profile created successfully')
    );
  } catch (error) {
    logApiError('Profile Creation Exception', error, userId);
    return res.status(500).json(
      errorResponse('Profile service unavailable')
    );
  }
}

/**
 * Migrate progress from anonymous user to authenticated user
 */
async function migrateAnonymousProgress(db, anonymousId, userId) {
  try {
    // 1. Migrate session results
    await db.from('session_results')
      .update({ user_id: userId, is_anonymous: false })
      .eq('user_id', anonymousId);
    
    // 2. Migrate stitch progress
    await db.from('user_stitch_progress')
      .update({ user_id: userId, is_anonymous: false })
      .eq('user_id', anonymousId);
    
    // 3. Update profile with accumulated points from anonymous sessions
    const { data: sessions } = await db
      .from('session_results')
      .select('total_points')
      .eq('user_id', userId);
    
    if (sessions && sessions.length > 0) {
      const totalPoints = sessions.reduce(
        (sum, session) => sum + (session.total_points || 0), 
        0
      );
      
      await db.from('profiles')
        .update({ 
          total_points: totalPoints,
          total_sessions: sessions.length
        })
        .eq('id', userId);
    }
  } catch (error) {
    // Log but don't fail the overall operation
    logApiError('Anonymous Migration', error, userId);
  }
}

// Use the withAuth wrapper for this endpoint
export default function handler(req, res) {
  return withAuth(req, res, profileHandler);
}
```

## Client-Side Authentication Flow

The client-side authentication flow is handled by the AuthContext and related hooks:

```typescript
// context/AuthContext.tsx (simplified)
import React, { createContext, useState, useEffect, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [anonymousId, setAnonymousId] = useState(null);
  
  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  // Check for existing session on mount
  useEffect(() => {
    async function checkSession() {
      setLoading(true);
      
      try {
        // Check for existing session
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          setUser(data.session.user);
          setIsAuthenticated(true);
          
          // Also create/update profile
          await createUserProfile(data.session.user.id);
        } else {
          // No session, initialize anonymous ID if needed
          initAnonymousUser();
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    }
    
    checkSession();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setUser(session.user);
          setIsAuthenticated(true);
          
          // Create/update profile
          await createUserProfile(session.user.id, getAnonymousId());
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
          
          // Initialize anonymous mode
          initAnonymousUser();
        }
      }
    );
    
    return () => {
      subscription?.unsubscribe();
    };
  }, []);
  
  // Initialize anonymous user
  function initAnonymousUser() {
    // Get existing anonymous ID or create new one
    const existingId = localStorage.getItem('anonymousId');
    
    if (existingId) {
      setAnonymousId(existingId);
    } else {
      const newId = `anon-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      localStorage.setItem('anonymousId', newId);
      setAnonymousId(newId);
    }
  }
  
  // Get anonymous ID
  function getAnonymousId() {
    return anonymousId || localStorage.getItem('anonymousId');
  }
  
  // Create or update user profile
  async function createUserProfile(userId, formerAnonymousId = null) {
    try {
      const response = await fetch('/api/auth/create-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          anonymousId: formerAnonymousId,
          displayName: user?.user_metadata?.display_name || ''
        })
      });
      
      if (!response.ok) {
        console.error('Failed to create/update profile');
      }
    } catch (error) {
      console.error('Profile creation error:', error);
    }
  }
  
  // Send magic link / OTP
  async function signInWithEmail(email) {
    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Magic link error:', error);
      return { 
        success: false, 
        error: { message: error.message || 'Failed to send verification email' } 
      };
    }
  }
  
  // Verify OTP code
  async function verifyCode(code) {
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Code verification error:', error);
      return { 
        success: false, 
        error: { message: error.message || 'Failed to verify code' } 
      };
    }
  }
  
  // Sign out
  async function signOut() {
    try {
      await supabase.auth.signOut();
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { 
        success: false, 
        error: { message: error.message || 'Failed to sign out' } 
      };
    }
  }
  
  // Context value
  const value = {
    user,
    isAuthenticated,
    loading,
    anonymousId: getAnonymousId(),
    signInWithEmail,
    verifyCode,
    signOut,
    createUserProfile
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook for easy access
export function useAuth() {
  return useContext(AuthContext);
}
```

## Authentication and Sync Hooks

Custom hooks to manage authentication and data synchronization:

```typescript
// lib/hooks/useAuth.ts
import { useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';

export function useAuth() {
  const auth = useContext(AuthContext);
  
  // Enhanced signInWithEmail with proper error handling
  const signInWithEmail = useCallback(async (email) => {
    try {
      return await auth.signInWithEmail(email);
    } catch (error) {
      console.error('Sign in error:', error);
      return { 
        success: false, 
        error: { message: 'Failed to send verification email' } 
      };
    }
  }, [auth]);
  
  // Enhanced verifyCode with proper error handling
  const verifyCode = useCallback(async (code) => {
    try {
      return await auth.verifyCode(code);
    } catch (error) {
      console.error('Verification error:', error);
      return { 
        success: false, 
        error: { message: 'Failed to verify code' } 
      };
    }
  }, [auth]);
  
  return {
    ...auth,
    signInWithEmail,
    verifyCode
  };
}
```

```typescript
// lib/hooks/useSync.ts
import { useCallback } from 'react';
import { useAuth } from './useAuth';

export function useSync() {
  const { isAuthenticated, user, anonymousId } = useAuth();
  
  // Sync session data to server
  const syncSession = useCallback(async (sessionData) => {
    if (!sessionData) return { success: false };
    
    try {
      const userId = isAuthenticated ? user.id : anonymousId;
      
      const response = await fetch('/api/sessions/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...sessionData,
          userId,
          anonymousId: !isAuthenticated ? anonymousId : undefined
        })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Session sync error:', error);
      
      // Store failed sync in localStorage for retry
      const failedSyncs = JSON.parse(
        localStorage.getItem('failedSyncs') || '[]'
      );
      
      failedSyncs.push({
        type: 'session',
        data: sessionData,
        timestamp: Date.now()
      });
      
      localStorage.setItem('failedSyncs', JSON.stringify(failedSyncs));
      
      return { 
        success: false, 
        error: 'Failed to sync session' 
      };
    }
  }, [isAuthenticated, user, anonymousId]);
  
  // Sync progress data to server
  const syncProgress = useCallback(async (progressData) => {
    if (!progressData) return { success: false };
    
    try {
      const userId = isAuthenticated ? user.id : anonymousId;
      
      const response = await fetch('/api/progress/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...progressData,
          userId,
          anonymousId: !isAuthenticated ? anonymousId : undefined
        })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Progress sync error:', error);
      
      // Store failed sync in localStorage for retry
      const failedSyncs = JSON.parse(
        localStorage.getItem('failedSyncs') || '[]'
      );
      
      failedSyncs.push({
        type: 'progress',
        data: progressData,
        timestamp: Date.now()
      });
      
      localStorage.setItem('failedSyncs', JSON.stringify(failedSyncs));
      
      return { 
        success: false, 
        error: 'Failed to sync progress' 
      };
    }
  }, [isAuthenticated, user, anonymousId]);
  
  // Retry failed syncs
  const retryFailedSyncs = useCallback(async () => {
    if (!isAuthenticated) return { success: false };
    
    const failedSyncs = JSON.parse(
      localStorage.getItem('failedSyncs') || '[]'
    );
    
    if (failedSyncs.length === 0) return { success: true };
    
    const results = [];
    const remainingFailures = [];
    
    for (const sync of failedSyncs) {
      let result;
      
      if (sync.type === 'session') {
        result = await syncSession(sync.data);
      } else if (sync.type === 'progress') {
        result = await syncProgress(sync.data);
      }
      
      results.push(result);
      
      if (!result.success) {
        remainingFailures.push(sync);
      }
    }
    
    localStorage.setItem('failedSyncs', JSON.stringify(remainingFailures));
    
    return {
      success: remainingFailures.length === 0,
      results
    };
  }, [isAuthenticated, syncSession, syncProgress]);
  
  return {
    syncSession,
    syncProgress,
    retryFailedSyncs
  };
}
```

## Sign-In Page Implementation

The sign-in page that supports both magic link and OTP verification:

```typescript
// pages/signin.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/hooks/useAuth';
import BackgroundBubbles from '../components/BackgroundBubbles';

export default function SignIn() {
  const router = useRouter();
  const { isAuthenticated, loading, signInWithEmail, verifyCode } = useAuth();
  
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [authMode, setAuthMode] = useState('request');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // Redirect to home if already authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      router.replace(router.query.redirect || '/');
    }
  }, [isAuthenticated, loading, router]);
  
  // Handle email form submission
  async function handleEmailSubmit(e) {
    e.preventDefault();
    
    if (!email) {
      setError('Email is required');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const result = await signInWithEmail(email);
      
      if (result.success) {
        setAuthMode('verify');
      } else {
        setError(result.error?.message || 'Failed to send verification email');
      }
    } catch (error) {
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }
  
  // Handle OTP verification
  async function handleOtpSubmit(e) {
    e.preventDefault();
    
    if (!otpCode) {
      setError('Verification code is required');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const result = await verifyCode(otpCode);
      
      if (result.success) {
        // Redirect will happen via useEffect
      } else {
        setError(result.error?.message || 'Invalid verification code');
      }
    } catch (error) {
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center player-bg">
        <div className="animate-spin h-12 w-12 border-4 border-t-blue-500 border-blue-200 rounded-full"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen player-bg relative flex flex-col">
      {/* Background animation */}
      <BackgroundBubbles />
      
      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6 z-10">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl max-w-md w-full">
          <h1 className="text-3xl font-bold text-white text-center mb-6">
            {authMode === 'request' ? 'Sign In or Sign Up' : 'Enter Verification Code'}
          </h1>
          
          {/* Error display */}
          {error && (
            <div className="bg-red-500/20 border border-red-300/30 text-red-100 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          {/* Email form */}
          {authMode === 'request' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <p className="text-white/80 mb-4">
                Enter your email to sign in or create a new account. We'll send you a verification code.
              </p>
              
              <div>
                <label htmlFor="email" className="block text-white text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 rounded-lg bg-white/10 border border-white/30 text-white"
                  placeholder="Enter your email"
                  disabled={isSubmitting}
                />
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg"
              >
                {isSubmitting ? 'Sending...' : 'Send Verification Code'}
              </button>
            </form>
          )}
          
          {/* OTP verification form */}
          {authMode === 'verify' && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <p className="text-white/80 mb-4">
                We've sent a verification code to <span className="font-medium">{email}</span>.
                Enter it below to sign in.
              </p>
              
              <div>
                <label htmlFor="otp" className="block text-white text-sm font-medium mb-1">
                  Verification Code
                </label>
                <input
                  id="otp"
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full p-3 rounded-lg bg-white/10 border border-white/30 text-white text-center tracking-widest text-2xl"
                  placeholder="000000"
                  maxLength={6}
                  disabled={isSubmitting}
                />
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg"
              >
                {isSubmitting ? 'Verifying...' : 'Verify Code'}
              </button>
              
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setAuthMode('request')}
                  className="text-blue-300 hover:text-blue-200 text-sm"
                >
                  Back to email entry
                </button>
              </div>
            </form>
          )}
          
          <div className="mt-8 text-center">
            <p className="text-white/70 text-sm">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```