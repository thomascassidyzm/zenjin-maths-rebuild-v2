import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

// Import the StateMachine adapter
const StateMachineTubeCyclerAdapter = require('../lib/adapters/StateMachineTubeCyclerAdapter');

/**
 * Triple-Helix Fixed Player
 * 
 * A properly implemented version of the Triple-Helix player using the exact same logic as the simulator.
 * This fixes:
 * 1. The double rotation bug
 * 2. The stitch advancement failure after perfect scores
 * 3. Uses the correct "rotating stage" approach where tubes rotate first, then stitch completion is processed
 * 4. Uses the proper skip number sequence [1, 3, 5, 10, 25, 100]
 */
export default function TripleHelixFixed() {
  const router = useRouter();
  
  // State for Triple-Helix system
  const [tubeCycler, setTubeCycler] = useState(null);
  const [state, setState] = useState(null);
  const [currentTube, setCurrentTube] = useState(1);
  const [currentStitch, setCurrentStitch] = useState(null);
  const [tubeStitches, setTubeStitches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for player
  const [questionPool, setQuestionPool] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(100);
  
  // Session state
  const [questionsCompleted, setQuestionsCompleted] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [stitchPoints, setStitchPoints] = useState(0);
  
  // Transition state
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // References
  const timerRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const transitionTimeoutRef = useRef(null);
  
  // Constants
  const QUESTIONS_PER_SESSION = 20;
  const QUESTION_TIME_LIMIT = 5000; // 5 seconds
  
  // State change handler for StateMachine
  const handleStateChange = (newState) => {
    setState(newState);
    setCurrentTube(newState.activeTubeNumber);
    
    // Update current stitch display
    if (tubeCycler) {
      setCurrentStitch(tubeCycler.getCurrentStitch());
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
    }
  };
  
  // Tube change handler for StateMachine
  const handleTubeChange = (tubeNumber) => {
    setCurrentTube(tubeNumber);
    console.log(`Active tube changed to ${tubeNumber}`);
    
    // Update stitches for this tube
    if (tubeCycler) {
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
    }
  };
  
  // Initialize the adapter and fetch data
  useEffect(() => {
    async function initialize() {
      try {
        // Get user ID from URL or use anonymous
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId') || 'anonymous';
        
        console.log('Initializing Triple-Helix Fixed Player for user:', userId);
        
        // Fetch initial state from server
        const response = await fetch(`/api/user-stitches?userId=${userId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch user stitches: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
          throw new Error('Failed to load user data');
        }
        
        // Extract threads, stitches, and tube position
        const threadsWithStitches = data.data;
        const lastTubePosition = data.tubePosition;
        
        // Create adapter with initial state
        const initialState = {
          userId,
          activeTubeNumber: lastTubePosition?.tubeNumber || 1,
          tubes: {}
        };
        
        // Process thread data and prepare for StateMachine
        threadsWithStitches.forEach(threadData => {
          const threadId = threadData.thread_id;
          const tubeNumber = threadData.tube_number || 1; // Default to tube 1 if not specified
          
          // Convert stitches format from server to StateMachine format
          const stitches = threadData.stitches.map(stitch => ({
            id: stitch.id,
            threadId: threadId,
            content: stitch.content || `Content for stitch ${stitch.id}`,
            position: stitch.order_number || 0,
            skipNumber: stitch.skip_number || 1,
            distractorLevel: stitch.distractor_level || 'L1',
            completed: false,
            score: 0,
            questions: stitch.questions || []
          }));
          
          // Find current stitch
          const activeStitch = stitches.find(s => s.position === 0);
          
          // Initialize tube with thread data
          initialState.tubes[tubeNumber] = {
            threadId,
            currentStitchId: activeStitch ? activeStitch.id : (stitches.length > 0 ? stitches[0].id : null),
            stitches
          };
        });
        
        // Create a new adapter with the prepared state
        const adapter = new StateMachineTubeCyclerAdapter({
          userId,
          initialState,
          onStateChange: handleStateChange,
          onTubeChange: handleTubeChange
        });
        
        // Set the adapter in state
        setTubeCycler(adapter);
        
        // Initialize UI state from adapter
        setState(adapter.getState());
        setCurrentTube(adapter.getCurrentTube());
        setCurrentStitch(adapter.getCurrentStitch());
        setTubeStitches(adapter.getCurrentTubeStitches());
        
        // Prepare questions from current stitch
        const stitch = adapter.getCurrentStitch();
        if (stitch && stitch.questions && stitch.questions.length > 0) {
          prepareQuestionPool(stitch.questions);
        } else {
          // Generate sample questions if none exist
          const sampleQuestions = generateSampleQuestions(20, stitch?.id || 'unknown');
          if (stitch) {
            stitch.questions = sampleQuestions;
          }
          prepareQuestionPool(sampleQuestions);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Initialization error:', error);
        setIsLoading(false);
      }
    }
    
    initialize();
    
    // Cleanup 
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);
  
  // Prepare question pool from stitch
  const prepareQuestionPool = (questions) => {
    // Shuffle questions
    const shuffled = shuffleArray([...questions]);
    setQuestionPool(shuffled);
    setCurrentQuestionIndex(0);
    
    // Load first question
    if (shuffled.length > 0) {
      loadQuestion(shuffled[0]);
    }
  };
  
  // Load a question
  const loadQuestion = (question) => {
    setCurrentQuestion(question);
    setSelectedOption(null);
    setIsCorrect(null);
    setShowCorrectAnswer(false);
    setTimeRemaining(100);
    
    // Prepare answer options
    const correctAnswer = question.correctAnswer;
    const distractorLevel = currentStitch?.distractorLevel || 'L1';
    const distractor = question.distractors[distractorLevel] || question.distractors.L1;
    
    // Create and shuffle options
    setOptions(shuffleArray([correctAnswer, distractor]));
    
    // Start timer
    startTimer();
  };
  
  // Start timer for question
  const startTimer = () => {
    // Clear any existing timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    const startTime = Date.now();
    
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / QUESTION_TIME_LIMIT) * 100);
      
      setTimeRemaining(remaining);
      
      if (remaining <= 0) {
        // Time's up
        clearInterval(timerIntervalRef.current);
        handleTimeout();
      }
    }, 100);
  };
  
  // Handle timeout (no answer selected)
  const handleTimeout = () => {
    if (selectedOption !== null) return;
    
    setSelectedOption('timeout');
    setIsCorrect(false);
    setShowCorrectAnswer(true);
    
    // Track questions completed
    setQuestionsCompleted(prev => prev + 1);
    
    // Move to next question after delay
    transitionTimeoutRef.current = setTimeout(() => {
      if (questionsCompleted + 1 >= QUESTIONS_PER_SESSION) {
        // Session complete - process
        completeStitchSession();
      } else {
        // Move to next question
        const nextIndex = (currentQuestionIndex + 1) % questionPool.length;
        setCurrentQuestionIndex(nextIndex);
        loadQuestion(questionPool[nextIndex]);
      }
    }, 1500);
  };
  
  // Handle option selection
  const handleOptionSelect = (option) => {
    // Prevent multiple selections or selection during transition
    if (selectedOption !== null || isTransitioning) return;
    
    // Stop timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    const isAnswerCorrect = option === currentQuestion.correctAnswer;
    setSelectedOption(option);
    setIsCorrect(isAnswerCorrect);
    
    // If incorrect, show correct answer
    if (!isAnswerCorrect) {
      setShowCorrectAnswer(true);
    }
    
    // Update score
    if (isAnswerCorrect) {
      setStitchPoints(prev => prev + 3); // 3 points for correct answer
      setCorrectAnswers(prev => prev + 1);
    }
    
    // Track questions completed
    setQuestionsCompleted(prev => prev + 1);
    
    // Move to next question after delay
    transitionTimeoutRef.current = setTimeout(() => {
      if (questionsCompleted + 1 >= QUESTIONS_PER_SESSION) {
        // Session complete - process
        completeStitchSession();
      } else {
        // Move to next question
        const nextIndex = (currentQuestionIndex + 1) % questionPool.length;
        setCurrentQuestionIndex(nextIndex);
        loadQuestion(questionPool[nextIndex]);
      }
    }, 1500);
  };
  
  // Complete the stitch session and process with Triple-Helix approach
  const completeStitchSession = () => {
    console.log('Session completed');
    setIsTransitioning(true);
    
    // Update total points
    setTotalPoints(prev => prev + stitchPoints);
    
    // Check for perfect score
    const isPerfectScore = correctAnswers === QUESTIONS_PER_SESSION;
    
    // CRITICAL: Key Triple-Helix Process
    // 1. First rotate to the next tube (rotating stage concept)
    console.log('Starting tube rotation and stitch processing...');
    
    setTimeout(() => {
      // Rotate to next tube first
      console.log('Step 1: Rotating to next tube');
      tubeCycler.nextTube();
      
      // Then, process the stitch completion in the previous tube
      setTimeout(() => {
        // This is the key part that matches the simulator
        console.log('Step 2: Processing stitch completion');
        tubeCycler.handleStitchCompletion(
          currentStitch.threadId,
          currentStitch.id,
          correctAnswers,  // Score
          QUESTIONS_PER_SESSION  // Total questions
        );
        
        // Reset for next session
        setQuestionsCompleted(0);
        setCorrectAnswers(0);
        setStitchPoints(0);
        
        // Update UI with new stitch
        const newStitch = tubeCycler.getCurrentStitch();
        setCurrentStitch(newStitch);
        
        // Prepare question pool for new stitch
        if (newStitch) {
          if (newStitch.questions && newStitch.questions.length > 0) {
            prepareQuestionPool(newStitch.questions);
          } else {
            // Generate sample questions if none exist
            const sampleQuestions = generateSampleQuestions(20, newStitch.id);
            newStitch.questions = sampleQuestions;
            prepareQuestionPool(sampleQuestions);
          }
        }
        
        // Persist state to server
        persistStateToServer();
        
        setIsTransitioning(false);
      }, 500); // Process completion after rotation to match simulator
    }, 800); // First rotate, then process
  };
  
  // Persist state to server
  const persistStateToServer = async () => {
    if (!tubeCycler) return;
    
    try {
      const currentState = tubeCycler.getState();
      
      // First persist tube position
      await fetch('/api/save-tube-position', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentState.userId,
          tubeNumber: currentStitch.tubeNumber,
          threadId: currentStitch.threadId
        })
      });
      
      // Then persist session results
      await fetch('/api/save-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentState.userId,
          threadId: currentStitch.threadId,
          stitchId: currentStitch.id,
          score: correctAnswers,
          totalQuestions: QUESTIONS_PER_SESSION,
          points: stitchPoints
        })
      });
      
      console.log('State persisted to server');
    } catch (error) {
      console.error('Error persisting state:', error);
    }
  };
  
  // Generate sample questions for a stitch
  const generateSampleQuestions = (count, id) => {
    const mathOperations = ['+', '-', '×', '÷'];
    const questions = [];
    
    for (let i = 1; i <= count; i++) {
      const op = mathOperations[(i - 1) % 4];
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
      
      questions.push({
        id: `q-${id}-${i}`,
        text: `${num1} ${op} ${num2}`,
        correctAnswer: correctAnswer,
        distractors: {
          L1: incorrectAnswers[0],
          L2: incorrectAnswers[1],
          L3: incorrectAnswers[2]
        }
      });
    }
    
    return questions;
  };
  
  // Utility: Shuffle array
  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };
  
  // Create background bubbles
  const BackgroundBubbles = () => {
    const bubbles = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      size: Math.floor(Math.random() * 80) + 20, // 20-100px
      left: `${Math.random() * 100}%`,
      delay: Math.random() * 15,
      duration: (Math.random() * 20 + 15) * 0.5, // 7.5-17.5s
    }));
  
    return (
      <>
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className="absolute rounded-full bg-white bg-opacity-10"
            style={{
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              left: bubble.left,
              bottom: '-100px',
              animationDelay: `${bubble.delay}s`,
              animationDuration: `${bubble.duration}s`,
              animationName: 'bubble-rise',
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear',
            }}
          />
        ))}
      </>
    );
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-indigo-700 text-white">
      <Head>
        <title>Triple-Helix Fixed Player</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style jsx global>{`
          @keyframes bubble-rise {
            0% {
              bottom: -100px;
              opacity: 0;
            }
            20% {
              opacity: 0.2;
            }
            40% {
              opacity: 0.4;
            }
            60% {
              opacity: 0.2;
            }
            80% {
              opacity: 0.1;
            }
            100% {
              bottom: 100%;
              opacity: 0;
            }
          }
          
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
          }
          
          .shake {
            animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
          }
        `}</style>
      </Head>
      
      {/* Bubble background */}
      <div className="fixed inset-0 overflow-hidden z-0">
        <BackgroundBubbles />
      </div>
      
      {/* Tube indicator */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 backdrop-blur-md rounded-full py-2 px-6 flex gap-6 z-10">
        {[1, 2, 3].map(tubeNum => (
          <div key={tubeNum} className={`flex items-center gap-2 ${currentTube === tubeNum ? 'text-teal-400' : 'text-white text-opacity-50'}`}>
            <div className={`w-3 h-3 rounded-full ${currentTube === tubeNum ? 'bg-teal-400' : 'bg-white bg-opacity-30'}`}></div>
            <span className="text-sm font-medium">Tube {tubeNum}</span>
          </div>
        ))}
      </div>
      
      <div className="container mx-auto px-4 py-20">
        {isLoading ? (
          <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-xl p-8 text-center max-w-lg mx-auto">
            <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
            <p>Loading Triple-Helix Fixed Player...</p>
          </div>
        ) : isTransitioning ? (
          <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-xl p-8 text-center max-w-lg mx-auto">
            <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
            <p>Moving to next stitch...</p>
          </div>
        ) : (
          <div className="max-w-md mx-auto bg-white bg-opacity-10 backdrop-blur-lg rounded-xl overflow-hidden shadow-lg">
            {/* Player Header */}
            <div className="bg-black bg-opacity-10 p-4 flex justify-between items-center">
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-white text-opacity-70">STITCH</p>
                  <p className="text-xl font-bold text-white">{stitchPoints}</p>
                </div>
                <div>
                  <p className="text-xs text-white text-opacity-70">SESSION</p>
                  <p className="text-xl font-bold text-teal-300">{totalPoints + stitchPoints}</p>
                </div>
              </div>
              
              {/* Timer */}
              <div className="w-24 h-2 bg-white bg-opacity-10 rounded overflow-hidden">
                <div 
                  ref={timerRef}
                  className="h-full bg-teal-400 rounded transition-all" 
                  style={{ width: `${timeRemaining}%` }}
                ></div>
              </div>
            </div>
            
            {/* Question Area */}
            <div className="p-6">
              <div className="mb-8 text-center">
                {showCorrectAnswer ? (
                  <div className="inline-block bg-black bg-opacity-70 text-white text-2xl font-bold py-3 px-6 rounded-full">
                    {currentQuestion?.text} = {currentQuestion?.correctAnswer}
                  </div>
                ) : (
                  <h2 className="text-white text-3xl font-bold">
                    {currentQuestion?.text}
                  </h2>
                )}
              </div>
              
              {/* Options */}
              <div className="flex flex-col gap-4">
                {options.map((option, index) => (
                  <button
                    key={`${option}-${index}`}
                    onClick={() => handleOptionSelect(option)}
                    disabled={selectedOption !== null}
                    className={`
                      h-16 rounded-full font-bold text-2xl transition-all
                      ${selectedOption === option && isCorrect ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : ''}
                      ${selectedOption === option && !isCorrect ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : ''}
                      ${selectedOption !== null && selectedOption !== option ? 'bg-white bg-opacity-10 text-white text-opacity-50' : ''}
                      ${selectedOption !== null && option === currentQuestion?.correctAnswer && !isCorrect ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : ''}
                      ${selectedOption === null ? 'bg-white text-gray-800 hover:shadow-lg' : ''}
                    `}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Footer Area */}
            <div className="bg-black bg-opacity-10 p-4 flex justify-between items-center">
              <div className="text-sm text-white text-opacity-70">
                Question {questionsCompleted + 1} of {QUESTIONS_PER_SESSION}
              </div>
              
              <div className="w-32 h-1 bg-white bg-opacity-10 rounded overflow-hidden">
                <div 
                  className="h-full bg-teal-400 rounded" 
                  style={{ width: `${(questionsCompleted / QUESTIONS_PER_SESSION) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
        
        {/* If not in a session, show button to go back to home */}
        {!isLoading && !currentQuestion && (
          <div className="text-center mt-8">
            <a 
              href="/"
              className="bg-white bg-opacity-10 hover:bg-opacity-20 px-4 py-2 rounded-lg transition-colors inline-block"
            >
              Back to Home
            </a>
          </div>
        )}
      </div>
    </div>
  );
}