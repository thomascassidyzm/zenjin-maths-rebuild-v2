# Anonymous to Free User Migration

This document describes the process of migrating data when an anonymous user creates a free account, ensuring that their progress is maintained.

## Overview

Anonymous users can use the application and accumulate points, progress and achievements without creating an account. When they decide to create a free account, the system automatically migrates all their data to the new account. This provides a seamless experience and ensures users don't lose their progress when converting from anonymous to authenticated.

## Key Components

### 1. AnonymousToAuthMigration Component

The `AnonymousToAuthMigration` component (`components/auth/AnonymousToAuthMigration.tsx`) automatically handles the migration process when an anonymous user becomes authenticated:

- Detects when an anonymous user has created an account
- Collects all anonymous data from localStorage
- Calls the API to transfer this data to the server with the new user's ID
- Provides status updates and error handling
- Triggers a callback when migration is complete

### 2. API Endpoint

The `/api/transfer-anonymous-data` endpoint handles the server-side aspects of the migration:

- Receives anonymous data and the new user ID
- Creates appropriate records in the database for the new user
- Maps anonymous progress to the appropriate data structures for authenticated users
- Handles error cases and provides detailed feedback

### 3. Enhanced Anonymous Experience

To encourage anonymous users to create accounts, we've improved the messaging:

- Added "Savable Progress" indicator in the dashboard
- Enhanced the progress warning banner with a clear CTA and benefits explanation
- Updated the Anonymous Upgrade Prompt to emphasize data preservation
- Added direct signup buttons throughout the anonymous experience

### 4. Sign-in Page Integration

The sign-in page (`pages/signin.tsx`) includes special handling for migrating users:

- Detects when a new account is being created by a previously anonymous user
- Shows migration status during the process
- Delays redirection until migration is complete
- Provides feedback on success/failure

## Data Migration Flow

1. Anonymous user clicks "Create Free Account" from the anonymous dashboard
2. User completes the sign-up form and becomes authenticated
3. `AnonymousToAuthMigration` component detects the transition
4. Component collects all localStorage data related to the anonymous user
5. Data is sent to the `/api/transfer-anonymous-data` endpoint
6. API creates appropriate records in the database and returns success/failure
7. On success, anonymous localStorage data is cleared
8. User is redirected to the authenticated dashboard with their progress intact

## Implementation Details

### Anonymous User Identification

Anonymous users are identified by a unique ID stored in localStorage as `anonymousId` with format `anon-[timestamp]-[random number]`.

### Data Persistence

Anonymous user data is stored in localStorage under several keys:
- `progressData_[anonymousId]`: Contains total points, blink speed, and evolution level
- `sessionData_[anonymousId]`: Contains most recent session data

### Migration Process

When migrating, the system:
1. Collects all anonymous data from these localStorage sources
2. Converts it to the format expected by the server
3. Sends it to the API with the new user ID
4. The API creates appropriate database records
5. The data is then available to the user in their authenticated experience

## User Experience Enhancements

To make the migration process clear to users, we've added:
- Explicit messaging in the anonymous dashboard about data preservation
- A "Savable Progress" badge in the header
- Enhanced upgrade prompts with migration information
- Visual feedback during the migration process
- Direct signup buttons with clear calls-to-action

## Testing the Flow

To test the anonymous-to-free user flow:

1. Clear localStorage and visit the site without logging in
2. Use the app anonymously and earn some points
3. Create a new account through any of the signup flows
4. Verify that your points and progress are maintained in your new account
5. Check that evolution level and other achievements are properly migrated

## Future Improvements

1. Add analytics to track conversion rates from anonymous to registered users
2. Implement a more detailed progress migration visualization
3. Consider implementing synchronization if a user uses both anonymous and authenticated modes on different devices
4. Add the ability to merge accounts if a user creates multiple anonymous profiles