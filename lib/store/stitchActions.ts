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

    const data: BatchFetchResponse = await response.json();

    if (!data.success) {
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
    throw error;
  }
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
    return null;
  }
};