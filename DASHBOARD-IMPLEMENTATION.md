# Zenjin Maths Dashboard Implementation Guide

This technical document details the implementation approach for the Zenjin Maths dashboard system and outlines critical best practices and implementation guidelines.

## Data Flow Architecture

```
┌───────────────┐     ┌─────────────────┐     ┌───────────────┐
│ Session Data  │ ──▶ │ API Layer       │ ──▶ │ Database      │
└───────────────┘     └─────────────────┘     └───────────────┘
        │                     │                       │
        ▼                     ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌───────────────┐
│ Session UI    │ ◀── │ Calculation     │ ◀── │ Aggregation   │
└───────────────┘     │ & Processing    │     │ & Analytics   │
        │             └─────────────────┘     └───────────────┘
        ▼                     ▲                       │
┌───────────────┐             │                       │
│ Dashboard UI  │ ◀───────────┴───────────────────────┘
└───────────────┘
```

## Critical Implementation Guidelines

### 1. Offline-First Architecture

The Zenjin Maths application adheres to an offline-first approach which MUST be maintained:

- During gameplay, progress data is saved to `localStorage` for ALL users (both anonymous and authenticated)
- For authenticated users, server persistence ONLY happens when:
  - The user explicitly clicks the "Finish" button which calls `endSession()` in `playerUtils.ts`
  - Server persistence is never automatic during normal play

⚠️ **IMPORTANT**: Never implement automatic server synchronization during gameplay. It breaks the offline-first design pattern.

### 2. Dashboard Navigation

The dashboard navigation must follow these principles:

- Simple, straightforward navigation without complex data operations
- Dashboard button in player interface should use direct navigation:

```jsx
// CORRECT IMPLEMENTATION - Simple, reliable navigation
<button
  onClick={() => router.push('/dashboard')}
  className="..."
>
  Dashboard
</button>
```

⚠️ **DANGER**: Do not implement complex pre-navigation operations, especially ones that:
- Create recursive rendering loops
- Set up automatic refresh intervals
- Make multiple state updates that depend on each other
- Poll the API repeatedly

```jsx
// DANGEROUS PATTERN - Can crash the browser!
<button
  onClick={() => {
    // Save state with a mechanism that modifies component state
    persistStateToServer().then(() => {
      // Set up automatic refresh - THIS WILL CRASH THE BROWSER
      setInterval(() => {
        fetchDashboardData().then(data => {
          // State updates that trigger re-renders
          setDashboardData(data);
        });
      }, 1000);
    });
    
    // Navigate to dashboard
    router.push('/dashboard');
  }}
>
  Dashboard
</button>
```

### 3. Safe Data Fetching Patterns

When fetching dashboard data:

- Use a single fetch on initial component mount
- Do not implement automatic refresh intervals
- Use explicit user actions for data refreshing (e.g., a refresh button)
- Handle loading and error states properly

```jsx
// CORRECT IMPLEMENTATION - Safe data fetching
function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Safe - only runs once on mount
  useEffect(() => {
    fetchDashboardData()
      .then(result => setData(result))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, []);
  
  // Safe - explicit user action
  const refreshData = () => {
    setLoading(true);
    fetchDashboardData()
      .then(result => setData(result))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  };
  
  return (
    <div>
      {/* Display UI */}
      <button onClick={refreshData}>Refresh</button>
    </div>
  );
}
```

## API Endpoints

### Session Data

```typescript
// POST /api/sessions
// Records completed session data
interface SessionRequest {
  userId: string;
  threadId: string;
  stitchId: string;
  questionResults: Array<{
    questionId: string;
    correct: boolean;
    timeToAnswer: number;
    firstTimeCorrect: boolean;
  }>;
  sessionDuration: number;
}

interface SessionResponse {
  sessionId: string;
  basePoints: number;
  multiplier: number;
  multiplierType: string;
  totalPoints: number;
  blinkSpeed: number;
}
```

### Dashboard Data

```typescript
// GET /api/dashboard
// Retrieves user dashboard data
interface DashboardResponse {
  userId: string;
  totalPoints: number;
  blinkSpeed: number;
  blinkSpeedTrend: "improving" | "steady" | "declining";
  evolution: {
    currentLevel: string;
    levelNumber: number;
    progress: number;
    nextLevel: string | null;
  };
  globalStanding: {
    percentile: number;
    date: string;
  };
  recentSessions: Array<{
    date: string;
    points: number;
    blinkSpeed: number;
  }>;
}
```

## Common Dashboard Components

### SessionSummary Component

The SessionSummary component shows points and performance metrics after session completion:

- Displays correctness ratio and blink speed
- Shows animated points calculation with multiplier
- Should NOT make database calls or fetch additional data
- Should use props passed from parent, not fetch its own data

### EvolutionBadge Component

This component displays the user's current evolution level and progress:

- Shows level name, number, and progress to next level
- Purely presentational - does not fetch data
- Must not implement animations that are CPU-intensive

### BlinkSpeedDisplay Component

Component that displays the user's average response time:

- Shows formatted blink speed with trend indicator
- Visual effects for exceptional speeds
- Should handle all speed values without errors
- Effects should be lightweight and not cause performance issues

## Performance Considerations

1. **Minimize State Updates**
   - Use functional state updates to prevent race conditions
   - Batch related state updates where possible
   - Avoid nested or cascading state updates

2. **Prevent Memory Leaks**
   - Always clean up intervals in useEffect
   - Properly cancel fetch requests on component unmount
   ```jsx
   useEffect(() => {
     const controller = new AbortController();
     
     fetch('/api/dashboard', { signal: controller.signal })
       .then(/* ... */)
       .catch(/* ... */);
     
     return () => controller.abort(); // Clean up on unmount
   }, []);
   ```

3. **Optimize Rendering**
   - Use React.memo for pure components
   - Implement useMemo for expensive calculations
   - Use useCallback for functions passed to child components

4. **Responsiveness**
   - Handle loading states to prevent UI freezes
   - Implement optimistic UI updates where appropriate
   - Always provide fallback content during data loading

## Implementation Warnings

### High-Risk Patterns to Avoid

1. **Recursive Render Patterns**
   - State updates that trigger effects which update state again
   - Components that re-render parents which then re-render children

2. **Polling Without Safeguards**
   - Intervals that don't respect component lifecycle
   - Missing cleanup for repeated API calls
   ```jsx
   // DANGEROUS - no cleanup
   useEffect(() => {
     const intervalId = setInterval(() => {
       fetchData(); // Will continue even after unmount
     }, 1000);
     // Missing return () => clearInterval(intervalId);
   }, []);
   ```

3. **Dashboard-specific Dangers**
   - Auto-refresh mechanisms without user initiation
   - Complex animation loops that block the main thread
   - Calculations that grow in complexity with user data size

### Testing Dashboard Changes

Before committing dashboard changes:

1. Test with throttled CPU and network to catch performance issues
2. Verify all cleanup functions work properly (no memory leaks)
3. Test browser back/forward navigation works as expected
4. Validate that localStorage and server data are properly synchronized

## Summary

The dashboard implementation follows the app's offline-first architecture where:

1. **During gameplay**: 
   - All progress data is stored in localStorage
   - No automatic server persistence

2. **On explicit finish**:
   - Data is sent to the server via `/api/end-session` endpoint
   - Only performed when user clicks "Finish" button

3. **Dashboard display**:
   - Always shows server-persisted data
   - May not reflect current gameplay until explicitly saved

4. **Navigation**:
   - Keep simple, direct, and lightweight
   - Avoid complex operations during navigation