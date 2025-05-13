/**
 * Server Content Provider
 * 
 * This file replaces the previous bundled content approach with a server-first strategy.
 * Instead of bundling content with the app, we now fetch all content from the server API.
 */

import { ContentManifest, StitchContent } from './client/content-buffer';

/**
 * Default manifest structure with minimal metadata.
 * No actual content is included - this is just a placeholder to maintain type compatibility.
 */
export const DEFAULT_MANIFEST: ContentManifest = {
  version: 1,
  generated: new Date().toISOString(),
  tubes: {
    '1': { threads: {} },
    '2': { threads: {} },
    '3': { threads: {} }
  },
  stats: {
    tubeCount: 3,
    threadCount: 0,
    stitchCount: 0
  }
};

/**
 * Empty record to maintain compatibility with code that expects bundled content.
 * All stitches will now be fetched from the server.
 */
export const BUNDLED_FULL_CONTENT: Record<string, StitchContent> = {};

/**
 * Asynchronously fetches the first batch of stitches for a user's tubes.
 * This implements Phase 1 of the two-phase loading approach.
 * 
 * @param tubeState The current tube state from the user
 * @param fetchStitchBatch The function to fetch a batch of stitches
 * @returns Promise that resolves when all initial stitches are loaded
 */
export async function fillInitialBuffer(
  tubeState: any, 
  fetchStitchBatch: (stitchIds: string[]) => Promise<Record<string, StitchContent>>
): Promise<void> {
  if (!tubeState?.tubes) {
    console.warn('fillInitialBuffer: No tube state available');
    return;
  }

  const INITIAL_BUFFER_SIZE = 10; // Load 10 stitches per tube initially
  const stitchesToFetch: string[] = [];

  // For each tube (1, 2, 3)
  for (let tubeNum = 1; tubeNum <= 3; tubeNum++) {
    const tube = tubeState.tubes[tubeNum];
    if (!tube || !tube.stitchOrder || tube.stitchOrder.length === 0) {
      console.log(`Tube ${tubeNum} has no stitches to load`);
      continue;
    }

    // Current active stitch must always be first in the queue
    if (tube.currentStitchId && !stitchesToFetch.includes(tube.currentStitchId)) {
      stitchesToFetch.push(tube.currentStitchId);
    }

    // Get up to INITIAL_BUFFER_SIZE stitches from this tube
    const tubeStitches = tube.stitchOrder.slice(0, INITIAL_BUFFER_SIZE);
    
    // Add any stitches not already in the fetch list
    tubeStitches.forEach((stitchId: string) => {
      if (stitchId && !stitchesToFetch.includes(stitchId)) {
        stitchesToFetch.push(stitchId);
      }
    });
  }

  // Fetch all initial stitches in a single batch request
  if (stitchesToFetch.length > 0) {
    console.log(`Phase 1: Fetching initial buffer of ${stitchesToFetch.length} stitches`);
    try {
      await fetchStitchBatch(stitchesToFetch);
      console.log(`Phase 1: Successfully loaded ${stitchesToFetch.length} stitches`);
    } catch (error) {
      console.error('Error filling initial buffer:', error);
    }
  } else {
    console.warn('No stitches to fetch for initial buffer');
  }
}

/**
 * Asynchronously fetches the complete set of stitches for all tubes.
 * This implements Phase 2 of the two-phase loading approach.
 * 
 * @param tubeState The current tube state from the user
 * @param fetchStitchBatch The function to fetch a batch of stitches
 * @returns Promise that resolves when all stitches are loaded
 */
export async function fillCompleteBuffer(
  tubeState: any, 
  fetchStitchBatch: (stitchIds: string[]) => Promise<Record<string, StitchContent>>
): Promise<void> {
  if (!tubeState?.tubes) {
    console.warn('fillCompleteBuffer: No tube state available');
    return;
  }

  const COMPLETE_BUFFER_SIZE = 50; // Up to 50 stitches per tube
  const stitchesToFetch: string[] = [];

  // For each tube (1, 2, 3)
  for (let tubeNum = 1; tubeNum <= 3; tubeNum++) {
    const tube = tubeState.tubes[tubeNum];
    if (!tube || !tube.stitchOrder || tube.stitchOrder.length === 0) {
      continue;
    }

    // Get up to COMPLETE_BUFFER_SIZE stitches from this tube
    // Starting from position 10 (after initial buffer)
    const tubeStitches = tube.stitchOrder.slice(10, COMPLETE_BUFFER_SIZE);
    
    // Add any stitches not already in the fetch list
    tubeStitches.forEach((stitchId: string) => {
      if (stitchId && !stitchesToFetch.includes(stitchId)) {
        stitchesToFetch.push(stitchId);
      }
    });
  }

  // Fetch all remaining stitches in a single batch request
  if (stitchesToFetch.length > 0) {
    console.log(`Phase 2: Fetching complete buffer of ${stitchesToFetch.length} additional stitches`);
    try {
      await fetchStitchBatch(stitchesToFetch);
      console.log(`Phase 2: Successfully loaded ${stitchesToFetch.length} additional stitches`);
    } catch (error) {
      console.error('Error filling complete buffer:', error);
    }
  } else {
    console.log('No additional stitches needed for complete buffer');
  }
}

/**
 * Creates emergency fallback content when content fetching fails.
 * This is only used as a last resort when the server is unreachable.
 * 
 * @param stitchId The ID of the stitch that couldn't be fetched
 * @returns An emergency stitch with basic content
 */
export function createEmergencyStitch(stitchId: string): StitchContent {
  console.warn(`Creating emergency stitch for ${stitchId}`);

  // Extract thread and tube info from the stitch ID
  const matches = stitchId.match(/stitch-T(\d+)-(\d+)-(\d+)/);
  const tubeNumber = matches ? matches[1] : '1';
  const threadNumber = matches ? matches[2] : '001';
  const stitchNumber = matches ? matches[3] : '01';
  const threadId = `thread-T${tubeNumber}-${threadNumber}`;

  // Generate some basic questions
  const questions = Array.from({ length: 20 }, (_, i) => ({
    id: `${stitchId}-q${(i + 1).toString().padStart(2, '0')}`,
    text: `Question ${i + 1}`,
    correctAnswer: `${(i % 10) + 1}`,
    distractors: { L1: `${(i % 10) + 2}`, L2: `${(i % 10) + 3}`, L3: `${(i % 10) + 4}` }
  }));

  // Create a basic stitch
  return {
    id: stitchId,
    threadId,
    title: `Emergency Content (Tube ${tubeNumber})`,
    content: `This content is a fallback because the server could not be reached. Please try again later.`,
    order: parseInt(stitchNumber, 10),
    questions
  };
}