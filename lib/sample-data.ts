import { Thread, Question, ThreadData, StitchWithProgress } from './types/distinction-learning';

/**
 * Generates comprehensive sample thread data compatible with the ThreadData interface
 * The sample data is organized by mathematical topics:
 * - Thread A (Tube 1): Number sense (counting, addition, subtraction, comparisons, word problems)
 * - Thread B (Tube 2): Multiplication/division (times 2/5/10 tables, division by 2/5)
 * - Thread C (Tube 3): Geometry/measurement (shapes, sides, length, area, time)
 * 
 * Each thread has 5 stitches with appropriate progression of difficulty
 */
export function getSampleThreadData(): ThreadData[] {
  // Create sample threads A, B, C with proper structure for the tube cycler
  // Each thread is explicitly assigned to a tube with tube_number
  return [
    // Thread A - Number Sense (Tube 1)
    {
      thread_id: 'thread-A',
      tube_number: 1, // Explicitly set tube number for clarity
      stitches: [
        // Stitch 1: Number Counting 1-10
        {
          id: 'stitch-A-01',
          name: 'Number Counting 1-10',
          description: 'Basic counting exercises',
          order_number: 0,
          skip_number: 3,
          distractor_level: 'L1',
          questions: [
            {
              id: 'A-01-q1',
              text: 'Which number comes after 5?',
              correctAnswer: '6',
              distractors: { L1: '4', L2: '7', L3: '5' }
            },
            {
              id: 'A-01-q2',
              text: 'Count the dots: ● ● ● ●',
              correctAnswer: '4',
              distractors: { L1: '3', L2: '5', L3: '6' }
            },
            {
              id: 'A-01-q3',
              text: 'What number is one less than 10?',
              correctAnswer: '9',
              distractors: { L1: '8', L2: '11', L3: '10' }
            }
          ]
        },
        // Stitch 2: Addition within 10
        {
          id: 'stitch-A-02',
          name: 'Addition within 10',
          description: 'Simple addition facts',
          order_number: 1,
          skip_number: 3,
          distractor_level: 'L1',
          questions: [
            {
              id: 'A-02-q1',
              text: '5 + 3 = ?',
              correctAnswer: '8',
              distractors: { L1: '7', L2: '9', L3: '6' }
            },
            {
              id: 'A-02-q2',
              text: '2 + 7 = ?',
              correctAnswer: '9',
              distractors: { L1: '8', L2: '10', L3: '6' }
            },
            {
              id: 'A-02-q3',
              text: '4 + 4 = ?',
              correctAnswer: '8',
              distractors: { L1: '7', L2: '9', L3: '6' }
            }
          ]
        },
        // Stitch 3: Subtraction within 10
        {
          id: 'stitch-A-03',
          name: 'Subtraction within 10',
          description: 'Simple subtraction facts',
          order_number: 2,
          skip_number: 3,
          distractor_level: 'L1',
          questions: [
            {
              id: 'A-03-q1',
              text: '8 - 3 = ?',
              correctAnswer: '5',
              distractors: { L1: '4', L2: '6', L3: '2' }
            },
            {
              id: 'A-03-q2',
              text: '10 - 7 = ?',
              correctAnswer: '3',
              distractors: { L1: '2', L2: '4', L3: '7' }
            },
            {
              id: 'A-03-q3',
              text: '6 - 3 = ?',
              correctAnswer: '3',
              distractors: { L1: '2', L2: '4', L3: '9' }
            }
          ]
        },
        // Stitch 4: Number Comparisons
        {
          id: 'stitch-A-04',
          name: 'Number Comparisons',
          description: 'Comparing numbers using greater than, less than',
          order_number: 3,
          skip_number: 5,
          distractor_level: 'L2',
          questions: [
            {
              id: 'A-04-q1',
              text: 'Which is greater: 7 or 4?',
              correctAnswer: '7',
              distractors: { L1: '4', L2: 'Same', L3: 'Neither' }
            },
            {
              id: 'A-04-q2',
              text: 'Which is less: 9 or 2?',
              correctAnswer: '2',
              distractors: { L1: '9', L2: 'Same', L3: 'Neither' }
            },
            {
              id: 'A-04-q3',
              text: 'Put these in order from smallest to largest: 6, 2, 9',
              correctAnswer: '2, 6, 9',
              distractors: { L1: '9, 6, 2', L2: '6, 2, 9', L3: '2, 9, 6' }
            }
          ]
        },
        // Stitch 5: Simple Word Problems
        {
          id: 'stitch-A-05',
          name: 'Simple Word Problems',
          description: 'Basic word problems with addition and subtraction',
          order_number: 4,
          skip_number: 5,
          distractor_level: 'L2',
          questions: [
            {
              id: 'A-05-q1',
              text: 'Sam had 5 apples and got 3 more. How many does he have now?',
              correctAnswer: '8',
              distractors: { L1: '7', L2: '2', L3: '15' }
            },
            {
              id: 'A-05-q2',
              text: 'Liz had 9 crayons and gave 4 away. How many does she have left?',
              correctAnswer: '5',
              distractors: { L1: '4', L2: '6', L3: '13' }
            },
            {
              id: 'A-05-q3',
              text: 'There were 7 birds in a tree. 2 more birds joined them. How many birds are in the tree now?',
              correctAnswer: '9',
              distractors: { L1: '8', L2: '5', L3: '10' }
            }
          ]
        }
      ],
      orderMap: [
        { stitch_id: 'stitch-A-01', order_number: 0 },
        { stitch_id: 'stitch-A-02', order_number: 1 },
        { stitch_id: 'stitch-A-03', order_number: 2 },
        { stitch_id: 'stitch-A-04', order_number: 3 },
        { stitch_id: 'stitch-A-05', order_number: 4 }
      ]
    },
    
    // Thread B - Multiplication/Division (Tube 2)
    {
      thread_id: 'thread-B',
      tube_number: 2, // Explicitly set tube number for clarity
      stitches: [
        // Stitch 1: Multiplication by 2
        {
          id: 'stitch-B-01',
          name: 'Multiplication Facts: 2×',
          description: 'Multiplication by 2',
          order_number: 0,
          skip_number: 3,
          distractor_level: 'L1',
          questions: [
            {
              id: 'B-01-q1',
              text: '2 × 4 = ?',
              correctAnswer: '8',
              distractors: { L1: '6', L2: '10', L3: '12' }
            },
            {
              id: 'B-01-q2',
              text: '2 × 7 = ?',
              correctAnswer: '14',
              distractors: { L1: '12', L2: '9', L3: '16' }
            },
            {
              id: 'B-01-q3',
              text: '2 × 3 = ?',
              correctAnswer: '6',
              distractors: { L1: '5', L2: '8', L3: '9' }
            }
          ]
        },
        // Stitch 2: Multiplication by 5
        {
          id: 'stitch-B-02',
          name: 'Multiplication Facts: 5×',
          description: 'Multiplication by 5',
          order_number: 1,
          skip_number: 3,
          distractor_level: 'L1',
          questions: [
            {
              id: 'B-02-q1',
              text: '5 × 3 = ?',
              correctAnswer: '15',
              distractors: { L1: '8', L2: '12', L3: '18' }
            },
            {
              id: 'B-02-q2',
              text: '5 × 6 = ?',
              correctAnswer: '30',
              distractors: { L1: '25', L2: '35', L3: '11' }
            },
            {
              id: 'B-02-q3',
              text: '5 × 4 = ?',
              correctAnswer: '20',
              distractors: { L1: '15', L2: '24', L3: '9' }
            }
          ]
        },
        // Stitch 3: Multiplication by 10
        {
          id: 'stitch-B-03',
          name: 'Multiplication Facts: 10×',
          description: 'Multiplication by 10',
          order_number: 2,
          skip_number: 3,
          distractor_level: 'L1',
          questions: [
            {
              id: 'B-03-q1',
              text: '10 × 4 = ?',
              correctAnswer: '40',
              distractors: { L1: '30', L2: '50', L3: '14' }
            },
            {
              id: 'B-03-q2',
              text: '10 × 7 = ?',
              correctAnswer: '70',
              distractors: { L1: '60', L2: '80', L3: '17' }
            },
            {
              id: 'B-03-q3',
              text: '10 × 9 = ?',
              correctAnswer: '90',
              distractors: { L1: '80', L2: '100', L3: '19' }
            }
          ]
        },
        // Stitch 4: Division by 2
        {
          id: 'stitch-B-04',
          name: 'Division Facts: ÷2',
          description: 'Division by 2',
          order_number: 3,
          skip_number: 5,
          distractor_level: 'L2',
          questions: [
            {
              id: 'B-04-q1',
              text: '10 ÷ 2 = ?',
              correctAnswer: '5',
              distractors: { L1: '4', L2: '6', L3: '8' }
            },
            {
              id: 'B-04-q2',
              text: '14 ÷ 2 = ?',
              correctAnswer: '7',
              distractors: { L1: '6', L2: '8', L3: '12' }
            },
            {
              id: 'B-04-q3',
              text: '8 ÷ 2 = ?',
              correctAnswer: '4',
              distractors: { L1: '3', L2: '5', L3: '6' }
            }
          ]
        },
        // Stitch 5: Division by 5
        {
          id: 'stitch-B-05',
          name: 'Division Facts: ÷5',
          description: 'Division by 5',
          order_number: 4,
          skip_number: 5,
          distractor_level: 'L2',
          questions: [
            {
              id: 'B-05-q1',
              text: '15 ÷ 5 = ?',
              correctAnswer: '3',
              distractors: { L1: '2', L2: '4', L3: '10' }
            },
            {
              id: 'B-05-q2',
              text: '30 ÷ 5 = ?',
              correctAnswer: '6',
              distractors: { L1: '5', L2: '7', L3: '25' }
            },
            {
              id: 'B-05-q3',
              text: '25 ÷ 5 = ?',
              correctAnswer: '5',
              distractors: { L1: '4', L2: '6', L3: '20' }
            }
          ]
        }
      ],
      orderMap: [
        { stitch_id: 'stitch-B-01', order_number: 0 },
        { stitch_id: 'stitch-B-02', order_number: 1 },
        { stitch_id: 'stitch-B-03', order_number: 2 },
        { stitch_id: 'stitch-B-04', order_number: 3 },
        { stitch_id: 'stitch-B-05', order_number: 4 }
      ]
    },
    
    // Thread C - Geometry and Measurement (Tube 3)
    {
      thread_id: 'thread-C',
      tube_number: 3, // Explicitly set tube number for clarity
      stitches: [
        // Stitch 1: Shape Recognition
        {
          id: 'stitch-C-01',
          name: 'Shape Recognition',
          description: 'Identifying basic shapes',
          order_number: 0,
          skip_number: 3,
          distractor_level: 'L1',
          questions: [
            {
              id: 'C-01-q1',
              text: 'A shape with 3 sides is called a:',
              correctAnswer: 'Triangle',
              distractors: { L1: 'Square', L2: 'Circle', L3: 'Rectangle' }
            },
            {
              id: 'C-01-q2',
              text: 'A shape with 4 equal sides is called a:',
              correctAnswer: 'Square',
              distractors: { L1: 'Rectangle', L2: 'Triangle', L3: 'Circle' }
            },
            {
              id: 'C-01-q3',
              text: 'A shape with no corners is called a:',
              correctAnswer: 'Circle',
              distractors: { L1: 'Square', L2: 'Triangle', L3: 'Pentagon' }
            }
          ]
        },
        // Stitch 2: Counting Sides
        {
          id: 'stitch-C-02',
          name: 'Counting Sides',
          description: 'Counting sides of polygons',
          order_number: 1,
          skip_number: 3,
          distractor_level: 'L1',
          questions: [
            {
              id: 'C-02-q1',
              text: 'How many sides does a pentagon have?',
              correctAnswer: '5',
              distractors: { L1: '4', L2: '6', L3: '8' }
            },
            {
              id: 'C-02-q2',
              text: 'How many sides does a hexagon have?',
              correctAnswer: '6',
              distractors: { L1: '5', L2: '7', L3: '8' }
            },
            {
              id: 'C-02-q3',
              text: 'How many sides does an octagon have?',
              correctAnswer: '8',
              distractors: { L1: '6', L2: '7', L3: '9' }
            }
          ]
        },
        // Stitch 3: Length Measurement
        {
          id: 'stitch-C-03',
          name: 'Length Measurement',
          description: 'Measuring length in centimeters and meters',
          order_number: 2,
          skip_number: 3,
          distractor_level: 'L1',
          questions: [
            {
              id: 'C-03-q1',
              text: '100 centimeters = ? meter',
              correctAnswer: '1',
              distractors: { L1: '10', L2: '100', L3: '0.1' }
            },
            {
              id: 'C-03-q2',
              text: '1 meter = ? centimeters',
              correctAnswer: '100',
              distractors: { L1: '10', L2: '1000', L3: '50' }
            },
            {
              id: 'C-03-q3',
              text: '200 centimeters = ? meters',
              correctAnswer: '2',
              distractors: { L1: '20', L2: '0.2', L3: '0.02' }
            }
          ]
        },
        // Stitch 4: Area of Rectangles
        {
          id: 'stitch-C-04',
          name: 'Area of Rectangles',
          description: 'Finding area of simple rectangles',
          order_number: 3,
          skip_number: 5,
          distractor_level: 'L2',
          questions: [
            {
              id: 'C-04-q1',
              text: 'The area of a rectangle with length 4 cm and width 3 cm is:',
              correctAnswer: '12 cm²',
              distractors: { L1: '7 cm²', L2: '14 cm²', L3: '9 cm²' }
            },
            {
              id: 'C-04-q2',
              text: 'The area of a square with sides 5 cm is:',
              correctAnswer: '25 cm²',
              distractors: { L1: '20 cm²', L2: '10 cm²', L3: '15 cm²' }
            },
            {
              id: 'C-04-q3',
              text: 'The area of a rectangle with length 6 cm and width 2 cm is:',
              correctAnswer: '12 cm²',
              distractors: { L1: '8 cm²', L2: '16 cm²', L3: '10 cm²' }
            }
          ]
        },
        // Stitch 5: Time Concepts
        {
          id: 'stitch-C-05',
          name: 'Time Concepts',
          description: 'Basic time measurements',
          order_number: 4,
          skip_number: 5,
          distractor_level: 'L2',
          questions: [
            {
              id: 'C-05-q1',
              text: 'How many minutes in 1 hour?',
              correctAnswer: '60',
              distractors: { L1: '30', L2: '100', L3: '24' }
            },
            {
              id: 'C-05-q2',
              text: 'How many hours in 1 day?',
              correctAnswer: '24',
              distractors: { L1: '12', L2: '60', L3: '100' }
            },
            {
              id: 'C-05-q3',
              text: 'How many days in a week?',
              correctAnswer: '7',
              distractors: { L1: '5', L2: '10', L3: '30' }
            }
          ]
        }
      ],
      orderMap: [
        { stitch_id: 'stitch-C-01', order_number: 0 },
        { stitch_id: 'stitch-C-02', order_number: 1 },
        { stitch_id: 'stitch-C-03', order_number: 2 },
        { stitch_id: 'stitch-C-04', order_number: 3 },
        { stitch_id: 'stitch-C-05', order_number: 4 }
      ]
    }
  ];
}

