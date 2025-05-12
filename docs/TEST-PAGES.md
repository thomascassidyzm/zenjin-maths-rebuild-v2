# Zustand Content System Test Pages

This document provides details about the test pages available for verifying the Zustand content system implementation.

## Available Test Pages

### 1. Basic Stitch Loading Test

**URL:** `/test-zustand-stitch`

This page tests the fundamental content fetching functionality:
- Basic stitch fetching from the API
- StitchContentLoader component functionality
- useStitchContent hook implementation

Use this page to verify that the content loading system can successfully fetch stitch content from the API and display it properly.

### 2. Zustand Player Test

**URL:** `/test-zustand-player`

This page tests the ZustandDistinctionPlayer component:
- Full player implementation with Zustand integration
- Question display and interaction
- Stitch content loading

Note: This page might exhibit rapid cycling through questions which is a known issue with the ZustandDistinctionPlayer component.

### 3. Integrated Player Test

**URL:** `/integrated-player`

This page tests the full integration with the Zustand store:
- Store initialization for anonymous users
- Stitch fetching and caching
- Tube selection and navigation
- Points accumulation

### 4. Hybrid Player Test (Recommended)

**URL:** `/hybrid-player`

This page demonstrates the recommended hybrid approach:
- ZustandContentProvider with MinimalDistinctionPlayer
- Reliable UI with improved content loading
- Zustand store integration for state management

This is the recommended implementation for production use.

### 5. Server Sync Test

**URL:** `/test-server-sync`

This page tests the server synchronization functionality:
- Syncing state to the server
- Loading state from the server
- Points accumulation and persistence

## Running the Test Script

A bash script is provided to verify that all test pages are accessible after deployment:

```bash
# Run on localhost
./scripts/test-zustand-content.sh

# Run on deployed server
./scripts/test-zustand-content.sh https://your-domain.com
```

The script will check all test pages and report any issues.

## Testing Process

For a complete test of the Zustand content system, follow these steps:

1. Visit `/test-zustand-stitch` and verify:
   - Stitch content loads successfully
   - The "Fetch" button works for different stitch IDs
   - Both the component and hook display correct information

2. Visit `/hybrid-player` and verify:
   - The player loads with the correct stitch
   - You can answer questions and get feedback
   - Points accumulate correctly
   - You can switch between tubes

3. Visit `/test-server-sync` and verify:
   - You can sync state to the server
   - You can load state from the server
   - Points persist between operations

## Troubleshooting

If you encounter issues with the test pages:

1. **API Errors:**
   - Check browser console for API error messages
   - Verify that the `/api/content/batch` endpoint is accessible

2. **Missing Content:**
   - Check that stitch IDs exist in the database
   - Verify the API response format matches expectations

3. **Player Issues:**
   - If ZustandDistinctionPlayer cycles through questions, use the hybrid implementation instead
   - Check for state initialization issues in the console

4. **Server Sync Issues:**
   - Verify that the user is properly authenticated (for authenticated users)
   - Check that the `/api/user-state` endpoint is working correctly