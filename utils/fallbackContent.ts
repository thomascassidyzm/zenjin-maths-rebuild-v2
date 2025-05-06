/**
 * Fallback Content Provider
 * 
 * This utility provides fallback content when the database is unavailable.
 * It shuffles bundled stitches to provide a good user experience even during connectivity issues.
 * Users are informed that progress won't be saved, but they can still learn.
 */

// Base bundled content - these 30 stitches are always available offline
const BUNDLED_STITCHES = [
  { id: 'stitch-T1-001-01', title: 'Number Recognition', threadId: 'thread-T1-001', order: 1 },
  { id: 'stitch-T1-001-02', title: 'Counting Basics', threadId: 'thread-T1-001', order: 2 },
  { id: 'stitch-T1-001-03', title: 'Sequence Patterns', threadId: 'thread-T1-001', order: 3 },
  { id: 'stitch-T1-001-04', title: 'Greater Than, Less Than', threadId: 'thread-T1-001', order: 4 },
  { id: 'stitch-T1-001-05', title: 'Simple Addition', threadId: 'thread-T1-001', order: 5 },
  { id: 'stitch-T1-002-01', title: 'Number Bonds', threadId: 'thread-T1-002', order: 1 },
  { id: 'stitch-T1-002-02', title: 'Adding Tens', threadId: 'thread-T1-002', order: 2 },
  { id: 'stitch-T1-002-03', title: 'Mental Addition', threadId: 'thread-T1-002', order: 3 },
  { id: 'stitch-T1-002-04', title: 'Addition Properties', threadId: 'thread-T1-002', order: 4 },
  { id: 'stitch-T1-002-05', title: 'Mixed Addition', threadId: 'thread-T1-002', order: 5 },
  { id: 'stitch-T1-003-01', title: 'Subtraction Basics', threadId: 'thread-T1-003', order: 1 },
  { id: 'stitch-T1-003-02', title: 'Finding Differences', threadId: 'thread-T1-003', order: 2 },
  { id: 'stitch-T1-003-03', title: 'Mental Subtraction', threadId: 'thread-T1-003', order: 3 },
  { id: 'stitch-T1-003-04', title: 'Subtraction Properties', threadId: 'thread-T1-003', order: 4 },
  { id: 'stitch-T1-003-05', title: 'Mixed Subtraction', threadId: 'thread-T1-003', order: 5 },
  { id: 'stitch-T1-004-01', title: 'Multiplication Intro', threadId: 'thread-T1-004', order: 1 },
  { id: 'stitch-T1-004-02', title: 'Times Tables 2 & 5', threadId: 'thread-T1-004', order: 2 },
  { id: 'stitch-T1-004-03', title: 'Times Tables 3 & 4', threadId: 'thread-T1-004', order: 3 },
  { id: 'stitch-T1-004-04', title: 'Multiplication Facts', threadId: 'thread-T1-004', order: 4 },
  { id: 'stitch-T1-004-05', title: 'Mixed Multiplication', threadId: 'thread-T1-004', order: 5 },
  { id: 'stitch-T1-005-01', title: 'Division Intro', threadId: 'thread-T1-005', order: 1 },
  { id: 'stitch-T1-005-02', title: 'Sharing Equally', threadId: 'thread-T1-005', order: 2 },
  { id: 'stitch-T1-005-03', title: 'Division Facts', threadId: 'thread-T1-005', order: 3 },
  { id: 'stitch-T1-005-04', title: 'Division Properties', threadId: 'thread-T1-005', order: 4 },
  { id: 'stitch-T1-005-05', title: 'Mixed Division', threadId: 'thread-T1-005', order: 5 },
  { id: 'stitch-T1-006-01', title: 'Fraction Basics', threadId: 'thread-T1-006', order: 1 },
  { id: 'stitch-T1-006-02', title: 'Equivalent Fractions', threadId: 'thread-T1-006', order: 2 },
  { id: 'stitch-T1-006-03', title: 'Comparing Fractions', threadId: 'thread-T1-006', order: 3 },
  { id: 'stitch-T1-006-04', title: 'Adding Fractions', threadId: 'thread-T1-006', order: 4 },
  { id: 'stitch-T1-006-05', title: 'Mixed Fractions', threadId: 'thread-T1-006', order: 5 },
];

