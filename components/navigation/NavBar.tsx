/**
 * Navigation Bar Component
 * 
 * A responsive navigation bar with subscription status indicator
 * and premium content access controls.
 */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '@supabase/auth-helpers-react';
import SubscriptionStatusIndicator from '../subscription/SubscriptionStatusIndicator';
import PremiumNavItem from './PremiumNavItem';

const NavBar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const user = useUser();
  
  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [router.pathname]);

  return (
    <nav className="bg-gradient-to-r from-blue-900 to-indigo-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and main nav items */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link href="/" className="text-white font-bold text-xl">
                Zenjin Maths
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:block ml-10">
              <div className="flex items-center space-x-4">
                <Link 
                  href="/"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    router.pathname === '/' 
                      ? 'bg-blue-800 text-white' 
                      : 'text-white/80 hover:bg-blue-800 hover:text-white'
                  }`}
                >
                  Home
                </Link>
                
                <Link 
                  href="/dashboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    router.pathname === '/dashboard' 
                      ? 'bg-blue-800 text-white' 
                      : 'text-white/80 hover:bg-blue-800 hover:text-white'
                  }`}
                >
                  Dashboard
                </Link>
                
                <Link 
                  href="/minimal-player"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    router.pathname === '/minimal-player' 
                      ? 'bg-blue-800 text-white' 
                      : 'text-white/80 hover:bg-blue-800 hover:text-white'
                  }`}
                >
                  Learning
                </Link>
                
                {/* Premium content link */}
                <PremiumNavItem 
                  href="/premium-content"
                  label="Premium"
                  active={router.pathname === '/premium-content'}
                  className="px-3 py-2 rounded-md text-sm font-medium"
                />
              </div>
            </div>
          </div>
          
          {/* Right side - User section */}
          <div className="hidden md:flex items-center">
            {/* Subscription status */}
            {user && (
              <div className="mr-4">
                <SubscriptionStatusIndicator variant="badge" />
              </div>
            )}
            
            {/* Auth buttons */}
            {user ? (
              <div className="flex items-center">
                <Link 
                  href="/account"
                  className={`relative px-3 py-2 rounded-md text-sm font-medium ${
                    router.pathname === '/account' 
                      ? 'bg-teal-600 text-white' 
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  My Account
                </Link>
                
                <Link 
                  href="/subscription"
                  className="ml-3 px-3 py-2 rounded-md text-sm font-medium text-indigo-900 bg-white hover:bg-gray-100 transition-colors"
                >
                  Upgrade
                </Link>
              </div>
            ) : (
              <div className="flex items-center">
                <Link 
                  href="/signin"
                  className="px-3 py-2 rounded-md text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
                >
                  Sign In
                </Link>
                
                <Link 
                  href="/signup"
                  className="ml-3 px-3 py-2 rounded-md text-sm font-medium text-indigo-900 bg-white hover:bg-gray-100 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-white/80 hover:text-white hover:bg-blue-800 focus:outline-none"
            >
              <span className="sr-only">Open main menu</span>
              {isMenuOpen ? (
                <svg 
                  className="block h-6 w-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg 
                  className="block h-6 w-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      <div className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <Link 
            href="/"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              router.pathname === '/' 
                ? 'bg-blue-800 text-white' 
                : 'text-white/80 hover:bg-blue-800 hover:text-white'
            }`}
          >
            Home
          </Link>
          
          <Link 
            href="/dashboard"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              router.pathname === '/dashboard' 
                ? 'bg-blue-800 text-white' 
                : 'text-white/80 hover:bg-blue-800 hover:text-white'
            }`}
          >
            Dashboard
          </Link>
          
          <Link 
            href="/minimal-player"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              router.pathname === '/minimal-player' 
                ? 'bg-blue-800 text-white' 
                : 'text-white/80 hover:bg-blue-800 hover:text-white'
            }`}
          >
            Learning
          </Link>
          
          {/* Premium content link */}
          <div className="block">
            <PremiumNavItem 
              href="/premium-content"
              label="Premium Content"
              active={router.pathname === '/premium-content'}
              className="block px-3 py-2 rounded-md text-base font-medium"
            />
          </div>
          
          {/* Subscription link */}
          <Link 
            href="/subscription"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              router.pathname === '/subscription' 
                ? 'bg-teal-600 text-white' 
                : 'text-white/80 hover:bg-teal-600 hover:text-white'
            }`}
          >
            Subscription
          </Link>
          
          {/* Account or auth links */}
          {user ? (
            <Link 
              href="/account"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                router.pathname === '/account' 
                  ? 'bg-blue-800 text-white' 
                  : 'text-white/80 hover:bg-blue-800 hover:text-white'
              }`}
            >
              My Account
            </Link>
          ) : (
            <>
              <Link 
                href="/signin"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  router.pathname === '/signin' 
                    ? 'bg-blue-800 text-white' 
                    : 'text-white/80 hover:bg-blue-800 hover:text-white'
                }`}
              >
                Sign In
              </Link>
              
              <Link 
                href="/signup"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  router.pathname === '/signup' 
                    ? 'bg-blue-800 text-white' 
                    : 'text-white/80 hover:bg-blue-800 hover:text-white'
                }`}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;