/**
 * Active Stitch Loader
 * 
 * This module provides functions for loading the minimal active content needed
 * to start the player, then progressively loading more content as needed.
 */

import { StitchContent } from './offline-first-content-buffer';

/**
 * Fetches only the active stitch for immediate player startup
 * @param userId The user's ID
 * @param tubeNumber The active tube number (1-3)
 * @param stitchId The active stitch ID
 * @returns Promise that resolves to the stitch content, or null if not found
 */
export async function fetchActiveStitch(
  userId: string, 
  tubeNumber: number, 
  stitchId: string
): Promise<StitchContent | null> {
  if (!userId || !stitchId) {
    console.error('fetchActiveStitch: Missing required parameters');
    return null;
  }

  console.log(`Fetching active stitch ${stitchId} for user ${userId} in tube ${tubeNumber}`);
  
  try {
    // Use the stitch API endpoint with authentication headers
    const authHeader = userId.startsWith('anonymous') 
      ? { 'X-Anonymous-ID': userId }
      : { 'Authorization': `Bearer ${userId}` };
    
    const response = await fetch(`/api/content/stitch/${encodeURIComponent(stitchId)}?priority=high`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader
      }
    });

    if (!response.ok) {
      console.error(`Error fetching active stitch: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // Verify we got valid content
    if (!data || !data.content || !data.id) {
      console.error('Invalid stitch content received:', data);
      return null;
    }
    
    console.log(`Successfully fetched active stitch ${stitchId}`);
    
    return {
      id: data.id,
      title: data.title || '',
      content: data.content,
      questions: data.questions || [],
      tubeNumber,
      threadId: data.threadId || `thread-T${tubeNumber}-001`
    };
  } catch (error) {
    console.error('Error fetching active stitch:', error);
    return null;
  }
}

/**
 * Fetches initial batch of stitches for a tube (first 10 by default)
 * This is called immediately after loading the active stitch
 * @param userId The user's ID
 * @param tubeNumber The tube number (1-3)
 * @param count Number of stitches to fetch (default: 10)
 * @returns Promise that resolves to a record of stitch contents
 */
export async function fetchInitialStitches(
  userId: string,
  tubeNumber: number,
  count: number = 10
): Promise<Record<string, StitchContent>> {
  if (!userId || !tubeNumber) {
    console.error('fetchInitialStitches: Missing required parameters');
    return {};
  }

  console.log(`Fetching initial ${count} stitches for tube ${tubeNumber}`);
  
  try {
    // Use the batch API endpoint with authentication headers
    const authHeader = userId.startsWith('anonymous') 
      ? { 'X-Anonymous-ID': userId }
      : { 'Authorization': `Bearer ${userId}` };
    
    const response = await fetch(`/api/content/batch?tubeNumber=${tubeNumber}&count=${count}&priority=medium`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader
      }
    });

    if (!response.ok) {
      console.error(`Error fetching initial stitches: ${response.status} ${response.statusText}`);
      return {};
    }

    const data = await response.json();
    
    if (!data || !data.stitches || Object.keys(data.stitches).length === 0) {
      console.error('Invalid or empty batch content received:', data);
      return {};
    }
    
    console.log(`Successfully fetched ${Object.keys(data.stitches).length} initial stitches for tube ${tubeNumber}`);
    
    return data.stitches;
  } catch (error) {
    console.error('Error fetching initial stitches:', error);
    return {};
  }
}

/**
 * Fetches extended batch of stitches for offline support (up to 50 by default)
 * This is called in the background after the initial batch is loaded
 * @param userId The user's ID
 * @param tubeNumber The tube number (1-3)
 * @param count Maximum number of stitches to fetch (default: 50)
 * @returns Promise that resolves to a record of stitch contents
 */
export async function fetchExtendedStitches(
  userId: string,
  tubeNumber: number,
  count: number = 50
): Promise<Record<string, StitchContent>> {
  if (!userId || !tubeNumber) {
    console.error('fetchExtendedStitches: Missing required parameters');
    return {};
  }

  console.log(`Fetching extended ${count} stitches for tube ${tubeNumber}`);
  
  try {
    // Use the batch API endpoint with authentication headers
    const authHeader = userId.startsWith('anonymous') 
      ? { 'X-Anonymous-ID': userId }
      : { 'Authorization': `Bearer ${userId}` };
    
    const response = await fetch(`/api/content/batch?tubeNumber=${tubeNumber}&count=${count}&priority=low`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader
      }
    });

    if (!response.ok) {
      console.error(`Error fetching extended stitches: ${response.status} ${response.statusText}`);
      return {};
    }

    const data = await response.json();
    
    if (!data || !data.stitches || Object.keys(data.stitches).length === 0) {
      console.error('Invalid or empty batch content received:', data);
      return {};
    }
    
    console.log(`Successfully fetched ${Object.keys(data.stitches).length} extended stitches for tube ${tubeNumber}`);
    
    return data.stitches;
  } catch (error) {
    console.error('Error fetching extended stitches:', error);
    return {};
  }
}

/**
 * Progressive Content Manager
 * Manages the loading of content in stages to optimize bandwidth and user experience
 */
export class ProgressiveContentManager {
  private userId: string;
  private contentBuffer: Map<string, StitchContent> = new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();
  private loadedTubes: Set<number> = new Set();
  private initialLoadComplete: boolean = false;
  private extendedLoadComplete: boolean = false;
  
  constructor(userId: string) {
    this.userId = userId;
    console.log(`ProgressiveContentManager initialized for user ${userId}`);
  }
  
  /**
   * Gets the active stitch and immediately starts loading initial content
   * @param tubeNumber The active tube number
   * @param stitchId The active stitch ID
   * @returns Promise that resolves to the active stitch content
   */
  async getActiveStitchAndStartLoading(tubeNumber: number, stitchId: string): Promise<StitchContent | null> {
    // Load the active stitch first
    const activeStitch = await fetchActiveStitch(this.userId, tubeNumber, stitchId);
    
    if (activeStitch) {
      // Add to our local cache
      this.contentBuffer.set(stitchId, activeStitch);
      
      // Immediately start loading initial content for this tube
      this.loadInitialTubeContent(tubeNumber)
        .catch(err => console.error(`Error loading initial tube ${tubeNumber} content:`, err));
      
      // Return the active stitch so the player can start
      return activeStitch;
    }
    
    return null;
  }
  
  /**
   * Loads the initial content for a tube (first batch)
   * @param tubeNumber The tube number to load
   */
  async loadInitialTubeContent(tubeNumber: number): Promise<void> {
    if (this.loadingPromises.has(`initial-${tubeNumber}`)) {
      // Already loading this tube
      return;
    }
    
    // Create and store the loading promise
    const loadingPromise = fetchInitialStitches(this.userId, tubeNumber)
      .then(stitches => {
        // Add all stitches to our buffer
        Object.entries(stitches).forEach(([id, stitch]) => {
          this.contentBuffer.set(id, stitch);
        });
        
        console.log(`Added ${Object.keys(stitches).length} initial stitches to buffer for tube ${tubeNumber}`);
        
        // Mark this tube as having initial content loaded
        this.loadedTubes.add(tubeNumber);
        
        // Remove the promise from our tracking map
        this.loadingPromises.delete(`initial-${tubeNumber}`);
        
        // Check if all tubes have initial content
        if (this.loadedTubes.size >= 3) {
          this.initialLoadComplete = true;
          console.log('Initial content load complete for all tubes');
          
          // Start loading extended content
          this.loadExtendedContent();
        }
      })
      .catch(error => {
        console.error(`Error loading initial content for tube ${tubeNumber}:`, error);
        this.loadingPromises.delete(`initial-${tubeNumber}`);
      });
    
    this.loadingPromises.set(`initial-${tubeNumber}`, loadingPromise);
    
    return loadingPromise;
  }
  
  /**
   * Loads extended content for all tubes for offline support
   */
  private async loadExtendedContent(): Promise<void> {
    if (this.extendedLoadComplete) return;
    
    console.log('Starting extended content load for offline support');
    
    // Load extended content for all three tubes
    for (let tubeNumber = 1; tubeNumber <= 3; tubeNumber++) {
      if (this.loadingPromises.has(`extended-${tubeNumber}`)) {
        continue; // Already loading
      }
      
      // Create and store the loading promise
      const loadingPromise = fetchExtendedStitches(this.userId, tubeNumber)
        .then(stitches => {
          // Add all stitches to our buffer
          Object.entries(stitches).forEach(([id, stitch]) => {
            // Only add if we don't already have it
            if (!this.contentBuffer.has(id)) {
              this.contentBuffer.set(id, stitch);
            }
          });
          
          console.log(`Added ${Object.keys(stitches).length} extended stitches to buffer for tube ${tubeNumber}`);
          
          // Remove the promise from our tracking map
          this.loadingPromises.delete(`extended-${tubeNumber}`);
        })
        .catch(error => {
          console.error(`Error loading extended content for tube ${tubeNumber}:`, error);
          this.loadingPromises.delete(`extended-${tubeNumber}`);
        });
      
      this.loadingPromises.set(`extended-${tubeNumber}`, loadingPromise);
    }
    
    // Mark extended load as complete
    this.extendedLoadComplete = true;
  }
  
  /**
   * Gets a stitch from the content buffer
   * @param stitchId The stitch ID to get
   * @returns The stitch content or null if not found
   */
  getStitch(stitchId: string): StitchContent | null {
    return this.contentBuffer.get(stitchId) || null;
  }
  
  /**
   * Gets the loading status for content
   * @returns Object with loading status information
   */
  getStatus(): { initialLoaded: boolean, extendedLoaded: boolean, stitchCount: number } {
    return {
      initialLoaded: this.initialLoadComplete,
      extendedLoaded: this.extendedLoadComplete,
      stitchCount: this.contentBuffer.size
    };
  }
}