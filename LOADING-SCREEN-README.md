# Loading Screen Implementation

This document provides an overview of the loading screen implementation for the Zenjin Maths application.

## Overview

The loading screen addresses a critical timing issue in the application where content was attempting to render before it was fully loaded. This created a poor user experience with error states and incorrect content display. The implementation provides a professional, welcoming experience while ensuring content is properly loaded in the background.

## Key Components

### 1. Z-Index Management System (`/styles/zindex.css`)

A centralized system for managing z-index values across the application, establishing a clear hierarchy for UI layers:

```css
:root {
  /* Base layers */
  --z-background: -10;
  --z-default: 1;
  --z-content: 10;
  
  /* Interactive components */
  --z-buttons: 20;
  --z-navigation: 30;
  --z-dropdown: 40;
  --z-tooltips: 50;
  
  /* Overlays */
  --z-overlays: 100;
  --z-modals: 200;
  --z-notifications: 300;
  
  /* Loading screens */
  --z-loading-screen: 500;
  
  /* Critical UI elements that should always be on top */
  --z-critical: 1000;
}
```

### 2. Loading Screen Component (`/components/LoadingScreen.tsx`)

A React component that displays:
- A welcome message tailored to anonymous or authenticated users
- Brief instructions for how to use the application
- Animated math symbols for visual interest
- Cycling loading messages
- A minimum display time to prevent flickering

The component accepts the following props:
- `isAnonymous`: Boolean to determine the welcome message (default: true)
- `userName`: String for personalized welcome for authenticated users
- `onAnimationComplete`: Callback function when minimum display time is reached
- `minDisplayTime`: Number of milliseconds to show the screen (default: 2500ms)

### 3. Player With Loader Component (`/components/PlayerWithLoader.tsx`)

A wrapper component that:
- Coordinates content loading with UI rendering
- Shows the loading screen while content loads
- Only renders the player component when content is ready
- Ensures proper z-index layering

This component uses multiple strategies to verify content is loaded:
1. Checks if content is already in the Zustand store
2. Tries to get the active stitch directly
3. Attempts to fetch the stitch by ID
4. As a last resort, fills the initial content buffer

## Integration

To use the loading screen:

```jsx
<PlayerWithLoader tubeId={1} stitchId="stitch-T1-001-01">
  <MinimalDistinctionPlayer tubeNumber={1} />
</PlayerWithLoader>
```

This will:
1. Show the loading screen with welcome message and animations
2. Load content in the background using the Zustand store
3. When content is loaded and the minimum display time is reached, display the player component

## Testing

A test page is available at `/pages/test-loading-screen.tsx` that demonstrates:
- Direct usage of the LoadingScreen component with manual control
- Integration with PlayerWithLoader for automatic content loading
- Different states for anonymous and authenticated users

## Styling

The loading screen uses a teal gradient background to match the application's branding:

```jsx
<div className="loading-screen fixed inset-0 flex flex-col items-center justify-center h-full w-full bg-gradient-to-b from-teal-500 to-teal-700 text-white p-6 shadow-xl">
  {/* Content */}
</div>
```

Animations are defined in `/styles/globals.css` for floating math symbols and pulsing effects.

## Technical Notes

1. The loading screen fixes a race condition where the player component was attempting to render before content was fully loaded.

2. The implementation solves three key issues:
   - **Timing**: Ensures content is loaded before the player component renders
   - **User Experience**: Provides a professional welcome screen instead of error states
   - **Z-Index Management**: Establishes a clear hierarchy for UI layers

3. The architecture follows best practices:
   - **Single Responsibility**: Each component has a clear purpose
   - **Separation of Concerns**: Loading logic is separate from presentation
   - **Centralized State**: Uses Zustand store for content management
   - **Progressive Enhancement**: Gracefully handles different loading scenarios

## Future Improvements

1. Add progress indicators for content loading
2. Implement more elaborate animations themed around mathematics
3. Add personalized welcome content based on user's learning progress
4. Extend z-index management system to cover all UI components in the application