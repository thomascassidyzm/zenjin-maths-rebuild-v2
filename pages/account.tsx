import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/auth/supabaseClient';
import ResetProgressButton from '../components/ResetProgressButton';
import SubscriptionManager from '../components/subscription/SubscriptionManager';
import SubscriptionStatusIndicator from '../components/subscription/SubscriptionStatusIndicator';
import { getSubscriptionStatus } from '../lib/client/payments';

export default function Account() {
  const { isAuthenticated, user, userEmail } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [nameMessage, setNameMessage] = useState({ text: '', type: '' });
  const [emailMessage, setEmailMessage] = useState({ text: '', type: '' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  
  // User stats
  const [userStats, setUserStats] = useState({
    totalPoints: 0,
    stitchesCompleted: 0,
    sessionsCompleted: 0,
    memberSince: ''
  });
  
  // Subscription state
  const [subscription, setSubscription] = useState<any>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  
  // Load user stats when component mounts
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadUserStats();
      loadUserProfile();
      loadSubscriptionStatus();
    }
  }, [isAuthenticated, user]);
  
  // Load subscription status
  const loadSubscriptionStatus = async () => {
    if (!user?.id) return;
    
    try {
      setSubscriptionLoading(true);
      const status = await getSubscriptionStatus();
      setSubscription(status);
    } catch (error) {
      console.error('Error loading subscription status:', error);
    } finally {
      setSubscriptionLoading(false);
    }
  };
  
  // Load user profile info (like display name and password status)
  const loadUserProfile = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, has_password')
        .eq('id', user.id)
        .single();
        
      if (error) {
        console.error('Error loading user profile:', error);
      } else if (data) {
        setDisplayName(data.display_name || '');
        setHasPassword(!!data.has_password); // Convert to boolean
      }
    } catch (error) {
      console.error('Exception loading user profile:', error);
    }
  };
  
  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);
  
  // Show loading state initially
  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      // Small delay for animations to look smoother
      const timer = setTimeout(() => {
        setLoading(false);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);
  
  // Load user statistics from the database
  const loadUserStats = async () => {
    try {
      setLoading(true);
      
      // Get user creation date
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.created_at) {
        const createdAt = new Date(userData.user.created_at);
        const formattedDate = createdAt.toLocaleDateString(undefined, { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        setUserStats(prev => ({ ...prev, memberSince: formattedDate }));
      }
      
      if (user?.id) {
        // Get total points
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('user_sessions')
          .select('points')
          .eq('user_id', user.id);
          
        if (sessionsError) {
          console.error('Error fetching points:', sessionsError);
        } else if (sessionsData) {
          const totalPoints = sessionsData.reduce((sum, session) => sum + (session.points || 0), 0);
          setUserStats(prev => ({ ...prev, totalPoints }));
        }
        
        // Count completed stitches
        const { count: stitchCount, error: stitchError } = await supabase
          .from('user_stitch_progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('completed', true);
          
        if (stitchError) {
          console.error('Error counting stitches:', stitchError);
        } else if (stitchCount !== null) {
          setUserStats(prev => ({ ...prev, stitchesCompleted: stitchCount }));
        }
        
        // Count sessions
        const { count: sessionCount, error: sessionCountError } = await supabase
          .from('user_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
          
        if (sessionCountError) {
          console.error('Error counting sessions:', sessionCountError);
        } else if (sessionCount !== null) {
          setUserStats(prev => ({ ...prev, sessionsCompleted: sessionCount }));
        }
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle password update
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if passwords match
    if (password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match', type: 'error' });
      return;
    }
    
    // Check password strength
    if (password.length < 8) {
      setMessage({ text: 'Password must be at least 8 characters long', type: 'error' });
      return;
    }
    
    setLoading(true);
    setMessage({ text: 'Updating password...', type: 'success' });
    
    try {
      console.log('Attempting to update password via API');
      
      // Try both approaches: Direct Supabase client and API endpoint
      
      // Method 1: Use the API endpoint (more reliable)
      const response = await fetch('/api/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          password: password
        }),
        credentials: 'include' // Important for passing cookies
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('Password updated successfully via API');
        setMessage({ text: 'Password updated successfully!', type: 'success' });
        setPassword('');
        setConfirmPassword('');
        return;
      } else {
        console.error('Failed to update password via API:', data.error);
        // Fall back to direct method if API approach fails
      }
      
      // Method 2: Try direct client as fallback
      console.log('Trying direct Supabase client as fallback');
      const { error } = await supabase.auth.updateUser({
        password: password,
      });
      
      if (error) {
        console.error('Error updating password with direct client:', error);
        setMessage({ text: error.message || 'Failed to update password', type: 'error' });
      } else {
        console.log('Password updated successfully via direct client');
        setMessage({ text: 'Password updated successfully!', type: 'success' });
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      console.error('Exception updating password:', err);
      setMessage({ text: 'An unexpected error occurred', type: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle email update
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      setEmailMessage({ text: 'You must be signed in to update your email', type: 'error' });
      return;
    }
    
    if (!newEmail || !newEmail.includes('@')) {
      setEmailMessage({ text: 'Please enter a valid email address', type: 'error' });
      return;
    }
    
    // Only check for password if the user has one set
    if (hasPassword && !emailPassword) {
      setEmailMessage({ text: 'Please enter your current password', type: 'error' });
      return;
    }
    
    setLoading(true);
    setEmailMessage({ text: 'Updating email address...', type: 'success' });
    
    try {
      console.log(`Attempting to update email to "${newEmail}" for user ${user.id}`);
      
      const response = await fetch('/api/auth/update-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: newEmail,
          password: hasPassword ? emailPassword : undefined // Only send password if user has one
        }),
        credentials: 'include' // Important for passing cookies with auth
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Error updating email:', data.error);
        setEmailMessage({ text: data.error || 'Failed to update email address', type: 'error' });
      } else {
        setEmailMessage({ text: 'Email update initiated! Please check your new email for verification.', type: 'success' });
        setNewEmail('');
        setEmailPassword('');
      }
    } catch (err) {
      console.error('Exception updating email:', err);
      setEmailMessage({ text: 'An unexpected error occurred', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Handle display name update
  const handleUpdateDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      setNameMessage({ text: 'You must be signed in to update your profile', type: 'error' });
      return;
    }
    
    setLoading(true);
    setNameMessage({ text: 'Updating display name...', type: 'success' });
    
    try {
      console.log(`Updating display name to "${displayName}" for user ${user.id}`);
      
      // Make the API request with credentials for cookies
      const response = await fetch('/api/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          displayName,
          userId: user.id // Send user ID explicitly to help with auth issues
        }),
        credentials: 'include' // Important for passing cookies with auth
      });
      
      // Log raw response for debugging
      console.log('Profile update response status:', response.status);
      
      const data = await response.json();
      console.log('Profile update response data:', data);
      
      if (!response.ok) {
        console.error('Error updating display name:', data.error);
        setNameMessage({ text: data.error || 'Failed to update display name', type: 'error' });
      } else {
        setNameMessage({ text: 'Display name updated successfully!', type: 'success' });
        
        // Refetch profile data after update
        loadUserProfile();
      }
    } catch (err) {
      console.error('Exception updating display name:', err);
      setNameMessage({ text: 'An unexpected error occurred', type: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleSignOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Return loading state until authentication check is complete
  if (!isAuthenticated || loading) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen player-bg flex flex-col items-center justify-center text-white relative">
      <Head>
        <title>My Account | Zenjin Maths</title>
        <meta name="description" content="Manage your account settings and view progress" />
      </Head>
      
      {/* Bubbles animation - matching the homepage style */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {Array.from({ length: 30 }, (_, i) => ({
          id: i,
          size: Math.floor(Math.random() * 100) + 20,
          left: `${Math.random() * 100}%`,
          delay: Math.random() * 15,
          duration: (Math.random() * 20 + 15),
        })).map((bubble) => (
          <div
            key={bubble.id}
            style={{
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              position: 'absolute',
              left: bubble.left,
              bottom: '-100px',
              animationDelay: `${bubble.delay}s`,
              animationDuration: `${bubble.duration}s`,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              animation: 'float linear infinite',
            }}
          />
        ))}
      </div>
      
      <div className="container max-w-4xl mx-auto px-4 py-8 z-10">
        {/* Header with back navigation */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">My Account</h1>
          <button 
            onClick={() => router.push('/')}
            className="text-white hover:text-teal-300 transition-colors"
          >
            Back to Home
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Stats */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-4">
            <h2 className="text-xl font-semibold text-white mb-4">Your Progress</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 p-4 rounded-xl animate-scaleIn delay-1">
                <p className="text-white/70 text-sm">Total Points</p>
                <p className="text-3xl font-bold text-teal-400">{userStats.totalPoints}</p>
              </div>
              
              <div className="bg-white/10 p-4 rounded-xl animate-scaleIn delay-2">
                <p className="text-white/70 text-sm">Stitches Completed</p>
                <p className="text-3xl font-bold text-blue-400">{userStats.stitchesCompleted}</p>
              </div>
              
              <div className="bg-white/10 p-4 rounded-xl animate-scaleIn delay-3">
                <p className="text-white/70 text-sm">Sessions</p>
                <p className="text-3xl font-bold text-purple-400">{userStats.sessionsCompleted}</p>
              </div>
              
              <div className="bg-white/10 p-4 rounded-xl animate-scaleIn delay-4">
                <p className="text-white/70 text-sm">Member Since</p>
                <p className="text-lg font-medium text-white">{userStats.memberSince || 'Recently'}</p>
              </div>
            </div>
            
            <div className="mt-6">
              <Link 
                href="/"
                className="block bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-6 rounded-xl transition-colors text-center shadow-lg"
              >
                Continue Learning
              </Link>
            </div>
          </div>
          
          {/* Account Settings */}
          <div className="space-y-6">
            {/* User Info */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Account Information</h2>
              <div className="mb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white/70 text-sm mb-1">Email</p>
                    <p className="text-white font-medium">{userEmail}</p>
                  </div>
                  
                  {/* Subscription Status Indicator */}
                  <div>
                    <SubscriptionStatusIndicator variant="badge" />
                  </div>
                </div>
                
                <p className="text-white/70 text-sm mt-3 mb-1">
                  ✓ Authenticated - Your progress and points are being saved.
                </p>
                <p className="text-white/60 text-xs mb-4">
                  Your account gives you full access to all Zenjin Maths content and saves your progress automatically.
                </p>
              </div>
              
              {/* Email Change Form */}
              <div className="mt-4 mb-4">
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
                
                <form onSubmit={handleUpdateEmail}>
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
                    disabled={loading}
                    className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-xl transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Updating...' : 'Update Email Address'}
                  </button>
                </form>
              </div>
              
              <h3 className="text-lg font-semibold text-white mt-6 mb-3">Account Settings</h3>
              
              {/* Status messages for display name update */}
              {nameMessage.text && (
                <div className={`p-3 rounded-md mb-4 text-sm ${
                  nameMessage.type === 'error' 
                    ? 'bg-red-500/20 text-red-200' 
                    : 'bg-green-500/20 text-green-200'
                }`}>
                  {nameMessage.text}
                </div>
              )}
              
              <form onSubmit={handleUpdateDisplayName} className="mb-4">
                <div className="mb-3">
                  <label className="block text-white text-sm mb-1" htmlFor="display-name">
                    Display Name
                  </label>
                  <div className="flex">
                    <input
                      id="display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="flex-grow p-2 rounded-l bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Enter your name"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-r transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                      Save Name
                    </button>
                  </div>
                </div>
              </form>
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
              {message.text && (
                <div className={`p-3 rounded-md mb-4 text-sm ${
                  message.type === 'error' 
                    ? 'bg-red-500/20 text-red-200' 
                    : 'bg-green-500/20 text-green-200'
                }`}>
                  {message.text}
                </div>
              )}
              
              <form onSubmit={handleSetPassword}>
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
                  disabled={loading}
                  className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-xl transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : hasPassword ? 'Update Password' : 'Create Password'}
                </button>
              </form>
            </div>
            
            {/* Subscription Management */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Subscription Management
              </h2>
              
              <div className="mb-4">
                <SubscriptionManager 
                  redirectToSuccess="/account"
                  redirectToCancel="/account"
                />
              </div>
            </div>
            
            {/* Account Actions */}
            <div className="flex gap-4">
              {/* Reset Progress Button */}
              <div className="w-1/2">
                <ResetProgressButton 
                  className="w-full py-3 px-6 rounded-xl text-center"
                  onComplete={() => loadUserStats()}
                />
              </div>
              
              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                className="w-1/2 bg-red-600 hover:bg-red-500 text-white font-medium py-3 px-6 rounded-xl transition-colors text-center"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}