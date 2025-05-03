# Simplified Tube State Management

This document describes a simplified approach to managing stitch positions in tubes for the spaced repetition algorithm.

## The Problem

The current implementation has several issues:

1. **Complex State Structure**: The StateMachine stores stitches in a nested structure that's difficult to sync with the database
2. **Inconsistent Saving**: State persistence has many fallbacks and error handling paths
3. **Database Schema Issues**: Column availability varies across environments
4. **Redundant Data**: Thread IDs are stored in multiple places where they could be inferred from stitch IDs

## The Solution: Simplified Tube Position Tracking

### Core Concept

The spaced repetition algorithm only needs to track:
- Which stitch is at each position in each tube
- Each stitch's skip number and distractor level

All other information like content, questions, etc. can be fetched as needed based on the stitch ID.

### Database Schema

We've created a simple, purpose-built table:

```sql
CREATE TABLE user_tube_positions (
  user_id UUID NOT NULL,
  tube_number INTEGER NOT NULL CHECK (tube_number BETWEEN 1 AND 3),
  position INTEGER NOT NULL,
  stitch_id TEXT NOT NULL,
  skip_number INTEGER DEFAULT 3,
  distractor_level TEXT DEFAULT 'L1',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  PRIMARY KEY (user_id, tube_number, position)
);
```

### Benefits

1. **Clearer Mental Model**: The state is literally "which stitch is at which position in each tube"
2. **Easier Debugging**: You can query which stitch is at position 0 for each tube
3. **Simpler Save/Load**: No need to handle nested objects or complex transformations
4. **More Reliable**: Fewer fields mean fewer schema compatibility issues
5. **Single Source of Truth**: Database reflects exactly how stitches are ordered

## The Spaced Repetition Algorithm

1. Each tube has positions starting at 0 (active stitch)
2. When a stitch at position 0 is completed with a perfect score:
   - Move it to position `skip_number` (e.g., 3)
   - Shift all stitches between positions 1 and `skip_number` down
   - The stitch at position 1 becomes the new active stitch (position 0)
3. The `skip_number` progresses with each perfect score: 1 → 3 → 5 → 10 → 25 → 100
4. The `distractor_level` progresses on a ratchet: L1 → L2 → L3 (and stays at L3)

## Implementation Components

1. **Database Schema**: The `user_tube_positions` table
2. **API Endpoints**:
   - `/api/tube-state/save` - Save all stitch positions for a tube
   - `/api/tube-state/load` - Load all stitch positions for a user
   - `/api/tube-state/clear` - Clear positions for a tube or all tubes
3. **Client State Manager**: The `tubeStateManager.ts` module with:
   - `loadTubeState()` - Loads positions from database
   - `saveTubeState()` - Saves positions to database
   - `completeStitchWithPerfectScore()` - Handles the core algorithm
4. **React Component**: `SimplifiedTubeCycler.tsx` for integrating with the player

## Migration Path

To migrate from the current system:

1. Create the new table `user_tube_positions`
2. Add a conversion function to transform the old state format to new format
3. Use the simplified tube cycler in new or refactored player components
4. Gradually phase out references to the old state format

## Error Handling Strategy

With this simpler approach, we can reduce error handling complexity:

1. Use transactions where possible to ensure data consistency
2. Fall back to localStorage when database saves fail
3. Clear error messages for specific failure cases
4. Retry with exponential backoff for network issues

## State Persistence Points

1. **Active Play**: Save in localStorage automatically during play
2. **Critical Points**: Save to database after tube rotation or stitch completion
3. **Session End**: Save full state to database when user clicks "Finish"

The new system's simplicity should eliminate most of the current state persistence issues while making the entire system easier to understand and maintain.