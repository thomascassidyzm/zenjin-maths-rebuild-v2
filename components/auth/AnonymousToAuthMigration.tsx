import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hasAnonymousData, cleanupAnonymousData } from '../../lib/authUtils';
// import { transferAnonymousData } from '../../lib/auth/supabaseClient'; // Removed

interface AnonymousToAuthMigrationProps {
  onComplete?: (success: boolean) => void;
  onError?: (error: any) => void;
  showStatus?: boolean;
}

/**
 * Component that handles migrating anonymous progress data to an authenticated account
 * This should be rendered on pages where users might transition from anonymous to
 * authenticated state, such as login and signup pages.
 */
const AnonymousToAuthMigration: React.FC<AnonymousToAuthMigrationProps> = ({
  onComplete,
  onError,
  showStatus = false
}) => {
  const { user, isAuthenticated } = useAuth();
  const [migrationState, setMigrationState] = useState<'idle' | 'migrating' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Run migration when authenticated user is detected
  useEffect(() => {
    // Only run if we have an authenticated user
    if (!isAuthenticated || !user?.id) return;
    
    // Check if we have anonymous data to migrate
    if (!hasAnonymousData()) {
      console.log('No anonymous data to cleanup.'); // Adjusted log message
      setMigrationState('idle');
      return;
    }

    // Start cleanup process
    const cleanupData = async () => {
      try {
        setMigrationState('migrating'); // Keep 'migrating' state name, but message changes
        setStatusMessage('Cleaning up previous session data...');
        
        console.log('Starting cleanup of anonymous data for authenticated user', user.id);
        
        // Data transfer is now implicit via Zustand store sync on login.
        // This component now only handles cleanup of old localStorage flags/items.
        
        // Directly proceed to cleanup
        cleanupAnonymousData();
        console.log('Anonymous data cleanup successful.');
        
        setMigrationState('success');
        setStatusMessage('Previous session data cleaned up.');
        
        // Call completion callback
        onComplete?.(true);

      } catch (error) {
        console.error('Error during anonymous data cleanup:', error);
        setMigrationState('error');
        setStatusMessage('An error occurred during cleanup.');
        
        // Call error callback
        onError?.(error);
      }
    };
    
    // Execute cleanup
    cleanupData();
  }, [isAuthenticated, user, onComplete, onError]);
  
  // Render status message if showStatus is enabled
  if (showStatus && migrationState !== 'idle') {
    return (
      <div className="migration-status">
        {migrationState === 'migrating' && (
          <p className="text-blue-600">{statusMessage}</p>
        )}
        {migrationState === 'success' && (
          <p className="text-green-600">{statusMessage}</p>
        )}
        {migrationState === 'error' && (
          <p className="text-red-600">{statusMessage}</p>
        )}
      </div>
    );
  }
  
  // Otherwise render nothing
  return null;
};

export default AnonymousToAuthMigration;