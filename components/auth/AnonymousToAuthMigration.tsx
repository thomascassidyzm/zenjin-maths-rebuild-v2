/**
 * Anonymous to Authenticated User Data Migration Component
 * 
 * Handles the migration of anonymous user data (stored in localStorage)
 * to a newly created authenticated account. This ensures users don't lose
 * their progress when they sign up after starting as an anonymous user.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAnonymousProgressData } from '../../lib/anonymousData';

interface AnonymousToAuthMigrationProps {
  /**
   * Called when migration completes successfully
   */
  onComplete?: (results: any) => void;
  
  /**
   * Called when migration fails
   */
  onError?: (error: Error) => void;
  
  /**
   * Show visual migration state if true
   */
  showStatus?: boolean;
}

/**
 * Component that handles migrating anonymous user data to authenticated account
 */
const AnonymousToAuthMigration: React.FC<AnonymousToAuthMigrationProps> = ({
  onComplete,
  onError,
  showStatus = false
}) => {
  const { user, isAuthenticated } = useAuth();
  const [migrationState, setMigrationState] = useState<'idle' | 'migrating' | 'success' | 'error'>('idle');
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [migrationResults, setMigrationResults] = useState<any>(null);
  
  // Run migration when authenticated user is detected
  useEffect(() => {
    // Only run if we have an authenticated user
    if (!isAuthenticated || !user?.id) return;
    
    // Check if we have anonymous data to migrate
    const anonymousId = localStorage.getItem('anonymousId');
    
    if (!anonymousId) {
      console.log('No anonymous data found, skipping migration');
      return;
    }
    
    // Check if this user was previously anonymous
    const wasAnonymous = Boolean(anonymousId && anonymousId.startsWith('anon-'));
    
    if (!wasAnonymous) {
      console.log('User was not previously anonymous, skipping migration');
      return;
    }
    
    // Run the migration
    (async () => {
      try {
        console.log(`Starting migration of anonymous data for ID ${anonymousId} to user ${user.id}`);
        setMigrationState('migrating');
        
        // Get anonymous progress data from localStorage
        const progressData = getAnonymousProgressData();
        
        if (!progressData) {
          console.log('No progress data found for anonymous user, skipping migration');
          setMigrationState('success');
          return;
        }
        
        // Prepare the data for the API call
        const anonymousData = {
          totalPoints: progressData.totalPoints || 0,
          blinkSpeed: progressData.blinkSpeed || 2.5,
          blinkSpeedTrend: progressData.blinkSpeedTrend || 'steady',
          evolution: progressData.evolution || {
            currentLevel: 'Mind Spark',
            levelNumber: 1,
            progress: 0,
            nextLevel: 'Thought Weaver'
          },
          tubes: {
            // We don't need detailed tube structure for this
            // as the API just needs the basic progress information
            1: {
              threadId: 'thread-A',
              stitches: []
            }
          }
        };
        
        // Call the API to transfer data
        const response = await fetch('/api/transfer-anonymous-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.id,
            anonymousData
          })
        });
        
        // Handle the response
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to transfer anonymous data:', errorText);
          throw new Error(`Migration failed: ${errorText}`);
        }
        
        // Parse the response
        const results = await response.json();
        console.log('Anonymous data migration successful:', results);
        
        // Update state
        setMigrationState('success');
        setMigrationResults(results);
        
        // Call the completion callback
        if (onComplete) {
          onComplete(results);
        }
        
        // Clear anonymous ID to prevent repeated migrations
        localStorage.removeItem('anonymousId');
        
      } catch (error) {
        console.error('Error migrating anonymous data:', error);
        setMigrationState('error');
        setMigrationError(error.message || 'Failed to migrate anonymous data');
        
        // Call the error callback
        if (onError && error instanceof Error) {
          onError(error);
        }
      }
    })();
  }, [isAuthenticated, user, onComplete, onError]);
  
  // If not showing status, render nothing
  if (!showStatus) {
    return null;
  }
  
  // Render migration status if showStatus is true
  return (
    <div className="px-4 py-3 rounded-lg text-sm">
      {migrationState === 'migrating' && (
        <div className="flex items-center text-blue-300">
          <div className="mr-2 animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span>Migrating your anonymous progress...</span>
        </div>
      )}
      
      {migrationState === 'success' && (
        <div className="text-green-300">
          {migrationResults?.recordsTransferred > 0 
            ? `Successfully migrated your progress (${migrationResults.recordsTransferred} records)` 
            : 'Your account is ready to use'}
        </div>
      )}
      
      {migrationState === 'error' && (
        <div className="text-red-300">
          {migrationError || 'Failed to migrate anonymous progress'}
        </div>
      )}
    </div>
  );
};

export default AnonymousToAuthMigration;