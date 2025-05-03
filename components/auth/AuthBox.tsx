import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

type AuthBoxProps = {
  onAuthComplete?: () => void;
  onClose?: () => void;
  className?: string;
};

/**
 * Authentication Box
 * 
 * Provides a user interface for authentication using either
 * email/password or one-time verification codes.
 */
const AuthBox = ({ onAuthComplete, onClose, className = '' }: AuthBoxProps) => {
  // Get auth state and functions from context
  const { 
    isAuthenticated,
    authState,
    user,
    signInWithEmail,
    signInWithEmailAndPassword,
    verifyCode,
    loginError
  } = useAuth();
  
  // Local component state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState('email'); // 'email' or 'verify'
  const [message, setMessage] = useState({ text: '', type: '' });
  const [resendTimer, setResendTimer] = useState(0);
  const [usePasswordAuth, setUsePasswordAuth] = useState(false); // Default to OTP auth
  
  const resendTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // If user is authenticated, call the completion callback
  useEffect(() => {
    if (isAuthenticated && user) {
      onAuthComplete?.();
    }
    
    // Check for stored email from previous attempt
    const storedEmail = localStorage.getItem('auth_email');
    if (storedEmail && !email) {
      setEmail(storedEmail);
    }
  }, [isAuthenticated, user, onAuthComplete, email]);
  
  // Update message when login error changes
  useEffect(() => {
    if (loginError) {
      setMessage({ text: loginError, type: 'error' });
    }
  }, [loginError]);
  
  // Clean up timer when component unmounts
  useEffect(() => {
    return () => {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
      }
    };
  }, []);
  
  // Start the countdown timer for OTP resend cooldown
  const startResendTimer = (seconds: number) => {
    // Clear any existing timer
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
      resendTimerRef.current = null;
    }
    
    // Set initial timer value
    setResendTimer(seconds);
    
    // Start interval
    const interval = setInterval(() => {
      setResendTimer(prevTime => {
        const newTime = prevTime - 1;
        if (newTime <= 0) {
          if (resendTimerRef.current) {
            clearInterval(resendTimerRef.current);
            resendTimerRef.current = null;
          }
          return 0;
        }
        return newTime;
      });
    }, 1000);
    
    resendTimerRef.current = interval;
  };
  
  // Step 1: Send verification code to user's email
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      // Validate email format
      if (!email || !email.includes('@')) {
        setMessage({ text: 'Please enter a valid email address', type: 'error' });
        setIsLoading(false);
        return;
      }
      
      console.log('Requesting OTP for email:', email);
      
      // Request OTP code via auth context
      const result = await signInWithEmail(email);
      
      if (!result.success) {
        console.error('Failed to send OTP:', result.error);
        
        // Check for rate limiting error and handle it gracefully
        if (result.error?.message && (
          result.error.message.includes('rate limit') || 
          result.error.message.includes('wait')
        )) {
          // Start resend timer (30 seconds or extract time from error)
          let waitTime = 30;
          const timeMatch = result.error.message.match(/(\d+)\s*second/);
          if (timeMatch && timeMatch[1]) {
            waitTime = parseInt(timeMatch[1], 10);
          }
          
          startResendTimer(waitTime);
        }
        
        setMessage({ 
          text: result.error?.message || 'Failed to send verification code', 
          type: 'error' 
        });
        setIsLoading(false);
        return;
      }
      
      // Success - proceed to verification step
      setStage('verify');
      setMessage({ 
        text: 'Check your email for the verification code', 
        type: 'success' 
      });
      
      // Start resend timer (30 seconds)
      startResendTimer(30);
    } catch (err: any) {
      console.error('Exception sending OTP:', err);
      setMessage({ 
        text: 'An error occurred. Please try again.', 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Step 2: Verify the OTP code
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      console.log('Verifying OTP code:', otpCode);
      
      // Verify code via auth context
      const result = await verifyCode(otpCode);
      
      if (!result.success) {
        console.error('OTP verification failed:', result.error);
        setMessage({ 
          text: result.error?.message || 'Invalid verification code', 
          type: 'error' 
        });
        setIsLoading(false);
        return;
      }
      
      // Success!
      setMessage({ 
        text: 'Welcome back! Getting your learning journey ready...', 
        type: 'success' 
      });
      
      // Notify parent component
      onAuthComplete?.();
    } catch (err: any) {
      console.error('Exception verifying OTP:', err);
      setMessage({ 
        text: 'An error occurred. Please try again.', 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle password authentication
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      // Validate email format
      if (!email || !email.includes('@')) {
        setMessage({ text: 'Please enter a valid email address', type: 'error' });
        setIsLoading(false);
        return;
      }
      
      // Validate password
      if (!password || password.length < 6) {
        setMessage({ text: 'Password must be at least 6 characters', type: 'error' });
        setIsLoading(false);
        return;
      }
      
      console.log('Signing in with password for email:', email);
      
      // Attempt password authentication
      const result = await signInWithEmailAndPassword(email, password);
      
      if (!result.success) {
        console.error('Password authentication failed:', result.error);
        setMessage({ 
          text: result.error?.message || 'Invalid email or password', 
          type: 'error' 
        });
        setIsLoading(false);
        return;
      }
      
      // Success!
      setMessage({ 
        text: 'Welcome back! Getting your learning journey ready...', 
        type: 'success' 
      });
      
      // Notify parent component
      onAuthComplete?.();
    } catch (err: any) {
      console.error('Exception during password authentication:', err);
      setMessage({ 
        text: 'An error occurred. Please try again.', 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Toggle between password and OTP authentication
  const toggleAuthMode = () => {
    setUsePasswordAuth(!usePasswordAuth);
    setStage('email');
    setOtpCode('');
    setPassword('');
    setMessage({ text: '', type: '' });
  };
  
  // Go back to email input
  const handleBack = () => {
    setStage('email');
    setOtpCode('');
    setMessage({ text: '', type: '' });
  };
  
  // Resend the OTP code
  const handleResendCode = async () => {
    if (resendTimer > 0) {
      setMessage({ 
        text: `Please wait ${resendTimer} seconds before requesting a new code.`, 
        type: 'error' 
      });
      return;
    }
    
    setIsLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      // Request a new OTP code
      const result = await signInWithEmail(email);
      
      if (!result.success) {
        console.error('Failed to resend OTP:', result.error);
        
        // Check for rate limiting error
        if (result.error?.message && (
          result.error.message.includes('rate limit') || 
          result.error.message.includes('wait')
        )) {
          // Extract time from error or use default
          let waitTime = 30;
          const timeMatch = result.error.message.match(/(\d+)\s*second/);
          if (timeMatch && timeMatch[1]) {
            waitTime = parseInt(timeMatch[1], 10);
          }
          
          startResendTimer(waitTime);
        }
        
        setMessage({ 
          text: result.error?.message || 'Failed to resend code', 
          type: 'error' 
        });
        return;
      }
      
      // Success
      setMessage({ 
        text: 'New verification code sent to your email', 
        type: 'success' 
      });
      
      // Start resend timer
      startResendTimer(30);
    } catch (err: any) {
      console.error('Exception resending OTP:', err);
      setMessage({ 
        text: 'An error occurred. Please try again.', 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Close the auth modal
  const handleClose = () => {
    onClose?.();
  };
  
  return (
    <div className={`bg-black/70 rounded-lg p-6 shadow-lg max-w-md w-full mx-auto ${className}`}>
      {/* Header with close button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-white">Zenjin Maths</h2>
        {onClose && (
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
      
      {/* Status message */}
      {message.text && (
        <div className={`p-3 rounded-md mb-4 text-sm ${
          message.type === 'error' 
            ? 'bg-red-500/20 text-red-200' 
            : 'bg-green-500/20 text-green-200'
        }`}>
          {message.text}
        </div>
      )}
      
      {usePasswordAuth ? (
        // Password authentication
        <>
          <p className="text-white/80 mb-4">
            Sign in with your email and password
          </p>
          
          <form onSubmit={handlePasswordSignIn}>
            <div className="mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                required
                className="w-full p-3 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                autoComplete="email"
              />
            </div>
            
            <div className="mb-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full p-3 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                autoComplete="current-password"
              />
            </div>
            
            <button 
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full p-3 rounded-md bg-teal-600 hover:bg-teal-500 text-white font-medium transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
            
            <div className="mt-4 text-center">
              <button 
                type="button" 
                onClick={toggleAuthMode}
                className="text-blue-300 hover:text-blue-200 underline text-sm"
              >
                Use verification code instead
              </button>
            </div>
          </form>
        </>
      ) : (
        // OTP authentication
        <>
          {/* Email input stage */}
          {stage === 'email' && (
            <>
              <p className="text-white/80 mb-4">
                Enter your email to sign up or sign in. We'll send you a secure 6-digit verification code.
              </p>
              
              <form onSubmit={handleRequestOTP}>
                <div className="mb-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email address"
                    required
                    className="w-full p-3 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    autoComplete="email"
                  />
                </div>
                
                <button 
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full p-3 rounded-md bg-teal-600 hover:bg-teal-500 text-white font-medium transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Sending...' : 'Send Verification Code'}
                </button>
                
                <div className="mt-4 text-center">
                  <button 
                    type="button" 
                    onClick={toggleAuthMode}
                    className="text-blue-300 hover:text-blue-200 underline text-sm"
                  >
                    Use password instead
                  </button>
                </div>
              </form>
            </>
          )}
          
          {/* Verification code stage */}
          {stage === 'verify' && (
            <>
              <p className="text-white/80 mb-4">
                Enter the 6-digit code sent to {email}
              </p>
              
              <form onSubmit={handleVerifyOTP}>
                <div className="mb-4">
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="6-digit code"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    className="w-full p-3 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/50 text-2xl text-center tracking-wider focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                
                <button 
                  type="submit"
                  disabled={isLoading || otpCode.length !== 6}
                  className="w-full p-3 rounded-md bg-teal-600 hover:bg-teal-500 text-white font-medium transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </button>
                
                <div className="flex justify-between mt-4 text-sm">
                  <button 
                    type="button" 
                    onClick={handleBack}
                    className="text-blue-300 hover:text-blue-200 underline focus:outline-none"
                  >
                    Change Email
                  </button>
                  
                  {resendTimer > 0 ? (
                    <span className="text-white/60">
                      Resend in {resendTimer}s
                    </span>
                  ) : (
                    <button 
                      type="button" 
                      onClick={handleResendCode}
                      disabled={isLoading || resendTimer > 0}
                      className="text-blue-300 hover:text-blue-200 underline focus:outline-none disabled:text-gray-500 disabled:no-underline"
                    >
                      Resend Code
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default AuthBox;