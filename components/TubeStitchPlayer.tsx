import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Question } from '../lib/types/distinction-learning';
import { calculateBonuses, calculateTotalPoints, calculateBasePoints } from '../lib/bonusCalculator';
import { useZenjinStore } from '../lib/store/zenjinStore';

/**
 * TubeStitchPlayer - Simplified player component that works directly with the tube-stitch model
 * with no thread abstraction or fallbacks
 */
interface TubeStitchPlayerProps {
  tubeNumber: number; // Required - which tube to display
  tubeData: any; // Required - contains tube data with positions or stitches
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

const TubeStitchPlayer: React.FC<TubeStitchPlayerProps> = ({
  tubeNumber,
  tubeData,
  onComplete,
  onEndSession,
  questionsPerSession = 10,
  sessionTotalPoints = 0,
  userId,
}) => {
  // Initialize Next.js router for client-side navigation
  const router = useRouter();

  // Extract stitches directly from the tube data
  const [stitches, setStitches] = useState<any[]>([]);
  const [currentStitchId, setCurrentStitchId] = useState<string | null>(null);

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

  // Get stitches from tube data on component mount or when tube data changes
  useEffect(() => {
    if (!tubeData || !tubeNumber) {
      console.error("Missing required tube data or tube number");
      return;
    }

    const activeTube = tubeData[tubeNumber];
    if (!activeTube) {
      console.error(`No tube data found for tube ${tubeNumber}`);
      return;
    }

    console.log(`Processing tube ${tubeNumber} data`);

    let extractedStitches: any[] = [];

    // Check for position-based format (preferred)
    if (activeTube.positions && Object.keys(activeTube.positions).length > 0) {
      console.log(`Tube ${tubeNumber} has ${Object.keys(activeTube.positions).length} stitches in position-based format`);

      // Convert positions to stitches array
      const positionStitches = Object.entries(activeTube.positions).map(([position, data]: [string, any]) => ({
        id: data.stitchId,
        position: parseInt(position),
        skipNumber: data.skipNumber || 3,
        distractorLevel: data.distractorLevel || 'L1'
      }));

      // Sort by position
      extractedStitches = positionStitches.sort((a, b) => a.position - b.position);
    }
    // Legacy format support (stitches array)
    else if (activeTube.stitches && activeTube.stitches.length > 0) {
      console.log(`Tube ${tubeNumber} has ${activeTube.stitches.length} stitches in legacy format`);
      extractedStitches = [...activeTube.stitches];
    }
    else {
      console.error(`Tube ${tubeNumber} has no valid stitch data (neither positions nor stitches)`);
      return;
    }

    // Set the extracted stitches and current stitch ID
    setStitches(extractedStitches);
    setCurrentStitchId(activeTube.currentStitchId ||
      (extractedStitches.length > 0 ? extractedStitches[0].id : null));

    console.log(`Tube ${tubeNumber} processed: ${extractedStitches.length} stitches extracted`);
  }, [tubeData, tubeNumber]);

  // Keep track of which stitches we've already initialized
  const initializedStitchRef = useRef({});
  const previousTubeRef = useRef<number | null>(null);

  // Initialize questions for the session directly from stitches
  useEffect(() => {
    console.log('🔍 PLAYER DEBUG: Checking stitch data', {
      tubeNumber,
      hasStitches: stitches.length > 0,
      stitchCount: stitches.length,
      currentStitchId
    });

    // Guard clause - don't proceed if we don't have stitches
    if (stitches.length === 0) {
      console.warn('No stitches available for TubeStitchPlayer');
      return;
    }

    // Log the first few stitch IDs for debugging
    const stitchIds = stitches.slice(0, 5).map(s => s.id);
    console.log(`Tube ${tubeNumber} has stitches:`, stitchIds.join(', '));

    // Use the first stitch or the current stitch if specified
    const activeStitchId = currentStitchId || stitches[0].id;
    const stitch = stitches.find(s => s.id === activeStitchId) || stitches[0];

    // Check if we're switching to a different tube
    const isNewTube = previousTubeRef.current !== tubeNumber;

    // Track if this specific tube+stitch combination has been initialized
    const tubeStitchKey = `tube-${tubeNumber}:${stitch.id}`;
    const alreadyInitialized = initializedStitchRef.current[tubeStitchKey];

    // Update the previous tube ref for next time
    previousTubeRef.current = tubeNumber;

    // Allow re-initialization when switching tubes, or for first initialization
    if (alreadyInitialized && !isNewTube) {
      console.log(`Skipping re-initialization for stitch ${stitch.id} in tube ${tubeNumber} - already initialized and not a tube change`);
      return;
    }

    // Mark this tube-stitch combination as initialized
    initializedStitchRef.current[tubeStitchKey] = true;

    console.log(`Initializing with tube ${tubeNumber}, stitch ${stitch.id}${isNewTube ? ' (NEW TUBE)' : ' (SAME TUBE)'}`);

    // Reset state for the new tube/stitch - but keep points and session results accumulated from previous stitches
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

    // Debug logging for stitch content
    console.log(`Initializing stitch ${stitch.id} in tube ${tubeNumber}`, {
      id: stitch.id,
      position: stitch.position
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
      const [_, tubeNum, groupNum, posNum] = stitchFormatMatch;
      console.log(`DEBUG: Stitch ID format analysis - Tube: ${tubeNum}, Group: ${groupNum}, Position: ${posNum}`);

      // Check if any stitches with similar patterns exist in the Zustand store
      const contentCollection = useZenjinStore.getState().contentCollection;
      const stitchKeys = contentCollection?.stitches ? Object.keys(contentCollection.stitches) : [];
      const similarPatternKeys = stitchKeys.filter(key =>
        key.startsWith(`stitch-T${tubeNum}-`)
      ).slice(0, 5);

      if (similarPatternKeys.length > 0) {
        console.log(`DEBUG: Similar pattern stitches found in store: ${similarPatternKeys.join(', ')}`);
      } else {
        console.log(`DEBUG: No similar pattern stitches found in store for T${tubeNum}`);
      }
    }

    // Simple debug logging to help understand issues
    console.log(`DEBUG: Fetching stitch ${stitch.id} from Zustand store`);

    // Get the fetchStitch function from Zustand store
    const fetchStitch = useZenjinStore.getState().fetchStitch;

    // Initialize stitch's questions array if it doesn't exist
    if (!stitch.questions) {
      stitch.questions = [];
    }

    // Check if the stitch already has questions
    if (stitch.questions && stitch.questions.length > 0) {
      console.log(`DEBUG: Stitch ${stitch.id} already has ${stitch.questions.length} questions`);

      // Initialize session with existing questions
      const allQuestions = [...stitch.questions];
      const sessionQs = allQuestions.slice(0, Math.min(questionsPerSession, allQuestions.length));
      setSessionQuestions(sessionQs);

      // Start with the first question if available
      if (sessionQs.length > 0) {
        setIsInitialized(true);
        loadQuestion(sessionQs[0], false);
      }
    } else {
      try {
        // Fetch the stitch from the Zustand store
        fetchStitch(stitch.id).then(storeStitch => {
          if (storeStitch && storeStitch.questions && storeStitch.questions.length > 0) {
            console.log(`SUCCESS: Fetched ${storeStitch.questions.length} questions for stitch ${stitch.id} from Zustand store`);

            // Create a local copy of the questions for this session
            const questions = [...storeStitch.questions];

            // Update the stitch's questions
            stitch.questions = questions;

            // Initialize the session with these questions
            const sessionQs = questions.slice(0, Math.min(questionsPerSession, questions.length));
            setSessionQuestions(sessionQs);

            // Start with the first question
            if (sessionQs.length > 0) {
              setIsInitialized(true);
              loadQuestion(sessionQs[0], false);
            }
          } else {
            console.error(`ERROR: Failed to fetch valid questions for stitch ${stitch.id} from Zustand store`);
            setError(`No questions available for stitch ${stitch.id}. Please try another tube.`);
          }
        }).catch(error => {
          console.error(`ERROR: Failed to fetch stitch ${stitch.id} from Zustand store:`, error);
          setError(`Error fetching stitch ${stitch.id}: ${error.message}`);
        });
      } catch (error) {
        console.error(`ERROR: Exception while fetching stitch ${stitch.id}:`, error);
        setError(`Exception while fetching stitch: ${error.message}`);
      }
    }
  }, [stitches, tubeNumber, currentStitchId, questionsPerSession]);

  // State for errors
  const [error, setError] = useState<string | null>(null);

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
    console.log('🏁 Completing session in TubeStitchPlayer');
    
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
      tubeId: tubeNumber,
      stitchId: currentStitchId,
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
            tubeId: tubeNumber,
            stitchId: currentStitchId,
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
    
  }, [sessionResults, points, tubeNumber, currentStitchId, onComplete, timerAnimation, userId, sessionQuestions]);

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
    console.log('📱 User clicked Finish button in TubeStitchPlayer');
    
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
      tubeId: tubeNumber,
      stitchId: currentStitchId,
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
      tubeId: tubeNumber,
      stitchId: currentStitchId
    };
    
    // Calculate bonuses using the original logic for UI consistency
    const bonuses = calculateBonuses(sessionData, sessionResults, isAnonymous);
    const { totalPoints, multiplier } = calculateTotalPoints(basePoints, bonuses);
    
    // For anonymous users, also use the original saveAnonymousSessionData for backwards compatibility
    if (isAnonymous) {
      console.log(`HandleEndSession: Saving ${basePoints} points (SINGLE SOURCE OF TRUTH)`);
      saveAnonymousSessionData(basePoints, avgTime / 1000, sessionResults);
    }
    
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
    const stats = {
      sessionId: `session-${Date.now()}`,
      tubeId: tubeNumber,
      stitchId: currentStitchId,
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
          tubeId: tubeNumber,
          stitchId: currentStitchId,
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

  // Error state with retry button
  if (error) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden fixed-player-card">
          <div className="bg-white bg-opacity-10 p-4 flex justify-between items-center">
            <div>
              <p className="text-white text-opacity-70 text-sm">ERROR</p>
              <p className="text-white text-2xl font-bold">Content Issue</p>
            </div>
          </div>
          
          <div className="p-6 question-container flex flex-col items-center justify-center">
            <div className="text-white text-xl mb-4">Unable to Load Content</div>
            <div className="text-white text-opacity-70 mb-6 text-center">
              {error}
            </div>
            <button
              onClick={() => {
                setError(null);
                window.location.reload(); // Simple refresh to retry
              }}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
          
          <div className="bg-white bg-opacity-10 p-4 flex justify-center items-center">
            <span className="text-white text-opacity-50 text-xs">Tube {tubeNumber}</span>
          </div>
        </div>
      </div>
    );
  }

  // If no current question, show loading or error with fixed dimensions
  if (!currentQuestion) {
    // Check if we have questions but they're just not loaded yet
    const hasQuestions = sessionQuestions.length > 0;
    
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
                  We're having trouble loading questions for this stitch. Please try a different tube.
                </div>
                <button
                  onClick={() => {
                    window.location.reload(); // Simple refresh to retry
                  }}
                  className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                >
                  Try Again
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
        
        {/* Footer area with enhanced Finish button - fixed height to prevent layout shifts */}
        <div className="bg-white bg-opacity-10 h-12 flex justify-center items-center">
          <button
            onClick={handleEndSession}
            className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-1.5 px-4 rounded-lg transition-colors text-sm focus:outline-none"
          >
            Finish
          </button>
        </div>
      </div>
    </div>
  );
};

export default TubeStitchPlayer;