/**
 * Subscription Canceled Page
 * 
 * This page is displayed when a user cancels the checkout process.
 */
import React from 'react';
import Link from 'next/link';

export default function SubscriptionCanceled() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white shadow-lg rounded-lg">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>
        
        <h1 className="text-2xl font-semibold text-center text-gray-800 mb-2">
          Subscription Canceled
        </h1>
        
        <p className="text-center text-gray-600 mb-6">
          Your checkout process was canceled and you have not been charged.
        </p>

        <div className="p-4 bg-blue-50 rounded-lg mb-6">
          <p className="text-blue-800 text-center">
            You can still continue using the free features of Zenjin Maths.
          </p>
          <p className="text-blue-700 text-center text-sm mt-2">
            Subscribe anytime to unlock all premium content and features.
          </p>
        </div>

        <div className="flex flex-col space-y-3">
          <Link href="/subscription" passHref>
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Return to Subscription Options
            </button>
          </Link>
          
          <Link href="/dashboard" passHref>
            <button className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Go to Dashboard
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}