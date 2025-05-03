import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import MinimalDistinctionPlayer from '../components/MinimalDistinctionPlayer';
import MinimalDistinctionPlayerWithUpgrade from '../components/MinimalDistinctionPlayerWithUpgrade';
import BackgroundBubbles from '../components/BackgroundBubbles';
import StitchCelebration from '../components/StitchCelebration';
import SubscriptionStatusIndicator from '../components/subscription/SubscriptionStatusIndicator';
import DevTestPane from '../components/DevTestPane';
import { useAuth } from '../context/AuthContext';
import { useTripleHelixPlayer } from '../lib/playerUtils';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';
import UserWelcomeButton from '../components/UserWelcomeButton';

// Component for playful loading messages that cycle every 2 seconds
const LoadingMessage = ({ isAnonymous }: { isAnonymous: boolean }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  
  // Different message sets for anonymous vs. logged-in users
  const anonymousMessages = [
    "Warming up our number powers...",
    "Getting your maths playground ready...",
    "Counting down to blast off...",
    "Preparing your brain challenge...",
    "Loading the number fun..."
  ];
  
  const memberMessages = [
    "Firing up the engines...",
    "Tuning the math circuits...",
    "Calculating all the things...",
    "Organizing your learning journey...",
    "Preparing your personalized content..."
  ];
  
  // Select the appropriate message set
  const messages = isAnonymous ? anonymousMessages : memberMessages;
  
  // Cycle through messages every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [messages.length]);
  
  return <>{messages[messageIndex]}</>;
};

/**
 * Minimal Player - Triple-Helix with minimal UI
 * 
 * This is a streamlined version of the player that removes the admin controls
 * but keeps the player component exactly the same
 */
export default function MinimalPlayer() {
  const router = useRouter();
  const { mode, force, resetPoints, dev } = router.query;
  const { user, isAuthenticated, signOut } = useAuth();
  const { isSubscribed, tier } = useSubscriptionStatus();
  
  // Determine if we should force anonymous mode even if logged in
  const forceAnonymous = force === 'true' && mode === 'anonymous';
  
  // Check if we should reset points but maintain stitch progress
  const shouldResetPoints = resetPoints === 'true';
  
  // Check if dev mode is enabled
  const showDevTools = dev === 'true';
  
  // Use the shared player hook with the appropriate mode
  const player = useTripleHelixPlayer({ 
    mode: forceAnonymous ? 'anonymous' : (mode as string || 'default'),
    resetPoints: shouldResetPoints, // Reset points but maintain stitch progress
    debug: console.log 
  });

  return (
    <div className="min-h-screen player-bg relative">
      <Head>
        <title>{player.isAnonymous ? 'Free Maths Practice' : 'Zenjin Maths'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      {/* Background bubbles at the page level for continuous animation */}
      <BackgroundBubbles />
      
      {/* Track current stitch ID in a global variable to help the StitchCelebration component */}
      {player.currentStitch && (
        <script dangerouslySetInnerHTML={{
          __html: `
            window.__PLAYER_STATE__ = window.__PLAYER_STATE__ || {};
            window.__PLAYER_STATE__.currentStitch = {
              id: "${player.currentStitch.id}",
              threadId: "${player.currentStitch.threadId}",
              timestamp: ${Date.now()}
            };
            // Track celebrations at window level to ensure consistency
            window.__PLAYER_CELEBRATIONS__ = window.__PLAYER_CELEBRATIONS__ || {};
            // Debug output in case we need it
            console.log('Current stitch in player: ${player.currentStitch.id}');
          `
        }} />
      )}
      
      {/* Welcome message with user name */}
      <div className="absolute top-4 left-4 z-20">
        <UserWelcomeButton user={user} isAuthenticated={isAuthenticated} />
      </div>
      
      {/* Remove login prompt for anonymous users */}
      
      {/* Main content area */}
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen relative" style={{zIndex: 'auto'}}>
        {player.isLoading ? (
          <div className="bg-white/20 backdrop-blur-lg rounded-xl p-6 text-center shadow-xl">
            <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-300 border-t-transparent rounded-full mb-2"></div>
            <p className="text-white text-lg">
              {/* Fun loading messages that cycle every 2 seconds */}
              <LoadingMessage isAnonymous={player.isAnonymous} />
            </p>
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
          /* Render the player with celebration pill properly positioned relative to it */
          <div className="relative">
            {/* Position the celebration inside the player container */}
            {player.showCelebration && (
              <StitchCelebration 
                isVisible={player.showCelebration}
                onComplete={() => {
                  console.log('🎬 MinimalPlayer: StitchCelebration complete - setting showCelebration to false');
                  player.setShowCelebration(false);
                }}
              />
            )}
            
            {/* Use the subscription-aware player component */}
            <MinimalDistinctionPlayerWithUpgrade
              thread={{
                id: player.currentStitch.threadId,
                name: player.currentStitch.threadId,
                description: `Thread ${player.currentStitch.threadId}`,
                stitches: [player.currentStitch],
                // Add original stitch count to help the upgrade component determine limits
                originalStitchCount: player.currentStitch.totalStitchesInThread || undefined
              }}
              onComplete={(results) => {
                console.log('🎯 MinimalPlayer: onComplete called with results', { points: results.totalPoints });
                // Just handle stitch progression normally - continue in the player
                player.handleSessionComplete(results);
              }}
              onEndSession={(results) => {
                console.log('🚪 MinimalPlayer: onEndSession called with results', { 
                  points: results.totalPoints, 
                  goDashboard: results.goDashboard || false
                });
                
                // Force navigation to dashboard when the user clicks "Continue to Dashboard"
                if (results.goDashboard) {
                  console.log('🚪 Forcing navigation to dashboard as requested by Continue to Dashboard button');
                  // First record the session
                  player.handleSessionComplete(results, true);
                
                  // Determine which dashboard to navigate to based on authentication state and forced mode
                  const isAnonymous = forceAnonymous || player.isAnonymous || (!user && mode === 'anonymous');
                  const dashboardUrl = isAnonymous ? '/anon-dashboard' : '/dashboard';
                  
                  console.log(`🚪 Preparing navigation to ${dashboardUrl} (user is ${isAnonymous ? 'anonymous' : 'authenticated'})`);
                  
                  // Fallback navigation - after a delay, if we're still here, force navigation to appropriate dashboard
                  setTimeout(() => {
                    console.log(`🚪 Fallback navigation to ${dashboardUrl} (delayed)`);
                    window.location.href = dashboardUrl;
                  }, 2000);
                } else {
                  // Normal end session flow:
                  // 1. Session data is saved (either to localStorage or server)
                  // 2. Tube configuration is persisted (for continuation later)
                  // 3. Navigation to dashboard happens automatically in handleSessionComplete
                  player.handleSessionComplete(results, true);
                }
              }}
              questionsPerSession={20}
              sessionTotalPoints={player.accumulatedSessionData.totalPoints}
              userId={user?.id} // Pass the user ID for authentication
            />
          </div>
        )}
      </div>
      
      {/* DevTest Pane - only shown when dev=true query param is provided */}
      {showDevTools && <DevTestPane player={player} />}
    </div>
  );
}