# Application Flow Guide

This document outlines the complete flow of data in the application, from app initialization to session completion and metrics recording. Understanding this flow is essential for integrating new components and features.

## Authentication and State Initialization

1. **App Initialization**
   - User visits the application
   - App checks for existing authentication in cookies/localStorage
   - For anonymous users, it generates a temporary ID
   - For authenticated users, it loads their profile

2. **State Loading**
   - The Zustand store is initialized with default values
   - For anonymous users:
     - State is loaded from localStorage
     - Content is loaded from the bundled content
   - For authenticated users:
     - First tries to load state from the server
     - Falls back to localStorage if server fails
     - Synchronizes state periodically to the server

3. **Content Buffer Loading**
   - Two-phase loading approach for better performance:
     - Phase 1: Loads only current and immediate next stitches
     - Phase 2: Loads the remaining stitches in the background
   - Content is stored in the Zustand store for reuse
   - Specific stitch content is loaded on-demand

## User Interaction Flow

1. **Player Initialization**
   - Player component is wrapped with SessionMetricsProvider
   - Provider prefetches content for the specified stitch
   - Player renders with the specified tube/stitch configuration

2. **User Interaction**
   - User answers questions in the current stitch
   - Player tracks correct/incorrect answers
   - Player may show animations and visual feedback

3. **Session Completion**
   - User completes all questions for the current stitch
   - Player collects metrics (scores, timings, etc.)
   - Player calls `recordSession` with the results

4. **Metrics Recording**
   - SessionMetricsProvider receives results from player
   - Ensures content is properly loaded
   - Formats metrics data for API compatibility
   - Calls Zustand action to record the session

5. **API Request**
   - Zustand action calls the API endpoint with the metrics
   - API endpoint derives threadId from tubeId if needed
   - Server processes the metrics and updates the database
   - Response returns success and updated stats

6. **State Update**
   - Success response updates the Zustand store
   - Learning progress is updated with new points
   - UI is updated to reflect the new state
   - State is automatically persisted to localStorage

7. **State Persistence**
   - For anonymous users:
     - State is saved to localStorage only
   - For authenticated users:
     - State is saved to localStorage
     - State is also synchronized to the server

## Error Handling

1. **API Failures**
   - If the API call fails, emergency metrics are generated
   - User still sees results, but with a note about offline mode
   - State is still updated in localStorage
   - Errors are logged and tracked

2. **Content Loading Failures**
   - If content fails to load, falls back to bundled content
   - User experience remains uninterrupted
   - Errors are logged for later resolution

## Integration Points

When integrating new components, these are the key points to consider:

1. **Wrap with SessionMetricsProvider**
   - Any component that needs to record sessions should be wrapped
   - Provide tubeId and stitchId to identify the content

2. **Use the recordSession Function**
   - Call the provided recordSession function when the session is complete
   - Pass the complete results with all question data

3. **Leverage Zustand for State**
   - Access state through the useZenjinStore hook
   - Use the store actions for modifying state
   - Let Zustand handle persistence and synchronization

4. **Visual Integration**
   - Use the provided CSS variables for color theming
   - Ensure animations are performant and consistent
   - Follow the established design patterns for UI elements
EOF < /dev/null