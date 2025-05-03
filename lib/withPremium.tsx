/**
 * Premium Content Guard HOC
 * 
 * A higher-order component that restricts access to premium content
 * based on user subscription status.
 */
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@supabase/auth-helpers-react';
import { getSubscriptionStatus } from './client/payments';
import Paywall from '../components/subscription/Paywall';

// Higher-order component to protect premium routes
export default function withPremium<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    // Additional options can be added here
    redirectTo?: string;
    paywallTitle?: string;
    paywallDescription?: string;
  } = {}
) {
  // Create and return wrapped component
  const WithPremium: React.FC<P> = (props) => {
    const [isLoading, setIsLoading] = useState(true);
    const [hasPremium, setHasPremium] = useState(false);
    
    const user = useUser();
    const router = useRouter();
    
    const { 
      redirectTo = '/subscription',
      paywallTitle = 'Premium Content',
      paywallDescription = 'This content requires a premium subscription.'
    } = options;

    useEffect(() => {
      const checkSubscription = async () => {
        // If not logged in, redirect to login page with return URL
        if (!user) {
          const path = encodeURIComponent(window.location.pathname + window.location.search);
          router.push(`/signin?redirect=${path}`);
          return;
        }

        try {
          const status = await getSubscriptionStatus();
          setHasPremium(status.active);
          
          // Optionally redirect non-premium users (if redirectTo is provided)
          if (!status.active && redirectTo) {
            router.push(redirectTo);
          }
        } catch (error) {
          console.error('Error checking subscription status:', error);
          setHasPremium(false);
        } finally {
          setIsLoading(false);
        }
      };

      checkSubscription();
    }, [user, router, redirectTo]);

    // Show loading state
    if (isLoading) {
      return (
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Checking subscription...</p>
          </div>
        </div>
      );
    }

    // If user has premium access, render the protected component
    if (hasPremium) {
      return <Component {...props} />;
    }

    // If not redirecting, show paywall component
    if (!redirectTo) {
      return (
        <Paywall
          title={paywallTitle}
          description={paywallDescription}
        >
          <Component {...props} />
        </Paywall>
      );
    }

    // If we're redirecting and not loading, we should not render anything
    // as we're in the process of redirecting
    return null;
  };

  // Copy static methods and display name
  const componentName = Component.displayName || Component.name || 'Component';
  WithPremium.displayName = `withPremium(${componentName})`;

  return WithPremium;
}