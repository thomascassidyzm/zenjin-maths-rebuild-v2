/**
 * useZustandTubeData Hook
 * 
 * This hook provides tube data from the Zustand store in the format
 * expected by the MinimalDistinctionPlayer component.
 */

import { useMemo } from 'react';
import { useZenjinStore } from '../store/zenjinStore';
import { zustandToPlayerFormat } from '../adapters/tubeDataAdapter';

/**
 * Hook to get tube data from the Zustand store in the format expected by the player
 * @returns The tube data in player format, plus the active tube number
 */
export function useZustandTubeData() {
  // Get tube state from Zustand store
  const tubeState = useZenjinStore(state => state.tubeState);
  const activeTube = useZenjinStore(state => state.tubeState?.activeTube || 1);
  
  // Convert to player format using the adapter
  const tubeData = useMemo(() => {
    return zustandToPlayerFormat(tubeState);
  }, [tubeState]);

  return {
    tubeData,
    tubeNumber: activeTube,
    hasData: !!tubeData && Object.keys(tubeData).length > 0
  };
}