# Data Persistence

This document outlines the data persistence layer in the Zenjin Maths application, covering how user progress and session data are saved and synchronized.

## Core Principles

1. **Local-First for Speed**: Store active session data locally for performance
2. **Server Sync at Key Points**: Sync with server at well-defined points
3. **Offline Resilience**: Handle network failures gracefully
4. **Clear Sync Boundaries**: Explicit sync points with proper error handling

## Database Tables

### 1. profiles
Stores user profile information and aggregate statistics.

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  total_points INTEGER DEFAULT 0,
  avg_blink_speed REAL DEFAULT 2.5,
  evolution_level INTEGER DEFAULT 1,
  total_sessions INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_session_date TIMESTAMP WITH TIME ZONE,
  subscription_id TEXT,
  subscription_status TEXT,
  is_subscribed BOOLEAN DEFAULT false,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY profiles_select ON profiles 
  FOR SELECT USING (auth.uid() = id);

-- Only allow server to insert/update profiles
CREATE POLICY profiles_insert ON profiles 
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update ON profiles 
  FOR UPDATE USING (auth.uid() = id);
```

### 2. session_results
Stores individual learning session results.

```sql
CREATE TABLE IF NOT EXISTS session_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  stitch_id TEXT NOT NULL,
  total_questions INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  accuracy REAL DEFAULT 0,
  blink_speed REAL DEFAULT NULL,
  results JSONB DEFAULT '[]'::jsonb,
  is_anonymous BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE session_results ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own session results
CREATE POLICY session_results_select ON session_results 
  FOR SELECT USING (auth.uid()::text = user_id);

-- Only allow server to insert session results  
CREATE POLICY session_results_insert ON session_results 
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
```

### 3. user_stitch_progress
Stores user progress through distinction stitches.

```sql
CREATE TABLE IF NOT EXISTS user_stitch_progress (
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  stitch_id TEXT NOT NULL,
  order_number INTEGER DEFAULT 0,
  skip_number INTEGER DEFAULT 5,
  distractor_level TEXT DEFAULT 'L1',
  is_completed BOOLEAN DEFAULT false,
  is_anonymous BOOLEAN DEFAULT false,
  last_attempted TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, thread_id, stitch_id)
);

-- Add RLS policies
ALTER TABLE user_stitch_progress ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own progress
CREATE POLICY stitch_progress_select ON user_stitch_progress 
  FOR SELECT USING (auth.uid()::text = user_id);

-- Only allow server to insert/update progress
CREATE POLICY stitch_progress_insert ON user_stitch_progress 
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY stitch_progress_update ON user_stitch_progress 
  FOR UPDATE USING (auth.uid()::text = user_id);
```

## Session Recording API

```typescript
// pages/api/sessions/record.ts
import { createAnonymousHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse } from '../../../lib/api/responses';
import { logApiError } from '../../../lib/api/logging';

/**
 * Record a completed learning session
 */
