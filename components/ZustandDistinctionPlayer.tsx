/**
 * ZustandDistinctionPlayer
 * 
 * A new implementation of MinimalDistinctionPlayer that uses Zustand for state management
 * and the new content fetching hooks to eliminate dependency on bundled content.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Question } from '../lib/types/distinction-learning';
import { calculateBonuses, calculateTotalPoints, calculateBasePoints } from '../lib/bonusCalculator';
import { useZenjinStore } from '../lib/store/zenjinStore';
import { useStitchContent } from '../lib/hooks/useStitchContent';

interface ZustandDistinctionPlayerProps {
  stitchId: string;
  tubeNumber?: 1 | 2 | 3;
  onComplete: (results: any) => void;
  onEndSession?: (results: any) => void;
  questionsPerSession?: number;
  sessionTotalPoints?: number;
  userId?: string;
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

const ZustandDistinctionPlayer: React.FC<ZustandDistinctionPlayerProps> = ({
  stitchId,
  tubeNumber,
  onComplete,
  onEndSession,
  questionsPerSession = 10,
  sessionTotalPoints = 0,
  userId,
}) => {
  // Initialize Next.js router for client-side navigation
  const router = useRouter();

  // Use the Zustand store hooks
  const { stitch, loading: stitchLoading, error: stitchError } = useStitchContent(stitchId);
  const incrementPoints = useZenjinStore(state => state.incrementPoints);
  const recordStitchInteraction = useZenjinStore(state => state.recordStitchInteraction);
  
  // Create explicit fallbacks for all session context functions we might need
  const dummySessionState = { questionResults: [], points: 0 };
  
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

  // Initialize questions for the session
  useEffect(() => {
    // Don't proceed if we don't have the stitch content yet
    if (!stitch || stitchLoading) {
      return;
    }

    console.log(`Initializing ZustandDistinctionPlayer with stitch ${stitch.id}`);

    // Reset state for the new stitch - but keep points and session results accumulated from previous stitches
    setCurrentQuestionIndex(0);
    setIsSessionComplete(false);

    // Stop any running animations/timers
    if (timerAnimation) {
      timerAnimation.cancel();
    }
    if (timerTimeoutRef.current) {
      clearTimeout(timerTimeoutRef.current);
      timerTimeoutRef.current = null;
    }

    // Make sure the stitch has questions
    if (!stitch.questions || stitch.questions.length === 0) {
      console.error(`Stitch ${stitch.id} has no questions`);
      return;
    }

    // Clone the questions array to avoid mutation issues
    const allQuestions = [...stitch.questions];
    console.log(`Stitch ${stitch.id} has ${allQuestions.length} questions`);

    // Shuffle all questions using URN randomness
    const shuffledQuestions = shuffleArray(allQuestions);

    // Take only the number we need for this session
    const sessionQs = shuffledQuestions.slice(0, Math.min(questionsPerSession, shuffledQuestions.length));
    console.log(`Using ${sessionQs.length} questions for session`);
    setSessionQuestions(sessionQs);

    // Start with the first question if we have any
    if (sessionQs.length > 0) {
      setIsInitialized(true);
      loadQuestion(sessionQs[0], false);
    } else {
      console.error("No questions available for this session!");
    }
  }, [stitch, stitchLoading, questionsPerSession, timerAnimation]);

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
      const options = [question.correctAnswer, question.distractors?.L1 || question.distractors?.[1] || "Error"];
      
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
    
    // Update points in real-time using Zustand store
    if (correct) {
      const pointsToAdd = !isReplayQuestion ? 3 : 1;
      setPoints(prev => prev + pointsToAdd);
      incrementPoints(pointsToAdd);
    }
    
    // Update stitch interaction in Zustand store
    if (stitchId && tubeNumber) {
      recordStitchInteraction(stitchId, correct, !isReplayQuestion && correct);
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
    incrementPoints,
    recordStitchInteraction,
    stitchId,
    tubeNumber
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
    console.log('🏁 Completing session in ZustandDistinctionPlayer');
    
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
    
    // Format results for API
    const apiResults = {
      sessionId: `session-${Date.now()}`,
      stitchId: stitchId,
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
    
    // Add a short delay before triggering completion to ensure smooth transitions
    // This prevents the flash of new content before navigation
    setTimeout(() => {
      onComplete(apiResults);
    }, 50);
    
  }, [sessionResults, points, stitchId, onComplete, timerAnimation]);

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
    console.log('📱 User clicked Finish button in ZustandDistinctionPlayer');
    
    // Clean up any outstanding timers or animations
    if (timerAnimation) {
      timerAnimation.cancel();
    }
    if (timerTimeoutRef.current) {
      clearTimeout(timerTimeoutRef.current);
      timerTimeoutRef.current = null;
    }

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
    
    // Check if user is anonymous
    const isAnonymous = !userId || userId.startsWith('anon-');
    
    // Prepare session data for bonus calculation
    const sessionData = {
      totalQuestions: currentSessionQuestions,
      totalAttempts: sessionResults.length,
      correctAnswers: currentSessionCorrectAnswers,
      firstTimeCorrect: currentSessionFirstTimeCorrect,
      averageTimeToAnswer: avgTime,
      sessionDuration,
      stitchId
    };
    
    // Calculate bonuses using the original logic for UI consistency
    const bonuses = calculateBonuses(sessionData, sessionResults, isAnonymous);
    const { totalPoints, multiplier } = calculateTotalPoints(basePoints, bonuses);
    
    // Use Zustand store to update points
    if (basePoints > 0) {
      incrementPoints(basePoints);
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
      stitchId,
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
            // Redirect anonymous users to anon-dashboard
            setTimeout(() => {
              router.push('/anon-dashboard');
            }, 100);
          } else {
            // For authenticated users, redirect to regular dashboard
            setTimeout(() => {
              router.push('/dashboard');
            }, 100);
          }
        } catch (error) {
          console.error('Error during session finish:', error);
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

  // If we're loading the stitch, show a loading state
  if (stitchLoading) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden fixed-player-card">
          <div className="bg-white bg-opacity-10 p-4 flex justify-between items-center">
            <div>
              <p className="text-white text-opacity-70 text-sm">POINTS</p>
              <p className="text-white text-2xl font-bold">-</p>
            </div>
            <div className="timer-container w-24"></div>
          </div>
          
          <div className="p-6 question-container flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="inline-block animate-spin h-8 w-8 border-4 border-teal-300 border-t-transparent rounded-full mb-3"></div>
              <p className="text-white text-opacity-70">Loading content...</p>
            </div>
          </div>
          
          <div className="bg-white bg-opacity-10 p-4"></div>
        </div>
      </div>
    );
  }

  // If there was an error loading the stitch, show an error state
  if (stitchError || !stitch) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden fixed-player-card">
          <div className="bg-white bg-opacity-10 p-4 flex justify-between items-center">
            <div>
              <p className="text-white text-opacity-70 text-sm">ERROR</p>
              <p className="text-white text-2xl font-bold">!</p>
            </div>
            <div className="timer-container w-24"></div>
          </div>
          
          <div className="p-6 question-container flex flex-col items-center justify-center">
            <div className="text-red-400 text-xl font-bold mb-4">Failed to load content</div>
            <p className="text-white text-opacity-70 text-center mb-6">
              {stitchError ? stitchError.message : `Content for stitch ID "${stitchId}" not found`}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
          
          <div className="bg-white bg-opacity-10 p-4"></div>
        </div>
      </div>
    );
  }

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
    const hasQuestions = stitch?.questions?.length > 0;
    
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
                  This stitch doesn't have any questions. Please try another stitch.
                </div>
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
                    const questionText = currentQuestion.text || currentQuestion.questionText;
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
                  {currentQuestion.text || currentQuestion.questionText}
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

export default ZustandDistinctionPlayer;