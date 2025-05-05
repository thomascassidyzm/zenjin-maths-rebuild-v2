# Supabase Client Fixes for 504 Gateway Timeout

## Root Cause

After investigation, we identified two main causes for the 504 Gateway Timeout errors:

1. **Deprecated Supabase Client**: The application was using the deprecated `createServerSupabaseClient` function from `@supabase/auth-helpers-nextjs`, which is no longer compatible with the latest Supabase version.

2. **Excessive Data Fetching**: The `/api/user-stitches` API was fetching too much data, including content that was already bundled with the application.

## Fixed Issues

### 1. Updated Supabase Client Creation

- Changed from deprecated `createServerSupabaseClient` to the new `createRouteHandlerClient` in `lib/api/auth.ts`.
- This fixes the error: `TypeError: Cannot read properties of undefined (reading 'from')` which was happening because the database client wasn't being properly initialized.

### 2. Fixed API Handler Parameter Structure

- Updated the `user-stitches.ts` API to correctly use the parameters provided by the handler function.
- The API was incorrectly trying to destructure parameters from a `context` object, when they should have been accessed directly as function parameters.

### 3. Optimized Data Fetching

- Redesigned the `user-stitches.ts` API to only fetch minimal data:
  - For free tier users: Just thread metadata and position (no content)
  - For premium users: Only thread metadata and minimal required content

- Reduced database queries by:
  - Eliminating the prefetch parameter
  - Limiting selected fields
  - Avoiding multiple nested queries

## Implementation Details

1. **Client Creation Update**:
   ```javascript
   // OLD
   import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
   export function createAuthClient(req, res) {
     return createServerSupabaseClient({ req, res });
   }

   // NEW
   import { createRouteHandlerClient } from '../supabase/route';
   export function createAuthClient(req, res) {
     return createRouteHandlerClient(req, res);
   }
   ```

2. **API Handler Fix**:
   ```javascript
   // OLD - Incorrectly trying to access parameters through context
   export default createAdvancedHandler(
     async (req, res, context) => {
       const { userId, db, isAuthenticated } = context;
       // ...
     }
   );

   // NEW - Correctly accessing parameters provided directly by the handler
   export default createAdvancedHandler(
     async (req, res, userId, db, isAuthenticated, context) => {
       // ...
     }
   );
   ```

3. **Data Fetching Optimization**:
   - Simplified API to only fetch thread metadata and user position
   - Free tier content is already bundled with the app, so no need to fetch it again
   - Reduced prefetch values across the application

## Testing

After implementing these fixes, you should see:

1. No more 504 Gateway Timeout errors when authenticating
2. Faster loading times for content
3. More efficient API calls

These changes should resolve the authentication and timeouts issues for all users.

## Future Improvements

1. **Lazy Loading Strategy**: Implement a better approach for loading premium content incrementally as needed.

2. **Bundled Content Management**: Better document and structure the bundled content to make it clear what's available locally.

3. **Supabase Version Updates**: Make sure to follow Supabase version updates and migration guides to avoid similar issues in the future.