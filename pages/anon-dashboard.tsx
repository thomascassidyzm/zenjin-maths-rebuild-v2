import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import BlinkSpeedDisplay from '../components/BlinkSpeedDisplay';
import EvolutionBadge from '../components/EvolutionBadge';
import UserWelcomeButton from '../components/UserWelcomeButton';
import { startFreshAnonymousSession } from '../lib/anonymousData';
import AnonymousUpgradePrompt from '../components/subscription/AnonymousUpgradePrompt';
import SubscriptionBadge from '../components/subscription/SubscriptionBadge';

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
    
    // Check for anonymous ID in any possible location - if doesn't exist, use startFreshAnonymousSession
    // which follows our unified approach for anonymous users
    let anonymousId = localStorage.getItem('anonymousId') || 
                      localStorage.getItem('zenjin_anonymous_id') ||
                      localStorage.getItem('zenjin_user_id');
    
    if (!anonymousId) {
      console.log('No existing anonymous ID found - creating new anonymous session with unified approach');
      // Use our updated startFreshAnonymousSession that stores IDs consistently
      // across multiple locations and sets up proper tube state
      anonymousId = startFreshAnonymousSession();
      console.log(`Created new anonymous session with ID: ${anonymousId}`);
    } else {
      console.log(`Using existing anonymous ID: ${anonymousId}`);
      // Make sure ID is stored in all standard locations for consistency
      localStorage.setItem('anonymousId', anonymousId);
      localStorage.setItem('zenjin_anonymous_id', anonymousId);
      localStorage.setItem('zenjin_user_id', anonymousId);
      localStorage.setItem('zenjin_auth_state', 'anonymous');
    }
    
    // CRITICAL FIX: Before the Continue Playing button click, ensure we copy any existing state
    // to the 'triple_helix_state_${anonymousId}' format that StateMachine will look for
    const zenjinAnonymousState = localStorage.getItem('zenjin_anonymous_state');
    if (zenjinAnonymousState && anonymousId) {
      try {
        // Parse the state and check if it contains a valid tube state
        const parsedState = JSON.parse(zenjinAnonymousState);
        if (parsedState.state && parsedState.state.tubes) {
          // CRITICAL FIX: Explicitly preserve the actual activeTubeNumber from the saved state
          const activeTube = parsedState.state.activeTubeNumber || 1;
          console.log(`Found zenjin_anonymous_state with valid tube data (activeTube=${activeTube}) - copying to triple_helix_state key`);
          
          // Make sure the activeTubeNumber is correctly set in the state
          const modifiedState = {
            ...parsedState.state,
            activeTubeNumber: activeTube,
            activeTube: activeTube  // Set both for backward compatibility
          };
          
          localStorage.setItem(`triple_helix_state_${anonymousId}`, JSON.stringify(modifiedState));
        }
      } catch (e) {
        console.error('Error copying anonymous state:', e);
      }
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
  
  // Calculate time spent in hours (simulated)
  const calculateHoursSpent = () => {
    if (!dashboardData) return 0;
    
    // Simple algorithm based on points (1 point ~= 5 seconds)
    return Math.max(0.1, dashboardData.totalPoints * 5 / 3600);
  };
  
  // Main dashboard content
  return (
    <div className="min-h-screen dashboard-bg flex flex-col text-white">
      <Head>
        <title>{isAuthenticated ? 'Anonymous Mode | Zenjin Maths' : 'Your Progress | Zenjin Maths'}</title>
        <meta name="description" content="View your anonymous learning progress with Zenjin Maths" />
      </Head>
      
      {/* Special notification for authenticated users viewing anonymous dashboard */}
      {isAuthenticated && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-center text-sm">
          You're viewing content in Anonymous Mode while logged in as {user?.email}. 
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
            Anonymous Mode
          </span>
          {/* Direct Free Tier badge without loading */}
          <div 
            className="ml-3 inline-flex items-center rounded-full bg-blue-600/20 text-sm py-1 px-3 cursor-pointer"
            onClick={() => router.push('/subscribe')}
          >
            <div className="w-3 h-3 mr-1.5 rounded-full bg-blue-500"></div>
            <span className="text-blue-300 font-medium">Free Tier</span>
          </div>
          
          {/* Migration info badge */}
          <div className="ml-3 inline-flex items-center rounded-full bg-emerald-600/20 text-sm py-1 px-3">
            <div className="w-3 h-3 mr-1.5 rounded-full bg-emerald-500"></div>
            <span className="text-emerald-300 font-medium">Savable Progress</span>
          </div>
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
        {/* Progress warning banner - Simplified to remove duplicate button */}
        <div className="bg-amber-500/20 border border-amber-300/30 rounded-xl p-4 mb-6">
          <h2 className="text-amber-300 font-semibold text-lg mb-1">Anonymous Mode</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <p className="text-white/80 mb-2">
                Your learning journey is saved on this device. 
                <strong className="text-white"> Create a free account to save your progress permanently across all devices.</strong>
              </p>
              <p className="text-emerald-300 text-sm">
                ✓ All your points, progress and achievements will transfer automatically to your new account!
              </p>
            </div>
            <div className="md:w-1/3 flex items-center">
              {isAuthenticated ? (
                <button
                  onClick={() => {
                    localStorage.removeItem('anonymousId');
                    router.push('/dashboard');
                  }} 
                  className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
                >
                  Switch to My Account
                </button>
              ) : (
                <button
                  onClick={() => router.push('/signin?mode=signup')} 
                  className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-white font-medium rounded-lg transition-colors"
                >
                  Create Free Account
                </button>
              )}
            </div>
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
            
            {/* Continue Playing Button - Primary call to action */}
            <div className="mt-6">
              <Link 
                href="/minimal-player" 
                className="block bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-bold py-4 px-6 rounded-xl transition-colors text-lg text-center shadow-lg"
                onClick={() => {
                  // CRITICAL FIX: Before navigation, ensure the state is properly synchronized
                  try {
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
                      
                      // Make sure activeTube and activeTubeNumber are both set correctly
                      const normalizedState = {
                        ...mostRecentState,
                        activeTube: activeTube,
                        activeTubeNumber: activeTube,
                        userId: userId // Ensure userId is set correctly
                      };
                      
                      // Important: Save this normalized state to ALL storage locations
                      // This ensures consistent state no matter which path the code takes
                      console.log(`UNIFIED APPROACH: Saving normalized state with activeTube=${activeTube} to all storage locations`);
                      
                      // Store in all formats for maximum compatibility
                      localStorage.setItem(`zenjin_state_${userId}`, JSON.stringify(normalizedState));
                      localStorage.setItem(`triple_helix_state_${userId}`, JSON.stringify(normalizedState));
                      localStorage.setItem('zenjin_anonymous_state', JSON.stringify({ state: normalizedState }));
                      
                      // Also ensure the zenjin_user_id is set
                      localStorage.setItem('zenjin_user_id', userId);
                      
                      console.log(`UNIFIED APPROACH: Successfully prepared state for continue playing`);
                    } else {
                      console.warn(`No valid state found - continuing with default state`);
                    }
                  } catch (e) {
                    console.error('Error in Continue Playing preparation:', e);
                  }
                }}
              >
                Continue Playing
              </Link>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Enhanced upgrade prompt */}
            <AnonymousUpgradePrompt 
              points={dashboardData?.totalPoints || 0}
              hoursSpent={calculateHoursSpent()}
              onSignUp={() => router.push('/signin?mode=signup')}
            />
            
{/* Removed redundant Quick actions card as it duplicated functionality already in the AnonymousUpgradePrompt component */}
          </div>
        </div>
      </div>
    </div>
  );
}