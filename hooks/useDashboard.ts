import { useState, useEffect } from 'react';

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
      const response = await fetch(`/api/dashboard?t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate', // Ensure fresh data
          'Pragma': 'no-cache'
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

  // One-time fetch on component mount only - no automatic refreshing
  useEffect(() => {
    refreshDashboard();
    
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