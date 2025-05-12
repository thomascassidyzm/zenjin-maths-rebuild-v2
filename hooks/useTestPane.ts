import { useState, useEffect } from 'react';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * Hook for managing the test pane state
 * @returns Control functions and state for the test pane
 */
export default function useTestPane() {
  // Only initialize state on client-side to prevent hydration mismatch
  const [isTestPaneVisible, setIsTestPaneVisible] = useState(false);
  // Track if component is mounted on client side
  const [isMounted, setIsMounted] = useState(false);
  
  // Function to show the test pane
  const showTestPane = () => {
    setIsTestPaneVisible(true);
  };
  
  // Function to hide the test pane
  const hideTestPane = () => {
    setIsTestPaneVisible(false);
  };
  
  // Function to toggle the test pane visibility
  const toggleTestPane = () => {
    setIsTestPaneVisible(prev => !prev);
  };
  
  // Set mounted state and listen for keyboard shortcuts (Alt+T)
  useEffect(() => {
    // Set mounted state when component mounts on client side
    setIsMounted(true);

    // Only add event listeners on client
    if (!isBrowser) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+T to toggle test pane
      if (e.altKey && e.key === 't') {
        toggleTestPane();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return {
    isTestPaneVisible: isMounted && isTestPaneVisible,
    showTestPane,
    hideTestPane,
    toggleTestPane,
    isMounted
  };
}