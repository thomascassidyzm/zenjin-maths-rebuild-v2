/**
 * Stitch Actions for Zustand Store
 * 
 * This file adds stitch-related actions to the Zustand store,
 * allowing for unified and consistent stitch fetching across the app.
 */

import { StitchContent } from '../client/offline-first-content-buffer';

// Types for stitch fetching responses
interface BatchFetchResponse {
  success: boolean;
  stitches: StitchContent[];
  count: number;
  total: number;
}

/**
 * Fetch a batch of stitches from the server
 * @param stitchIds Array of stitch IDs to fetch
 * @returns Promise resolving to the fetched stitches or an error
 */
export const fetchStitchBatch = async (stitchIds: string[]): Promise<Record<string, StitchContent>> => {
  if (stitchIds.length === 0) return {};

  // Check for test mode (for stitch-completion-test page)
  // This creates mock stitch content without requiring the API
  const isTestMode = typeof window !== 'undefined' &&
    window.location.pathname.includes('stitch-completion-test');

  if (isTestMode) {
    console.log(`[TEST MODE] Generating mock content for ${stitchIds.length} stitches`);
    return createMockStitches(stitchIds);
  }

  try {
    const response = await fetch('/api/content/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ stitchIds })
    });

    if (!response.ok) {
      // If API fails in test mode, fall back to mock data
      if (window.location.pathname.includes('test')) {
        console.warn(`API returned ${response.status}, falling back to mock data`);
        return createMockStitches(stitchIds);
      }
      throw new Error(`Failed to fetch stitches: ${response.status}`);
    }

    const data: BatchFetchResponse = await response.json();

    if (!data.success) {
      // If API fails in test mode, fall back to mock data
      if (window.location.pathname.includes('test')) {
        console.warn(`API returned error, falling back to mock data`);
        return createMockStitches(stitchIds);
      }
      throw new Error('Failed to fetch stitches');
    }

    // Convert array to record for easier lookup
    const stitchRecord: Record<string, StitchContent> = {};
    data.stitches.forEach(stitch => {
      stitchRecord[stitch.id] = stitch;
    });

    return stitchRecord;
  } catch (error) {
    console.error('Error fetching stitches:', error);

    // In test mode, fallback to mock data on any error
    if (window.location.pathname.includes('test')) {
      console.warn('API error, falling back to mock data');
      return createMockStitches(stitchIds);
    }

    throw error;
  }
};

/**
 * Creates mock stitch content for testing purposes
 * @param stitchIds Array of stitch IDs to create mock content for
 * @returns Record of stitch ID to mock stitch content
 */
const createMockStitches = (stitchIds: string[]): Record<string, StitchContent> => {
  const stitchRecord: Record<string, StitchContent> = {};

  stitchIds.forEach(stitchId => {
    // Extract thread ID from stitch ID (e.g., "stitch-T1-001-01" -> "thread-T1-001")
    const threadId = stitchId.replace(/stitch-(T\d+)-([\d-]+).*/, 'thread-$1-$2');

    // Create mock stitch content
    stitchRecord[stitchId] = {
      id: stitchId,
      threadId: threadId,
      title: `Mock Stitch ${stitchId}`,
      content: `Content for ${stitchId}`,
      order: parseInt(stitchId.split('-').pop() || '1', 10),
      questions: Array.from({ length: 20 }, (_, i) => ({
        id: `${stitchId}-q${(i + 1).toString().padStart(2, '0')}`,
        text: `Question ${i + 1} for ${stitchId}`,
        correctAnswer: `${i + 1}`,
        distractors: { L1: `${i}`, L2: `${i + 2}`, L3: `${i + 5}` }
      }))
    };
  });

  return stitchRecord;
};

/**
 * Fetch a single stitch from the server
 * @param stitchId The ID of the stitch to fetch
 * @returns Promise resolving to the fetched stitch or null
 */
export const fetchSingleStitch = async (stitchId: string): Promise<StitchContent | null> => {
  if (!stitchId) return null;

  try {
    const stitches = await fetchStitchBatch([stitchId]);
    return stitches[stitchId] || null;
  } catch (error) {
    console.error(`Error fetching stitch ${stitchId}:`, error);

    // In test mode, create a single mock stitch even if batch fetch failed
    if (typeof window !== 'undefined' && window.location.pathname.includes('test')) {
      console.warn(`Creating emergency mock stitch for ${stitchId}`);
      return createMockStitches([stitchId])[stitchId] || null;
    }

    return null;
  }
};