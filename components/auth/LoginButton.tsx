import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import AuthModal from './AuthModal';

/**
 * LoginButton Component
 * 
 * A button that either displays user info when logged in,
 * or opens an authentication modal when logged out.
 */
export default function LoginButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isAuthenticated, user, signOut } = useAuth();
  
  // Open auth modal
  const openModal = () => {
    setIsModalOpen(true);
  };
  
  // Close auth modal
  const closeModal = () => {
    setIsModalOpen(false);
  };
  
  // Handle auth completion
  const handleAuthComplete = () => {
    setIsModalOpen(false);
  };
  
  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
  };
  
  return (
    <>
      {isAuthenticated ? (
        // User is logged in - show user menu
        <div className="relative group">
          <button className="flex items-center space-x-2 py-2 px-3 bg-black/30 hover:bg-black/50 rounded-lg border border-white/10 transition-colors">
            <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center text-white">
              {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="text-white max-w-[100px] truncate">{user?.email || 'User'}</span>
          </button>
          
          {/* Dropdown menu */}
          <div className="absolute right-0 mt-2 w-48 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg shadow-lg overflow-hidden transition-all scale-95 opacity-0 invisible group-hover:scale-100 group-hover:opacity-100 group-hover:visible z-50">
            <Link 
              href="/user-profile"
              className="block px-4 py-2 text-white hover:bg-white/10 transition-colors"
            >
              Profile
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-white hover:bg-white/10 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      ) : (
        // User is not logged in - show login button
        <div className="flex space-x-2">
          <Link
            href="/signin"
            className="py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors"
          >
            Sign In
          </Link>
          
          <button
            onClick={openModal}
            className="py-2 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg transition-colors"
          >
            Quick Login
          </button>
        </div>
      )}
      
      {/* Auth Modal */}
      {isModalOpen && (
        <AuthModal 
          onClose={closeModal}
          onAuthComplete={handleAuthComplete}
        />
      )}
    </>
  );
}