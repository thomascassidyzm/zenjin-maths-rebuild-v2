/**
 * Subscription Badge Component
 * 
 * Displays the current subscription status as a badge that can be
 * incorporated into navigation bars and other UI components.
 */
import React from 'react';
import { useRouter } from 'next/router';
import { useSubscription } from '../../hooks/useSubscription';

interface SubscriptionBadgeProps {
  /**
   * Whether to show the badge for anonymous users
   */
  showForAnonymous?: boolean;
  
  /**
   * Whether to show the free tier badge
   */
  showFreeTier?: boolean;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * CSS classes for the free tier badge
   */
  freeClassName?: string;
  
  /**
   * CSS classes for the premium badge
   */
  premiumClassName?: string;
  
  /**
   * Size variant ('sm', 'md', 'lg')
   */
  size?: 'sm' | 'md' | 'lg';
}

const SubscriptionBadge: React.FC<SubscriptionBadgeProps> = ({
  showForAnonymous = true,
  showFreeTier = true,
  className = '',
  freeClassName = '',
  premiumClassName = '',
  size = 'md'
}) => {
  const router = useRouter();
  const { 
    isLoading, 
    isSubscribed, 
    goToManage
  } = useSubscription();
  
  // Size classes based on the size prop
  const sizeClasses = {
    sm: 'text-xs py-0.5 px-2',
    md: 'text-sm py-1 px-3',
    lg: 'text-base py-1.5 px-4'
  };
  
  // Don't show anything while loading
  if (isLoading) {
    return (
      <div className={`inline-flex items-center rounded-full bg-gray-500/20 ${sizeClasses[size]} ${className}`}>
        <div className="w-3 h-3 mr-1.5 rounded-full bg-gray-500 animate-pulse"></div>
        <span className="text-white/70">Loading...</span>
      </div>
    );
  }
  
  // Premium badge
  if (isSubscribed) {
    return (
      <div 
        className={`inline-flex items-center rounded-full bg-gradient-to-r from-teal-600/30 to-emerald-600/30 ${sizeClasses[size]} cursor-pointer ${className} ${premiumClassName}`}
        onClick={goToManage}
      >
        <div className="w-3 h-3 mr-1.5 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500"></div>
        <span className="text-teal-300 font-medium">Premium</span>
      </div>
    );
  }
  
  // Free tier badge
  if (showFreeTier) {
    return (
      <div 
        className={`inline-flex items-center rounded-full bg-blue-600/20 ${sizeClasses[size]} cursor-pointer ${className} ${freeClassName}`}
        onClick={goToManage}
      >
        <div className="w-3 h-3 mr-1.5 rounded-full bg-blue-500"></div>
        <span className="text-blue-300 font-medium">Free Tier</span>
      </div>
    );
  }
  
  // Return empty fragment if not showing for anonymous
  return null;
};

export default SubscriptionBadge;