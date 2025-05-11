import { useState, useEffect } from 'react';
import { checkForPendingStateBackup, syncPendingStateBackupToServer, clearPendingStateBackup } from '../lib/stateReconciliation';

interface EvolutionData {
  currentLevel: string;
  levelNumber: number;
  progress: number;
  nextLevel: string | null;
}

interface GlobalStandingData {
  percentile: number | null;
  date: string | null;
  message: string;
}

interface SessionData {
  id: string;
  timestamp: string;
  total_points: number;
  correct_answers: number;
  total_questions: number;
  blink_speed: number | null;
}

// Interface for the fallback content structure
interface FallbackContent {
  stitches: any[];
  threads: any[];
  suggestedNext: any;
  isFallback: boolean;
}

interface DashboardData {
  userId: string;
  totalPoints: number;
  blinkSpeed: number;
  blinkSpeedTrend: 'improving' | 'steady' | 'declining';
  evolution: EvolutionData;
  globalStanding: GlobalStandingData;
  recentSessions: SessionData[];
  loading: boolean;
  error: string | null;
  dataSource?: 'database' | 'cache' | 'emergency-fallback'; // Where the data came from
  message?: string; // Optional message about data source
  fallbackContent?: FallbackContent | null; // Bundled content for fallback learning
}

/**
 * Custom hook to fetch and manage dashboard data
 */
export function useDashboard(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    userId: '',
    totalPoints: 0,
    blinkSpeed: 0,
    blinkSpeedTrend: 'steady',
    evolution: {
      currentLevel: 'Mind Spark',
      levelNumber: 1,
      progress: 0,
      nextLevel: 'Thought Weaver'
    },
    globalStanding: {
      percentile: null,
      date: null,
      message: 'Calculating your global standing...'
    },
    recentSessions: [],
    loading: true,
    error: null,
    dataSource: undefined,
    message: 'Loading dashboard data...',
    fallbackContent: null
  });

  // Add a manual refresh function to force reload dashboard data
  const refreshDashboard = async () => {
    console.log('useDashboard: Starting dashboard data refresh');
    setData(prev => ({ ...prev, loading: true }));
    
    try {
      // Add a timestamp to prevent caching
      const timestamp = Date.now();
      // Get various potential auth tokens/IDs from localStorage - crucial for auth
      let authHeaders = {};
      
      // Only access localStorage on the client
      if (typeof window !== 'undefined') {
        // Try to get auth token from multiple possible localStorage keys
        const accessToken = 
          localStorage.getItem('sb-ggwoupzaruiaaliylxga-auth-token') || // New Supabase format
          localStorage.getItem('supabase.auth.token') ||                // Older format
          localStorage.getItem('authToken');                            // Custom format
        
        if (accessToken) {
          try {
            // Parse the JWT if it's in JSON format
            const tokenData = JSON.parse(accessToken);
            if (tokenData?.access_token) {
              authHeaders['Authorization'] = `Bearer ${tokenData.access_token}`;
            }
          } catch (e) {
            // If parsing fails, it might be a direct token string
            authHeaders['Authorization'] = `Bearer ${accessToken}`;
          }
        }
        
        // Add various user IDs as fallbacks
        const userId = localStorage.getItem('zenjin_user_id') || 
                       localStorage.getItem('userId') || 
                       localStorage.getItem('user_id');
        
        if (userId) {
          authHeaders['x-user-id'] = userId;
        }
        
        // Add anonymous ID as final fallback
        const anonymousId = localStorage.getItem('anonymousId') || 
                            localStorage.getItem('zenjin_anonymous_id');
        
        if (anonymousId) {
          authHeaders['x-anonymous-id'] = anonymousId;
        }
      }
      
      const response = await fetch(`/api/dashboard?t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate', // Ensure fresh data
          'Pragma': 'no-cache',
          ...authHeaders
        },
        credentials: 'include' // Important: include cookies for auth
      });
      
      // Log response to debug auth issues
      console.log('useDashboard: API response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 403) {
          console.error('useDashboard: Authentication error (403)');
          throw new Error('Authentication error - please sign in again');
        }
        throw new Error('Failed to fetch dashboard data');
      }
      
      const dashboardData = await response.json();
      
      setData({
        userId: dashboardData.userId,
        totalPoints: dashboardData.totalPoints,
        blinkSpeed: dashboardData.blinkSpeed,
        blinkSpeedTrend: dashboardData.blinkSpeedTrend,
        evolution: dashboardData.evolution,
        globalStanding: dashboardData.globalStanding,
        recentSessions: dashboardData.recentSessions,
        loading: false,
        error: null,
        dataSource: dashboardData.dataSource,
        message: dashboardData.message,
        fallbackContent: dashboardData.fallbackContent || null
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      
      // Provide a fallback display even if API fails
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        totalPoints: prev.totalPoints || 0, // Preserve any existing data
        blinkSpeed: prev.blinkSpeed || 0,
        evolution: {
          currentLevel: 'Mind Spark',
          levelNumber: 1,
          progress: 0,
          nextLevel: 'Thought Weaver'
        },
        dataSource: 'emergency-fallback',
        message: 'Could not connect to server - showing emergency fallback data only',
        fallbackContent: null // This will be set by a retry
      }));
    }
  };

  // Check for pending state backup and sync if needed
  useEffect(() => {
    // Function to handle state backup reconciliation
    const handleStateBackup = async () => {
      // Check if we have a pending state backup
      const { hasPendingBackup, userId } = checkForPendingStateBackup();

      if (hasPendingBackup && userId) {
        console.log('Found pending state backup - attempting to sync to server');

        // Try to sync the backup to the server
        const syncSuccess = await syncPendingStateBackupToServer(userId);

        if (syncSuccess) {
          console.log('Successfully synced pending state backup to server');
        } else {
          console.warn('Failed to sync pending state backup - keeping backup in localStorage');
          // Don't clear the backup markers so we can try again later
        }
      } else {
        // No pending backup or missing userId, clear any stale markers
        clearPendingStateBackup();
      }

      // Refresh dashboard data after backup reconciliation
      refreshDashboard();
    };

    // Run the state backup handler
    handleStateBackup();

    // No interval setup - dashboard data should only refresh when the user explicitly requests it
    // This follows the offline-first architecture and prevents potential performance issues
  }, []);
  
  // Add refresh function to returned data
  const returnData = {
    ...data,
    refresh: refreshDashboard
  };

  return returnData as DashboardData & { refresh: () => Promise<void> };
}

export default useDashboard;