// Helper function to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Create addition questions for use in various contexts
export function createAdditionQuestions(start = 1, end = 10): Question[] {
  const questions: Question[] = [];
  
  for (let i = start; i <= end; i++) {
    for (let j = 1; j <= 10; j++) {
      const sum = i + j;
      
      questions.push({
        id: `add-${i}-${j}`,
        text: `${i} + ${j}`,
        correctAnswer: sum.toString(),
        distractors: {
          L1: (sum + Math.floor(Math.random() * 5) + 1).toString(),
          L2: (sum + (Math.random() > 0.5 ? 1 : -1)).toString(),
          L3: (sum + (Math.random() > 0.5 ? 2 : -2)).toString()
        }
      });
    }
  }
  
  // Shuffle and return just 20 questions
  return shuffleArray(questions).slice(0, 20);
}

// Create subtraction questions for use in various contexts
export function createSubtractionQuestions(min: number = 5, max: number = 20): Question[] {
  const questions: Question[] = [];
  
  for (let i = min; i <= max; i++) {
    for (let j = 1; j < i; j++) {
      const difference = i - j;
      
      questions.push({
        id: `sub-${i}-${j}`,
        text: `${i} - ${j}`,
        correctAnswer: difference.toString(),
        distractors: {
          L1: (difference + Math.floor(Math.random() * 5) + 1).toString(),
          L2: (difference + (Math.random() > 0.5 ? 1 : -1)).toString(),
          L3: (difference + (Math.random() > 0.5 ? 2 : -2)).toString()
        }
      });
    }
  }
  
  // Shuffle and return just 20 questions
  return shuffleArray(questions).slice(0, 20);
}

