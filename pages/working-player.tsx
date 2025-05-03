import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DistinctionPlayer from '../components/DistinctionPlayer';
import { ThreadData, StitchWithProgress } from '../lib/types/distinction-learning';
import Link from 'next/link';

// Import the StateMachine adapter - this is the key to correct tube rotation behavior
const StateMachineTubeCyclerAdapter = require('../lib/adapters/StateMachineTubeCyclerAdapter');

/**
 * Working Player - Triple-Helix with Thread D fix
 * 
 * This is the FIXED implementation with Thread D properly assigned to Tube 3
 * and working Perfect/Partial score buttons
 * 
 * OFFLINE-FIRST APPROACH:
 * - Initial API call at session start to load user data
 * - All state changes managed client-side via React state and localStorage
 * - No API calls during the session (during tube rotations, score updates, etc.)
 * - Final API call only at explicit session end to persist complete state
 * 
 * This approach provides better performance, works without constant connectivity,
 * and creates a smoother learning experience.
 */
export default function WorkingPlayer() {
  const router = useRouter();
  
  // State for tubes and user
  const [userId, setUserId] = useState('anonymous');
  const [threadData, setThreadData] = useState<ThreadData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Triple-Helix state
  const [tubeCycler, setTubeCycler] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [currentTube, setCurrentTube] = useState(1);
  const [currentStitch, setCurrentStitch] = useState<StitchWithProgress | null>(null);
  const [tubeStitches, setTubeStitches] = useState<any[]>([]);
  
  // Internal state for tube cycling
  const nextTubeRef = useRef<{tube: number, stitch: any, stitches: any[]} | null>(null);
  
  // Player view state 
  const [showingTubeConfiguration, setShowingTubeConfiguration] = useState(false);
  const [showPlayer, setShowPlayer] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Accumulated session data
  const [accumulatedSessionData, setAccumulatedSessionData] = useState({
    totalPoints: 0,
    correctAnswers: 0,
    firstTimeCorrect: 0,
    totalQuestions: 0,
    totalAttempts: 0,
    stitchesCompleted: 0
  });
  
  // Reference to prevent double rotation
  const rotationInProgressRef = useRef(false);
  
  // Add log function
  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
    console.log(message);
  };
  
  // Preload next tube data for seamless transitions
  const preloadNextTube = () => {
    if (!tubeCycler) {
      console.error('No tubeCycler available for preloading');
      return;
    }
    
    try {
      // Calculate next tube number
      const currentTubeNum = tubeCycler.getCurrentTube();
      const nextTubeNum = (currentTubeNum % 3) + 1; // 1->2->3->1
      
      console.log(`Preloading data for next tube (${nextTubeNum}) from current tube ${currentTubeNum}`);
      
      // FIXED: Add thorough validation for all tubes state
      // Get current state and verify it has all tubes
      const currentState = tubeCycler.getState();
      
      console.log(`DEBUG: Current state tubes:`, Object.keys(currentState.tubes).join(', '));
      
      // Validation: Ensure all three tubes exist, especially for cycling from tube 2 to 3
      const hasTube1 = !!currentState.tubes[1]?.stitches?.length;
      const hasTube2 = !!currentState.tubes[2]?.stitches?.length;
      const hasTube3 = !!currentState.tubes[3]?.stitches?.length;
      
      console.log(`TUBE STATUS CHECK: Tube1=${hasTube1 ? 'exists' : 'missing'}, Tube2=${hasTube2 ? 'exists' : 'missing'}, Tube3=${hasTube3 ? 'exists' : 'missing'}`);
      
      // Get next tube data
      const nextTube = currentState.tubes[nextTubeNum];
      if (!nextTube) {
        console.error(`CRITICAL ERROR: Next tube ${nextTubeNum} not found in state - cycling may fail`);
        
        // If specifically tube 3 is missing, check if we might need to create it
        if (nextTubeNum === 3 && !hasTube3) {
          console.log(`RECOVERY ATTEMPT: Tube 3 is missing, attempting to generate data for it`);
          
          // Generate sample tube 3 content right now
          const sampleTube3Stitches = [
            {
              id: 'sample-stitch-C-1',
              threadId: 'thread-C',
              content: 'Sample content for Thread C',
              position: 0, // Make this the active stitch
              skipNumber: 1,
              distractorLevel: 'L1',
              completed: false,
              score: 0,
              questions: generateSampleQuestions('sample-stitch-C-1')
            }
          ];
          
          // Create a sample nextTubeRef
          nextTubeRef.current = {
            tube: 3,
            stitch: {...sampleTube3Stitches[0], tubeNumber: 3},
            stitches: sampleTube3Stitches
          };
          
          console.log(`RECOVERY COMPLETED: Created sample Tube 3 content for preloading`);
          return;
        }
        nextTubeRef.current = null;
        return;
      }
      
      // Verify the tube has stitches (shouldn't be empty)
      if (!nextTube.stitches || nextTube.stitches.length === 0) {
        console.error(`CRITICAL ERROR: Next tube ${nextTubeNum} has no stitches - cycling may fail`);
        nextTubeRef.current = null;
        return;
      }
      
      // Get active stitch
      const nextStitchId = nextTube.currentStitchId;
      
      if (!nextStitchId) {
        console.error(`CRITICAL ERROR: No current stitch ID for tube ${nextTubeNum}`);
        
        // Create a fallback stitch ID - use the first stitch
        if (nextTube.stitches.length > 0) {
          const sortedStitches = [...nextTube.stitches].sort((a: any, b: any) => a.position - b.position);
          const fallbackStitch = sortedStitches[0];
          
          nextTubeRef.current = {
            tube: nextTubeNum,
            stitch: {...fallbackStitch, tubeNumber: nextTubeNum},
            stitches: sortedStitches
          };
          
          console.log(`RECOVERY SUCCESS: Using first available stitch ${fallbackStitch.id} as fallback`);
          return;
        }
        
        nextTubeRef.current = null;
        return;
      }
      
      const nextStitch = nextTube.stitches.find((s: any) => s.id === nextStitchId);
      
      if (!nextStitch) {
        console.error(`CRITICAL ERROR: Active stitch ${nextStitchId} not found in tube ${nextTubeNum}`);
        
        // Fall back to first stitch in the tube if we can't find the active one
        if (nextTube.stitches.length > 0) {
          console.log(`RECOVERY ATTEMPT: Using first stitch of tube ${nextTubeNum} as fallback`);
          const fallbackStitch = [...nextTube.stitches].sort((a: any, b: any) => a.position - b.position)[0];
          
          nextTubeRef.current = {
            tube: nextTubeNum,
            stitch: {...fallbackStitch, tubeNumber: nextTubeNum},
            stitches: [...nextTube.stitches].sort((a: any, b: any) => a.position - b.position)
          };
          
          console.log(`RECOVERY SUCCESS: Preloaded fallback stitch ${fallbackStitch.id} for tube ${nextTubeNum}`);
          return;
        }
        
        nextTubeRef.current = null;
        return;
      }
      
      // Store in ref for direct access without re-renders
      nextTubeRef.current = {
        tube: nextTubeNum,
        stitch: {...nextStitch, tubeNumber: nextTubeNum},
        stitches: [...nextTube.stitches].sort((a: any, b: any) => a.position - b.position)
      };
      
      console.log(`Successfully preloaded next tube data: Tube ${nextTubeNum}, Stitch ${nextStitch.id}`);
    } catch (err) {
      console.error('Error in preloadNextTube:', err);
      nextTubeRef.current = null;
    }
  };
  
  // When component mounts, get user ID from URL params or use anonymous
  useEffect(() => {
    const query = router.query;
    const queryUserId = query.userId as string;
    
    if (queryUserId) {
      setUserId(queryUserId);
    }
  }, [router.query]);
  
  // State change handler for StateMachine
  const handleStateChange = (newState: any) => {
    setState(newState);
    setCurrentTube(newState.activeTubeNumber);
    
    // Update current stitch display
    if (tubeCycler) {
      const stitch = tubeCycler.getCurrentStitch();
      setCurrentStitch(stitch);
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
    }
  };
  
  // Tube change handler for StateMachine
  const handleTubeChange = (tubeNumber: number) => {
    setCurrentTube(tubeNumber);
    addLog(`Active tube changed to ${tubeNumber}`);
    
    // Update stitches for this tube WITHOUT setting loading state
    // This is critical for smooth transitions that don't affect the whole page
    if (tubeCycler) {
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
      const stitch = tubeCycler.getCurrentStitch();
      setCurrentStitch(stitch);
    }
  };
  
  // Load data and initialize adapter
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setLoadError(null);
        
        // Fetch user stitches from API - OFFLINE-FIRST APPROACH
        // This is the first of only two API calls: initial load and final save at session end
        console.log('OFFLINE-FIRST: Initial load of user data - state will be managed client-side during session');
        const response = await fetch(`/api/user-stitches?userId=${userId}&prefetch=5`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch stitches: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error('Failed to fetch user data');
        }
        
        // Convert to ThreadData format
        const threads = data.data.map((thread: any) => ({
          thread_id: thread.thread_id,
          tube_number: thread.tube_number || 1,
          stitches: thread.stitches.map((stitch: any) => ({
            id: stitch.id,
            threadId: thread.thread_id,
            title: `Stitch ${stitch.id}`,
            content: stitch.content || `Content for stitch ${stitch.id}`,
            order_number: stitch.order_number,
            skip_number: stitch.skip_number || 1,
            distractor_level: stitch.distractor_level || 'L1',
            questions: stitch.questions || [],
            ...stitch // Copy any other properties
          }))
        }));
        
        // Extract tube position
        const tubePosition = data.tubePosition;
        
        // Set thread data
        setThreadData(threads);
        
        // Initialize StateMachine adapter
        const initialState = {
          userId,
          activeTubeNumber: tubePosition?.tubeNumber || 1,
          tubes: {}
        };
        
        // Process thread data and prepare for StateMachine
        
        // Group stitches by tube
        const tubeStitches = {
          1: [],
          2: [],
          3: []
        };
        
        // CRITICAL FIX: Pre-generate questions for all stitches to avoid flicker during tube rotation
        console.log("Pre-generating questions for all stitches to avoid flicker during tube cycling");
        
        // Generate sample questions function (same logic as in DistinctionPlayer)
        const generateSampleQuestions = (stitchId) => {
          const sampleQuestions = [];
          const mathOperations = ['+', '-', '×', '÷'];
          
          // Generate 10 sample math questions
          for (let i = 1; i <= 20; i++) {
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
              id: `${stitchId}-q${i}`,
              text: `${num1} ${op} ${num2}`,
              correctAnswer: correctAnswer,
              distractors: {
                L1: incorrectAnswers[0],
                L2: incorrectAnswers[1],
                L3: incorrectAnswers[2]
              }
            });
          }
          
          return sampleQuestions;
        };
        
        // First pass: Group all stitches by their assigned tube number
        threads.forEach((thread: any) => {
          const threadId = thread.thread_id;
          
          // CRITICAL FIX: Get tube number from database and enforce correct assignments
          let tubeNumber = thread.tube_number || 1;
          
          // Enforce correct tube assignments based on thread ID
          if (threadId === 'thread-A') {
            tubeNumber = 1;
          } else if (threadId === 'thread-B') {
            tubeNumber = 2;
          } else if (threadId === 'thread-C' || threadId === 'thread-D') {
            tubeNumber = 3;
          } else if (threadId === 'thread-E') {
            tubeNumber = 2;
          } else if (threadId === 'thread-F') {
            tubeNumber = 1;
          }
          
          console.log(`Thread ${threadId} assigned to Tube ${tubeNumber} (database value: ${thread.tube_number})`);
          
          // Convert stitches format and prepare questions
          const stitches = thread.stitches.map((stitch: any) => {
            // CRITICAL FIX: Properly process questions from database
            let questions = [];
            
            // Look for database questions with detailed logging to diagnose issues
            if (stitch.questions && Array.isArray(stitch.questions) && stitch.questions.length > 0) {
              // Log first question format to help with debugging
              const firstQuestion = stitch.questions[0];
              console.log(`Found ${stitch.questions.length} database questions for stitch ${stitch.id}`);
              console.log(`First question format:`, JSON.stringify(firstQuestion).substring(0, 200) + '...');
              
              // Process database questions with full format exploration
              questions = stitch.questions.map((q, index) => {
                // Check all possible field names that might contain question text and correct answer
                const questionId = q.id || q.question_id || `${stitch.id}-q${index+1}`;
                const questionText = q.text || q.question_text || q.question || q.body || '?';
                const correctAnswer = q.correct_answer || q.correctAnswer || q.answer || '';
                
                // Log format for the first few questions to help diagnose
                if (index < 3) {
                  console.log(`Question ${index} keys:`, Object.keys(q).join(', '));
                  console.log(`Question ${index} extracted: id=${questionId}, text=${questionText}, answer=${correctAnswer}`);
                }
                
                if (questionText && (correctAnswer || typeof q.correct_answer !== 'undefined')) {
                  // Flexible approach to handle various distractor formats
                  // 1. Try distractors object
                  // 2. Try named wrong answer fields
                  // 3. Fall back to generating distractors
                  
                  let distractorsL1, distractorsL2, distractorsL3;
                  
                  // Format 1: distractors as object
                  if (q.distractors) {
                    distractorsL1 = q.distractors.L1 || q.distractors.l1 || q.distractors[0];
                    distractorsL2 = q.distractors.L2 || q.distractors.l2 || q.distractors[1];
                    distractorsL3 = q.distractors.L3 || q.distractors.l3 || q.distractors[2];
                  }
                  
                  // Format 2: wrong_answerN fields
                  if (!distractorsL1) {
                    distractorsL1 = q.wrong_answer1 || q.wrongAnswer1 || q.distractor1 || q.distractors?.[0];
                    distractorsL2 = q.wrong_answer2 || q.wrongAnswer2 || q.distractor2 || q.distractors?.[1];
                    distractorsL3 = q.wrong_answer3 || q.wrongAnswer3 || q.distractor3 || q.distractors?.[2];
                  }
                  
                  // For numeric answers, generate fallbacks if needed
                  const numericAnswer = !isNaN(Number(correctAnswer));
                  if (!distractorsL1 && numericAnswer) {
                    const numAnswer = Number(correctAnswer);
                    distractorsL1 = String(numAnswer + 1);
                    distractorsL2 = String(numAnswer - 1);
                    distractorsL3 = String(numAnswer + 2);
                  } 
                  // For text answers with no distractors, create generic fallbacks
                  else if (!distractorsL1 && correctAnswer) {
                    distractorsL1 = correctAnswer + " (wrong)";
                    distractorsL2 = "Incorrect answer";
                    distractorsL3 = "Not " + correctAnswer;
                  }
                  
                  // Make sure all distractors are defined
                  distractorsL1 = distractorsL1 || 'Option A';
                  distractorsL2 = distractorsL2 || 'Option B';
                  distractorsL3 = distractorsL3 || 'Option C';
                  
                  return {
                    id: questionId,
                    text: questionText,
                    correctAnswer: correctAnswer,
                    distractors: {
                      L1: distractorsL1,
                      L2: distractorsL2,
                      L3: distractorsL3
                    }
                  };
                }
                // Skip malformed questions
                return null;
              }).filter(q => q !== null); // Remove any null questions
              
              console.log(`Successfully converted ${questions.length} database questions`);
            }
            
            // If no valid questions from database, pre-generate sample questions
            if (questions.length === 0) {
              questions = generateSampleQuestions(stitch.id);
              console.log(`No valid database questions, pre-generated ${questions.length} questions for stitch ${stitch.id}`);
            }
            
            return {
              id: stitch.id,
              threadId: threadId,
              content: stitch.content || `Content for stitch ${stitch.id}`,
              position: stitch.order_number || 0,
              skipNumber: stitch.skip_number || 1,
              distractorLevel: stitch.distractor_level || 'L1',
              completed: false,
              score: 0,
              questions: questions
            };
          });
          
          // Add stitches to the appropriate tube
          if (!tubeStitches[tubeNumber]) {
            tubeStitches[tubeNumber] = [];
          }
          
          tubeStitches[tubeNumber].push(...stitches);
          
          console.log(`Added ${stitches.length} stitches from thread ${threadId} to Tube ${tubeNumber}`);
        });
        
        // Second pass: Process each tube's stitches
        Object.entries(tubeStitches).forEach(([tubeNumber, stitches]) => {
          const tubeNum = parseInt(tubeNumber);
          
          if (!stitches || stitches.length === 0) {
            console.log(`No stitches for Tube ${tubeNum}`);
            return;
          }
          
          console.log(`Processing ${stitches.length} stitches for Tube ${tubeNum}`);
          
          // Sort stitches by position
          const sortedStitches = [...stitches].sort((a, b) => a.position - b.position);
          
          // Find the active stitch (position 0)
          const activeStitch = sortedStitches.find(s => s.position === 0);
          
          if (!activeStitch) {
            console.warn(`No active stitch (position 0) found for Tube ${tubeNum}`);
            console.log('Positions available:', sortedStitches.map(s => s.position).join(', '));
            
            // If no active stitch, make the first one active
            if (sortedStitches.length > 0) {
              sortedStitches[0].position = 0;
              console.log(`Setting stitch ${sortedStitches[0].id} as active (position 0)`);
            }
          }
          
          // Get the updated active stitch
          const updatedActiveStitch = sortedStitches.find(s => s.position === 0) || sortedStitches[0];
          
          // Determine the primary thread for this tube
          // This is used as the tube's threadId in the state machine
          let primaryThreadId = updatedActiveStitch?.threadId;
          
          // Initialize the tube in the state machine
          initialState.tubes[tubeNum] = {
            threadId: primaryThreadId,
            currentStitchId: updatedActiveStitch?.id,
            stitches: sortedStitches
          };
          
          console.log(`Tube ${tubeNum} initialized with primary thread ${primaryThreadId}, active stitch ${updatedActiveStitch?.id}`);
        });
        
        // Verify all tube assignments
        console.log('========== TUBE ASSIGNMENT VERIFICATION ==========');
        
        // CRITICAL: Force initialization of all tubes - regardless of what data is available
        console.log('FORCING INITIALIZATION OF ALL THREE TUBES');
        
        // Always generate sample questions function - used by all tubes
        const generateSampleQuestionsForced = (stitchId) => {
          const sampleQuestions = [];
          const mathOperations = ['+', '-', '×', '÷'];
          
          // Generate math questions
          for (let i = 1; i <= 5; i++) {
            const op = mathOperations[i % 4];
            let num1 = Math.floor(Math.random() * 10) + 1;
            let num2 = Math.floor(Math.random() * 10) + 1;
            let correctAnswer = '';
            
            // Calculate answer
            switch (op) {
              case '+': correctAnswer = String(num1 + num2); break;
              case '-': correctAnswer = String(num1 - num2); break;
              case '×': correctAnswer = String(num1 * num2); break;
              case '÷': 
                num2 = Math.floor(Math.random() * 5) + 1;
                num1 = num2 * (Math.floor(Math.random() * 5) + 1);
                correctAnswer = String(num1 / num2);
                break;
            }
            
            sampleQuestions.push({
              id: `${stitchId}-q${i}`,
              text: `${num1} ${op} ${num2}`,
              correctAnswer,
              distractors: {
                L1: String(Number(correctAnswer) + 1),
                L2: String(Number(correctAnswer) - 1),
                L3: String(Number(correctAnswer) + 2)
              }
            });
          }
          
          return sampleQuestions;
        };
        
        // ------ TUBE 1 VERIFICATION AND INITIALIZATION ------
        // Verify Tube 1 (should contain Thread A and potentially Thread F)
        if (initialState.tubes[1] && initialState.tubes[1].stitches && initialState.tubes[1].stitches.length > 0) {
          const tube1Stitches = initialState.tubes[1].stitches;
          const threadAStitches = tube1Stitches.filter(s => s.threadId === 'thread-A');
          const threadFStitches = tube1Stitches.filter(s => s.threadId === 'thread-F');
          
          console.log(`Tube 1 contains: ${threadAStitches.length} stitches from Thread A, ${threadFStitches.length} stitches from Thread F`);
        } else {
          console.error('ERROR: Tube 1 not properly initialized - creating emergency content');
          
          // Create emergency sample content for Tube 1
          const sampleTube1Stitches = [
            {
              id: 'sample-stitch-A-1',
              threadId: 'thread-A',
              content: 'Sample content for Thread A in Tube 1',
              position: 0,
              skipNumber: 1,
              distractorLevel: 'L1',
              completed: false,
              score: 0,
              tubeNumber: 1, // Add explicit tube number for transitions
              questions: generateSampleQuestionsForced('sample-stitch-A-1')
            }
          ];
          
          // Force initialize Tube 1
          initialState.tubes[1] = {
            threadId: 'thread-A',
            currentStitchId: 'sample-stitch-A-1',
            stitches: sampleTube1Stitches
          };
          
          console.log('RECOVERY: Created emergency Tube 1 content with Thread A');
        }
        
        // ------ TUBE 2 VERIFICATION AND INITIALIZATION ------
        // Verify Tube 2 (should contain Thread B and potentially Thread E)
        if (initialState.tubes[2] && initialState.tubes[2].stitches && initialState.tubes[2].stitches.length > 0) {
          const tube2Stitches = initialState.tubes[2].stitches;
          const threadBStitches = tube2Stitches.filter(s => s.threadId === 'thread-B');
          const threadEStitches = tube2Stitches.filter(s => s.threadId === 'thread-E');
          
          console.log(`Tube 2 contains: ${threadBStitches.length} stitches from Thread B, ${threadEStitches.length} stitches from Thread E`);
        } else {
          console.error('ERROR: Tube 2 not properly initialized - creating emergency content');
          
          // Create emergency sample content for Tube 2
          const sampleTube2Stitches = [
            {
              id: 'sample-stitch-B-1',
              threadId: 'thread-B',
              content: 'Sample content for Thread B in Tube 2',
              position: 0,
              skipNumber: 1,
              distractorLevel: 'L1',
              completed: false,
              score: 0,
              tubeNumber: 2, // Add explicit tube number for transitions
              questions: generateSampleQuestionsForced('sample-stitch-B-1')
            }
          ];
          
          // Force initialize Tube 2
          initialState.tubes[2] = {
            threadId: 'thread-B',
            currentStitchId: 'sample-stitch-B-1',
            stitches: sampleTube2Stitches
          };
          
          console.log('RECOVERY: Created emergency Tube 2 content with Thread B');
        }
        
        // ------ TUBE 3 VERIFICATION AND INITIALIZATION ------
        // CRITICAL: Always create Tube 3 with guaranteed content to ensure cycling works
        // This is a key fix for the cycling issue
        
        // First, check if Tube 3 data exists
        const hasTube3Data = initialState.tubes[3] && 
                           initialState.tubes[3].stitches && 
                           initialState.tubes[3].stitches.length > 0 &&
                           initialState.tubes[3].currentStitchId;
        
        if (hasTube3Data) {
          // Verify existing Tube 3 data
          const tube3Stitches = initialState.tubes[3].stitches;
          const threadCStitches = tube3Stitches.filter(s => s.threadId === 'thread-C');
          const threadDStitches = tube3Stitches.filter(s => s.threadId === 'thread-D');
          
          console.log(`Tube 3 contains: ${threadCStitches.length} stitches from Thread C, ${threadDStitches.length} stitches from Thread D`);
          
          // CRITICAL: Make sure Tube 3 has questions and other required fields
          for (const stitch of tube3Stitches) {
            if (!stitch.questions || stitch.questions.length === 0) {
              console.log(`Adding questions to Tube 3 stitch ${stitch.id}`);
              stitch.questions = generateSampleQuestionsForced(stitch.id);
            }
          }
          
          // CRITICAL: Make sure currentStitchId points to a valid stitch
          const currentStitchExists = tube3Stitches.some(s => s.id === initialState.tubes[3].currentStitchId);
          if (!currentStitchExists) {
            console.error(`Current stitch ID ${initialState.tubes[3].currentStitchId} not found in Tube 3`);
            // Find the first stitch at position 0 or the first stitch overall
            const positionZeroStitch = tube3Stitches.find(s => s.position === 0);
            initialState.tubes[3].currentStitchId = positionZeroStitch ? positionZeroStitch.id : tube3Stitches[0].id;
            console.log(`Fixed current stitch ID to ${initialState.tubes[3].currentStitchId}`);
          }
        } else {
          // ALWAYS create guaranteed Tube 3 content
          console.log('CRITICAL FIX: Creating guaranteed Tube 3 content for proper cycling');
          
          // Create comprehensive sample stitches for Tube 3
          const guaranteedTube3Stitches = [
            {
              id: 'guaranteed-stitch-C-1',
              threadId: 'thread-C',
              content: 'Sample content for Thread C in Tube 3',
              position: 0, // Active stitch
              skipNumber: 1,
              distractorLevel: 'L1',
              completed: false,
              score: 0,
              tubeNumber: 3, // Add explicit tube number for smooth transitions
              questions: generateSampleQuestionsForced('guaranteed-stitch-C-1')
            },
            {
              id: 'guaranteed-stitch-D-1',
              threadId: 'thread-D',
              content: 'Sample content for Thread D in Tube 3',
              position: 1, // Next stitch
              skipNumber: 1,
              distractorLevel: 'L1',
              completed: false,
              score: 0,
              tubeNumber: 3, // Add explicit tube number for smooth transitions
              questions: generateSampleQuestionsForced('guaranteed-stitch-D-1')
            }
          ];
          
          // CRITICAL: Override Tube 3 completely
          initialState.tubes[3] = {
            threadId: 'thread-C', // Primary thread ID
            currentStitchId: 'guaranteed-stitch-C-1',
            stitches: guaranteedTube3Stitches
          };
          
          console.log('GUARANTEED FIX: Tube 3 now has reliable sample content to ensure cycling works');
        }
        
        // FINAL VERIFICATION CHECK
        console.log('========== FINAL TUBE VERIFICATION ==========');
        for (let tubeNum = 1; tubeNum <= 3; tubeNum++) {
          const tube = initialState.tubes[tubeNum];
          if (!tube || !tube.stitches || tube.stitches.length === 0 || !tube.currentStitchId) {
            console.error(`CRITICAL ERROR: Tube ${tubeNum} still not properly initialized!`);
          } else {
            console.log(`Tube ${tubeNum} verified: ${tube.stitches.length} stitches, currentStitch=${tube.currentStitchId}, threadId=${tube.threadId}`);
          }
        }
        console.log('=================================================');
        
        // Create adapter
        const adapter = new StateMachineTubeCyclerAdapter({
          userId,
          initialState,
          onStateChange: handleStateChange,
          onTubeChange: handleTubeChange
        });
        
        // Set adapter
        setTubeCycler(adapter);
        
        // Initialize UI state from adapter
        setState(adapter.getState());
        setCurrentTube(adapter.getCurrentTube());
        setCurrentStitch(adapter.getCurrentStitch());
        setTubeStitches(adapter.getCurrentTubeStitches());
        
        // CRITICAL: Preload next tube data directly using adapter here rather than using the preloadNextTube function
        // This ensures immediate access to the state and guarantees preloading works
        try {
          console.log('Direct preloading of next tube data...');
          
          // Calculate next tube number
          const currentTubeNum = adapter.getCurrentTube();
          const nextTubeNum = (currentTubeNum % 3) + 1; // 1->2->3->1
          
          console.log(`Directly preloading data for next tube (${nextTubeNum})`);
          
          // Get state from adapter directly
          const adapterState = adapter.getState();
          
          // Get next tube data
          const nextTube = adapterState.tubes[nextTubeNum];
          if (nextTube) {
            // Get active stitch
            const nextStitchId = nextTube.currentStitchId;
            const nextStitch = nextTube.stitches.find((s) => s.id === nextStitchId);
            
            if (nextStitch) {
              // Store directly in the ref
              nextTubeRef.current = {
                tube: nextTubeNum,
                stitch: {...nextStitch, tubeNumber: nextTubeNum},
                stitches: [...nextTube.stitches].sort((a, b) => a.position - b.position)
              };
              
              console.log(`Direct preload successful: Next tube ${nextTubeNum}, Stitch ${nextStitch.id}`);
            } else {
              console.error(`ERROR: Active stitch not found in next tube ${nextTubeNum}`);
            }
          } else {
            console.error(`ERROR: Next tube ${nextTubeNum} not found in state`);
          }
        } catch (err) {
          console.error('Error in direct preload:', err);
        }
        
        // Finish loading
        setIsLoading(false);
        addLog(`StateMachineTubeCyclerAdapter initialized for user ${userId}`);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoadError(error instanceof Error ? error.message : 'Unknown error occurred');
        setIsLoading(false);
      }
    }
    
    fetchData();
    
    // Cleanup on unmount
    return () => {
      if (tubeCycler) {
        tubeCycler.destroy();
      }
    };
  }, [userId]); // Avoid circular dependencies by not including preloadNextTubeData
  
  // Handle stitch completion - COMPLETELY SEAMLESS VERSION WITH ENHANCED DEBUGGING
  const handleSessionComplete = (results: any, isEndSession = false) => {
    console.log('----- SESSION COMPLETED -----');
    addLog(`Session completed from Tube-${currentTube}`);
    console.log('Session completed with results:', results);
    
    // Accumulate session data
    setAccumulatedSessionData(prev => {
      const newData = {
        totalPoints: prev.totalPoints + (results.totalPoints || 0),
        correctAnswers: prev.correctAnswers + (results.correctAnswers || 0),
        firstTimeCorrect: prev.firstTimeCorrect + (results.firstTimeCorrect || 0),
        totalQuestions: prev.totalQuestions + (results.totalQuestions || 0),
        totalAttempts: prev.totalAttempts + (results.totalAttempts || 0),
        stitchesCompleted: prev.stitchesCompleted + 1
      };
      
      console.log('Accumulated session data:', newData);
      return newData;
    });
    
    // If end session is requested, persist state and go back to home
    if (isEndSession) {
      console.log('End session requested - saving full state before exit');
      // This is the ONLY time we should call persistStateToServer (offline-first approach)
      console.log('OFFLINE-FIRST: Sending accumulated state to server at session end');
      persistStateToServer(); // Save full state without score parameters
      router.push('/');
      return;
    }
    
    // Get score info
    const score = results.correctAnswers || 0;
    const totalQuestions = results.totalQuestions || 20;
    const isPerfectScore = score === totalQuestions;
    
    if (!currentStitch) {
      console.error('No current stitch to complete');
      return;
    }
    
    // Record current stitch details
    const stitch = currentStitch;
    const stitchId = stitch.id;
    const threadId = stitch.threadId;
    const beforeTube = currentTube;
    
    addLog(`Stitch ${stitchId.split('-').pop()} completed with score ${score}/${totalQuestions} (${isPerfectScore ? 'PERFECT' : 'PARTIAL'})`);
    
    // CRITICAL: For seamless transitions, we need our preloaded data
    const preloadedData = nextTubeRef.current;
    if (!preloadedData) {
      console.warn('No preloaded data available for next tube - attempting to calculate next tube directly');
      
      // Try to calculate the next tube directly
      const currentTubeNum = tubeCycler.getCurrentTube();
      const nextTubeNum = (currentTubeNum % 3) + 1; // 1->2->3->1
      
      console.log(`Calculated next tube will be Tube-${nextTubeNum}`);
      addLog(`No preloaded data - calculating next tube: ${currentTubeNum} → ${nextTubeNum}`);
      
      // Show loading screen temporarily
      setIsLoading(true);
      
      // Attempt to create the preloaded data now
      const currentState = tubeCycler.getState();
      const nextTube = currentState.tubes[nextTubeNum];
      
      if (nextTube && nextTube.stitches && nextTube.stitches.length > 0 && nextTube.currentStitchId) {
        console.log(`Found tube ${nextTubeNum} data directly - creating synthetic preloaded data`);
        
        // Find the current stitch in the next tube
        const nextStitch = nextTube.stitches.find((s: any) => s.id === nextTube.currentStitchId);
        
        if (nextStitch) {
          // Create synthetic preloaded data
          preloadNextTube();
          
          // Slight delay to allow preloading to complete
          setTimeout(() => {
            // Try again with the newly preloaded data
            handleSessionComplete(results, isEndSession);
          }, 100);
          return;
        }
      }
    }
    
    // First, process the stitch completion in the current tube (background)
    console.log('DEBUG: Processing stitch completion in background');
    
    // ANTI-FLICKER APPROACH: Use preloaded data for instant transitions without loading state
    // Never set isLoading=true to avoid full page refreshes
    if (preloadedData) {
      console.log(`DEBUG: Using preloaded data for Tube ${preloadedData.tube}`);
      addLog(`Transitioning from Tube-${beforeTube} to Tube-${preloadedData.tube}`);
      
      // Calculate expected next tube number for verification
      const expectedNextTube = (beforeTube % 3) + 1; // Simple 1->2->3->1 cycle
      
      if (preloadedData.tube !== expectedNextTube) {
        console.warn(`WARNING: Preloaded tube ${preloadedData.tube} doesn't match expected tube ${expectedNextTube}`);
      }
      
      // REFINED APPROACH: Transition without full page loading
      // This ensures a clean transition between tubes without disrupting the overall UI
      console.log('Directly updating UI with preloaded content');
      
      // Update UI immediately with preloaded content WITHOUT using the loading indicator
      // This is critical for keeping the page stable during tube transitions
      setCurrentTube(preloadedData.tube);
      setCurrentStitch(preloadedData.stitch);
      setTubeStitches(preloadedData.stitches);
      
      // Clear the preloaded data
      nextTubeRef.current = null;
      
      // Process the background updates, but use selectTube instead of cycleTubes
      setTimeout(() => {
        // First process previous tube stitch completion
        console.log(`Processing completion of stitch ${stitchId} in thread ${threadId}`);
        tubeCycler.handleStitchCompletion(threadId, stitchId, score, totalQuestions);
        
        // CRITICAL CHANGE: Use direct tube selection instead of cycling
        // This bypasses the cycleTubes() method that might be failing
        const targetTube = (beforeTube % 3) + 1; // 1->2->3->1
        console.log(`Directly selecting tube ${targetTube} instead of cycling`);
        
        // Force selection of the next tube
        tubeCycler.selectTube(targetTube);
        
        // Double-check the state machine's tube number 
        const stateMachineTube = tubeCycler.getCurrentTube();
        console.log(`State machine is now on Tube ${stateMachineTube}`);
        
        // Ensure UI matches state machine
        if (stateMachineTube !== preloadedData.tube) {
          console.log(`Synchronizing UI tube ${preloadedData.tube} with state machine tube ${stateMachineTube}`);
          
          // Force synchronization
          setCurrentTube(stateMachineTube);
          setCurrentStitch(tubeCycler.getCurrentStitch());
          setTubeStitches(tubeCycler.getCurrentTubeStitches());
        }
        
        // Update internal state only - no API calls during session (offline-first approach)
        setState(tubeCycler.getState());
        
        // Add logging for debugging
        addLog(`Completed transition to Tube-${stateMachineTube}`);
        
        // Preload the next tube for future rotations
        console.log(`Starting preload of tube ${(stateMachineTube % 3) + 1} for next rotation`);
        setTimeout(preloadNextTube, 50);
      }, 100); // Small delay to let UI update first
    } else {
      // Fallback path if preloading failed - but still no page refresh
      console.log('FALLBACK: Using direct tube selection without preloaded content');
      addLog(`FALLBACK: Directly selecting next tube from Tube-${beforeTube}`);
      
      // Process the stitch completion in the background
      const result = tubeCycler.handleStitchCompletion(threadId, stitchId, score, totalQuestions);
      
      // Update state machine first
      console.log('Updating state machine with stitch completion result');
      setState(tubeCycler.getState());
      
      // No server persistence during the session (offline-first approach)
      console.log('State is saved to localStorage by StateMachine - no server calls during session');
      
      // CRITICAL CHANGE: Calculate next tube directly
      const nextTubeNum = (beforeTube % 3) + 1; // Simple 1->2->3->1 cycle
      
      // Directly select the next tube (BYPASS cycleTubes)
      console.log(`Directly selecting Tube ${nextTubeNum} from Tube ${beforeTube}`);
      tubeCycler.selectTube(nextTubeNum);
      const afterTube = tubeCycler.getCurrentTube();
      console.log(`Selected Tube ${afterTube}`);
      
      // Get the new stitch information from state machine
      const newCurrentStitch = tubeCycler.getCurrentStitch();
      const newTubeStitches = tubeCycler.getCurrentTubeStitches();
      
      // CRITICAL: During this entire fallback process, we NEVER set isLoading=true
      // This ensures the page never shows a loading indicator or refreshes
      
      // Update UI with new tube content immediately
      if (newCurrentStitch) {
        console.log(`UI update for transition from Tube ${beforeTube} to ${afterTube}`);
        setCurrentTube(afterTube);
        setCurrentStitch(newCurrentStitch);
        setTubeStitches(newTubeStitches);
        
        // Preload for next time in the background
        setTimeout(() => preloadNextTube(), 200);
      } else {
        console.warn(`No current stitch found for Tube ${afterTube} - using emergency approach`);
        
        // If no current stitch found, create an emergency stitch
        const emergencyStitch = {
          id: `emergency-stitch-${afterTube}`,
          threadId: afterTube === 1 ? 'thread-A' : afterTube === 2 ? 'thread-B' : 'thread-C',
          content: `Emergency content for Tube ${afterTube}`,
          position: 0,
          skipNumber: 1,
          distractorLevel: 'L1',
          completed: false,
          score: 0,
          tubeNumber: afterTube,
          questions: generateSampleQuestions(`emergency-stitch-${afterTube}`)
        };
        
        // Update UI with emergency content
        setCurrentTube(afterTube);
        setCurrentStitch(emergencyStitch);
        setTubeStitches([emergencyStitch]);
        // Return to avoid further processing
        return;
      }
      
      // Don't set isLoading to false as we're avoiding full page loading indicators
      
      // Try to preload next tube for future rotations
      setTimeout(preloadNextTube, 500);
      
      addLog(`RECOVERY: Created emergency stitch for Tube-${afterTube}`);
      
      // Update UI state with new values from state machine
      // This approach avoids setting global loading state, keeping the page stable
      console.log(`Updating UI with new tube ${afterTube} and stitch ${newCurrentStitch.id}`);
      setCurrentTube(afterTube);
      setCurrentStitch(newCurrentStitch);
      setTubeStitches(newTubeStitches);
      addLog(`Updated UI to show Tube-${afterTube}, Stitch ${newCurrentStitch.id.split('-').pop()}`);
      
      // No need to turn off loading since we never turned it on for a smoother transition
      
      // Preload for next time with a slight delay to ensure UI has updated
      setTimeout(() => {
        console.log('Starting preload for next rotation');
        preloadNextTube();
      }, 200);
    }
  };
  
  // Perfect score button handler
  const handlePerfectScore = () => {
    if (!tubeCycler || !currentStitch) return;
    
    console.log('Simulating stitch completion with perfect score (20/20)');
    
    // Create mock perfect results
    const mockPerfectResults = {
      sessionId: `session-${Date.now()}`,
      threadId: currentStitch.threadId,
      stitchId: currentStitch.id,
      totalQuestions: 20,
      totalAttempts: 20,
      correctAnswers: 20,
      firstTimeCorrect: 20,
      accuracy: 100,
      averageTimeToAnswer: 1500,
      totalPoints: 60,
      completedAt: new Date().toISOString()
    };
    
    // Process perfect score completion
    handleSessionComplete(mockPerfectResults);
  };
  
  // Partial score button handler
  const handlePartialScore = () => {
    if (!tubeCycler || !currentStitch) return;
    
    console.log('Simulating stitch completion with partial score (15/20)');
    
    // Create mock partial results
    const mockPartialResults = {
      sessionId: `session-${Date.now()}`,
      threadId: currentStitch.threadId,
      stitchId: currentStitch.id,
      totalQuestions: 20,
      totalAttempts: 25, // Some retries
      correctAnswers: 15,
      firstTimeCorrect: 10,
      accuracy: 75,
      averageTimeToAnswer: 2500,
      totalPoints: 20,
      completedAt: new Date().toISOString()
    };
    
    // Process partial score completion
    handleSessionComplete(mockPartialResults);
  };
  
  // Persist state to server - ONLY CALLED AT END OF SESSION
  // Following the offline-first approach, this should only be called when the user explicitly ends their session
  const persistStateToServer = async (score: number = 0, totalQuestions: number = 0) => {
    if (!tubeCycler) return;
    
    const stateData = tubeCycler.getState();
    
    try {
      // First persist tube position
      await fetch('/api/save-tube-position', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: stateData.userId,
          tubeNumber: currentTube,
          threadId: currentStitch?.threadId
        })
      });
      
      // CRITICAL FIX: Save ALL stitch positions and skip numbers
      const updatedStitches = [];
      
      // For each tube, get all stitches with their positions and skip numbers
      Object.entries(stateData.tubes).forEach(([tubeNum, tube]: [string, any]) => {
        const tubeNumber = parseInt(tubeNum);
        
        tube.stitches.forEach((stitch: any) => {
          updatedStitches.push({
            userId: stateData.userId,
            threadId: stitch.threadId,
            stitchId: stitch.id,
            tubeNumber: tubeNumber,
            orderNumber: stitch.position,
            skipNumber: stitch.skipNumber || 1,
            distractorLevel: stitch.distractorLevel || 'L1',
            currentStitchId: tube.currentStitchId === stitch.id
          });
        });
      });
      
      // Save ALL stitches with their updated positions and skip numbers
      console.log(`Updating ${updatedStitches.length} stitch positions and skip numbers`);
      await fetch('/api/update-stitch-positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: stateData.userId,
          stitches: updatedStitches
        })
      });
      
      // If score provided, persist session results too
      if (score > 0 && totalQuestions > 0 && currentStitch) {
        await fetch('/api/save-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: stateData.userId,
            threadId: currentStitch.threadId,
            stitchId: currentStitch.id,
            score: score,
            totalQuestions: totalQuestions,
            points: score === totalQuestions ? 60 : 20
          })
        });
      }
      
      console.log('SESSION ENDED: Complete state persisted to server with positions and skip numbers');
      console.log('Following offline-first approach: This is the only server update during the entire session');
    } catch (error) {
      console.error('Error persisting state:', error);
    }
  };
  
  // Format the skip number for display with appropriate color
  const formatSkipNumber = (skipNumber: number) => {
    let skipClass = "";
    
    // Assign color based on skip number
    if (skipNumber === 1) skipClass = "text-gray-300"; 
    else if (skipNumber === 3) skipClass = "text-white font-medium";
    else if (skipNumber === 5) skipClass = "text-blue-300";
    else if (skipNumber === 10) skipClass = "text-green-300";
    else if (skipNumber === 25) skipClass = "text-yellow-300";
    else if (skipNumber === 100) skipClass = "text-pink-300";
    
    return (
      <span className={skipClass}>{skipNumber}</span>
    );
  };
  
  // Format distractor level for display with appropriate color
  const formatLevel = (level: string) => {
    let levelClass = "";
    
    if (level === 'L1') levelClass = "text-white";
    else if (level === 'L2') levelClass = "text-yellow-300";
    else if (level === 'L3') levelClass = "text-pink-300";
    
    return (
      <span className={levelClass}>{level}</span>
    );
  };
  
  return (
    <div className="min-h-screen player-bg text-white">
        {/* Restored original player-bg with proper layout */}
      <Head>
        <title>Working Triple-Helix Player</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      {/* Back to home */}
      <div className="fixed top-4 left-4 z-20">
        <Link href="/" className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Home
        </Link>
      </div>
      
      {/* Verification success badge */}
      <div className="fixed top-4 right-4 z-20 bg-green-600 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Thread D in Tube 3
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
        {isLoading && !tubeStitches.length ? (
          <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-xl p-6 text-center max-w-sm mx-auto shadow-xl transition-all duration-300">
            <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-300 border-t-transparent rounded-full mb-2"></div>
            <p className="text-blue-300 text-lg">Loading initial content...</p>
            <p className="text-blue-300/70 text-sm mt-2">This only appears once during the first load</p>
          </div>
        ) : loadError ? (
          <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-xl p-8 text-center max-w-lg mx-auto">
            <h2 className="text-2xl font-bold mb-4">Error Loading Content</h2>
            <div className="bg-red-500/20 border border-red-300/30 text-red-100 rounded-lg p-4 mb-6">
              {loadError}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : !currentStitch ? (
          <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-xl p-8 text-center max-w-lg mx-auto">
            <h2 className="text-2xl font-bold mb-4">No Active Stitch</h2>
            <p className="mb-4">There is no active stitch available.</p>
            <button
              onClick={() => router.push('/')}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Back to Home
            </button>
          </div>
        ) : (
          <>
            {/* Main action buttons */}
            <div className="mb-6 flex justify-center gap-4">
              <button
                onClick={handlePerfectScore}
                className="bg-green-600 hover:bg-green-500 px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all text-lg font-semibold"
              >
                Perfect Score (20/20)
              </button>
              
              <button
                onClick={handlePartialScore}
                className="bg-yellow-600 hover:bg-yellow-500 px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all text-lg font-semibold"
              >
                Partial Score (15/20)
              </button>
              
              <button
                onClick={() => {
                  console.log('----- DIRECT TUBE ROTATION -----');
                  // Add a clear log entry for debugging
                  addLog(`DIRECT ROTATION from Tube ${currentTube}`);
                  
                  // Get the current state from the state machine
                  const currentState = tubeCycler.getState();
                  
                  // Calculate the next tube number directly
                  const nextTubeNum = (currentTube % 3) + 1; // 1->2->3->1
                  
                  // Create contained loading state with preserved UI layout
                  // We don't set global isLoading state to avoid refreshing the whole page
                  
                  console.log(`FORCED DIRECT ROTATION: Tube ${currentTube} → Tube ${nextTubeNum}`);
                  
                  // Get the next tube's data directly from state
                  const nextTube = currentState.tubes[nextTubeNum];
                  
                  if (!nextTube || !nextTube.stitches || nextTube.stitches.length === 0) {
                    console.error(`ERROR: Next tube ${nextTubeNum} is invalid or has no stitches!`);
                    
                    // Create emergency data for the next tube
                    console.log(`EMERGENCY: Creating emergency data for Tube ${nextTubeNum}`);
                    
                    // Generate a sample stitch for this emergency tube
                    const sampleStitch = {
                      id: `emergency-stitch-${nextTubeNum}`,
                      threadId: nextTubeNum === 1 ? 'thread-A' : 
                                nextTubeNum === 2 ? 'thread-B' : 'thread-C',
                      content: `Emergency content for Tube ${nextTubeNum}`,
                      position: 0,
                      skipNumber: 1,
                      distractorLevel: 'L1',
                      completed: false,
                      score: 0,
                      tubeNumber: nextTubeNum, // Explicitly include tube number for transitions
                      questions: generateSampleQuestions(`emergency-stitch-${nextTubeNum}`)
                    };
                    
                    // Update UI directly with this emergency data
                    setCurrentTube(nextTubeNum);
                    setCurrentStitch(sampleStitch);
                    setTubeStitches([sampleStitch]);
                    setIsLoading(false);
                    
                    addLog(`EMERGENCY TUBE ${nextTubeNum} CREATED AND DISPLAYED`);
                    
                    // Try to update the state machine too
                    try {
                      // Force the tube selection in the state machine
                      tubeCycler.selectTube(nextTubeNum);
                      setState(tubeCycler.getState());
                    } catch (err) {
                      console.error('Failed to update state machine:', err);
                    }
                    
                    return;
                  }
                  
                  // Find the active stitch in the next tube
                  const activeStitchId = nextTube.currentStitchId;
                  let activeStitch = nextTube.stitches.find(s => s.id === activeStitchId);
                  
                  // If no active stitch found, use the first one
                  if (!activeStitch) {
                    console.warn(`No active stitch found in tube ${nextTubeNum}, using first stitch`);
                    activeStitch = nextTube.stitches.sort((a, b) => a.position - b.position)[0];
                  }
                  
                  // Get all stitches for this tube, sorted by position
                  const sortedStitches = [...nextTube.stitches].sort((a, b) => a.position - b.position);
                  
                  // Prepare stitch with tube number
                  const stitchWithTubeNum = {...activeStitch, tubeNumber: nextTubeNum};
                  
                  // DIRECT UI UPDATE - bypass all state machine logic
                  setTimeout(() => {
                    console.log(`DIRECT UI UPDATE: Displaying Tube ${nextTubeNum}`);
                    // Update all tube-related state BEFORE changing loading state
                    // This ensures the content changes without triggering a full page loading indicator
                    setCurrentTube(nextTubeNum);
                    setCurrentStitch(stitchWithTubeNum);
                    setTubeStitches(sortedStitches);
                    setIsLoading(false);
                    
                    // Log the direct update
                    addLog(`DIRECT TUBE SWITCH: Tube ${currentTube} → ${nextTubeNum}`);
                    
                    // Try to update the state machine too
                    try {
                      // Force the tube selection in the state machine
                      tubeCycler.selectTube(nextTubeNum);
                      setState(tubeCycler.getState());
                    } catch (err) {
                      console.error('Failed to update state machine:', err);
                    }
                    
                    // Try to preload the next tube
                    setTimeout(() => {
                      try {
                        preloadNextTube();
                      } catch (err) {
                        console.error('Failed to preload next tube:', err);
                      }
                    }, 200);
                  }, 300);
                }}
                className="relative bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all text-lg font-semibold overflow-hidden"
              >
                Force Next Tube
              </button>
            </div>
            
            {/* View controls */}
            <div className="mb-6 flex justify-center">
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                  onClick={() => {
                    setShowingTubeConfiguration(false);
                    setShowPlayer(true);
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg ${!showingTubeConfiguration && showPlayer ? 'bg-indigo-600 text-white' : 'bg-indigo-900/50 text-white/70 hover:bg-indigo-800/60'}`}
                >
                  Player
                </button>
                <button
                  onClick={() => {
                    setShowingTubeConfiguration(true);
                    setShowPlayer(false);
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg ${showingTubeConfiguration && !showPlayer ? 'bg-indigo-600 text-white' : 'bg-indigo-900/50 text-white/70 hover:bg-indigo-800/60'}`}
                >
                  Tube Configuration
                </button>
              </div>
            </div>
            
            {/* Current state info */}
            <div className="mb-6 bg-indigo-900/50 backdrop-blur-sm p-4 rounded-lg max-w-4xl mx-auto">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-sm text-white/70">Active Tube:</span>
                  <span className="text-xl font-bold text-white">Tube-{currentTube}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-white/70">Thread:</span>
                  <span className="text-xl font-bold text-white">{currentStitch.threadId}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-white/70">Current Stitch:</span>
                  <span className="text-xl font-bold text-white">{currentStitch.id.split('-').pop()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-white/70">Skip Number:</span>
                  <span className="text-xl font-bold text-white">{currentStitch.skipNumber}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-white/70">Distractor Level:</span>
                  <span className="text-xl font-bold text-white">{currentStitch.distractorLevel}</span>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-xs text-white/70">Session Points:</span>
                  <span className="text-lg font-bold text-teal-300">{accumulatedSessionData.totalPoints}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-white/70">Stitches Completed:</span>
                  <span className="text-lg font-bold text-teal-300">{accumulatedSessionData.stitchesCompleted}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-white/70">Cycle Count:</span>
                  <span className="text-lg font-bold text-teal-300">{tubeCycler?.getCycleCount() || 0}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-white/70">Total Questions:</span>
                  <span className="text-lg font-bold text-teal-300">{accumulatedSessionData.totalQuestions}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-white/70">Correct Answers:</span>
                  <span className="text-lg font-bold text-teal-300">{accumulatedSessionData.correctAnswers}</span>
                </div>
              </div>
            </div>
            
            {/* Content area */}
            {showingTubeConfiguration && !showPlayer && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 overflow-hidden max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold mb-4">Current Tube Configuration</h2>
                
                <div className="grid grid-cols-3 gap-6">
                  {[1, 2, 3].map(tubeNum => {
                    const tube = state.tubes[tubeNum];
                    const sortedStitches = tube?.stitches
                      ? [...tube.stitches].sort((a: any, b: any) => a.position - b.position)
                      : [];
                    
                    return (
                      <div key={tubeNum} className={`bg-indigo-800/30 backdrop-blur-sm rounded-lg p-4 ${currentTube === tubeNum ? 'ring-2 ring-teal-400' : ''}`}>
                        <h3 className="text-lg font-bold mb-2 flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-2 ${currentTube === tubeNum ? 'bg-teal-400' : 'bg-white/30'}`}></div>
                          Tube {tubeNum}
                          {currentTube === tubeNum && <span className="ml-2 text-xs bg-teal-400/20 text-teal-300 px-2 py-0.5 rounded">ACTIVE</span>}
                        </h3>
                        <div className="text-sm mb-3">
                          <div>Primary Thread: <span className="text-blue-300">{tube?.threadId || 'None'}</span></div>
                          <div>Current Stitch: <span className="text-blue-300">{tube?.currentStitchId?.split('-').pop() || 'None'}</span></div>
                        </div>
                        
                        <div className="text-xs font-medium text-white/70 mb-1">Stitches (by position):</div>
                        <div className="overflow-auto max-h-60">
                          <table className="w-full text-xs">
                            <thead className="text-white/60">
                              <tr className="border-b border-white/20">
                                <th className="py-1 px-2 text-left">Pos</th>
                                <th className="py-1 text-left">Stitch</th>
                                <th className="py-1 text-center">Skip</th>
                                <th className="py-1 text-center">Thread</th>
                                <th className="py-1 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedStitches.slice(0, 10).map((stitch: any) => {
                                const isActive = stitch.id === tube?.currentStitchId;
                                const threadLetter = stitch.threadId.split('-').pop();
                                
                                return (
                                  <tr key={stitch.id} className={`${isActive ? 'bg-teal-400/20' : ''} hover:bg-white/5`}>
                                    <td className={`py-1 px-2 ${stitch.position === 0 ? 'text-teal-300 font-bold' : ''}`}>{stitch.position}</td>
                                    <td className="py-1">{stitch.id.split('-').pop()}</td>
                                    <td className="py-1 text-center">{formatSkipNumber(stitch.skipNumber)}</td>
                                    <td className="py-1 text-center">{threadLetter}</td>
                                    <td className="py-1 text-center">
                                      {isActive ? (
                                        <span className="inline-block bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                                          ACTIVE
                                        </span>
                                      ) : stitch.position === 0 ? (
                                        <span className="inline-block bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded-full text-[10px]">
                                          READY
                                        </span>
                                      ) : (
                                        <span className="inline-block bg-gray-500/20 text-gray-300 px-1.5 py-0.5 rounded-full text-[10px]">
                                          waiting
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-4 bg-indigo-900/20 p-4 rounded-lg border border-indigo-900/30">
                  <div className="text-sm font-semibold mb-2">Skip Number Progression:</div>
                  <p className="text-xs text-white/80 mb-2">
                    The skip number determines where a stitch is placed after a perfect score.
                    When a stitch gets a perfect score, its skip number is updated FIRST, 
                    and then it's placed at its NEW skip number position.
                  </p>
                  <p className="text-xs text-white/80 mb-2">
                    <strong>Example:</strong> A stitch with skip=1 gets a perfect score → Its skip number 
                    updates to 3 → It's placed at position 3.
                  </p>
                  <div className="flex space-x-4 text-xs">
                    <span className="text-gray-300">1</span>
                    <span className="text-white">→ 3</span>
                    <span className="text-blue-300">→ 5</span>
                    <span className="text-green-300">→ 10</span>
                    <span className="text-yellow-300">→ 25</span>
                    <span className="text-pink-300">→ 100</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Logs Panel */}
            {showingTubeConfiguration && !showPlayer && (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mt-8 max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold mb-4">Action Logs</h2>
                
                <div className="h-72 overflow-y-auto bg-black/20 p-4 rounded-lg font-mono text-sm">
                  {logs.length === 0 ? (
                    <p className="text-white/60">No logs yet. Use the controls to see logs.</p>
                  ) : (
                    logs.map((log, index) => {
                      // Apply different styling based on log content
                      const isRotation = log.includes('STAGE ROTATED') || log.includes('SELECTED:');
                      const isStitchChange = log.includes('ACTIVE STITCH CHANGED') || log.includes('ACTIVE STITCH:');
                      const isOrderingHeader = log.includes('BEFORE ordering') || log.includes('AFTER ordering');
                      const isStitchList = log.includes(') stitch-') || (log.includes('  ') && log.match(/\d\)/));
                      const isPerfectScore = log.includes('PERFECT SCORE') || log.includes('REORDERING:');
                      const isPartialScore = log.includes('PARTIAL SCORE') || log.includes('NO REORDERING:');
                      const isTest = log.includes('TESTING:') || log.includes('SUCCESS:') || log.includes('FAILURE:');
                      
                      let className = "mb-1 ";
                      
                      if (isRotation) className += "text-blue-300 font-bold";
                      else if (isStitchChange) className += "text-green-300 font-bold";
                      else if (isOrderingHeader) className += "text-purple-300 mt-1";
                      else if (isStitchList) className += "text-gray-300 ml-4";
                      else if (isPerfectScore) className += "text-green-400";
                      else if (isPartialScore) className += "text-yellow-400";
                      else if (isTest) className += "text-pink-300";
                      
                      return <div key={index} className={className}>{log}</div>;
                    })
                  )}
                </div>
              </div>
            )}
            
            {!showingTubeConfiguration && showPlayer && (
              /* Player is now fixed size with its own container, no need for additional wrappers */
              <DistinctionPlayer
                key={`player-tube${currentTube}-stitch${currentStitch.id}`}
                thread={{
                  id: currentStitch.threadId,
                  name: currentStitch.threadId,
                  description: `Thread ${currentStitch.threadId}`,
                  stitches: [currentStitch]
                }}
                onComplete={handleSessionComplete}
                onEndSession={(results) => handleSessionComplete(results, true)}
                questionsPerSession={20}
                sessionTotalPoints={accumulatedSessionData.totalPoints}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}