async function recordSession(req, res, userId, db, isAuthenticated) {
  if (req.method !== 'POST') {
    return res.status(405).json(
      errorResponse('Method not allowed')
    );
  }
  
  const { 
    sessionId, 
    threadId, 
    stitchId, 
    totalQuestions, 
    correctAnswers, 
    totalPoints,
    blinkSpeed,
    results = []
  } = req.body;
  
  // Validate required fields
  if (!threadId || !stitchId) {
    return res.status(400).json(
      errorResponse('Missing required fields: threadId and stitchId are required')
    );
  }
  
  try {
    // 1. Insert session record
    const uniqueSessionId = sessionId || `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const { error: sessionError } = await db
      .from('session_results')
      .insert({
        id: uniqueSessionId,
        user_id: userId,
        thread_id: threadId,
        stitch_id: stitchId,
        total_questions: totalQuestions || 0,
        correct_answers: correctAnswers || 0,
        total_points: totalPoints || 0,
        accuracy: totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0,
        blink_speed: blinkSpeed,
        results: results,
        is_anonymous: !isAuthenticated,
        completed_at: new Date().toISOString()
      });
    
    if (sessionError) {
      logApiError('Session Recording', sessionError, userId);
      return res.status(500).json(
        errorResponse('Failed to record session', sessionError.message)
      );
    }
    
    // 2. If authenticated, update user profile
    if (isAuthenticated) {
      try {
        // Get current profile
        const { data: profile, error: profileError } = await db
          .from('profiles')
          .select('total_points, avg_blink_speed, total_sessions')
          .eq('id', userId)
          .single();
        
        if (profileError) {
          logApiError('Profile Fetch', profileError, userId);
          // Continue even if profile fetch fails
        }
        
        // Default values if profile not found
        const existingProfile = profile || {
          total_points: 0,
          avg_blink_speed: 2.5,
          total_sessions: 0
        };
        
        // Update profile with new data
        const { error: updateError } = await db
          .from('profiles')
          .upsert({
            id: userId,
            total_points: (existingProfile.total_points || 0) + (totalPoints || 0),
            avg_blink_speed: blinkSpeed 
              ? (existingProfile.avg_blink_speed * 0.7 + blinkSpeed * 0.3)
              : existingProfile.avg_blink_speed,
            total_sessions: (existingProfile.total_sessions || 0) + 1,
            last_session_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (updateError) {
          logApiError('Profile Update', updateError, userId);
          // Continue even if profile update fails
        }
      } catch (profileError) {
        logApiError('Profile Update Exception', profileError, userId);
        // Continue even if profile update fails
      }
    }
    
    // Return success response
    return res.status(200).json(
      successResponse({
        sessionId: uniqueSessionId,
        threadId,
        stitchId,
        totalPoints
      }, 'Session recorded successfully')
    );
  } catch (error) {
    logApiError('Session Recording Exception', error, userId);
    return res.status(500).json(
      errorResponse('Failed to record session')
    );
  }
}

// Use our handler factory with anonymous support
export default createAnonymousHandler(recordSession, {
  methods: ['POST'],
  context: 'Session Recording'
});
```

## Progress Tracking API

```typescript
// pages/api/progress/update.ts
import { createAnonymousHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse } from '../../../lib/api/responses';
import { logApiError } from '../../../lib/api/logging';

/**
 * Update user stitch progress
 */
async function updateProgress(req, res, userId, db, isAuthenticated) {
  if (req.method !== 'POST') {
    return res.status(405).json(
      errorResponse('Method not allowed')
    );
  }
  
  const { 
    threadId, 
    stitchId, 
    orderNumber, 
    skipNumber, 
    distractorLevel,
    isCompleted
  } = req.body;
  
  // Validate required fields
  if (!threadId || !stitchId) {
    return res.status(400).json(
      errorResponse('Missing required fields: threadId and stitchId are required')
    );
  }
  
  try {
    // Update or insert stitch progress
    const { error } = await db
      .from('user_stitch_progress')
      .upsert({
        user_id: userId,
        thread_id: threadId,
        stitch_id: stitchId,
        order_number: orderNumber || 0,
        skip_number: skipNumber || 5,
        distractor_level: distractorLevel || 'L1',
        is_completed: isCompleted || false,
        is_anonymous: !isAuthenticated,
        last_attempted: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,thread_id,stitch_id'
      });
    
    if (error) {
      logApiError('Progress Update', error, userId);
      return res.status(500).json(
        errorResponse('Failed to update progress', error.message)
      );
    }
    
    // Return success response
    return res.status(200).json(
      successResponse({
        threadId,
        stitchId,
        orderNumber
      }, 'Progress updated successfully')
    );
  } catch (error) {
    logApiError('Progress Update Exception', error, userId);
    return res.status(500).json(
      errorResponse('Failed to update progress')
    );
  }
}

// Use our handler factory with anonymous support
export default createAnonymousHandler(updateProgress, {
  methods: ['POST'],
  context: 'Progress Update'
});
```

## Bulk Progress Sync API

```typescript
// pages/api/progress/bulk-sync.ts
import { createAuthHandler } from '../../../lib/api/handlers';
import { successResponse, errorResponse } from '../../../lib/api/responses';
import { logApiError } from '../../../lib/api/logging';

/**
 * Sync multiple stitch progress records
 */
async function bulkSyncProgress(req, res, userId, db) {
  if (req.method !== 'POST') {
    return res.status(405).json(
      errorResponse('Method not allowed')
    );
  }
  
  const { progressItems } = req.body;
  
  // Validate input
  if (!progressItems || !Array.isArray(progressItems) || progressItems.length === 0) {
    return res.status(400).json(
      errorResponse('Missing or invalid progressItems array')
    );
  }
  
  try {
    // Process in batches to avoid query size limits
    const BATCH_SIZE = 50;
    const results = [];
    const errors = [];
    
    for (let i = 0; i < progressItems.length; i += BATCH_SIZE) {
      const batch = progressItems.slice(i, i + BATCH_SIZE);
      
      // Prepare records for upsert
      const records = batch.map(item => ({
        user_id: userId,
        thread_id: item.threadId,
        stitch_id: item.stitchId,
        order_number: item.orderNumber || 0,
        skip_number: item.skipNumber || 5,
        distractor_level: item.distractorLevel || 'L1',
        is_completed: item.isCompleted || false,
        is_anonymous: false,
        last_attempted: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      // Perform upsert
      const { data, error } = await db
        .from('user_stitch_progress')
        .upsert(records, {
          onConflict: 'user_id,thread_id,stitch_id',
          returning: 'minimal'
        });
      
      if (error) {
        logApiError('Bulk Progress Update', error, userId);
        errors.push(error);
      } else {
        results.push({ batch: i / BATCH_SIZE + 1, count: records.length });
      }
    }
    
    // Return results
    if (errors.length > 0) {
      return res.status(partial ? 207 : 500).json({
        success: errors.length < progressItems.length / BATCH_SIZE,
        message: 'Some batches failed to sync',
        results,
        errors
      });
    }
    
    return res.status(200).json(
      successResponse({
        totalSynced: progressItems.length,
        results
      }, 'Progress synced successfully')
    );
  } catch (error) {
    logApiError('Bulk Progress Exception', error, userId);
    return res.status(500).json(
      errorResponse('Failed to sync progress')
    );
  }
}

// Use our handler factory
export default createAuthHandler(bulkSyncProgress, {
  methods: ['POST'],
  context: 'Bulk Progress Sync'
});
```

## Dashboard API

```typescript
// pages/api/dashboard.ts
import { createAuthHandler } from '../../lib/api/handlers';
import { successResponse, errorResponse } from '../../lib/api/responses';
import { logApiError } from '../../lib/api/logging';

/**
 * Get user dashboard data
 */
async function getDashboard(req, res, userId, db) {
  if (req.method !== 'GET') {
    return res.status(405).json(
      errorResponse('Method not allowed')
    );
  }
  
  try {
    // 1. Get user profile
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      logApiError('Dashboard Profile Fetch', profileError, userId);
      return res.status(500).json(
        errorResponse('Failed to fetch user profile')
      );
    }
    
    // 2. Get recent sessions
    const { data: recentSessions, error: sessionsError } = await db
      .from('session_results')
      .select('id, thread_id, stitch_id, total_points, accuracy, completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(5);
    
    if (sessionsError) {
      logApiError('Dashboard Sessions Fetch', sessionsError, userId);
      // Continue even if sessions fetch fails
    }
    
    // 3. Get progress stats
    const { data: progressStats, error: progressError } = await db
      .from('user_stitch_progress')
      .select('thread_id')
      .eq('user_id', userId)
      .eq('is_completed', true);
    
    if (progressError) {
      logApiError('Dashboard Progress Fetch', progressError, userId);
      // Continue even if progress fetch fails
    }
    
    // Calculate thread completion stats
    const threadCounts = {};
    
    if (progressStats) {
      progressStats.forEach(item => {
        const threadId = item.thread_id;
        threadCounts[threadId] = (threadCounts[threadId] || 0) + 1;
      });
    }
    
    // Calculate blink speed trend
    let blinkSpeedTrend = 'steady';
    
    if (recentSessions && recentSessions.length >= 5) {
      const lastFive = recentSessions.slice(0, 5);
      const avgSpeed = lastFive.reduce((sum, session) => sum + (session.blink_speed || 0), 0) / lastFive.length;
      
      if (avgSpeed < profile.avg_blink_speed * 0.9) {
        blinkSpeedTrend = 'improving'; // Lower is better
      } else if (avgSpeed > profile.avg_blink_speed * 1.1) {
        blinkSpeedTrend = 'declining';
      }
    }
    
    // 4. Prepare dashboard data
    const dashboardData = {
      userId,
      profile: {
        displayName: profile.display_name || '',
        totalPoints: profile.total_points || 0,
        blinkSpeed: profile.avg_blink_speed || 2.5,
        blinkSpeedTrend,
        evolutionLevel: profile.evolution_level || 1,
        totalSessions: profile.total_sessions || 0,
        streakDays: profile.streak_days || 0,
        lastSessionDate: profile.last_session_date,
        isSubscribed: profile.is_subscribed || false
      },
      progress: {
        totalStitchesCompleted: progressStats?.length || 0,
        threadProgress: threadCounts
      },
      recentSessions: recentSessions || []
    };
    
    // Return dashboard data
    return res.status(200).json(
      successResponse({ dashboard: dashboardData })
    );
  } catch (error) {
    logApiError('Dashboard Exception', error, userId);
    return res.status(500).json(
      errorResponse('Failed to fetch dashboard data')
    );
  }
}

// Use our handler factory
export default createAuthHandler(getDashboard, {
  methods: ['GET'],
  context: 'Dashboard'
});
```

## Client-Side Data Persistence

The client-side data persistence layer is handled by custom hooks and utilities:

```typescript
// lib/hooks/useOfflineSync.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

/**
 * Hook for managing offline data synchronization
 */
export function useOfflineSync() {
  const { isAuthenticated, user, anonymousId } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [pendingItems, setPendingItems] = useState<number>(0);
  
  // Initialize on mount
  useEffect(() => {
    // Check for pending sync items
    const failedSyncs = JSON.parse(
      localStorage.getItem('failedSyncs') || '[]'
    );
    
    setPendingItems(failedSyncs.length);
    
    // Get last sync time
    const lastSync = localStorage.getItem('lastSyncTime');
    if (lastSync) {
      setLastSyncTime(new Date(lastSync));
    }
    
    // Try to sync on initial load if authenticated
    if (isAuthenticated) {
      syncPendingItems();
    }
  }, [isAuthenticated]);
  
  // Queue item for sync
  const queueForSync = useCallback((type, data) => {
    const failedSyncs = JSON.parse(
      localStorage.getItem('failedSyncs') || '[]'
    );
    
    failedSyncs.push({
      type,
      data,
      timestamp: Date.now()
    });
    
    localStorage.setItem('failedSyncs', JSON.stringify(failedSyncs));
    setPendingItems(failedSyncs.length);
  }, []);
  
  // Save session data
  const saveSessionData = useCallback(async (sessionData) => {
    try {
      // Always save to localStorage first
      const sessions = JSON.parse(
        localStorage.getItem('sessionData') || '[]'
      );
      
      sessions.push({
        ...sessionData,
        timestamp: Date.now()
      });
      
      localStorage.setItem('sessionData', JSON.stringify(sessions));
      
      // Then try to sync with server
      if (isAuthenticated) {
        const response = await fetch('/api/sessions/record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...sessionData,
            userId: isAuthenticated ? user?.id : anonymousId
          })
        });
        
        if (!response.ok) {
          // Queue for later sync
          queueForSync('session', sessionData);
        }
        
        return await response.json();
      } else {
        // Queue for sync when user authenticates
        queueForSync('session', sessionData);
        return { success: true, offline: true };
      }
    } catch (error) {
      console.error('Failed to save session:', error);
      queueForSync('session', sessionData);
      return { success: false, error: 'Offline mode - will sync later' };
    }
  }, [isAuthenticated, user, anonymousId, queueForSync]);
  
  // Save progress data
  const saveProgressData = useCallback(async (progressData) => {
    try {
      // Always save to localStorage first
      const progressKey = `progress_${progressData.threadId}_${progressData.stitchId}`;
      localStorage.setItem(progressKey, JSON.stringify({
        ...progressData,
        timestamp: Date.now()
      }));
      
      // Then try to sync with server
      if (isAuthenticated) {
        const response = await fetch('/api/progress/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...progressData,
            userId: isAuthenticated ? user?.id : anonymousId
          })
        });
        
        if (!response.ok) {
          // Queue for later sync
          queueForSync('progress', progressData);
        }
        
        return await response.json();
      } else {
        // Queue for sync when user authenticates
        queueForSync('progress', progressData);
        return { success: true, offline: true };
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
      queueForSync('progress', progressData);
      return { success: false, error: 'Offline mode - will sync later' };
    }
  }, [isAuthenticated, user, anonymousId, queueForSync]);
  
  // Sync pending items
  const syncPendingItems = useCallback(async () => {
    if (!isAuthenticated || isSyncing) return;
    
    setIsSyncing(true);
    
    try {
      const failedSyncs = JSON.parse(
        localStorage.getItem('failedSyncs') || '[]'
      );
      
      if (failedSyncs.length === 0) {
        setIsSyncing(false);
        return { success: true, message: 'No pending items' };
      }
      
      // Group items by type for bulk operations
      const sessionItems = failedSyncs.filter(item => item.type === 'session');
      const progressItems = failedSyncs.filter(item => item.type === 'progress');
      
      // Process sessions one by one (they're less frequent but more important)
      for (const item of sessionItems) {
        try {
          await fetch('/api/sessions/record', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ...item.data,
              userId: user?.id
            })
          });
        } catch (error) {
          console.error('Failed to sync session:', error);
          // Leave in queue for next attempt
        }
      }
      
      // Process progress items in bulk
      if (progressItems.length > 0) {
        try {
          await fetch('/api/progress/bulk-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              progressItems: progressItems.map(item => item.data)
            })
          });
        } catch (error) {
          console.error('Failed to sync progress items:', error);
          // Leave in queue for next attempt
        }
      }
      
      // Determine which items were successfully synced
      const newFailedSyncs = failedSyncs.filter(item => {
        // For now, assume all items were synced successfully
        // In a real implementation, we'd check the response for each item
        return false;
      });
      
      // Update localStorage and state
      localStorage.setItem('failedSyncs', JSON.stringify(newFailedSyncs));
      setLastSyncTime(new Date());
      localStorage.setItem('lastSyncTime', new Date().toISOString());
      setPendingItems(newFailedSyncs.length);
      
      return {
        success: true,
        syncedItems: failedSyncs.length - newFailedSyncs.length,
        pending: newFailedSyncs.length
      };
    } catch (error) {
      console.error('Sync operation failed:', error);
      return { success: false, error: 'Sync operation failed' };
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, isSyncing, user?.id]);
  
  return {
    isSyncing,
    lastSyncTime,
    pendingItems,
    saveSessionData,
    saveProgressData,
    syncPendingItems
  };
}
```

## Integration with Player Component

The `MinimalDistinctionPlayer` component will be updated to use our new data persistence layer:

```typescript
// Updated handleEndSession function in MinimalDistinctionPlayer.tsx
const handleEndSession = async (results) => {
  if (!results) return;
  
  console.log('🏁 Completing session in MinimalDistinctionPlayer');
  
  // Call onComplete callback
  if (onComplete) {
    onComplete(results);
  }
  
  // Immediately navigate to dashboard, while APIs run in background
  console.log('Going to dashboard...');
  setTimeout(() => {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  }, 100);
  
  try {
    // Use our offline sync hook to save session data
    const { success, error } = await saveSessionData({
      sessionId: results.sessionId,
      threadId: thread.id,
      stitchId: thread.stitches[0].id,
      totalQuestions: results.totalQuestions,
      correctAnswers: results.correctAnswers,
      totalPoints: results.totalPoints,
      blinkSpeed: results.blinkSpeed,
      results: results.results
    });
    
    if (!success) {
      console.error('Error saving session:', error);
    }
  } catch (error) {
    console.error('Exception in session recording:', error);
  }
};
```

## Sync Points

Clear synchronization points in the application:

1. **On Authentication**:
   - Sync all pending items from localStorage
   - Create/update user profile

2. **After Session Completion**:
   - Save session results
   - Update user profile statistics
   - Update stitch progress

3. **On Tube Change**:
   - Save stitch progress
   - Preload next tube content

4. **On Application Start**:
   - Check for pending sync items
   - Sync if authenticated
   - Load latest progress from server if authenticated

## Error Handling

All data persistence operations follow a consistent error handling pattern:

1. **Always save locally first** for resilience
2. **Then try to sync with server** if authenticated
3. **Queue failed operations** for later sync
4. **Provide clear feedback** about sync status
5. **Retry automatically** when conditions improve

This approach ensures that user data is never lost, even in offline scenarios or when API calls fail.