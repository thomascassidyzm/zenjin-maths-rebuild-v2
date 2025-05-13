import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Thread, Question } from '../lib/types/distinction-learning';
import { calculateBonuses, calculateTotalPoints, calculateBasePoints } from '../lib/bonusCalculator';
import { useStitchContent } from '../lib/hooks/useStitchContent';
import { useZenjinStore } from '../lib/store/zenjinStore';

interface MinimalDistinctionPlayerProps {
  thread?: Thread;
  tubeNumber?: number;
  tubeData?: any; // Contains tube data with positions or stitches
  onComplete: (results: any) => void;
  onEndSession?: (results: any) => void; // Optional callback for when user manually ends session
  questionsPerSession?: number;
  sessionTotalPoints?: number; // Optional total points accumulated across the session
  userId?: string; // User ID for API authentication
}

// Helper function to shuffle an array
const shuffleArray = (array: any[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const MinimalDistinctionPlayer: React.FC<MinimalDistinctionPlayerProps> = ({
  thread: threadProp,
  tubeNumber,
  tubeData,
  onComplete,
  onEndSession,
  questionsPerSession = 10,
  sessionTotalPoints = 0,
  userId,
}) => {
  // Derive thread from tubeData if thread is not provided
  const [derivedThread, setDerivedThread] = useState<Thread | null>(null);
  const thread = threadProp || derivedThread;

  // Create thread from tubeData if no thread prop is provided
  useEffect(() => {
    if (!threadProp && tubeData && tubeNumber) {
      console.log(`Deriving thread from tubeData for tube ${tubeNumber}`);

      const activeTube = tubeData[tubeNumber];
      if (!activeTube) {
        console.error(`No tube data found for tube ${tubeNumber}`);
        return;
      }

      // ENHANCEMENT: Support both position-based and legacy stitches array-based formats

      // Check if we have position-based tube data (new format)
      if (activeTube.positions && Object.keys(activeTube.positions).length > 0) {
        console.log(`Tube ${tubeNumber} has ${Object.keys(activeTube.positions).length} stitches in position-based format`);

        // Convert positions to stitches array for compatibility
        const positionStitches = Object.entries(activeTube.positions).map(([position, tubePosition]) => ({
          id: tubePosition.stitchId,
          position: parseInt(position),
          skipNumber: tubePosition.skipNumber || 3,
          distractorLevel: tubePosition.distractorLevel || 'L1'
        }));

        // Sort by position
        const sortedStitches = positionStitches.sort((a, b) => a.position - b.position);

        // Check if these stitch IDs are already in the Zustand store
        const contentCollection = useZenjinStore.getState().contentCollection;
        const foundInStore = sortedStitches.filter(s =>
          contentCollection?.stitches?.[s.id]
        );
        console.log(`Found ${foundInStore.length} of ${sortedStitches.length} stitches in Zustand store`);

        // Create thread from tube data
        const thread: Thread = {
          id: activeTube.threadId || `thread-T${tubeNumber}-001`,
          name: `Tube ${tubeNumber}`,
          description: `Learning content for Tube ${tubeNumber}`,
          stitches: sortedStitches.map(stitch => ({
            id: stitch.id,
            name: stitch.id.split('-').pop() || 'Stitch',
            description: `Stitch ${stitch.id}`,
            questions: [] // Questions will be loaded from the Zustand store
          }))
        };

        setDerivedThread(thread);
        return;
      }

      // Legacy format support (stitches array)
      if (activeTube.stitches && activeTube.stitches.length > 0) {
        console.log(`Tube ${tubeNumber} has ${activeTube.stitches.length} stitches in legacy format:`,
          activeTube.stitches.map(s => s.id).join(', '));

        // Check if these stitch IDs are already in the Zustand store
        const contentCollection = useZenjinStore.getState().contentCollection;
        const foundInStore = activeTube.stitches.filter(s => contentCollection?.stitches?.[s.id]);
        console.log(`Found ${foundInStore.length} of ${activeTube.stitches.length} stitches in Zustand store`);

        // Create thread from tube data
        const thread: Thread = {
          id: activeTube.threadId || `thread-T${tubeNumber}-001`,
          name: `Tube ${tubeNumber}`,
          description: `Learning content for Tube ${tubeNumber}`,
          stitches: (activeTube.stitches || []).map(stitch => ({
            id: stitch.id,
            name: stitch.id.split('-').pop() || 'Stitch',
            description: `Stitch ${stitch.id}`,
            questions: [] // Questions will be loaded from the Zustand store
          }))
        };

        setDerivedThread(thread);
        return;
      }

      console.error(`Tube ${tubeNumber} has no stitches (neither positions nor stitches array found)`);
    }
  }, [threadProp, tubeData, tubeNumber]);
  // Initialize Next.js router for client-side navigation
  const router = useRouter();

  // Create explicit fallbacks for all session context functions we might need
  const dummySessionState = { questionResults: [], points: 0 };
  const startSession = (params: any) => console.log('Session context not available - startSession', params);
  const recordQuestionResult = (result: any) => console.log('Session context not available - recordQuestionResult', result);
  const addPoints = (points: number) => console.log('Session context not available - addPoints', points);
  const contextEndSession = async () => ({ success: false, error: 'Session context not available' });
  const contextCompleteSession = async () => ({ success: false, error: 'Session context not available' });
  
  // State for tracking questions and session
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [timeToAnswer, setTimeToAnswer] = useState(0);
  const [sessionResults, setSessionResults] = useState<Array<{
    id: string;
    correct: boolean;
    timeToAnswer: number;
    firstTimeCorrect: boolean;
  }>>([]);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [points, setPoints] = useState(0);
  const [showCorrectEquation, setShowCorrectEquation] = useState(false);
  const [isReplayQuestion, setIsReplayQuestion] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [timerAnimation, setTimerAnimation] = useState<Animation | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTimingOut, setIsTimingOut] = useState(false); // Track if we're currently in timeout process
  const [questionRepeatCount, setQuestionRepeatCount] = useState(0); // Track how many times a question has been repeated

  // Animation states
  const [isButtonShaking, setIsButtonShaking] = useState(false);
  const [buttonToShake, setButtonToShake] = useState<string | null>(null);
  
  // Refs
  const timerRef = useRef<HTMLDivElement>(null);
  const questionCardRef = useRef<HTMLDivElement>(null);
  const timerTimeoutRef = useRef<NodeJS.Timeout | null>(null); // To track timeout for manual timer
  const currentQuestionRef = useRef<Question | null>(null); // To keep a stable reference to current question
  
  // Update ref when currentQuestion changes
  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);
  
  // Check orientation
  useEffect(() => {
    const checkOrientation = () => {
      setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
    };
  }, []);

  // Keep track of which stitches we've already initialized for each thread
  const initializedStitchRef = useRef({});
  const previousThreadRef = useRef(null);
  
  // Initialize questions for the session
  useEffect(() => {
    console.log('🔍 PLAYER DEBUG: Checking thread data', {
      threadId: thread?.id,
      hasThread: !!thread,
      hasStitches: !!(thread?.stitches?.length > 0),
      stitchCount: thread?.stitches?.length || 0
    });

    // Guard clause - don't proceed if we don't have proper thread data
    if (!thread) {
      console.warn('No thread data available for MinimalDistinctionPlayer');
      return;
    }

    // Guard clause for stitches array
    if (!thread.stitches || thread.stitches.length === 0) {
      console.warn(`Thread ${thread.id} has no stitches`);
      return;
    }

    // Log the first few stitch IDs for debugging
    if (thread.stitches.length > 0) {
      const stitchIds = thread.stitches.slice(0, 5).map(s => s.id);
      console.log(`🧵 Thread ${thread.id} has stitches:`, stitchIds.join(', '));
    }

    // Now we know we have thread and stitches
    const stitch = thread.stitches[0]; // Use first stitch for now
    const threadId = thread.id;

    // Check if we're switching to a different thread (tube)
    const isNewThread = previousThreadRef.current !== threadId;

    // Track if this specific thread+stitch combination has been initialized
    const threadStitchKey = `${threadId}:${stitch.id}`;
    const alreadyInitialized = initializedStitchRef.current[threadStitchKey];

    // Update the previous thread ref for next time
    previousThreadRef.current = threadId;

    // Allow re-initialization when switching threads/tubes, or for first initialization
    if (alreadyInitialized && !isNewThread) {
      console.log(`Skipping re-initialization for stitch ${stitch.id} in thread ${threadId} - already initialized and not a thread change`);
      return;
    }

    // Mark this thread-stitch combination as initialized
    initializedStitchRef.current[threadStitchKey] = true;

    console.log(`Initializing with thread ${threadId}, stitch ${stitch.id}${isNewThread ? ' (NEW THREAD)' : ' (SAME THREAD)'}`);

    // Skip initializing session in context as it's not available

    // Reset state for the new thread/stitch - but keep points and session results accumulated from previous stitches
    setCurrentQuestionIndex(0);
    // Don't reset sessionResults to [] here to maintain questions history across stitches
    // Don't reset points to 0 here to maintain accumulated points across stitches
    setIsSessionComplete(false);

    // Stop any running animations/timers
    if (timerAnimation) {
      timerAnimation.cancel();
    }
    if (timerTimeoutRef.current) {
      clearTimeout(timerTimeoutRef.current);
      timerTimeoutRef.current = null;
    }

    // Always ensure the stitch has a questions array
    if (!stitch.questions) {
      stitch.questions = [];
    }
      
    // Enhanced debug logging for stitch content
    console.log(`Initializing stitch ${stitch.id} in thread ${threadId}`, {
      hasInitialQuestions: stitch.questions && stitch.questions.length > 0,
      initialQuestionCount: stitch.questions ? stitch.questions.length : 0
    });

    // Log cached content in Zustand store for debugging
    const contentCollection = useZenjinStore.getState().contentCollection;
    const cachedStitchCount = contentCollection?.stitches
      ? Object.keys(contentCollection.stitches).length
      : 0;
    console.log(`Available cached stitches in Zustand store: ${cachedStitchCount}`);
    if (cachedStitchCount > 0) {
      console.log(`Cached stitch keys (first 5): ${Object.keys(contentCollection.stitches).slice(0, 5).join(', ')}`);
    }

    // Detailed analysis of stitch ID format to help with matching
    const stitchFormatMatch = stitch.id.match(/stitch-T(\d+)-(\d+)-(\d+)/);
    if (stitchFormatMatch) {
      const [_, tubeNum, threadNum, posNum] = stitchFormatMatch;
      console.log(`DEBUG: Stitch ID format analysis - Tube: ${tubeNum}, Thread: ${threadNum}, Position: ${posNum}`);

      // Check if any stitches with similar patterns exist in the Zustand store
      const contentCollection = useZenjinStore.getState().contentCollection;
      const stitchKeys = contentCollection?.stitches ? Object.keys(contentCollection.stitches) : [];
      const similarPatternKeys = stitchKeys.filter(key =>
        key.startsWith(`stitch-T${tubeNum}-`) || key.includes(`-${threadNum}-`)
      ).slice(0, 5);

      if (similarPatternKeys.length > 0) {
        console.log(`DEBUG: Similar pattern stitches found in store: ${similarPatternKeys.join(', ')}`);
      } else {
        console.log(`DEBUG: No similar pattern stitches found in store for T${tubeNum}-${threadNum}`);
      }
    }

    // Simple debug logging to help understand issues
    console.log(`DEBUG: Fetching stitch ${stitch.id} from Zustand store`);

    // Get the fetchStitch function from Zustand store
    const fetchStitch = useZenjinStore.getState().fetchStitch;

    // Check if the stitch already has questions
    if (stitch.questions && stitch.questions.length > 0) {
      console.log(`DEBUG: Stitch ${stitch.id} already has ${stitch.questions.length} questions`);
    } else {
      try {
        // Fetch the stitch from the Zustand store
        fetchStitch(stitch.id).then(storeStitch => {
          if (storeStitch && storeStitch.questions && storeStitch.questions.length > 0) {
            console.log(`SUCCESS: Fetched ${storeStitch.questions.length} questions for stitch ${stitch.id} from Zustand store`);
            stitch.questions = [...storeStitch.questions];

            // If we're initializing a session, load the first question
            if (sessionQs && sessionQs.length === 0 && stitch.questions.length > 0) {
              const allQuestions = [...stitch.questions];
              const sessionQuestions = allQuestions.slice(0, Math.min(questionsPerSession, allQuestions.length));
              setSessionQuestions(sessionQuestions);

              // Start with the first question
              if (sessionQuestions.length > 0) {
                setIsInitialized(true);
                loadQuestion(sessionQuestions[0], false);
              }
            }
          } else {
            console.warn(`ERROR: Failed to fetch valid questions for stitch ${stitch.id} from Zustand store`);
            useFallbackQuestions();
          }
        }).catch(error => {
          console.error(`ERROR: Failed to fetch stitch ${stitch.id} from Zustand store:`, error);
          useFallbackQuestions();
        });
      } catch (error) {
        console.error(`ERROR: Exception while fetching stitch ${stitch.id}:`, error);
        useFallbackQuestions();
      }
    }

    // Helper function to use fallback questions when needed
    function useFallbackQuestions() {
      // Check if the questions array has valid questions
      // NOTE: This is a safety measure - the questions should already be properly formatted
      const validQuestions = stitch.questions.filter(q => (
        q.text && q.correctAnswer && q.distractors &&
        q.distractors.L1 && q.distractors.L2 && q.distractors.L3
      ));

      if (validQuestions.length === 0) {
        console.error(`No valid questions found for stitch ${stitch.id} in thread ${thread.id}`);

        // For anonymous users, always provide sample math questions
        // This ensures consistent experience for all user types
        const isAnonymousUser = !userId || userId.startsWith('anon-');

        if (isAnonymousUser) {
          // Use basic math questions for anonymous users to ensure they have a good experience
          let sampleQuestions = [];

          // Try to determine tube type from stitch ID to provide appropriate questions
          const tubeMatch = stitch.id.match(/stitch-T(\d+)-/i);
          const tubeNumber = tubeMatch ? parseInt(tubeMatch[1]) : 1;

          if (tubeNumber === 1) {
            // Tube 1: Number Facts - counting, comparison, sequences
            sampleQuestions = [
              {
                id: `${stitch.id}-sample-1`,
                text: 'What number comes after 5?',
                correctAnswer: '6',
                distractors: { L1: '7', L2: '4', L3: '5' }
              },
              {
                id: `${stitch.id}-sample-2`,
                text: 'Which is greater: 8 or 4?',
                correctAnswer: '8',
                distractors: { L1: '4', L2: 'They are equal', L3: 'Cannot compare' }
              },
              {
                id: `${stitch.id}-sample-3`,
                text: 'What comes next: 2, 4, 6, ?',
                correctAnswer: '8',
                distractors: { L1: '7', L2: '10', L3: '9' }
              },
              {
                id: `${stitch.id}-sample-4`,
                text: 'Count to 10. What number comes after 7?',
                correctAnswer: '8',
                distractors: { L1: '6', L2: '9', L3: '7' }
              },
              {
                id: `${stitch.id}-sample-5`,
                text: 'What is the smallest number: 3, 7, or 2?',
                correctAnswer: '2',
                distractors: { L1: '3', L2: '7', L3: '10' }
              }
            ];
          } else if (tubeNumber === 2) {
            // Tube 2: Basic Operations - addition, subtraction
            sampleQuestions = [
              {
                id: `${stitch.id}-sample-1`,
                text: '3 + 5',
                correctAnswer: '8',
                distractors: { L1: '7', L2: '9', L3: '6' }
              },
              {
                id: `${stitch.id}-sample-2`,
                text: '7 - 2',
                correctAnswer: '5',
                distractors: { L1: '4', L2: '6', L3: '3' }
              },
              {
                id: `${stitch.id}-sample-3`,
                text: '4 + 6',
                correctAnswer: '10',
                distractors: { L1: '8', L2: '12', L3: '9' }
              },
              {
                id: `${stitch.id}-sample-4`,
                text: '10 - 5',
                correctAnswer: '5',
                distractors: { L1: '4', L2: '6', L3: '15' }
              },
              {
                id: `${stitch.id}-sample-5`,
                text: '9 + 7',
                correctAnswer: '16',
                distractors: { L1: '15', L2: '17', L3: '14' }
              }
            ];
          } else if (tubeNumber === 3) {
            // Tube 3: Problem Solving - word problems
            sampleQuestions = [
              {
                id: `${stitch.id}-sample-1`,
                text: 'Sarah has 5 apples. Tom gives her 3 more. How many apples does Sarah have now?',
                correctAnswer: '8',
                distractors: { L1: '7', L2: '2', L3: '15' }
              },
              {
                id: `${stitch.id}-sample-2`,
                text: 'Jack has 10 stickers. He gives 4 to his friend. How many stickers does Jack have left?',
                correctAnswer: '6',
                distractors: { L1: '14', L2: '4', L3: '5' }
              },
              {
                id: `${stitch.id}-sample-3`,
                text: 'There are 8 birds on a tree. 3 more birds join them. How many birds are there now?',
                correctAnswer: '11',
                distractors: { L1: '10', L2: '12', L3: '5' }
              },
              {
                id: `${stitch.id}-sample-4`,
                text: 'Emma has 9 sweets. She eats 4 sweets. How many sweets does she have left?',
                correctAnswer: '5',
                distractors: { L1: '13', L2: '4', L3: '6' }
              },
              {
                id: `${stitch.id}-sample-5`,
                text: 'There are 7 children on the bus. At the stop, 3 more children get on. How many children are on the bus now?',
                correctAnswer: '10',
                distractors: { L1: '4', L2: '9', L3: '11' }
              }
            ];
          } else {
            // Default mixed questions
            sampleQuestions = [
              {
                id: `${stitch.id}-sample-1`,
                text: '3 + 5',
                correctAnswer: '8',
                distractors: { L1: '7', L2: '9', L3: '6' }
              },
              {
                id: `${stitch.id}-sample-2`,
                text: '7 - 2',
                correctAnswer: '5',
                distractors: { L1: '4', L2: '6', L3: '3' }
              },
              {
                id: `${stitch.id}-sample-3`,
                text: '4 × 3',
                correctAnswer: '12',
                distractors: { L1: '6', L2: '10', L3: '9' }
              },
              {
                id: `${stitch.id}-sample-4`,
                text: '10 ÷ 2',
                correctAnswer: '5',
                distractors: { L1: '4', L2: '6', L3: '2' }
              },
              {
                id: `${stitch.id}-sample-5`,
                text: '9 + 7',
                correctAnswer: '16',
                distractors: { L1: '15', L2: '17', L3: '6' }
              }
            ];
          }

          // Set the sample questions on the stitch
          stitch.questions = sampleQuestions;
          console.log(`Using ${sampleQuestions.length} tube-specific sample questions for user (stitch ${stitch.id})`);
        } else {
          // For authenticated users, show the error message
          const errorQuestions = [
            {
              id: `${stitch.id}-error-1`,
              text: 'Content missing. Please contact support.',
              correctAnswer: 'Contact support',
              distractors: {
                L1: 'Try again later',
                L2: 'Refresh page',
                L3: 'Check settings'
              }
            }
          ];

          // Set the error questions on the stitch
          stitch.questions = errorQuestions;
          console.log(`Using error placeholder question for stitch ${stitch.id}`);
        }
      } else {
        console.log(`Using ${validQuestions.length} valid existing questions from database for stitch ${stitch.id}`);
        stitch.questions = validQuestions;
      }
    }

    // Clone the questions array to avoid mutation issues
    let allQuestions = [...stitch.questions];

    // Double-check we have questions
    if (allQuestions.length === 0) {
      console.warn("Still no questions available after attempted initialization");

      // Generate absolute fallback questions as a last resort
      // This ensures we ALWAYS have some questions to show
      // Generate questions based on tube number for a consistent user experience
      const isAnonymousUser = !userId || userId.startsWith('anon-');
      const tubeMatch = stitch.id.match(/stitch-T(\d+)-/i);
      const tubeNumber = tubeMatch ? parseInt(tubeMatch[1]) : 1;

      // Last resort emergency questions based on tube type
      if (isAnonymousUser) {
        console.log(`EMERGENCY FALLBACK: Generating last-resort questions for anonymous user`);

        // Generate emergency questions based on tube
        let emergencyQuestions = [];

        if (tubeNumber === 1) {
          // Tube 1: Number Facts - counting, comparison, sequences
          emergencyQuestions = [
            {
              id: `${stitch.id}-emergency-1`,
              text: 'What number comes after 3?',
              correctAnswer: '4',
              distractors: { L1: '5', L2: '2', L3: '3' }
            },
            {
              id: `${stitch.id}-emergency-2`,
              text: 'Which is the largest: 2, 5, or 3?',
              correctAnswer: '5',
              distractors: { L1: '2', L2: '3', L3: '0' }
            }
          ];
        } else if (tubeNumber === 2) {
          // Tube 2: Basic Operations
          emergencyQuestions = [
            {
              id: `${stitch.id}-emergency-1`,
              text: '2 + 2',
              correctAnswer: '4',
              distractors: { L1: '3', L2: '5', L3: '2' }
            },
            {
              id: `${stitch.id}-emergency-2`,
              text: '5 - 2',
              correctAnswer: '3',
              distractors: { L1: '2', L2: '4', L3: '7' }
            }
          ];
        } else {
          // Tube 3 or default
          emergencyQuestions = [
            {
              id: `${stitch.id}-emergency-1`,
              text: 'I have 3 apples and get 2 more. How many do I have?',
              correctAnswer: '5',
              distractors: { L1: '4', L2: '6', L3: '1' }
            },
            {
              id: `${stitch.id}-emergency-2`,
              text: 'There are 4 birds on a tree. 1 flies away. How many are left?',
              correctAnswer: '3',
              distractors: { L1: '2', L2: '4', L3: '5' }
            }
          ];
        }

        // Set emergency questions and continue
        allQuestions = emergencyQuestions;
        stitch.questions = emergencyQuestions;
        console.log(`Using ${emergencyQuestions.length} emergency questions for anonymous user`);
      } else {
        // For authenticated users, show a simple error without stopping the session
        const errorQuestion = {
          id: `${stitch.id}-critical-error`,
          text: 'Content unavailable. Please try again.',
          correctAnswer: 'Continue',
          distractors: { L1: 'Refresh', L2: 'Try again', L3: 'Help' }
        };

        allQuestions = [errorQuestion];
        stitch.questions = [errorQuestion];
        console.log(`Using error question for authenticated user as last resort`);
      }

      // Additional debug info to identify the issue
      console.error(`CRITICAL ERROR: No questions initially found for stitch ${stitch.id}`);
      const contentCollection = useZenjinStore.getState().contentCollection;
      console.error(`- Stitch exists in Zustand store: ${!!(contentCollection?.stitches?.[stitch.id])}`);
      if (contentCollection?.stitches?.[stitch.id]) {
        console.error(`- Cached stitch has questions: ${!!(contentCollection.stitches[stitch.id].questions)}`);
        console.error(`- Cached stitch question count: ${contentCollection.stitches[stitch.id].questions?.length || 0}`);
      }

      // Instead of exiting early with no content, we continue with our emergency questions
      // This ensures users always see something instead of the "no questions" error
      console.log(`Continuing with fallback questions after critical error`);
    }

    // Shuffle all questions using URN randomness
    allQuestions = shuffleArray(allQuestions);

    // Take only the number we need for this session
    const sessionQs = allQuestions.slice(0, Math.min(questionsPerSession, allQuestions.length));
    console.log(`Using ${sessionQs.length} questions for session`);
    setSessionQuestions(sessionQs);

    // Start with the first question if we have any
    if (sessionQs.length > 0) {
      setIsInitialized(true);
      loadQuestion(sessionQs[0], false);
    } else {
      console.error("No questions available for this session!");
    }
  }, [thread, questionsPerSession, userId, sessionTotalPoints]);

  // Track if timer initialization has been done for the current question
  const timerInitializedRef = useRef(false);
  
  // Ensure timer starts after component mounts and questions are loaded with a longer delay
  useEffect(() => {
    // Only start timer when both are true and we're not timing out
    // And only if we haven't already initialized a timer for this question
    if (isInitialized && currentQuestion && !isTimingOut && !timerInitializedRef.current) {
      // Mark that we've initialized a timer for this question
      timerInitializedRef.current = true;
      
      const timeoutId = setTimeout(() => {
        startTimer();
      }, 500); // Shorter delay to prevent answers appearing before question is visible
      
      return () => clearTimeout(timeoutId);
    }
  }, [isInitialized, currentQuestion, isTimingOut]);
  
  // Cleanup timers when component unmounts
  useEffect(() => {
    return () => {
      if (timerTimeoutRef.current) {
        clearTimeout(timerTimeoutRef.current);
      }
      if (timerAnimation) {
        timerAnimation.cancel();
      }
    };
  }, [timerAnimation]);

  // Load a question and setup options with smoother transitions
  const loadQuestion = useCallback((question: Question, isReplay: boolean) => {
    // Reset timer initialization flag - now we need a new timer for the new question
    timerInitializedRef.current = false;
    
    // First step: Set the question but keep old options visible
    // This creates a smoother transition where the question changes but options persist briefly
    setCurrentQuestion(question);
    setIsReplayQuestion(isReplay);
    setShowCorrectEquation(false);
    setIsTimingOut(false);
    
    // Update repeat count for question
    if (isReplay) {
      setQuestionRepeatCount(prev => prev + 1);
    } else {
      setQuestionRepeatCount(0);
    }
    
    // Second step: After a very brief delay, reset selection state and update options
    // This slight delay ensures the question is visible before changing options
    setTimeout(() => {
      // Reset selection states
      setSelectedOption(null);
      setIsCorrect(null);
      
      // Create options array with correct answer and distractor
      const options = [question.correctAnswer, question.distractors.L1];
      
      // Shuffle options
      setOptions(shuffleArray(options));
      
      // Start timer for this question
      setQuestionStartTime(Date.now());
    }, 100); // Very short delay for smoother transition
  }, []);

  // Start timer for question using Web Animations API
  const startTimer = useCallback(() => {
    // Make sure we're not in the middle of timing out
    if (isTimingOut) return;
    
    // Stop any existing animation
    if (timerAnimation) {
      timerAnimation.cancel();
    }
    
    // Clear any existing timeouts
    if (timerTimeoutRef.current) {
      clearTimeout(timerTimeoutRef.current);
    }
    
    if (timerRef.current) {
      // Reset timer to 100%
      timerRef.current.style.width = '100%';
      setIsTimerRunning(true);
      
      // Use Web Animations API for smoother animation
      const animation = timerRef.current.animate(
        [
          { width: '100%' },
          { width: '0%' }
        ],
        {
          duration: 5000, // 5 seconds
          easing: 'linear',
          fill: 'forwards'
        }
      );
      
      setTimerAnimation(animation);
      
      // Set a backup timeout in case the animation events fail
      timerTimeoutRef.current = setTimeout(() => {
        handleTimeout();
      }, 5100); // Slightly longer than animation
      
      // Handle timeout when animation ends
      animation.onfinish = () => {
        handleTimeout();
      };
    }
  }, [timerAnimation, isTimingOut]);

  // Handle timeout when no answer selected
  const handleTimeout = useCallback(() => {
    // Make sure we have a current question and haven't already selected an answer
    if (selectedOption !== null || !currentQuestionRef.current) return;
    
    // Prevent multiple timeouts by checking/setting flag
    if (isTimingOut) return;
    setIsTimingOut(true);
    
    // Ensure timer is stopped
    setIsTimerRunning(false);
    if (timerAnimation) {
      timerAnimation.pause();
    }
    if (timerTimeoutRef.current) {
      clearTimeout(timerTimeoutRef.current);
      timerTimeoutRef.current = null;
    }
    
    // Use ref for stable reference to current question
    const question = currentQuestionRef.current;
    
    // Mark as timeout and show correct answer
    setSelectedOption('timeout');
    setIsCorrect(false);
    setShowCorrectEquation(true);
    setTimeToAnswer(5000); // Max time
    
    // Update session results
    const result = {
      id: question.id,
      correct: false,
      timeToAnswer: 5000,
      firstTimeCorrect: false,
    };
    
    setSessionResults(prev => [...prev, result]);
    
    // Add a longer delay to ensure UI updates before loading the next question
    // This ensures the neutral color is applied and black pill shows
    setTimeout(() => {
      // Bail if component is unmounting
      if (!currentQuestionRef.current) return;
      
      // Replay the same question
      loadQuestion(question, true);
    }, 1500);
  }, [loadQuestion, selectedOption, timerAnimation, isTimingOut]);

  // Handle option selection
  const handleOptionSelect = useCallback((option: string) => {
    // Don't process if already selected or no question
    if (selectedOption !== null || !currentQuestion) return;
    
    // Prevent actions during timeout processing
    if (isTimingOut) return;
    
    // Stop timer animation
    if (timerAnimation) {
      timerAnimation.pause();
    }
    if (timerTimeoutRef.current) {
      clearTimeout(timerTimeoutRef.current);
      timerTimeoutRef.current = null;
    }
    setIsTimerRunning(false);
    
    // Calculate time to answer
    const answerTime = Date.now() - questionStartTime;
    setTimeToAnswer(answerTime);
    
    // Check if answer is correct
    const correct = option === currentQuestion.correctAnswer;
    setIsCorrect(correct);
    setSelectedOption(option);
    
    // If incorrect, show correct answer
    if (!correct) {
      setShowCorrectEquation(true);
      setButtonToShake(option);
      setIsButtonShaking(true);
      
      // Reset shaking animation after it completes
      setTimeout(() => {
        setIsButtonShaking(false);
      }, 500);
    }
    
    // Update points in real-time (but no bonuses)
    // First time correct gets 3 points, replay gets 1 point
    if (correct) {
      const pointsToAdd = !isReplayQuestion ? 3 : 1;
      setPoints(prev => prev + pointsToAdd);
      
      // Skip updating points in context as it's not available
    }
    
    // Create result object
    const result = {
      id: currentQuestion.id,
      correct,
      timeToAnswer: answerTime,
      firstTimeCorrect: !isReplayQuestion && correct,
    };
    
    // Update session results locally
    setSessionResults(prev => [...prev, result]);
    
    // Skip recording in session context as it's not available
    
    // Keep the selection state visible, but not too long
    // After a delay, either move to next question or replay current
    setTimeout(() => {
      // Avoid doing this if the component is unmounting
      if (!currentQuestionRef.current) return;
      
      // Move to next question with a moderate delay to ensure proper transition
      if (!correct) {
        // Replay the question after incorrect answer with a stable reference
        loadQuestion(currentQuestion, true);
      } else {
        moveToNextQuestion();
      }
    }, 1200); // Moderate delay - not too long, not too short
  }, [
    currentQuestion, 
    selectedOption, 
    questionStartTime, 
    isReplayQuestion, 
    loadQuestion, 
    timerAnimation, 
    isTimingOut,
  ]);

  // Move to next question or complete session
  const moveToNextQuestion = useCallback(() => {
    const nextIndex = currentQuestionIndex + 1;
    
    if (nextIndex < sessionQuestions.length) {
      setCurrentQuestionIndex(nextIndex);
      loadQuestion(sessionQuestions[nextIndex], false);
    } else {
      // Wait a moment before completing the session to ensure all UI updates finish
      // This prevents the session from completing before showing feedback for the last question
      console.log('All questions completed, scheduling session completion...');
      
      // Use the exact same delay as question transitions for consistent pacing
      setTimeout(() => {
        console.log('Session questions completed, finalizing session...');
        completeSession();
      }, 1000); // Exact same timing as question transitions
    }
  }, [currentQuestionIndex, sessionQuestions, loadQuestion]);

  // Complete the session and report results
  const completeSession = useCallback(() => {
    console.log('🏁 Completing session in MinimalDistinctionPlayer');
    
    // Clean up any outstanding timers or animations
    if (timerAnimation) {
      timerAnimation.cancel();
    }
    if (timerTimeoutRef.current) {
      clearTimeout(timerTimeoutRef.current);
      timerTimeoutRef.current = null;
    }
    
    // CRITICAL FIX: Use the actual question count rather than inferring from results
    // This ensures we always report 20 questions when there are 20 questions
    const totalQuestions = Math.max(
      new Set(sessionResults.map(r => r.id)).size,
      sessionQuestions.length
    );
    
    // Make sure we didn't miss counting any questions
    const correctResults = sessionResults.filter(r => r.correct);
    const correctAnswers = correctResults.length;
    const firstTimeCorrect = sessionResults.filter(r => r.firstTimeCorrect).length;
    const accuracy = (correctAnswers / sessionResults.length) * 100;
    
    console.log(`FINAL STATS: Total questions=${totalQuestions}, Correct answers=${correctAnswers}, First time correct=${firstTimeCorrect}`);
    
    // We count actual questions answered and don't force to match the stitch length
    // Important: A session can end mid-stitch, so use the real question count
    
    // Calculate average time for correctly answered questions
    const totalCorrectTime = correctResults.reduce((sum, r) => sum + r.timeToAnswer, 0);
    const averageTime = correctAnswers > 0 ? totalCorrectTime / correctAnswers : 0;
    
    // Calculate session duration (in seconds)
    const sessionDuration = Math.round(
      sessionResults.reduce((sum, r) => sum + r.timeToAnswer, 0) / 1000
    );
    
    // Save anonymous session data if applicable
    if (!userId || userId.startsWith('anon-')) {
      // Calculate average time for blink speed
      const correctTimes = correctResults.map(r => r.timeToAnswer);
      const avgTime = correctTimes.length > 0 ? 
        correctTimes.reduce((sum, time) => sum + time, 0) / correctTimes.length : 
        2500; // Default to 2.5 seconds
        
      saveAnonymousSessionData(points, avgTime / 1000, sessionResults); // Use accumulated points
    }
    
    // Format results for API
    const apiResults = {
      sessionId: `session-${Date.now()}`,
      threadId: thread.id,
      stitchId: thread.stitches[0].id,
      totalQuestions,
      totalAttempts: sessionResults.length,
      correctAnswers,
      firstTimeCorrect,
      accuracy,
      averageTimeToAnswer: averageTime,
      totalPoints: points, // Use accumulated points
      results: sessionResults,
      completedAt: new Date().toISOString(),
      blinkSpeed: averageTime / 1000, // Convert to seconds for blink speed
      sessionDuration,
      goDashboard: true // Set goDashboard flag to true for proper redirection
    };
    
    // Also try to record session metrics for dashboard via API - only for authenticated users
    if (userId && !userId.startsWith('anon-')) {
      try {
        console.log('Recording session metrics to dashboard via API (completeSession)');
        const sessionRecordingPromise = fetch('/api/record-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            threadId: thread.id,
            stitchId: thread.stitches[0].id,
            questionResults: sessionResults.length > 0 ? sessionResults.map(r => ({
              questionId: r.id,
              correct: r.correct,
              timeToAnswer: r.timeToAnswer,
              firstTimeCorrect: r.firstTimeCorrect
            })) : [
              // Provide at least one default question result if empty
              {
                questionId: `auto-end-${Date.now()}`,
                correct: false,
                timeToAnswer: 1000,
                firstTimeCorrect: false
              }
            ],
            sessionDuration,
            autoComplete: true // Flag to indicate this was an automatic completion
          }),
          credentials: 'include' // Important! Include cookies for auth
        });
        
        // Process response
        sessionRecordingPromise.then(response => {
          if (!response.ok) {
            console.error('Failed to record session metrics:', response.status);
            return response.text().then(text => {
              console.error('Error details:', text);
            });
          } else {
            console.log('✅ Successfully recorded session metrics for dashboard (completeSession)');
            return response.json();
          }
        }).then(data => {
          if (data) {
            console.log('Dashboard metrics response:', data);
          }
        }).catch(error => {
          console.error('Error recording session metrics:', error);
        });
      } catch (error) {
        console.error('Error sending session metrics:', error);
      }
    } else {
      console.log('Skipping API calls for anonymous user in completeSession - using localStorage only');
    }
    
    // Add a short delay before triggering completion to ensure smooth transitions
    // This prevents the flash of new content before navigation
    setTimeout(() => {
      onComplete(apiResults);
    }, 50);
    
  }, [sessionResults, points, thread, onComplete, timerAnimation, userId]);

  // State for session summary
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [sessionSummaryStep, setSessionSummaryStep] = useState<'base' | 'bonus' | 'final'>('base');
  const [sessionSummary, setSessionSummary] = useState<{
    // Basic session stats
    totalQuestions: number;
    correctAnswers: number;
    firstTimeCorrect: number;
    basePoints: number;
    blinkSpeed: number;
    
    // Bonus calculation
    bonuses: {
      consistency: number;
      speed: number;
      accuracy: number;
      mastery: number;
      isEligible: boolean;
      messages: string[];
    };
    
    // Final results
    multiplier: number;
    totalPoints: number;
    
    // Evolution data
    evolutionLevel: number;
    evolutionProgress: number;
  } | null>(null);

  // Handle ending session early
  const handleEndSession = async () => {
    console.log('📱 User clicked Finish button in MinimalDistinctionPlayer');
    
    // Clean up any outstanding timers or animations
    if (timerAnimation) {
      timerAnimation.cancel();
    }
    if (timerTimeoutRef.current) {
      clearTimeout(timerTimeoutRef.current);
      timerTimeoutRef.current = null;
    }

    // Check if this is an anonymous user
    const isAnonymous = !userId || userId.startsWith('anon-');
    
    // Get current session stats before making async calls
    const correctResults = sessionResults.filter(r => r.correct);
    const currentSessionCorrectAnswers = correctResults.length;
    const currentSessionFirstTimeCorrect = sessionResults.filter(r => r.firstTimeCorrect).length;
    const currentSessionQuestions = new Set(sessionResults.map(r => r.id)).size;
    
    // Calculate blink speed (average time for correct answers in milliseconds)
    const correctTimes = correctResults.map(r => r.timeToAnswer);
    const avgTime = correctTimes.length > 0 ? 
      correctTimes.reduce((sum, time) => sum + time, 0) / correctTimes.length : 
      0;
    
    // Calculate session duration (in seconds)
    const sessionDuration = Math.round(
      sessionResults.reduce((sum, r) => sum + r.timeToAnswer, 0) / 1000
    );
    
    // Log debug info
    console.log(`FINAL STATS FOR SESSION SUMMARY:
      Current session questions answered: ${currentSessionQuestions}
      Current session correct answers: ${currentSessionCorrectAnswers}
      Current session first time correct: ${currentSessionFirstTimeCorrect}
      Blink speed: ${avgTime / 1000}s
      Session duration: ${sessionDuration}s
    `);
    
    const eventuallyCorrect = currentSessionCorrectAnswers - currentSessionFirstTimeCorrect;
    
    // Calculate base points for this session only
    const basePoints = calculateBasePoints(currentSessionFirstTimeCorrect, eventuallyCorrect);
    
    // Prepare stitchPositions data for context API
    const stitchPositions = [{
      threadId: thread.id,
      stitchId: thread.stitches[0].id,
      orderNumber: 0, // Default order number
      skipNumber: 1,  // Default skip number
      distractorLevel: 'L1' // Default distractor level
    }];
    
    // Prepare session data for bonus calculation
    const sessionData = {
      totalQuestions: currentSessionQuestions,
      totalAttempts: sessionResults.length,
      correctAnswers: currentSessionCorrectAnswers,
      firstTimeCorrect: currentSessionFirstTimeCorrect,
      averageTimeToAnswer: avgTime,
      sessionDuration,
      threadId: thread.id,
      stitchId: thread.stitches[0].id
    };
    
    // Calculate bonuses using the original logic for UI consistency
    const bonuses = calculateBonuses(sessionData, sessionResults, isAnonymous);
    const { totalPoints, multiplier } = calculateTotalPoints(basePoints, bonuses);
    
    // For anonymous users, also use the original saveAnonymousSessionData for backwards compatibility
    if (isAnonymous) {
      console.log(`HandleEndSession: Saving ${basePoints} points (SINGLE SOURCE OF TRUTH)`);
      saveAnonymousSessionData(basePoints, avgTime / 1000, sessionResults);
    }
    
    // Skip context operations since SessionContext is not available
    console.log('SessionContext not available, using local calculations only');
    
    // Use local calculations for evolution
    let evolutionLevel = Math.floor(totalPoints / 1000) + 1;
    let evolutionProgress = (totalPoints % 1000) / 10; // 0-100
    
    // Set session summary data to show in the UI
    setSessionSummary({
      totalQuestions: currentSessionQuestions,
      correctAnswers: currentSessionCorrectAnswers,
      firstTimeCorrect: currentSessionFirstTimeCorrect,
      basePoints,
      blinkSpeed: avgTime / 1000,
      bonuses,
      multiplier,
      totalPoints,
      evolutionLevel,
      evolutionProgress
    });
    
    // Show the session summary UI
    setShowSessionSummary(true);
    setSessionSummaryStep('base');
    
    // For backward compatibility, we still prepare the session stats object
    // But no longer store it in the window object - will use context instead
    const stats = {
      sessionId: `session-${Date.now()}`,
      threadId: thread.id,
      stitchId: thread.stitches[0].id,
      totalQuestions: currentSessionQuestions,
      totalAttempts: sessionResults.length,
      correctAnswers: currentSessionCorrectAnswers,
      firstTimeCorrect: currentSessionFirstTimeCorrect,
      totalPoints,
      blinkSpeed: avgTime / 1000,
      sessionDuration,
      multiplier,
      goDashboard: true,
      questionResults: sessionResults.map(r => ({
        questionId: r.id,
        correct: r.correct,
        timeToAnswer: r.timeToAnswer,
        firstTimeCorrect: r.firstTimeCorrect
      })),
      results: sessionResults,
      completedAt: new Date().toISOString()
    };
    
    // Save the stats for use with finishSession when user clicks a button
    if (typeof window !== 'undefined') {
      window.__SESSION_STATS__ = stats;
    }
    
    // Legacy API calls - gradually phasing these out as we move to the context
    // Keep them for backward compatibility during transition
    if (!isAnonymous) {
      console.log('Making legacy API calls for backward compatibility...');
      // Making these calls in the background but not waiting for them
      // They're for backward compatibility only
      
      fetch('/api/record-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          threadId: thread.id,
          stitchId: thread.stitches[0].id,
          questionResults: stats.questionResults,
          sessionDuration,
          userId: userId
        }),
        credentials: 'include'
      }).catch(error => {
        console.error('Error in legacy record-session API call:', error);
      });
    }
  };
  
  // Called after showing summary or if there's an error
  const finishSession = async (stats: any) => {
    // If onEndSession is provided, call it instead of regular completion
    if (onEndSession) {
      console.log('Using onEndSession callback for manual session ending');
      
      // Add navigation flag to ensure dashboard redirect
      stats.goDashboard = true;
      
      // Skip context completion as it's not available
      console.log('SessionContext not available, skipping final completion check');
      
      // Handle anonymous users
      if (typeof window !== 'undefined') {
        try {
          // Check if user is anonymous
          const isAnonymous = !userId || userId.startsWith('anon-');
          
          if (isAnonymous) {
            // Get anonymous ID from localStorage
            const anonymousId = localStorage.getItem('anonymousId');
            
            if (anonymousId) {
              console.log('FINISH SESSION: Points already saved in handleEndSession, skipping to avoid double-counting');
              
              // Store basic session data but don't update points again
              const sessionData = {
                blinkSpeed: stats.blinkSpeed || timeToAnswer / 1000,
                blinkSpeedTrend: 'steady', 
                lastSessionDate: new Date().toISOString()
              };
              
              // Save non-point session data to localStorage
              localStorage.setItem(`sessionData_${anonymousId}`, JSON.stringify(sessionData));
              
              // Redirect anonymous users to anon-dashboard
              setTimeout(() => {
                router.push('/anon-dashboard');
              }, 100);
            }
          } else {
            // For authenticated users, redirect to regular dashboard
            setTimeout(() => {
              router.push('/dashboard');
            }, 100);
          }
        } catch (error) {
          console.error('Error saving anonymous session data:', error);
          // Check if this is an anonymous user even if there was an error
          const isAnonymous = !userId || userId.startsWith('anon-');
          // Redirect to the appropriate dashboard based on user type
          setTimeout(() => {
            router.push(isAnonymous ? '/anon-dashboard' : '/dashboard');
          }, 100);
        }
      }
      
      // Also call the onEndSession callback to maintain compatibility
      onEndSession(stats);
    } else {
      // For automatic completion via context
      // Skip context-based session completion since context is not available
      console.log('SessionContext not available, using direct complete method');
      
      // Call onComplete directly with basic stats
      onComplete({
        ...stats,
        sessionId: `session-${Date.now()}`,
        success: true,
        goDashboard: true
      });
    }
  };
  
  // Helper function to get level name based on level number
  const getLevelName = (level: number): string => {
    const levels = [
      'Mind Spark',
      'Thought Weaver',
      'Pattern Seeker',
      'Vision Runner',
      'Logic Sculptor',
      'Equation Master',
      'Theorem Hunter',
      'Quantum Thinker',
      'Dimension Walker',
      'Math Oracle'
    ];
    
    // Ensure we don't go out of bounds
    if (level <= 0) return levels[0];
    if (level > levels.length) return levels[levels.length - 1];
    
    return levels[level - 1];
  };
  
  // Helper function to save session data to localStorage for anonymous users
  const saveAnonymousSessionData = (
    sessionPoints: number, 
    sessionBlinkSpeed: number,
    sessionResults: any[]
  ) => {
    if (typeof window === 'undefined') return;
    
    try {
      // Check if user is anonymous
      if (!userId || userId.startsWith('anon-')) {
        // Get anonymous ID from localStorage
        const anonymousId = localStorage.getItem('anonymousId');
        if (!anonymousId) return;
        
        console.log('Saving anonymous session data for ID:', anonymousId);
        
        // Store session data
        const sessionData = {
          totalPoints: sessionPoints,
          blinkSpeed: sessionBlinkSpeed,
          blinkSpeedTrend: 'steady',
          lastSessionDate: new Date().toISOString(),
          completedQuestions: sessionResults.length
        };
        
        // Save to localStorage
        localStorage.setItem(`sessionData_${anonymousId}`, JSON.stringify(sessionData));
        
        // Get existing progress data or create new if doesn't exist
        const existingProgressData = localStorage.getItem(`progressData_${anonymousId}`);
        let progressData = existingProgressData ? JSON.parse(existingProgressData) : {
          totalPoints: 0,
          blinkSpeed: 0,
          blinkSpeedTrend: 'steady',
          evolution: {
            currentLevel: 'Mind Spark',
            levelNumber: 1,
            progress: 0,
            nextLevel: 'Thought Weaver'
          }
        };
        
        // Update progress data
        progressData.totalPoints = (progressData.totalPoints || 0) + sessionPoints;
        progressData.blinkSpeed = sessionBlinkSpeed;
        
        // Calculate evolution
        const totalPoints = progressData.totalPoints;
        const levelNumber = Math.floor(totalPoints / 1000) + 1; // Level up every 1000 points
        const progress = (totalPoints % 1000) / 10; // 0-100% within level
        
        // Update evolution data
        progressData.evolution = {
          currentLevel: getLevelName(levelNumber),
          levelNumber: levelNumber,
          progress: progress,
          nextLevel: getLevelName(levelNumber + 1)
        };
        
        // Save updated progress data
        localStorage.setItem(`progressData_${anonymousId}`, JSON.stringify(progressData));
        
        console.log('Anonymous progress data saved successfully:', progressData);
        return true;
      }
    } catch (error) {
      console.error('Failed to save anonymous session data:', error);
    }
    return false;
  };

  // If session is complete, show a minimal loading state with fixed dimensions
  if (isSessionComplete) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        {/* Simple loading indicator with fixed dimensions and same structure */}
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden fixed-player-card">
          {/* Header for consistent layout */}
          <div className="bg-white bg-opacity-10 p-4 flex justify-between items-center opacity-50">
            <div>
              <p className="text-white text-opacity-70 text-sm">POINTS</p>
              <p className="text-white text-2xl font-bold">-</p>
            </div>
            <div className="timer-container w-24"></div>
          </div>
          
          {/* Main content area with spinner - use question-container for consistent height */}
          <div className="p-6 question-container flex items-center justify-center">
            <div className="inline-block animate-spin h-8 w-8 border-4 border-teal-300 border-t-transparent rounded-full"></div>
          </div>
          
          {/* Footer for consistent layout */}
          <div className="bg-white bg-opacity-10 p-4 opacity-50"></div>
        </div>
      </div>
    );
  }

  // If no current question, show loading or error with fixed dimensions
  if (!currentQuestion) {
    // Check if we have questions but they're just not loaded yet
    const hasQuestions = thread?.stitches?.[0]?.questions?.length > 0;
    
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden fixed-player-card">
          {/* Header for consistent layout */}
          <div className="bg-white bg-opacity-10 p-4 flex justify-between items-center opacity-50">
            <div>
              <p className="text-white text-opacity-70 text-sm">POINTS</p>
              <p className="text-white text-2xl font-bold">-</p>
            </div>
            <div className="timer-container w-24"></div>
          </div>
          
          {/* Main content area with consistent layout - use question-container for height */}
          <div className="p-6 question-container flex flex-col items-center justify-center text-center">
            {hasQuestions ? (
              <>
                <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
                <div className="text-white text-xl">Loading questions...</div>
              </>
            ) : (
              <>
                <div className="text-white text-xl mb-4">No questions available</div>
                <div className="text-white text-opacity-70 mb-6">
                  This stitch doesn't have any questions. Please add questions in the admin dashboard.
                </div>
                <button
                  onClick={() => {
                    // Create sample questions since none are available
                    if (!thread || !thread.stitches || thread.stitches.length === 0) return;
                    
                    const stitch = thread.stitches[0];
                    console.log("Creating sample questions for empty stitch");
                    
                    const sampleQuestions = [
                      {
                        id: `${stitch.id}-q1`,
                        text: '3 + 5',
                        correctAnswer: '8',
                        distractors: { L1: '7', L2: '9', L3: '6' }
                      },
                      {
                        id: `${stitch.id}-q2`,
                        text: '7 - 2',
                        correctAnswer: '5',
                        distractors: { L1: '4', L2: '6', L3: '3' }
                      },
                      {
                        id: `${stitch.id}-q3`,
                        text: '4 × 3',
                        correctAnswer: '12',
                        distractors: { L1: '6', L2: '10', L3: '9' }
                      }
                    ];
                    
                    // Set the questions on the stitch
                    stitch.questions = sampleQuestions;
                    
                    // Re-initialize with these questions
                    const allQuestions = [...sampleQuestions];
                    const sessionQs = allQuestions.slice(0, Math.min(questionsPerSession, allQuestions.length));
                    setSessionQuestions(sessionQs);
                    
                    // Start with the first question
                    if (sessionQs.length > 0) {
                      setIsInitialized(true);
                      loadQuestion(sessionQs[0], false);
                    }
                  }}
                  className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                >
                  Use Sample Questions
                </button>
              </>
            )}
          </div>
          
          {/* Footer for consistent layout */}
          <div className="bg-white bg-opacity-10 p-4 opacity-50"></div>
        </div>
      </div>
    );
  }

  // Handle session summary display
  if (showSessionSummary && sessionSummary) {
    // Get values for easier access
    const { 
      totalQuestions, 
      correctAnswers, 
      firstTimeCorrect, 
      basePoints, 
      bonuses, 
      multiplier, 
      totalPoints,
      evolutionLevel,
      evolutionProgress
    } = sessionSummary;
    
    // Calculate the eventually correct count
    const eventuallyCorrect = correctAnswers - firstTimeCorrect;
    
    // Base points calculation for display
    const ftcPoints = firstTimeCorrect * 3;
    const ecPoints = eventuallyCorrect * 1;
    
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden max-w-md w-full text-center animate-fadeIn">
          {/* Session summary steps */}
          {sessionSummaryStep === 'base' && (
            <>
              {/* Header */}
              <div className="bg-indigo-900/40 p-4">
                <h2 className="text-2xl font-bold text-white">Session Complete!</h2>
              </div>
              
              {/* Base points calculation */}
              <div className="p-6 space-y-6">
                <div className="bg-white/10 rounded-xl p-4 text-left">
                  <h3 className="text-xl font-bold text-white mb-3 text-center">Session Summary</h3>
                  
                  <div className="space-y-2 text-white">
                    <div className="flex justify-between">
                      <span>Questions Answered:</span>
                      <span className="font-semibold">{totalQuestions}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span>First Time Correct:</span>
                      <span className="font-semibold">{firstTimeCorrect} × 3 = {ftcPoints} pts</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span>Eventually Correct:</span>
                      <span className="font-semibold">{eventuallyCorrect} × 1 = {ecPoints} pts</span>
                    </div>
                    
                    <div className="h-px bg-white/20 my-3"></div>
                    
                    <div className="flex justify-between text-lg font-bold">
                      <span>Base Points:</span>
                      <span className="text-teal-300">{basePoints}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Continue button */}
              <div className="p-4 bg-white/5">
                <button 
                  onClick={() => {
                    // Move to bonus calculation step
                    setSessionSummaryStep('bonus');
                  }}
                  className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-colors"
                >
                  Continue
                </button>
              </div>
            </>
          )}
          
          {/* Bonus calculation step */}
          {sessionSummaryStep === 'bonus' && (
            <>
              {/* Header */}
              <div className="bg-indigo-900/40 p-4">
                <h2 className="text-2xl font-bold text-white">Bonus Multipliers</h2>
              </div>
              
              {/* Bonus messages */}
              <div className="p-6 space-y-6">
                {bonuses.messages.length > 0 ? (
                  <div className="bg-white/10 rounded-xl p-4 text-center">
                    <h3 className="text-xl font-bold text-white mb-4">You've earned bonuses!</h3>
                    
                    <div className="space-y-3">
                      {bonuses.messages.map((message, index) => (
                        <div 
                          key={index} 
                          className="py-2 px-3 bg-gradient-to-r from-indigo-900/50 to-blue-900/50 rounded-lg border border-indigo-500/30 text-white"
                        >
                          {message}
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-6 text-2xl font-bold text-white">
                      Combined Multiplier: <span className="text-yellow-300">×{multiplier}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/10 rounded-xl p-4 text-center">
                    <h3 className="text-xl font-bold text-white mb-3">No Bonus Multipliers</h3>
                    <p className="text-white/80 mb-4">
                      Complete more questions in a session to earn bonus multipliers!
                    </p>
                    <div className="text-lg font-bold text-white">
                      Multiplier: ×1
                    </div>
                  </div>
                )}
              </div>
              
              {/* Continue button */}
              <div className="p-4 bg-white/5">
                <button 
                  onClick={() => {
                    // Move to final step
                    setSessionSummaryStep('final');
                  }}
                  className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-colors"
                >
                  Continue
                </button>
              </div>
            </>
          )}
          
          {/* Final total step */}
          {sessionSummaryStep === 'final' && (
            <>
              {/* Header */}
              <div className="bg-indigo-900/40 p-4">
                <h2 className="text-2xl font-bold text-white">Total Points Earned</h2>
              </div>
              
              {/* Final calculation */}
              <div className="p-6 space-y-6">
                <div className="bg-white/10 rounded-xl p-5 text-center">
                  <div className="flex justify-between items-center text-white mb-4">
                    <span className="text-lg">Base Points:</span>
                    <span className="text-2xl font-bold">{basePoints}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-white mb-6">
                    <span className="text-lg">Multiplier:</span>
                    <span className="text-2xl font-bold text-yellow-300">×{multiplier}</span>
                  </div>
                  
                  <div className="h-px bg-white/20 my-3"></div>
                  
                  <div className="mt-4">
                    <div className="text-white/80 text-sm mb-1">Total Points</div>
                    <div className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-amber-300 text-transparent bg-clip-text">
                      {totalPoints.toLocaleString()}
                    </div>
                  </div>
                </div>
                
                {/* Evolution level */}
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-white/70 text-sm mb-1">Evolution Level</div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-blue-500 text-transparent bg-clip-text">
                    {getLevelName(evolutionLevel)}
                  </div>
                  
                  {/* Progress bar */}
                  <div className="mt-3 bg-white/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-teal-500 to-blue-500" 
                      style={{ width: `${evolutionProgress}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-white/70 mt-1">
                    {Math.round(evolutionProgress)}% to {getLevelName(evolutionLevel + 1)}
                  </div>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="p-4 bg-white/5">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => {
                      // Hide summary, reset points, and return to player
                      setShowSessionSummary(false);
                      // Reset points while maintaining the session
                      setPoints(0);
                      // Reset session results to allow fresh scoring
                      setSessionResults([]);
                      // Reset current question index to start from the beginning
                      setCurrentQuestionIndex(0);
                      // Load the first question to restart the session
                      if (sessionQuestions.length > 0) {
                        loadQuestion(sessionQuestions[0], false);
                      }
                      console.log('Continuing session with points reset and questions restarted');
                    }}
                    className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors"
                  >
                    Continue Playing
                  </button>
                  
                  <button
                    onClick={() => {
                      // Go to dashboard with saved stats
                      console.log('User clicked Go to Dashboard');

                      // Get the saved stats from earlier
                      const stats = (typeof window !== 'undefined' && window.__SESSION_STATS__) ? window.__SESSION_STATS__ : {
                        goDashboard: true,
                        totalPoints: totalPoints
                      };

                      // Force direct navigation based on user type
                      const isAnonymous = !userId || userId.startsWith('anon-');

                      if (isAnonymous) {
                        console.log('DIRECT NAVIGATION: Anonymous user detected - going to /anon-dashboard');
                        // No need to save points here - already saved in handleEndSession

                        // Navigation to anonymous dashboard using Next.js router
                        router.push('/anon-dashboard');
                      } else {
                        console.log('DIRECT NAVIGATION: Authenticated user - using finishSession');
                        // Use standard finishSession flow for authenticated users
                        finishSession(stats);
                      }
                    }}
                    className="py-3 px-4 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-colors"
                  >
                    Go to Dashboard
                  </button>
                </div>
                
                {/* Sign up button for anonymous users */}
                {(!userId || userId.startsWith('anon-')) && (
                  <a 
                    href="/signin" 
                    className="block w-full mt-3 py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 text-white font-bold rounded-xl transition-colors text-center"
                  >
                    Sign Up to Save Progress
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen player-bg flex items-center justify-center p-4">
      {/* Fixed width/height container similar to iPhone 8 dimensions */}
      <div 
        ref={questionCardRef}
        className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden fixed-player-card"
      >
        {/* Points display - SIMPLIFIED TO SHOW ONLY POINTS */}
        <div className="bg-white bg-opacity-10 p-3 flex justify-between items-center">
          <div>
            <p className="text-white text-opacity-70 text-sm">POINTS</p>
            <p className="text-white text-2xl font-bold">{sessionTotalPoints + points}</p>
          </div>
          
          {/* Timer - fixed width */}
          <div className="timer-container w-24">
            <div 
              ref={timerRef}
              className="timer-fill"
            />
          </div>
        </div>
        
        {/* Main question area with fixed height */}
        <div className="p-6 question-container">
          {/* Question display with fixed height container to prevent shifts */}
          <div className="mb-8 text-center">
            {/* Only show question equation or text - celebration pill is now at page level */}
            {showCorrectEquation && currentQuestion ? (
              <div className="question-container" style={{ minHeight: '60px' }}>
                <div className="question-pill text-2xl py-3 px-6">
                  {(() => {
                    // Thoroughly clean the question text
                    const questionText = currentQuestion.text.trim();
                    const answer = currentQuestion.correctAnswer;
                    
                    // Check for various equation patterns
                    if (questionText.endsWith('=')) {
                      // Case: "1 + 2 ="
                      return `${questionText} ${answer}`;
                    } else if (questionText.includes('=')) {
                      // Case: "1 + 2 = ?" or other equation with equals sign
                      return questionText.replace(/\?$/, answer).replace(/=\s*\?/, `= ${answer}`);
                    } else if (questionText.match(/\d+\s*[\+\-\*\/×÷]\s*\d+$/)) {
                      // Case: "1 + 2" (no equals sign but has math operator)
                      return `${questionText} = ${answer}`;
                    } else {
                      // Default case for other question types
                      return `${questionText} = ${answer}`;
                    }
                  })()}
                </div>
              </div>
            ) : currentQuestion ? (
              <div className="question-container" style={{ minHeight: '60px' }}>
                <h2 className="text-white text-3xl font-bold">
                  {currentQuestion.text}
                </h2>
              </div>
            ) : (
              <div className="question-container" style={{ minHeight: '60px' }}>
                {/* Empty placeholder to maintain layout during transitions */}
              </div>
            )}
          </div>
          
          {/* Options - always in 2 columns */}
          <div className="grid grid-cols-2 gap-4 mb-4 buttons-container">
            {options.map((option, index) => (
              <button
                key={`${currentQuestion.id}-${option}-${index}`}
                onClick={() => handleOptionSelect(option)}
                disabled={selectedOption !== null}
                className={`
                  option-button answer-button
                  flex items-center justify-center 
                  rounded-full
                  text-3xl font-bold
                  transition-all duration-300
                  option-hover
                  ${buttonToShake === option && isButtonShaking ? 'animate-shudder' : ''}
                  ${selectedOption === option && isCorrect ? 'bg-green-500 text-white glow-green' : ''}
                  ${selectedOption === option && !isCorrect ? 'glow-red' : ''}
                  ${selectedOption && selectedOption !== option ? 'neutral-option' : ''}
                  ${selectedOption && option === currentQuestion.correctAnswer && !isCorrect ? 'bg-green-500 text-white glow-green' : ''}
                  ${selectedOption === 'timeout' ? 'neutral-option' : ''}
                  ${selectedOption === null ? 'bg-white text-gray-800' : ''}
                `}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        
        {/* Footer area with enhanced Finish button */}
        <div className="bg-white bg-opacity-10 p-3 flex justify-between items-center">
          <div className="w-24"></div> {/* Spacer for balance */}
          <div className="text-center">
            <button
              onClick={handleEndSession}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-1.5 px-4 rounded-lg transition-colors text-sm focus:outline-none"
            >
              Finish
            </button>
          </div>
          <div className="w-24"></div> {/* Spacer for balance */}
        </div>
      </div>
    </div>
  );
};

export default MinimalDistinctionPlayer;