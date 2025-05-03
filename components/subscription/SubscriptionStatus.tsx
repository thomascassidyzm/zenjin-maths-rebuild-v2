/**
 * Subscription Status Component
 * 
 * Displays detailed subscription status information for use in
 * dashboards and account pages.
 */
import React from 'react';
import { useRouter } from 'next/router';
import { useSubscription } from '../../hooks/useSubscription';
import { formatCurrency } from '../../lib/stripe';

interface SubscriptionStatusProps {
  /**
   * Whether to show upgrade button for free tier users
   */
  showUpgradeButton?: boolean;
  
  /**
   * Whether to show management button for premium users
   */
  showManageButton?: boolean;
  
  /**
   * CSS classes for the container
   */
  className?: string;
  
  /**
   * Whether to show compact version
   */
  compact?: boolean;
}

const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({
  showUpgradeButton = true,
  showManageButton = true,
  className = '',
  compact = false
}) => {
  const router = useRouter();
  const { 
    isLoading, 
    isSubscribed, 
    subscriptionData,
    refresh,
    goToManage
  } = useSubscription();
  
  // If loading, show skeleton
  if (isLoading) {
    return (
      <div className={`bg-white/10 backdrop-blur-sm rounded-lg p-4 animate-pulse ${className}`}>
        <div className="h-5 bg-white/20 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-white/20 rounded w-2/3 mb-2"></div>
        <div className="h-4 bg-white/20 rounded w-1/2"></div>
      </div>
    );
  }
  
  // Premium user status
  if (isSubscribed && subscriptionData?.subscription) {
    const { subscription } = subscriptionData;
    
    // Format renewal date
    const renewalDate = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric' 
        })
      : 'Unknown';
    
    // Format price
    const price = subscription.plan?.amount
      ? formatCurrency(subscription.plan.amount, subscription.plan.currency)
      : '£12.00';
    
    // Format interval
    const interval = subscription.plan?.interval || 'month';
    
    // Compact version for sidebars and smaller UI sections
    if (compact) {
      return (
        <div className={`bg-gradient-to-r from-teal-600/20 to-emerald-600/20 backdrop-blur-sm rounded-lg p-3 ${className}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 mr-2"></div>
              <span className="text-sm font-semibold text-white">Premium Account</span>
            </div>
            {showManageButton && (
              <button 
                onClick={goToManage}
                className="text-xs bg-white/20 hover:bg-white/30 transition-colors rounded px-2 py-1 text-white"
              >
                Manage
              </button>
            )}
          </div>
        </div>
      );
    }
    
    // Full version
    return (
      <div className={`bg-gradient-to-r from-teal-600/20 to-emerald-600/20 backdrop-blur-sm rounded-lg p-4 ${className}`}>
        <div className="flex items-center mb-2">
          <div className="w-4 h-4 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 mr-2"></div>
          <h3 className="font-bold text-white">Premium Account</h3>
        </div>
        
        <div className="space-y-2 mb-3 text-white/80 text-sm">
          <p><span className="inline-block w-24 text-white/50">Plan:</span> 
            {subscription.plan?.nickname || 'Monthly Premium'}
          </p>
          <p><span className="inline-block w-24 text-white/50">Price:</span> 
            {price}/{interval}
          </p>
          <p><span className="inline-block w-24 text-white/50">Renews on:</span> 
            {subscription.cancelAtPeriodEnd ? 'Cancels on ' : ''}{renewalDate}
          </p>
        </div>
        
        {subscription.cancelAtPeriodEnd && (
          <div className="mb-3 bg-amber-500/20 text-amber-300 px-3 py-2 rounded text-sm">
            Your subscription will end after the current billing period.
          </div>
        )}
        
        {showManageButton && (
          <div className="mt-3">
            <button 
              onClick={goToManage}
              className="text-sm bg-white/20 hover:bg-white/30 transition-colors rounded px-3 py-1.5 text-white"
            >
              Manage Subscription
            </button>
          </div>
        )}
      </div>
    );
  }
  
  // Free tier status
  // Compact version
  if (compact) {
    return (
      <div className={`bg-blue-600/20 backdrop-blur-sm rounded-lg p-3 ${className}`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span className="text-sm font-semibold text-white">Free Tier Account</span>
          </div>
          {showUpgradeButton && (
            <button 
              onClick={goToManage}
              className="text-xs bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 transition-colors rounded px-2 py-1 text-white"
            >
              Upgrade
            </button>
          )}
        </div>
      </div>
    );
  }
  
  // Full version
  return (
    <div className={`bg-blue-600/20 backdrop-blur-sm rounded-lg p-4 ${className}`}>
      <div className="flex items-center mb-2">
        <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
        <h3 className="font-bold text-white">Free Tier Account</h3>
      </div>
      
      <div className="space-y-2 mb-3 text-white/80 text-sm">
        <p>You're currently on the free tier with limited access to content.</p>
        <p>Upgrade to premium for full access to all content and features.</p>
      </div>
      
      {showUpgradeButton && (
        <div className="mt-3">
          <button 
            onClick={goToManage}
            className="text-sm bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 transition-colors rounded px-3 py-1.5 text-white"
          >
            Upgrade to Premium
          </button>
        </div>
      )}
    </div>
  );
};

export default SubscriptionStatus;