# Testing Instructions

After deploying the loading screen and session metrics fixes, please test the following pages to verify the implementation:

## 1. Clean Start Player Test

**URL:** `/clean-start-player`

This page provides a clean testing environment with tools to clear localStorage:

1. First, use the **"Clear All LocalStorage"** button to ensure a fresh start.
2. Check the LocalStorage display to verify it's empty.
3. Try the **"Show Loading Screen Directly"** button to test the loading screen in isolation.
4. Use the **"Start Player With Clean State"** button to test the player with a completely fresh state.
5. Monitor the diagnostics panel at the bottom to see what's happening.

This page is the most useful for testing as it provides detailed diagnostics and a clean environment.

## 2. Client-Only Session Metrics Test

**URL:** `/client-only-session-metrics`

This page tests the session metrics recording with client-side only rendering:

1. Complete a session by answering all questions.
2. Verify that the session summary displays correctly.
3. Check that there are no console errors related to React hooks.

## 3. Loading Screen Test

**URL:** `/test-loading-screen`

This page demonstrates both direct usage of the loading screen and integration with PlayerWithLoader:

1. Test the direct loading screen to verify animations and timing.
2. Test the integrated player to verify proper content loading coordination.

## 4. Test Session Metrics Page

**URL:** `/test-session-metrics`

This page tests the original session metrics page with the SSR fixes:

1. Verify that the page loads without errors.
2. Test the session recording functionality.
3. Confirm that session metrics are saved properly.

## Troubleshooting

If you encounter issues:

1. **Console Logs**: Check the browser console for detailed loading logs with timestamps.
2. **localStorage**: Use the Clean Start Player to clear localStorage and start fresh.
3. **Questions not Loading**: If the player shows the error screen, check the network tab for API failures.
4. **Timing Issues**: Try increasing the `minLoadingTime` in PlayerWithLoader (currently set to 3000ms).

## What to Look For

1. **Loading Screen Behavior**:
   - The loading screen should appear for at least 3 seconds.
   - Math symbols should animate smoothly.
   - Loading messages should cycle every 3 seconds.

2. **Content Loading**:
   - The player should only appear after content is fully loaded.
   - There should be no "Using error question for authenticated user" messages in the console.
   - The console should show "✅ Rendering player with loaded content" when successful.

3. **Error Handling**:
   - If content can't be loaded, a user-friendly error message with a reload button should appear.
   - The console should show error information with timestamps.

## Reporting Issues

If you find issues, please note:

1. The URL you were testing
2. Any console errors (screenshot if possible)
3. Steps to reproduce the issue
4. Your browser and device information

Remember, the Clean Start Player (`/clean-start-player`) is the most helpful tool for troubleshooting as it provides the most control and diagnostics.