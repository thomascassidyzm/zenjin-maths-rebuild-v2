/**
 * Offline-First Content Buffer Manager
 * 
 * An enhanced version of the content buffer that prioritizes bundled content
 * and eliminates network calls for basic content. This implementation ensures:
 * 
 * 1. All users (anonymous and free) get identical content experience
 * 2. Content is immediately available without network connection
 * 3. Look-ahead buffer is unnecessary as all content is bundled
 * 4. App works in infinite play mode according to Triple Helix algorithm
 */

import { StitchContent } from './content-buffer';
import { BUNDLED_FULL_CONTENT, DEFAULT_MANIFEST } from '../expanded-bundled-content';
import { UserState } from '../state/types';

// Types from original content-buffer (imported for compatibility)
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

/**
 * Offline-First Content Buffer Manager
 * 
 * Manages content with a focus on working fully offline using bundled content
 */
export class OfflineFirstContentBufferManager {
  private manifest: ContentManifest;
  private isInitialized = false;
  
  constructor() {
    // Always use the bundled manifest
    this.manifest = DEFAULT_MANIFEST;
    console.log(`Initialized offline-first content buffer with ${this.manifest.stats.stitchCount} bundled stitches`);
  }
  
  /**
   * Initialize the content buffer
   * In the offline-first approach, this is synchronous and always succeeds
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    // Nothing to do - we already have all the content
    this.isInitialized = true;
    return true;
  }
  
  /**
   * Load the manifest - always uses the bundled one
   * No API calls are made in this implementation
   */
  async loadManifest(): Promise<ContentManifest> {
    return this.manifest;
  }
  
  /**
   * Get a stitch by ID - always from bundled content
   */
  async getStitch(stitchId: string): Promise<StitchContent | null> {
    // We always use the bundled content
    if (BUNDLED_FULL_CONTENT[stitchId]) {
      return BUNDLED_FULL_CONTENT[stitchId];
    }
    
    // If it's not in our bundled content, generate a fallback
    // This should rarely happen but ensures robustness
    console.warn(`Stitch ${stitchId} not found in bundled content, using fallback`);
    
    // Extract tube, thread and stitch number from ID if possible
    const match = stitchId.match(/stitch-T(\d+)-(\d+)-(\d+)/);
    
    if (match) {
      const [_, tubeNum, threadNum, stitchNum] = match;
      
      return {
        id: stitchId,
        threadId: `thread-T${tubeNum}-${threadNum}`,
        title: `Fallback Content for Tube ${tubeNum}`,
        content: `This is automatically generated content for Tube ${tubeNum}.`,
        order: parseInt(stitchNum),
        questions: [
          {
            id: `${stitchId}-fallback-q01`,
            text: 'What is 2 + 2?',
            correctAnswer: '4',
            distractors: {
              L1: '3',
              L2: '5',
              L3: '22'
            }
          }
        ]
      };
    }
    
    // Last resort fallback
    return {
      id: stitchId,
      threadId: 'fallback-thread',
      title: 'Fallback Content',
      content: 'This is automatically generated content.',
      order: 1,
      questions: [
        {
          id: `${stitchId}-fallback-q01`,
          text: 'What is 1 + 1?',
          correctAnswer: '2',
          distractors: {
            L1: '3',
            L2: '11',
            L3: '0'
          }
        }
      ]
    };
  }
  
  /**
   * Get the in-play stitch (the active stitch of the active tube)
   * Always uses bundled content
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
   * Update buffer is a no-op in this implementation
   * since all content is always available
   */
  async updateBuffer(): Promise<void> {
    // No-op: All content is bundled, no need to update
    return;
  }
  
  /**
   * Clear the cache - No-op in this implementation
   */
  clearCache(): void {
    // No-op: We always use bundled content
    console.log('Content buffer cache cleared (no-op in offline mode)');
  }
  
  /**
   * Get all stitches for a tube - useful for debugging
   */
  getAllStitchesForTube(tubeNumber: number): StitchReference[] {
    const tubeManifest = this.manifest.tubes[tubeNumber];
    if (!tubeManifest) return [];
    
    // Get the first thread in the tube (assumes one thread per tube)
    const threadId = Object.keys(tubeManifest.threads)[0];
    if (!threadId) return [];
    
    return tubeManifest.threads[threadId].stitches;
  }
}

// Create a singleton instance
export const offlineFirstContentBuffer = new OfflineFirstContentBufferManager();