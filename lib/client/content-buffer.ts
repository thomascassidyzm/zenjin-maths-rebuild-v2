/**
 * Content Buffer Manager
 * 
 * A simplified content buffer system that fetches all content from the server.
 * This replaces the previous offline-first approach with a server-first approach.
 */

import { UserState } from '../state/types';
import { createEmergencyStitch } from '../server-content-provider';

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

// Buffer sizes for two-phase loading
const INITIAL_BUFFER_SIZE = 10;  // First phase: 10 stitches per tube
const COMPLETE_BUFFER_SIZE = 50; // Second phase: Up to 50 stitches per tube

/**
 * Content Buffer Manager
 * 
 * Server-first approach to content loading with two phases:
 * 1. Immediate loading of the active stitch
 * 2. Phase 1: Load 10 stitches per tube for basic interaction
 * 3. Phase 2: Load up to 50 stitches per tube for comprehensive buffering
 */
export class ContentBufferManager {
  private cachedStitches: Record<string, StitchContent> = {};
  private isInitialized = false;
  private activeStitchLoaded = false;
  private phase1Loaded = false;
  private phase2Loaded = false;
  private apiEndpoint = '/api/content/batch';
  
  constructor() {
    // Empty constructor - no initialization needed
  }
  
  /**
   * Initialize the content buffer
   * Simplified process that checks API endpoint and prepares for fetch
   */
  async initialize(isNewUser: boolean = false, user: any = null): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }
    
    try {
      // Simple API check to verify endpoint
      const response = await fetch(`${this.apiEndpoint}?check=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }).catch(() => null);
      
      // Note: Even if API check fails, we still mark as initialized
      // We'll handle fetch errors at fetch time
      this.isInitialized = true;
      
      if (response?.ok) {
        console.log('Content buffer initialized with working API endpoint');
      } else {
        console.warn('Content buffer initialized but API endpoint check failed');
      }
      
      return true;
    } catch (error) {
      console.warn('Error initializing content buffer:', error);
      
      // Still mark as initialized so we can proceed with emergency content
      this.isInitialized = true;
      return true;
    }
  }
  
  /**
   * Get the active stitch from the buffer or fetch it if not available
   * @param userState The current user state
   * @param fetchStitch Function to fetch a single stitch
   */
  async getActiveStitch(
    userState: UserState,
    fetchStitch: (stitchId: string) => Promise<StitchContent | null>
  ): Promise<StitchContent | null> {
    if (!userState?.tubeState) {
      console.warn('Cannot get active stitch: No tube state available');
      return null;
    }
    
    // Get the active tube and current stitch ID
    const activeTubeNum = userState.tubeState.activeTube;
    const tube = userState.tubeState.tubes[activeTubeNum];
    
    if (!tube || !tube.currentStitchId) {
      console.warn(`Cannot get active stitch: No current stitch ID in tube ${activeTubeNum}`);
      return null;
    }
    
    const currentStitchId = tube.currentStitchId;
    
    // Check if the stitch is already in the buffer
    if (this.cachedStitches[currentStitchId]) {
      this.activeStitchLoaded = true;
      return this.cachedStitches[currentStitchId];
    }
    
    // Fetch the stitch from the API
    try {
      console.log(`Fetching active stitch ${currentStitchId} for tube ${activeTubeNum}`);
      const stitch = await fetchStitch(currentStitchId);
      
      if (stitch) {
        // Add to cache
        this.cachedStitches[stitch.id] = stitch;
        this.activeStitchLoaded = true;
        return stitch;
      }
      
      // If fetch fails, create emergency content
      console.warn(`Failed to fetch active stitch ${currentStitchId}, using emergency content`);
      const emergencyStitch = createEmergencyStitch(currentStitchId);
      this.cachedStitches[currentStitchId] = emergencyStitch;
      return emergencyStitch;
    } catch (error) {
      console.error(`Error getting active stitch ${currentStitchId}:`, error);
      
      // Create emergency content for critical case
      const emergencyStitch = createEmergencyStitch(currentStitchId);
      this.cachedStitches[currentStitchId] = emergencyStitch;
      return emergencyStitch;
    }
  }
  
  /**
   * Fill the initial buffer with 10 stitches per tube (Phase 1)
   * @param userState The current user state
   * @param fetchStitchBatch Function to fetch multiple stitches
   */
  async fillInitialBuffer(
    userState: UserState,
    fetchStitchBatch: (stitchIds: string[]) => Promise<Record<string, StitchContent>>
  ): Promise<void> {
    if (!userState?.tubeState) {
      console.warn('Cannot fill initial buffer: No tube state available');
      return;
    }
    
    if (this.phase1Loaded) {
      console.log('Initial buffer already loaded, skipping');
      return;
    }
    
    // For each tube (1, 2, 3), collect the first 10 stitches
    const stitchesToFetch: string[] = [];
    
    for (let tubeNum = 1; tubeNum <= 3; tubeNum++) {
      const tube = userState.tubeState.tubes[tubeNum];
      if (!tube || !tube.stitchOrder || tube.stitchOrder.length === 0) {
        continue;
      }
      
      // Active stitch should always be included first
      if (tube.currentStitchId && !stitchesToFetch.includes(tube.currentStitchId)) {
        stitchesToFetch.push(tube.currentStitchId);
      }
      
      // Get up to INITIAL_BUFFER_SIZE stitches
      const initialStitches = tube.stitchOrder.slice(0, INITIAL_BUFFER_SIZE);
      initialStitches.forEach(stitchId => {
        if (stitchId && !stitchesToFetch.includes(stitchId) && !this.cachedStitches[stitchId]) {
          stitchesToFetch.push(stitchId);
        }
      });
    }
    
    // If there's nothing to fetch, we're done
    if (stitchesToFetch.length === 0) {
      this.phase1Loaded = true;
      console.log('No stitches needed for initial buffer (Phase 1)');
      return;
    }
    
    // Fetch the stitches
    try {
      console.log(`Phase 1: Fetching initial buffer of ${stitchesToFetch.length} stitches`);
      const stitches = await fetchStitchBatch(stitchesToFetch);
      
      // Add fetched stitches to the cache
      Object.values(stitches).forEach(stitch => {
        this.cachedStitches[stitch.id] = stitch;
      });
      
      this.phase1Loaded = true;
      console.log(`Phase 1: Successfully loaded ${Object.keys(stitches).length} stitches`);
    } catch (error) {
      console.error('Error filling initial buffer:', error);
      
      // Create emergency content for critical stitches
      stitchesToFetch.forEach(stitchId => {
        if (!this.cachedStitches[stitchId]) {
          this.cachedStitches[stitchId] = createEmergencyStitch(stitchId);
        }
      });
    }
  }
  
  /**
   * Fill the complete buffer with up to 50 stitches per tube (Phase 2)
   * @param userState The current user state
   * @param fetchStitchBatch Function to fetch multiple stitches
   */
  async fillCompleteBuffer(
    userState: UserState,
    fetchStitchBatch: (stitchIds: string[]) => Promise<Record<string, StitchContent>>
  ): Promise<void> {
    if (!userState?.tubeState) {
      console.warn('Cannot fill complete buffer: No tube state available');
      return;
    }
    
    if (this.phase2Loaded) {
      console.log('Complete buffer already loaded, skipping');
      return;
    }
    
    // Make sure Phase 1 is loaded first
    if (!this.phase1Loaded) {
      await this.fillInitialBuffer(userState, fetchStitchBatch);
    }
    
    // For each tube (1, 2, 3), collect stitches beyond the initial buffer
    const stitchesToFetch: string[] = [];
    
    for (let tubeNum = 1; tubeNum <= 3; tubeNum++) {
      const tube = userState.tubeState.tubes[tubeNum];
      if (!tube || !tube.stitchOrder || tube.stitchOrder.length <= INITIAL_BUFFER_SIZE) {
        continue;
      }
      
      // Get stitches from position 10 to 50
      const additionalStitches = tube.stitchOrder.slice(INITIAL_BUFFER_SIZE, COMPLETE_BUFFER_SIZE);
      additionalStitches.forEach(stitchId => {
        if (stitchId && !stitchesToFetch.includes(stitchId) && !this.cachedStitches[stitchId]) {
          stitchesToFetch.push(stitchId);
        }
      });
    }
    
    // If there's nothing to fetch, we're done
    if (stitchesToFetch.length === 0) {
      this.phase2Loaded = true;
      console.log('No additional stitches needed for complete buffer (Phase 2)');
      return;
    }
    
    // Fetch the stitches
    try {
      console.log(`Phase 2: Fetching additional ${stitchesToFetch.length} stitches`);
      const stitches = await fetchStitchBatch(stitchesToFetch);
      
      // Add fetched stitches to the cache
      Object.values(stitches).forEach(stitch => {
        this.cachedStitches[stitch.id] = stitch;
      });
      
      this.phase2Loaded = true;
      console.log(`Phase 2: Successfully loaded ${Object.keys(stitches).length} additional stitches`);
    } catch (error) {
      console.error('Error filling complete buffer:', error);
      
      // Create emergency content for critical stitches 
      // (less critical in Phase 2, so we don't create emergency content for all)
      const criticalStitches = stitchesToFetch.slice(0, 5); // Just create for the first 5
      criticalStitches.forEach(stitchId => {
        if (!this.cachedStitches[stitchId]) {
          this.cachedStitches[stitchId] = createEmergencyStitch(stitchId);
        }
      });
    }
  }
  
  /**
   * Get a stitch from the buffer or fetch it if not available
   * @param stitchId The ID of the stitch to get
   * @param fetchStitch Function to fetch a single stitch
   */
  async getStitch(
    stitchId: string,
    fetchStitch: (stitchId: string) => Promise<StitchContent | null>
  ): Promise<StitchContent | null> {
    if (!stitchId) {
      return null;
    }
    
    // Check if the stitch is already in the buffer
    if (this.cachedStitches[stitchId]) {
      return this.cachedStitches[stitchId];
    }
    
    // Fetch the stitch
    try {
      console.log(`Fetching stitch ${stitchId}`);
      const stitch = await fetchStitch(stitchId);
      
      if (stitch) {
        // Add to cache
        this.cachedStitches[stitch.id] = stitch;
        return stitch;
      }
      
      console.warn(`Failed to fetch stitch ${stitchId}`);
      return null;
    } catch (error) {
      console.error(`Error fetching stitch ${stitchId}:`, error);
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
    
    // Use getStitch method with a simple wrapper for fetchSingleStitch
    return this.getStitch(activeTube.currentStitchId, async (stitchId) => {
      try {
        // Simple implementation for compatibility - in real usage, the Zustand store's fetchStitch would be used
        const response = await fetch(`/api/content/stitch/${stitchId}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.success ? data.stitch : null;
      } catch (error) {
        console.error(`Error fetching stitch ${stitchId}:`, error);
        return null;
      }
    });
  }
  
  /**
   * Get the buffer status (for diagnostic purposes)
   */
  getBufferStatus() {
    return {
      activeStitchLoaded: this.activeStitchLoaded,
      phase1Loaded: this.phase1Loaded,
      phase2Loaded: this.phase2Loaded,
      cachedStitchCount: Object.keys(this.cachedStitches).length,
      isInitialized: this.isInitialized
    };
  }
  
  /**
   * Clear the buffer cache
   */
  clearCache() {
    this.cachedStitches = {};
    this.activeStitchLoaded = false;
    this.phase1Loaded = false;
    this.phase2Loaded = false;
    console.log('Content buffer cache cleared');
  }
}

// Create a singleton instance
export const contentBuffer = new ContentBufferManager();