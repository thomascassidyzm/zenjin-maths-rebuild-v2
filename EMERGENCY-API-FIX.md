# Emergency API Fix for t.data is undefined Error

## Issue Description

When transitioning from anonymous to authenticated user, users were experiencing the following error:

```
Error Loading Content: t.data is undefined
```

This error occurred in the Triple Helix player when trying to access the `data` property of the API response from `/api/user-stitches` endpoint.

## Root Cause

The emergency version of the `/api/user-stitches.ts` API endpoint was correctly structured but had some issues with the data provided for tube cycling:

1. **Missing Content for Tubes 2 and 3**: The original implementation had empty stitch arrays for tubes 2 and 3, which caused issues during tube rotation:
   ```javascript
   {
     thread_id: 'thread-T2-001',
     tube_number: 2,
     stitches: [], // Empty array - no content
     orderMap: []
   }
   ```

2. **Inconsistent Error Response Structure**: The emergency fallback response in the catch block had a proper structure, but had no content for tubes 2 and 3.

The error occurred during tube rotation when the player tried to access content for the next tube, but found an empty array of stitches.

## Fix Implementation

The fix adds proper emergency content to all three tubes, both in the main response and in the fallback error response:

1. **Added Content to All Tubes**: Every tube now has a valid stitch with questions:
   ```javascript
   {
     thread_id: 'thread-T2-001',
     tube_number: 2,
     stitches: [
       {
         id: 'stitch-T2-001-01',
         thread_id: 'thread-T2-001',
         content: 'Emergency content for Tube 2',
         description: 'First stitch in tube 2',
         order_number: 0,
         skip_number: 3,
         distractor_level: 'L1',
         questions: [/* ... */]
       }
     ],
     orderMap: [{ stitch_id: 'stitch-T2-001-01', order_number: 0 }]
   }
   ```

2. **Improved Error Fallback**: The catch block now returns a complete response with content for all three tubes, ensuring error resilience.

3. **Added Debug Headers**: Added custom headers to help track when the emergency endpoint is used:
   ```javascript
   res.setHeader('X-Zenjin-Emergency-Mode', 'true');
   res.setHeader('X-Zenjin-UserId', userId || 'unknown');
   ```

## Testing

To test this fix:

1. **Anonymous User**: Verify anonymous users can play through all three tubes with the emergency content
2. **Anonymous → Authenticated**: Verify users can authenticate and continue playing with their progress preserved
3. **Cycling**: Verify tube cycling works correctly from tube 1 → 2 → 3 → 1

## Further Improvements

While this emergency fix resolves the immediate issue, a more permanent solution should:

1. **Fix the 504 Timeout Root Cause**: Investigate and fix the underlying database query performance issues
2. **Implement Content Bundling**: Pre-bundle content for users to reduce API calls
3. **Progressive Loading**: Implement a progressive loading scheme that loads content for the next tube in advance

## Usage Instructions

The emergency API is now active and will respond to requests to `/api/user-stitches` with hardcoded data that allows the app to function properly. This will ensure users can continue using the app until the root cause of the 504 timeout issues is resolved.