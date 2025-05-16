/**
 * Mock Zustand Store for Player Comparison Demo
 * 
 * This provides a minimal mock implementation of the Zustand store
 * with just enough functionality for the ZustandDistinctionPlayer to work
 * in the player-comparison page.
 */

import { create } from 'zustand';
import { Question } from '../types/distinction-learning';

// Sample questions for the mock store
const sampleQuestions: Question[] = [
  {
    id: 'sample-q1',
    text: '3 + 5',
    correctAnswer: '8',
    distractors: { L1: '7', L2: '9', L3: '6' }
  },
  {
    id: 'sample-q2',
    text: '7 - 2',
    correctAnswer: '5',
    distractors: { L1: '4', L2: '6', L3: '3' }
  },
  {
    id: 'sample-q3',
    text: '4 × 3',
    correctAnswer: '12',
    distractors: { L1: '6', L2: '10', L3: '9' }
  }
];

// Create mock stitch
const sampleStitch = {
  id: 'sample-stitch-1',
  questions: sampleQuestions
};

// Define the store state type
interface ZenjinState {
  // Points and progress
  points: number;
  incrementPoints: (amount: number) => void;
  
  // Content collection
  contentCollection: {
    stitches: Record<string, any>;
  };
  
  // Stitch interaction
  recordStitchInteraction: (stitchId: string, correct: boolean, firstTimeCorrect: boolean) => void;
  
  // Stitch content fetching
  fetchStitch: (stitchId: string) => Promise<any>;
}

// Create the store with mock implementations
export const useZenjinStore = create<ZenjinState>((set, get) => ({
  // Initial points
  points: 0,
  
  // Points increment function
  incrementPoints: (amount) => set((state) => ({ points: state.points + amount })),
  
  // Content collection with mock stitch
  contentCollection: {
    stitches: {
      'sample-stitch-1': sampleStitch
    }
  },
  
  // Mock stitch interaction recording
  recordStitchInteraction: (stitchId, correct, firstTimeCorrect) => {
    console.log('Mock recordStitchInteraction:', { stitchId, correct, firstTimeCorrect });
  },
  
  // Mock stitch fetching
  fetchStitch: async (stitchId) => {
    console.log('Mock fetchStitch:', stitchId);
    
    // If this is our sample stitch, return it immediately
    if (stitchId === 'sample-stitch-1') {
      return sampleStitch;
    }
    
    // Otherwise return a basic stitch with a single question
    return {
      id: stitchId,
      questions: [
        {
          id: `${stitchId}-q1`,
          text: '1 + 1',
          correctAnswer: '2',
          distractors: { L1: '3', L2: '4', L3: '5' }
        }
      ]
    };
  }
}));

// Custom hook for fetching stitch content
export function useStitchContent(stitchId: string) {
  const stitch = useZenjinStore(state => 
    state.contentCollection.stitches[stitchId]
  );
  
  const loading = false;
  const error = null;
  
  // Return the mock stitch
  return { stitch, loading, error };
}