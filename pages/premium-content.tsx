/**
 * Premium Content Page
 * 
 * An example page that is protected by the premium subscription guard.
 */
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import withPremium from '../lib/withPremium';

const PremiumContentPage: React.FC = () => {
  return (
    <div className="min-h-screen player-bg text-white">
      <Head>
        <title>Premium Content | Zenjin Maths</title>
        <meta name="description" content="Exclusive premium content for subscribers" />
      </Head>
      
      {/* Page content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex justify-between items-center">
            <h1 className="text-3xl font-bold">Premium Content</h1>
            <Link 
              href="/"
              className="text-teal-400 hover:text-teal-300 transition-colors"
            >
              Back to Home
            </Link>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex items-center mb-6">
              <div className="bg-teal-500 p-2 rounded-lg mr-4">
                <svg 
                  className="h-6 w-6 text-white" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold">Thank You for Subscribing!</h2>
            </div>
            
            <p className="text-white/90 mb-6">
              As a premium subscriber, you now have exclusive access to advanced learning content, 
              personalized learning pathways, and enhanced features to accelerate your mathematics learning journey.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white/10 p-6 rounded-xl">
                <h3 className="font-bold text-xl mb-3 text-teal-300">Advanced Learning Modules</h3>
                <p className="text-white/80 mb-4">
                  Access specialized learning modules designed to deepen your understanding of complex mathematical concepts.
                </p>
                <Link 
                  href="/advanced-modules"
                  className="inline-block bg-teal-600 hover:bg-teal-500 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Explore Modules
                </Link>
              </div>
              
              <div className="bg-white/10 p-6 rounded-xl">
                <h3 className="font-bold text-xl mb-3 text-blue-300">Personalized Learning Path</h3>
                <p className="text-white/80 mb-4">
                  Follow a customized learning path tailored to your strengths, weaknesses, and learning goals.
                </p>
                <Link 
                  href="/learning-path"
                  className="inline-block bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  View My Path
                </Link>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-teal-500/20 to-blue-500/20 p-6 rounded-xl mb-6">
              <h3 className="font-bold text-xl mb-3">Upcoming Premium Features</h3>
              <ul className="list-disc list-inside space-y-2 text-white/90">
                <li>One-on-one tutoring sessions with mathematics experts</li>
                <li>Interactive problem-solving workshops</li>
                <li>Downloadable practice materials and study guides</li>
                <li>Performance analytics and progress tracking dashboard</li>
              </ul>
            </div>
            
            <div className="text-center">
              <Link 
                href="/dashboard"
                className="inline-block bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-lg"
              >
                Go to My Dashboard
              </Link>
            </div>
          </div>
          
          <div className="text-center text-white/60 text-sm">
            <p>Have questions about your premium subscription? Visit our <Link href="/support" className="text-teal-400 hover:text-teal-300">support page</Link> or contact us at support@zenjin-maths.com</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export the page wrapped with the premium guard
export default withPremium(PremiumContentPage, {
  paywallTitle: 'Premium Content',
  paywallDescription: 'This exclusive content is only available to premium subscribers. Subscribe now to unlock all premium features.'
});