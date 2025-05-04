import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import UserWelcomeButton from '../components/UserWelcomeButton';

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
      <div className="min-h-screen flex items-center justify-center dashboard-bg">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="animate-spin mb-4 h-12 w-12 border-4 border-t-teal-500 border-teal-200 rounded-full mx-auto"></div>
          <h2 className="text-xl font-medium text-white">Loading...</h2>
          <p className="text-white/70 mt-2">Verifying your session</p>
        </div>
      </div>
    );
  }
  
  // Show user data loading state
  if (isAuthenticated && userDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center dashboard-bg">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="animate-spin mb-4 h-12 w-12 border-4 border-t-teal-500 border-teal-200 rounded-full mx-auto"></div>
          <h2 className="text-xl font-medium text-white">Preparing Your Content</h2>
          <p className="text-white/70 mt-2">Loading your learning material...</p>
        </div>
      </div>
    );
  }
  
  // Show authenticated player start
  if (isAuthenticated && userData) {
    return (
      <div className="min-h-screen flex flex-col dashboard-bg">
        <Head>
          <title>Zenjin Maths | Welcome</title>
          <meta name="description" content="Start your Zenjin Maths learning journey" />
        </Head>
        
        {/* Simple header */}
        <header className="py-4 px-6 flex justify-between items-center border-b border-white/10">
          <div className="text-white font-bold text-xl">Zenjin Maths</div>
          <div>
            <UserWelcomeButton user={user} isAuthenticated={isAuthenticated} />
          </div>
        </header>
        
        {/* Main content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl max-w-lg w-full">
            <h1 className="text-3xl font-bold text-white text-center mb-6">Welcome to Zenjin Maths</h1>
            
            <p className="text-white/80 mb-8 text-center">
              Choose the right answer to each question.
              {userData.progressData?.totalPoints > 0 && 
                ` You've earned ${userData.progressData.totalPoints} points so far!`}
            </p>
            
            <div className="space-y-4">
              <button
                onClick={() => router.push('/minimal-player')}
                className="w-full py-4 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-bold rounded-xl shadow-lg transition-all"
              >
                Start Learning
              </button>
              
              <Link href="/dashboard" className="w-full py-4 bg-white/20 hover:bg-white/30 text-white font-medium rounded-xl shadow-lg transition-all block text-center">
                View Dashboard
              </Link>
              
              <div className="flex space-x-2">
                <Link href="/state-inspector" className="w-1/2 py-3 bg-amber-700/40 hover:bg-amber-700/60 text-white font-medium rounded-xl shadow-lg transition-all block text-center text-sm">
                  State Inspector
                </Link>
                
                <button
                  onClick={async () => {
                    try {
                      if (confirm('Create/repair database tables?')) {
                        const response = await fetch('/api/create-user-state-table', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include'
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                          alert('Success: ' + result.message);
                        } else {
                          alert('Error: ' + result.error);
                        }
                      }
                    } catch (e) {
                      console.error('Error creating table:', e);
                      alert('Unexpected error: ' + e);
                    }
                  }}
                  className="w-1/2 py-3 bg-yellow-700/40 hover:bg-yellow-700/60 text-white font-medium rounded-xl shadow-lg transition-all text-sm"
                >
                  Create/Repair Tables
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  // Show unauthenticated home page with sign-in option
  return (
    <div className="min-h-screen flex flex-col dashboard-bg">
      <Head>
        <title>Zenjin Maths | Welcome</title>
        <meta name="description" content="Start your Zenjin Maths learning journey" />
      </Head>
      
      {/* Simple header */}
      <header className="py-4 px-6 border-b border-white/10">
        <div className="text-white font-bold text-xl">Zenjin Maths</div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl max-w-lg w-full">
          <h1 className="text-3xl font-bold text-white text-center mb-6">Welcome to Zenjin Maths</h1>
          
          <p className="text-white/80 mb-8 text-center">
            Choose the right answer to each question to improve your mathematical skills.
          </p>
          
          <div className="space-y-4">
            <Link 
              href="/account/login" 
              className="w-full py-4 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-bold rounded-xl shadow-lg transition-all block text-center"
            >
              Sign In
            </Link>
            
            <button
              onClick={() => router.push('/minimal-player?mode=anonymous')}
              className="w-full py-4 bg-white/20 hover:bg-white/30 text-white font-medium rounded-xl shadow-lg transition-all"
            >
              Try Without Signing Up
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}