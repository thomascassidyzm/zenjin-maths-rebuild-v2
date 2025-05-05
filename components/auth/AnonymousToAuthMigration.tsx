import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hasAnonymousData, cleanupAnonymousData } from '../../lib/authUtils';
import { transferAnonymousData } from '../../lib/auth/supabaseClient';

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
      console.log('No anonymous data to migrate');
      setMigrationState('idle');
      return;
    }

    // Start migration process
    const migrateData = async () => {
      try {
        setMigrationState('migrating');
        setStatusMessage('Transferring your progress...');
        
        console.log('Starting migration of anonymous data to authenticated user', user.id);
        
        // Transfer the data using the supabase function
        const success = await transferAnonymousData(user.id);
        
        if (success) {
          setMigrationState('success');
          setStatusMessage('Your progress has been successfully transferred!');
          console.log('Migration successful');
          
          // Clean up any remaining anonymous data
          cleanupAnonymousData();
          
          // Call completion callback
          onComplete?.(true);
        } else {
          setMigrationState('error');
          setStatusMessage('There was an issue transferring your progress.');
          console.error('Migration failed');
          
          // Call error callback
          onError?.({ message: 'Progress transfer failed' });
        }
      } catch (error) {
        console.error('Error during data migration:', error);
        setMigrationState('error');
        setStatusMessage('An error occurred while transferring your progress.');
        
        // Call error callback
        onError?.(error);
      }
    };
    
    // Execute migration
    migrateData();
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