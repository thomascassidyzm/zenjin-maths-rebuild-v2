import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import AuthBox from '../../components/auth/AuthBox';

/**
 * Login Page
 * 
 * A dedicated authentication page with full flow support,
 * including email verification code input.
 */
export default function LoginPage() {
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
        // Check for both returnUrl (from middleware) and redirectTo (legacy param)
        const returnUrl = router.query.returnUrl as string || 
                         router.query.redirectTo as string;
        
        // Log the return URL for debugging
        console.log('Redirecting to:', returnUrl || 'home');
        
        // If returnUrl exists and is not the current page, redirect to it
        if (returnUrl && returnUrl !== router.pathname) {
          router.push(returnUrl);
        } else {
          // Default to home page if no returnUrl
          router.push('/');
        }
      }, 1000);
      
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
      
      <div className="max-w-4xl w-full p-4">
        <div className="mb-6 text-center">
          <Link href="/" className="text-white/80 hover:text-white inline-flex items-center transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Home
          </Link>
        </div>
        
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
          <div className="flex flex-col items-center">
            <h1 className="text-3xl font-bold text-white mb-6">Sign In to Zenjin Maths</h1>
            <AuthBox onAuthComplete={handleAuthComplete} />
          </div>
        )}
      </div>
    </div>
  );
}