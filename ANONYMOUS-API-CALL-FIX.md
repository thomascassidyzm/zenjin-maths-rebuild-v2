# Anonymous API Call Fix

## Issue

The issue we observed is that despite our offline-first approach, we were still making an unnecessary API call to `/api/user-stitches?userId=anonymous&prefetch=5&isAnonymous=true` when the app loaded for anonymous users.

Key observations from browser logs:
- The GET request to `/api/user-stitches` was returning a 504 timeout
- The content worker was cleaning up expired entries properly
- The app was otherwise working correctly with bundled content

## Root Cause

The core issue was identified in a single component:

**Preload Link in _document.tsx**:
- A preload link in `_document.tsx` was eagerly fetching data for anonymous users
- This link was added during initial development to speed up API access
- Since we now use bundled content, this API call is completely unnecessary

## Fix Implemented

**Removed Preload Link**:
- Removed the `<link rel="preload">` directive from `_document.tsx`
- Added a comment explaining the removal

Upon code analysis, we determined that the existing code in playerUtils.ts was already correctly handling anonymous users without making API calls. The relevant code snippet shows:

```javascript
// No API calls for anonymous users - completely offline first
debug('Skipping API call for anonymous user - using offline-first approach');
```

The only issue was the preload link in _document.tsx that was causing a fetch regardless of the logic in playerUtils.ts.

## Benefits

- **Improved Offline Experience**: Anonymous users now have a truly offline-first experience
- **Reduced Network Traffic**: Eliminated unnecessary API calls for anonymous users
- **Faster Startup**: The app loads faster without waiting for API responses
- **Better Error Resilience**: No more 504 errors or dependency on the server

## Testing Verification

- Verified that the app loads without any API calls for anonymous users
- Confirmed bundled content is correctly loaded from playerUtils.ts ANONYMOUS_INITIAL_DATA
- Ensured stitch navigation and completion still work as expected

## Documentation

- Updated `CLaude.md` with a new section explaining the anonymous API call fix
- Created this document to detail the issue, root cause, and solution