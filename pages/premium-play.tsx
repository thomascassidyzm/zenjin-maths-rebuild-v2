import React, { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { useTripleHelixPlayer } from '../lib/playerUtils';
import PlayerWrapper from '../components/subscription/PlayerWrapper';
import BackgroundBubbles from '../components/BackgroundBubbles';
import StitchCelebration from '../components/StitchCelebration';
import SubscriptionStatusIndicator from '../components/subscription/SubscriptionStatusIndicator';
import SubscriptionBadge from '../components/subscription/SubscriptionBadge';

/**
 * Premium Play Page
 * 
 * Enhanced version of the Play page that integrates subscription features.
 * Uses the PlayerWrapper component to enforce free tier limitations and
 * provide a seamless upgrade experience.
 */
export default function PremiumPlay() {
  const { isAuthenticated, loading, user, signOut } = useAuth();
  const router = useRouter();

  // Use the shared player hook
  const player = useTripleHelixPlayer({ 
    debug: console.log 
  });

  // Check authentication - allows anonymous users
  useEffect(() => {
    if (!loading && !isAuthenticated && !localStorage.getItem('anonymousId')) {
      // Create anonymous ID for tracking purposes
      const anonymousId = `anon-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('anonymousId', anonymousId);
      console.log('Created anonymous ID:', anonymousId);
    }
  }, [isAuthenticated, loading]);

  if (loading || player.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center player-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400"></div>
      </div>
    );
  }

  // Get current user ID (either authenticated or anonymous)
  const currentUserId = isAuthenticated && user?.id 
    ? user.id 
    : (localStorage.getItem('anonymousId') || 'anonymous');

  return (
    <div className="min-h-screen player-bg relative">
      <Head>
        <title>Zenjin Maths | Premium Experience</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      {/* Background bubbles */}
      <BackgroundBubbles />
      
      {/* Track current stitch ID */}
      {player.currentStitch && (
        <script dangerouslySetInnerHTML={{
          __html: `
            window.__PLAYER_STATE__ = window.__PLAYER_STATE__ || {};
            window.__PLAYER_STATE__.currentStitch = {
              id: "${player.currentStitch.id}",
              threadId: "${player.currentStitch.threadId}",
              timestamp: ${Date.now()}
            };
            console.log('Current stitch in premium player: ${player.currentStitch.id}');
          `
        }} />
      )}
      
      {/* Welcome message with user name */}
      <div className="absolute top-4 left-4 z-20">
        <div className="text-white text-lg font-medium">
          {isAuthenticated && user?.email 
            ? `Hi, ${user?.user_metadata?.display_name || user.email.split('@')[0]}!`
            : 'Welcome to Zenjin Maths!'}
        </div>
      </div>
      
      {/* Header with dashboard & sign out buttons */}
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-3">
        {/* Subscription status indicator */}
        <div className="mr-1">
          {isAuthenticated ? (
            <SubscriptionStatusIndicator variant="badge" />
          ) : (
            <SubscriptionBadge tier="free" />
          )}
        </div>
        
        {/* Dashboard button */}
        <button
          onClick={() => router.push(isAuthenticated ? '/dashboard' : '/anon-dashboard')}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-md transition-colors"
          title="Back to dashboard"
        >
          Dashboard
        </button>
        
        {/* Sign out or sign in button */}
        {isAuthenticated ? (
          <button
            onClick={() => {
              signOut().then(() => {
                window.location.href = '/?clear_auth=true';
              });
            }}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-white rounded-md transition-colors"
            title="Sign out"
          >
            Sign Out
          </button>
        ) : (
          <button
            onClick={() => router.push('/signin?redirect=/premium-play')}
            className="px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-white rounded-md transition-colors"
            title="Sign in"
          >
            Sign In
          </button>
        )}
      </div>
      
      {/* Main content area */}
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen relative">
        {player.isLoading ? (
          <div className="bg-white/20 backdrop-blur-lg rounded-xl p-6 text-center shadow-xl">
            <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-300 border-t-transparent rounded-full mb-2"></div>
            <p className="text-white text-lg">Loading...</p>
          </div>
        ) : player.loadError ? (
          <div className="bg-white/20 backdrop-blur-lg rounded-xl p-8 text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-white">Error Loading Content</h2>
            <div className="bg-red-500/20 border border-red-300/30 text-red-100 rounded-lg p-4 mb-6">
              {player.loadError}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : !player.currentStitch ? (
          <div className="bg-white/20 backdrop-blur-lg rounded-xl p-8 text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-white">No Content Available</h2>
            <p className="mb-4 text-white">There is no active content.</p>
            <button
              onClick={() => router.push('/')}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Back to Home
            </button>
          </div>
        ) : (
          <div className="relative">
            {/* Celebration overlay */}
            {player.showCelebration && (
              <StitchCelebration 
                isVisible={player.showCelebration}
                onComplete={() => {
                  console.log('StitchCelebration complete - setting showCelebration to false');
                  player.setShowCelebration(false);
                }}
              />
            )}
            
            {/* Player wrapper with subscription awareness */}
            <PlayerWrapper
              thread={{
                id: player.currentStitch.threadId,
                name: player.currentStitch.threadId,
                description: `Thread ${player.currentStitch.threadId}`,
                stitches: [player.currentStitch],
                originalStitchCount: player.currentStitch.totalStitchesInThread || undefined
              }}
              onComplete={(results) => {
                console.log('onComplete called with results', { points: results.totalPoints });
                player.handleSessionComplete(results);
              }}
              onEndSession={(results) => {
                console.log('onEndSession called with results', { 
                  points: results.totalPoints, 
                  goDashboard: results.goDashboard || false
                });
                
                if (results.goDashboard) {
                  console.log('Forcing navigation to dashboard as requested');
                  player.handleSessionComplete(results, true);
                
                  setTimeout(() => {
                    console.log('Fallback navigation to dashboard');
                    if (isAuthenticated) {
                      window.location.href = '/dashboard';
                    } else {
                      window.location.href = '/anon-dashboard';
                    }
                  }, 2000);
                } else {
                  player.handleSessionComplete(results, true);
                }
              }}
              questionsPerSession={20}
              sessionTotalPoints={player.accumulatedSessionData.totalPoints}
              userId={currentUserId}
            />
          </div>
        )}
      </div>
    </div>
  );
}