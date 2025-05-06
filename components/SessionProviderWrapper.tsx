import React, { useEffect } from 'react';
import { SessionProvider } from '../lib/context/SessionContext';
import SessionErrorHandler from '../lib/errorHandler';

interface SessionProviderWrapperProps {
  children: React.ReactNode;
}

/**
 * SessionProviderWrapper
 * 
 * This component wraps the main application with the SessionProvider context
 * and handles initialization of error handling and session recovery.
 * 
 * Use this at the top level of your application to provide session management.
 */
const SessionProviderWrapper: React.FC<SessionProviderWrapperProps> = ({ children }) => {
  useEffect(() => {
    // Check for pending errors on application start
    const pendingErrors = SessionErrorHandler.checkForPendingErrors();
    
    if (pendingErrors.length > 0) {
      console.log(`Found ${pendingErrors.length} pending error logs to process`);
      
      // We could send these to an error tracking service here
      // or take recovery actions based on the error types
    }
    
    // Check for any recovery sessions
    if (typeof window !== 'undefined') {
      try {
        // Look for recovery keys in localStorage
        const recoveryKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('session_recovery_')
        );
        
        if (recoveryKeys.length > 0) {
          console.log(`Found ${recoveryKeys.length} session recovery entries`);
          
          // Process each recovery entry
          recoveryKeys.forEach(key => {
            try {
              const recoveryData = JSON.parse(localStorage.getItem(key) || '{}');
              console.log('Recovery data found:', recoveryData);
              
              // TODO: Implement recovery logic here if needed
              // For now, we just log it for debugging
              
              // Remove the recovery entry after processing
              localStorage.removeItem(key);
            } catch (e) {
              console.error(`Failed to process recovery data for key ${key}:`, e);
            }
          });
        }
      } catch (e) {
        console.error('Error checking for recovery sessions:', e);
      }
    }
  }, []);

  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
};

export default SessionProviderWrapper;