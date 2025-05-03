import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContextSimplified';

/**
 * Home Page / Player Start
 * 
 * This is the landing page that users see after logging in.
 * It shows options to start learning or view the dashboard.
 */
export default function Home() {
  const router = useRouter();
  const { 
    user, 
    isAuthenticated, 
    loading, 
    userData, 
    userDataLoading 
  } = useAuth();
  
  // Show loading state while auth is being determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-800 to-indigo-900">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="animate-spin mb-4 h-12 w-12 border-4 border-t-blue-500 border-blue-200 rounded-full mx-auto"></div>
          <h2 className="text-xl font-medium text-white">Loading...</h2>
          <p className="text-blue-200 mt-2">Verifying your session</p>
        </div>
      </div>
    );
  }
  
  // Show user data loading state
  if (isAuthenticated && userDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-800 to-indigo-900">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="animate-spin mb-4 h-12 w-12 border-4 border-t-green-500 border-green-200 rounded-full mx-auto"></div>
          <h2 className="text-xl font-medium text-white">Preparing Your Content</h2>
          <p className="text-blue-200 mt-2">Loading your learning material...</p>
        </div>
      </div>
    );
  }
  
  // Show authenticated player start
  if (isAuthenticated && userData) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-800 to-indigo-900">
        <Head>
          <title>Zenjin Maths | Welcome</title>
          <meta name="description" content="Start your Zenjin Maths learning journey" />
        </Head>
        
        {/* Simple header */}
        <header className="py-4 px-6 flex justify-between items-center">
          <div className="text-white font-bold text-xl">Zenjin Maths</div>
          <div>
            <button 
              onClick={() => router.push('/signin')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm"
            >
              {user?.email ? `Hi, ${user.email.split('@')[0]}` : 'Account'}
            </button>
          </div>
        </header>
        
        {/* Main content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl max-w-lg w-full">
            <h1 className="text-3xl font-bold text-white text-center mb-6">Welcome to Zenjin Maths</h1>
            
            <p className="text-white/80 mb-8 text-center">
              Continue your learning journey with the Triple-Helix system.
              {userData.progressData?.totalPoints > 0 && 
                ` You've earned ${userData.progressData.totalPoints} points so far!`}
            </p>
            
            <div className="space-y-4">
              <button
                onClick={() => router.push('/minimal-player')}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all"
              >
                Start Learning
              </button>
              
              <Link href="/dashboard" className="w-full py-4 bg-white/20 hover:bg-white/30 text-white font-medium rounded-xl shadow-lg transition-all block text-center">
                View Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  // Show unauthenticated home page with sign-in option
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-800 to-indigo-900">
      <Head>
        <title>Zenjin Maths | Welcome</title>
        <meta name="description" content="Start your Zenjin Maths learning journey" />
      </Head>
      
      {/* Simple header */}
      <header className="py-4 px-6">
        <div className="text-white font-bold text-xl">Zenjin Maths</div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl max-w-lg w-full">
          <h1 className="text-3xl font-bold text-white text-center mb-6">Welcome to Zenjin Maths</h1>
          
          <p className="text-white/80 mb-8 text-center">
            Improve your mathematical skills with our innovative Triple-Helix learning system.
          </p>
          
          <div className="space-y-4">
            <Link 
              href="/signin" 
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all block text-center"
            >
              Sign In
            </Link>
            
            <button
              onClick={() => router.push('/minimal-player?mode=anonymous')}
              className="w-full py-4 bg-white/20 hover:bg-white/30 text-white font-medium rounded-xl shadow-lg transition-all"
            >
              Try Anonymously
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}