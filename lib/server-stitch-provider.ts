/**
 * Server Stitch Provider
 * 
 * This file provides a clean server-first approach to loading stitch content.
 * Instead of bundling content with the app, we fetch everything from the server.
 */

// Types
export interface StitchContent {
  id: string;
  threadId: string;
  title: string;
  content: string;
  order: number;
  questions: Array<{
    id: string;
    text: string;
    correctAnswer: string;
    distractors: {
      L1: string;
      L2: string;
      L3: string;
    };
  }>;
}

// In-memory cache for stitches
const stitchCache: Record<string, StitchContent> = {};

/**
 * Get a stitch from the server
 * First checks the cache, then fetches from server if needed
 * 
 * @param stitchId The ID of the stitch to get
 * @returns Promise that resolves to the stitch content or null if not found
 */
export async function getStitch(stitchId: string): Promise<StitchContent | null> {
  // Check cache first
  if (stitchCache[stitchId]) {
    console.log(`Found stitch ${stitchId} in cache`);
    return stitchCache[stitchId];
  }

  try {
    console.log(`Fetching stitch ${stitchId} from server`);
    const response = await fetch(`/api/content/stitch/${stitchId}`);
    
    if (!response.ok) {
      console.error(`Failed to fetch stitch ${stitchId}: ${response.status} ${response.statusText}`);
      return createEmergencyStitch(stitchId);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.stitch) {
      console.error(`Invalid response for stitch ${stitchId}`);
      return createEmergencyStitch(stitchId);
    }
    
    // Cache the stitch
    stitchCache[stitchId] = data.stitch;
    
    return data.stitch;
  } catch (error) {
    console.error(`Error fetching stitch ${stitchId}:`, error);
    return createEmergencyStitch(stitchId);
  }
}

/**
 * Get multiple stitches in a single batch request
 * 
 * @param stitchIds Array of stitch IDs to fetch
 * @returns Promise that resolves to a record of stitch ID -> stitch content
 */
