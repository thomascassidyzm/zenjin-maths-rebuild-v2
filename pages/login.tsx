import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const router = useRouter();
  const { isAuthenticated, loading, signInWithEmailAndPassword, signInWithEmail, verifyCode, loginError } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  // ALWAYS use password auth - forcing this to be true
  const [usePasswordAuth, setUsePasswordAuth] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && !loading) {
      router.push('/account');
    }
  }, [isAuthenticated, loading, router]);
  
  // Handle email/password sign in
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!email) {
      setFormError('Please enter your email');
      return;
    }
    
    if (!password) {
      setFormError('Please enter your password');
      return;
    }
    
    const result = await signInWithEmailAndPassword(email, password);
    
    if (result.success) {
      router.push('/account');
    }
  };
  
  // Handle OTP sign in (step 1)
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!email) {
      setFormError('Please enter your email');
      return;
    }
    
    const result = await signInWithEmail(email);
    
    if (result.success) {
      setIsOtpSent(true);
    }
  };
  
  // Handle OTP verification (step 2)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!verificationCode) {
      setFormError('Please enter the verification code');
      return;
    }
    
    const result = await verifyCode(verificationCode);
    
    if (result.success) {
      router.push('/account');
    }
  };
  
  // Toggle between password and OTP auth
  const toggleAuthMode = () => {
    setUsePasswordAuth(!usePasswordAuth);
    setIsOtpSent(false);
    setFormError(null);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center player-bg">
        <div className="text-center text-white">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen player-bg flex items-center justify-center p-4">
      <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-white mb-4 text-center">Sign In</h1>
        <p className="text-white text-opacity-80 text-center mb-6">
          {usePasswordAuth ? 'Sign in with your email and password' : 'Sign in with a verification code'}
        </p>
        
        {/* Display errors */}
        {(loginError || formError) && (
          <div className="bg-red-500/20 border border-red-300/30 text-red-100 rounded-lg p-3 mb-6">
            {loginError || formError}
          </div>
        )}
        
        {usePasswordAuth ? (
          // Password authentication form
          <form onSubmit={handlePasswordSignIn} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-white text-sm mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded bg-white bg-opacity-10 border border-white border-opacity-20 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="your@email.com"
                required
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-white text-sm mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded bg-white bg-opacity-10 border border-white border-opacity-20 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Password"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
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
        ) : (
          // OTP authentication form
          <form onSubmit={isOtpSent ? handleVerifyOtp : handleRequestOtp} className="space-y-6">
            {!isOtpSent ? (
              // Step 1: Enter email
              <div>
                <label htmlFor="email-otp" className="block text-white text-sm mb-1">
                  Email
                </label>
                <input
                  id="email-otp"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 rounded bg-white bg-opacity-10 border border-white border-opacity-20 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="your@email.com"
                  required
                />
              </div>
            ) : (
              // Step 2: Enter verification code
              <div>
                <label htmlFor="verification-code" className="block text-white text-sm mb-1">
                  Verification Code
                </label>
                <input
                  id="verification-code"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full px-4 py-2 rounded bg-white bg-opacity-10 border border-white border-opacity-20 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="6-digit code"
                  maxLength={6}
                  required
                />
                <p className="text-blue-200 text-sm mt-2">
                  A verification code has been sent to your email address.
                </p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {loading 
                ? (isOtpSent ? 'Verifying...' : 'Sending code...') 
                : (isOtpSent ? 'Verify Code' : 'Send Verification Code')}
            </button>
            
            {!isOtpSent && (
              <div className="mt-4 text-center">
                <button 
                  type="button" 
                  onClick={toggleAuthMode}
                  className="text-blue-300 hover:text-blue-200 underline text-sm"
                >
                  Use password instead
                </button>
              </div>
            )}
          </form>
        )}
        
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-teal-300 hover:text-teal-200"
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}