// Create multiplication questions by a specific multiplier
export function createTimesQuestions(multiplier: number): Question[] {
  return Array.from({ length: 20 }, (_, i) => 
    createTimesQuestion(multiplier, i + 1)
  );
}

// Generate a multiplication question
export function createTimesQuestion(multiplier: number, number: number): Question {
  const correctAnswer = (multiplier * number).toString();
  
  // Generate an obviously wrong distractor
  // We'll use a simple approach - add or subtract a random number between 1-10
  let distractor = Math.abs(multiplier * number);
  const modifierType = Math.random() > 0.5 ? 1 : -1;
  const modifier = Math.floor(Math.random() * 10) + 1;
  
  distractor += modifierType * modifier;
  
  // Ensure distractor is positive and different from correct answer
  if (distractor <= 0 || distractor === multiplier * number) {
    distractor = multiplier * number + 10;
  }
  
  return {
    id: `${multiplier}x${number}`,
    text: `${multiplier} × ${number}`,
    correctAnswer: correctAnswer,
    distractors: {
      L1: distractor.toString(),
      L2: (multiplier * number + (Math.random() > 0.5 ? 1 : -1)).toString(),
      L3: (multiplier * number + (Math.random() > 0.5 ? 2 : -2)).toString()
    }
  };
}

// Legacy sample data (kept for backwards compatibility)
export const sampleQuestions = Array.from({ length: 20 }, (_, i) => 
  createTimesQuestion(i + 1, 15)
);

export const sampleThread: Thread = {
  id: 'sample-thread-1',
  name: '15 Times Table',
  description: 'Practice multiplying by 15',
  stitches: [
    {
      id: 'sample-stitch-1',
      name: 'Times 15',
      description: 'Multiply various numbers by 15',
      questions: sampleQuestions
    }
  ]
};

export const sampleData = {
  id: 'sample-content-1',
  title: '15 Times Table Practice',
  description: 'Practice multiplying numbers by 15',
  threads: [sampleThread],
  version: '1.0.0',
  metadata: {
    createdAt: new Date().toISOString(),
    totalQuestions: sampleQuestions.length
  }
};