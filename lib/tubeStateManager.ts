/**
 * Tube State Manager
 * 
 * A simplified approach to managing the positions of stitches in tubes.
 * Each user has 3 tubes, with numbered positions starting at 0 (active stitch).
 * Stitches are reordered based on the spaced repetition algorithm.
 */

// Interface for stitch position in a tube
interface StitchPosition {
  stitch_id: string;
  position: number;
  skip_number: number;
  distractor_level: string;
}

// Interface for the full tube state
interface TubeState {
  user_id: string;
  tube_number: number;
  positions: StitchPosition[];
  active_stitch_id: string; // The stitch at position 0
}

/**
 * Save complete tube state to the database
 * @param userId User ID
 * @param tubeNumber Tube number (1, 2, or 3)
 * @param positions Array of stitch positions
 */
export async function saveTubeState(userId: string, tubeStates: TubeState[]): Promise<boolean> {
  try {
    console.log(`Saving tube state for user ${userId}`);
    
    // Clear any existing records by tube number
    for (const tubeState of tubeStates) {
      // First clear existing tube positions
      await fetch('/api/tube-state/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          tube_number: tubeState.tube_number
        })
      });
      
      // Then insert the new positions
      // Prepare the records for batch insert
      const records = tubeState.positions.map(pos => ({
        user_id: userId,
        tube_number: tubeState.tube_number,
        position: pos.position,
        stitch_id: pos.stitch_id,
        skip_number: pos.skip_number,
        distractor_level: pos.distractor_level
      }));
      
      // Insert all positions in a batch
      const response = await fetch('/api/tube-state/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records })
      });
      
      if (!response.ok) {
        console.error(`Failed to save tube ${tubeState.tube_number} state:`, await response.text());
        return false;
      }
    }
    
    console.log('Successfully saved tube state for all tubes');
    return true;
  } catch (error) {
    console.error('Error saving tube state:', error);
    return false;
  }
}

/**
 * Load tube state from the database
 * @param userId User ID
 * @returns Array of tube states
 */
export async function loadTubeState(userId: string): Promise<TubeState[]> {
  try {
    console.log(`Loading tube state for user ${userId}`);
    
    const response = await fetch(`/api/tube-state/load?user_id=${userId}`);
    
    if (!response.ok) {
      console.error('Failed to load tube state:', await response.text());
      return [];
    }
    
    const data = await response.json();
    
    // Group by tube number
    const tubeStates: TubeState[] = [];
    const tubeMap: Record<number, StitchPosition[]> = {};
    
    // Group positions by tube
    for (const record of data.records) {
      if (!tubeMap[record.tube_number]) {
        tubeMap[record.tube_number] = [];
      }
      
      tubeMap[record.tube_number].push({
        stitch_id: record.stitch_id,
        position: record.position,
        skip_number: record.skip_number,
        distractor_level: record.distractor_level
      });
    }
    
    // Create tube state objects
    Object.entries(tubeMap).forEach(([tubeNumber, positions]) => {
      // Sort positions
      const sortedPositions = [...positions].sort((a, b) => a.position - b.position);
      
      // Find the active stitch (position 0)
      const activeStitch = sortedPositions.find(p => p.position === 0);
      
      tubeStates.push({
        user_id: userId,
        tube_number: parseInt(tubeNumber),
        positions: sortedPositions,
        active_stitch_id: activeStitch?.stitch_id || ''
      });
    });
    
    console.log(`Loaded ${tubeStates.length} tubes with positions`);
    return tubeStates;
  } catch (error) {
    console.error('Error loading tube state:', error);
    return [];
  }
}

/**
 * Complete a stitch with a perfect score
 * This moves the stitch from position 0 to position skip_number,
 * and shifts all stitches in between.
 * 
 * @param tubeState The current tube state
 * @param stitchId The stitch that was completed
 * @returns Updated tube state
 */
export function completeStitchWithPerfectScore(tubeState: TubeState, stitchId: string): TubeState {
  // Make a copy to avoid mutation
  const positions = [...tubeState.positions];
  
  // Find the stitch that was completed (should be at position 0)
  const completedStitchIndex = positions.findIndex(p => p.stitch_id === stitchId);
  
  if (completedStitchIndex === -1) {
    console.error(`Stitch ${stitchId} not found in tube ${tubeState.tube_number}`);
    return tubeState;
  }
  
  const completedStitch = positions[completedStitchIndex];
  
  // Verify the stitch is at position 0
  if (completedStitch.position !== 0) {
    console.error(`Completed stitch ${stitchId} is not at position 0`);
    return tubeState;
  }
  
  // Get the skip number for this stitch
  const skipNumber = completedStitch.skip_number;
  
  // Progress the skip number
  if (skipNumber === 1) completedStitch.skip_number = 3;
  else if (skipNumber === 3) completedStitch.skip_number = 5;
  else if (skipNumber === 5) completedStitch.skip_number = 10;
  else if (skipNumber === 10) completedStitch.skip_number = 25;
  else if (skipNumber === 25) completedStitch.skip_number = 100;
  
  // Progress the distractor level on a ratchet
  if (completedStitch.distractor_level === 'L1') completedStitch.distractor_level = 'L2';
  else if (completedStitch.distractor_level === 'L2') completedStitch.distractor_level = 'L3';
  
  // Temporarily set completed stitch to position -1
  completedStitch.position = -1;
  
  // Shift stitches between positions 1 and skipNumber
  for (const position of positions) {
    if (position.position > 0 && position.position <= skipNumber) {
      position.position -= 1;
    }
  }
  
  // Move completed stitch to position skipNumber
  completedStitch.position = skipNumber;
  
  // Find the new active stitch (position 0)
  const newActiveStitch = positions.find(p => p.position === 0);
  
  // Update the active stitch ID
  if (newActiveStitch) {
    tubeState.active_stitch_id = newActiveStitch.stitch_id;
  }
  
  return {
    ...tubeState,
    positions
  };
}

/**
 * Convert the legacy state format to the new simplified tube state format
 * @param legacyState Old state from StateMachine
 * @returns Array of tube states in the new format
 */
export function convertLegacyStateToTubeState(legacyState: any): TubeState[] {
  const tubeStates: TubeState[] = [];
  
  // Process each tube
  for (const [tubeNumber, tube] of Object.entries(legacyState.tubes)) {
    const stitches = tube.stitches || [];
    const positions: StitchPosition[] = [];
    
    // Convert each stitch to a position entry
    for (const stitch of stitches) {
      positions.push({
        stitch_id: stitch.id,
        position: stitch.position || 0,
        skip_number: stitch.skipNumber || 3,
        distractor_level: stitch.distractorLevel || 'L1'
      });
    }
    
    // Sort by position
    const sortedPositions = [...positions].sort((a, b) => a.position - b.position);
    
    // Find the active stitch
    const activeStitch = sortedPositions.find(p => p.position === 0);
    
    tubeStates.push({
      user_id: legacyState.userId || 'anonymous',
      tube_number: parseInt(tubeNumber),
      positions: sortedPositions,
      active_stitch_id: activeStitch?.stitch_id || tube.currentStitchId || ''
    });
  }
  
  return tubeStates;
}