# Zenjin Maths Rebuild - Guide for Claude

This document helps Claude understand the API rebuild project for Zenjin Maths.

## Project Overview

The Zenjin Maths API rebuild addresses critical issues with authentication, data persistence, and synchronization while preserving the existing player component.

### Core Problems Being Addressed

1. **Inconsistent API Layer**: Different error handling and response formats
2. **Authentication Issues**: Problems with session persistence and transitions
3. **Data Synchronization**: Unreliable saving of user progress
4. **Error Handling**: Silent failures that mask underlying issues
5. **Performance**: Unnecessary refreshes and redundant API calls

## Rebuild Architecture

### Key Design Principles

1. **Clear API Contracts**: Consistent patterns for all API endpoints
2. **Explicit Synchronization**: Well-defined points where data syncs with the server
3. **Single Source of Truth**: Server for user profiles, local for active sessions
4. **Proper Error Handling**: All errors logged and reported consistently
5. **Testable Components**: Each part can be tested independently

### File Structure

```
lib/
  api/
    auth.ts         # Authentication utilities
    responses.ts    # API response formatting
    logging.ts      # Error logging utilities
    handlers.ts     # API handler factories
    
pages/api/
  auth/
    magic-link.ts   # Send magic link/email code
    verify.ts       # OTP verification
    create-profile.ts # Create user profile
  user/
    profile.ts      # User profile management
  sessions/
    record.ts       # Record completed sessions
  progress/
    update.ts       # Update user progress
    bulk-sync.ts    # Sync multiple progress records
  payments/         # Stripe integration (future)
    
context/
  AuthContext.tsx   # Authentication context
  
lib/hooks/
  useAuth.ts        # Authentication hooks
  useSync.ts        # Data synchronization hooks
  useOfflineSync.ts # Offline-first sync management
```

## Authentication Flow

1. **Anonymous User**: Generated ID stored in localStorage
2. **Email Verification**: OTP or magic link for authentication
3. **Free Account**: User creates account, profile synced with server
4. **Paid Account**: Subscription via Stripe, premium features unlocked

## Data Persistence Strategy

1. **Local-First for Speed**: Store all active session data locally
2. **Server Sync at Key Points**:
   - Authentication: When user signs in/up
   - Session completion: When user finishes a learning session
   - Periodic refresh: When tube content needs refreshing
3. **Clear Synchronization Boundaries**: Explicit sync points
4. **Robust Error Handling**: All errors logged with context

## API Patterns

All API endpoints follow this consistent pattern:

```typescript
export default createAuthHandler(async (req, res, userId, db) => {
  try {
    // API implementation
    return res.status(200).json(
      successResponse({ /* data */ })
    );
  } catch (error) {
    logApiError('Context', error, userId);
    return res.status(500).json(
      errorResponse('User-friendly error message')
    );
  }
});
```

## Testing Strategy

1. **Unit Tests**: For API utilities and hooks
2. **Integration Tests**: For API endpoints and authentication flow
3. **End-to-End Tests**: For complete user journeys
4. **Error Scenario Tests**: Specifically for error handling
5. **Load Tests**: For performance under load

## Expected Claude Assistance

When working on this rebuild, Claude should:

1. **Implement Consistent Patterns**: Follow the patterns in docs/rebuild/*.md
2. **Ensure Offline-First Approach**: Maintain the offline-first architecture
3. **Consider Error Handling**: Implement comprehensive error handling
4. **Preserve Player Functionality**: Keep the player component working as-is
5. **Focus on Testability**: Design for easy testing and validation

## Documentation References

For detailed implementation guides, see:

1. `REBUILD.md` - Main project overview and goals
2. `docs/rebuild/01-API-UTILITIES.md` - Core API utilities and patterns
3. `docs/rebuild/02-AUTHENTICATION-FLOW.md` - Complete authentication system
4. `docs/rebuild/03-DATA-PERSISTENCE.md` - Data persistence and synchronization
5. `docs/rebuild/04-PAYMENT-INTEGRATION.md` - Stripe payment integration
6. `docs/rebuild/05-TESTING-STRATEGY.md` - Testing approach and tooling