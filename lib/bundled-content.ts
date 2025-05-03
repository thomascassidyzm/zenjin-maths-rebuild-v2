/**
 * Bundled content for initial stitches
 * 
 * This file contains hard-coded content for the first stitch of each tube,
 * allowing the app to function immediately without waiting for API calls.
 */

import { StitchContent } from './client/content-buffer';

/**
 * First stitch of each tube, bundled with the app
 * These stitches will be immediately available without any API calls
 */
export const BUNDLED_INITIAL_STITCHES: Record<string, StitchContent> = {
  // Tube 1 - First stitch
  'stitch-T1-001-01': {
    id: 'stitch-T1-001-01',
    threadId: 'thread-T1-001',
    title: 'Number Recognition',
    content: 'Recognize and identify numbers.',
    order: 1,
    questions: [
      {
        id: 'stitch-T1-001-01-q01',
        text: 'What number is this: 7?',
        correctAnswer: '7',
        distractors: {
          L1: '1',
          L2: '9',
          L3: '4'
        }
      },
      {
        id: 'stitch-T1-001-01-q02',
        text: 'What number is this: 3?',
        correctAnswer: '3',
        distractors: {
          L1: '8',
          L2: '5',
          L3: '2'
        }
      },
      {
        id: 'stitch-T1-001-01-q03',
        text: 'What number is this: 5?',
        correctAnswer: '5',
        distractors: {
          L1: '6',
          L2: '2',
          L3: '9'
        }
      }
    ]
  },

  // Tube 2 - First stitch
  'stitch-T2-001-01': {
    id: 'stitch-T2-001-01',
    threadId: 'thread-T2-001',
    title: 'Simple Addition',
    content: 'Basic addition of single-digit numbers.',
    order: 1,
    questions: [
      {
        id: 'stitch-T2-001-01-q01',
        text: 'What is 1 + 1?',
        correctAnswer: '2',
        distractors: {
          L1: '3',
          L2: '11',
          L3: '0'
        }
      },
      {
        id: 'stitch-T2-001-01-q02',
        text: 'What is 2 + 2?',
        correctAnswer: '4',
        distractors: {
          L1: '3',
          L2: '5',
          L3: '22'
        }
      },
      {
        id: 'stitch-T2-001-01-q03',
        text: 'What is 3 + 2?',
        correctAnswer: '5',
        distractors: {
          L1: '6',
          L2: '4',
          L3: '32'
        }
      }
    ]
  },

  // Tube 3 - First stitch
  'stitch-T3-001-01': {
    id: 'stitch-T3-001-01',
    threadId: 'thread-T3-001',
    title: 'Simple Problem Solving',
    content: 'Basic word problems using addition.',
    order: 1,
    questions: [
      {
        id: 'stitch-T3-001-01-q01',
        text: 'Sam has 2 apples. He gets 1 more apple. How many apples does Sam have now?',
        correctAnswer: '3',
        distractors: {
          L1: '2',
          L2: '4',
          L3: '1'
        }
      },
      {
        id: 'stitch-T3-001-01-q02',
        text: 'There are 3 birds on a tree. 2 more birds join them. How many birds are there now?',
        correctAnswer: '5',
        distractors: {
          L1: '3',
          L2: '4',
          L3: '6'
        }
      },
      {
        id: 'stitch-T3-001-01-q03',
        text: 'Emma has 4 stickers. Her friend gives her 3 more. How many stickers does Emma have now?',
        correctAnswer: '7',
        distractors: {
          L1: '6',
          L2: '5',
          L3: '8'
        }
      }
    ]
  }
};

/**
 * Default manifest structure
 * This provides the basic structure for the first 10 stitches of each tube
 * Only IDs and structural information - content is loaded separately
 */
export const DEFAULT_MANIFEST = {
  version: 1,
  generated: new Date().toISOString(),
  tubes: {
    1: {
      threads: {
        'thread-T1-001': {
          title: 'Number Facts',
          stitches: [
            { id: 'stitch-T1-001-01', order: 1, title: 'Number Recognition' },
            { id: 'stitch-T1-001-02', order: 2, title: 'Counting to 5' },
            { id: 'stitch-T1-001-03', order: 3, title: 'Counting to 10' },
            { id: 'stitch-T1-001-04', order: 4, title: 'Number Sequences' },
            { id: 'stitch-T1-001-05', order: 5, title: 'Even and Odd Numbers' },
            { id: 'stitch-T1-001-06', order: 6, title: 'Comparing Numbers' },
            { id: 'stitch-T1-001-07', order: 7, title: 'Number Bonds to 5' },
            { id: 'stitch-T1-001-08', order: 8, title: 'Number Bonds to 10' },
            { id: 'stitch-T1-001-09', order: 9, title: 'Place Value: Tens and Ones' },
            { id: 'stitch-T1-001-10', order: 10, title: 'Number Facts Review' }
          ]
        }
      }
    },
    2: {
      threads: {
        'thread-T2-001': {
          title: 'Basic Operations',
          stitches: [
            { id: 'stitch-T2-001-01', order: 1, title: 'Simple Addition' },
            { id: 'stitch-T2-001-02', order: 2, title: 'Addition to 10' },
            { id: 'stitch-T2-001-03', order: 3, title: 'Simple Subtraction' },
            { id: 'stitch-T2-001-04', order: 4, title: 'Subtraction within 10' },
            { id: 'stitch-T2-001-05', order: 5, title: 'Addition to 20' },
            { id: 'stitch-T2-001-06', order: 6, title: 'Subtraction within 20' },
            { id: 'stitch-T2-001-07', order: 7, title: 'Simple Multiplication' },
            { id: 'stitch-T2-001-08', order: 8, title: 'Simple Division' },
            { id: 'stitch-T2-001-09', order: 9, title: 'Mixed Operations' },
            { id: 'stitch-T2-001-10', order: 10, title: 'Basic Operations Review' }
          ]
        }
      }
    },
    3: {
      threads: {
        'thread-T3-001': {
          title: 'Problem Solving',
          stitches: [
            { id: 'stitch-T3-001-01', order: 1, title: 'Simple Problem Solving' },
            { id: 'stitch-T3-001-02', order: 2, title: 'Addition Word Problems' },
            { id: 'stitch-T3-001-03', order: 3, title: 'Subtraction Word Problems' },
            { id: 'stitch-T3-001-04', order: 4, title: 'Mixed Operation Problems' },
            { id: 'stitch-T3-001-05', order: 5, title: 'Money Problems' },
            { id: 'stitch-T3-001-06', order: 6, title: 'Time Problems' },
            { id: 'stitch-T3-001-07', order: 7, title: 'Measurement Problems' },
            { id: 'stitch-T3-001-08', order: 8, title: 'Pattern Problems' },
            { id: 'stitch-T3-001-09', order: 9, title: 'Multi-step Problems' },
            { id: 'stitch-T3-001-10', order: 10, title: 'Problem Solving Review' }
          ]
        }
      }
    }
  },
  stats: {
    tubeCount: 3,
    threadCount: 3,
    stitchCount: 30
  }
};