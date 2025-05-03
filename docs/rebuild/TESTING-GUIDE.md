# Testing Guide for Multi-User Scenarios

## Overview

This guide outlines strategies for testing Zenjin Maths in multi-user scenarios, especially when dealing with shared devices and browser state persistence issues.

## Testing Options

### 1. Testing Utilities Page

We've implemented a dedicated `/test-utils` page that provides convenient tools for testing:

- **Clear Anonymous Data**: Removes only anonymous user data while preserving authentication
- **Launch Forced Anonymous Mode**: Starts a fresh anonymous session even if logged in
- **Show Current State**: Displays localStorage keys, cookies, and authentication status
- **Clear All localStorage**: Removes all localStorage data
- **Clear Cookies**: Attempts to clear browser cookies (with security limitations)
- **Complete Reset & Reload**: The nuclear option - clears everything and reloads the app

To use this page:
1. Navigate to `/test-utils` in your browser
2. Use the appropriate buttons to simulate different states
3. Test the application flow after making changes

**Note**: The test-utils page should be disabled or removed in production builds for security reasons.

### 2. Browser Profile Management

For more thorough testing, consider using browser profiles:

#### Chrome/Edge Profiles
1. Click your profile icon in the top-right corner
2. Select "Add" to create a new profile
3. Create separate profiles for:
   - Administrator/Teacher
   - Student 1 (authenticated)
   - Student 2 (anonymous)
   - Shared device (family computer)

#### Firefox Containers
Firefox offers a powerful "Multi-Account Containers" extension that allows multiple isolated sessions within the same browser window:

1. Install the "Multi-Account Containers" extension
2. Create containers for different user types
3. Right-click any link and select "Open Link in [Container]"
4. Each container keeps its own cookies and localStorage

### 3. Private/Incognito Windows

For quick testing:
1. Open a private/incognito window (Ctrl+Shift+N in Chrome, Ctrl+Shift+P in Firefox)
2. Test the anonymous flow
3. Open a regular window for authenticated flow
4. Compare behaviors

### 4. Custom Testing Parameters

We've added URL parameters to facilitate testing:

- `mode=anonymous&force=true`: Forces anonymous mode even when logged in
- `reset=true`: Indicates a fresh anonymous session was created
- `from=player`: Indicates navigation source (for analytics)

Example test flow using parameters:
1. `/minimal-player?mode=anonymous&force=true`: Start in forced anonymous mode
2. Complete a session to test redirection
3. `/anon-dashboard?reset=true`: Test dashboard after reset
4. `/dashboard`: Test switching back to authenticated mode

## Testing Scenarios

### 1. Anonymous to Authenticated Flow

1. Start as anonymous user
2. Play through a session
3. Create an account or sign in
4. Verify progress is maintained or properly reset

### 2. Authenticated to Anonymous Flow

1. Sign in as authenticated user
2. Use "Continue in Guest Mode" to switch to anonymous 
3. Verify no user data is leaked into anonymous session
4. Switch back to authenticated mode
5. Verify authenticated data is intact

### 3. Multiple Anonymous Users

1. Use the "Start Fresh Session" button
2. Play through a session, note progress
3. Use "Start Fresh Session" again
4. Verify all progress is reset

### 4. Browser Cache Behaviors

1. Close browser completely
2. Reopen and navigate to app
3. Verify correct state is maintained or reset
4. Try in multiple browsers to compare behaviors

## Implementation Notes

### Browser Limitations

- **HttpOnly Cookies**: Cannot be cleared using JavaScript
- **Service Workers**: May persist state even after clearing localStorage
- **IndexedDB**: May need additional clearing steps

### Environment-Specific Testing

- Test on both desktop and mobile devices
- Test in different browsers (Chrome, Firefox, Safari)
- Test with different privacy settings and extensions

## Automated Testing Suggestions

For more automated testing, consider these approaches:

1. **Cypress Testing**:
   ```javascript
   // In cypress test
   cy.clearLocalStorage();
   cy.clearCookies();
   cy.visit('/minimal-player?mode=anonymous&force=true');
   ```

2. **Playwright Testing**:
   ```javascript
   // In playwright test
   await context.clearCookies();
   await page.evaluate(() => localStorage.clear());
   await page.goto('/minimal-player?mode=anonymous&force=true');
   ```

3. **Jest with MSW (Mock Service Worker)**:
   ```javascript
   // Mock authentication state
   beforeEach(() => {
     localStorage.clear();
     document.cookie = '';
   });
   ```

## Conclusion

Testing multi-user scenarios requires a combination of:
- Manual testing with the test-utils page
- Browser profile management
- URL parameters for specific states
- Regular clearing of browser state

The test-utils page provides a convenient dashboard for quickly resetting state during development and testing, while browser profiles or containers offer more thorough isolation for user testing sessions.