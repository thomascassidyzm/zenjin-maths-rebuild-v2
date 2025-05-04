import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import BackgroundBubbles from '../components/BackgroundBubbles';

/**
 * SignIn Page
 * 
 * A clean, focused sign-in page that handles:
 * 1. Email OTP authentication (magic link or 6-digit code)
 * 2. Email/password authentication 
 * 3. Works for both sign-in and sign-up with the same flow
 * 4. Proper redirects based on auth state
 */
export default function SignIn() {
  const router = useRouter();
  const { isAuthenticated, loading, error, signInWithEmail, signIn, verifyCode, user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [authMode, setAuthMode] = useState<'otp-request' | 'otp-verify' | 'password-signin' | 'password-signup'>('otp-request');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  
  // Get redirect path from query params or default to the minimal player for anonymous users
  const redirectPath = router.query.redirect as string || '/minimal-player?mode=anonymous';
  
  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      // Clean up new user flag if present
      if (localStorage.getItem('zenjin_is_new_user') === 'true') {
        localStorage.removeItem('zenjin_is_new_user');
      }
      // Redirect to minimal player by default unless a specific redirect is provided
      router.replace(redirectPath);
    }
  }, [isAuthenticated, loading, router, redirectPath]);
  
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
      // Mark as new user to redirect to player
      localStorage.setItem('zenjin_is_new_user', 'true');
      
      const result = await signInWithEmail(email);
      
      if (result.success) {
        setAuthMode('otp-verify');
        setEmailSent(true);
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
    
    if (!otpCode || otpCode.length !== 6) {
      setLocalError('Please enter a valid 6-digit code');
      return;
    }
    
    setIsSubmitting(true);
    setLocalError(null);
    
    try {
      // Get email from localStorage to ensure we have the right context
      const storedEmail = localStorage.getItem('auth_email') || email;
      
      // Store the email for verifyCode to use
      if (email && !localStorage.getItem('auth_email')) {
        localStorage.setItem('auth_email', email);
      }
      
      console.log(`Verifying code ${otpCode} for email ${storedEmail || 'unknown'}`);
      
      // Just use the code directly - the verifyOtp function will handle getting the email
      const result = await verifyCode(otpCode);
      
      if (!result.success) {
        console.error('Verification failed:', result.error);
        setLocalError(result.error?.message || 'Invalid verification code');
      } else {
        console.log('Verification successful, redirect will happen via useEffect');
        setLocalError(null);
      }
    } catch (error: any) {
      console.error('Exception during verification:', error);
      setLocalError(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle password sign in
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setLocalError('Email and password are required');
      return;
    }
    
    setIsSubmitting(true);
    setLocalError(null);
    
    try {
      const result = await signIn(email, password);
      
      if (!result.success) {
        setLocalError(result.error?.message || 'Invalid credentials');
      }
    } catch (error: any) {
      setLocalError(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle password sign up
  const handlePasswordSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !confirmPassword) {
      setLocalError('All fields are required');
      return;
    }
    
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }
    
    setIsSubmitting(true);
    setLocalError(null);
    
    try {
      // For now, use OTP flow as it's more secure
      // Mark as new user to redirect to player
      localStorage.setItem('zenjin_is_new_user', 'true');
      
      const result = await signInWithEmail(email);
      
      if (result.success) {
        setAuthMode('otp-verify');
        setEmailSent(true);
      } else {
        setLocalError(result.error?.message || 'Failed to create account');
      }
    } catch (error: any) {
      setLocalError(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Toggle between auth modes
  const toggleAuthMode = (mode: 'otp-request' | 'password-signin' | 'password-signup') => {
    setAuthMode(mode);
    setLocalError(null);
    setEmailSent(false);
  };
  
  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center dashboard-bg">
        <div className="animate-spin h-12 w-12 border-4 border-t-teal-500 border-teal-200 rounded-full"></div>
      </div>
    );
  }
  
  // Return sign-in form if not authenticated
  return (
    <div className="min-h-screen player-bg relative flex flex-col">
      <Head>
        <title>Sign In or Sign Up | Zenjin Maths</title>
        <meta name="description" content="Sign in or create an account for Zenjin Maths" />
      </Head>
      
      {/* Background bubbles like in the player */}
      <BackgroundBubbles />
      
      {/* Simple header with back button */}
      <header className="py-4 px-6 relative z-10 flex justify-between items-center">
        <Link href="/" className="text-white font-bold text-xl">
          Zenjin Maths
        </Link>
        <Link 
          href="/anon-dashboard" 
          className="text-white text-sm px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
        >
          Back to Dashboard
        </Link>
      </header>
      
      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl max-w-md w-full">
          <h1 className="text-3xl font-bold text-white text-center mb-6">
            {authMode === 'otp-request' && 'Sign In or Sign Up'}
            {authMode === 'otp-verify' && 'Enter Code'}
            {authMode === 'password-signin' && 'Sign In'}
            {authMode === 'password-signup' && 'Create Account'}
          </h1>
          
          {/* Error display */}
          {(localError || error) && (
            <div className="bg-red-500/20 border border-red-300/30 text-red-100 p-4 rounded-lg mb-6">
              {localError || error}
            </div>
          )}
          
          {/* Auth mode tabs (except during OTP verification) */}
          {authMode !== 'otp-verify' && !emailSent && (
            <div className="flex rounded-lg overflow-hidden mb-6 bg-white/5">
              <button
                onClick={() => toggleAuthMode('otp-request')}
                className={`flex-1 py-2 text-center text-sm font-medium ${
                  authMode === 'otp-request' 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-white/70 hover:bg-white/5'
                }`}
              >
                Email Magic Link
              </button>
              <button
                onClick={() => toggleAuthMode('password-signin')}
                className={`flex-1 py-2 text-center text-sm font-medium ${
                  authMode === 'password-signin' 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-white/70 hover:bg-white/5'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => toggleAuthMode('password-signup')}
                className={`flex-1 py-2 text-center text-sm font-medium ${
                  authMode === 'password-signup' 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-white/70 hover:bg-white/5'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}
          
          {/* OTP request form */}
          {authMode === 'otp-request' && !emailSent && (
            <form onSubmit={handleOtpRequest} className="space-y-4">
              <p className="text-white/80 mb-4">
                Enter your email to sign in or create a new account. We'll send you a magic link or code to verify your email.
              </p>
              
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
                {isSubmitting ? 'Sending Link...' : 'Continue with Email'}
              </button>
            </form>
          )}
          
          {/* Email sent confirmation */}
          {authMode === 'otp-request' && emailSent && (
            <div className="text-center">
              <div className="rounded-full bg-green-500/20 p-4 mx-auto w-20 h-20 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-white mb-2">Verification Email Sent!</h3>
              <p className="text-white/80 mb-6">
                We've sent a verification code to <span className="font-medium text-white">{email}</span>.<br />
                Check your email and either:
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => setAuthMode('otp-verify')}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-colors"
                >
                  Enter 6-Digit Code
                </button>
                <p className="text-white/70 text-sm">or</p>
                <p className="text-white/80 text-sm">
                  Click the magic link in the email to sign in automatically
                </p>
              </div>
              <div className="border-t border-white/10 pt-4 mt-6">
                <p className="text-white/70 text-sm">
                  Didn't receive an email? Check your spam folder or{' '}
                  <button 
                    className="text-teal-300 hover:underline" 
                    onClick={() => {
                      setEmailSent(false);
                      setAuthMode('otp-request');
                    }}
                  >
                    try again
                  </button>.
                </p>
              </div>
            </div>
          )}
          
          {/* Password Sign In form */}
          {authMode === 'password-signin' && (
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div>
                <label htmlFor="email-signin" className="block text-white text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  id="email-signin"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 rounded-lg bg-white/10 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email"
                  disabled={isSubmitting}
                />
              </div>
              
              <div>
                <label htmlFor="password-signin" className="block text-white text-sm font-medium mb-1">
                  Password
                </label>
                <input
                  id="password-signin"
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
              
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => toggleAuthMode('otp-request')}
                  className="text-blue-300 hover:text-blue-200 text-sm"
                >
                  Forgot your password?
                </button>
              </div>
            </form>
          )}
          
          {/* Password Sign Up form */}
          {authMode === 'password-signup' && (
            <form onSubmit={handlePasswordSignUp} className="space-y-4">
              <div>
                <label htmlFor="email-signup" className="block text-white text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  id="email-signup"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 rounded-lg bg-white/10 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email"
                  disabled={isSubmitting}
                />
              </div>
              
              <div>
                <label htmlFor="password-signup" className="block text-white text-sm font-medium mb-1">
                  Password
                </label>
                <input
                  id="password-signup"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 rounded-lg bg-white/10 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Create a password (min 8 characters)"
                  disabled={isSubmitting}
                />
              </div>
              
              <div>
                <label htmlFor="confirm-password" className="block text-white text-sm font-medium mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 rounded-lg bg-white/10 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Confirm password"
                  disabled={isSubmitting}
                />
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-colors disabled:opacity-70"
              >
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </button>
              
              <div className="text-center mt-2">
                <p className="text-white/60 text-sm">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => toggleAuthMode('password-signin')}
                    className="text-blue-300 hover:text-blue-200"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </form>
          )}
          
          {/* OTP verification form */}
          {authMode === 'otp-verify' && (
            <form onSubmit={handleOtpVerify} className="space-y-4">
              <p className="text-white/80 mb-4">
                We've sent a 6-digit code to <span className="font-medium">{email}</span>.
                Enter it below to sign in.
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
                  maxLength={6}
                  className="w-full p-3 rounded-lg bg-white/10 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                  placeholder="000000"
                  disabled={isSubmitting}
                />
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting || otpCode.length < 6}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-colors disabled:opacity-70"
              >
                {isSubmitting ? 'Verifying...' : 'Verify Code'}
              </button>
              
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEmailSent(false);
                    setAuthMode('otp-request');
                  }}
                  className="text-blue-300 hover:text-blue-200 text-sm"
                >
                  Back to email entry
                </button>
              </div>
            </form>
          )}
          
          <div className="mt-8 text-center">
            <p className="text-white/70 text-sm">
              By signing in, you agree to our <a href="#" className="text-teal-300 hover:underline">Terms of Service</a> and <a href="#" className="text-teal-300 hover:underline">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}