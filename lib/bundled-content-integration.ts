/**
 * Bundled Content Integration
 * 
 * Connects the existing tube-config-integration with the bundled content approach.
 * This is a thin adapter layer that intercepts content loading to use bundled content
 * for anonymous and free users without changing the existing player interface.
 */

import { BUNDLED_FULL_CONTENT, DEFAULT_MANIFEST } from './expanded-bundled-content';
import { contentBuffer } from './client/content-buffer';
import { getUserTier, shouldUseBundledContent } from './player-content-provider';

// Re-export the original integration functions for the methods we're not overriding
import {
  initializeTubeCycler,
  createStitchCompletionHandler,
  monitorContentBuffer, 
  endSession
} from './tube-config-integration';

/**
 * Patch the content buffer's getStitch method to prioritize bundled content
 * for anonymous and free users
 * 
 * @param user The user object
 */
export function patchContentBuffer(user: any) {
  // Store the original getStitch method
  const originalGetStitch = contentBuffer.getStitch.bind(contentBuffer);
  
  // Replace with our patched version
  contentBuffer.getStitch = async (stitchId: string) => {
    // For anonymous and free users, use bundled content
    if (shouldUseBundledContent(user)) {
      // Check if the stitch is in our bundled content
      if (BUNDLED_FULL_CONTENT[stitchId]) {
        return BUNDLED_FULL_CONTENT[stitchId];
      }
      
      // If not in bundled content, try the original method
      console.warn(`Stitch ${stitchId} not found in bundled content, falling back to API`);
    }
    
    // For premium users or as fallback, use the original method
    return originalGetStitch(stitchId);
  };
}

/**
 * Enhanced initialization that sets up bundled content
 * 
 * @param user The user object
 * @param options Additional options
 * @returns The initialized tube cycler adapter
 */
export async function initializeWithBundledContent(user: any, options: any = {}) {
  // Apply our content buffer patch
  patchContentBuffer(user);
  
  // For anonymous and free users, use bundled manifest
  if (shouldUseBundledContent(user)) {
    // We don't need to load the manifest from the server
    contentBuffer.manifest = DEFAULT_MANIFEST;
    
    // Preload all bundled stitches into the cache
    Object.entries(BUNDLED_FULL_CONTENT).forEach(([id, stitch]) => {
      contentBuffer.cachedStitches[id] = stitch;
    });
    
    console.log(`Using bundled content for ${user ? 'free' : 'anonymous'} user`);
  }
  
  // Continue with the original initialization
  return initializeTubeCycler(user, options);
}

/**
 * Replace the imported content buffer functions with our enhanced versions
 * in your existing tube-config-integration.js:
 * 
 * Original:
 * ```
 * import { contentBuffer } from './client/content-buffer';
 * ```
 * 
 * Enhanced:
 * ```
 * import { contentBuffer } from './client/content-buffer';
 * import { patchContentBuffer } from './bundled-content-integration';
 * // Then in your initialization:
 * patchContentBuffer(user);
 * ```
 * 
 * Alternatively, you can directly use this file's initializeWithBundledContent
 * instead of the original initializeTubeCycler.
 */

// Export everything from the original integration for backward compatibility
export {
  initializeTubeCycler,
  createStitchCompletionHandler,
  monitorContentBuffer,
  endSession
};