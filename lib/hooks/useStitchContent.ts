/**
 * useStitchContent Hook
 * 
 * A custom hook that provides stitch content from the Zustand store,
 * automatically fetching the content from the API if it's not already in the store.
 */

import { useState, useEffect } from 'react';
import { useZenjinStore } from '../store/zenjinStore';
import { StitchContent } from '../client/offline-first-content-buffer';

interface UseStitchContentResult {
  stitch: StitchContent | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to get stitch content, fetching from the API if needed
 * @param stitchId The ID of the stitch to fetch
 * @returns Object containing the stitch, loading state, and any error
 */
export function useStitchContent(stitchId: string): UseStitchContentResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [stitch, setStitch] = useState<StitchContent | null>(null);
  
  // Get Zustand store actions
  const fetchStitch = useZenjinStore(state => state.fetchStitch);
  const contentCollection = useZenjinStore(state => state.contentCollection);
  
  useEffect(() => {
    if (!stitchId) {
      setLoading(false);
      return;
    }
    
    // Reset state when stitch ID changes
    setLoading(true);
    setError(null);
    setStitch(null);
    
    // Check if stitch is already in the collection
    if (contentCollection?.stitches?.[stitchId]) {
      // Convert to StitchContent format
      const existingStitch = contentCollection.stitches[stitchId];
      setStitch({
        id: existingStitch.stitchId,
        threadId: existingStitch.threadId || '',
        title: existingStitch.title || '',
        content: existingStitch.content || '',
        order: existingStitch.order || 0,
        questions: existingStitch.questions || []
      });
      setLoading(false);
      return;
    }
    
    // Fetch stitch if not in collection
    const getStitch = async () => {
      try {
        const fetchedStitch = await fetchStitch(stitchId);
        setStitch(fetchedStitch);
      } catch (e) {
        console.error('Error fetching stitch:', e);
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setLoading(false);
      }
    };
    
    getStitch();
  }, [stitchId, contentCollection, fetchStitch]);
  
  return { stitch, loading, error };
}

/**
 * Hook to fetch multiple stitches at once
 * @param stitchIds Array of stitch IDs to fetch
 * @returns Object containing stitches record, loading state, and any error
 */
export function useBatchStitchContent(stitchIds: string[]) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [stitches, setStitches] = useState<Record<string, StitchContent>>({});
  
  // Get Zustand store actions
  const fetchStitchBatch = useZenjinStore(state => state.fetchStitchBatch);
  const contentCollection = useZenjinStore(state => state.contentCollection);
  
  useEffect(() => {
    if (!stitchIds || stitchIds.length === 0) {
      setLoading(false);
      return;
    }
    
    // Reset state when stitch IDs change
    setLoading(true);
    setError(null);
    setStitches({});
    
    // Find which stitches are already in the collection and which need to be fetched
    const missingStitchIds: string[] = [];
    const existingStitches: Record<string, StitchContent> = {};
    
    stitchIds.forEach(id => {
      if (contentCollection?.stitches?.[id]) {
        // Convert to StitchContent format
        const existingStitch = contentCollection.stitches[id];
        existingStitches[id] = {
          id: existingStitch.stitchId,
          threadId: existingStitch.threadId || '',
          title: existingStitch.title || '',
          content: existingStitch.content || '',
          order: existingStitch.order || 0,
          questions: existingStitch.questions || []
        };
      } else {
        missingStitchIds.push(id);
      }
    });
    
    // If we already have all stitches, return them
    if (missingStitchIds.length === 0) {
      setStitches(existingStitches);
      setLoading(false);
      return;
    }
    
    // Fetch missing stitches
    const getStitches = async () => {
      try {
        const fetchedStitches = await fetchStitchBatch(missingStitchIds);
        setStitches({ ...existingStitches, ...fetchedStitches });
      } catch (e) {
        console.error('Error fetching stitches:', e);
        setError(e instanceof Error ? e : new Error(String(e)));
        // Still return any existing stitches
        setStitches(existingStitches);
      } finally {
        setLoading(false);
      }
    };
    
    getStitches();
  }, [stitchIds, contentCollection, fetchStitchBatch]);
  
  return { stitches, loading, error };
}