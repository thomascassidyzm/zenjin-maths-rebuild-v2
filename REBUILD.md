# Zenjin Maths API Rebuild

This project is a rebuild of the Zenjin Maths API and data persistence layer. The rebuild maintains the existing player component and content structures while completely redesigning the API layer for better reliability and maintainability.

## Project Goals

1. Create a robust, testable API layer with consistent error handling
2. Implement clear authentication flow for anonymous and authenticated users 
3. Fix data persistence issues to ensure reliable saving of user progress
4. Maintain the offline-first approach with clear synchronization boundaries
5. Create a clean upgrade path from anonymous → free → paid user

## Key Design Principles

1. **Clear API Contracts**: All endpoints follow consistent patterns
2. **Explicit Synchronization**: Clear points where data syncs with server
3. **Single Source of Truth**: Server for user profiles, local for active sessions
4. **Proper Error Handling**: All errors logged and reported consistently
5. **Testable Components**: Each part can be tested independently

## Implementation Plan

### Phase 1: Core API Utilities ✅
- Create centralized authentication utilities
- Implement standardized response formatting
- Set up proper error logging
- Create API handler factories

### Phase 2: Authentication Endpoints ✅
- Rebuild magic link/OTP verification
- Create profile management endpoint
- Implement anonymous → authenticated transition
- Add sign out functionality
- Add user detail management (email, password)

### Phase 3: Data Persistence ✅
- Create session recording endpoint
- Implement progress tracking endpoint
- Add bulk synchronization functionality

### Phase 4: Payment Integration 🔄
- Implement Stripe customer management
- Create checkout flow
- Set up webhook handlers

### Phase 5: Testing 🔄
- Create test suite for API endpoints
- Implement monitoring for errors
- Test all user flows

## Rebuild Architecture

### Core API Utilities ✅

The following core API utilities have been implemented:

```
lib/api/
  responses.ts    # API response formatting
  logging.ts      # Error logging utilities
  auth.ts         # Authentication utilities
  handlers.ts     # API handler factories
```

These utilities provide:
- Standardized response formats for success and errors
- Consistent error logging and context tracking
- Centralized authentication logic
- Factory functions for creating API handlers with proper error handling and authentication

### Authentication Endpoints ✅

The following authentication endpoints have been implemented:

```
pages/api/auth/
  magic-link.ts       # Send magic link/email code for authentication
  verify.ts           # Verify OTP/magic link to create session
  signout.ts          # End user session and clear authentication
  callback.ts         # Handle auth provider callbacks
  create-profile.ts   # Create/update user profile after authentication
  update-email.ts     # Update user's email address
  update-password.ts  # Update user's password (requires current password)
  set-password.ts     # Set initial password for magic link users
  reset-password.ts   # Reset forgotten password
```

```
pages/api/user/
  profile.ts         # Get user profile information
  update-profile.ts  # Update user profile information
```

These endpoints support:
- Email-based authentication with magic links/OTP
- Anonymous to authenticated user transition
- Profile creation and management
- Secure session handling
- User detail management (email, password)

### Data Persistence Endpoints ✅

The following data persistence endpoints have been implemented:

```
pages/api/sessions/
  record.ts          # Record a completed learning session
  
pages/api/progress/
  update.ts          # Update progress on a specific stitch
  bulk-sync.ts       # Synchronize multiple progress records and sessions
```

These endpoints support:
- Reliable recording of session results
- Progress tracking with robust fault tolerance
- Bulk synchronization for offline-to-online transitions
- Support for both anonymous and authenticated users
- Automatic profile updates when sessions are recorded

### Security & Database Access

The API follows a consistent approach to security and database access:

1. **Authentication**: Uses the Supabase auth helpers to verify the user's session
2. **Database Access**: Uses the admin client with service role key to bypass RLS when needed
3. **Mixed Operations**: For endpoints that need both authentication and database operations, the handler provides the user ID and database client, and the endpoint can create an auth client when needed

This simplified approach ensures:
- All authentication operations are handled with proper cookie management
- All database operations have the permissions they need
- API endpoints remain clean and focused

### Files to Retain

The player component and content-related code will remain unchanged:

```
components/
  MinimalDistinctionPlayer.tsx  # Main player component
  [Other UI components]
  
lib/
  playerUtils.ts               # Player utilities
  [Content loading utilities]
```

## Migration Strategy

1. Build new API endpoints alongside existing ones
2. Test thoroughly on preview builds
3. Update the player's API calls to use new endpoints
4. Phase out old endpoints after successful migration

## Authentication Flow

The new authentication flow has clear states:

1. **Anonymous**: User starts anonymous with local storage only
2. **Email Verification**: User enters email, receives OTP/magic link
3. **Account Creation**: Upon verification, user account is created
4. **Profile Creation**: User profile is created, anonymous data migrated
5. **Optional Password Setup**: User can set a password for future password-based logins
6. **Authenticated Usage**: User continues with an authenticated session

## Data Synchronization Points

Explicit points where data syncs with the server:

1. **Authentication**: When user signs in/up
2. **Session Completion**: When user finishes a learning session
3. **Periodic Refresh**: When tube content needs refreshing (low stitch count)
4. **Bulk Sync**: When transitioning from offline to online mode

## Offline-First Operation

The application supports offline-first operation with these features:

1. **Local Storage**: Session data and progress are stored locally first
2. **Periodic Sync**: Data is synced to the server at key points
3. **Bulk Sync**: Multiple records can be synced at once when coming back online
4. **Transparent IDs**: Anonymous and authenticated users use the same ID format
5. **Resilient APIs**: All APIs can handle partial failures and retry strategies

## Error Handling

All API endpoints follow this consistent error handling pattern:

```typescript
export default createAuthHandler(
  async (req, res, userId, db) => {
    try {
      // API implementation
      return res.status(HTTP_STATUS.OK).json(
        successResponse({ /* data */ })
      );
    } catch (error) {
      // Error is logged by the handler
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse('User-friendly error message')
      );
    }
  },
  {
    methods: ['POST'],
    context: 'ContextName'
  }
);
```

## Testing Strategy

1. Unit tests for API utilities
2. Integration tests for API endpoints
3. End-to-end tests for authentication flow
4. Comprehensive error scenario testing