/**
 * Expanded Bundled Content
 * 
 * This file contains hard-coded content for the first 10 stitches of each tube,
 * allowing the app to function entirely offline with a complete learning experience.
 */

import { StitchContent } from './client/content-buffer';

/**
 * Complete set of basic stitches for each tube (10 per tube × 3 tubes = 30 total)
 * These stitches are bundled with the app for immediate use without any API calls
 * 
 * IMPORTANT: This ensures anonymous and free users have identical content experiences,
 * differing only in the persistence of their progress.
 */
export const BUNDLED_FULL_CONTENT: Record<string, StitchContent> = {
  // ============ TUBE 1: Number Facts ============
  // Stitch 1
  'stitch-T1-001-01': {
    id: 'stitch-T1-001-01',
    threadId: 'thread-T1-001',
    title: 'Number Recognition',
    content: 'Recognize and identify numbers from 0 to 9.',
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
  // Stitch 2
  'stitch-T1-001-02': {
    id: 'stitch-T1-001-02',
    threadId: 'thread-T1-001',
    title: 'Counting to 5',
    content: 'Learn to count objects from 1 to 5.',
    order: 2,
    questions: [
      {
        id: 'stitch-T1-001-02-q01',
        text: 'How many apples are shown? 🍎🍎🍎',
        correctAnswer: '3',
        distractors: {
          L1: '2',
          L2: '4',
          L3: '5'
        }
      },
      {
        id: 'stitch-T1-001-02-q02',
        text: 'How many stars are there? ⭐⭐⭐⭐',
        correctAnswer: '4',
        distractors: {
          L1: '3',
          L2: '5',
          L3: '2'
        }
      },
      {
        id: 'stitch-T1-001-02-q03',
        text: 'Count the hearts: ❤️❤️',
        correctAnswer: '2',
        distractors: {
          L1: '1',
          L2: '3',
          L3: '4'
        }
      }
    ]
  },
  // Stitch 3
  'stitch-T1-001-03': {
    id: 'stitch-T1-001-03',
    threadId: 'thread-T1-001',
    title: 'Counting to 10',
    content: 'Learn to count objects from 6 to 10.',
    order: 3,
    questions: [
      {
        id: 'stitch-T1-001-03-q01',
        text: 'How many dots? ⚫⚫⚫⚫⚫⚫⚫',
        correctAnswer: '7',
        distractors: {
          L1: '6',
          L2: '8',
          L3: '9'
        }
      },
      {
        id: 'stitch-T1-001-03-q02',
        text: 'Count the shapes: 🔶🔶🔶🔶🔶🔶🔶🔶',
        correctAnswer: '8',
        distractors: {
          L1: '7',
          L2: '9',
          L3: '6'
        }
      },
      {
        id: 'stitch-T1-001-03-q03',
        text: 'How many flowers? 🌸🌸🌸🌸🌸🌸🌸🌸🌸',
        correctAnswer: '9',
        distractors: {
          L1: '8',
          L2: '10',
          L3: '7'
        }
      }
    ]
  },
  // Stitch 4
  'stitch-T1-001-04': {
    id: 'stitch-T1-001-04',
    threadId: 'thread-T1-001',
    title: 'Number Sequences',
    content: 'Learn to recognize and continue number patterns.',
    order: 4,
    questions: [
      {
        id: 'stitch-T1-001-04-q01',
        text: 'What comes next: 2, 4, 6, 8, ?',
        correctAnswer: '10',
        distractors: {
          L1: '9',
          L2: '12',
          L3: '7'
        }
      },
      {
        id: 'stitch-T1-001-04-q02',
        text: 'Complete the sequence: 1, 3, 5, 7, ?',
        correctAnswer: '9',
        distractors: {
          L1: '8',
          L2: '10',
          L3: '6'
        }
      },
      {
        id: 'stitch-T1-001-04-q03',
        text: 'What number is missing? 5, 10, ?, 20, 25',
        correctAnswer: '15',
        distractors: {
          L1: '12',
          L2: '18',
          L3: '16'
        }
      }
    ]
  },
  // Stitch 5
  'stitch-T1-001-05': {
    id: 'stitch-T1-001-05',
    threadId: 'thread-T1-001',
    title: 'Even and Odd Numbers',
    content: 'Learn to identify even and odd numbers.',
    order: 5,
    questions: [
      {
        id: 'stitch-T1-001-05-q01',
        text: 'Which number is even?',
        correctAnswer: '6',
        distractors: {
          L1: '3',
          L2: '9',
          L3: '5'
        }
      },
      {
        id: 'stitch-T1-001-05-q02',
        text: 'Which number is odd?',
        correctAnswer: '7',
        distractors: {
          L1: '4',
          L2: '10',
          L3: '8'
        }
      },
      {
        id: 'stitch-T1-001-05-q03',
        text: 'Which group contains only even numbers?',
        correctAnswer: '2, 4, 6, 8',
        distractors: {
          L1: '1, 3, 5, 7',
          L2: '2, 4, 5, 8',
          L3: '2, 3, 6, 9'
        }
      }
    ]
  },
  // Stitch 6
  'stitch-T1-001-06': {
    id: 'stitch-T1-001-06',
    threadId: 'thread-T1-001',
    title: 'Comparing Numbers',
    content: 'Learn to compare numbers using greater than, less than, and equal to.',
    order: 6,
    questions: [
      {
        id: 'stitch-T1-001-06-q01',
        text: 'Which is greater: 7 or 4?',
        correctAnswer: '7',
        distractors: {
          L1: '4',
          L2: 'They are equal',
          L3: 'Cannot compare'
        }
      },
      {
        id: 'stitch-T1-001-06-q02',
        text: 'Which is less: 9 or 12?',
        correctAnswer: '9',
        distractors: {
          L1: '12',
          L2: 'They are equal',
          L3: 'Cannot compare'
        }
      },
      {
        id: 'stitch-T1-001-06-q03',
        text: 'Put these in order from smallest to largest: 8, 3, 6',
        correctAnswer: '3, 6, 8',
        distractors: {
          L1: '8, 6, 3',
          L2: '3, 8, 6',
          L3: '6, 3, 8'
        }
      }
    ]
  },
  // Stitch 7
  'stitch-T1-001-07': {
    id: 'stitch-T1-001-07',
    threadId: 'thread-T1-001',
    title: 'Number Bonds to 5',
    content: 'Learn pairs of numbers that add up to 5.',
    order: 7,
    questions: [
      {
        id: 'stitch-T1-001-07-q01',
        text: 'What number goes with 3 to make 5?',
        correctAnswer: '2',
        distractors: {
          L1: '1',
          L2: '3',
          L3: '4'
        }
      },
      {
        id: 'stitch-T1-001-07-q02',
        text: 'What number goes with 1 to make 5?',
        correctAnswer: '4',
        distractors: {
          L1: '3',
          L2: '2',
          L3: '5'
        }
      },
      {
        id: 'stitch-T1-001-07-q03',
        text: 'Fill in the blank: 5 = 0 + ?',
        correctAnswer: '5',
        distractors: {
          L1: '4',
          L2: '0',
          L3: '3'
        }
      }
    ]
  },
  // Stitch 8
  'stitch-T1-001-08': {
    id: 'stitch-T1-001-08',
    threadId: 'thread-T1-001',
    title: 'Number Bonds to 10',
    content: 'Learn pairs of numbers that add up to 10.',
    order: 8,
    questions: [
      {
        id: 'stitch-T1-001-08-q01',
        text: 'What number goes with 7 to make 10?',
        correctAnswer: '3',
        distractors: {
          L1: '2',
          L2: '4',
          L3: '5'
        }
      },
      {
        id: 'stitch-T1-001-08-q02',
        text: 'What number goes with 6 to make 10?',
        correctAnswer: '4',
        distractors: {
          L1: '3',
          L2: '5',
          L3: '2'
        }
      },
      {
        id: 'stitch-T1-001-08-q03',
        text: 'Fill in the blank: 10 = 8 + ?',
        correctAnswer: '2',
        distractors: {
          L1: '1',
          L2: '3',
          L3: '8'
        }
      }
    ]
  },
  // Stitch 9
  'stitch-T1-001-09': {
    id: 'stitch-T1-001-09',
    threadId: 'thread-T1-001',
    title: 'Place Value: Tens and Ones',
    content: 'Learn to understand the place value of digits in 2-digit numbers.',
    order: 9,
    questions: [
      {
        id: 'stitch-T1-001-09-q01',
        text: 'In the number 35, what digit is in the tens place?',
        correctAnswer: '3',
        distractors: {
          L1: '5',
          L2: '8',
          L3: '0'
        }
      },
      {
        id: 'stitch-T1-001-09-q02',
        text: 'In the number 24, what digit is in the ones place?',
        correctAnswer: '4',
        distractors: {
          L1: '2',
          L2: '0',
          L3: '1'
        }
      },
      {
        id: 'stitch-T1-001-09-q03',
        text: 'What number has 4 tens and 7 ones?',
        correctAnswer: '47',
        distractors: {
          L1: '74',
          L2: '407',
          L3: '17'
        }
      }
    ]
  },
  // Stitch 10
  'stitch-T1-001-10': {
    id: 'stitch-T1-001-10',
    threadId: 'thread-T1-001',
    title: 'Number Facts Review',
    content: 'Review and practice the number concepts learned so far.',
    order: 10,
    questions: [
      {
        id: 'stitch-T1-001-10-q01',
        text: 'Which is an odd number?',
        correctAnswer: '9',
        distractors: {
          L1: '2',
          L2: '6',
          L3: '8'
        }
      },
      {
        id: 'stitch-T1-001-10-q02',
        text: 'What number comes next: 10, 20, 30, ?',
        correctAnswer: '40',
        distractors: {
          L1: '35',
          L2: '50',
          L3: '31'
        }
      },
      {
        id: 'stitch-T1-001-10-q03',
        text: 'Which number has 2 tens and 5 ones?',
        correctAnswer: '25',
        distractors: {
          L1: '52',
          L2: '205',
          L3: '15'
        }
      }
    ]
  },

  // ============ TUBE 2: Basic Operations ============
  // Stitch 1
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
  // Stitch 2
  'stitch-T2-001-02': {
    id: 'stitch-T2-001-02',
    threadId: 'thread-T2-001',
    title: 'Addition to 10',
    content: 'Addition with sums up to 10.',
    order: 2,
    questions: [
      {
        id: 'stitch-T2-001-02-q01',
        text: 'What is 5 + 3?',
        correctAnswer: '8',
        distractors: {
          L1: '7',
          L2: '9',
          L3: '6'
        }
      },
      {
        id: 'stitch-T2-001-02-q02',
        text: 'What is 4 + 4?',
        correctAnswer: '8',
        distractors: {
          L1: '7',
          L2: '6',
          L3: '9'
        }
      },
      {
        id: 'stitch-T2-001-02-q03',
        text: 'What is 6 + 4?',
        correctAnswer: '10',
        distractors: {
          L1: '9',
          L2: '11',
          L3: '8'
        }
      }
    ]
  },
  // Stitch 3
  'stitch-T2-001-03': {
    id: 'stitch-T2-001-03',
    threadId: 'thread-T2-001',
    title: 'Simple Subtraction',
    content: 'Basic subtraction with single-digit numbers.',
    order: 3,
    questions: [
      {
        id: 'stitch-T2-001-03-q01',
        text: 'What is 5 - 2?',
        correctAnswer: '3',
        distractors: {
          L1: '4',
          L2: '2',
          L3: '7'
        }
      },
      {
        id: 'stitch-T2-001-03-q02',
        text: 'What is 7 - 3?',
        correctAnswer: '4',
        distractors: {
          L1: '3',
          L2: '5',
          L3: '2'
        }
      },
      {
        id: 'stitch-T2-001-03-q03',
        text: 'What is 8 - 4?',
        correctAnswer: '4',
        distractors: {
          L1: '5',
          L2: '3',
          L3: '6'
        }
      }
    ]
  },
  // Stitch 4
  'stitch-T2-001-04': {
    id: 'stitch-T2-001-04',
    threadId: 'thread-T2-001',
    title: 'Subtraction within 10',
    content: 'Subtraction problems with numbers up to 10.',
    order: 4,
    questions: [
      {
        id: 'stitch-T2-001-04-q01',
        text: 'What is 10 - 4?',
        correctAnswer: '6',
        distractors: {
          L1: '5',
          L2: '7',
          L3: '4'
        }
      },
      {
        id: 'stitch-T2-001-04-q02',
        text: 'What is 9 - 5?',
        correctAnswer: '4',
        distractors: {
          L1: '3',
          L2: '5',
          L3: '6'
        }
      },
      {
        id: 'stitch-T2-001-04-q03',
        text: 'What is 8 - 7?',
        correctAnswer: '1',
        distractors: {
          L1: '2',
          L2: '0',
          L3: '3'
        }
      }
    ]
  },
  // Stitch 5
  'stitch-T2-001-05': {
    id: 'stitch-T2-001-05',
    threadId: 'thread-T2-001',
    title: 'Addition to 20',
    content: 'Addition with sums up to 20.',
    order: 5,
    questions: [
      {
        id: 'stitch-T2-001-05-q01',
        text: 'What is 9 + 8?',
        correctAnswer: '17',
        distractors: {
          L1: '16',
          L2: '18',
          L3: '15'
        }
      },
      {
        id: 'stitch-T2-001-05-q02',
        text: 'What is 12 + 5?',
        correctAnswer: '17',
        distractors: {
          L1: '16',
          L2: '18',
          L3: '7'
        }
      },
      {
        id: 'stitch-T2-001-05-q03',
        text: 'What is 7 + 7?',
        correctAnswer: '14',
        distractors: {
          L1: '13',
          L2: '15',
          L3: '16'
        }
      }
    ]
  },
  // Stitch 6
  'stitch-T2-001-06': {
    id: 'stitch-T2-001-06',
    threadId: 'thread-T2-001',
    title: 'Subtraction within 20',
    content: 'Subtraction problems with numbers up to 20.',
    order: 6,
    questions: [
      {
        id: 'stitch-T2-001-06-q01',
        text: 'What is 15 - 7?',
        correctAnswer: '8',
        distractors: {
          L1: '9',
          L2: '7',
          L3: '6'
        }
      },
      {
        id: 'stitch-T2-001-06-q02',
        text: 'What is 18 - 9?',
        correctAnswer: '9',
        distractors: {
          L1: '8',
          L2: '10',
          L3: '7'
        }
      },
      {
        id: 'stitch-T2-001-06-q03',
        text: 'What is 14 - 6?',
        correctAnswer: '8',
        distractors: {
          L1: '7',
          L2: '9',
          L3: '10'
        }
      }
    ]
  },
  // Stitch 7
  'stitch-T2-001-07': {
    id: 'stitch-T2-001-07',
    threadId: 'thread-T2-001',
    title: 'Simple Multiplication',
    content: 'Introduction to multiplication as repeated addition.',
    order: 7,
    questions: [
      {
        id: 'stitch-T2-001-07-q01',
        text: 'What is 2 × 3?',
        correctAnswer: '6',
        distractors: {
          L1: '5',
          L2: '8',
          L3: '4'
        }
      },
      {
        id: 'stitch-T2-001-07-q02',
        text: 'What is 4 × 2?',
        correctAnswer: '8',
        distractors: {
          L1: '6',
          L2: '10',
          L3: '7'
        }
      },
      {
        id: 'stitch-T2-001-07-q03',
        text: 'What is 5 × 1?',
        correctAnswer: '5',
        distractors: {
          L1: '6',
          L2: '4',
          L3: '0'
        }
      }
    ]
  },
  // Stitch 8
  'stitch-T2-001-08': {
    id: 'stitch-T2-001-08',
    threadId: 'thread-T2-001',
    title: 'Simple Division',
    content: 'Introduction to division as sharing equally.',
    order: 8,
    questions: [
      {
        id: 'stitch-T2-001-08-q01',
        text: 'What is 6 ÷ 2?',
        correctAnswer: '3',
        distractors: {
          L1: '4',
          L2: '2',
          L3: '12'
        }
      },
      {
        id: 'stitch-T2-001-08-q02',
        text: 'What is 8 ÷ 4?',
        correctAnswer: '2',
        distractors: {
          L1: '3',
          L2: '4',
          L3: '1'
        }
      },
      {
        id: 'stitch-T2-001-08-q03',
        text: 'What is 9 ÷ 3?',
        correctAnswer: '3',
        distractors: {
          L1: '2',
          L2: '4',
          L3: '6'
        }
      }
    ]
  },
  // Stitch 9
  'stitch-T2-001-09': {
    id: 'stitch-T2-001-09',
    threadId: 'thread-T2-001',
    title: 'Mixed Operations',
    content: 'Combining different operations in simple problems.',
    order: 9,
    questions: [
      {
        id: 'stitch-T2-001-09-q01',
        text: 'What is 5 + 2 - 3?',
        correctAnswer: '4',
        distractors: {
          L1: '3',
          L2: '5',
          L3: '0'
        }
      },
      {
        id: 'stitch-T2-001-09-q02',
        text: 'What is 3 × 2 + 1?',
        correctAnswer: '7',
        distractors: {
          L1: '6',
          L2: '9',
          L3: '8'
        }
      },
      {
        id: 'stitch-T2-001-09-q03',
        text: 'What is 10 - 4 + 2?',
        correctAnswer: '8',
        distractors: {
          L1: '6',
          L2: '12',
          L3: '4'
        }
      }
    ]
  },
  // Stitch 10
  'stitch-T2-001-10': {
    id: 'stitch-T2-001-10',
    threadId: 'thread-T2-001',
    title: 'Basic Operations Review',
    content: 'Review and practice of addition, subtraction, multiplication, and division.',
    order: 10,
    questions: [
      {
        id: 'stitch-T2-001-10-q01',
        text: 'What is 12 - 5?',
        correctAnswer: '7',
        distractors: {
          L1: '6',
          L2: '8',
          L3: '5'
        }
      },
      {
        id: 'stitch-T2-001-10-q02',
        text: 'What is 3 × 3?',
        correctAnswer: '9',
        distractors: {
          L1: '6',
          L2: '12',
          L3: '8'
        }
      },
      {
        id: 'stitch-T2-001-10-q03',
        text: 'What is 10 ÷ 2?',
        correctAnswer: '5',
        distractors: {
          L1: '4',
          L2: '20',
          L3: '2'
        }
      }
    ]
  },

  // ============ TUBE 3: Problem Solving ============
  // Stitch 1
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
  },
  // Stitch 2
  'stitch-T3-001-02': {
    id: 'stitch-T3-001-02',
    threadId: 'thread-T3-001',
    title: 'Addition Word Problems',
    content: 'Word problems involving addition with larger numbers.',
    order: 2,
    questions: [
      {
        id: 'stitch-T3-001-02-q01',
        text: 'There are
 8 children on a bus. 5 more children get on. How many children are on the bus now?',
        correctAnswer: '13',
        distractors: {
          L1: '12',
          L2: '14',
          L3: '11'
        }
      },
      {
        id: 'stitch-T3-001-02-q02',
        text: 'Tom scored 7 points in the first game and 6 points in the second game. How many points did he score in total?',
        correctAnswer: '13',
        distractors: {
          L1: '12',
          L2: '14',
          L3: '11'
        }
      },
      {
        id: 'stitch-T3-001-02-q03',
        text: 'Sarah has 9 blue marbles and 8 red marbles. How many marbles does she have altogether?',
        correctAnswer: '17',
        distractors: {
          L1: '16',
          L2: '18',
          L3: '15'
        }
      }
    ]
  },
  // Stitch 3
  'stitch-T3-001-03': {
    id: 'stitch-T3-001-03',
    threadId: 'thread-T3-001',
    title: 'Subtraction Word Problems',
    content: 'Word problems involving subtraction.',
    order: 3,
    questions: [
      {
        id: 'stitch-T3-001-03-q01',
        text: 'Lisa had 7 cookies. She ate 3 of them. How many cookies does she have left?',
        correctAnswer: '4',
        distractors: {
          L1: '3',
          L2: '5',
          L3: '2'
        }
      },
      {
        id: 'stitch-T3-001-03-q02',
        text: 'There were 15 birds in a tree. 6 birds flew away. How many birds are left in the tree?',
        correctAnswer: '9',
        distractors: {
          L1: '8',
          L2: '10',
          L3: '7'
        }
      },
      {
        id: 'stitch-T3-001-03-q03',
        text: 'Jack had 12 stickers. He gave 5 stickers to his friend. How many stickers does Jack have now?',
        correctAnswer: '7',
        distractors: {
          L1: '6',
          L2: '8',
          L3: '5'
        }
      }
    ]
  },
  // Stitch 4
  'stitch-T3-001-04': {
    id: 'stitch-T3-001-04',
    threadId: 'thread-T3-001',
    title: 'Mixed Operation Problems',
    content: 'Word problems involving both addition and subtraction.',
    order: 4,
    questions: [
      {
        id: 'stitch-T3-001-04-q01',
        text: 'Tim had 5 candies. His mother gave him 3 more. Then he ate 2. How many candies does Tim have now?',
        correctAnswer: '6',
        distractors: {
          L1: '5',
          L2: '7',
          L3: '8'
        }
      },
      {
        id: 'stitch-T3-001-04-q02',
        text: 'There were 8 apples in a basket. Mary put in 4 more. Then John took 3. How many apples are in the basket now?',
        correctAnswer: '9',
        distractors: {
          L1: '8',
          L2: '10',
          L3: '7'
        }
      },
      {
        id: 'stitch-T3-001-04-q03',
        text: 'A bookshelf had 12 books. Sam added 5 more books. Then he removed 7 books. How many books are on the shelf now?',
        correctAnswer: '10',
        distractors: {
          L1: '9',
          L2: '11',
          L3: '8'
        }
      }
    ]
  },
  // Stitch 5
  'stitch-T3-001-05': {
    id: 'stitch-T3-001-05',
    threadId: 'thread-T3-001',
    title: 'Money Problems',
    content: 'Word problems involving money.',
    order: 5,
    questions: [
      {
        id: 'stitch-T3-001-05-q01',
        text: 'Ben has 15 pence. He spends 8 pence on a sticker. How much money does he have left?',
        correctAnswer: '7 pence',
        distractors: {
          L1: '6 pence',
          L2: '8 pence',
          L3: '9 pence'
        }
      },
      {
        id: 'stitch-T3-001-05-q02',
        text: 'A pencil costs 12 pence and an eraser costs 5 pence. How much do they cost together?',
        correctAnswer: '17 pence',
        distractors: {
          L1: '16 pence',
          L2: '18 pence',
          L3: '7 pence'
        }
      },
      {
        id: 'stitch-T3-001-05-q03',
        text: 'Amy has 20 pence. She buys a pencil for 8 pence and an eraser for 5 pence. How much money does she have left?',
        correctAnswer: '7 pence',
        distractors: {
          L1: '6 pence',
          L2: '8 pence',
          L3: '9 pence'
        }
      }
    ]
  },
  // Stitch 6
  'stitch-T3-001-06': {
    id: 'stitch-T3-001-06',
    threadId: 'thread-T3-001',
    title: 'Time Problems',
    content: 'Word problems involving time.',
    order: 6,
    questions: [
      {
        id: 'stitch-T3-001-06-q01',
        text: 'School starts at 9:00. If it takes Tom 20 minutes to get ready and 15 minutes to walk to school, what time should he wake up?',
        correctAnswer: '8:25',
        distractors: {
          L1: '8:15',
          L2: '8:30',
          L3: '8:35'
        }
      },
      {
        id: 'stitch-T3-001-06-q02',
        text: 'A movie starts at 3:00 and ends at 4:30. How long is the movie?',
        correctAnswer: '1 hour 30 minutes',
        distractors: {
          L1: '1 hour',
          L2: '1 hour 15 minutes',
          L3: '2 hours'
        }
      },
      {
        id: 'stitch-T3-001-06-q03',
        text: 'Sara's piano lesson is 45 minutes long. If it starts at 4:15, what time does it end?',
        correctAnswer: '5:00',
        distractors: {
          L1: '4:50',
          L2: '5:15',
          L3: '5:45'
        }
      }
    ]
  },
  // Stitch 7
  'stitch-T3-001-07': {
    id: 'stitch-T3-001-07',
    threadId: 'thread-T3-001',
    title: 'Measurement Problems',
    content: 'Word problems involving length, weight, and capacity.',
    order: 7,
    questions: [
      {
        id: 'stitch-T3-001-07-q01',
        text: 'A pencil is 8 cm long. A crayon is 5 cm long. How much longer is the pencil than the crayon?',
        correctAnswer: '3 cm',
        distractors: {
          L1: '2 cm',
          L2: '4 cm',
          L3: '13 cm'
        }
      },
      {
        id: 'stitch-T3-001-07-q02',
        text: 'A jug contains 500 ml of water. If 275 ml is poured out, how much water is left?',
        correctAnswer: '225 ml',
        distractors: {
          L1: '250 ml',
          L2: '200 ml',
          L3: '275 ml'
        }
      },
      {
        id: 'stitch-T3-001-07-q03',
        text: 'A bag of apples weighs 1 kg. A bag of oranges weighs 1.5 kg. What is the total weight of both bags?',
        correctAnswer: '2.5 kg',
        distractors: {
          L1: '2 kg',
          L2: '3 kg',
          L3: '1.5 kg'
        }
      }
    ]
  },
  // Stitch 8
  'stitch-T3-001-08': {
    id: 'stitch-T3-001-08',
    threadId: 'thread-T3-001',
    title: 'Pattern Problems',
    content: 'Word problems involving patterns and sequences.',
    order: 8,
    questions: [
      {
        id: 'stitch-T3-001-08-q01',
        text: 'Lucy is making a pattern with beads. She uses 2 blue beads, then 3 red beads, then 2 blue beads, and so on. If she continues this pattern, what color will the 12th bead be?',
        correctAnswer: 'Red',
        distractors: {
          L1: 'Blue',
          L2: 'Green',
          L3: 'Yellow'
        }
      },
      {
        id: 'stitch-T3-001-08-q02',
        text: 'A number pattern goes: 3, 6, 9, 12, ... What will the 7th number be?',
        correctAnswer: '21',
        distractors: {
          L1: '18',
          L2: '24',
          L3: '27'
        }
      },
      {
        id: 'stitch-T3-001-08-q03',
        text: 'Max draws shapes in this pattern: circle, square, triangle, circle, square, triangle, ... What will the 10th shape be?',
        correctAnswer: 'Square',
        distractors: {
          L1: 'Circle',
          L2: 'Triangle',
          L3: 'Rectangle'
        }
      }
    ]
  },
  // Stitch 9
  'stitch-T3-001-09': {
    id: 'stitch-T3-001-09',
    threadId: 'thread-T3-001',
    title: 'Multi-step Problems',
    content: 'More complex word problems requiring multiple operations.',
    order: 9,
    questions: [
      {
        id: 'stitch-T3-001-09-q01',
        text: 'A baker has 24 cookies. He puts them into bags of 3 cookies each. How many bags does he fill?',
        correctAnswer: '8',
        distractors: {
          L1: '7',
          L2: '9',
          L3: '6'
        }
      },
      {
        id: 'stitch-T3-001-09-q02',
        text: 'Alex has 15 marbles. Ben has twice as many. How many marbles do they have altogether?',
        correctAnswer: '45',
        distractors: {
          L1: '30',
          L2: '60',
          L3: '40'
        }
      },
      {
        id: 'stitch-T3-001-09-q03',
        text: 'A class of 28 students is divided into 4 equal groups. Each student needs 2 pencils. How many pencils are needed in total?',
        correctAnswer: '56',
        distractors: {
          L1: '28',
          L2: '32',
          L3: '64'
        }
      }
    ]
  },
  // Stitch 10
  'stitch-T3-001-10': {
    id: 'stitch-T3-001-10',
    threadId: 'thread-T3-001',
    title: 'Problem Solving Review',
    content: 'Review of various problem-solving techniques and strategies.',
    order: 10,
    questions: [
      {
        id: 'stitch-T3-001-10-q01',
        text: 'Sam had some marbles. He gave 5 to his friend and then got 3 more. Now he has 12. How many did he start with?',
        correctAnswer: '14',
        distractors: {
          L1: '10',
          L2: '17',
          L3: '15'
        }
      },
      {
        id: 'stitch-T3-001-10-q02',
        text: 'A fruit basket contains 8 apples, 6 oranges, and 4 bananas. What fraction of the fruits are oranges?',
        correctAnswer: '6/18 or 1/3',
        distractors: {
          L1: '6/14',
          L2: '1/6',
          L3: '1/4'
        }
      },
      {
        id: 'stitch-T3-001-10-q03',
        text: 'A rectangle has a length of 8 cm and a width of 5 cm. What is its perimeter?',
        correctAnswer: '26 cm',
        distractors: {
          L1: '13 cm',
          L2: '40 cm²',
          L3: '18 cm'
        }
      }
    ]
  }
};

/**
 * Export the DEFAULT_MANIFEST for backward compatibility
 * This provides just the structural information about stitches
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