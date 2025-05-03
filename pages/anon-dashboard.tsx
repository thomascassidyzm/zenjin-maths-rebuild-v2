import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import BlinkSpeedDisplay from '../components/BlinkSpeedDisplay';
import EvolutionBadge from '../components/EvolutionBadge';
import UserWelcomeButton from '../components/UserWelcomeButton';
import { startFreshAnonymousSession } from '../lib/anonymousData';

/**
 * Anonymous Dashboard Page
 * 
 * A simplified dashboard for anonymous users that displays their progress
 * while encouraging them to create an account to save progress permanently.
 */
export default function AnonDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // State to track the source of the visit (direct or from query parameter)
  const [visitSource, setVisitSource] = useState<'direct' | 'forced' | 'normal'>('normal');
  
  // Check URL parameters on mount
  useEffect(() => {
    if (router.query.force === 'true') {
      setVisitSource('forced');
    } else if (!router.query.from) {
      setVisitSource('direct');
    }
  }, [router.query]);
  
  // Load anonymous user data from localStorage
  useEffect(() => {
    // No redirects for authenticated users - let them see the anonymous dashboard
    // if they want to, which shows data from localStorage
    
    // Check for anonymous ID - if doesn't exist, create one
    const anonymousId = localStorage.getItem('anonymousId');
    if (!anonymousId) {
      // Generate new anonymous ID
      const newAnonymousId = `anon-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      localStorage.setItem('anonymousId', newAnonymousId);
      
      // Initialize progress data for anonymous user
      const progressData = {
        totalPoints: 0,
        blinkSpeed: 2.5,
        blinkSpeedTrend: 'steady',
        evolution: {
          currentLevel: 'Mind Spark',
          levelNumber: 1,
          progress: 0,
          nextLevel: 'Thought Weaver'
        },
        lastSessionDate: new Date().toISOString()
      };
      
      // Save initial progress data
      localStorage.setItem(`progressData_${newAnonymousId}`, JSON.stringify(progressData));
    }
    
    // Load data from localStorage for anonymous users
    try {
      setIsLoading(true);
      
      // Get anonymous ID
      const anonymousId = localStorage.getItem('anonymousId') || '';
      
      // Try to get stored session data for anonymous user
      const storedSessionData = localStorage.getItem(`sessionData_${anonymousId}`);
      const storedProgressData = localStorage.getItem(`progressData_${anonymousId}`);
      
      if (storedSessionData || storedProgressData) {
        // Parse the data
        const sessionData = storedSessionData ? JSON.parse(storedSessionData) : null;
        const progressData = storedProgressData ? JSON.parse(storedProgressData) : null;
        
        // Prepare dashboard data from stored data
        setDashboardData({
          totalPoints: progressData?.totalPoints || sessionData?.totalPoints || 0,
          blinkSpeed: progressData?.blinkSpeed || sessionData?.blinkSpeed || 2.5,
          blinkSpeedTrend: progressData?.blinkSpeedTrend || 'steady',
          evolution: progressData?.evolution || {
            currentLevel: 'Mind Spark',
            levelNumber: 1,
            progress: 0,
            nextLevel: 'Thought Weaver'
          },
          // We don't show recent sessions for anonymous users
          recentSessions: []
        });
      } else {
        // No stored data, set default values
        setDashboardData({
          totalPoints: 0,
          blinkSpeed: 2.5,
          blinkSpeedTrend: 'steady',
          evolution: {
            currentLevel: 'Mind Spark',
            levelNumber: 1,
            progress: 0,
            nextLevel: 'Thought Weaver'
          },
          recentSessions: []
        });
      }
    } catch (error) {
      console.error('Error loading anonymous dashboard data:', error);
      // Set default values on error
      setDashboardData({
        totalPoints: 0,
        blinkSpeed: 2.5,
        blinkSpeedTrend: 'steady',
        evolution: {
          currentLevel: 'Mind Spark',
          levelNumber: 1,
          progress: 0,
          nextLevel: 'Thought Weaver'
        },
        recentSessions: []
      });
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Show loading state
  if (loading || isLoading) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-t-teal-500 border-teal-200 rounded-full"></div>
      </div>
    );
  }
  
  // Main dashboard content
  return (
    <div className="min-h-screen dashboard-bg flex flex-col text-white">
      <Head>
        <title>{isAuthenticated ? 'Guest Mode | Zenjin Maths' : 'Your Progress | Zenjin Maths'}</title>
        <meta name="description" content="View your anonymous learning progress with Zenjin Maths" />
      </Head>
      
      {/* Special notification for authenticated users viewing anonymous dashboard */}
      {isAuthenticated && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-center text-sm">
          You're viewing content in Guest Mode while logged in as {user?.email}. 
          <button onClick={() => router.push('/dashboard')} className="underline ml-2 font-bold">
            Return to My Dashboard
          </button>
        </div>
      )}
      
      {/* Header with mode information */}
      <header className="py-4 px-6 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold">Your Progress</h1>
          <span className="ml-3 bg-amber-600/30 text-amber-300 text-xs px-2 py-1 rounded-full">
            Guest Mode
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Switch to My Account
            </button>
          )}
          <UserWelcomeButton user={null} isAuthenticated={false} />
        </div>
      </header>
      
      {/* Main content */}
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Progress warning banner */}
        <div className="bg-amber-500/20 border border-amber-300/30 rounded-xl p-4 mb-6">
          <h2 className="text-amber-300 font-semibold text-lg mb-1">Anonymous Mode</h2>
          <p className="text-white/80 mb-3">
            You're in Guest Mode! Your learning journey is saved on this device. 
            Create a free account anytime to save your progress across all devices.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link 
              href="/minimal-player?mode=anonymous&force=true&resetPoints=true" 
              className="inline-block px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-medium rounded-lg transition-colors"
            >
              Continue Playing
            </Link>
            {isAuthenticated && (
              <button
                onClick={() => {
                  localStorage.removeItem('anonymousId');
                  router.push('/dashboard');
                }} 
                className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
              >
                Switch to My Account
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Evolution Badge */}
            {dashboardData?.evolution && (
              <EvolutionBadge evolution={dashboardData.evolution} />
            )}
            
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Blink Speed */}
              <BlinkSpeedDisplay 
                blinkSpeed={dashboardData?.blinkSpeed || 0} 
                trend={dashboardData?.blinkSpeedTrend || 'steady'} 
              />
              
              {/* Total Points */}
              <div className="rounded-xl border border-white/20 bg-white/10 p-4">
                <h3 className="text-lg font-semibold text-white mb-2">Total Points</h3>
                <div className="text-3xl font-bold text-white">
                  {dashboardData?.totalPoints ? dashboardData.totalPoints.toLocaleString() : '0'}
                </div>
                <div className="text-xs text-white/70 mt-1">Lifetime Points</div>
              </div>
            </div>
            
            {/* Continue Learning Button */}
            <div className="mt-6">
              <Link 
                href="/minimal-player?mode=anonymous&resetPoints=true" 
                className="block bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-bold py-4 px-6 rounded-xl transition-colors text-lg text-center shadow-lg"
              >
                Continue Learning
              </Link>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Benefits of Creating an Account */}
            <div className="rounded-xl border border-white/20 bg-white/10 p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Create an Account to:</h3>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-teal-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-white">Save your progress permanently</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-teal-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-white">Continue learning on any device</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-teal-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-white">Track your progress over time</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-teal-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-white">Unlock additional features</span>
                </li>
              </ul>
              <div className="mt-4 space-y-2">
                <Link 
                  href="/signin" 
                  className="w-full block py-2 bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg transition-colors text-center"
                >
                  Create Free Account
                </Link>
                
                <button 
                  onClick={() => {
                    // Start a completely fresh anonymous session
                    startFreshAnonymousSession();
                    // Reload the page to show the reset state
                    window.location.href = '/anon-dashboard?reset=true';
                  }}
                  className="w-full block py-2 bg-red-800/30 hover:bg-red-700/30 text-white font-medium rounded-lg transition-colors text-center border border-red-500/30 text-sm"
                >
                  Start Fresh Session
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}