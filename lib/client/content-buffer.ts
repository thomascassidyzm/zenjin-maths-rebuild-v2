/**
 * Content Buffer Manager
 * 
 * Handles efficient loading, caching, and management of stitch content
 * based on the user's state. Maintains a buffer of upcoming stitches
 * to ensure smooth gameplay.
 */

import { UserState } from '../state/types';
import { BUNDLED_INITIAL_STITCHES, DEFAULT_MANIFEST } from '../bundled-content';

// Types
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

// Override UserState from types with position-based format for the content buffer
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
const BUFFER_SIZE = 5;

/**
 * Content Buffer Manager
 * 
 * Handles efficient loading and caching of stitch content
 */
export class ContentBufferManager {
  private manifest: ContentManifest | null = null;
  private cachedStitches: Record<string, StitchContent> = {};
  private isLoadingManifest = false;
  private isInitialized = false;
  
  /**
   * Initialize the content buffer
   * @param isNewUser Optional flag to indicate this is a brand new user or anonymous user
   */
  async initialize(isNewUser: boolean = false): Promise<boolean> {
    if (this.isInitialized) return true;
    
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
   * Load the content manifest from the server
   * Falls back to bundled default manifest if server request fails
   * 
   * @param isNewUser Optional flag to indicate this is a brand new user (anonymous or just signed up)
   */
  async loadManifest(isNewUser: boolean = false): Promise<ContentManifest> {
    if (this.isLoadingManifest) {
      // Wait for existing load to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      if (this.manifest) return this.manifest;
    }
    
    this.isLoadingManifest = true;
    
    try {
      // For new users and anonymous users, we can start with the bundled manifest
      // This provides immediate content while we try to load from the server
      if (isNewUser) {
        this.manifest = DEFAULT_MANIFEST;
        
        // Initialize bundled stitches in the cache
        Object.entries(BUNDLED_INITIAL_STITCHES).forEach(([id, stitch]) => {
          this.cachedStitches[id] = stitch;
        });
        
        console.log(`Using bundled manifest for new/anonymous user with ${this.manifest.stats.stitchCount} stitches`);
      }
      
      // Always attempt to load from API - for returning users this is critical
      // as it contains their specific progress state
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
        
        // Replace any existing manifest with the server version
        // For returning users, this contains their specific progress
        this.manifest = data.manifest;
        console.log(`API manifest loaded with ${this.manifest.stats.stitchCount} stitches`);
      } catch (apiError) {
        // Critical error for returning users who need their state
        // Non-critical only for new users who can use the bundled content
        if (!isNewUser || !this.manifest) {
          console.error('Critical API error for returning user:', apiError);
          
          // If we have no manifest at all (not even bundled), create a minimal default
          if (!this.manifest) {
            console.warn('Falling back to bundled manifest due to API failure');
            this.manifest = DEFAULT_MANIFEST;
            
            // Initialize bundled stitches as a last resort
            Object.entries(BUNDLED_INITIAL_STITCHES).forEach(([id, stitch]) => {
              this.cachedStitches[id] = stitch;
            });
          }
        } else {
          // For new users, we already have the bundled manifest, so this is non-critical
          console.warn('Using bundled manifest for new user due to API error:', apiError);
        }
      }
      
      this.isLoadingManifest = false;
      return this.manifest;
    } catch (error) {
      this.isLoadingManifest = false;
      console.error('Error in loadManifest:', error);
      throw error;
    }
  }
  
  /**
   * Determine which stitches need to be loaded based on user state
   */
  getStitchesToBuffer(userState: UserState): string[] {
    if (!this.manifest) {
      console.warn('Cannot determine stitches to buffer: manifest not loaded');
      return [];
    }
    
    const stitchesToLoad: string[] = [];
    
    // First, ensure we have the active stitch for each tube
    Object.entries(userState.tubes).forEach(([tubeNumber, tubeState]) => {
      // Convert from standard UserState to ContentBufferUserState format
      // In the standard format, currentStitchId is the active stitch
      const currentStitchId = tubeState.currentStitchId;
      
      // Always include the current stitch ID
      if (currentStitchId && !this.cachedStitches[currentStitchId]) {
        stitchesToLoad.push(currentStitchId);
      }
      
      // Get the next upcoming stitches for this tube from the manifest
      // Since we don't have position info in standard state, use manifest for ordering
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
   */
  async fetchStitches(stitchIds: string[]): Promise<StitchContent[]> {
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
      throw error;
    }
  }
  
  /**
   * Update the buffer based on current user state
   */
  async updateBuffer(userState: UserState): Promise<void> {
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
   * Get a stitch from the cache, bundled content, or API
   * Prioritizes: 1) Cache, 2) Bundled content, 3) API
   */
  async getStitch(stitchId: string): Promise<StitchContent | null> {
    // 1. Return from cache if available (fastest)
    if (this.cachedStitches[stitchId]) {
      return this.cachedStitches[stitchId];
    }
    
    // 2. Check bundled content (almost as fast as cache)
    if (BUNDLED_INITIAL_STITCHES[stitchId]) {
      const bundledStitch = BUNDLED_INITIAL_STITCHES[stitchId];
      this.cachedStitches[stitchId] = bundledStitch;
      return bundledStitch;
    }
    
    // 3. Finally, try to load from API
    try {
      const [stitch] = await this.fetchStitches([stitchId]);
      
      if (stitch) {
        this.cachedStitches[stitchId] = stitch;
        return stitch;
      }
      
      // If we can't get it from API, check if it's one of the first stitches
      // where we could generate emergency content as a last resort
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
      
      return null;
    } catch (error) {
      console.error(`Failed to get stitch ${stitchId}:`, error);
      
      // Last resort fallback for network errors
      if (stitchId.includes('-001-01')) {
        console.warn(`Using fallback content for ${stitchId} due to network error`);
        // Create a very basic fallback stitch
        const fallbackStitch: StitchContent = {
          id: stitchId,
          threadId: stitchId.replace(/-\d+$/, ''),
          title: 'Offline Content',
          content: 'This content is available offline.',
          order: 1,
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
   * Clear the stitch cache
   */
  clearCache(): void {
    this.cachedStitches = {};
    console.log('Content buffer cache cleared');
  }
}

// Create a singleton instance
export const contentBuffer = new ContentBufferManager();