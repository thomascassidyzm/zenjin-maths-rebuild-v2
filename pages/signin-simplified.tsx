import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContextSimplified';

/**
 * SignIn Page
 * 
 * A clean, focused sign-in page that handles:
 * 1. Email/password authentication
 * 2. OTP verification
 * 3. Proper redirects based on auth state
 */
export default function SignIn() {
  const router = useRouter();
  const { isAuthenticated, loading, error, signIn, signInWithEmail, verifyCode } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [authMode, setAuthMode] = useState<'password' | 'otp-request' | 'otp-verify'>('password');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get redirect path from query params or default to home
  const redirectPath = router.query.redirect as string || '/';
  
  // Redirect to home if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(redirectPath);
    }
  }, [isAuthenticated, loading, router, redirectPath]);
  
  // Handle password sign in
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setLocalError('Email is required');
      return;
    }
    
    if (!password) {
      setLocalError('Password is required');
      return;
    }
    
    setIsSubmitting(true);
    setLocalError(null);
    
    try {
      const result = await signIn(email, password);
      
      if (!result.success) {
        setLocalError(result.error?.message || 'Sign in failed');
      }
      // On success, redirect will happen via the useEffect
    } catch (error: any) {
      setLocalError(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle OTP request
  const handleOtpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setLocalError('Email is required');
      return;
    }
    
    setIsSubmitting(true);
    setLocalError(null);
    
    try {
      const result = await signInWithEmail(email);
      
      if (result.success) {
        setAuthMode('otp-verify');
      } else {
        setLocalError(result.error?.message || 'Failed to send verification code');
      }
    } catch (error: any) {
      setLocalError(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle OTP verification
  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otpCode) {
      setLocalError('Verification code is required');
      return;
    }
    
    setIsSubmitting(true);
    setLocalError(null);
    
    try {
      const result = await verifyCode(otpCode);
      
      if (!result.success) {
        setLocalError(result.error?.message || 'Invalid verification code');
      }
      // On success, redirect will happen via the useEffect
    } catch (error: any) {
      setLocalError(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-800 to-indigo-900">
        <div className="animate-spin h-12 w-12 border-4 border-t-blue-500 border-blue-200 rounded-full"></div>
      </div>
    );
  }
  
  // Return sign-in form if not authenticated
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-800 to-indigo-900">
      <Head>
        <title>Sign In | Zenjin Maths</title>
        <meta name="description" content="Sign in to your Zenjin Maths account" />
      </Head>
      
      {/* Simple header */}
      <header className="py-4 px-6">
        <Link href="/" className="text-white font-bold text-xl">
          Zenjin Maths
        </Link>
      </header>
      
      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl max-w-md w-full">
          <h1 className="text-3xl font-bold text-white text-center mb-6">
            {authMode === 'password' && 'Sign In'}
            {authMode === 'otp-request' && 'Email Verification'}
            {authMode === 'otp-verify' && 'Enter Verification Code'}
          </h1>
          
          {/* Error display */}
          {(localError || error) && (
            <div className="bg-red-500/20 border border-red-300/30 text-red-100 p-4 rounded-lg mb-6">
              {localError || error}
            </div>
          )}
          
          {/* Password sign in form */}
          {authMode === 'password' && (
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-white text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 rounded-lg bg-white/10 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email"
                  disabled={isSubmitting}
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-white text-sm font-medium mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 rounded-lg bg-white/10 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your password"
                  disabled={isSubmitting}
                />
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-colors disabled:opacity-70"
              >
                {isSubmitting ? 'Signing In...' : 'Sign In'}
              </button>
              
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setAuthMode('otp-request')}
                  className="text-blue-300 hover:text-blue-200 text-sm"
                >
                  Sign in with email verification instead
                </button>
              </div>
            </form>
          )}
          
          {/* OTP request form */}
          {authMode === 'otp-request' && (
            <form onSubmit={handleOtpRequest} className="space-y-4">
              <div>
                <label htmlFor="email-otp" className="block text-white text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  id="email-otp"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 rounded-lg bg-white/10 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email"
                  disabled={isSubmitting}
                />
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-colors disabled:opacity-70"
              >
                {isSubmitting ? 'Sending Code...' : 'Send Verification Code'}
              </button>
              
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setAuthMode('password')}
                  className="text-blue-300 hover:text-blue-200 text-sm"
                >
                  Back to password sign in
                </button>
              </div>
            </form>
          )}
          
          {/* OTP verification form */}
          {authMode === 'otp-verify' && (
            <form onSubmit={handleOtpVerify} className="space-y-4">
              <p className="text-white/80 mb-4">
                We've sent a verification code to <span className="font-medium">{email}</span>.
                Please enter it below to sign in.
              </p>
              
              <div>
                <label htmlFor="otp-code" className="block text-white text-sm font-medium mb-1">
                  Verification Code
                </label>
                <input
                  id="otp-code"
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full p-3 rounded-lg bg-white/10 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter verification code"
                  disabled={isSubmitting}
                />
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-colors disabled:opacity-70"
              >
                {isSubmitting ? 'Verifying...' : 'Verify Code'}
              </button>
              
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setAuthMode('otp-request')}
                  className="text-blue-300 hover:text-blue-200 text-sm"
                >
                  Resend verification code
                </button>
              </div>
            </form>
          )}
          
          <div className="mt-8 text-center">
            <p className="text-white/70 text-sm">
              Don't have an account? Contact your administrator.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}