# Zenjin Maths Project Guide

## Important Notes for Claude
- There is no dev server environment
- All deployments are to Vercel
- Ensure code changes can be tested directly in production
- Remember to read this file at the start of each conversation

## Project Overview

The Zenjin Maths app is an educational application that uses a Triple Helix learning system with tubes, threads, and stitches to deliver structured content to users. We've implemented a server-first approach using Zustand for state management, ensuring consistent content delivery for all users.

## Warm-Up Mode Implementation (May 15, 2025)

We've implemented a simplified warm-up mode feature to address race conditions in content loading:

1. **Warm-Up Questions**: Shows engaging warm-up questions while the main content loads
2. **Transition Animation**: Provides a smooth transition from warm-up to personalized content
3. **Eliminated Fallback Questions**: Replaced error-prone fallback question logic with the warm-up approach
4. **Simple Implementation**: Used a straightforward, self-contained approach with no dependencies

The implementation includes:
- `/components/SimpleWarmUpMode.tsx` - Standalone component with embedded questions
- `/components/SimpleWarmUpTransition.tsx` - Simple transition animation component
- Enhanced `PlayerWithLoader.tsx` with warm-up mode support

Key improvements in our latest update:
- **Embedded Questions**: Contains simple math questions directly in the component
- **No External Dependencies**: Completely self-contained with no JSON file loading
- **Skip Loading Screen**: Warm-up mode starts immediately without showing loading screen
- **Transparent Background**: Allows bubble animations to be visible behind player
- **Bypass Zustand**: Simple implementation with no store dependencies
- **Smaller Code Footprint**: Significantly reduced code complexity

This approach ensures users have immediate engagement with relevant content rather than seeing errors or loading screens, while completely eliminating the race condition issues previously encountered. The simplified implementation provides all the benefits without the complexity of the previous approach.

## MinimalDistinctionPlayer Integration (May 14, 2025)

We've created documentation and example pages to demonstrate how to properly integrate the `MinimalDistinctionPlayer` with our loading screen solution:

1. Created a detailed integration guide at `/docs/LOADING-SCREEN-INTEGRATION.md` with:
   - Comprehensive examples of different integration patterns
   - Explanation of how `PlayerWithLoader` and `LoadingScreen` interact
   - Detailed API documentation for all component props
   - Troubleshooting guidance for common issues

2. Implemented a demonstration page at `/pages/minimal-player-with-loader.tsx` that shows:
   - Proper integration of `PlayerWithLoader` with `MinimalDistinctionPlayer`
   - Content loading using the Zustand store
   - Handling of both authenticated and anonymous users
   - Detailed diagnostics for monitoring the loading process

3. Created a client-side component at `/components/MinimalPlayerWithLoaderContent.tsx` with:
   - Store initialization and error handling
   - Content buffer filling
   - Proper integration with the authentication system
   - Interactive diagnostics panel for debugging

This implementation ensures that `MinimalDistinctionPlayer` correctly works with our loading screen system, preventing race conditions where the player tries to render before content is fully loaded.

## Clean Start Player Implementation (May 14, 2025)

We implemented a robust testing environment with the Clean Start Player that addresses race conditions, localStorage interference, and SSR issues:

1. Created a clean testing environment at `/pages/clean-start-player.jsx` with:
   - LocalStorage management controls
   - Manual testing of loading screen
   - Detailed diagnostics panel
   - Client-side only rendering with dynamic imports

2. Enhanced the PlayerWithLoader component with improved content loading:
   - Multiple loading strategies with verification that questions exist
   - Detailed logging with timestamps for debugging
   - Proper timing coordination with minimum display time
   - Error handling with user-friendly messages

3. Improved the LoadingScreen component:
   - Added more loading messages for a better user experience
   - Ensured minimum display time is properly enforced
   - Added optional debug overlay for testing
   - Fixed timing issues with proper useEffect cleanup

The Clean Start Player ensures:
1. A completely fresh testing environment (no localStorage interference)
2. Proper content loading before player rendering
3. Consistent user experience with appropriate loading screens
4. Detailed diagnostics for troubleshooting

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

## Loading Screen Implementation (May 14, 2025)

We implemented a welcome/loading screen with z-index management to address race conditions in content loading:

1. Created a z-index management system in `/styles/zindex.css` for consistent layering throughout the app
2. Enhanced the `LoadingScreen.tsx` component with proper z-index classes and positioning
3. Improved `PlayerWithLoader.tsx` to coordinate content loading with UI rendering
4. Created a test page at `/pages/test-loading-screen.tsx` to demonstrate the loading screen
5. Updated `globals.css` to import the new z-index management system

Key features of the loading screen implementation:
- Displays a welcome message and instructions while content loads
- Shows animated math symbols and cycling loading messages
- Ensures a minimum display time to prevent flickering
- Uses proper z-index management for layering
- Handles both anonymous and authenticated user states

