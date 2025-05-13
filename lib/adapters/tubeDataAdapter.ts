/**
 * Tube Data Adapter
 * 
 * This adapter transforms tube data between different formats to ensure compatibility
 * between components and the Zustand store.
 */

import { TubeState } from '../store/types';

/**
 * Convert Zustand tube state into the format expected by the MinimalDistinctionPlayer
 * @param tubeState The tube state from the Zustand store
 * @returns The tube data in the format expected by the player
 */
export function zustandToPlayerFormat(tubeState: TubeState | null): any {
  if (!tubeState) return null;

  const playerFormat: Record<number, any> = {};

  // Process each tube
  for (const [tubeNumStr, tube] of Object.entries(tubeState.tubes)) {
    const tubeNum = parseInt(tubeNumStr);
    
    if (!tube) continue;

    // Create stitches array from positions
    const stitches: any[] = [];
    
    // First check if positions object exists
    if (tube.positions && Object.keys(tube.positions).length > 0) {
      // Convert positions to stitches array
      Object.entries(tube.positions).forEach(([posStr, tubPos]) => {
        stitches.push({
          id: tubPos.stitchId,
          position: parseInt(posStr),
          skipNumber: tubPos.skipNumber,
          distractorLevel: tubPos.distractorLevel
        });
      });
    } 
    // If no positions, try using stitchOrder
    else if (tube.stitchOrder && tube.stitchOrder.length > 0) {
      tube.stitchOrder.forEach((stitchId, index) => {
        stitches.push({
          id: stitchId,
          position: index
        });
      });
    }

    // Sort stitches by position
    stitches.sort((a, b) => a.position - b.position);

    // Create the tube data in player format
    playerFormat[tubeNum] = {
      threadId: tube.threadId,
      currentStitchId: tube.currentStitchId,
      stitches: stitches
    };
  }

  return playerFormat;
}

/**
 * Convert the player format tube data back to Zustand format
 * This is helpful when receiving updates from the player
 * @param playerData The tube data from the player
 * @returns The tube state in Zustand format
 */
export function playerToZustandFormat(playerData: any): TubeState {
  const zustandState: TubeState = {
    activeTube: 1,
    tubes: {}
  };

  // Process each tube
  for (const [tubeNumStr, tube] of Object.entries(playerData)) {
    const tubeNum = parseInt(tubeNumStr);
    
    if (!tube) continue;

    // Create stitch positions from stitches array
    const positions: Record<number, any> = {};
    const stitchOrder: string[] = [];
    
    if (tube.stitches && Array.isArray(tube.stitches)) {
      tube.stitches.forEach((stitch: any) => {
        positions[stitch.position] = {
          stitchId: stitch.id,
          skipNumber: stitch.skipNumber || 3,
          distractorLevel: stitch.distractorLevel || 'L1',
          perfectCompletions: stitch.perfectCompletions || 0
        };
        
        stitchOrder.push(stitch.id);
      });
    }

    // Create the tube in Zustand format
    zustandState.tubes[tubeNum] = {
      threadId: tube.threadId,
      currentStitchId: tube.currentStitchId,
      positions: positions,
      stitchOrder: stitchOrder
    };
  }

  return zustandState;
}