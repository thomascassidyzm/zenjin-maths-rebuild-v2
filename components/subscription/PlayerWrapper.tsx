/**
 * Subscription-Aware Player Wrapper
 * 
 * This component wraps the MinimalDistinctionPlayer with subscription awareness,
 * enforcing free tier limitations and handling premium content access.
 * It integrates the useSubscriptionAwarePlayer hook with UI components
 * to provide a seamless experience for both free and premium users.
 */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import MinimalDistinctionPlayer from '../MinimalDistinctionPlayer';
import PremiumContentPaywall from './PremiumContentPaywall';
import ContentUpgradePrompt from './ContentUpgradePrompt';
import { Thread } from '../../lib/types/distinction-learning';
import { useSubscriptionAwarePlayer } from '../../hooks/useSubscriptionAwarePlayer';
import { AccessLevel } from '../../lib/freeTierAccess';
import { FREE_TIER_STITCH_LIMIT } from '../../lib/constants/free-tier';

interface PlayerWrapperProps {
  /**
   * The thread containing stitches to play
   */
  thread: Thread;
  
  /**
   * Function called when session is completed
   */
  onComplete: (results: any) => void;
  
  /**
   * Optional function called when session is manually ended
   */
  onEndSession?: (results: any) => void;
  
  /**
   * Number of questions per session
   */
  questionsPerSession?: number;
  
  /**
   * Total points from previous sessions
   */
  sessionTotalPoints?: number;
  
  /**
   * User ID for authenticated users
   */
  userId?: string;
}

const PlayerWrapper: React.FC<PlayerWrapperProps> = ({
  thread,
  onComplete,
  onEndSession,
  questionsPerSession = 10,
  sessionTotalPoints = 0,
  userId
}) => {
  const router = useRouter();
  
  // Use the subscription-aware player hook
  const player = useSubscriptionAwarePlayer({
    thread,
    userId
  });
  
  // Local state for UI components
  const [showPrompt, setShowPrompt] = useState(false);
  const [totalStitches, setTotalStitches] = useState(0);
  const [availableStitches, setAvailableStitches] = useState(0);
  
  // Effect to check free tier content limitations
  useEffect(() => {
    if (!thread || !thread.stitches) return;
    
    // Get the total stitch count (original count if available)
    const originalCount = thread.originalStitchCount || thread.stitches.length;
    setTotalStitches(originalCount);
    
    // Determine if the user is approaching content limits
    if (player.subscriptionStatus?.active) {
      // Premium users have access to all content
      setShowPrompt(false);
      setAvailableStitches(originalCount);
    } else {
      // Free tier users - limit stitches
      const availableCount = Math.min(FREE_TIER_STITCH_LIMIT, thread.stitches.length);
      setAvailableStitches(availableCount);
      
      // Show prompt if near or at limit (80% threshold)
      setShowPrompt(thread.stitches.length >= FREE_TIER_STITCH_LIMIT * 0.8);
    }
  }, [thread, player.subscriptionStatus]);
  
  // Handle subscription upgrade action
  const handleUpgrade = () => {
    router.push('/subscription');
  };
  
  // If paywall should be shown (player hook detected premium content restriction)
  if (player.showPaywall && player.paywallStitch) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <PremiumContentPaywall 
          contentTitle={player.paywallStitch.title || 'Premium Content'}
          accessResult={player.accessResult || {
            hasAccess: false,
            accessLevel: AccessLevel.FREE,
            reason: 'This content requires a subscription'
          }}
          onClose={player.closePaywall}
          successRedirectUrl={router.asPath}
          contentBenefits={[
            'Access to all content in Zenjin Maths',
            'Unlimited practice stitches',
            'Personalized learning path',
            'Save your progress across devices'
          ]}
        />
      </div>
    );
  }
  
  // Show the player with upgrade prompt if approaching free tier limits
  return (
    <div className="min-h-screen player-bg flex flex-col items-center justify-center p-4">
      {/* Main player component */}
      <div className={`w-full max-w-md ${showPrompt ? 'mb-6' : ''}`}>
        <MinimalDistinctionPlayer
          thread={thread}
          onComplete={onComplete}
          onEndSession={onEndSession}
          questionsPerSession={questionsPerSession}
          sessionTotalPoints={sessionTotalPoints}
          userId={userId}
        />
      </div>
      
      {/* Upgrade prompt when approaching content limits */}
      {showPrompt && (
        <div className="w-full max-w-md">
          <ContentUpgradePrompt
            tier="free"
            totalStitches={totalStitches}
            completedStitches={availableStitches}
            onAction={handleUpgrade}
          />
        </div>
      )}
    </div>
  );
};

export default PlayerWrapper;