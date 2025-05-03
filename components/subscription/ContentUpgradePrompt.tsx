/**
 * Content Upgrade Prompt Component
 * 
 * A component to show at the end of free tier content to encourage
 * subscription upgrades, designed to be embedded within the player.
 */
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { UserTier, getUpgradeMessage } from '../../lib/tier-manager';

interface ContentUpgradePromptProps {
  tier: UserTier;
  totalStitches?: number;
  completedStitches?: number;
  onAction?: () => void;
  className?: string;
  compact?: boolean;
}

const ContentUpgradePrompt: React.FC<ContentUpgradePromptProps> = ({
  tier,
  totalStitches,
  completedStitches,
  onAction,
  className = '',
  compact = false
}) => {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  
  const { message, actionText } = getUpgradeMessage(tier);
  
  // Content restriction percentage for progress indicator
  const progressPercent = totalStitches && completedStitches 
    ? Math.min(100, Math.round((completedStitches / totalStitches) * 100))
    : null;
  
  const handleAction = () => {
    // If action callback is provided, use it
    if (onAction) {
      onAction();
      return;
    }
    
    // Otherwise, navigate to appropriate page based on user tier
    if (tier === 'anonymous') {
      router.push('/signin');
    } else {
      router.push('/subscription');
    }
  };

  // Compact version for inline display
  if (compact) {
    return (
      <div className={`p-3 bg-blue-100 rounded-lg shadow-sm flex items-center justify-between ${className}`}>
        <p className="text-sm text-blue-800 flex-grow mr-4">{message}</p>
        <button
          onClick={handleAction}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          {actionText}
        </button>
      </div>
    );
  }

  // Full version with more details
  return (
    <div className={`bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-start">
        {/* Content icon */}
        <div className="mr-5 bg-blue-100 p-3 rounded-full">
          {tier === 'anonymous' ? (
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
        </div>
        
        {/* Content info */}
        <div className="flex-grow">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {tier === 'anonymous' ? 'Content Preview Limit Reached' : 'Unlock More Content'}
          </h3>
          <p className="text-gray-700 mb-4">{message}</p>
          
          {/* Progress indicator */}
          {progressPercent !== null && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600">Content Access</span>
                <span className="text-xs font-semibold text-gray-800">{progressPercent}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {completedStitches} of {totalStitches} stitches available in free tier
              </p>
            </div>
          )}
          
          {/* Action button */}
          <button
            onClick={handleAction}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {actionText}
            <svg className="ml-2 -mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContentUpgradePrompt;