import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';

// Animated section variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15
    }
  }
};

// Price is £12 including VAT
const monthlyPrice = 12;
// Calculate VAT portion for reference only (20% UK standard rate)
const vatRate = 0.2;
const vatPortion = monthlyPrice - (monthlyPrice / (1 + vatRate));

export default function SubscribePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { 
    isLoading, 
    isSubscribed, 
    error, 
    isProcessing, 
    subscribe, 
    refresh 
  } = useSubscription({
    checkOnMount: true,
    refreshInterval: 60000, // Refresh every minute
  });
  
  // Get query parameters
  const { success, canceled } = router.query;
  
  // Handle subscription
  const handleSubscribe = async () => {
    await subscribe();
  };
  
  // Handle continue to dashboard
  const handleContinueToDashboard = () => {
    router.push('/dashboard');
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
      <Head>
        <title>Subscribe to Zenjin Maths | Premium Access</title>
        <meta name="description" content="Unlock the full potential of Zenjin Maths with a premium subscription" />
      </Head>
      
      {/* Header */}
      <header className="py-6 px-4 border-b border-white/10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Image 
              src="/images/logo.svg" 
              alt="Zenjin Maths Logo" 
              width={40} 
              height={40}
            />
            <h1 className="text-xl font-bold">Zenjin Maths</h1>
          </div>
          
          {user && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center">
                <span className="text-sm font-bold">{user.email?.charAt(0).toUpperCase() || 'U'}</span>
              </div>
              <span className="text-sm text-white/70">{user.email}</span>
            </div>
          )}
        </div>
      </header>
      
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        {/* Success Message */}
        {success === 'true' && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-emerald-500/50 backdrop-blur-sm rounded-xl p-6 shadow-lg"
          >
            <div className="flex items-start">
              <div className="mr-4 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-full p-2">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-2">Subscription Activated!</h2>
                <p className="text-white/70 mb-4">Thank you for subscribing to Zenjin Maths Premium. You now have full access to all content and features.</p>
                <button 
                  onClick={handleContinueToDashboard}
                  className="px-5 py-2 bg-white/20 hover:bg-white/30 transition-colors rounded-lg text-white font-medium"
                >
                  Continue to Dashboard
                </button>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Canceled Message */}
        {canceled === 'true' && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-amber-500/10 border border-amber-500/50 backdrop-blur-sm rounded-xl p-6 shadow-lg"
          >
            <div className="flex items-start">
              <div className="mr-4 bg-amber-500 rounded-full p-2">
                <svg className="w-6 h-6 text-amber-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-2">Subscription Canceled</h2>
                <p className="text-white/70">You've canceled the subscription process. No charges have been made.</p>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="text-center mb-10"
          >
            <motion.h1 
              variants={itemVariants}
              className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-teal-300 to-emerald-300 bg-clip-text text-transparent"
            >
              Unlock the Full Power of Zenjin Maths
            </motion.h1>
            <motion.p 
              variants={itemVariants}
              className="text-lg text-white/70 max-w-2xl mx-auto"
            >
              Transform your learning experience with unlimited access to all content
            </motion.p>
          </motion.div>
          
          {/* Subscription Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl border border-white/20"
          >
            {/* Subscription Header */}
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 py-6 px-8">
              <div className="flex flex-col md:flex-row justify-between items-center">
                <div className="mb-4 md:mb-0">
                  <h2 className="text-2xl font-bold">Premium Membership</h2>
                  <p className="text-white/80">Complete access to all mathematical content</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center">
                    <span className="text-3xl font-bold">£{monthlyPrice}</span>
                    <span className="ml-1 text-white/80">/month</span>
                  </div>
                  <p className="text-xs text-white/70">VAT included (£{vatPortion.toFixed(2)})</p>
                </div>
              </div>
            </div>
            
            {/* Subscription Body */}
            <div className="p-8">
              {/* Feature Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="flex items-start">
                  <div className="mr-4 p-2 bg-teal-500/20 rounded-lg">
                    <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Unlimited Content</h3>
                    <p className="text-white/70">Access all stitches in all tubes without restrictions</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="mr-4 p-2 bg-teal-500/20 rounded-lg">
                    <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Faster Progress</h3>
                    <p className="text-white/70">Advance through content at your own pace without barriers</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="mr-4 p-2 bg-teal-500/20 rounded-lg">
                    <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Advanced Tracking</h3>
                    <p className="text-white/70">Track your progress and see your improvement over time</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="mr-4 p-2 bg-teal-500/20 rounded-lg">
                    <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Priority Support</h3>
                    <p className="text-white/70">Get help when you need it with premium support</p>
                  </div>
                </div>
              </div>
              
              {/* Benefits List */}
              <div className="mb-8">
                <h3 className="font-semibold text-lg mb-4">Membership includes:</h3>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-emerald-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Full access to all premium mathematical content</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-emerald-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Hundreds of interactive exercises and problems</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-emerald-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Advanced progress tracking and analytics</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-emerald-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Personalized learning recommendations</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-emerald-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Cancel anytime - no long-term commitment</span>
                  </li>
                </ul>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col md:flex-row md:justify-between items-center">
                {isSubscribed ? (
                  <div className="flex items-center bg-emerald-500/20 text-emerald-300 px-4 py-2 rounded-lg mb-4 md:mb-0">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>You're already subscribed</span>
                  </div>
                ) : (
                  <button
                    onClick={handleSubscribe}
                    disabled={isLoading || isProcessing}
                    className="w-full md:w-auto mb-4 md:mb-0 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-teal-500/25 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
                  >
                    {isProcessing ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      'Subscribe Now'
                    )}
                  </button>
                )}
                
                <div className="text-white/60 text-sm flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Secure payment via Stripe</span>
                </div>
              </div>
              
              {/* Error message */}
              {error && (
                <div className="mt-4 bg-red-500/20 border border-red-500/50 text-white rounded-lg p-3">
                  <p className="flex items-center">
                    <svg className="w-5 h-5 mr-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </p>
                </div>
              )}
            </div>
            
            {/* Subscription Footer */}
            <div className="bg-white/5 px-8 py-4 flex flex-wrap items-center justify-between border-t border-white/10">
              <div className="flex items-center text-white/70 text-sm mb-2 md:mb-0">
                <svg className="w-5 h-5 mr-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>VAT included</span>
              </div>
              
              <div className="flex items-center text-white/70 text-sm">
                <svg className="w-5 h-5 mr-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Cancel anytime</span>
              </div>
            </div>
          </motion.div>
          
          {/* FAQ Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 max-w-3xl mx-auto"
          >
            <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
            
            <div className="space-y-4">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 hover:bg-white/10 transition-colors">
                <h3 className="font-bold text-lg mb-2">Will I be charged immediately?</h3>
                <p className="text-white/70">Yes, you'll be charged the monthly fee (£{monthlyPrice}) as soon as you subscribe. Your subscription will renew automatically each month.</p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 hover:bg-white/10 transition-colors">
                <h3 className="font-bold text-lg mb-2">How can I cancel my subscription?</h3>
                <p className="text-white/70">You can cancel your subscription at any time from your account dashboard. You'll still have access until the end of your current billing period.</p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 hover:bg-white/10 transition-colors">
                <h3 className="font-bold text-lg mb-2">What payment methods are accepted?</h3>
                <p className="text-white/70">We accept all major credit and debit cards, including Visa, Mastercard, and American Express.</p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 hover:bg-white/10 transition-colors">
                <h3 className="font-bold text-lg mb-2">Is there a free trial?</h3>
                <p className="text-white/70">We don't offer a free trial, but you can access the first 10 lessons in each learning tube for free to get a feel for the content before subscribing.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-white/10 py-6 px-4">
        <div className="container mx-auto text-center text-white/50 text-sm">
          <p className="mb-2">© {new Date().getFullYear()} Zenjin Maths. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}