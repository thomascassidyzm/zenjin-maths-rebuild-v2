import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Thread, Question } from '../lib/types/distinction-learning';
import BackgroundBubbles from './BackgroundBubbles';

interface DistinctionPlayerProps {
  thread: Thread;
  onComplete: (results: any) => void;
  onEndSession?: (results: any) => void; // Optional callback for when user manually ends session
  questionsPerSession?: number;
  sessionTotalPoints?: number; // Optional total points accumulated across the session
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

// Using the shared BackgroundBubbles component now imported at the top of the file

const DistinctionPlayer: React.FC<DistinctionPlayerProps> = ({
  thread,
  onComplete,
  onEndSession,
  questionsPerSession = 10,
  sessionTotalPoints = 0,
}) => {
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
    if (thread && thread.stitches && thread.stitches.length > 0) {
      console.log(`Initializing with thread ${thread.id}, stitch ${thread.stitches[0].id}`);
      
      // Reset state for the new thread/stitch
      setCurrentQuestionIndex(0);
      setSessionResults([]);
      setPoints(0);
      setIsSessionComplete(false);
      
      // Stop any running animations/timers
      if (timerAnimation) {
        timerAnimation.cancel();
      }
      if (timerTimeoutRef.current) {
        clearTimeout(timerTimeoutRef.current);
        timerTimeoutRef.current = null;
      }
      
      const stitch = thread.stitches[0]; // Use first stitch for now
      
      // Always ensure the stitch has a questions array
      if (!stitch.questions) {
        stitch.questions = [];
      }
      
      // Check if the questions array has valid questions
      // NOTE: This is a safety measure - the questions should already be properly formatted in working-player.tsx
      const validQuestions = stitch.questions.filter(q => (
        q.text && q.correctAnswer && q.distractors && 
        q.distractors.L1 && q.distractors.L2 && q.distractors.L3
      ));
      
      if (validQuestions.length === 0) {
        console.error(`No valid questions found for stitch ${stitch.id} in thread ${thread.id}`);
        
        // Create sample questions only if there are no valid formatted questions
        console.log("Creating sample questions since no valid questions were found");
        
        const mathOperations = ['+', '-', '×', '÷'];
        const sampleQuestions = [];
        
        // Generate 10 sample math questions
        for (let i = 1; i <= 10; i++) {
          const op = mathOperations[i % 4];
          let num1 = Math.floor(Math.random() * 10) + 1;
          let num2 = Math.floor(Math.random() * 10) + 1;
          let correctAnswer = '';
          let incorrectAnswers = [];
          
          // Ensure division problems have clean answers
          if (op === '÷') {
            num2 = Math.floor(Math.random() * 5) + 1; // 1-5
            num1 = num2 * (Math.floor(Math.random() * 5) + 1); // Ensure divisible
          }
          
          // Calculate correct answer
          switch (op) {
            case '+': correctAnswer = String(num1 + num2); break;
            case '-': correctAnswer = String(num1 - num2); break;
            case '×': correctAnswer = String(num1 * num2); break;
            case '÷': correctAnswer = String(num1 / num2); break;
          }
          
          // Generate wrong answers close to correct one
          const correctNum = Number(correctAnswer);
          incorrectAnswers = [
            String(correctNum + 1),
            String(correctNum - 1),
            String(correctNum + 2)
          ];
          
          sampleQuestions.push({
            id: `${stitch.id}-q${i}`,
            text: `${num1} ${op} ${num2}`,
            correctAnswer: correctAnswer,
            distractors: {
              L1: incorrectAnswers[0],
              L2: incorrectAnswers[1],
              L3: incorrectAnswers[2]
            }
          });
        }
        
        // Set the questions on the stitch
        stitch.questions = sampleQuestions;
        console.log(`Created ${sampleQuestions.length} sample questions for stitch`);
      } else {
        console.log(`Using ${validQuestions.length} valid existing questions from database for stitch ${stitch.id}`);
        stitch.questions = validQuestions;
      }
      
      // Clone the questions array to avoid mutation issues
      let allQuestions = [...stitch.questions];
      
      // Double-check we have questions
      if (allQuestions.length === 0) {
        console.warn("Still no questions available after attempted initialization");
        return; // Exit early - will show the "no questions" UI
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
    }
  }, [thread, questionsPerSession]);

