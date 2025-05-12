# Zenjin Maths Project Guide

## Project Overview

The Zenjin Maths app is an educational application that uses a Triple Helix learning system with tubes, threads, and stitches to deliver structured content to users. We've implemented an offline-first approach to ensure immediate startup and content availability without network dependency.

## Key Files Modified/Created

1. `/lib/client/offline-first-content-buffer.ts` - The core implementation that preloads all bundled content for immediate access
2. `/components/MinimalDistinctionPlayer.tsx` - Modified to properly use bundled content for questions
3. `/lib/tube-config-integration.js` - Enhanced to use the offline-first content buffer and detect user tiers
4. `/lib/feature-flags.ts` - Updated to ensure consistent experience for anonymous and free users
5. `/lib/expanded-bundled-content.ts` - Contains bundled content for 30 stitches (10 per tube)
6. `/lib/triple-helix/StateMachine.js` - Handles stitch advancement and spaced repetition logic
7. `/lib/load-bundled-stitches.js` - Ensures proper loading of bundled stitches with correct positions
8. `/pages/offline-first-test.tsx` - Test page for verifying the implementation
9. `/pages/simple-offline-test.tsx` - Simplified test page that only uses bundled content

## Core Implementation Features

1. **Immediate Startup**: App starts instantly without loading or waiting screens
2. **Bundled Content**: 10 stitches per tube (30 total) bundled with the application
3. **Complete Question Sets**: Each stitch has 20 questions with 3 distractor levels (1,800 total variations)
4. **Offline First**: All content available without network connection
5. **User Tier Detection**: System detects anonymous/free/premium users and delivers appropriate content
6. **Feature Flags**: Easy to enable/disable offline-first features

## Technical Architecture

- The `offlineFirstContentBuffer` preloads all bundled content at initialization time
- Stitch retrieval prioritizes cached content over network requests
- Bundled content is positioned based on user_state (default positions on first load)
- StateMachine implements spaced repetition algorithm with positions and skip numbers
- Position 0 always has the current stitch, position 1 has the next stitch
- When answering 20/20 correctly, stitch's skip number increases (1→3→5→10→25→100)
- Completed stitches move back in sequence based on their skip number
- Feature flags enforce consistent experience for anonymous and free users

## Stitch Advancement Fix (May 4, 2025)

We implemented a focused fix for stitch advancement that ensures the app correctly:
1. Loads all stitches from bundled content with proper positions
2. Respects user_state for positioning stitches after first session
3. Always has the next stitch available at position 1
4. Follows the existing reordering logic to maintain the spaced repetition system

Key changes:
- Created `load-bundled-stitches.js` utility to ensure all stitches are properly loaded
- Enhanced StateMachine to handle "No next stitch available" error by loading missing stitches
- Fixed tube-config-integration.js to use the bundled stitch loader consistently

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

Use two test pages to verify the implementation:

1. `/offline-first-test` for testing:
   - Different user types (anonymous, free, premium)
   - Feature flag status visualization
   - Content buffer statistics
   - Immediate startup across user types

2. `/simple-offline-test` for verifying content:
   - Browse all bundled content directly
   - View complete content and questions
   - No dependencies on other components
   - Works without network connection

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

## API Payload Fix (May 5, 2025)

We addressed the issue of oversized API payloads that were causing 500 errors by:

1. Disabling unnecessary API calls to `/api/user-state`:
   - Modified `persistStateToServer` function in `lib/playerUtils.ts` to return a successful Promise without making API calls
   - Added clear logging to indicate the function is deprecated in favor of Zustand state management

2. Added server-side circuit breaker:
   - Modified `/pages/api/user-state.ts` to return 200 responses for all POST requests
   - Added documentation indicating this endpoint is deprecated for direct API calls

## Tube State Persistence Fix (May 11, 2025)

We created a diagnostic solution to help track down issues with tube state persistence:

1. Added a detailed state diagnostic page:
   - Created `/pages/debug-tubes.tsx` for viewing all state across storage locations
   - Implemented detailed inspection of tube states, positions, and stitches
   - Added visual tools to compare state differences between storage locations

2. Enhanced state logging:
   - Added `/lib/logging/stateLogger.ts` with utilities for structured state logging
   - Implemented comparative state analysis across different storage locations
   - Added automatic tube state verification and inconsistency detection

3. Added detailed logging to the dashboard:
   - Enhanced the "Continue Learning" button click handler with robust logging
   - Added localized debugging around tube state preservation
   - Implemented pre-navigation state verification

This diagnostic solution helps track down why users sometimes lose their progress when completing a session in a tube (e.g., Tube 2), but upon returning through the dashboard's "Continue Learning" button, are incorrectly sent back to Tube 1.

4. Added interactive test pane for live stitch simulation:
   - Created a floating test panel that works with any existing user state
   - Implemented real-time stitch completion with configurable scoring
   - Added visualization of how perfect scores (20/20) advance stitches
   - Created interactive tube cycling to test the transition behavior
   - Added production-safe simplified debugger that works in deployed environments

Access the diagnostic page at `/debug-tubes` to see full state details and compare values across different storage locations. Click "Show Test Pane" to open the interactive test panel, or press Alt+T as a keyboard shortcut.

The test pane is also available directly in the player by adding `?debug=true` to the URL (e.g., `/minimal-player?debug=true`). This allows you to test stitch completion and tube cycling with the actual user's state while playing, without requiring page reload or losing context.

In production environments, a simplified debugger is automatically used to ensure reliability and prevent React hydration errors. This simplified version shows key information about tube states across different storage locations without the interactive features.

## Notes for Future Development

1. The system currently assumes the first 10 stitches per tube as bundled content
2. The expanded bundled content is stored in `expanded-bundled-content.ts`
3. The feature flags system can be used to toggle offline-first features as needed
4. Anonymous and free users always get bundled content for consistency
5. Premium users can receive personalized content from the API after initial loading
6. Consider adding a mechanism to periodically update the bundled content

## Important Instructions for Claude

1. ALWAYS discuss any proposed changes with the developer before implementing them
2. DO NOT make extensive code changes without getting step-by-step approval first
3. When suggesting improvements, present a clear plan and wait for feedback before proceeding
4. For complex features, break down the implementation into smaller, reviewable steps
5. Prioritize understanding the existing code patterns before suggesting new approaches