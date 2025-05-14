# Version Badge System

This document explains the version badge system implemented in the Zenjin Maths application to help with deployment verification and cache invalidation testing.

## Overview

The version badge system provides a visual indicator of the currently running application version in the bottom right corner of every page. This helps:

1. Verify that deployments have been successful
2. Confirm that you're viewing the latest version (not a cached version)
3. Track which version is running in different environments
4. Identify when CDN or browser caching is preventing updates

## How It Works

The version badge shows both the package version (from package.json) and a build ID derived from the build timestamp. 

- **Package Version**: Incremented automatically with each build (e.g., `1.0.23`)
- **Build ID**: Generated in the format `YYMMDD-HHMM` (e.g., `250514-1423`)

When you click the badge, it expands to show more detailed information:
- Full version number
- Build ID
- Deployment timestamp

## Automatic Version Incrementation

The system is set up to automatically increment the patch version in package.json before each build:

1. Before building, the `scripts/update-build-version.js` script runs
2. It reads the current version from package.json
3. Increments the patch version (e.g., 1.0.0 → 1.0.1)
4. Updates package.json with the new version
5. Adds a buildTimestamp property with the current date/time
6. The VersionBadge component reads this information at runtime

## Implementation Details

The system consists of:

1. **VersionBadge Component** (`/components/VersionBadge.tsx`):
   - Displays the current version info
   - Toggles between compact and expanded view
   - Uses z-index to ensure it's always visible

2. **Version Update Script** (`/scripts/update-build-version.js`):
   - Automatically increments the patch version
   - Adds a buildTimestamp to package.json

3. **App Integration** (`/pages/_app.tsx`):
   - Includes the VersionBadge component globally
   - Ensures it appears on all pages

## Usage During Development/Testing

When testing new deployments:

1. Look for the version badge in the bottom right corner
2. Verify that the version/build ID matches what you expect
3. If you don't see the updated version, you may be viewing a cached version

If you suspect you're viewing a cached version:

1. Try a hard refresh (Ctrl+F5 or Cmd+Shift+R)
2. Clear your browser cache
3. Try accessing the site in an incognito/private window
4. Check if the CDN is serving cached content

## Manual Version Update

You can manually update the version by running:

```bash
npm run increment-version
```

This is useful if you need to force a version change without rebuilding the entire application.

## Customizing the Badge

You can customize the badge by passing props to the VersionBadge component:

```jsx
// Show detailed version by default
<VersionBadge detailed={true} />

// Change position
<VersionBadge className="fixed top-4 left-4" />
```

## Future Improvements

Potential future enhancements:

1. Add environment indicator (dev/staging/production)
2. Include Git commit hash in version info
3. Add ability to toggle visibility with keyboard shortcut
4. Implement automatic cache busting based on version changes