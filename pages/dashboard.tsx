/**
 * Dashboard Page Example
 * 
 * This dashboard page demonstrates how to incorporate subscription components
 * and enforce access rules for premium content.
 */
import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import useDashboard from '../hooks/useDashboard';
import SubscriptionBadge from '../components/subscription/SubscriptionBadge';
import SubscriptionStatus from '../components/subscription/SubscriptionStatus';
import BlinkSpeedDisplay from '../components/BlinkSpeedDisplay';
import EvolutionBadge from '../components/EvolutionBadge';

export default function Dashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { isSubscribed, isPremiumReady, isFreeTier } = useSubscription();
  
  // No fictional content items - removed as they're not needed
  
  // Fetch actual dashboard data using our dashboard hook
  const dashboardData = useDashboard();
  
  // Computed user stats from dashboard data
  const userStats = {
    totalPoints: dashboardData.totalPoints || 0,
    sessionsCompleted: dashboardData.recentSessions?.length || 0,
    questionsAnswered: dashboardData.recentSessions?.reduce(
      (sum, session) => sum + (session.total_questions || 0), 0) || 0,
    accuracy: dashboardData.recentSessions?.length > 0 
      ? Math.round(dashboardData.recentSessions.reduce(
          (sum, session) => sum + ((session.correct_answers / session.total_questions) * 100), 0
        ) / dashboardData.recentSessions.length) 
      : 0,
    streak: 1 // Default streak (could be enhanced with actual streak calculation)
  };
  
  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };
  
  // No content click handler needed - removed fictional content items
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
      <Head>
        <title>Dashboard | Zenjin Maths</title>
        <meta name="description" content="Your Zenjin Maths dashboard" />
      </Head>
      
      {/* Header */}
      <header className="bg-[#0f172a]/50 backdrop-blur-sm border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            {/* Logo and title */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-xl font-bold">
                Z
              </div>
              <h1 className="text-xl font-bold">Zenjin Maths</h1>
            </div>
            
            {/* User and subscription info */}
            <div className="flex items-center space-x-4">
              <SubscriptionBadge size="sm" />
              
              {user && (
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-white/70">{user.email}</div>
                  <button
                    onClick={handleSignOut} 
                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    aria-label="Sign out"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Database Connection Warning */}
      {dashboardData.dataSource && dashboardData.dataSource !== 'database' && !dashboardData.loading && (
        <div className="bg-amber-600/20 backdrop-blur-sm border-t border-b border-amber-600/30">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-amber-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <div>
                <p className="text-sm text-amber-200 font-medium">
                  {dashboardData.dataSource === 'cache' 
                    ? "Using locally cached data - your activity is not being saved to your account" 
                    : "Database connection unavailable - your actual progress is not shown"}
                </p>
                <p className="text-xs text-amber-200/70 mt-1">
                  {dashboardData.dataSource === 'cache'
                    ? "Your progress won't be saved but you can continue learning with bundled content."
                    : "Your progress won't be saved but you can still practice with bundled content."}
                </p>
              </div>
              <div className="ml-auto flex space-x-2">
                <button 
                  onClick={() => dashboardData.refresh()} 
                  className="bg-amber-600/30 hover:bg-amber-600/50 text-amber-100 text-xs py-1 px-3 rounded flex items-center"
                >
                  <svg className={`w-3 h-3 mr-1 ${dashboardData.loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Try Again
                </button>
                
                {dashboardData.fallbackContent && (
                  <button 
                    onClick={() => router.push(`/play?stitch=${dashboardData.fallbackContent?.suggestedNext?.id || ''}&fallback=true`)}
                    className="bg-teal-600/50 hover:bg-teal-600/70 text-teal-100 text-xs py-1 px-3 rounded flex items-center"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Continue With Bundled Content
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* User welcome */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10"
            >
              <h2 className="font-bold text-xl mb-2">Welcome back!</h2>
              <p className="text-white/70 text-sm">
                {isSubscribed 
                  ? "Continue your premium learning journey"
                  : "You're making good progress. Keep it up!"}
              </p>
            </motion.div>
            
            {/* Subscription status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <SubscriptionStatus />
            </motion.div>
            
            {/* Enhanced Progress Section with Evolution Badge */}
            {dashboardData.evolution && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <EvolutionBadge 
                  evolution={dashboardData.evolution || {
                    currentLevel: 'Mind Spark',
                    levelNumber: 1,
                    progress: 0,
                    nextLevel: 'Thought Weaver'
                  }} 
                />
              </motion.div>
            )}
            
            {/* Enhanced Stats Display */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"
            >
              {/* Blink Speed */}
              <BlinkSpeedDisplay 
                blinkSpeed={dashboardData?.blinkSpeed || 2.5} 
                trend={dashboardData?.blinkSpeedTrend || 'steady'} 
              />
              
              {/* Total Points */}
              <div className="rounded-xl border border-white/20 bg-white/10 p-4">
                <h3 className="text-lg font-semibold text-white mb-2">Total Points</h3>
                <div className="text-3xl font-bold text-white">
                  {userStats.totalPoints.toLocaleString()}
                </div>
                <div className="text-xs text-white/70 mt-1">Lifetime Points</div>
                <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-500" 
                    style={{ width: `${Math.min((userStats.totalPoints / 5000) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            </motion.div>
            
            {/* Detailed Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 mt-4"
            >
              <h2 className="font-bold text-lg mb-3">Learning Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-white/70 text-sm mb-1">Sessions</div>
                  <div className="text-xl font-bold">{userStats.sessionsCompleted}</div>
                </div>
                
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-white/70 text-sm mb-1">Questions</div>
                  <div className="text-xl font-bold">{userStats.questionsAnswered}</div>
                </div>
                
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-white/70 text-sm mb-1">Accuracy</div>
                  <div className="text-xl font-bold">{userStats.accuracy}%</div>
                </div>
                
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-white/70 text-sm mb-1">Streak</div>
                  <div className="text-xl font-bold flex items-center">
                    {userStats.streak}
                    <svg className="w-5 h-5 text-amber-400 ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Navigation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden"
            >
              <div className="p-4 border-b border-white/10">
                <h2 className="font-bold text-lg">Navigation</h2>
              </div>
              <nav className="divide-y divide-white/5">
                <Link href="/dashboard" passHref legacyBehavior>
                  <a className="flex items-center px-4 py-3 text-white bg-white/5">
                    <svg className="w-5 h-5 mr-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Dashboard
                  </a>
                </Link>
                
                <Link href="/minimal-player" passHref legacyBehavior>
                  <a className="flex items-center px-4 py-3 text-white hover:bg-white/5 transition-colors">
                    <svg className="w-5 h-5 mr-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Play Now
                  </a>
                </Link>
                
                <Link href="/progress" passHref legacyBehavior>
                  <a className="flex items-center px-4 py-3 text-white hover:bg-white/5 transition-colors">
                    <svg className="w-5 h-5 mr-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Your Progress
                  </a>
                </Link>
                
                <Link href="/settings" passHref legacyBehavior>
                  <a className="flex items-center px-4 py-3 text-white hover:bg-white/5 transition-colors">
                    <svg className="w-5 h-5 mr-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </a>
                </Link>
                
                <Link href="/subscribe" passHref legacyBehavior>
                  <a className="flex items-center px-4 py-3 text-white hover:bg-white/5 transition-colors">
                    <svg className="w-5 h-5 mr-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    Subscription
                  </a>
                </Link>
              </nav>
            </motion.div>
          </div>
          
          {/* Main content area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Content heading */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center"
              >
                <div>
                  <h1 className="text-2xl font-bold">Your Learning Path</h1>
                  {!dashboardData.loading && dashboardData.dataSource && (
                    <div className={`text-xs mt-1 ${dashboardData.dataSource !== 'database' ? 'text-amber-400' : 'text-white/40'}`}>
                      {dashboardData.dataSource === 'cache' ? (
                        <span className="flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                          </svg>
                          Using locally cached data - this progress has not been saved to your account
                        </span>
                      ) : dashboardData.dataSource === 'emergency-fallback' ? (
                        <span className="flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          Database connection unavailable - your actual progress is not being shown
                        </span>
                      ) : (
                        <span>Connected to database - progress is being saved to your account</span>
                      )}
                    </div>
                  )}
                </div>
                {dashboardData.loading && (
                  <div className="ml-3 text-white/50 text-sm flex items-center">
                    <svg className="animate-spin mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </div>
                )}
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex space-x-3"
              >
                <Link href="/minimal-player?continue=true" passHref legacyBehavior>
                  <a className="px-6 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 rounded-lg transition-colors flex items-center font-medium text-base shadow-lg"
                     onClick={() => {
                       // UNIFIED APPROACH: Before navigation, ensure the state is properly synchronized
                       try {
                         // Import state logger for debugging
                         const { logActiveTubeState, compareLocalStorageStates, logStateDebug } = require('../lib/logging/stateLogger');

                         // Log detailed state information to help diagnose tube persistence issues
                         console.group('Continue Learning - State Diagnostics');
                         console.log('=======================================================');
                         console.log('TUBE STATE DIAGNOSTICS - Continue Learning Button Click');
                         console.log('=======================================================');
                         logActiveTubeState();
                         compareLocalStorageStates();

                         // Get the anonymous/user ID from any valid location
                         const userId = localStorage.getItem('zenjin_user_id') ||
                                      localStorage.getItem('zenjin_anonymous_id') ||
                                      localStorage.getItem('anonymousId');

                         if (!userId) {
                           console.error('No user ID found in localStorage - cannot prepare state');
                           return;
                         }

                         console.log(`UNIFIED APPROACH: Preparing continue playing with userId: ${userId}`);

                         // Check all possible state storage locations and find the most recent one
                         const stateOptions = [
                           { key: `zenjin_state_${userId}`, label: 'main state' },
                           { key: 'zenjin_anonymous_state', label: 'anonymous state' },
                           { key: `triple_helix_state_${userId}`, label: 'triple helix state' }
                         ];

                         let mostRecentState = null;
                         let mostRecentTimestamp = 0;
                         let stateSource = '';

                         // Find the most recent valid state with tube information
                         stateOptions.forEach(option => {
                           try {
                             const stateJson = localStorage.getItem(option.key);
                             if (stateJson) {
                               const parsedState = JSON.parse(stateJson);

                               // Check if it's a valid state with tube information
                               // Different states have different structures
                               let stateObj = null;
                               let lastUpdated = null;
                               let activeTube = null;

                               // Check for state in zenjin_anonymous_state format
                               if (parsedState && parsedState.state && parsedState.state.tubes) {
                                 stateObj = parsedState.state;
                                 lastUpdated = parsedState.state.lastUpdated;
                                 activeTube = parsedState.state.activeTubeNumber || parsedState.state.activeTube;
                               }
                               // Check for state in direct UserState format
                               else if (parsedState && parsedState.tubes && (parsedState.activeTube || parsedState.activeTubeNumber)) {
                                 stateObj = parsedState;
                                 lastUpdated = parsedState.lastUpdated;
                                 activeTube = parsedState.activeTubeNumber || parsedState.activeTube;
                               }

                               if (stateObj && activeTube) {
                                 // Parse the timestamp and compare with the most recent
                                 const timestamp = lastUpdated ? new Date(lastUpdated).getTime() : 0;

                                 // Log for additional debugging
                                 console.log(`TUBE STATE: ${option.label} has activeTube=${activeTube}, timestamp=${new Date(lastUpdated).toISOString()}`);

                                 if (timestamp > mostRecentTimestamp) {
                                   mostRecentState = stateObj;
                                   mostRecentTimestamp = timestamp;
                                   stateSource = option.label;
                                 }
                               }
                             }
                           } catch (e) {
                             console.error(`Error checking ${option.label}:`, e);
                           }
                         });

                         // If we found a valid state, ensure it's in all required formats
                         if (mostRecentState) {
                           const activeTube = mostRecentState.activeTubeNumber || mostRecentState.activeTube || 1;
                           console.log(`UNIFIED APPROACH: Found most recent state from ${stateSource} with activeTube=${activeTube}`);

                           // CRITICAL: Check if there are tube records that indicate actual usage
                           // This ensures we don't override actual tube state with a default value
                           let hasTubeData = false;
                           let altTube = 0;
                           if (mostRecentState.tubes) {
                             Object.entries(mostRecentState.tubes).forEach(([tubeNumber, tubeData]) => {
                               // @ts-ignore
                               if (tubeData && tubeData.currentStitchId && tubeData.currentStitchId !== '') {
                                 console.log(`TUBE CHECK: Tube ${tubeNumber} has stitch ${
                                   // @ts-ignore
                                   tubeData.currentStitchId}`);
                                 hasTubeData = true;

                                 // If any tube has a non-zero position, it's likely been used
                                 // @ts-ignore
                                 if (tubeData.position && tubeData.position > 0) {
                                   // @ts-ignore
                                   console.log(`IMPORTANT: Tube ${tubeNumber} has position=${tubeData.position} > 0`);
                                   altTube = parseInt(tubeNumber, 10);
                                 }
                               }
                             });
                           }

                           // If there's a tube with position > 0, prefer using that as the active tube
                           // This resolves cases where the tube state gets incorrectly reset to 1
                           const correctedTube = (altTube > 0 && altTube !== activeTube) ? altTube : activeTube;

                           if (correctedTube !== activeTube) {
                             console.log(`🔄 TUBE CORRECTION: Changing active tube from ${activeTube} to ${correctedTube} based on position data`);
                           }

                           // CRITICAL FIX: Deep copy the state to avoid reference issues
                           const deepCopy = JSON.parse(JSON.stringify(mostRecentState));

                           // Make sure activeTube and activeTubeNumber are both set correctly with the corrected value
                           const normalizedState = {
                             ...deepCopy,
                             activeTube: correctedTube,
                             activeTubeNumber: correctedTube,
                             userId: userId // Ensure userId is set correctly
                           };

                           // Important: Save this normalized state to ALL storage locations
                           // This ensures consistent state no matter which path the code takes
                           console.log(`UNIFIED APPROACH: Saving normalized state with activeTube=${correctedTube} to all storage locations`);

                           // Store in all formats for maximum compatibility
                           localStorage.setItem(`zenjin_state_${userId}`, JSON.stringify(normalizedState));
                           localStorage.setItem(`triple_helix_state_${userId}`, JSON.stringify(normalizedState));
                           localStorage.setItem('zenjin_anonymous_state', JSON.stringify({ state: normalizedState }));

                           // Also flag that we should continue from previous state
                           localStorage.setItem('zenjin_continue_previous_state', 'true');

                           // Also ensure the zenjin_user_id is set
                           localStorage.setItem('zenjin_user_id', userId);

                           console.log(`UNIFIED APPROACH: Successfully prepared state for continue playing with tube ${correctedTube}`);
                           console.groupEnd();
                         } else {
                           console.warn(`No valid state found - continuing with default state`);
                           console.groupEnd();
                         }
                       } catch (e) {
                         console.error('Error in Continue Playing preparation:', e);
                         console.groupEnd();
                       }
                     }}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Continue Learning
                  </a>
                </Link>
                
                {!isSubscribed && (
                  <Link href="/subscribe" passHref legacyBehavior>
                    <a className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                      Upgrade
                    </a>
                  </Link>
                )}
                
                <button 
                  onClick={() => dashboardData.refresh()} 
                  disabled={dashboardData.loading}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Refresh dashboard data"
                >
                  <svg className={`w-5 h-5 mr-2 ${dashboardData.loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </motion.div>
            </div>
            
            {/* Enhanced learning stats display */}
            <div className="bg-gradient-to-br from-teal-600/20 to-emerald-600/20 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-teal-500/30">
              <h2 className="text-xl font-bold mb-4 text-white">Your Learning Progress</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Enhanced stats card 1: Points and accuracy */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10"
                >
                  <h3 className="text-lg font-semibold text-white mb-4">Points & Accuracy</h3>
                  
                  <div className="space-y-4">
                    {/* Total Points with larger display */}
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-white/70">Total Points</span>
                        <span className="text-2xl font-bold text-white">{userStats.totalPoints.toLocaleString()}</span>
                      </div>
                      <div className="mt-1 h-3 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-teal-500 to-emerald-500" 
                          style={{ width: `${Math.min((userStats.totalPoints / 5000) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* Accuracy with fixed NaN */}
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-white/70">Accuracy</span>
                        <span className="text-2xl font-bold text-white">
                          {isNaN(userStats.accuracy) ? '0' : userStats.accuracy}%
                        </span>
                      </div>
                      <div className="mt-1 h-3 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500" 
                          style={{ width: `${isNaN(userStats.accuracy) ? 0 : userStats.accuracy}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
                
                {/* Enhanced stats card 2: Streaks and sessions */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10"
                >
                  <h3 className="text-lg font-semibold text-white mb-4">Sessions & Streaks</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Sessions completed */}
                    <div className="bg-white/10 rounded-lg p-3">
                      <div className="text-white/70 text-sm mb-1">Sessions</div>
                      <div className="text-xl font-bold">{userStats.sessionsCompleted}</div>
                    </div>
                    
                    {/* Questions answered */}
                    <div className="bg-white/10 rounded-lg p-3">
                      <div className="text-white/70 text-sm mb-1">Questions</div>
                      <div className="text-xl font-bold">{userStats.questionsAnswered}</div>
                    </div>
                    
                    {/* Streak with star icon */}
                    <div className="bg-white/10 rounded-lg p-3">
                      <div className="text-white/70 text-sm mb-1">Streak</div>
                      <div className="text-xl font-bold flex items-center">
                        {userStats.streak}
                        <svg className="w-5 h-5 text-amber-400 ml-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Last session */}
                    <div className="bg-white/10 rounded-lg p-3">
                      <div className="text-white/70 text-sm mb-1">Last Session</div>
                      <div className="text-sm font-medium">
                        {dashboardData.lastSessionDate ? 
                          new Date(dashboardData.lastSessionDate).toLocaleDateString() : 
                          'Today'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="mt-12 border-t border-white/10 py-6">
        <div className="container mx-auto px-4 text-center text-white/50 text-sm">
          <p>© {new Date().getFullYear()} Zenjin Maths. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}