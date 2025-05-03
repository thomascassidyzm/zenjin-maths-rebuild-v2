# Anonymous to Free User Transition Enhancement

## Overview

This update improves the transition from anonymous to authenticated (free) users by providing a clear distinction between the two tiers, ensuring that progress is preserved, and implementing a tier management system for future extensibility.

## Core Changes

### 1. Tier Management System

- Created a new `tier-manager.ts` module that defines:
  - User tier types (anonymous, free, paid)
  - Content access levels (none, limited, full)
  - Access profiles for different user tiers
  - Helper functions for filtering content based on access profiles

- This abstraction allows for:
  - Clear separation between anonymous and free users
  - Future extensibility for paid tiers
  - Centralized management of tier-specific content access

### 2. Enhanced Anonymous Session

- Updated `anonymous-session.ts` to use the new tier manager
- Improved the logic for determining content limits for anonymous users
- Enhanced login prompt messaging based on user progress

### 3. Better Anonymous to Free User Transition

- Enhanced `transfer-anonymous-data.ts` API endpoint to:
  - Explicitly set the user tier to 'free' in the profiles table
  - Only transfer relevant thread data based on tier access
  - Return tier information in the response

- Updated `AuthContext.tsx` to:
  - Handle anonymous data transfer with better error handling
  - Store tier information in localStorage for quick access
  - Pass tier information when initializing user data

### 4. User Initialization with Tier Support

- Enhanced `initialize-user-data.ts` API endpoint to:
  - Accept and handle tier information
  - Create/update the user profile with tier data
  - Provide different thread access based on tier
  - Return tier information in the response

## Testing

- Created `tier-manager.test.ts` to verify tier management functionality
- Created `transfer-anonymous-data.test.ts` to test the anonymous data transfer process
- Enhanced the anonymous-to-free user test plan

## Key Benefits

1. **Clear Tier Separation**: Anonymous and free users now have distinct access profiles, with free users getting full access to free tier content.

2. **Improved Progress Preservation**: When transitioning from anonymous to free, progress is properly transferred and the user immediately gains full access to free tier content.

3. **Better User Experience**: Users will see appropriate messages based on their progress and tier, encouraging sign-up at appropriate times.

4. **Future Extensibility**: The tier management system is designed to accommodate future paid tiers with minimal changes.

## Next Steps

1. **Enhance Dashboard**: Update the dashboard to display tier information and available content.

2. **User Tier API**: Create a dedicated API endpoint for retrieving and updating user tier information.

3. **Content Filtering in UI**: Implement UI components to show/hide content based on tier access.

4. **Front-end Tier Management**: Create a hook for accessing tier information on the front end.