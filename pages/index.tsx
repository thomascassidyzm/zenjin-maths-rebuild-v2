import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import UserWelcomeButton from '../components/UserWelcomeButton';
import VersionBadge from '../components/VersionBadge';

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
    userDataLoading,
    signInAnonymously // Add this to extract the signInAnonymously function
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
  
  // For authenticated users, automatically redirect to the player
  useEffect(() => {
    if (isAuthenticated && userData && !loading) {
      // Automatically redirect to minimal-player
      console.log('User is authenticated, redirecting to player page');
      router.push('/minimal-player');
    }
  }, [isAuthenticated, userData, loading, router]);

  // If authenticated but still loading user data, show loading state
  if (isAuthenticated && userData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center dashboard-bg">
        <Head>
          <title>Zenjin Maths | Loading</title>
          <meta name="description" content="Loading your Zenjin Maths learning journey" />
        </Head>
        
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center max-w-lg">
          <div className="animate-spin mb-6 h-12 w-12 border-4 border-t-teal-500 border-teal-200 rounded-full mx-auto"></div>
          <h1 className="text-2xl font-bold text-white mb-4">Preparing Your Content</h1>
          <p className="text-white/80">Loading your personalized learning experience...</p>
          {userData.progressData?.totalPoints > 0 && (
            <p className="text-white/70 mt-4">You've earned {userData.progressData.totalPoints} points so far!</p>
          )}
        </div>
      </div>
    );
  }
  
  // Skip the choice and automatically create an anonymous account and redirect to the player
  useEffect(() => {
    const autoStartAnonymously = async () => {
      // Set the flag for anonymous state creation
      if (typeof window !== 'undefined') {
        localStorage.setItem('zenjin_create_anonymous_state', 'true');
        console.log('Setting flag to create anonymous state on player load');
      }
      
      console.log('DEBUGGING: Auto-starting with anonymous account');
      try {
        // Create anonymous account using the context method
        const result = await signInAnonymously();
        if (result.success) {
          console.log('DEBUGGING: Created anonymous account on server with TTL:', result);
        } else {
          console.error('DEBUGGING: Failed to create anonymous account:', result.error);
        }
      } catch (error) {
        console.error('Error creating anonymous account:', error);
      }
      
      // Always redirect to the player, even if account creation fails
      router.push('/minimal-player');
    };
    
    // If not authenticated, start the anonymous flow automatically
    if (!isAuthenticated && !loading) {
      autoStartAnonymously();
    }
  }, [isAuthenticated, loading, signInAnonymously, router]);
  
  // Show a simple loading state while automatic redirection is happening
  return (
    <div className="min-h-screen flex flex-col items-center justify-center dashboard-bg">
      <Head>
        <title>Zenjin Maths | Loading</title>
        <meta name="description" content="Starting your Zenjin Maths learning journey" />
      </Head>
      
      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center max-w-lg">
        <div className="animate-spin mb-6 h-12 w-12 border-4 border-t-teal-500 border-teal-200 rounded-full mx-auto"></div>
        <h1 className="text-2xl font-bold text-white mb-4">Starting Zenjin Maths</h1>
        <p className="text-white/80">Preparing your learning experience...</p>
      </div>
    </div>
  );
}