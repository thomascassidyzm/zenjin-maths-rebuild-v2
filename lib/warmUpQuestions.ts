/**
 * Warm-up Questions Module
 * 
 * This module handles the loading, normalization, and selection of warm-up
 * questions that are shown to users while the main content loads.
 */

import { Question } from './types/distinction-learning';

// Embed the warm-up questions directly in the code for reliability
// This also eliminates the need for file loading and error handling
const warmUpQuestionsRaw = [
  {
    "id": "warm-up-q1",
    "stitch_id": "warm-up-stitch",
    "text": "25 + 4",
    "correct_answer": "29",
    "distractors": { "L1": "31", "L2": "24", "L3": "35" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q2",
    "stitch_id": "warm-up-stitch",
    "text": "17 + 8",
    "correct_answer": "25",
    "distractors": { "L1": "15", "L2": "27", "L3": "24" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q3",
    "stitch_id": "warm-up-stitch",
    "text": "36 - 9",
    "correct_answer": "27",
    "distractors": { "L1": "25", "L2": "28", "L3": "45" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q4",
    "stitch_id": "warm-up-stitch",
    "text": "42 - 7",
    "correct_answer": "35",
    "distractors": { "L1": "36", "L2": "37", "L3": "49" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q5",
    "stitch_id": "warm-up-stitch",
    "text": "8 × 6",
    "correct_answer": "48",
    "distractors": { "L1": "42", "L2": "54", "L3": "14" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q6",
    "stitch_id": "warm-up-stitch",
    "text": "7 × 9",
    "correct_answer": "63",
    "distractors": { "L1": "56", "L2": "72", "L3": "16" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q7",
    "stitch_id": "warm-up-stitch",
    "text": "56 ÷ 8",
    "correct_answer": "7",
    "distractors": { "L1": "6", "L2": "8", "L3": "9" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q8",
    "stitch_id": "warm-up-stitch",
    "text": "45 ÷ 9",
    "correct_answer": "5",
    "distractors": { "L1": "4", "L2": "6", "L3": "7" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q9",
    "stitch_id": "warm-up-stitch",
    "text": "13 + 28",
    "correct_answer": "41",
    "distractors": { "L1": "31", "L2": "38", "L3": "51" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q10",
    "stitch_id": "warm-up-stitch",
    "text": "47 - 19",
    "correct_answer": "28",
    "distractors": { "L1": "26", "L2": "29", "L3": "38" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q11",
    "stitch_id": "warm-up-stitch",
    "text": "3 × 12",
    "correct_answer": "36",
    "distractors": { "L1": "30", "L2": "33", "L3": "39" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q12",
    "stitch_id": "warm-up-stitch",
    "text": "50 ÷ 10",
    "correct_answer": "5",
    "distractors": { "L1": "4", "L2": "6", "L3": "40" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q13",
    "stitch_id": "warm-up-stitch",
    "text": "16 + 27",
    "correct_answer": "43",
    "distractors": { "L1": "33", "L2": "42", "L3": "44" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q14",
    "stitch_id": "warm-up-stitch",
    "text": "63 - 37",
    "correct_answer": "26",
    "distractors": { "L1": "24", "L2": "27", "L3": "36" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q15",
    "stitch_id": "warm-up-stitch",
    "text": "5 × 11",
    "correct_answer": "55",
    "distractors": { "L1": "45", "L2": "50", "L3": "56" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q16",
    "stitch_id": "warm-up-stitch",
    "text": "72 ÷ 9",
    "correct_answer": "8",
    "distractors": { "L1": "7", "L2": "9", "L3": "10" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q17",
    "stitch_id": "warm-up-stitch",
    "text": "35 + 47",
    "correct_answer": "82",
    "distractors": { "L1": "72", "L2": "81", "L3": "92" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q18",
    "stitch_id": "warm-up-stitch",
    "text": "91 - 38",
    "correct_answer": "53",
    "distractors": { "L1": "43", "L2": "51", "L3": "57" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q19",
    "stitch_id": "warm-up-stitch",
    "text": "7 × 7",
    "correct_answer": "49",
    "distractors": { "L1": "42", "L2": "48", "L3": "56" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q20",
    "stitch_id": "warm-up-stitch",
    "text": "64 ÷ 8",
    "correct_answer": "8",
    "distractors": { "L1": "6", "L2": "7", "L3": "9" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q21",
    "stitch_id": "warm-up-stitch",
    "text": "57 + 26",
    "correct_answer": "83",
    "distractors": { "L1": "73", "L2": "82", "L3": "87" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q22",
    "stitch_id": "warm-up-stitch",
    "text": "85 - 42",
    "correct_answer": "43",
    "distractors": { "L1": "37", "L2": "44", "L3": "47" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q23",
    "stitch_id": "warm-up-stitch",
    "text": "9 × 8",
    "correct_answer": "72",
    "distractors": { "L1": "63", "L2": "64", "L3": "81" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q24",
    "stitch_id": "warm-up-stitch",
    "text": "100 ÷ 20",
    "correct_answer": "5",
    "distractors": { "L1": "4", "L2": "10", "L3": "20" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q25",
    "stitch_id": "warm-up-stitch",
    "text": "32 + 59",
    "correct_answer": "91",
    "distractors": { "L1": "81", "L2": "89", "L3": "92" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q26",
    "stitch_id": "warm-up-stitch",
    "text": "75 - 36",
    "correct_answer": "39",
    "distractors": { "L1": "38", "L2": "41", "L3": "49" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q27",
    "stitch_id": "warm-up-stitch",
    "text": "6 × 6",
    "correct_answer": "36",
    "distractors": { "L1": "30", "L2": "42", "L3": "46" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q28",
    "stitch_id": "warm-up-stitch",
    "text": "81 ÷ 9",
    "correct_answer": "9",
    "distractors": { "L1": "8", "L2": "10", "L3": "11" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q29",
    "stitch_id": "warm-up-stitch",
    "text": "26 + 39",
    "correct_answer": "65",
    "distractors": { "L1": "55", "L2": "64", "L3": "75" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q30",
    "stitch_id": "warm-up-stitch",
    "text": "94 - 67",
    "correct_answer": "27",
    "distractors": { "L1": "23", "L2": "26", "L3": "33" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q31",
    "stitch_id": "warm-up-stitch",
    "text": "4 × 15",
    "correct_answer": "60",
    "distractors": { "L1": "45", "L2": "55", "L3": "75" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q32",
    "stitch_id": "warm-up-stitch",
    "text": "60 ÷ 12",
    "correct_answer": "5",
    "distractors": { "L1": "4", "L2": "6", "L3": "48" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q33",
    "stitch_id": "warm-up-stitch",
    "text": "48 + 35",
    "correct_answer": "83",
    "distractors": { "L1": "73", "L2": "82", "L3": "87" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q34",
    "stitch_id": "warm-up-stitch",
    "text": "67 - 29",
    "correct_answer": "38",
    "distractors": { "L1": "36", "L2": "37", "L3": "48" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q35",
    "stitch_id": "warm-up-stitch",
    "text": "8 × 9",
    "correct_answer": "72",
    "distractors": { "L1": "63", "L2": "71", "L3": "81" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q36",
    "stitch_id": "warm-up-stitch",
    "text": "96 ÷ 8",
    "correct_answer": "12",
    "distractors": { "L1": "10", "L2": "11", "L3": "14" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q37",
    "stitch_id": "warm-up-stitch",
    "text": "125 + 75",
    "correct_answer": "200",
    "distractors": { "L1": "190", "L2": "195", "L3": "210" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q38",
    "stitch_id": "warm-up-stitch",
    "text": "150 - 75",
    "correct_answer": "75",
    "distractors": { "L1": "65", "L2": "70", "L3": "85" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q39",
    "stitch_id": "warm-up-stitch",
    "text": "11 × 4",
    "correct_answer": "44",
    "distractors": { "L1": "40", "L2": "42", "L3": "48" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q40",
    "stitch_id": "warm-up-stitch",
    "text": "90 ÷ 6",
    "correct_answer": "15",
    "distractors": { "L1": "14", "L2": "16", "L3": "84" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q41",
    "stitch_id": "warm-up-stitch",
    "text": "33 + 48",
    "correct_answer": "81",
    "distractors": { "L1": "71", "L2": "79", "L3": "91" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q42",
    "stitch_id": "warm-up-stitch",
    "text": "82 - 35",
    "correct_answer": "47",
    "distractors": { "L1": "43", "L2": "46", "L3": "57" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q43",
    "stitch_id": "warm-up-stitch",
    "text": "7 × 8",
    "correct_answer": "56",
    "distractors": { "L1": "48", "L2": "54", "L3": "64" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q44",
    "stitch_id": "warm-up-stitch",
    "text": "54 ÷ 6",
    "correct_answer": "9",
    "distractors": { "L1": "8", "L2": "10", "L3": "48" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q45",
    "stitch_id": "warm-up-stitch",
    "text": "75 + 48",
    "correct_answer": "123",
    "distractors": { "L1": "113", "L2": "122", "L3": "133" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q46",
    "stitch_id": "warm-up-stitch",
    "text": "120 - 45",
    "correct_answer": "75",
    "distractors": { "L1": "65", "L2": "70", "L3": "85" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q47",
    "stitch_id": "warm-up-stitch",
    "text": "9 × 9",
    "correct_answer": "81",
    "distractors": { "L1": "72", "L2": "79", "L3": "90" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q48",
    "stitch_id": "warm-up-stitch",
    "text": "72 ÷ 8",
    "correct_answer": "9",
    "distractors": { "L1": "7", "L2": "8", "L3": "10" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q49",
    "stitch_id": "warm-up-stitch",
    "text": "45 + 67",
    "correct_answer": "112",
    "distractors": { "L1": "102", "L2": "111", "L3": "122" },
    "created_at": "",
    "updated_at": ""
  },
  {
    "id": "warm-up-q50",
    "stitch_id": "warm-up-stitch",
    "text": "89 - 24",
    "correct_answer": "65",
    "distractors": { "L1": "55", "L2": "63", "L3": "75" },
    "created_at": "",
    "updated_at": ""
  }
];

// Log the number of warm-up questions available
console.log(`Using ${warmUpQuestionsRaw.length} embedded warm-up questions`);

// Type for raw questions from the database (using snake_case)
interface RawQuestion {
  id: string;
  stitch_id: string;
  text: string;
  correct_answer: string;
  distractors: {
    L1: string;
    L2: string;
    L3: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Normalize question format from database snake_case to camelCase
 * @param dbQuestion Question in database format
 * @returns Question in the format expected by MinimalDistinctionPlayer
 */
export function normalizeQuestionFormat(dbQuestion: RawQuestion): Question {
  return {
    id: dbQuestion.id,
    text: dbQuestion.text,
    correctAnswer: dbQuestion.correct_answer, // Convert from snake_case to camelCase
    distractors: dbQuestion.distractors,
    // Add any other needed fields to match Question interface
  };
}

/**
 * Get all warm-up questions, normalized to the correct format
 * @returns Array of all warm-up questions
 */
export function getAllWarmUpQuestions(): Question[] {
  try {
    if (!Array.isArray(warmUpQuestionsRaw)) {
      console.error('Warm-up questions is not an array:', warmUpQuestionsRaw);
      return sampleWarmUpQuestions;
    }
    
    if (warmUpQuestionsRaw.length === 0) {
      console.error('Warm-up questions array is empty');
      return sampleWarmUpQuestions;
    }
    
    const normalizedQuestions = (warmUpQuestionsRaw as RawQuestion[]).map(normalizeQuestionFormat);
    console.log(`Normalized ${normalizedQuestions.length} warm-up questions`);
    
    // Validate the normalized questions
    if (!validateQuestions(normalizedQuestions)) {
      console.error('Some warm-up questions failed validation');
      return sampleWarmUpQuestions;
    }
    
    return normalizedQuestions;
  } catch (error) {
    console.error('Error processing warm-up questions:', error);
    // Fall back to sample questions
    return sampleWarmUpQuestions;
  }
}

/**
 * Get a random subset of warm-up questions
 * @param count Number of questions to return (default: 10)
 * @param easyOnly Whether to only include easier questions (default: true)
 * @returns Array of randomly selected questions
 */
export function getRandomWarmUpQuestions(count: number = 10, easyOnly: boolean = true): Question[] {
  console.log(`getRandomWarmUpQuestions: Requesting ${count} random warm-up questions (easyOnly: ${easyOnly})`);
  
  const allQuestions = getAllWarmUpQuestions();
  console.log(`getRandomWarmUpQuestions: Got ${allQuestions.length} total questions from getAllWarmUpQuestions`);
  
  // For warm-up, prefer questions with simpler distractors
  let questionPool = allQuestions;
  
  // Prioritize easier questions (the first half of our questions are generally easier)
  if (easyOnly) {
    // Take all questions but make sure easy questions are more common
    const easyQuestions = allQuestions.slice(0, Math.ceil(allQuestions.length / 2));
    const otherQuestions = allQuestions.slice(Math.ceil(allQuestions.length / 2));
    
    // 80% of questions should be easy, 20% can be harder
    const easyCount = Math.floor(count * 0.8);
    const otherCount = count - easyCount;
    
    // Shuffle both pools
    const shuffledEasy = [...easyQuestions].sort(() => 0.5 - Math.random());
    const shuffledOther = [...otherQuestions].sort(() => 0.5 - Math.random());
    
    // Take the required number from each pool
    const selectedEasy = shuffledEasy.slice(0, Math.min(easyCount, shuffledEasy.length));
    const selectedOther = shuffledOther.slice(0, Math.min(otherCount, shuffledOther.length));
    
    // Combine and shuffle again for final mix
    questionPool = [...selectedEasy, ...selectedOther].sort(() => 0.5 - Math.random());
    
    console.log(`getRandomWarmUpQuestions: Selected ${selectedEasy.length} easy questions and ${selectedOther.length} other questions`);
  } else {
    // Just shuffle all questions
    questionPool = [...allQuestions].sort(() => 0.5 - Math.random());
  }
  
  // If we don't have enough questions, return all we have
  if (questionPool.length <= count) {
    console.log(`getRandomWarmUpQuestions: Returning all ${questionPool.length} available questions (fewer than requested ${count})`);
    return questionPool;
  }
  
  // Take the first 'count' questions from our pool
  console.log(`getRandomWarmUpQuestions: Returning ${count} randomly selected questions from pool of ${questionPool.length}`);
  
  // Log first question for debugging
  if (questionPool.length > 0) {
    console.log('First question in selection:', {
      id: questionPool[0].id,
      text: questionPool[0].text,
      correctAnswer: questionPool[0].correctAnswer
    });
  }
  
  return questionPool.slice(0, count);
}

/**
 * Create a synthetic stitch with warm-up questions
 * @param count Number of questions to include (default: 10)
 * @returns A stitch-like object with warm-up questions
 */
export function createWarmUpStitch(count: number = 10) {
  const questions = getRandomWarmUpQuestions(count);
  console.log(`createWarmUpStitch: Created warm-up stitch with ${questions.length} questions`);
  
  return {
    id: 'warm-up-stitch',
    questions,
    position: 0, // Default position
    skipNumber: 3, // Default skip number
    distractorLevel: 'L1' // Default distractor level
  };
}

/**
 * Create a complete warm-up tube structure ready for the player
 * @param count Number of questions to include (default: 10)
 * @returns A complete tube data structure with embedded questions
 */
export function createWarmUpTube(count: number = 10) {
  console.log(`createWarmUpTube: Creating complete warm-up tube with ${count} questions`);
  const questions = getRandomWarmUpQuestions(count);
  
  // Create a complete self-contained tube structure that doesn't depend on Zustand
  return {
    1: { // Tube number 1 
      currentStitchId: 'warm-up-stitch',
      positions: {
        0: { // Position 0
          stitchId: 'warm-up-stitch',
          skipNumber: 3,
          distractorLevel: 'L1'
        }
      },
      // Add questions directly to the stitch
      stitches: [
        {
          id: 'warm-up-stitch',
          position: 0,
          skipNumber: 3,
          distractorLevel: 'L1',
          questions: questions // Directly embed the questions
        }
      ]
    }
  };
}

/**
 * Check if all questions have required properties
 * @param questions Array of questions to validate
 * @returns Boolean indicating if all questions are valid
 */
export function validateQuestions(questions: Question[]): boolean {
  return questions.every(q => 
    q.id && 
    q.text && 
    q.correctAnswer && 
    q.distractors &&
    q.distractors.L1 && 
    q.distractors.L2 && 
    q.distractors.L3
  );
}

// Export an array of sample warm-up questions as a fallback
export const sampleWarmUpQuestions: Question[] = [
  {
    id: 'warm-up-sample-1',
    text: '3 + 5 =',
    correctAnswer: '8',
    distractors: { L1: '7', L2: '9', L3: '6' }
  },
  {
    id: 'warm-up-sample-2',
    text: '7 - 2 =',
    correctAnswer: '5',
    distractors: { L1: '4', L2: '6', L3: '3' }
  },
  {
    id: 'warm-up-sample-3',
    text: '4 × 3 =',
    correctAnswer: '12',
    distractors: { L1: '7', L2: '10', L3: '9' }
  },
  {
    id: 'warm-up-sample-4',
    text: '10 ÷ 2 =',
    correctAnswer: '5',
    distractors: { L1: '4', L2: '6', L3: '2' }
  },
  {
    id: 'warm-up-sample-5',
    text: '9 + 7 =',
    correctAnswer: '16',
    distractors: { L1: '15', L2: '17', L3: '6' }
  }
];