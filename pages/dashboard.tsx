/**
 * Dashboard Page Example
 * 
 * This dashboard page demonstrates how to incorporate subscription components
 * and enforce access rules for premium content.
 */
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import SubscriptionBadge from '../components/subscription/SubscriptionBadge';
import SubscriptionStatus from '../components/subscription/SubscriptionStatus';

export default function Dashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { isSubscribed, isPremiumReady, isFreeTier } = useSubscription();
  
  // Example content items with premium flag
  const contentItems = [
    { id: 1, title: 'Number Basics', description: 'Learn the fundamentals of numbers', isPremium: false },
    { id: 2, title: 'Addition & Subtraction', description: 'Master basic operations', isPremium: false },
    { id: 3, title: 'Multiplication', description: 'Multiply with confidence', isPremium: false },
    { id: 4, title: 'Division Essentials', description: 'Conquer division problems', isPremium: false },
    { id: 5, title: 'Fractions Introduction', description: 'Understand parts of a whole', isPremium: false },
    { id: 6, title: 'Decimals Basics', description: 'Work with decimal numbers', isPremium: false },
    { id: 7, title: 'Percentages', description: 'Calculate percentages easily', isPremium: false },
    { id: 8, title: 'Negative Numbers', description: 'Navigate numbers below zero', isPremium: false },
    { id: 9, title: 'Multiples & Factors', description: 'Find relationships between numbers', isPremium: false },
    { id: 10, title: 'Prime Numbers', description: 'Discover special numbers', isPremium: false },
    { id: 11, title: 'Advanced Fractions', description: 'Operations with fractions', isPremium: true },
    { id: 12, title: 'Complex Decimals', description: 'Advanced decimal operations', isPremium: true },
    { id: 13, title: 'Ratio & Proportion', description: 'Compare quantities', isPremium: true },
    { id: 14, title: 'Algebra Foundations', description: 'Intro to algebraic thinking', isPremium: true },
    { id: 15, title: 'Equations', description: 'Solve for unknown values', isPremium: true },
    { id: 16, title: 'Geometry Basics', description: 'Explore shapes and space', isPremium: true },
    { id: 17, title: 'Area & Volume', description: 'Calculate space and capacity', isPremium: true },
    { id: 18, title: 'Data & Statistics', description: 'Analyze information', isPremium: true },
    { id: 19, title: 'Probability', description: 'Predict outcomes', isPremium: true },
    { id: 20, title: 'Problem Solving', description: 'Apply math to real situations', isPremium: true },
  ];
  
  // Stats data (simulate data from API)
  const [userStats, setUserStats] = useState({
    totalPoints: 0,
    sessionsCompleted: 0,
    questionsAnswered: 0,
    accuracy: 0,
    streak: 0
  });
  
  // Fetch user stats on mount (simulated API call)
  useEffect(() => {
    // In a real app, you'd fetch this from your API
    setUserStats({
      totalPoints: isSubscribed ? 2750 : 350,
      sessionsCompleted: isSubscribed ? 28 : 4,
      questionsAnswered: isSubscribed ? 356 : 45,
      accuracy: isSubscribed ? 92 : 82,
      streak: isSubscribed ? 7 : 2
    });
  }, [isSubscribed]);
  
  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };
  
  // Handle content click
  const handleContentClick = (item) => {
    if (item.isPremium && isFreeTier) {
      router.push('/subscribe');
    } else {
      router.push(`/play?content=${item.id}`);
    }
  };
  
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
            
            {/* Quick stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10"
            >
              <h2 className="font-bold text-lg mb-3">Your Progress</h2>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Total Points</span>
                    <span className="font-medium">{userStats.totalPoints}</span>
                  </div>
                  <div className="mt-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-500" 
                      style={{ width: `${Math.min((userStats.totalPoints / 5000) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Sessions</span>
                  <span>{userStats.sessionsCompleted}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Questions</span>
                  <span>{userStats.questionsAnswered}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Accuracy</span>
                  <span>{userStats.accuracy}%</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Streak</span>
                  <span className="flex items-center">
                    {userStats.streak}
                    <svg className="w-4 h-4 text-amber-400 ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  </span>
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
                
                <Link href="/play" passHref legacyBehavior>
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
              <motion.h1 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-2xl font-bold"
              >
                Your Learning Path
              </motion.h1>
              
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex space-x-3"
              >
                <Link href="/play" passHref legacyBehavior>
                  <a className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 rounded-lg transition-colors flex items-center">
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
              </motion.div>
            </div>
            
            {/* Content grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contentItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + (index * 0.05) }}
                  className={`relative rounded-xl overflow-hidden ${
                    item.isPremium && isFreeTier
                      ? 'bg-gradient-to-br from-purple-900/30 to-purple-600/30 border border-purple-500/30'
                      : 'bg-white/10 hover:bg-white/15 border border-white/10'
                  } backdrop-blur-sm transition-colors cursor-pointer group`}
                  onClick={() => handleContentClick(item)}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{item.title}</h3>
                      
                      {item.isPremium && (
                        <div className="bg-purple-600/40 text-purple-200 text-xs px-2 py-0.5 rounded-full flex items-center">
                          {isFreeTier ? (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              Premium
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                              Unlocked
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm text-white/70 mt-1 mb-6">{item.description}</p>
                    
                    <div className="absolute bottom-3 right-4">
                      <div className={`rounded-full w-8 h-8 flex items-center justify-center group-hover:bg-opacity-80 ${
                        item.isPremium && isFreeTier
                          ? 'bg-purple-600/40 text-purple-200 group-hover:bg-purple-500/50'
                          : 'bg-teal-600/40 text-teal-200 group-hover:bg-teal-500/50'
                      } transition-colors`}>
                        {item.isPremium && isFreeTier ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        )}
                      </div>
                    </div>
                    
                    {/* Lock overlay for premium content in free tier */}
                    {item.isPremium && isFreeTier && (
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-purple-950/80 flex items-end justify-center p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="px-4 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 rounded-lg text-sm font-medium transition-colors">
                          Upgrade to Unlock
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
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