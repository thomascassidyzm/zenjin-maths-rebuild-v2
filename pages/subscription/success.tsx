/**
 * Subscription Success Page
 * 
 * This page is displayed after a successful subscription checkout.
 */
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { getSubscriptionStatus } from '../../lib/client/payments';

export default function SubscriptionSuccess() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const supabaseClient = useSupabaseClient();

  useEffect(() => {
    // Check subscription status
    const fetchSubscription = async () => {
      try {
        const status = await getSubscriptionStatus();
        setSubscription(status);
      } catch (error) {
        console.error('Error fetching subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white shadow-lg rounded-lg">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        
        <h1 className="text-2xl font-semibold text-center text-gray-800 mb-2">
          Subscription Successful!
        </h1>
        
        <p className="text-center text-gray-600 mb-6">
          Thank you for subscribing to Zenjin Maths. Your subscription has been activated.
        </p>

        {loading ? (
          <p className="text-center text-gray-500 mb-6">
            Loading subscription details...
          </p>
        ) : subscription?.active ? (
          <div className="p-4 bg-green-50 rounded-lg mb-6">
            <p className="text-green-800 text-center font-medium">
              Your subscription is now active!
            </p>
            {subscription.subscription?.plan && (
              <p className="text-green-700 text-center text-sm mt-1">
                {subscription.subscription.plan.nickname || 'Your plan'} is now active
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 bg-yellow-50 rounded-lg mb-6">
            <p className="text-yellow-800 text-center">
              Your payment was successful, but your subscription may take a moment to activate. 
              Please refresh in a few moments.
            </p>
          </div>
        )}

        <div className="flex flex-col space-y-3">
          <Link href="/dashboard" passHref>
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Go to Dashboard
            </button>
          </Link>
          
          <Link href="/learning" passHref>
            <button className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Start Learning
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}