// Thread definitions
const BUNDLED_THREADS = [
  { id: 'thread-T1-001', title: 'Number Basics', tubeId: 'tube-T1' },
  { id: 'thread-T1-002', title: 'Addition', tubeId: 'tube-T1' },
  { id: 'thread-T1-003', title: 'Subtraction', tubeId: 'tube-T1' },
  { id: 'thread-T1-004', title: 'Multiplication', tubeId: 'tube-T1' },
  { id: 'thread-T1-005', title: 'Division', tubeId: 'tube-T1' },
  { id: 'thread-T1-006', title: 'Fractions', tubeId: 'tube-T1' },
];

/**
 * Fisher-Yates shuffle algorithm
 * Randomizes array elements in-place
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]; // Create a copy
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generates a random path through the bundled stitches
 * maintaining thread grouping but randomizing order
 */
export function generateRandomLearningPath() {
  // Shuffle threads first
  const shuffledThreads = shuffleArray(BUNDLED_THREADS);
  
  // Create a container for our shuffled stitches
  let shuffledPath = [];
  
  // For each thread, add its stitches (in their original order)
  shuffledThreads.forEach(thread => {
    const threadStitches = BUNDLED_STITCHES
      .filter(stitch => stitch.threadId === thread.id)
      .sort((a, b) => a.order - b.order); // Keep the stitches in their pedagogical order
    
    shuffledPath = [...shuffledPath, ...threadStitches];
  });
  
  return {
    stitches: shuffledPath,
    threads: shuffledThreads,
    message: "Using bundled content - your progress won't be saved until connection is restored",
    isFallback: true
  };
}

/**
 * Returns a suggested stitch when database is unavailable
 * Tries to select a pedagogically sound next stitch
 */
export function getSuggestedFallbackStitch(currentStitchId?: string) {
  // If we have the current stitch ID, try to suggest the next appropriate one
  if (currentStitchId) {
    const currentIndex = BUNDLED_STITCHES.findIndex(s => s.id === currentStitchId);
    
    if (currentIndex >= 0) {
      // Find current thread
      const currentStitch = BUNDLED_STITCHES[currentIndex];
      const currentThread = currentStitch.threadId;
      const currentOrder = currentStitch.order;
      
      // Try to get next stitch in same thread
      const nextInThread = BUNDLED_STITCHES.find(
        s => s.threadId === currentThread && s.order === currentOrder + 1
      );
      
      if (nextInThread) {
        return nextInThread;
      }
      
      // If at end of thread, start a new thread
      const currentThreadIndex = BUNDLED_THREADS.findIndex(t => t.id === currentThread);
      
      if (currentThreadIndex >= 0 && currentThreadIndex < BUNDLED_THREADS.length - 1) {
        // Get first stitch of next thread
        const nextThread = BUNDLED_THREADS[currentThreadIndex + 1];
        return BUNDLED_STITCHES.find(s => s.threadId === nextThread.id && s.order === 1);
      }
    }
  }
  
  // If we can't determine next appropriate stitch, just return a random one
  return BUNDLED_STITCHES[Math.floor(Math.random() * BUNDLED_STITCHES.length)];
}

/**
 * Returns all bundled stitches for a specific thread
 */
export function getThreadStitches(threadId: string) {
  return BUNDLED_STITCHES
    .filter(stitch => stitch.threadId === threadId)
    .sort((a, b) => a.order - b.order);
}

/**
 * Returns all bundled threads
 */
export function getAllBundledThreads() {
  return BUNDLED_THREADS;
}

/**
 * Gets the entire bundled content set
 */
export function getBundledContent() {
  return {
    stitches: BUNDLED_STITCHES,
    threads: BUNDLED_THREADS
  };
}