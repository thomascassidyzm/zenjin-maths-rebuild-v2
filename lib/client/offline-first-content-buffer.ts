/**
 * Offline-First Content Buffer Manager
 * 
 * An enhanced version of the ContentBufferManager that prioritizes bundled content
 * and provides immediate access without waiting for network requests.
 * 
 * Key differences from standard content-buffer:
 * 1. Uses expanded-bundled-content with 10 stitches per tube
 * 2. Initializes synchronously with bundled content
 * 3. Only attempts API calls after initial content is available
 * 4. Provides identical content for anonymous and free users
 */

import { UserState } from '../state/types';
import { BUNDLED_FULL_CONTENT, DEFAULT_MANIFEST } from '../expanded-bundled-content';
import { isFeatureEnabled } from '../feature-flags';

// Types - keeping same interface as original content-buffer
export interface StitchReference {
  id: string;
  order: number;
  title?: string;
}

export interface ThreadManifest {
  title: string;
  stitches: StitchReference[];
}

export interface TubeManifest {
  threads: Record<string, ThreadManifest>;
}

export interface ContentManifest {
  version: number;
  generated: string;
  tubes: Record<string, TubeManifest>;
  stats: {
    tubeCount: number;
    threadCount: number;
    stitchCount: number;
  };
}

export interface ContentBufferUserState {
  userId: string;
  tubes: Record<string, {
    threadId: string;
    currentStitchId: string;
    stitches: Array<{
      id: string;
      threadId: string;
      position: number;
      skipNumber: number;
      distractorLevel: string;
    }>;
  }>;
  activeTubeNumber: number;
  lastUpdated: string;
}

export interface StitchContent {
  id: string;
  threadId: string;
  title: string;
  content: string;
  order: number;
  questions: any[];
}

// Buffer size - how many stitches to keep loaded per tube
const BUFFER_SIZE = 10;

/**
 * Offline-First Content Buffer Manager
 * 
 * Provides immediate access to content without waiting for network requests
 */
export class OfflineFirstContentBuffer {
  private manifest: ContentManifest = DEFAULT_MANIFEST;
  private cachedStitches: Record<string, StitchContent> = {};
  private isLoadingManifest = false;
  private isInitialized = true; // Start as initialized with bundled content
  private isAnonymousOrFreeUser = true; // Default assumption
  
  constructor() {
    // Initialize the cache with all bundled content immediately
    this.initializeBundledContent();
  }
  
  /**
   * Pre-load all bundled content into the cache for immediate access
   */
  private initializeBundledContent(): void {
    // Load all bundled stitches into the cache
    Object.entries(BUNDLED_FULL_CONTENT).forEach(([id, stitch]) => {
      this.cachedStitches[id] = stitch;
    });
    
    console.log(`Initialized offline-first content buffer with ${Object.keys(this.cachedStitches).length} bundled stitches`);
  }
  
  /**
   * Initialize the content buffer - mostly a no-op since we initialize in constructor
   * But keeps API compatibility with the original ContentBufferManager
   * 
   * @param isNewUser Optional flag to indicate this is a brand new user or anonymous user
   */
  async initialize(isNewUser: boolean = false, user: any = null): Promise<boolean> {
    // Check if user is anonymous or free tier
    this.isAnonymousOrFreeUser = !user || (user && !user.isPremium);
    
    // If already initialized with bundled content, we're good to go
    if (this.isInitialized) {
      // For authenticated premium users, try to load their personalized manifest
      // This happens in the background and doesn't block the UI
      if (user && user.isPremium) {
        this.loadManifestFromAPI().catch(error => {
          console.warn('Failed to load personalized manifest for premium user:', error);
        });
      }
      return true;
    }
    
    // Should never reach here since we pre-initialize, but keeping for API compatibility
    try {
      await this.loadManifest(isNewUser);
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize content buffer:', error);
      return false;
    }
  }
  