export async function getStitchBatch(stitchIds: string[]): Promise<Record<string, StitchContent>> {
  // Filter out stitches that are already cached
  const uncachedStitchIds = stitchIds.filter(id => !stitchCache[id]);
  
  // Return all from cache if everything is cached
  if (uncachedStitchIds.length === 0) {
    console.log('All requested stitches already in cache');
    return stitchIds.reduce((result, id) => {
      result[id] = stitchCache[id];
      return result;
    }, {} as Record<string, StitchContent>);
  }
  
  try {
    console.log(`Fetching batch of ${uncachedStitchIds.length} stitches from server`);
    const response = await fetch('/api/content/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ stitchIds: uncachedStitchIds })
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch stitch batch: ${response.status} ${response.statusText}`);
      // Create emergency content for all uncached stitches
      return uncachedStitchIds.reduce((result, id) => {
        result[id] = createEmergencyStitch(id);
        stitchCache[id] = result[id]; // Cache emergency content
        return result;
      }, {} as Record<string, StitchContent>);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.stitches) {
      console.error('Invalid response for stitch batch');
      // Create emergency content for all uncached stitches
      return uncachedStitchIds.reduce((result, id) => {
        result[id] = createEmergencyStitch(id);
        stitchCache[id] = result[id]; // Cache emergency content
        return result;
      }, {} as Record<string, StitchContent>);
    }
    
    // Cache all fetched stitches
    Object.values(data.stitches).forEach((stitch: StitchContent) => {
      stitchCache[stitch.id] = stitch;
    });
    
    // Combine cached and newly fetched stitches
    return stitchIds.reduce((result, id) => {
      result[id] = stitchCache[id] || createEmergencyStitch(id);
      return result;
    }, {} as Record<string, StitchContent>);
  } catch (error) {
    console.error('Error fetching stitch batch:', error);
    
    // Create emergency content for all uncached stitches
    return uncachedStitchIds.reduce((result, id) => {
      result[id] = createEmergencyStitch(id);
      stitchCache[id] = result[id]; // Cache emergency content
      return result;
    }, {} as Record<string, StitchContent>);
  }
}

/**
 * Create emergency content for a stitch
 * Used as a fallback when server requests fail
 * 
 * @param stitchId The ID of the stitch to create emergency content for
 * @returns Emergency stitch content
 */
export function createEmergencyStitch(stitchId: string): StitchContent {
  console.warn(`Creating emergency content for stitch ${stitchId}`);
  
  // Extract tube and thread info from stitch ID
  const matches = stitchId.match(/stitch-T(\d+)-(\d+)-(\d+)/);
  const tubeNumber = matches ? parseInt(matches[1], 10) : 1;
  const threadNumber = matches ? matches[2] : '001';
  const stitchNumber = matches ? parseInt(matches[3], 10) : 1;
  const threadId = `thread-T${tubeNumber}-${threadNumber}`;
  
  // Create questions based on tube number
  const questions = [];
  
  if (tubeNumber === 1) {
    // Number facts for tube 1
    questions.push(
      {
        id: `${stitchId}-q1`,
        text: 'What number comes after 5?',
        correctAnswer: '6',
        distractors: { L1: '7', L2: '4', L3: '5' }
      },
      {
        id: `${stitchId}-q2`,
        text: 'Which is greater: 8 or 4?',
        correctAnswer: '8',
        distractors: { L1: '4', L2: 'They are equal', L3: 'Cannot compare' }
      },
      {
        id: `${stitchId}-q3`,
        text: 'What comes next: 2, 4, 6, ?',
        correctAnswer: '8',
        distractors: { L1: '7', L2: '10', L3: '9' }
      }
    );
  } else if (tubeNumber === 2) {
    // Basic operations for tube 2
    questions.push(
      {
        id: `${stitchId}-q1`,
        text: '3 + 5',
        correctAnswer: '8',
        distractors: { L1: '7', L2: '9', L3: '6' }
      },
      {
        id: `${stitchId}-q2`,
        text: '7 - 2',
        correctAnswer: '5',
        distractors: { L1: '4', L2: '6', L3: '3' }
      },
      {
        id: `${stitchId}-q3`,
        text: '4 + 6',
        correctAnswer: '10',
        distractors: { L1: '8', L2: '12', L3: '9' }
      }
    );
  } else {
    // Problem solving for tube 3
    questions.push(
      {
        id: `${stitchId}-q1`,
        text: 'Sarah has 5 apples. Tom gives her 3 more. How many apples does Sarah have now?',
        correctAnswer: '8',
        distractors: { L1: '7', L2: '2', L3: '15' }
      },
      {
        id: `${stitchId}-q2`,
        text: 'Jack has 10 stickers. He gives 4 to his friend. How many stickers does Jack have left?',
        correctAnswer: '6',
        distractors: { L1: '14', L2: '4', L3: '5' }
      },
      {
        id: `${stitchId}-q3`,
        text: 'There are 8 birds on a tree. 3 more birds join them. How many birds are there now?',
        correctAnswer: '11',
        distractors: { L1: '10', L2: '12', L3: '5' }
      }
    );
  }
  
  // Create the emergency stitch
  return {
    id: stitchId,
    threadId,
    title: `Emergency Content (Tube ${tubeNumber})`,
    content: `This content is a fallback because the server could not be reached. Please try again later.`,
    order: stitchNumber,
    questions
  };
}

/**
 * Clear the stitch cache
 * Useful for testing or when user state changes significantly
 */
export function clearStitchCache(): void {
  const cacheSize = Object.keys(stitchCache).length;
  console.log(`Clearing stitch cache (${cacheSize} entries)`);
  Object.keys(stitchCache).forEach(key => {
    delete stitchCache[key];
  });
}

// Export an empty BUNDLED_FULL_CONTENT for compatibility
// This ensures existing code can still import this constant
export const BUNDLED_FULL_CONTENT: Record<string, StitchContent> = {};