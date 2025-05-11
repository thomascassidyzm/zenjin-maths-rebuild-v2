import { useState, useEffect } from 'react';

/**
 * Hook for managing the test pane state
 * @returns Control functions and state for the test pane
 */
export default function useTestPane() {
  const [isTestPaneVisible, setIsTestPaneVisible] = useState(false);
  
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
  
  // Listen for keyboard shortcuts (Alt+T)
  useEffect(() => {
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
    isTestPaneVisible,
    showTestPane,
    hideTestPane,
    toggleTestPane
  };
}