/**
 * Paywall Component
 * 
 * A component to restrict access to premium content based on subscription status.
 * It shows a subscription prompt for non-subscribers.
 */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useUser } from '@supabase/auth-helpers-react';
import { getSubscriptionStatus } from '../../lib/client/payments';

interface PaywallProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  title?: string;
  description?: string;
  showLoginOption?: boolean;
  redirectAfterLogin?: string;
}

const Paywall: React.FC<PaywallProps> = ({
  children,
  fallback,
  title = 'Premium Content',
  description = 'This content is only available to premium subscribers.',
  showLoginOption = true,
  redirectAfterLogin
}) => {
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const user = useUser();
  const router = useRouter();

  // Save the current URL for redirecting after login if not specified
  const currentPath = typeof window !== 'undefined' 
    ? window.location.pathname + window.location.search
    : '';
  const redirectPath = redirectAfterLogin || currentPath;

  useEffect(() => {
    const checkSubscription = async () => {
      // If user is not logged in, they definitely don't have a subscription
      if (!user) {
        setIsSubscribed(false);
        setIsLoading(false);
        return;
      }

      try {
        const status = await getSubscriptionStatus();
        setIsSubscribed(status.active);
      } catch (error) {
        console.error('Error checking subscription status:', error);
        setIsSubscribed(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscription();
  }, [user]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8 min-h-[200px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading content...</p>
        </div>
      </div>
    );
  }

  // If user has subscription, show the content
  if (isSubscribed) {
    return <>{children}</>;
  }

  // If custom fallback is provided, use that
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default paywall UI
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="text-center">
          <svg 
            className="mx-auto h-12 w-12 text-yellow-500" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
            />
          </svg>
          
          <h2 className="mt-4 text-xl font-bold text-gray-900">{title}</h2>
          <p className="mt-2 text-gray-600">{description}</p>
        </div>

        <div className="mt-6 space-y-4">
          <Link href="/subscription" passHref>
            <button 
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Subscribe Now
            </button>
          </Link>

          {!user && showLoginOption && (
            <Link 
              href={`/signin?redirect=${encodeURIComponent(redirectPath)}`}
              passHref
            >
              <button 
                className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Sign In
              </button>
            </Link>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Subscription Benefits</h3>
          <ul className="mt-2 space-y-2">
            <li className="flex items-start">
              <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-gray-600">Access to all learning content</span>
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-gray-600">Enhanced progress tracking</span>
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-gray-600">Personalized learning journey</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Paywall;