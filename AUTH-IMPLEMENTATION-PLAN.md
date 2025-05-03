# Authentication Implementation Plan

This document outlines the specific components that need to be modified to implement a clean, first-principles authentication flow.

## Components to Modify

### 1. `/context/AuthContext.tsx`

The auth context needs to be simplified to provide a single source of truth:

```tsx
// Clean implementation - single source of truth
const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    user: null,
    isAuthenticated: false,
    loading: true,
    error: null
  });

  // Function to navigate to player home after successful auth
  const navigateAfterAuth = useCallback((userData) => {
    // Load essential data before redirecting
    loadUserData(userData.id).then(() => {
      // Now navigate to player start page (not dashboard)
      window.location.href = '/';
    });
  }, []);

  // Check session once on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // User is authenticated
          setAuthState({
            user: session.user,
            isAuthenticated: true,
            loading: false,
            error: null
          });
        } else {
          // No authenticated session
          setAuthState({
            user: null,
            isAuthenticated: false,
            loading: false,
            error: null
          });
        }
      } catch (error) {
        // Handle error state
        setAuthState({
          user: null,
          isAuthenticated: false,
          loading: false,
          error: 'Failed to verify authentication'
        });
      }
    }
    
    checkSession();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Update auth state
          setAuthState({
            user: session.user,
            isAuthenticated: true,
            loading: false,
            error: null
          });
          
          // Navigate to player home after sign in
          navigateAfterAuth(session.user);
        } else if (event === 'SIGNED_OUT') {
          // Clear auth state
          setAuthState({
            user: null,
            isAuthenticated: false,
            loading: false,
            error: null
          });
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, [navigateAfterAuth]);

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 2. `/lib/auth/supabaseClient.ts`

Add a clean signIn function that properly handles success and navigates to player start:

```tsx
export async function signInWithEmail(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      return { success: false, error };
    }
    
    // Success - auth state change will trigger navigation
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}
```

### 3. `/pages/index.tsx`

The home page (player start) should be auth-aware and load data if needed:

```tsx
export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const [userDataLoaded, setUserDataLoaded] = useState(false);
  const [tubeData, setTubeData] = useState(null);
  
  // Load tube configuration and user progress
  useEffect(() => {
    if (isAuthenticated && user && !userDataLoaded) {
      // Load tube config and user progress
      Promise.all([
        fetch('/api/tube-configuration').then(res => res.json()),
        fetch('/api/user-progress').then(res => res.json())
      ])
      .then(([tubeConfig, progressData]) => {
        setTubeData(tubeConfig);
        setUserDataLoaded(true);
      })
      .catch(error => {
        console.error('Failed to load user data:', error);
      });
    }
  }, [isAuthenticated, user, userDataLoaded]);
  
  // Show loading state
  if (loading) {
    return <LoadingScreen />;
  }
  
  // Show authenticated player start
  if (isAuthenticated) {
    if (!userDataLoaded) {
      return <LoadingUserData />;
    }
    
    return (
      <PlayerStartPage 
        tubeData={tubeData}
        user={user}
      />
    );
  }
  
  // Show sign-in option for unauthenticated users
  return <UnauthenticatedHome />;
}
```

### 4. `/pages/signin.tsx`

Clean up the sign-in page to focus solely on authentication:

```tsx
export default function SignIn() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  
  // Redirect to home if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, loading, router]);
  
  // Show loading while checking auth
  if (loading) {
    return <LoadingScreen />;
  }
  
  // Show sign-in form if not authenticated
  if (!isAuthenticated) {
    return <SignInForm />;
  }
  
  // Fallback while redirecting
  return <RedirectingToHome />;
}
```

### 5. `/pages/dashboard.tsx`

Simplify dashboard to properly handle auth state:

```tsx
export default function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const router = useRouter();
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/signin');
    }
  }, [isAuthenticated, loading, router]);
  
  // Load dashboard data once auth is confirmed
  useEffect(() => {
    if (isAuthenticated && user) {
      setDataLoading(true);
      
      fetch('/api/dashboard')
        .then(res => res.json())
        .then(data => {
          setDashboardData(data);
          setDataLoading(false);
        })
        .catch(error => {
          console.error('Failed to load dashboard data:', error);
          setDataLoading(false);
        });
    }
  }, [isAuthenticated, user]);
  
  // Loading state while checking auth
  if (loading) {
    return <LoadingScreen message="Verifying authentication..." />;
  }
  
  // Not authenticated - should redirect
  if (!isAuthenticated) {
    return <RedirectingToSignIn />;
  }
  
  // Loading dashboard data
  if (dataLoading) {
    return <LoadingScreen message="Loading dashboard data..." />;
  }
  
  // Show dashboard with data
  return <DashboardContent data={dashboardData} />;
}
```

### 6. Create `/lib/loadUserData.ts`

A utility function to centralize user data loading:

```tsx
export async function loadUserData(userId) {
  try {
    // Load tube configurations
    const tubeConfigRes = await fetch('/api/tube-configuration');
    if (!tubeConfigRes.ok) throw new Error('Failed to load tube configuration');
    const tubeConfig = await tubeConfigRes.json();
    
    // Load active stitches for each tube
    const activeStitchesRes = await fetch('/api/user-stitches?prefetch=10');
    if (!activeStitchesRes.ok) throw new Error('Failed to load active stitches');
    const activeStitches = await activeStitchesRes.json();
    
    // Load progress data
    const progressRes = await fetch('/api/user-progress');
    if (!progressRes.ok) throw new Error('Failed to load user progress');
    const progress = await progressRes.json();
    
    // Store in localStorage for offline use
    localStorage.setItem('zenjin_tube_config', JSON.stringify(tubeConfig));
    localStorage.setItem('zenjin_active_stitches', JSON.stringify(activeStitches));
    localStorage.setItem('zenjin_user_progress', JSON.stringify(progress));
    
    return { tubeConfig, activeStitches, progress };
  } catch (error) {
    console.error('Error loading user data:', error);
    throw error;
  }
}
```

### 7. Modify `/pages/_app.tsx`

Ensure the app properly wraps everything in the auth provider:

```tsx
export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
```

## Component Interaction Flow

The correct flow should be:

1. User enters credentials on `/signin` page
2. `supabaseClient.ts` authenticates with Supabase
3. `AuthContext.tsx` detects SIGNED_IN event
4. `loadUserData.ts` loads essential data
5. Navigate to `/` (player start page)
6. Player start page shows "Start Learning" and "Dashboard" options
7. Navigation is direct, without complex state management

### Authentication Verification Sequence

```
User Sign In
  │
  ▼
Auth Context detects sign-in
  │
  ▼
Load essential user data
  │
  ▼
Navigate to player start page
  │
  ┌──────────────┴───────────────┐
  ▼                              ▼
Start Learning                Dashboard
(tube data already loaded)    (data loaded on demand)
```

## Key Improvements

This implementation will address the current issues by:

1. Providing a single source of truth for auth state
2. Ensuring data is loaded before navigation
3. Using proper loading states throughout
4. Following a clean, predictable flow
5. Eliminating race conditions between auth and data loading
6. Removing the need for complex workarounds

## Implementation Sequence

To implement these changes in a safe manner:

1. First modify the AuthContext for cleaner state management
2. Implement the loadUserData utility function
3. Update sign-in flow
4. Modify player start page and dashboard
5. Test the complete flow end-to-end