# Z-Index Management System

This document describes the z-index management system implemented for the Zenjin Maths application.

## Overview

The z-index management system provides a centralized approach to managing z-index values across the application. It establishes a clear hierarchy for different UI elements, ensuring consistent layering and preventing z-index conflicts.

## Implementation

The system is implemented in `/styles/zindex.css` and includes:

1. CSS variables defining the z-index hierarchy
2. Utility classes for applying z-index values to elements
3. Documentation of the intended purpose of each z-index range

## Z-Index Hierarchy

The hierarchy is defined as follows:

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

## Usage Guidelines

### Basic Usage

Use the CSS variables directly in your styles:

```css
.my-tooltip {
  z-index: var(--z-tooltips);
}
```

Or in inline styles:

```jsx
<div style={{ zIndex: 'var(--z-dropdown)' }}>Dropdown Content</div>
```

### Utility Classes

The system provides utility classes for common elements:

```css
.loading-screen {
  z-index: var(--z-loading-screen);
}

.math-symbols-container {
  z-index: calc(var(--z-loading-screen) + 10);
}
```

### Relative Positioning

For elements that should be positioned relative to others in the same category, use the `calc()` function:

```css
.welcome-message {
  z-index: calc(var(--z-loading-screen) + 20);
}
```

## Integration with Components

The z-index system is integrated with several key components:

1. **LoadingScreen.tsx**: Uses the `.loading-screen`, `.welcome-message`, `.math-symbols-container`, and `.loading-progress` classes for proper layering.

2. **PlayerWithLoader.tsx**: Wraps the player content with proper z-index values to ensure it appears beneath the loading screen.

## Testing

Use the `/pages/test-loading-screen.tsx` page to test the z-index management system. This page demonstrates:

1. Direct usage of the LoadingScreen component
2. Integration with PlayerWithLoader
3. Proper layering of UI elements

## Best Practices

1. **Always use the defined variables**: Never hardcode z-index values
2. **Follow the hierarchy**: Respect the intended purpose of each z-index range
3. **Use relative positioning**: Position elements relative to others in the same category
4. **Document exceptions**: If you need to deviate from the standard hierarchy, document the reason

## Future Improvements

1. Extend the system to cover all UI components in the application
2. Add more specific utility classes for common components
3. Create a visual reference guide for z-index layers
4. Implement a debug mode to visualize z-index stacking