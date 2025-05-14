# Loading Screen Integration Guide

This guide explains how to properly integrate the `LoadingScreen` and `PlayerWithLoader` components with player implementations such as `MinimalDistinctionPlayer`.

## Overview

The Zenjin Maths application uses a two-component approach to manage content loading:

1. `PlayerWithLoader` - Wrapper that manages content loading and shows the loading screen
2. `LoadingScreen` - UI component that displays a welcome message and loading animation

This system ensures that content is fully loaded before the player is rendered, preventing race conditions and providing a smooth user experience.

## Z-Index Management

All UI layering is managed through a centralized z-index system in `/styles/zindex.css`. This ensures proper stacking of UI elements:

```css
/* Important z-index values */
--z-background: -10;   /* Background elements */
--z-content: 10;       /* Main content (like the player) */
--z-loading-screen: 500; /* Loading screen (appears above everything) */
```

## Integration Examples

### 1. Basic Integration

```jsx
<PlayerWithLoader 
  tubeId={1} 
  stitchId="stitch-T1-001-01"
  onContentLoaded={() => console.log('Content loaded!')}
>
  <MinimalDistinctionPlayer 
    tubeNumber={1} 
    tubeData={tubeData} 
    onComplete={handleComplete} 
  />
</PlayerWithLoader>
```

### 2. Custom Loading Time

```jsx
<PlayerWithLoader 
  tubeId={1} 
  stitchId="stitch-T1-001-01"
  minLoadingTime={5000} // 5 seconds minimum display time
  maxAttempts={3}       // Maximum 3 content loading attempts
>
  <MinimalDistinctionPlayer 
    tubeNumber={1} 
    tubeData={tubeData} 
    onComplete={handleComplete} 
  />
</PlayerWithLoader>
```

### 3. Integration with Zustand State

```jsx
// Get stitch data from Zustand store
const { contentCollection } = useZenjinStore();

// Get the current tube data
const tubeData = contentCollection?.tubes?.[tubeId];

return (
  <PlayerWithLoader 
    tubeId={tubeId} 
    stitchId={stitchId}
  >
    <MinimalDistinctionPlayer 
      tubeNumber={tubeId} 
      tubeData={tubeData} 
      onComplete={handleComplete} 
    />
  </PlayerWithLoader>
);
```

## How It Works

1. `PlayerWithLoader` manages content loading using multiple strategies:
   - Checks if content is already in the Zustand store
   - Uses `getActiveStitch` to fetch the most up-to-date content
   - Tries direct fetching with the specific stitch ID
   - Attempts to fill the initial content buffer as a last resort

2. While content is loading, it shows the `LoadingScreen` component:
   - Displays a welcome message tailored to the user's authentication status
   - Shows an animated loading screen with cycling messages
   - Ensures a minimum display time for a smooth experience

3. Once content is loaded and the minimum display time has passed:
   - The loading screen is hidden
   - The wrapped player component is rendered
   - The `onContentLoaded` callback is triggered (if provided)

4. If content loading fails after multiple attempts:
   - A user-friendly error UI is shown
   - A reload button is provided to refresh the page
   - Detailed logs are written to the console for debugging

## Key Parameters

### PlayerWithLoader Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| tubeId | number | required | The ID of the tube to load |
| stitchId | string | required | The ID of the stitch to load |
| minLoadingTime | number | 3000 | Minimum time to show the loading screen (ms) |
| maxAttempts | number | 3 | Maximum attempts to load content (reduced to minimize server hits) |
| onContentLoaded | function | undefined | Callback when content is successfully loaded |

### LoadingScreen Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| isAnonymous | boolean | true | Whether the user is anonymous or authenticated |
| userName | string | undefined | The user's name (for authenticated users) |
| minDisplayTime | number | 3000 | Minimum time to show the loading screen (ms) |
| onAnimationComplete | function | undefined | Callback when animation is complete |
| showDebugInfo | boolean | false | Whether to show debug information |

## Best Practices

1. **Always Wrap Player Components**: Always wrap your player components with `PlayerWithLoader` to ensure content is loaded before rendering.

2. **Provide Both IDs**: Always provide both `tubeId` and `stitchId` to `PlayerWithLoader` to ensure proper content loading.

3. **Handle Completion**: Use the `onComplete` callback of your player component to handle session completion.

4. **Avoid Direct Access to Content Collection**: Use the `PlayerWithLoader` to manage content loading instead of directly accessing the content collection.

5. **Use Z-Index CSS Variables**: Use the CSS variables from `styles/zindex.css` for any custom components that need to be layered properly.

## Testing

The `/pages/clean-start-player.jsx` page provides a clean testing environment for the loading screen and player:

1. Clears localStorage to ensure a fresh start
2. Provides controls for testing the loading screen
3. Shows detailed diagnostics about content loading
4. Allows testing with different loading screen display times

## Troubleshooting

### Content Not Loading

If content fails to load, check the following:

1. Verify the correct `tubeId` and `stitchId` are provided
2. Check the console for detailed loading logs
3. Make sure the Zustand store is properly initialized
4. Check the network tab for API request errors

### Loading Screen Flashing

If the loading screen appears briefly and then disappears:

1. Increase the `minLoadingTime` parameter
2. Check if content is loading too quickly (this is actually good!)
3. Verify there are no errors in the loading process

### Player Not Rendering After Loading

If the player doesn't appear after the loading screen:

1. Check for errors in the console
2. Verify the player component is receiving the correct props
3. Ensure the content was successfully loaded
4. Check if the player component is handling errors properly

## Additional Resources

- [CLEAN-START-PLAYER.md](../CLEAN-START-PLAYER.md) - Documentation for the clean start player testing environment
- [LOADING-SCREEN-FIX.md](../LOADING-SCREEN-FIX.md) - Details about the loading screen implementation and fixes
- [ZUSTAND-SESSION-METRICS.md](../docs/ZUSTAND-SESSION-METRICS.md) - Information about integrating with session metrics