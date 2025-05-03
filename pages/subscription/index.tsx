/**
 * Subscription Page
 * 
 * This page displays subscription options and manages the subscription process.
 */
import React from 'react';
import Head from 'next/head';
import { useUser } from '@supabase/auth-helpers-react';
import SubscriptionManager from '../../components/subscription/SubscriptionManager';

export default function SubscriptionPage() {
  const user = useUser();
  
  return (
    <>
      <Head>
        <title>Subscription | Zenjin Maths</title>
        <meta name="description" content="Subscribe to Zenjin Maths for full access to all learning content and features." />
      </Head>
      
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Unlock Full Access to Zenjin Maths
            </h1>
            <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
              Choose the subscription plan that works best for you
            </p>
          </div>

          {!user && (
            <div className="max-w-lg mx-auto p-6 bg-yellow-50 rounded-lg shadow mb-8 text-center">
              <p className="text-yellow-800 font-medium mb-2">
                Please log in to subscribe
              </p>
              <p className="text-yellow-700 text-sm">
                You need to create an account or log in to access subscription features.
              </p>
            </div>
          )}

          <div className="mt-8">
            <SubscriptionManager />
          </div>

          <div className="mt-16 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Subscription Benefits
            </h2>
            
            <div className="bg-white shadow overflow-hidden rounded-lg">
              <ul className="divide-y divide-gray-200">
                <li className="p-4 flex">
                  <svg className="h-6 w-6 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Access to all learning content and activities</span>
                </li>
                <li className="p-4 flex">
                  <svg className="h-6 w-6 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Personalized learning pathways</span>
                </li>
                <li className="p-4 flex">
                  <svg className="h-6 w-6 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Progress tracking and analytics</span>
                </li>
                <li className="p-4 flex">
                  <svg className="h-6 w-6 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Offline access to learning materials</span>
                </li>
                <li className="p-4 flex">
                  <svg className="h-6 w-6 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Regular content updates and new modules</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 bg-white shadow overflow-hidden rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Subscription FAQs
              </h3>
              
              <div className="mt-4 space-y-6">
                <div>
                  <h4 className="text-base font-medium text-gray-900">Can I cancel anytime?</h4>
                  <p className="mt-2 text-sm text-gray-500">
                    Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your current billing period.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-base font-medium text-gray-900">What payment methods do you accept?</h4>
                  <p className="mt-2 text-sm text-gray-500">
                    We accept all major credit cards through our secure payment processor.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-base font-medium text-gray-900">Is there a free trial?</h4>
                  <p className="mt-2 text-sm text-gray-500">
                    While we don't offer a free trial, we do provide limited free content so you can experience the quality of our learning materials before subscribing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}