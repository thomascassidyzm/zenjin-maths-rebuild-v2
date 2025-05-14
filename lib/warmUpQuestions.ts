/**
 * Warm-up Questions Module
 * 
 * This module handles the loading, normalization, and selection of warm-up
 * questions that are shown to users while the main content loads.
 */

import warmUpQuestionsRaw from '../Warm-up Questions.json';
import { Question } from './types/distinction-learning';

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
  return (warmUpQuestionsRaw as RawQuestion[]).map(normalizeQuestionFormat);
}

/**
 * Get a random subset of warm-up questions
 * @param count Number of questions to return (default: 10)
 * @returns Array of randomly selected questions
 */
export function getRandomWarmUpQuestions(count: number = 10): Question[] {
  const allQuestions = getAllWarmUpQuestions();
  
  // If we don't have enough questions, return all we have
  if (allQuestions.length <= count) {
    return allQuestions;
  }
  
  // Shuffle and take the first 'count' questions
  const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Create a synthetic stitch with warm-up questions
 * @param count Number of questions to include (default: 10)
 * @returns A stitch-like object with warm-up questions
 */
export function createWarmUpStitch(count: number = 10) {
  const questions = getRandomWarmUpQuestions(count);
  
  return {
    id: 'warm-up-stitch',
    questions,
    position: 0, // Default position
    skipNumber: 3, // Default skip number
    distractorLevel: 'L1' // Default distractor level
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