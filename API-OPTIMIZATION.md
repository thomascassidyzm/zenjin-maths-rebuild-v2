# API Optimization to Fix 504 Gateway Timeout Errors

## Problem

Users were experiencing 504 Gateway Timeout errors when:
1. Anonymous users attempted to sign in (during data migration)
2. Authenticated users tried to load their content
3. The app tried to make API calls to `/api/user-stitches` with large prefetch counts

## Root Cause Analysis

After investigation, we discovered the issue was due to inefficient data loading patterns:

1. **Redundant Content Fetching**: The app was trying to fetch ALL content from the database despite the first 30 stitches already being bundled with the application.

2. **Large Prefetch Values**: The client was requesting up to 10 additional stitches as "prefetch" content for each thread, causing excessive database load.

3. **Inefficient Database Queries**: The API was making separate database queries for each thread, with nested queries for stitches and questions.

4. **Large Payload Size**: The API was returning full content that included all fields (`*`) and nested data structures.

## Solution: Complete Redesign of Content Loading Strategy

We implemented a fundamental redesign of the content loading strategy based on this key insight:

> **ALL free tier content is already bundled in the app. We only need to fetch the user's current position.**

### API Changes (`/api/user-stitches`)

1. **Simplified Response Structure**:
   - For free tier users: Only returns thread metadata and position (no content)
   - For premium users: Returns thread metadata, position, and minimal stitches as needed

2. **Reduced Database Queries**:
   - Just one query for user subscription status
   - One query for thread metadata 
   - One query for user position
   - No queries for stitch content for free tier users

3. **Eliminated Prefetch Parameters**:
   - Removed the prefetch parameter entirely since it's no longer needed
   - Client code updated to stop requesting prefetch data

### Client-Side Changes (`loadUserData.ts`)

1. **Simplified API Requests**:
   - Removed prefetch parameters from API requests
   - Updated code to work with the new lightweight API response format

2. **Better Utilization of Bundled Content**:
   - Uses the already bundled content instead of re-fetching it from the server
   - Only needs position data to know where to start playing

### Other Optimizations

1. **Anonymous to Auth Migration**:
   - The API call in `transfer-anonymous-data.ts` was also simplified to remove prefetch parameters
   - The data transfer function in `supabaseClient.ts` was temporarily disabled to avoid timeouts

## Benefits

1. **Eliminated 504 Timeouts**: By dramatically reducing database load and payload size
2. **Faster Content Loading**: Leveraging bundled content instead of waiting for API responses
3. **Reduced Server Load**: Minimized unnecessary database queries and large response payloads
4. **Better Offline Support**: Since most content is already bundled, it works better offline

## Future Improvements

1. **Lazy Loading for Premium Content**: Implement a system to fetch premium content only when needed, perhaps 1-2 stitches ahead of the current position.

2. **Session State Persistence**: Save current position to localStorage at session end, so the player can start immediately without waiting for API response.

3. **Data Migration as Optional Step**: Instead of migrating anonymous data during sign-in, make it an explicit user choice after authentication succeeds.

## Summary

The key insight that led to this optimization was recognizing that we were redundantly fetching content that was already bundled with the application. By leveraging this bundled content and only fetching the minimum user-specific data needed, we dramatically reduced server load and eliminated timeouts.