  /**
   * Load the content manifest - prioritizes bundled content for anonymous and free users
   * @param isNewUser Optional flag to indicate this is a brand new user
   */
  async loadManifest(isNewUser: boolean = false): Promise<ContentManifest> {
    // For anonymous and free users, we always use the bundled manifest
    // and don't even try to load from API if feature flag is enabled
    if (this.isAnonymousOrFreeUser && isFeatureEnabled('useBundledContentForFreeUsers')) {
      this.manifest = DEFAULT_MANIFEST;
      console.log(`Using bundled manifest for anonymous/free user with ${this.manifest.stats.stitchCount} stitches`);
      return this.manifest;
    }
    
    // For premium users, try to load from API
    if (this.isLoadingManifest) {
      // Wait for existing load to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      if (this.manifest) return this.manifest;
    }
    
    try {
      return await this.loadManifestFromAPI();
    } catch (error) {
      console.error('Error in loadManifest:', error);
      throw error;
    }
  }
  
  /**
   * Load manifest from API - only for premium users
   * This is a separate method to handle API loading logic
   */
  private async loadManifestFromAPI(): Promise<ContentManifest> {
    this.isLoadingManifest = true;
    
    try {
      // Load manifest from API
      const response = await fetch('/api/content/manifest');
      
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.manifest) {
        throw new Error(data.error || 'Failed to load content manifest');
      }
      
      // Store the API manifest only for premium users
      if (!this.isAnonymousOrFreeUser) {
        this.manifest = data.manifest;
        console.log(`API manifest loaded with ${this.manifest.stats.stitchCount} stitches`);
      } else {
        console.log('Ignoring API manifest for anonymous/free user, keeping bundled content');
      }
      
      this.isLoadingManifest = false;
      return this.manifest;
    } catch (apiError) {
      this.isLoadingManifest = false;
      console.warn('Using bundled manifest due to API error:', apiError);
      return this.manifest; // Return the bundled manifest as fallback
    }
  }
  
  /**
   * Determine which stitches need to be loaded based on user state
   */
  getStitchesToBuffer(userState: UserState): string[] {
    // For anonymous and free users with the feature flag enabled,
    // we don't load additional stitches beyond the bundled ones
    if (this.isAnonymousOrFreeUser && isFeatureEnabled('useBundledContentForFreeUsers')) {
      return []; // All necessary content is already bundled
    }
    
    if (!this.manifest) {
      console.warn('Cannot determine stitches to buffer: manifest not loaded');
      return [];
    }
    
    const stitchesToLoad: string[] = [];
    
    // For premium users, implement the buffer logic
    Object.entries(userState.tubes).forEach(([tubeNumber, tubeState]) => {
      const currentStitchId = tubeState.currentStitchId;
      
      // Always include the current stitch ID if not in cache
      if (currentStitchId && !this.cachedStitches[currentStitchId]) {
        stitchesToLoad.push(currentStitchId);
      }
      
      // For premium users, get upcoming stitches from the manifest
      const upcomingStitches = this.getUpcomingStitchesFromManifest(
        parseInt(tubeNumber, 10), 
        tubeState.threadId, 
        currentStitchId
      );
      
      // Add any uncached stitches to the loading list
      upcomingStitches.forEach(stitchId => {
        if (!this.cachedStitches[stitchId] && !stitchesToLoad.includes(stitchId)) {
          stitchesToLoad.push(stitchId);
        }
      });
    });
    
    return stitchesToLoad;
  }
  
  /**
   * Get the upcoming stitches for a specific tube based on manifest order
   */
  getUpcomingStitchesFromManifest(tubeNumber: number, threadId: string, currentStitchId: string): string[] {
    if (!this.manifest) return [];
    
    // Get the tube manifest
    const tubeManifest = this.manifest.tubes[tubeNumber];
    if (!tubeManifest) return [];
    
    // Get the thread manifest
    const threadManifest = tubeManifest.threads[threadId];
    if (!threadManifest) return [];
    
    // Find the current stitch in the ordered list
    const stitches = threadManifest.stitches;
    const currentIndex = stitches.findIndex(s => s.id === currentStitchId);
    
    if (currentIndex === -1) return [];
    
    // Get the next BUFFER_SIZE stitches after the current one
    return stitches
      .slice(currentIndex + 1, currentIndex + 1 + BUFFER_SIZE)
      .map(s => s.id);
  }
  
  /**
   * Get the upcoming stitches for a specific tube based on position-based state
   * For compatibility with the position-based model when it's available
   */
  getUpcomingStitches(userState: ContentBufferUserState, tubeNumber: number): string[] {
    const tubeState = userState.tubes[tubeNumber];
    if (!tubeState) return [];
    
    // Get stitches sorted by position (lowest first)
    const sortedStitches = [...tubeState.stitches]
      .sort((a, b) => a.position - b.position);
    
    // Find the current position (should be 0)
    const currentIndex = sortedStitches.findIndex(s => s.id === tubeState.currentStitchId);
    
    if (currentIndex === -1) return [];
    
    // Get the next BUFFER_SIZE stitches after the current one
    return sortedStitches
      .slice(currentIndex + 1, currentIndex + 1 + BUFFER_SIZE)
      .map(s => s.id);
  }
  
  /**
   * Fetch a batch of stitches from the server
   * Only used for premium users, anonymous/free users use bundled content
   */
  async fetchStitches(stitchIds: string[]): Promise<StitchContent[]> {
    // For anonymous and free users with the feature flag enabled,
    // we don't fetch from the server
    if (this.isAnonymousOrFreeUser && isFeatureEnabled('useBundledContentForFreeUsers')) {
      // Filter only the IDs that are in our bundled content
      const bundledStitches = stitchIds
        .filter(id => BUNDLED_FULL_CONTENT[id])
        .map(id => BUNDLED_FULL_CONTENT[id]);
      
      return bundledStitches;
    }
    
    if (stitchIds.length === 0) return [];
    
    try {
      const response = await fetch('/api/content/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stitchIds })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stitches: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch stitches');
      }
      
      return data.stitches || [];
    } catch (error) {
      console.error('Error fetching stitches:', error);
      
      // Fallback to bundled content for any matching IDs
      const fallbackStitches = stitchIds
        .filter(id => BUNDLED_FULL_CONTENT[id])
        .map(id => BUNDLED_FULL_CONTENT[id]);
      
      if (fallbackStitches.length > 0) {
        console.log(`Using ${fallbackStitches.length} bundled stitches as fallback`);
        return fallbackStitches;
      }
      
      throw error;
    }
  }
  
  /**
   * Update the buffer based on current user state
   * For premium users only - free/anon users use bundled content
   */
  async updateBuffer(userState: UserState): Promise<void> {
    // For anonymous and free users with the feature flag enabled,
    // we don't update the buffer from the server
    if (this.isAnonymousOrFreeUser && isFeatureEnabled('useBundledContentForFreeUsers')) {
      return;
    }
    
    // Make sure we have the manifest
    if (!this.manifest) {
      await this.loadManifest();
    }
    
    // Determine which stitches need to be loaded
    const stitchesToLoad = this.getStitchesToBuffer(userState);
    
    if (stitchesToLoad.length === 0) {
      console.log('Buffer is up to date, no new stitches to load');
      return;
    }
    
    console.log(`Loading ${stitchesToLoad.length} stitches to update buffer`);
    
    // Fetch the needed stitches
    try {
      const fetchedStitches = await this.fetchStitches(stitchesToLoad);
      
      // Add them to the cache
      fetchedStitches.forEach(stitch => {
        this.cachedStitches[stitch.id] = stitch;
      });
      
      console.log(`Updated buffer with ${fetchedStitches.length} new stitches`);
    } catch (error) {
      console.error('Failed to update buffer:', error);
    }
  }
  
  /**
   * Get a stitch from the cache or bundled content, prioritizing immediate availability
   * This is the key method that makes the system work offline-first
   */
  async getStitch(stitchId: string): Promise<StitchContent | null> {
    // 1. Return from cache if available (fastest)
    if (this.cachedStitches[stitchId]) {
      return this.cachedStitches[stitchId];
    }
    
    // 2. Check expanded bundled content (almost as fast as cache)
    if (BUNDLED_FULL_CONTENT[stitchId]) {
      const bundledStitch = BUNDLED_FULL_CONTENT[stitchId];
      this.cachedStitches[stitchId] = bundledStitch;
      return bundledStitch;
    }
    
    // 3. For premium users only, try to load from API
    if (!this.isAnonymousOrFreeUser) {
      try {
        const [stitch] = await this.fetchStitches([stitchId]);
        
        if (stitch) {
          this.cachedStitches[stitchId] = stitch;
          return stitch;
        }
      } catch (error) {
        console.error(`Failed to get stitch ${stitchId} from API:`, error);
      }
    }
    
    // 4. Generate a fallback stitch as last resort
    return this.generateFallbackStitch(stitchId);
  }
  
  /**
   * Generate a fallback stitch when all other methods fail
   */
  private generateFallbackStitch(stitchId: string): StitchContent | null {
    // Check if this is a first stitch of a tube (pattern: stitch-T{n}-001-01)
    const tubeMatch = stitchId.match(/stitch-T(\d+)-001-01/);
    if (tubeMatch) {
      const tubeNumber = tubeMatch[1];
      console.warn(`Using generated content for first stitch of tube ${tubeNumber}`);
      
      // Generate a simple stitch with minimal content
      const emergencyStitch: StitchContent = {
        id: stitchId,
        threadId: `thread-T${tubeNumber}-001`,
        title: `Basic Content for Tube ${tubeNumber}`,
        content: `Basic content for learning tube ${tubeNumber}`,
        order: 1,
        questions: [
          {
            id: `${stitchId}-q01`,
            text: 'What is 2 + 2?',
            correctAnswer: '4',
            distractors: { L1: '3', L2: '5', L3: '6' }
          }
        ]
      };
      
      this.cachedStitches[stitchId] = emergencyStitch;
      return emergencyStitch;
    }
    
    // Last resort fallback for non-first stitches
    if (stitchId.includes('-001-')) {
      console.warn(`Using fallback content for ${stitchId}`);
      
      // Extract thread and tube info from the ID
      const threadMatch = stitchId.match(/stitch-T(\d+)-(\d+)/);
      const tubeNumber = threadMatch ? threadMatch[1] : '1';
      const threadNumber = threadMatch ? threadMatch[2] : '001';
      
      // Create a very basic fallback stitch
      const fallbackStitch: StitchContent = {
        id: stitchId,
        threadId: `thread-T${tubeNumber}-${threadNumber}`,
        title: 'Offline Content',
        content: 'This content is available offline.',
        order: parseInt(stitchId.split('-').pop() || '1', 10),
        questions: [
          {
            id: `${stitchId}-fallback-q01`,
            text: 'What is 1 + 1?',
            correctAnswer: '2',
            distractors: { L1: '3', L2: '1', L3: '0' }
          }
        ]
      };
      
      this.cachedStitches[stitchId] = fallbackStitch;
      return fallbackStitch;
    }
    
    return null;
  }
  
  /**
   * Get the in-play stitch (the active stitch of the active tube)
   */
  async getInPlayStitch(userState: UserState): Promise<StitchContent | null> {
    // For standard state, the active tube is activeTube
    const activeTubeNumber = userState.activeTube || userState.activeTubeNumber;
    const activeTube = userState.tubes[activeTubeNumber];
    
    if (!activeTube) {
      console.error(`Active tube ${activeTubeNumber} not found in user state`);
      return null;
    }
    
    return this.getStitch(activeTube.currentStitchId);
  }
  
  /**
   * Set whether the current user is anonymous/free or premium
   * This affects content buffering behavior
   * 
   * @param isAnonymousOrFree Whether user is anonymous or free tier
   */
  setUserTier(isAnonymousOrFree: boolean): void {
    this.isAnonymousOrFreeUser = isAnonymousOrFree;
    console.log(`User tier set to ${isAnonymousOrFree ? 'anonymous/free' : 'premium'}`);
  }
  
  /**
   * Clear the stitch cache
   */
  clearCache(): void {
    // Re-initialize with just the bundled content
    this.cachedStitches = {};
    this.initializeBundledContent();
    console.log('Content buffer cache cleared and re-initialized with bundled content');
  }
  
  /**
   * Get the count of cached stitches (for diagnostic purposes)
   */
  getCachedStitchCount(): number {
    return Object.keys(this.cachedStitches).length;
  }
}

// Create a singleton instance
export const offlineFirstContentBuffer = new OfflineFirstContentBuffer();