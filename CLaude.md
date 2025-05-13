# Zenjin Maths Project Guide

## Important Notes for Claude
- There is no dev server environment
- All deployments are to Vercel
- Ensure code changes can be tested directly in production

## Project Overview

The Zenjin Maths app is an educational application that uses a Triple Helix learning system with tubes, threads, and stitches to deliver structured content to users. We've implemented a server-first approach using Zustand for state management, ensuring consistent content delivery for all users.

## Server-First Content Approach

The application uses a server-first content approach with Zustand as the single source of truth for all content:

1. **No Bundled Content**: We've eliminated all bundled content dependencies. All content is fetched from the server API.
2. **Zustand as Single Source of Truth**: The Zustand store manages all content and provides consistent access for all components.
3. **StateMachine Integration**: The StateMachine uses the Zustand store for content via a dedicated adapter.
4. **Resilient Design**: Emergency content generation ensures the app functions even during network failures.
5. **Two-Phase Loading**: Content is loaded in two phases - initial vital content first, then complete content in the background.

### Implementation Details

The server-first content approach has these key components:

- **Zustand Store Instance**: A utility for accessing the Zustand store outside React components, critical for StateMachine integration.
- **Zustand Stitch Adapter**: An adapter that bridges the StateMachine with the Zustand store content system.
- **StitchContentLoader Component**: A reusable component that handles loading, error states, and display of stitch content.
- **stitchActions**: API functions for fetching stitch content from the server, with fallbacks for network failures.
- **Emergency Content Generation**: Creates basic content when the server is unreachable, ensuring the app is always usable.

### Data Flow

1. User state (tube/stitch structure) is loaded from the server or localStorage
2. When a stitch's content is needed:
   - React components use hooks like `useStitchContent`
   - Non-React code (like StateMachine) uses the adapter
3. The Zustand store checks its cache for the stitch
   - If found, returns immediately
   - If not found, fetches from the server API, caches, and returns
4. Two-phase loading optimizes performance:
   - Phase 1: Load only the most critical stitches (current and next few)
   - Phase 2: Load the remaining stitches in the background

## Key Files Modified/Created

1. `/lib/store/zenjinStore.ts` - Enhanced with stitch fetching and content management
2. `/lib/store/stitchActions.ts` - API communication layer for fetching stitch content
3. `/lib/hooks/useStitchContent.ts` - Custom hooks for consistent content fetching
4. `/components/ZustandDistinctionPlayer.tsx` - New player component using Zustand for state management
5. `/components/StitchContentLoader.tsx` - Reusable component for loading stitch content
6. `/lib/hooks/useZustandStitchPlayer.tsx` - Hook for integrating player with Zustand store
7. `/pages/test-zustand-stitch.tsx` - Test page for verifying stitch fetching
8. `/pages/test-zustand-player.tsx` - Test page for the ZustandDistinctionPlayer
9. `/pages/integrated-player.tsx` - Demo page showing full integration with the app

## Core Implementation Features

1. **Server-First Approach**: Fetch all content from the server API
2. **Unified Experience**: Consistent content loading for all users
3. **State Management**: Zustand store for centralized state management
4. **React Hooks**: Custom hooks for simplified component integration
5. **UI Components**: Standardized loading and error handling
6. **Efficient Caching**: Content cached in Zustand store for reuse

## Technical Architecture

- The `zenjinStore` manages all state including content collection
- `stitchActions` handles API communication for fetching content
- Custom hooks provide a simplified interface for components
- `useStitchContent` fetches and caches individual stitches
- `useBatchStitchContent` fetches multiple stitches efficiently
- `ZustandDistinctionPlayer` provides the main UI for stitch interaction
- State is persisted in localStorage for all user types
- Authenticated users can also sync state to the server

## Position-Based Model Fix (May 13, 2025)

We fixed the position-based model to correctly preserve positions during server persistence:

1. Modified `loadFromServer` in `zenjinStore.ts` to preserve position keys like "4" and "5"
2. Ensured positions are maintained throughout the save/load cycle
3. Removed dependency on bundled content, following server-first approach
4. Created the `/pages/server-persistence-test.tsx` page to test the fix
5. Added documentation in `/docs/POSITION-BASED-MODEL.md` and `/docs/STITCH-POSITION-FIX.md`

The key solution was elegantly simple:
```typescript
// CRITICAL FIX: PRESERVE POSITIONS BY DIRECTLY COPYING THE TUBE
if (tube.positions && Object.keys(tube.positions).length > 0) {
  // Deep copy the entire tube to preserve all properties, especially positions
  tubeState.tubes[tubeKey] = JSON.parse(JSON.stringify(tube));

  // Skip the rest of the processing for this tube
  return;
}
```

