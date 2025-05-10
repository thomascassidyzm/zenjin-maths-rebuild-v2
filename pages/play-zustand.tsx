import React, { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { useZustandTripleHelixPlayer } from '../lib/hooks/useZustandTripleHelixPlayer';
import MinimalDistinctionPlayerWithUpgrade from '../components/MinimalDistinctionPlayerWithUpgrade';
import BackgroundBubbles from '../components/BackgroundBubbles';
import StitchCelebration from '../components/StitchCelebration';
import SubscriptionStatusIndicator from '../components/subscription/SubscriptionStatusIndicator';
import DevTestPane from '../components/DevTestPane';
import useZenjinStore from '../lib/store/zenjinStore';

/**
 * Play Page with Zustand State Management
 * 
 * Main learning experience page using the new Zustand-based state management.
 * Provides reliable state persistence and synchronization.
 */
export default function PlayZustand() {
  const { isAuthenticated, loading, user, signOut } = useAuth();
  const router = useRouter();

  // Initialize Zustand store with user if available
  useEffect(() => {
    if (user) {
      useZenjinStore.getState().setUserInformation({
        userId: user.id,
        isAnonymous: !isAuthenticated,
        displayName: user?.user_metadata?.display_name || user.email?.split('@')[0],
        email: user.email,
        createdAt: user.created_at || new Date().toISOString(),
        lastActive: new Date().toISOString()
      });
    }
  }, [user, isAuthenticated]);

  // Check if we should continue from previous state
  const continuePreviousState = router.query.continue === 'true';
  
  // Check if dev mode is enabled
  const showDevTools = router.query.dev === 'true';

  // Use the Zustand-based player hook
  const player = useZustandTripleHelixPlayer({
    debug: console.log,
    continuePreviousState // Pass the parameter to the hook
  });


  // Check authentication
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/signin?redirect=/');
    }
  }, [isAuthenticated, loading, router]);

  if (loading || player.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center player-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400"></div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen player-bg relative">
      <Head>
        <title>Zenjin Maths</title>
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
            console.log('Current stitch in player: ${player.currentStitch.id}');
          `
        }} />
      )}
      
      {/* Welcome message with user name */}
      <div className="absolute top-4 left-4 z-20">
        <div className="text-white text-lg font-medium">
          Hi, {user?.email ? (user?.user_metadata?.display_name || user.email.split('@')[0]) : 'there'}!
        </div>
      </div>
      
      {/* Header with dashboard & sign out buttons */}
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-3">
        {/* Subscription status indicator */}
        <div className="mr-1">
          <SubscriptionStatusIndicator variant="badge" />
        </div>
        
        {/* Dashboard button */}
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-md transition-colors"
          title="Back to dashboard"
        >
          Dashboard
        </button>
        
        {/* Sign out button */}
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
      </div>
      
      {/* Points display from Zustand store */}
      <div className="absolute top-16 right-4 z-20">
        <div className="text-white text-lg font-medium">
          Points: {useZenjinStore(state => state.learningProgress?.points?.session || 0)}
        </div>
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
            
            {/* Player component */}
            <MinimalDistinctionPlayerWithUpgrade
              thread={{
                id: player.currentStitch.threadId,
                name: player.currentStitch.threadId,
                description: `Thread ${player.currentStitch.threadId}`,
                stitches: [player.currentStitch],
                originalStitchCount: player.currentStitch.totalStitchesInThread || undefined
              }}
              onComplete={(results) => {
                console.log('onComplete called with results', { points: results.totalPoints });
                
                // Update Zustand store with the new points
                useZenjinStore.getState().incrementPoints(results.totalPoints || 0);
                
                // Complete stitch in player
                if (player.currentStitch) {
                  player.completeStitch(
                    player.currentStitch.threadId,
                    player.currentStitch.id,
                    results.correctAnswers || 0,
                    results.totalQuestions || 20
                  );
                }
              }}
              onEndSession={(results) => {
                console.log('onEndSession called with results', { 
                  points: results.totalPoints, 
                  goDashboard: results.goDashboard || false
                });
                
                // Update Zustand store with the final points
                useZenjinStore.getState().incrementPoints(results.totalPoints || 0);
                
                if (results.goDashboard) {
                  console.log('Forcing navigation to dashboard as requested');
                  player.handleSessionComplete(results, true);
                
                  setTimeout(() => {
                    console.log('Fallback navigation to dashboard using Next.js router');
                    router.push('/dashboard');
                  }, 2000);
                } else {
                  player.handleSessionComplete(results, true);
                }
              }}
              questionsPerSession={20}
              sessionTotalPoints={player.accumulatedSessionData.totalPoints}
              userId={user?.id}
            />
          </div>
        )}
      </div>
      
      {/* DevTest Pane - only shown when dev=true query param is provided */}
      {showDevTools && <DevTestPane player={player} />}
    </div>
  );
}