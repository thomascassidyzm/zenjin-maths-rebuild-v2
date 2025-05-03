import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import AuthBox from '../components/auth/AuthBox';

/**
 * Authentication Page
 * 
 * Standalone page for testing the authentication flow.
 * Displays the AuthBox component for direct email verification.
 */
export default function AuthPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [authComplete, setAuthComplete] = useState(false);
  
  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      // Show success message before redirecting
      setAuthComplete(true);
      
      // Redirect after a short delay
      const redirectTimer = setTimeout(() => {
        const redirectTo = router.query.redirectTo as string || '/';
        router.push(redirectTo);
      }, 2000);
      
      return () => clearTimeout(redirectTimer);
    }
  }, [isAuthenticated, user, router]);
  
  // Handle auth completion
  const handleAuthComplete = () => {
    setAuthComplete(true);
  };
  
  return (
    <div className="min-h-screen player-bg flex items-center justify-center">
      <Head>
        <title>Sign In | Zenjin Maths</title>
      </Head>
      
      {authComplete ? (
        <div className="bg-black/70 rounded-lg p-6 shadow-lg max-w-md w-full mx-auto text-center">
          <div className="text-green-400 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Authentication Successful!</h2>
          <p className="text-white/80">Redirecting you to the app...</p>
        </div>
      ) : (
        <AuthBox onAuthComplete={handleAuthComplete} />
      )}
    </div>
  );
}