import React, { useState, useEffect, useRef } from 'react';
import AuthBox from './AuthBox';

type AuthModalProps = {
  isOpen?: boolean;
  onClose: () => void;
  onAuthComplete?: () => void;
  initialMode?: 'signin' | 'signup';
};

/**
 * Authentication Modal
 * 
 * Displays the AuthBox component in a modal dialog.
 * Handles animations and backdrop clicks.
 */
const AuthModal = ({ isOpen = true, onClose, onAuthComplete, initialMode = 'signin' }: AuthModalProps) => {
  const [isVisible, setIsVisible] = useState(isOpen);
  
  // Skip rendering if not open
  if (!isOpen) return null;
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Set up entrance animation and respond to isOpen changes
  useEffect(() => {
    // If the modal is opened, start animation after component mounts
    if (isOpen) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      
      return () => clearTimeout(timer);
    } else {
      // If the modal is closed externally, trigger the close animation
      setIsVisible(false);
    }
  }, [isOpen]);
  
  // Set up keyboard event handlers
  useEffect(() => {
    // Add event listener for escape key
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }
    
    // Clean up
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen]);
  
  // Handle modal close
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300); // Match the transition duration
  };
  
  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };
  
  // Handle auth completion
  const handleAuthComplete = () => {
    handleClose();
    onAuthComplete?.();
  };
  
  return (
    <div 
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
    >
      <div 
        ref={modalRef}
        className={`max-w-md w-full transition-all duration-300 ${
          isVisible ? 'translate-y-0 scale-100' : 'translate-y-10 scale-95'
        }`}
      >
        <AuthBox 
          onAuthComplete={handleAuthComplete} 
          onClose={handleClose}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default AuthModal;