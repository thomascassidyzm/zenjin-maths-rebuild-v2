/**
 * Content Buffer Enhancer
 * 
 * This module enhances the existing content buffer to properly initialize
 * with bundled content by default, ensuring that:
 * 
 * 1. Anonymous and free users get the same bundled content
 * 2. Bundled content is available immediately without network requests
 * 3. Premium users get their personalized content from the server
 */

import { contentBuffer, StitchContent } from './client/content-buffer';
import { BUNDLED_FULL_CONTENT, DEFAULT_MANIFEST } from './expanded-bundled-content';

/**
 * Enhance the existing content buffer by:
 * 1. Pre-loading the bundled content into the cache
 * 2. Setting up the default manifest
 */
export function enhanceContentBuffer() {
  // Store original initialize method for later use
  const originalInitialize = contentBuffer.initialize.bind(contentBuffer);
  
  // Override the initialize method
  contentBuffer.initialize = async function(isNewUser: boolean = false): Promise<boolean> {
    console.log(`Initializing enhanced content buffer for ${isNewUser ? 'new' : 'returning'} user`);
    
    // Always preload bundled content into the cache
    for (const [id, stitch] of Object.entries(BUNDLED_FULL_CONTENT)) {
      this.cachedStitches[id] = stitch;
    }
    
    // Set the default manifest if we don't have one yet
    if (!this.manifest) {
      this.manifest = DEFAULT_MANIFEST;
    }
    
    // For new/anonymous users, we can skip the API call entirely
    if (isNewUser) {
      this.isInitialized = true;
      console.log(`Using bundled content for new/anonymous user with ${Object.keys(BUNDLED_FULL_CONTENT).length} stitches`);
      return true;
    }
    
    // For returning users, call the original method to get their personalized state
    return originalInitialize.call(this, false);
  };
  
  // Store original getStitch method for later use
  const originalGetStitch = contentBuffer.getStitch.bind(contentBuffer);
  
  // Override the getStitch method to prioritize bundled content
  contentBuffer.getStitch = async function(stitchId: string): Promise<StitchContent | null> {
    // First, check bundled content (fastest)
    if (BUNDLED_FULL_CONTENT[stitchId]) {
      // Store in cache for future reference
      this.cachedStitches[stitchId] = BUNDLED_FULL_CONTENT[stitchId];
      return BUNDLED_FULL_CONTENT[stitchId];
    }
    
    // If not in bundled content, try the original method
    return originalGetStitch.call(this, stitchId);
  };
  
  // Store original updateBuffer method
  const originalUpdateBuffer = contentBuffer.updateBuffer.bind(contentBuffer);
  
  // Override updateBuffer to check bundled content first
  contentBuffer.updateBuffer = async function(userState: any): Promise<void> {
    // Determine which stitches need to be loaded
    const stitchesToLoad = this.getStitchesToBuffer(userState);
    
    if (stitchesToLoad.length === 0) {
      console.log('Buffer is up to date, no new stitches to load');
      return;
    }
    
    // Check which ones are already in bundled content
    const bundledStitches = stitchesToLoad.filter(id => BUNDLED_FULL_CONTENT[id]);
    const missingStitches = stitchesToLoad.filter(id => !BUNDLED_FULL_CONTENT[id]);
    
    // Load bundled stitches into cache
    bundledStitches.forEach(id => {
      this.cachedStitches[id] = BUNDLED_FULL_CONTENT[id];
    });
    
    // If we have all stitches in bundled content, we're done
    if (missingStitches.length === 0) {
      console.log(`Updated buffer with ${bundledStitches.length} bundled stitches`);
      return;
    }
    
    // Otherwise, load missing stitches from API
    console.log(`Loading ${missingStitches.length} non-bundled stitches from API`);
    try {
      // Use a modified version of fetch that only requests missing stitches
      const fetchedStitches = await this.fetchStitches(missingStitches);
      
      // Add them to the cache
      fetchedStitches.forEach(stitch => {
        this.cachedStitches[stitch.id] = stitch;
      });
      
      console.log(`Updated buffer with ${fetchedStitches.length} API stitches and ${bundledStitches.length} bundled stitches`);
    } catch (error) {
      console.error('Failed to update buffer with API stitches:', error);
    }
  };
  
  // Return the enhanced content buffer
  return contentBuffer;
}

// Apply enhancements immediately
enhanceContentBuffer();

export { contentBuffer };