  // Ensure timer starts immediately after component mounts and questions are loaded
  useEffect(() => {
    // Only start timer when both are true and we're not timing out
    if (isInitialized && currentQuestion && !isTimingOut) {
      const timeoutId = setTimeout(() => {
        startTimer();
      }, 200); // Slightly longer delay to ensure DOM is ready
      
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

  // Load a question and setup options
  const loadQuestion = useCallback((question: Question, isReplay: boolean) => {
    // Reset state for new question
    setSelectedOption(null);
    setIsCorrect(null);
    setShowCorrectEquation(false);
    setCurrentQuestion(question); // Always set this first
    setIsReplayQuestion(isReplay);
    
    // Update repeat count for question
    if (isReplay) {
      setQuestionRepeatCount(prev => prev + 1);
    } else {
      setQuestionRepeatCount(0);
    }
    
    // Create options array with correct answer and distractor
    const options = [question.correctAnswer, question.distractors.L1];
    
    // Shuffle options
    setOptions(shuffleArray(options));
    
    // Start timer for this question
    setQuestionStartTime(Date.now());
    
    // Wait until UI has updated before starting the timer
    setIsTimingOut(false);
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
    
    // Update points
    if (correct) {
      // First time correct gets 3 points, replay gets 1 point
      const pointsToAdd = !isReplayQuestion ? 3 : 1;
      setPoints(prev => prev + pointsToAdd);
    }
    
    // Update session results
    const result = {
      id: currentQuestion.id,
      correct,
      timeToAnswer: answerTime,
      firstTimeCorrect: !isReplayQuestion && correct,
    };
    
    setSessionResults(prev => [...prev, result]);
    
    // After a delay, either move to next question or replay current
    setTimeout(() => {
      // Avoid doing this if the component is unmounting
      if (!currentQuestionRef.current) return;
      
      if (!correct) {
        // Replay the question after incorrect answer with a stable reference
        loadQuestion(currentQuestion, true);
      } else {
        moveToNextQuestion();
      }
    }, 1500);
  }, [
    currentQuestion, 
    selectedOption, 
    questionStartTime, 
    isReplayQuestion, 
    loadQuestion, 
    timerAnimation, 
    isTimingOut
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
      
      // Use a moderate delay that balances showing feedback and keeping transitions smooth
      // Reduced from 1500ms to 800ms for quicker transitions while still showing feedback
      setTimeout(() => {
        console.log('Session questions completed, finalizing session...');
        completeSession();
      }, 800); // Shorter delay for smoother transitions while still showing feedback
    }
  }, [currentQuestionIndex, sessionQuestions, loadQuestion]);

  // Complete the session and report results - ENHANCED TO PREVENT FLICKER
  const completeSession = useCallback(() => {
    // Clean up any outstanding timers or animations
    if (timerAnimation) {
      timerAnimation.cancel();
    }
    if (timerTimeoutRef.current) {
      clearTimeout(timerTimeoutRef.current);
      timerTimeoutRef.current = null;
    }
    
    // CRITICAL ANTI-FLICKER FIX:
    // Calculate results before showing completion state
    // to ensure we have everything ready before any UI changes
    
    // Calculate aggregate statistics
    const totalQuestions = new Set(sessionResults.map(r => r.id)).size;
    const correctResults = sessionResults.filter(r => r.correct);
    const correctAnswers = correctResults.length;
    const firstTimeCorrect = sessionResults.filter(r => r.firstTimeCorrect).length;
    const accuracy = (correctAnswers / sessionResults.length) * 100;
    
    // Calculate average time for correctly answered questions
    const totalCorrectTime = correctResults.reduce((sum, r) => sum + r.timeToAnswer, 0);
    const averageTime = correctAnswers > 0 ? totalCorrectTime / correctAnswers : 0;
    
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
      totalPoints: points,
      results: sessionResults,
      completedAt: new Date().toISOString(),
    };
    
    console.log('Results prepared, preparing for transition...');
    
    // ULTRA-SMOOTH TRANSITION SEQUENCE FOR SEAMLESS TUBE CYCLING:
    // 1. Set completion state first with a transition indicator that precisely
    //    matches the layout and dimensions of the regular player card
    setIsSessionComplete(true);
    
    // 2. Use an extremely minimal delay - just enough to ensure React rendering occurs
    //    but fast enough to make the transition appear nearly instantaneous
    setTimeout(() => {
      console.log('Sending session completion results with seamless card-only transition');
      // 3. Call onComplete with results - the parent component will handle the transition
      //    without affecting any other part of the page
      onComplete(apiResults);
    }, 30); // Ultra-minimal delay for near-instant transition
    
  }, [sessionResults, points, thread, onComplete, timerAnimation]);

  // Handle ending session early
  const handleEndSession = () => {
    // Clean up any outstanding timers or animations
    if (timerAnimation) {
      timerAnimation.cancel();
    }
    if (timerTimeoutRef.current) {
      clearTimeout(timerTimeoutRef.current);
      timerTimeoutRef.current = null;
    }
    
    // Calculate simplified results to pass to the onEndSession callback
    const stats = {
      sessionId: `session-${Date.now()}`,
      threadId: thread.id,
      stitchId: thread.stitches[0].id,
      totalQuestions: new Set(sessionResults.map(r => r.id)).size,
      totalAttempts: sessionResults.length,
      correctAnswers: sessionResults.filter(r => r.correct).length,
      firstTimeCorrect: sessionResults.filter(r => r.firstTimeCorrect).length,
      totalPoints: points,
      results: sessionResults,
      completedAt: new Date().toISOString()
    };
    
    // If onEndSession is provided, call it instead of regular completion
    if (onEndSession) {
      console.log('Using onEndSession callback for manual session ending');
      onEndSession(stats);
    } else {
      // Fallback to regular completion if onEndSession not provided
      completeSession();
    }
  };

  // If session is complete, show an ultra-minimal transition indicator
  // Using an even more contained and subtle approach that stays within the card boundaries
  // and preserves exact card dimensions for zero layout shift
  if (isSessionComplete) {
    // We don't need to calculate stats here since we've already done it in completeSession
    // This is just a minimal visual indicator during transition
    
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <BackgroundBubbles />
        
        {/* CRITICAL: Maintain EXACT same dimensions and structure as the normal player card */}
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden fixed-player-card">
          {/* Preserve header with empty content to maintain exact layout */}
          <div className="bg-white bg-opacity-10 p-4 flex justify-between items-center opacity-30">
            <div className="flex space-x-6">
              <div>
                <p className="text-white text-opacity-70 text-sm">STITCH</p>
                <p className="text-white text-2xl font-bold">-</p>
              </div>
              <div>
                <p className="text-white text-opacity-70 text-sm">SESSION</p>
                <p className="text-white text-2xl font-bold text-teal-300">-</p>
              </div>
            </div>
            <div className="timer-container w-24"></div>
          </div>
          
          {/* Main content area with spinner - use the same question-container class for consistent height */}
          <div className="p-6 question-container flex items-center justify-center">
            <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-300 border-t-blue-100 rounded-full opacity-70"></div>
          </div>
          
          {/* Footer for consistent height */}
          <div className="bg-white bg-opacity-10 p-4 opacity-30"></div>
        </div>
      </div>
    );
  }

