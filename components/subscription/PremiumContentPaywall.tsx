/**
 * Premium Content Paywall Component
 * 
 * This component displays a paywall when users try to access premium content
 * without an active subscription.
 */
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { subscribeToPlay } from '../../lib/client/payments';
import { AccessCheckResult } from '../../lib/freeTierAccess';

interface PremiumContentPaywallProps {
  /**
   * The content title to display
   */
  contentTitle?: string;
  
  /**
   * Access check result
   */
  accessResult: AccessCheckResult;
  
  /**
   * URL to redirect to after successful subscription
   */
  successRedirectUrl?: string;
  
  /**
   * URL to redirect to if user cancels subscription
   */
  cancelRedirectUrl?: string;
  
  /**
   * Whether to show a teaser of the premium content
   */
  showTeaser?: boolean;
  
  /**
   * React node to render as teaser content
   */
  teaserContent?: React.ReactNode;
  
  /**
   * Function to call when user closes the paywall
   */
  onClose?: () => void;
  
  /**
   * Content benefits to highlight
   */
  contentBenefits?: string[];
}

const PremiumContentPaywall: React.FC<PremiumContentPaywallProps> = ({
  contentTitle = 'Premium Content',
  accessResult,
  successRedirectUrl,
  cancelRedirectUrl,
  showTeaser = true,
  teaserContent,
  onClose,
  contentBenefits = [
    'Access to all content in Zenjin Maths',
    'Unlimited practice stitches',
    'Personalized learning path',
    'Progress tracking and analytics'
  ]
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // Format current URL for redirection
  const currentUrl = typeof window !== 'undefined' 
    ? window.location.href 
    : '/';
  
  // Handle subscription
  const handleSubscribe = async (plan: 'MONTHLY' | 'ANNUAL') => {
    try {
      setLoading(true);
      setError(null);
      
      await subscribeToPlay(
        plan,
        successRedirectUrl || currentUrl,
        cancelRedirectUrl || currentUrl
      );
    } catch (err: any) {
      setError(err.message || 'Failed to start subscription process');
      setLoading(false);
    }
  };
  
  // Handle navigation to subscription page
  const handleViewPlans = () => {
    router.push('/subscription');
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6 rounded-t-lg">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Upgrade to Unlock {contentTitle}</h2>
            {onClose && (
              <button 
                onClick={onClose}
                className="text-white hover:text-blue-200"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <p className="mt-2 text-blue-100">
            {accessResult.reason || 'Subscribe to unlock this content and all other premium features'}
          </p>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {/* Error message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p>{error}</p>
            </div>
          )}
          
          {/* Teaser content */}
          {showTeaser && accessResult.isTeaser && teaserContent && (
            <div className="mb-6 p-4 bg-gray-100 rounded relative overflow-hidden">
              <div className="relative z-10 opacity-50">
                {teaserContent}
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white z-20 flex items-end justify-center pb-4">
                <span className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                  Subscribe to continue
                </span>
              </div>
            </div>
          )}
          
          {/* Benefits */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Subscription Benefits</h3>
            <ul className="space-y-2">
              {contentBenefits.map((benefit, index) => (
                <li key={index} className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Subscription options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="border rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all">
              <h3 className="font-bold text-lg">Monthly</h3>
              <p className="text-2xl font-bold my-2">$9.99/mo</p>
              <p className="text-sm text-gray-600 mb-4">Flexible monthly billing</p>
              <button
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                onClick={() => handleSubscribe('MONTHLY')}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Subscribe Monthly'}
              </button>
            </div>
            
            <div className="border border-blue-500 rounded-lg p-4 shadow-md relative">
              <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-3">
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">BEST VALUE</span>
              </div>
              <h3 className="font-bold text-lg">Annual</h3>
              <p className="text-2xl font-bold my-2">$99.99/yr</p>
              <p className="text-sm text-gray-600 mb-4">Save 16% with annual billing</p>
              <button
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                onClick={() => handleSubscribe('ANNUAL')}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Subscribe Annually'}
              </button>
            </div>
          </div>
          
          {/* Footer */}
          <div className="text-center border-t pt-4">
            <button
              className="text-blue-600 hover:underline"
              onClick={handleViewPlans}
              disabled={loading}
            >
              View all subscription options
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumContentPaywall;