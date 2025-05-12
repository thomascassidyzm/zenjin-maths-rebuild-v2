# Zustand Content Loading System

This document describes the new content loading system for Zenjin Maths, which uses Zustand for state management and eliminates the dependency on bundled content.

## Overview

The new system provides a server-first approach to content loading, fetching all content from the server API rather than using bundled content embedded in the app. This change improves maintainability, reduces bundle size, and provides a more consistent experience for all users.

Key benefits:
- Unified approach for all users (anonymous and authenticated)
- Smaller bundle size without embedded content
- Easier content updates through API
- Simplified state management with Zustand
- Improved component reusability

## Architecture

The system consists of several key components:

1. **Zustand Store**: Central state management with methods for fetching and caching stitch content
2. **API Integration**: Server communication layer for fetching stitches
3. **React Hooks**: Custom hooks that simplify content fetching in components
4. **UI Components**: Standardized components with built-in loading and error states

### Component Diagram

```
┌─────────────────────────┐
│                         │
│    ZenjinStore (Zustand)│
│                         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│                         │
│  API Layer (stitchActions) │
│                         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│                         │
│   React Hooks           │
│   (useStitchContent)    │
│                         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│                         │
│   UI Components         │
│   (ZustandDistinctionPlayer) │
│                         │
└─────────────────────────┘
```

## Key Components

### 1. Zustand Store Enhancements

The Zustand store (`zenjinStore.ts`) has been enhanced with new methods for fetching and managing stitch content:

```typescript
interface ZenjinStore {
  // Existing store properties...
  
  // Content Collection actions
  setContentCollection: (collection: ContentCollection) => void;
  updateStitchInCollection: (stitchId: string, updates: Partial<Stitch>) => void;
  fetchStitch: (stitchId: string) => Promise<StitchContent | null>;
  fetchStitchBatch: (stitchIds: string[]) => Promise<Record<string, StitchContent>>;
  addStitchToCollection: (stitch: StitchContent) => void;
  
  // Other actions...
}
```

These new methods allow components to:
- Fetch a single stitch by ID
- Fetch multiple stitches at once
- Add stitches to the store's content collection
- Update existing stitches with new data

### 2. API Integration

The API integration layer (`stitchActions.ts`) provides standardized methods for communicating with the server:

```typescript
// Fetch a batch of stitches from the server
export const fetchStitchBatch = async (stitchIds: string[]): Promise<Record<string, StitchContent>> => {
  // Implementation details...
}

// Fetch a single stitch from the server
export const fetchSingleStitch = async (stitchId: string): Promise<StitchContent | null> => {
  // Implementation details...
}
```

These functions handle API calls to the `/api/content/batch` endpoint, which returns stitch content including questions and metadata.

### 3. React Hooks

Custom hooks simplify content fetching in components:

#### useStitchContent

```typescript
function useStitchContent(stitchId: string): {
  stitch: StitchContent | null;
  loading: boolean;
  error: Error | null;
}
```

This hook:
- Takes a stitch ID as input
- Returns the stitch content, loading state, and any errors
- Automatically fetches content from the API if not in the store
- Caches results in the Zustand store for reuse

#### useBatchStitchContent

```typescript
function useBatchStitchContent(stitchIds: string[]): {
  stitches: Record<string, StitchContent>;
  loading: boolean;
  error: Error | null;
}
```

This hook:
- Takes an array of stitch IDs as input
- Returns all stitches, a loading state, and any errors
- Fetches only the stitches that aren't already in the store
- Caches all results in the Zustand store

### 4. UI Components

#### StitchContentLoader

A standardized component for loading stitch content with built-in loading and error states:

```tsx
<StitchContentLoader stitchId="stitch-T1-001-01">
  {(stitch) => (
    // Render component with stitch content
  )}
</StitchContentLoader>
```

#### ZustandDistinctionPlayer

The new player component that uses Zustand for state management:

```tsx
<ZustandDistinctionPlayer
  stitchId="stitch-T1-001-01"
  tubeNumber={1}
  onComplete={handleComplete}
  questionsPerSession={10}
  sessionTotalPoints={0}
  userId={userInfo?.userId}
/>
```

This component:
- Fetches stitch content from the API using Zustand
- Displays questions with smooth transitions
- Tracks user progress in the Zustand store
- Provides completion callbacks for integration

## Migration Guide

### Migrating from MinimalDistinctionPlayer

To migrate from the old MinimalDistinctionPlayer to the new ZustandDistinctionPlayer:

1. Replace imports:
   ```diff
   - import MinimalDistinctionPlayer from '../components/MinimalDistinctionPlayer';
   + import ZustandDistinctionPlayer from '../components/ZustandDistinctionPlayer';
   ```

2. Update component usage:
   ```diff
   - <MinimalDistinctionPlayer
   -   thread={thread}
   -   tubeData={tubeData}
   -   onComplete={handleComplete}
   - />
   + <ZustandDistinctionPlayer
   +   stitchId={thread.stitches[0].id}
   +   tubeNumber={tubeNumber}
   +   onComplete={handleComplete}
   +   userId={userInfo?.userId}
   + />
   ```

3. Add Zustand store initialization:
   ```tsx
   // Initialize store if needed
   useEffect(() => {
     if (!isInitialized) {
       initializeState({
         // Initial state...
       });
     }
   }, [isInitialized, initializeState]);
   ```

### Migrating from Content Buffer

To migrate from the old content buffer to the new Zustand system:

1. Replace imports:
   ```diff
   - import { offlineFirstContentBuffer } from '../lib/client/offline-first-content-buffer';
   + import { useStitchContent } from '../lib/hooks/useStitchContent';
   ```

2. Replace buffer usage:
   ```diff
   - const stitch = await offlineFirstContentBuffer.getStitch(stitchId);
   + const { stitch, loading, error } = useStitchContent(stitchId);
   ```

3. Remove buffer initialization:
   ```diff
   - offlineFirstContentBuffer.initialize(isAnonymous, user);
   ```

## API Reference

### Zustand Store

```typescript
// Fetch a single stitch
const stitch = await useZenjinStore.getState().fetchStitch('stitch-T1-001-01');

// Fetch multiple stitches
const stitches = await useZenjinStore.getState().fetchStitchBatch(['stitch-T1-001-01', 'stitch-T1-001-02']);

// Add a stitch to the collection
useZenjinStore.getState().addStitchToCollection(stitch);

// Update a stitch in the collection
useZenjinStore.getState().updateStitchInCollection('stitch-T1-001-01', { 
  skipNumber: 5, 
  distractorLevel: 2 
});
```

### React Hooks

```typescript
// Use in a component
function MyComponent({ stitchId }) {
  const { stitch, loading, error } = useStitchContent(stitchId);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!stitch) return <div>Stitch not found</div>;
  
  return (
    <div>
      <h2>{stitch.title}</h2>
      <p>{stitch.content}</p>
      {/* Render questions */}
    </div>
  );
}
```

### UI Components

```tsx
// StitchContentLoader
<StitchContentLoader 
  stitchId="stitch-T1-001-01"
  loadingComponent={<CustomLoading />}
  errorComponent={<CustomError />}
>
  {(stitch) => (
    // Render your component with the stitch content
  )}
</StitchContentLoader>

// ZustandDistinctionPlayer
<ZustandDistinctionPlayer
  stitchId="stitch-T1-001-01"
  tubeNumber={1}
  onComplete={handleComplete}
  onEndSession={handleEndSession}
  questionsPerSession={10}
  sessionTotalPoints={0}
  userId="user-123"
/>
```

## Testing

The new system includes several test pages to verify functionality:

1. `/test-zustand-stitch` - Tests the basic stitch fetching functionality
2. `/test-zustand-player` - Tests the ZustandDistinctionPlayer component
3. `/integrated-player` - Tests the full integration with Zustand store

These pages allow you to:
- Verify stitch fetching from the API
- Test player functionality with different stitches
- Debug state management and persistence

## Future Improvements

1. **Prefetching Strategy**: Implement a smart prefetching strategy to load the next few stitches in advance
2. **Offline Support**: Add service worker integration for offline use
3. **Content Versioning**: Add version tracking to refresh content when updates are available
4. **Caching Strategy**: Implement a more sophisticated caching strategy with TTL (time to live)
5. **Performance Optimization**: Add memoization and request deduplication for high-performance fetching

## Conclusion

The new Zustand content loading system provides a more maintainable, consistent, and efficient approach to content delivery in Zenjin Maths. By eliminating bundled content and standardizing on server-fetched content, we improve the app's flexibility while reducing complexity.

For questions or issues, please contact the development team.