# Unified Approach for Anonymous and Authenticated Users

## Implementation Summary

We've implemented a unified approach for handling both anonymous and authenticated users in the Zenjin Maths application. This refactoring treats anonymous users the same way as authenticated users from a code perspective, with the only difference being that anonymous accounts have a TTL (time-to-live) on the server.

## Key Changes

### 1. Removed Cleanup of Anonymous Data

- Commented out all calls to `cleanupAnonymousData()` in `AuthContext.tsx` as we no longer need to clean up anonymous data when transitioning to a logged-in state.
- Anonymous accounts are now real server-side accounts (just with TTL), and use the same data structures as authenticated accounts.
- Locations updated:
  - `signIn` function
  - `transferAnonymousData` function
  - `verifyCode` function

### 2. Enhanced `startFreshAnonymousSession` in `anonymousData.ts`

- Modified to check for existing anonymous IDs before creating a new one.
- If an existing ID is found, it's used across all storage locations for consistency.
- Ensures data is preserved between sessions.

### 3. Improved `createAnonymousUser` in `anonymousData.ts`

- Now stores the anonymous ID in all relevant locations:
  - `anonymousId` (legacy)
  - `zenjin_anonymous_id` (current standard)
  - `zenjin_user_id` (for API access and unified approach)
  - `zenjin_auth_state` set to 'anonymous'
- Initializes empty state for tube tracking in unified format.

### 4. Enhanced `hasAnonymousData` in `anonymousData.ts`

- Now checks multiple storage locations for anonymous IDs.
- Verifies presence of state data in various formats.

### 5. Updated `anon-dashboard.tsx`

- Modified to use the unified approach when checking for and creating anonymous users.
- Uses IDs from any of the possible storage locations.
- Ensures all storage locations are updated consistently.

## Benefits of the Unified Approach

1. **Seamless Transitions**: Users can transition between anonymous and authenticated states without losing their progress.
2. **Simplified Code**: Treating all users the same way reduces code complexity and potential bugs.
3. **Consistent Data Structures**: Both anonymous and authenticated users use the same data formats and storage patterns.
4. **Improved Reliability**: Multiple storage locations ensure data persistence across different code paths.
5. **Better User Experience**: Users don't lose their progress when signing up or logging in.

## How Anonymous Users Are Created

Anonymous users are now only created when:
1. A user explicitly clicks "Try Without Signing Up" on the landing page.
2. The app detects `zenjin_create_anonymous_state` flag in localStorage.

Instead of automatically creating an anonymous ID on first visit, the app now waits for an explicit action from the user.

## Server-Side TTL Accounts

Anonymous users are now created as real accounts on the server with a TTL (time-to-live), rather than just using client-side localStorage. When an anonymous user signs up for a real account, their anonymous data is preserved and linked to their new authenticated account.