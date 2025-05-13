# Unified Content Loading Implementation

## Overview

This document outlines the unified content loading approach that treats all users (anonymous and authenticated) the same way. The key principle is to minimize initial payload size by loading only what's immediately needed, then progressively load more content as needed.

## Implementation Plan

### Phase 1: Initial Load - Active Stitch Only

1. User logs in (anonymous users get assigned an ID)
2. System initializes user_state if not exists
3. Fetch ONLY the active tube's active stitch (approx. 3KB)
4. Launch player immediately with this minimal content

### Phase 2: First Buffer Fill - Essential Content

1. After player launches, immediately begin fetching the first 10 stitches for each tube
2. This provides enough content for a typical session (30 stitches total)
3. Store this content in the content buffer for immediate access

### Phase 3: Complete Buffer Fill - Offline Support

1. When the user is idle or after Phase 2 completes, fetch up to 50 stitches per tube
2. This provides comprehensive offline support
3. Uses lower priority loading to avoid interfering with the user experience

## Implementation Details

### User State Initialization

Both anonymous and authenticated users will get the same basic state structure:

```typescript
{
  userId: string,
  tubeState: {
    activeTube: 1,
    tubes: {
      1: {
        threadId: "thread-T1-001",
        currentStitchId: "stitch-T1-001-01",
        positions: {
          0: { stitchId: "stitch-T1-001-01", skipNumber: 1, ... }
          // Other positions will be populated as content is loaded
        }
      },
      // Tubes 2 and 3 similarly structured
    }
  }
}
```

### Content Loading Functions

1. `fetchActiveStitch(userId, tubeNum, stitchId)` - Highest priority fetch
2. `fetchInitialStitches(userId, tubeNum, count=10)` - Medium priority fetch
3. `fetchExtendedStitches(userId, tubeNum, count=50)` - Low priority fetch

### Progressive Loading Manager

The content buffer will be enhanced with a progressive loading manager that:

1. Tracks which content has been loaded
2. Prioritizes fetches based on user activity
3. Manages the loading queue to optimize bandwidth usage
4. Provides status information to the UI for progress indicators

### Database Schema Updates

To support this approach, we need to ensure:

1. The user_state table exists and has the right schema
2. Indexes are optimized for quick retrieval of specific stitches
3. The content tables are structured for efficient retrieval of content by tube and position

## Advantages

1. **Unified User Experience**: Both anonymous and authenticated users have the same experience
2. **Fast Initial Load**: Only loading the active stitch (~3KB) enables immediate startup
3. **Progressive Enhancement**: Content quality improves the longer the user stays
4. **Offline Support**: Eventually loads enough content for comprehensive offline use
5. **Bandwidth Efficiency**: Only loads what the user is likely to need

## Key Files to Modify

1. `/lib/initialization/initialize-user-state.ts` - Unified state initialization
2. `/lib/client/content-buffer.ts` - Progressive loading implementation
3. `/components/MinimalDistinctionPlayer.tsx` - Update to work with minimal initial content
4. `/lib/store/zenjinStore.ts` - Modified to prioritize fetching active content first
5. `/pages/api/content/stitch/[id].ts` - Optimized endpoint for single stitch retrieval

## Implementation Steps

1. Create or update the user_state table initialization
2. Implement the fetch priority system in the content buffer
3. Modify the player component to work with minimal initial content
4. Update the store to handle progressive content loading
5. Test with both anonymous and authenticated users