## Zustand Content System (May 12, 2025)

We implemented a completely new content loading system using Zustand that:
1. Fetches all stitch content from the server API
2. Provides a unified experience for all user types
3. Eliminates dependency on bundled content
4. Simplifies state management with Zustand

Key changes:
- Enhanced `zenjinStore.ts` with stitch fetching capabilities
- Created `stitchActions.ts` for API communication
- Developed custom hooks for simplified content fetching
- Implemented `ZustandDistinctionPlayer` component using the new system
- Created comprehensive documentation in `/docs/ZUSTAND-CONTENT-SYSTEM.md`

## Supabase Integration Fixes (May 4, 2025)

1. Fixed Supabase client initialization in multiple files to ensure build success:
   - `/lib/supabase.ts` - Added hardcoded URL fallbacks
   - `/lib/api/auth.ts` - Fixed supabaseAdmin initialization
   - `/lib/supabase/client.ts` - Ensured singleton client pattern works
   - `/lib/supabase/server.ts` - Simplified cookie handling and fixed URL
   - `/lib/supabase/admin.ts` - Added build-time fallback for service key

2. Added missing API module exports for backward compatibility:
   - Added `logError` and `logInfo` exports to `lib/api/logging.ts`
   - Added `formatSuccessResponse` and `formatErrorResponse` to `lib/api/responses.ts`
   - Implemented missing `createAdvancedHandler` function in `lib/api/handlers.ts`

3. Updated `DEPLOY-FIXES.md` to document all changes and provide guidance for deployment

## Testing

Use these test pages to verify the implementation:

1. `/test-zustand-stitch` for testing the new Zustand-based content system:
   - Manual fetch test for individual stitches
   - StitchContentLoader component demonstration
   - Raw useStitchContent hook usage
   - Debugging tools for content loading

2. `/test-zustand-player` for testing the ZustandDistinctionPlayer:
   - Integrated player UI with Zustand store
   - Full gameplay experience with server-fetched content
   - Session completion and scoring
   - Works with different user types (anonymous, authenticated)

3. `/offline-first-test` for testing content buffering:
   - Different user types (anonymous, free, premium)
   - Feature flag status visualization
   - Content buffer statistics
   - Immediate startup across user types

4. `/stitch-completion-test` for testing state persistence:
   - Complete stitches with perfect scores (20/20)
   - Cycle through tubes
   - Track stitch reposition following the Triple Helix pattern
   - Test syncing state to and loading from the server
   - Visualize state changes in a detailed history view

## Anonymous API Call Fix (May 4, 2025)

We eliminated unnecessary API calls to `/api/user-stitches` for anonymous users by:

1. Removing the preload link in `_document.tsx` that was causing a fetch on page load

The existing implementation in playerUtils.ts was already correctly handling anonymous users by:
- Using pre-embedded bundled content without API calls
- Storing data in localStorage for persistence
- Following a true offline-first approach

This simple change ensures we maintain a consistent offline-first experience where anonymous users:
- Never make API calls when using bundled content
- Always use content from localStorage or bundled defaults
- Have a seamless experience, even without network connection

## Anonymous User Migration Fix (May 5, 2025)

We removed unnecessary anonymous user migration logic that was causing 500 errors by:

1. Updating `context/AuthContext.tsx` to stop automatic migration attempts when users sign in
2. Properly marking anonymous users as TTL accounts in the `signInAnonymously` function
3. Deprecating the `transferAnonymousData` function in both AuthContext and supabaseClient
4. Updating `authUtils.ts` to prevent unnecessary API calls to migrate anonymous data

The improved implementation:
- Treats anonymous users as proper TTL accounts that don't need migration
- Prevents unnecessary API calls to the problematic `/api/auth/migrate-anonymous-user` endpoint
- Properly updates authentication state when users sign in
- Maintains a simpler and more reliable authentication flow
- Fixes the "SIGNED_IN" event handler to avoid triggering unnecessary migrations

## Notes for Future Development

1. The system fetches all content from the server API for all user types
2. The content system is fully integrated with Zustand for state management
3. A hybrid approach (ZustandContentProvider) combines the new fetching system with the existing UI
4. All content is cached in the Zustand store for efficient access
5. The `/hybrid-player` page demonstrates the recommended implementation
6. Future improvements could include offline support via service workers

## Important Instructions for Claude

1. ALWAYS discuss any proposed changes with the developer before implementing them
2. DO NOT make extensive code changes without getting step-by-step approval first
3. When suggesting improvements, present a clear plan and wait for feedback before proceeding
4. For complex features, break down the implementation into smaller, reviewable steps
5. Prioritize understanding the existing code patterns before suggesting new approaches