  // If no current question, show loading or error
  if (!currentQuestion) {
    // Check if we have questions but they're just not loaded yet
    const hasQuestions = thread?.stitches?.[0]?.questions?.length > 0;
    
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <BackgroundBubbles />
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden fixed-player-card">
          {/* Header for consistent layout */}
          <div className="bg-white bg-opacity-10 p-4 flex justify-between items-center opacity-30">
            <div className="flex space-x-6">
              <div>
                <p className="text-white text-opacity-70 text-sm">STITCH</p>
                <p className="text-white text-2xl font-bold">-</p>
              </div>
              <div>
                <p className="text-white text-opacity-70 text-sm">SESSION</p>
                <p className="text-white text-2xl font-bold text-teal-300">-</p>
              </div>
            </div>
            <div className="timer-container w-24"></div>
          </div>
          
          {/* Main content area with consistent layout */}
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
          <div className="bg-white bg-opacity-10 p-4 opacity-30"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen player-bg flex items-center justify-center p-4">
      <BackgroundBubbles />
      
      {/* Fixed width/height container similar to iPhone 8 dimensions */}
      <div 
        ref={questionCardRef}
        className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden fixed-player-card"
      >
        {/* Points display */}
        <div className="bg-white bg-opacity-10 p-3 flex justify-between items-center">
          <div className="flex space-x-6">
            <div>
              <p className="text-white text-opacity-70 text-sm">STITCH</p>
              <p className="text-white text-2xl font-bold">{points}</p>
            </div>
            <div>
              <p className="text-white text-opacity-70 text-sm">SESSION</p>
              <p className="text-white text-2xl font-bold text-teal-300">{sessionTotalPoints + points}</p>
            </div>
          </div>
          
          {/* Timer - fixed width regardless of orientation */}
          <div className="timer-container w-24">
            <div 
              ref={timerRef}
              className="timer-fill"
            />
          </div>
        </div>
        
        {/* Main question area with fixed height */}
        <div className="p-6 question-container">
          {/* Question display */}
          <div className="mb-8 text-center">
            {/* If showing correct answer after mistake/timeout, show it in the black pill */}
            {showCorrectEquation ? (
              <div className="question-pill text-2xl py-3 px-6">
                {currentQuestion.text} = {currentQuestion.correctAnswer}
              </div>
            ) : (
              <h2 className="text-white text-3xl font-bold">
                {currentQuestion.text}
              </h2>
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
        
        {/* Footer area */}
        <div className="bg-white bg-opacity-10 p-3 flex justify-end">
          <button
            onClick={handleEndSession}
            className="text-white text-opacity-70 hover:text-opacity-100 text-sm focus:outline-none transition-colors"
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default DistinctionPlayer;