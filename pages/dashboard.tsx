import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';
import BlinkSpeedDisplay from '../components/BlinkSpeedDisplay';
import EvolutionBadge from '../components/EvolutionBadge';
import GlobalStanding from '../components/GlobalStanding';
import RecentSessions from '../components/RecentSessions';
import SubscriptionStatusIndicator from '../components/subscription/SubscriptionStatusIndicator';
import UserWelcomeButton from '../components/UserWelcomeButton';

/**
 * Dashboard Page
 * 
 * Shows user's progress data and learning statistics.
 * This implementation has a clean auth-aware pattern with proper loading states.
 */
// Helper function to get auth headers from localStorage
function getAuthHeaders() {
  // Try to get the token from localStorage
  if (typeof window !== 'undefined') {
    const supabaseToken = localStorage.getItem('sb-ggwoupzaruiaaliylxga-auth-token');
    if (supabaseToken) {
      try {
        const parsedToken = JSON.parse(supabaseToken);
        if (parsedToken?.access_token) {
          return {
            'Authorization': `Bearer ${parsedToken.access_token}`
          };
        }
      } catch (e) {
        console.error('Failed to parse supabase token:', e);
      }
    }
  }
  return {};
}

// Helper function to directly call the Supabase updateUser API
async function updateUserPassword(password, currentPassword = null) {
  if (typeof window === 'undefined') return { success: false, error: 'Cannot run in server context' };
  
  try {
    // Load the Supabase JS client dynamically to avoid SSR issues
    const { createClient } = await import('@supabase/supabase-js');
    
    // Create a Supabase client with the stored credentials
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylxga.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5MTczNDAsImV4cCI6MjA1NzQ5MzM0MH0.gXtiM5b3YZoV5SMRrMmY59Qp7VjadOxkJ5an0Q3Og_c'
    );
    
    // Check for currentPassword to determine if this is an update or initial set
    if (currentPassword) {
      // Re-authenticate first for password update
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user?.email) {
        console.error('Error getting current user:', authError);
        return { 
          success: false, 
          error: authError?.message || 'Authentication failed' 
        };
      }
      
      // Try to sign in with the current password to verify it
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });
      
      if (signInError) {
        console.error('Current password verification failed:', signInError);
        return { 
          success: false, 
          error: 'Current password is incorrect' 
        };
      }
    }
    
    // Update the user's password
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });
    
    if (updateError) {
      console.error('Error updating password:', updateError);
      return { 
        success: false, 
        error: updateError.message 
      };
    }
    
    // Update local profile data to indicate user has a password
    try {
      const response = await fetch('/api/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          has_password: true
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.warn('Failed to update profile has_password flag, but password was updated');
      }
    } catch (profileError) {
      console.warn('Error updating profile has_password flag:', profileError);
      // Continue anyway since password was updated
    }
    
    return { 
      success: true, 
      message: 'Password updated successfully' 
    };
  } catch (error) {
    console.error('Exception updating password:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
}

export default function Dashboard() {
  const router = useRouter();
  const { user, isAuthenticated, loading, userData, refreshUserData, signOut } = useAuth();
  const { isSubscribed, tier, isLoading: subscriptionLoading } = useSubscriptionStatus();
  
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  
  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailMessage, setEmailMessage] = useState({ text: '', type: '' });
  
  // Password change state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState({ text: '', type: '' });
  const [hasPassword, setHasPassword] = useState(false);
  
  // Load dashboard data once auth is confirmed - but only once
  useEffect(() => {
    const loadDashboardData = async () => {
      // If not authenticated or still loading auth, exit early
      if (loading || !isAuthenticated || !user) {
        return;
      }
      
      // Only load if we don't already have data to prevent refreshing
      // This gate prevents repeated data loading when state dependencies change
      if (dashboardData !== null && !isLoading) {
        return;
      }
      
      console.log('Dashboard: Starting data load');
      setIsLoading(true);
      setError(null);
      
      try {
        // First use cached data if available for immediate display
        if (userData && userData.progressData) {
          console.log('Using user data from auth context for initial display');
          setDashboardData({
            userId: user.id,
            totalPoints: userData.progressData.totalPoints || 0,
            blinkSpeed: userData.progressData.blinkSpeed || 0,
            blinkSpeedTrend: userData.progressData.blinkSpeedTrend || 'steady',
            evolution: userData.progressData.evolution || {
              currentLevel: 'Mind Spark',
              levelNumber: 1,
              progress: 0,
              nextLevel: 'Thought Weaver'
            },
            globalStanding: {
              percentile: null,
              date: null,
              message: 'Calculating your global standing...'
            },
            recentSessions: []
          });
        }
        
        // Fetch fresh data from the API
        console.log('Fetching dashboard data from API with auth');
        
        // Get session token for authorization header
        let authHeader = {};
        if (typeof window !== 'undefined') {
          // Try to get the token from localStorage or supabase
          const supabaseToken = localStorage.getItem('sb-ggwoupzaruiaaliylxga-auth-token');
          if (supabaseToken) {
            try {
              const parsedToken = JSON.parse(supabaseToken);
              if (parsedToken?.access_token) {
                authHeader = {
                  'Authorization': `Bearer ${parsedToken.access_token}`
                };
                console.log('Added authorization header with token');
              }
            } catch (e) {
              console.error('Failed to parse supabase token:', e);
            }
          }
        }
        
        const response = await fetch('/api/dashboard', {
          headers: { 
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache',
            ...authHeader
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to load dashboard data: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Dashboard: Got fresh data with recent sessions:', data?.recentSessions?.length || 0);
        setDashboardData(data);
      } catch (err: any) {
        // If we have no data at all, then show error
        if (!dashboardData) {
          console.error('Error loading dashboard data:', err);
          setError(err.message || 'Failed to load dashboard data');
        } else {
          // If we already have cached data, just log the error
          console.error('Error refreshing dashboard data, using cached data:', err);
        }
      }
      
      try {
        // Try to load user profile (display name)
        const profileResponse = await fetch('/api/user-profile', {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          if (profileData.displayName) {
            setDisplayName(profileData.displayName);
          }
        }
      } catch (err: any) {
        console.error('Error loading user profile data:', err);
        // Don't set error for profile loading issues - it's not critical
      } finally {
        // Always set loading to false when all data fetching is complete
        setIsLoading(false);
      }
    };
    
    // Only run once on mount and when auth state changes
    loadDashboardData();
  }, [isAuthenticated, loading, user]);
  
  // Redirect to login if not authenticated
  // Update hasPassword when userData changes
  useEffect(() => {
    if (userData?.profile) {
      setDisplayName(userData.profile.display_name || '');
      setHasPassword(!!userData.profile.has_password);
    }
  }, [userData]);
  
  // Set active tab from query parameters if available
  useEffect(() => {
    if (router.query.tab === 'account') {
      setActiveTab('account');
    }
  }, [router.query]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/signin?redirect=/');
    }
  }, [isAuthenticated, loading, router]);
  
  // Handle refresh button click
  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Refresh user data from auth context
      await refreshUserData();
      
      // Also refresh dashboard specific data
      // Get session token for authorization header
      let authHeader = {};
      if (typeof window !== 'undefined') {
        // Try to get the token from localStorage or supabase
        const supabaseToken = localStorage.getItem('sb-ggwoupzaruiaaliylxga-auth-token');
        if (supabaseToken) {
          try {
            const parsedToken = JSON.parse(supabaseToken);
            if (parsedToken?.access_token) {
              authHeader = {
                'Authorization': `Bearer ${parsedToken.access_token}`
              };
              console.log('Added authorization header with token for refresh');
            }
          } catch (e) {
            console.error('Failed to parse supabase token:', e);
          }
        }
      }
      
      const response = await fetch('/api/dashboard', {
        headers: { 
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache',
          ...authHeader
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to refresh dashboard data: ${response.status}`);
      }
      
      const data = await response.json();
      setDashboardData(data);
    } catch (err: any) {
      console.error('Error refreshing dashboard data:', err);
      setError(err.message || 'Failed to refresh dashboard data');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };
  
  // Show main loading state
  if (loading) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-t-2 border-teal-500 rounded-full"></div>
      </div>
    );
  }
  
  // Not authenticated - redirect handled by useEffect
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <h2 className="text-xl font-medium text-white">Redirecting to Sign In</h2>
          <p className="text-white/70 mt-2">You need to be signed in to view your dashboard</p>
        </div>
      </div>
    );
  }
  
  // Show dashboard loading state
  if (isLoading && !dashboardData) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="animate-spin mb-4 h-12 w-12 border-4 border-t-teal-500 border-teal-200 rounded-full mx-auto"></div>
          <h2 className="text-xl font-medium text-white">Loading Your Dashboard</h2>
          <p className="text-white/70 mt-2">Please wait while we prepare your learning statistics</p>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (error && !dashboardData) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center max-w-md">
          <div className="bg-red-500/20 p-4 rounded-lg mb-4">
            <p className="text-red-200">{error}</p>
          </div>
          <h2 className="text-xl font-medium text-white mb-4">Failed to Load Dashboard</h2>
          <button
            onClick={handleRefresh}
            className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  // Show dashboard with data
  return (
    <div className="min-h-screen dashboard-bg flex flex-col text-white">
      <Head>
        <title>Dashboard | Zenjin Maths</title>
        <meta name="description" content="Track your learning progress with the Zenjin Maths dashboard" />
      </Head>
      
      {/* Simple header with title and authentication status */}
      <header className="py-4 px-6 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          {isAuthenticated && (
            <div className="ml-4 px-3 py-1 bg-green-500/20 rounded-full text-green-300 text-xs font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
        
        <div>
          <UserWelcomeButton user={user} isAuthenticated={isAuthenticated} />
        </div>
      </header>
      
      {/* Main content */}
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <div className="mb-6 border-b border-white/20">
          <nav className="flex space-x-6">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-1 -mb-px ${activeTab === 'overview' ? 'border-b-2 border-teal-400 text-teal-300 font-medium' : 'text-white/70 hover:text-white'}`}
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab('account')}
              className={`py-3 px-1 -mb-px ${activeTab === 'account' ? 'border-b-2 border-teal-400 text-teal-300 font-medium' : 'text-white/70 hover:text-white'}`}
            >
              My Account
            </button>
          </nav>
        </div>
        
        {/* Overlaid loading indicator for refresh */}
        {isLoading && dashboardData && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg p-6 rounded-xl shadow-xl">
              <div className="animate-spin h-10 w-10 border-4 border-t-teal-500 border-teal-200 rounded-full mx-auto"></div>
              <p className="text-white mt-4">Refreshing dashboard data...</p>
            </div>
          </div>
        )}
        
        {/* Error notification */}
        {error && dashboardData && (
          <div className="bg-red-500/20 border border-red-300/30 text-red-100 p-4 rounded-lg mb-6">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-200 hover:text-red-100"
            >
              Dismiss
            </button>
          </div>
        )}
        
        {/* Overview Tab Content */}
        {activeTab === 'overview' && dashboardData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Evolution Level */}
              <EvolutionBadge evolution={dashboardData.evolution} />
              
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Blink Speed */}
                <BlinkSpeedDisplay 
                  blinkSpeed={dashboardData.blinkSpeed} 
                  trend={dashboardData.blinkSpeedTrend} 
                />
                
                {/* Total Points */}
                <div className="rounded-xl border border-white/20 bg-white/10 p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Total Points</h3>
                  <div className="text-3xl font-bold text-white">
                    {dashboardData.totalPoints ? dashboardData.totalPoints.toLocaleString() : '0'}
                  </div>
                  <div className="text-xs text-white/70 mt-1">Lifetime achievement</div>
                </div>
              </div>
              
              {/* Continue Learning Button */}
              <div className="mt-6">
                <button 
                  onClick={() => {
                    // Clear all local state to ensure we get a fresh state from server
                    try {
                      if (typeof window !== 'undefined') {
                        // Clear all triple-helix related data
                        Object.keys(localStorage).forEach(key => {
                          if (key.startsWith('triple_helix_state_') || 
                              key === 'zenjin_anonymous_state' || 
                              key === 'anonymous_initial_stitch') {
                            console.log('Clearing cached state:', key);
                            localStorage.removeItem(key);
                          }
                        });
                        
                        console.log('All local state cleared - will load fresh from server');
                      }
                    } catch (e) {
                      console.warn('Error clearing local cache:', e);
                    }
                    
                    // Add a unique timestamp to force a clean reload
                    const timestamp = Date.now();
                    window.location.href = `/minimal-player?t=${timestamp}`;
                  }}
                  className="block w-full bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-bold py-4 px-6 rounded-xl transition-colors text-lg text-center shadow-lg"
                >
                  Continue Learning
                </button>
              </div>
            </div>
            
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Global Standing */}
              <GlobalStanding 
                percentile={dashboardData.globalStanding?.percentile} 
                date={dashboardData.globalStanding?.date} 
                message={dashboardData.globalStanding?.message} 
              />
              
              {/* Recent Sessions */}
              <RecentSessions sessions={dashboardData.recentSessions || []} />
            </div>
          </div>
        )}
        
        {/* Account Tab Content */}
        {activeTab === 'account' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* User Info */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Account Information</h2>
              
              {/* Email and subscription status */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-white/70 text-sm mb-1">Email</p>
                  <p className="text-white font-medium">
                    {user?.email || "Email not available"}
                  </p>
                </div>
                
                {/* Subscription status indicator */}
                <div>
                  <p className="text-white/70 text-sm mb-1 text-right">Subscription</p>
                  <SubscriptionStatusIndicator variant="badge" />
                </div>
              </div>
              
              <div className="mt-3 p-2 bg-green-900/30 rounded-lg">
                <p className="text-white/90 text-sm">
                  <span className="font-bold text-green-400">✓ Authenticated</span> - Your progress and points are being saved.
                </p>
              </div>
              
              {/* Email Change Form */}
              <div className="mt-4">
                <h3 className="text-lg font-semibold text-white mb-3">Change Email Address</h3>
                
                {/* Status messages for email update */}
                {emailMessage.text && (
                  <div className={`p-3 rounded-md mb-4 text-sm ${
                    emailMessage.type === 'error' 
                      ? 'bg-red-500/20 text-red-200' 
                      : 'bg-green-500/20 text-green-200'
                  }`}>
                    {emailMessage.text}
                  </div>
                )}
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  
                  if (!newEmail || !newEmail.includes('@')) {
                    setEmailMessage({ text: 'Please enter a valid email address', type: 'error' });
                    return;
                  }
                  
                  // Only check for password if the user has one set
                  if (hasPassword && !emailPassword) {
                    setEmailMessage({ text: 'Please enter your current password', type: 'error' });
                    return;
                  }
                  
                  setEmailMessage({ text: 'Updating email address...', type: 'success' });
                  
                  try {
                    // Use direct Supabase client to update email
                    const { createClient } = await import('@supabase/supabase-js');
                    
                    // Create a Supabase client with the stored credentials
                    const supabase = createClient(
                      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylxga.supabase.co',
                      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5MTczNDAsImV4cCI6MjA1NzQ5MzM0MH0.gXtiM5b3YZoV5SMRrMmY59Qp7VjadOxkJ5an0Q3Og_c'
                    );
                    
                    // If user has a password and provided it, verify first
                    if (hasPassword && emailPassword) {
                      const { data: userData } = await supabase.auth.getUser();
                      
                      if (!userData?.user?.email) {
                        throw new Error('Unable to retrieve current user email');
                      }
                      
                      // Verify the current password
                      const { error: signInError } = await supabase.auth.signInWithPassword({
                        email: userData.user.email,
                        password: emailPassword
                      });
                      
                      if (signInError) {
                        setEmailMessage({ text: 'Current password is incorrect', type: 'error' });
                        return;
                      }
                    }
                    
                    // Update the email
                    const { error: updateError } = await supabase.auth.updateUser({
                      email: newEmail
                    });
                    
                    if (updateError) {
                      throw updateError;
                    }
                    
                    setEmailMessage({ text: 'Email update initiated! Please check your new email for verification.', type: 'success' });
                    setNewEmail('');
                    setEmailPassword('');
                  } catch (err) {
                    console.error('Exception updating email:', err);
                    setEmailMessage({ 
                      text: err.message || 'An unexpected error occurred', 
                      type: 'error' 
                    });
                  }
                }}>
                  <div className="mb-3">
                    <label className="block text-white text-sm mb-1" htmlFor="new-email">
                      New Email Address
                    </label>
                    <input
                      id="new-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full p-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Enter new email address"
                      required
                    />
                  </div>
                  
                  {/* Only show password field if user has set a password */}
                  {hasPassword && (
                    <div className="mb-4">
                      <label className="block text-white text-sm mb-1" htmlFor="email-password">
                        Current Password (for verification)
                      </label>
                      <input
                        id="email-password"
                        type="password"
                        value={emailPassword}
                        onChange={(e) => setEmailPassword(e.target.value)}
                        className="w-full p-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Enter your current password"
                        required
                      />
                    </div>
                  )}
                  
                  {/* Show a message if user doesn't have a password set */}
                  {!hasPassword && (
                    <div className="mb-4 text-sm text-white/70 bg-teal-500/10 p-3 rounded-md">
                      <p>You signed up with a verification code. No password verification is needed to change your email.</p>
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-xl transition-colors"
                  >
                    Update Email Address
                  </button>
                </form>
              </div>
              
              {/* Subscription information */}
              <div className="p-3 bg-white/10 rounded-xl mt-4">
                {isSubscribed ? (
                  <p className="text-white/80 text-sm">
                    <span className="font-medium text-teal-400">Premium Subscription:</span> You have full access to all Zenjin Maths content and features.
                  </p>
                ) : (
                  <div className="flex flex-col space-y-2">
                    <p className="text-white/80 text-sm">
                      <span className="font-medium text-amber-400">Free Plan:</span> Limited to the first 10 stitches per tube.
                    </p>
                    <Link href="/subscription" className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-1.5 px-3 rounded text-sm text-center transition-colors">
                      Upgrade to Premium
                    </Link>
                  </div>
                )}
              </div>
            </div>
            
            {/* Account Settings */}
            <div className="space-y-6">
              {/* Display Name */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Profile Settings</h2>
                <div>
                  <label className="block text-white text-sm mb-1" htmlFor="display-name">
                    Display Name
                  </label>
                  <input
                    id="display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full p-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button 
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/update-profile', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({
                            displayName
                          })
                        });
                        
                        if (response.ok) {
                          setError('Display name updated successfully');
                          setTimeout(() => setError(null), 3000);
                        } else {
                          setError('Failed to update display name');
                        }
                      } catch (error) {
                        console.error('Error updating display name:', error);
                        setError('An error occurred while updating display name');
                      }
                    }}
                    className="w-full mt-2 bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded transition-colors"
                  >
                    Save Name
                  </button>
                </div>
              </div>
              
              {/* Password Update Form */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-3">
                  {hasPassword ? 'Update Password' : 'Create Password'}
                </h2>
                <p className="text-white/70 mb-4 text-sm">
                  {hasPassword 
                    ? 'Change your existing password below.' 
                    : 'Creating a password allows you to sign in directly without verification codes.'}
                </p>
                
                {!hasPassword && (
                  <div className="p-3 rounded-md mb-4 text-sm bg-blue-500/20 text-blue-200">
                    <p className="flex items-center">
                      <span className="mr-2">ℹ️</span>
                      You're currently using one-time verification codes to sign in. Setting a password will allow you to sign in directly with your email and password instead.
                    </p>
                  </div>
                )}
                
                {/* Status messages */}
                {passwordMessage.text && (
                  <div className={`p-3 rounded-md mb-4 text-sm ${
                    passwordMessage.type === 'error' 
                      ? 'bg-red-500/20 text-red-200' 
                      : 'bg-green-500/20 text-green-200'
                  }`}>
                    {passwordMessage.text}
                  </div>
                )}
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  
                  // Check if passwords match
                  if (password !== confirmPassword) {
                    setPasswordMessage({ text: 'Passwords do not match', type: 'error' });
                    return;
                  }
                  
                  // Check password strength
                  if (password.length < 8) {
                    setPasswordMessage({ text: 'Password must be at least 8 characters long', type: 'error' });
                    return;
                  }
                  
                  setPasswordMessage({ text: 'Updating password...', type: 'success' });
                  
                  try {
                    // Use the direct Supabase client method instead of the API
                    // This ensures we have the proper authenticated session
                    const result = await updateUserPassword(
                      password, 
                      hasPassword ? password : null // If updating, send current password for verification
                    );
                    
                    if (result.success) {
                      setPasswordMessage({ text: 'Password updated successfully!', type: 'success' });
                      setPassword('');
                      setConfirmPassword('');
                      // Update hasPassword state if this was a password creation
                      if (!hasPassword) {
                        setHasPassword(true);
                      }
                    } else {
                      console.error('Password update failed:', result.error);
                      setPasswordMessage({ text: result.error || 'Failed to update password', type: 'error' });
                      
                      // If we get an Unauthorized error, offer a refresh solution
                      if (result.error && result.error.includes('Unauthorized')) {
                        // Show special message for auth errors
                        setPasswordMessage({ 
                          text: 'Your session appears to have expired. Please refresh the page and try again.', 
                          type: 'error' 
                        });
                      }
                    }
                  } catch (err) {
                    console.error('Exception updating password:', err);
                    setPasswordMessage({ text: 'An unexpected error occurred', type: 'error' });
                  }
                }}>
                  <div className="mb-3">
                    <label className="block text-white text-sm mb-1" htmlFor="password">
                      {hasPassword ? 'New Password' : 'Password'}
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder={hasPassword ? "Enter new password" : "Choose a secure password"}
                      required
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-white text-sm mb-1" htmlFor="confirm-password">
                      Confirm Password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full p-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Confirm password"
                      required
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-xl transition-colors"
                  >
                    {hasPassword ? 'Update Password' : 'Create Password'}
                  </button>
                </form>
              </div>
              
              {/* Subscription Actions */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">
                  {isSubscribed ? 'Manage Subscription' : 'Subscription Options'}
                </h2>
                
                {isSubscribed ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-900/30 rounded-lg">
                      <p className="text-blue-100 font-medium">
                        You have an active premium subscription with access to all content.
                      </p>
                    </div>
                    <Link 
                      href="/subscription" 
                      className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded text-center transition-colors"
                    >
                      Manage Subscription
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-amber-900/30 rounded-lg">
                      <p className="text-amber-100">
                        Upgrade to premium to unlock all stitches and content.
                      </p>
                    </div>
                    <Link 
                      href="/subscription" 
                      className="block w-full bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white font-medium py-2 px-4 rounded text-center transition-colors"
                    >
                      View Subscription Plans
                    </Link>
                  </div>
                )}
              </div>
                
              {/* Sign Out Button */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Account Actions</h2>
                <button
                  onClick={handleSignOut}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-medium py-3 px-6 rounded-xl transition-colors text-center"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}