The z-index management system establishes a clear hierarchy:
```css
:root {
  /* Base layers */
  --z-background: -10;
  --z-default: 1;
  --z-content: 10;
  
  /* Interactive components */
  --z-buttons: 20;
  --z-navigation: 30;
  --z-dropdown: 40;
  --z-tooltips: 50;
  
  /* Overlays */
  --z-overlays: 100;
  --z-modals: 200;
  --z-notifications: 300;
  
  /* Loading screens */
  --z-loading-screen: 500;
  
  /* Critical UI elements that should always be on top */
  --z-critical: 1000;
}
```

This ensures that the loading screen always appears on top of other elements while content is loading.

## Session Metrics SSR Fix (May 14, 2025)

We fixed the "useState is not defined" build error in the test-session-metrics page by implementing:

1. **Client-Side Only Rendering**:
   - Created `/pages/client-only-session-metrics.jsx` with dynamic imports and `ssr: false`
   - Implemented `/components/ClientOnlySessionMetrics.jsx` for client-side testing
   - Fixed `test-session-metrics.jsx` with proper client-side detection

2. **Loading Indicators**:
   - Added static placeholders for server-side rendering
   - Implemented loading components for dynamic imports

3. **Proper React Hooks Usage**:
   - Ensured useState and other hooks are only used on the client side
   - Used proper dependency arrays to avoid unnecessary re-renders

The implementation ensures that:
1. The build process completes successfully without SSR errors
2. The session metrics functionality is properly tested
3. All React hooks are used according to the rules of hooks

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
10. `/components/LoadingScreen.tsx` - Enhanced with z-index classes and proper positioning
11. `/components/PlayerWithLoader.tsx` - Improved to coordinate content loading with UI
12. `/styles/zindex.css` - New file for z-index management system
13. `/pages/test-loading-screen.tsx` - New test page for the loading screen
14. `/pages/clean-start-player.jsx` - Clean testing environment for the player
15. `/components/CleanStartPlayerContent.jsx` - Client-side testing UI with localStorage management
16. `/pages/client-only-session-metrics.jsx` - Client-side only session metrics test
17. `/components/ClientOnlySessionMetrics.jsx` - Client-side session metrics component
18. `/docs/LOADING-SCREEN-INTEGRATION.md` - Comprehensive guide for integrating with MinimalDistinctionPlayer
19. `/pages/minimal-player-with-loader.tsx` - Example page demonstrating MinimalDistinctionPlayer integration
20. `/components/MinimalPlayerWithLoaderContent.tsx` - Client-side component for MinimalDistinctionPlayer integration

## Core Implementation Features

1. **Server-First Approach**: Fetch all content from the server API
2. **Unified Experience**: Consistent content loading for all users
3. **State Management**: Zustand store for centralized state management
4. **React Hooks**: Custom hooks for simplified component integration
5. **UI Components**: Standardized loading and error handling
6. **Efficient Caching**: Content cached in Zustand store for reuse
7. **Loading Screen**: Welcome screen and loading indicator to handle content loading race conditions
8. **Z-Index Management**: Centralized system for managing z-index values across the app
9. **Clean Testing Environment**: Tools for testing with a fresh state
10. **Client-Side Only Rendering**: Avoiding SSR issues with proper dynamic imports

## Technical Architecture

- The `zenjinStore` manages all state including content collection
- `stitchActions` handles API communication for fetching content
- Custom hooks provide a simplified interface for components
- `useStitchContent` fetches and caches individual stitches
- `useBatchStitchContent` fetches multiple stitches efficiently
- `ZustandDistinctionPlayer` provides the main UI for stitch interaction
- State is persisted in localStorage for all user types
- Authenticated users can also sync state to the server
- The `LoadingScreen` and `PlayerWithLoader` ensure content is fully loaded before rendering the player
- The Clean Start Player provides a robust testing environment

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

1. `/clean-start-player` for testing with a completely clean environment:
   - LocalStorage management controls
   - Manual testing of loading screen and player
   - Detailed diagnostics for troubleshooting

2. `/client-only-session-metrics` for testing session metrics without SSR issues:
   - Client-side only rendering to avoid useState errors
   - Complete mock player with session recording
   - Works with the updated session metrics system

3. `/test-zustand-stitch` for testing the new Zustand-based content system:
   - Manual fetch test for individual stitches
   - StitchContentLoader component demonstration
   - Raw useStitchContent hook usage
   - Debugging tools for content loading

4. `/test-zustand-player` for testing the ZustandDistinctionPlayer:
   - Integrated player UI with Zustand store
   - Full gameplay experience with server-fetched content
   - Session completion and scoring
   - Works with different user types (anonymous, authenticated)

5. `/offline-first-test` for testing content buffering:
   - Different user types (anonymous, free, premium)
   - Feature flag status visualization
   - Content buffer statistics
   - Immediate startup across user types

