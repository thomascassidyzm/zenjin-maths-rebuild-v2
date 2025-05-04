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

## Notes for Future Development

1. The system currently assumes the first 10 stitches per tube as bundled content
2. The expanded bundled content is stored in `expanded-bundled-content.ts`
3. The feature flags system can be used to toggle offline-first features as needed
4. Anonymous and free users always get bundled content for consistency
5. Premium users can receive personalized content from the API after initial loading
6. Consider adding a mechanism to periodically update the bundled content