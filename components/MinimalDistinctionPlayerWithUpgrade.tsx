/**
 * Extended Minimal Distinction Player with Subscription Upgrade Integration
 * 
 * Wraps the MinimalDistinctionPlayer with subscription upgrade capabilities.
 * Displays upgrade prompts when user reaches free tier content limits.
 */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Thread } from '../lib/types/distinction-learning';
import MinimalDistinctionPlayer from './MinimalDistinctionPlayer';
import ContentUpgradePrompt from './subscription/ContentUpgradePrompt';
import { useAuth } from '../context/AuthContext';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';
import { hasPremiumAccess, FREE_TIER_STITCH_LIMIT } from '../lib/tier-manager';
import { getUserAccessProfile } from '../lib/tier-manager';

interface MinimalDistinctionPlayerWithUpgradeProps {
  thread: Thread;
  onComplete: (results: any) => void;
  onEndSession?: (results: any) => void;
  questionsPerSession?: number;
  sessionTotalPoints?: number;
  userId?: string;
}

const MinimalDistinctionPlayerWithUpgrade: React.FC<MinimalDistinctionPlayerWithUpgradeProps> = (props) => {
  const { thread, userId } = props;
  
  const { isAuthenticated } = useAuth();
  const { tier, isSubscribed } = useSubscriptionStatus();
  const router = useRouter();
  
  // Content limit tracking
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [totalStitches, setTotalStitches] = useState(0);
  const [availableStitches, setAvailableStitches] = useState(0);
  
  // Check if the content has been limited due to free tier
  useEffect(() => {
    // Skip for premium users
    if (isSubscribed) {
      setShowUpgradePrompt(false);
      return;
    }
    
    // Check if the thread has stitches and they have been limited
    if (thread && thread.stitches) {
      // Get the original stitch count if metadata is available
      const originalCount = thread.originalStitchCount || thread.stitches.length;
      setTotalStitches(originalCount);
      
      // Check if user is at the content limit
      if (!isSubscribed && originalCount > FREE_TIER_STITCH_LIMIT) {
        const accessProfile = getUserAccessProfile(isAuthenticated, isSubscribed);
        const availableCount = isAuthenticated 
          ? FREE_TIER_STITCH_LIMIT 
          : Math.min(FREE_TIER_STITCH_LIMIT, thread.stitches.length);
        
        setAvailableStitches(availableCount);
        
        // Show upgrade prompt if near or at the content limit
        if (thread.stitches.length <= FREE_TIER_STITCH_LIMIT) {
          // Edge case: check if actual stitches are at least 80% of free tier limit
          setShowUpgradePrompt(thread.stitches.length >= FREE_TIER_STITCH_LIMIT * 0.8);
        } else {
          // If thread has been limited already
          setShowUpgradePrompt(true);
        }
      } else {
        setAvailableStitches(thread.stitches.length);
        setShowUpgradePrompt(false);
      }
    }
  }, [thread, isSubscribed, isAuthenticated]);
  
  // Handle upgrade action
  const handleUpgrade = () => {
    router.push('/subscription');
  };
  
  // If we're showing the upgrade prompt in main view (at content limit)
  if (showUpgradePrompt) {
    return (
      <div className="min-h-screen player-bg flex flex-col items-center justify-center p-4">
        {/* Render the player with smaller height */}
        <div className="w-full max-w-md mb-6">
          <MinimalDistinctionPlayer {...props} />
        </div>
        
        {/* Upgrade prompt at the bottom */}
        <div className="w-full max-w-md">
          <ContentUpgradePrompt 
            tier={tier} 
            totalStitches={totalStitches}
            completedStitches={availableStitches}
            onAction={handleUpgrade}
          />
        </div>
      </div>
    );
  }
  
  // Otherwise, render the standard player with upgrade prompt integrated
  return (
    <div className="min-h-screen player-bg flex flex-col items-center justify-center p-4">
      <MinimalDistinctionPlayer {...props} />
      
      {/* Remove the fixed compact upgrade prompt to avoid intrusive popups */}
    </div>
  );
};

export default MinimalDistinctionPlayerWithUpgrade;