6. `/stitch-completion-test` for testing state persistence:
   - Complete stitches with perfect scores (20/20)
   - Cycle through tubes
   - Track stitch reposition following the Triple Helix pattern
   - Test syncing state to and loading from the server
   - Visualize state changes in a detailed history view

7. `/test-loading-screen` for testing the loading screen implementation:
   - Direct LoadingScreen component demonstration
   - PlayerWithLoader integration test
   - Tests both anonymous and authenticated user states
   - Verifies proper z-index layering for UI elements

8. `/minimal-player-with-loader` for testing integration with MinimalDistinctionPlayer:
   - Shows how to properly integrate PlayerWithLoader with MinimalDistinctionPlayer
   - Demonstrates content loading with the Zustand store
   - Includes detailed diagnostics for debugging
   - Handles both authenticated and anonymous user states

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
7. The z-index management system should be extended to cover all UI components
8. Consider adding loading progress indicators to the loading screen
9. Extend the clean start player approach to other testing scenarios

## Direct Player Access Implementation (May 16, 2025)

We've simplified the application flow by removing the authentication choice screen and directly launching the player:

1. **Automatic Anonymous Login**: Modified `/pages/index.tsx` to:
   - Skip the "Sign In" vs "Try Without Signing Up" choice entirely
   - Automatically create an anonymous account via `signInAnonymously()`
   - Directly redirect to the `/minimal-player` page
   - Show a simple loading screen during this process

2. **Key Changes**:
   - Removed unnecessary user decision point that created friction
   - Ensured both anonymous and authenticated users are redirected to the player
   - Maintained the same content loading logic in the player
   - Preserved the ability to authenticate later from within the player

3. **Benefits**:
   - Faster time-to-content for all users
   - Reduced friction in the user onboarding process
   - Simplified user experience with fewer clicks required
   - Maintained all functionality with improved user flow

This approach provides a more streamlined experience where users immediately begin interacting with the player, rather than making authentication decisions up front.

## Player Component Showcase (May 16, 2025)

We've created a comprehensive player showcase page that addresses the component duplication issue:

1. **Centralized Comparison**: Created `/pages/player-showcase.tsx` to:
   - Display all player component variants in one place
   - Use consistent sample content for direct comparison
   - Show key features and capabilities of each player
   - Allow both grid and side-by-side comparison views

2. **Components Included**:
   - `TubeStitchPlayer`: Position-based player with minimal dependencies
   - `MinimalDistinctionPlayer`: Streamlined player with warm-up mode support
   - `ZustandDistinctionPlayer`: Store-integrated player with server-first fetching
   - `DistinctionPlayer`: Original thread-based player with animations
   - `PlayerComponent`: Classic player with subscription awareness
   - `PlayerComponentZustand`: Global state management variant
   - `PlayerWithLoader`: Loading-aware player with error handling
   - `MinimalDistinctionPlayerWithUpgrade`: Subscription prompt integration
   - `SequentialPlayer`: Sequential question flow player

3. **Usage**:
   - Access via `/player-showcase` URL path in production
   - Compare appearance, behavior, and features side-by-side
   - View individual players in full-size mode for detailed testing
   - Use as a reference when implementing new features

This showcase serves as both a practical tool for component selection and a living documentation of our player components, helping prevent further duplication by making all variants visible and comparable.

## Cross-Session Context Management (May 16, 2025)

We've identified a critical architectural concern related to how Claude Code sessions interact with the codebase:

1. **Context Loss Between Sessions**: Each Claude Code session operates in isolation without knowledge of previous sessions, leading to:
   - Duplication of components with similar functionality
   - Loss of architectural context and design decisions
   - Multiple implementations of the same feature with different approaches

2. **Example of Impact**: The player component has been reimplemented multiple times:
   - We've identified at least 11 different player components in the codebase
   - Each implementation has slightly different behavior and styling
   - This leads to inconsistent user experience and maintenance challenges

3. **Mitigation Strategies**:
   - Maintain this CLAUDE.md file with detailed architectural decisions
   - Use extensive comments in code to explain component relationships
   - Create a component inventory in the documentation
   - Before creating new components, search for and extend existing ones
   - Document component hierarchy and relationships

4. **Practical Implementation**:
   - Always begin with a thorough search for existing components
   - Use the `PlayerWithLoader` as the primary player wrapper
   - Extend existing components rather than creating new ones
   - Update this document when adding significant features
   - Use the Player Component Showcase to understand existing options

## Important Instructions for Claude

1. ALWAYS discuss any proposed changes with the developer before implementing them
2. DO NOT make extensive code changes without getting step-by-step approval first
3. When suggesting improvements, present a clear plan and wait for feedback before proceeding
4. For complex features, break down the implementation into smaller, reviewable steps
5. Prioritize understanding the existing code patterns before suggesting new approaches
6. SEARCH FOR EXISTING COMPONENTS before creating new ones to avoid duplication