import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import AuthBox from '../components/auth/AuthBox';

/**
 * Simple Test Page for Login
 * 
 * A minimal page to test the authentication components
 */
export default function LoginTestPage() {
  const { isAuthenticated, user, signOut } = useAuth();
  
  const handleAuthComplete = () => {
    console.log('Authentication completed');
  };
  
  const handleSignOut = async () => {
    await signOut();
  };
  
  return (
    <div className="min-h-screen player-bg flex flex-col items-center justify-center p-4">
      <Head>
        <title>Login Test | Zenjin Maths</title>
      </Head>
      
      <div className="bg-black/70 rounded-lg p-6 shadow-lg max-w-md w-full mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Login Test Page</h1>
        
        {isAuthenticated ? (
          <div className="text-center">
            <div className="mb-4">
              <div className="bg-green-500/20 text-green-300 rounded-lg p-4 mb-4">
                ✓ You are authenticated
              </div>
              <div className="text-white">
                <p>User ID: {user?.id}</p>
                <p>Email: {user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="bg-red-600 hover:bg-red-500 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <AuthBox onAuthComplete={handleAuthComplete} />
        )}
        
        <div className="mt-6 text-center">
          <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}