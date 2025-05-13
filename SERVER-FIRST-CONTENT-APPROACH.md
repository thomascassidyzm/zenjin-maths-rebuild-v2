# Server-First Content Approach

This document describes the implementation of a server-first content approach for the Zenjin Maths application, eliminating bundled content dependencies and ensuring consistent content delivery across all devices.

## Overview

Rather than bundling content with the application, all stitch content (questions, answers, etc.) is fetched from the server API. This approach provides several benefits:

1. Reduced bundle size for faster initial page loads
2. Consistent content delivery regardless of client version
3. Ability to update content without redeploying the application
4. Better cache management and memory usage

## Implementation Details

### Key Components

1. **Server Stitch Provider** (`/lib/server-stitch-provider.ts`)
   - Core utility for fetching stitches from the server
   - Provides caching for efficient access
   - Includes emergency fallback content for network failures

2. **Server Stitch Loader** (`/lib/triple-helix/server-stitch-loader.js`)
   - StateMachine-compatible loader that fetches from server instead of bundled content
   - Implements the same interface as the original bundled stitch loader
   - Ensures backward compatibility with existing StateMachine logic

3. **Updated StateMachine** (`/lib/triple-helix/StateMachine.js`)
   - Now uses the server-stitch-loader instead of bundled content
   - Asynchronous API for stitch fetching and advancement
   - Maintains the same triple-helix learning algorithm

### How It Works

1. **Initial State Loading**
   - User state (tube/stitch structure) is loaded from the server
   - StateMachine initializes with this state structure
   - Server-stitch-loader fetches content for the active stitch

2. **Two-Phase Content Loading**
   - Phase 1: Load the active stitch and immediate neighbors (10 stitches)
   - Phase 2: Load the full buffer of stitches (up to 50) during idle time

3. **Stitch Advancement**
   - When advancing to a new stitch, it's fetched from server if not in cache
   - StitchLoader fetches content asynchronously to prevent UI blocking
   - Emergency content generation for network failures ensures a seamless experience

### API Integration

Content is fetched from these API endpoints:

1. `/api/content/stitch/[id]` - Fetch a single stitch by ID
2. `/api/content/batch` - Fetch multiple stitches in a single request

Both endpoints handle authentication and access control for premium content.

## Benefits Over Previous Approach

The previous approach bundled all content with the application, causing several issues:

1. **Large Bundle Size**: All content was included in the application bundle, increasing load times
2. **Version Inconsistency**: Content could only be updated with a redeployment
3. **Memory Usage**: All content was loaded into memory, even though only a fraction was used
4. **Content Conflicts**: Different versions could have different content, causing inconsistencies

The server-first approach resolves these issues by:

1. **Loading on Demand**: Only fetching content when needed
2. **Single Source of Truth**: All clients get the same content from the server
3. **Efficient Caching**: Only caching the stitches needed for the current session
4. **Responsive UI**: Two-phase loading ensures the UI remains responsive

## Emergency Content Fallback

To ensure a seamless experience even during network outages, the system includes emergency content generation:

1. If the server is unreachable, emergency content is generated client-side
2. Emergency content is specific to the tube type (number facts, basic operations, problem solving)
3. This ensures users can continue learning even without a network connection

## Usage in Components

Components should use the `getStitch` and `getStitchBatch` functions from the server-stitch-provider:

```typescript
import { getStitch, getStitchBatch } from '../lib/server-stitch-provider';

// Fetch a single stitch
const stitch = await getStitch('stitch-T1-001-01');

// Fetch multiple stitches
const stitches = await getStitchBatch(['stitch-T1-001-01', 'stitch-T1-001-02']);
```

## Backward Compatibility

The server-first approach maintains backward compatibility with existing code by:

1. Exporting an empty `BUNDLED_FULL_CONTENT` constant for compatibility
2. Implementing the same StateMachine interface for stitch management
3. Ensuring the same content structure and format for stitches and questions

This allows for a seamless transition from bundled content to server-first without breaking existing functionality.

## Testing and Deployment

To test the server-first implementation:

1. Use the minimal player page to verify content loading: `/minimal-player`
2. Check console logs for server content fetching messages
3. Verify stitch advancement and question loading works correctly

For deployment:

1. Make sure the API endpoints are properly configured and accessible
2. Deploy both the API and the updated client code
3. Verify content loading in the production environment