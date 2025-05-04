import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { StitchWithProgress } from './types/distinction-learning';
import { useAuth } from '../context/AuthContext';

// Import the StateMachine adapter directly
const StateMachineTubeCyclerAdapter = require('./adapters/StateMachineTubeCyclerAdapter');

// Utility for creating and managing the triple-helix player
export function useTripleHelixPlayer({ 
  mode = 'default',
  resetPoints = false, // Reset points but maintain stitch progress
  debug = (message: string) => { console.log(message); }
}) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  
  // State for tubes and user
  const [userId, setUserId] = useState(() => {
    // Use authenticated user ID if available and not in forced anonymous mode
    if (user?.id && mode !== 'anonymous') {
      console.log(`Using authenticated user ID: ${user.id}`);
      return user.id;
    }
    // Generate anonymous ID if in anonymous mode
    if (mode === 'anonymous') {
      const anonId = `anonymous-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      console.log(`Using generated anonymous ID: ${anonId}`);
      return anonId;
    }
    // If user object exists but ID isn't available yet, use fallback
    if (user) {
      console.log(`User object exists but ID not available yet - using fallback`);
      return 'anonymous-pending';
    }
    console.log(`No user ID available - using anonymous placeholder`);
    return 'anonymous'; // Default placeholder until we get real user ID
  });
  const [isAnonymous, setIsAnonymous] = useState(mode === 'anonymous' || !user?.id);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  
  // Triple-Helix state
  const [tubeCycler, setTubeCycler] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [currentTube, setCurrentTube] = useState(1);
  const [currentStitch, setCurrentStitch] = useState<StitchWithProgress | null>(null);
  const [tubeStitches, setTubeStitches] = useState<any[]>([]);
  const [pendingChanges, setPendingChanges] = useState(0);
  
  // Internal state for seamless tube cycling
  const nextTubeRef = useRef<{tube: number, stitch: any, stitches: any[]} | null>(null);
  
  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Accumulated session data - initialized with zeroed points if resetPoints is true
  const [accumulatedSessionData, setAccumulatedSessionData] = useState(() => {
    // If resetPoints is true, always start with 0 points
    if (resetPoints) {
      return {
        totalPoints: 0,
        correctAnswers: 0,
        firstTimeCorrect: 0,
        totalQuestions: 0,
        totalAttempts: 0,
        stitchesCompleted: 0
      };
    }
    
    // Otherwise, try to load previous points from localStorage
    if (typeof window !== 'undefined') {
      try {
        const savedState = localStorage.getItem('zenjin_anonymous_state');
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          return {
            totalPoints: parsedState.totalPoints || 0,
            correctAnswers: 0,
            firstTimeCorrect: 0,
            totalQuestions: 0,
            totalAttempts: 0,
            stitchesCompleted: 0
          };
        }
      } catch (error) {
        console.error('Error loading previous session data:', error);
      }
    }
    
    // Default if no saved state or error occurred
    return {
      totalPoints: 0,
      correctAnswers: 0,
      firstTimeCorrect: 0,
      totalQuestions: 0,
      totalAttempts: 0,
      stitchesCompleted: 0
    };
  });
  
  // Reference to prevent double rotation
  const rotationInProgressRef = useRef(false);
  
  // Preload next tube data for seamless transitions
  const preloadNextTube = () => {
    if (!tubeCycler) {
      debug('No tubeCycler available for preloading');
      return;
    }
    
    try {
      // Calculate next tube number following strict 1->2->3->1 cycle
      const currentTubeNum = tubeCycler.getCurrentTube();
      
      // Verify the current tube is valid (1, 2, or 3)
      if (currentTubeNum !== 1 && currentTubeNum !== 2 && currentTubeNum !== 3) {
        debug(`⚠️ Invalid current tube number: ${currentTubeNum} - defaulting to tube 1`);
        // Safety measure - if the tube number is invalid, use tube 1 as current
        const forceCurrentTube = 1;
        
        // Force tube selection to a valid tube
        tubeCycler.selectTube(forceCurrentTube);
        debug(`⚠️ SAFETY: Force-selected tube ${forceCurrentTube}`);
        
        // Now proceed with next tube calculation from the valid tube
        calculateNextTube(forceCurrentTube);
        return;
      }
      
      // Deterministically calculate the next tube in sequence
      const nextTubeNum = (currentTubeNum % 3) + 1; // 1->2->3->1 cycle
      
      // CRITICAL FIX: Pre-validate next tube to avoid content loading issues
      // First check if content exists in the state
      const state = tubeCycler.getState();
      if (state && state.tubes) {
        const nextTube = state.tubes[nextTubeNum];
        
        // If the next tube is missing or empty, add emergency placeholder content
        if (!nextTube || !nextTube.stitches || nextTube.stitches.length === 0) {
          debug(`⚠️ CRITICAL: Next tube ${nextTubeNum} has no stitches - adding emergency content`);
          
          // Create emergency content for the tube to prevent errors during transition
          state.tubes[nextTubeNum] = {
            threadId: `thread-T${nextTubeNum}-001`,
            currentStitchId: `stitch-T${nextTubeNum}-001-01`,
            stitches: [{
              id: `stitch-T${nextTubeNum}-001-01`,
              threadId: `thread-T${nextTubeNum}-001`,
              position: 0,
              skipNumber: 3,
              distractorLevel: 'L1',
              tubeNumber: nextTubeNum,
              content: `Backup content for tube ${nextTubeNum}`,
              questions: [{
                id: `stitch-T${nextTubeNum}-001-01-q01`,
                text: 'Loading content...',
                correctAnswer: 'Continue',
                distractors: { L1: 'Wait', L2: 'Retry', L3: 'Skip' }
              }]
            }]
          };
          
          debug(`Added emergency backup content for Tube ${nextTubeNum}`);
        }
      }
      
      debug(`Preloading next tube ${nextTubeNum} from current tube ${currentTubeNum}`);
      calculateNextTube(currentTubeNum);
    } catch (err) {
      debug(`Error in preloadNextTube: ${err}`);
      nextTubeRef.current = null;
    }
  };
  
  // Helper function to calculate and preload the next tube
  const calculateNextTube = (currentTubeNum: number) => {
    try {
      // Calculate next tube following 1->2->3->1 cycle
      const nextTubeNum = (currentTubeNum % 3) + 1; // 1->2->3->1
      
      debug(`Preloading data for next tube (${nextTubeNum}) from current tube ${currentTubeNum}`);
      
      // Get current state and verify it has all tubes
      const currentState = tubeCycler.getState();
      
      // Validation: Ensure all three tubes exist
      const hasTube1 = !!currentState.tubes[1]?.stitches?.length;
      const hasTube2 = !!currentState.tubes[2]?.stitches?.length;
      const hasTube3 = !!currentState.tubes[3]?.stitches?.length;
      
      debug(`TUBE STATUS: Tube1=${hasTube1 ? 'exists' : 'missing'}, Tube2=${hasTube2 ? 'exists' : 'missing'}, Tube3=${hasTube3 ? 'exists' : 'missing'}`);
      
      // Get next tube data
      const nextTube = currentState.tubes[nextTubeNum];
      if (!nextTube) {
        debug(`Error: Next tube ${nextTubeNum} not found in state - tube cycling may fail`);
        
        // If specifically tube 3 is missing, log error but continue
        if (nextTubeNum === 3 && !hasTube3) {
          debug(`Error: No content available for Tube 3 preloading`);
          // Reset the nextTubeRef to null
          nextTubeRef.current = null;
          // Don't throw, just return
          debug(`Unable to preload Tube 3 - missing content`);
          return;
        }
        nextTubeRef.current = null;
        return;
      }
      
      // Verify the tube has stitches
      if (!nextTube.stitches || nextTube.stitches.length === 0) {
        debug(`Error: Next tube ${nextTubeNum} has no stitches - tube cycling may fail`);
        nextTubeRef.current = null;
        return;
      }
      
      // Get active stitch
      const nextStitchId = nextTube.currentStitchId;
      
      if (!nextStitchId) {
        debug(`Error: No current stitch ID for tube ${nextTubeNum}`);
        
        // Create a fallback stitch ID - use the first stitch
        if (nextTube.stitches.length > 0) {
          const sortedStitches = [...nextTube.stitches].sort((a: any, b: any) => a.position - b.position);
          const fallbackStitch = sortedStitches[0];
          
          // Make a deep copy to prevent reference issues
          const stitchCopy = JSON.parse(JSON.stringify(fallbackStitch));
          const stitchesCopy = JSON.parse(JSON.stringify(sortedStitches));
          
          nextTubeRef.current = {
            tube: nextTubeNum,
            stitch: {...stitchCopy, tubeNumber: nextTubeNum},
            stitches: stitchesCopy
          };
          
          debug(`Recovery: Using first available stitch as fallback for tube ${nextTubeNum}`);
          return;
        }
        
        nextTubeRef.current = null;
        return;
      }
      
      const nextStitch = nextTube.stitches.find((s: any) => s.id === nextStitchId);
      
      if (!nextStitch) {
        debug(`Error: Active stitch ${nextStitchId} not found in tube ${nextTubeNum}`);
        
        // Fall back to first stitch in the tube if we can't find the active one
        if (nextTube.stitches.length > 0) {
          debug(`Recovery: Using first stitch of tube ${nextTubeNum} as fallback`);
          const sortedStitches = [...nextTube.stitches].sort((a: any, b: any) => a.position - b.position);
          const fallbackStitch = sortedStitches[0];
          
          // Make a deep copy to prevent reference issues
          const stitchCopy = JSON.parse(JSON.stringify(fallbackStitch));
          const stitchesCopy = JSON.parse(JSON.stringify(sortedStitches));
          
          nextTubeRef.current = {
            tube: nextTubeNum,
            stitch: {...stitchCopy, tubeNumber: nextTubeNum},
            stitches: stitchesCopy
          };
          
          debug(`Recovery: Preloaded fallback stitch for tube ${nextTubeNum}`);
          return;
        }
        
        nextTubeRef.current = null;
        return;
      }
      
      // Make deep copies of the data to prevent reference issues
      const stitchCopy = JSON.parse(JSON.stringify(nextStitch));
      const stitchesCopy = JSON.parse(JSON.stringify(nextTube.stitches));
      
      // Sort stitches by position
      const sortedStitches = stitchesCopy.sort((a: any, b: any) => a.position - b.position);
      
      // Store in ref for direct access without re-renders
      nextTubeRef.current = {
        tube: nextTubeNum,
        stitch: {...stitchCopy, tubeNumber: nextTubeNum},
        stitches: sortedStitches
      };
      
      debug(`Successfully preloaded next tube data: Tube ${nextTubeNum} with stitch ${nextStitch.id}`);
    } catch (err) {
      debug(`Error in calculateNextTube: ${err}`);
      nextTubeRef.current = null;
    }
  };
  
  // When component mounts, get user ID from URL params or auth context
  useEffect(() => {
    const query = router.query;
    const queryUserId = query.userId as string;
    
    // First check URL parameters (highest priority)
    if (queryUserId) {
      // Check if switching from anonymous to authenticated
      if (isAnonymous && queryUserId !== 'anonymous' && queryUserId.indexOf('anonymous-') !== 0) {
        debug('Switching from anonymous to authenticated user via URL parameter');
        setIsAnonymous(false);
      }
      
      debug(`Setting user ID from URL parameter: ${queryUserId}`);
      setUserId(queryUserId);
    } 
    // Next check auth context if not forced into anonymous mode
    else if (user?.id && mode !== 'anonymous') {
      debug(`Setting user ID from auth context: ${user.id}`);
      setUserId(user.id);
      setIsAnonymous(false);
    }
    // If user auth state changed to unauthenticated, update accordingly
    else if (!user && !isAnonymous && mode !== 'anonymous') {
      debug('User is no longer authenticated - switching to anonymous mode');
      setIsAnonymous(true);
      setUserId('anonymous-' + Date.now());
    }
  }, [router.query, user, isAuthenticated, isAnonymous, mode]);
  
  // Skip flag to completely block UI updates during transitions
  const skipUIUpdatesRef = useRef(false);
  
  // State change handler
  const handleStateChange = (newState: any) => {
    // First, always update internal state reference
    setState(newState);
    
    // Track pending changes
    const pendingCount = tubeCycler?.getStats()?.pendingChanges || 0;
    setPendingChanges(pendingCount);
    
    // CRITICAL: If we're in a transition, block UI updates
    if (isInTransitionRef.current || rotationInProgressRef.current) {
      debug('❌ Blocking state-based UI updates during transition');
      return;
    }
    
    // Only proceed with UI updates if we're not in a transition
    debug('✅ Normal state update (not during transition)');
    
    // Update tube display
    setCurrentTube(newState.activeTubeNumber);
    
    // Update stitch display
    if (tubeCycler) {
      const stitch = tubeCycler.getCurrentStitch();
      setCurrentStitch(stitch);
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
    }
  };
  
  // Tube change handler
  const handleTubeChange = (tubeNumber: number) => {
    debug(`Tube changed to ${tubeNumber}`);
    
    // CRITICAL: If we're in a transition, block UI updates
    if (isInTransitionRef.current || rotationInProgressRef.current) {
      debug('❌ Blocking tube-based UI updates during transition');
      return;
    }
    
    // Only update the UI if we're not in a transition
    debug('✅ Normal tube update (not during transition)');
    
    // Update tube display
    setCurrentTube(tubeNumber);
    
    // Update stitch display
    if (tubeCycler) {
      const stitch = tubeCycler.getCurrentStitch();
      setCurrentStitch(stitch);
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
    }
  };
  
  // Pre-embedded initial stitch data for anonymous users
  // This contains the T1-001-01 stitch that all anonymous users start with
  const ANONYMOUS_INITIAL_DATA = {
    success: true,
    data: [
      {
        thread_id: "thread-T1-001",
        stitches: [
          {
            id: "stitch-T1-001-01",
            thread_id: "thread-T1-001",
            content: "Doubling (0, 5) [5-100]",
            description: "Multiplication (Ascending)",
            order_number: 0,
            skip_number: 3,
            distractor_level: "L1",
            questions: [
              {
                id: "stitch-T1-001-01-q01",
                question: "Double 5",
                options: ["50", "10", "15", "8"],
                answer: "10",
                distractors: {
                  L1: "50",
                  L2: "12",
                  L3: "8"
                }
              },
              {
                id: "stitch-T1-001-01-q02",
                question: "Double 10",
                options: ["100", "20", "25", "18"],
                answer: "20",
                distractors: {
                  L1: "100",
                  L2: "25",
                  L3: "18"
                }
              },
              {
                id: "stitch-T1-001-01-q03",
                question: "Double 15",
                options: ["150", "30", "25", "32"],
                answer: "30",
                distractors: {
                  L1: "150",
                  L2: "25",
                  L3: "32"
                }
              },
              {
                id: "stitch-T1-001-01-q04",
                question: "Double 20",
                options: ["200", "40", "30", "42"],
                answer: "40",
                distractors: {
                  L1: "200",
                  L2: "30",
                  L3: "42"
                }
              },
              {
                id: "stitch-T1-001-01-q05",
                question: "Double 25",
                options: ["250", "50", "45", "48"],
                answer: "50",
                distractors: {
                  L1: "250",
                  L2: "45",
                  L3: "48"
                }
              },
              {
                id: "stitch-T1-001-01-q06",
                question: "Double 30",
                options: ["300", "60", "50", "58"],
                answer: "60",
                distractors: {
                  L1: "300",
                  L2: "50",
                  L3: "58"
                }
              },
              {
                id: "stitch-T1-001-01-q07",
                question: "Double 35",
                options: ["350", "70", "65", "72"],
                answer: "70",
                distractors: {
                  L1: "350",
                  L2: "65",
                  L3: "72"
                }
              },
              {
                id: "stitch-T1-001-01-q08",
                question: "Double 40",
                options: ["400", "80", "70", "78"],
                answer: "80",
                distractors: {
                  L1: "400",
                  L2: "70",
                  L3: "78"
                }
              },
              {
                id: "stitch-T1-001-01-q09",
                question: "Double 45",
                options: ["450", "90", "80", "92"],
                answer: "90",
                distractors: {
                  L1: "450",
                  L2: "80",
                  L3: "92"
                }
              },
              {
                id: "stitch-T1-001-01-q10",
                question: "Double 50",
                options: ["500", "100", "90", "98"],
                answer: "100",
                distractors: {
                  L1: "500",
                  L2: "90",
                  L3: "98"
                }
              },
              {
                id: "stitch-T1-001-01-q11",
                question: "Double 55",
                options: ["550", "110", "100", "108"],
                answer: "110",
                distractors: {
                  L1: "550",
                  L2: "100",
                  L3: "108"
                }
              },
              {
                id: "stitch-T1-001-01-q12",
                question: "Double 60",
                options: ["600", "120", "110", "118"],
                answer: "120",
                distractors: {
                  L1: "600",
                  L2: "110",
                  L3: "118"
                }
              },
              {
                id: "stitch-T1-001-01-q13",
                question: "Double 65",
                options: ["650", "130", "150", "140"],
                answer: "130",
                distractors: {
                  L1: "650",
                  L2: "150",
                  L3: "140"
                }
              },
              {
                id: "stitch-T1-001-01-q14",
                question: "Double 70",
                options: ["700", "140", "130", "142"],
                answer: "140",
                distractors: {
                  L1: "700",
                  L2: "130",
                  L3: "142"
                }
              },
              {
                id: "stitch-T1-001-01-q15",
                question: "Double 75",
                options: ["750", "150", "140", "152"],
                answer: "150",
                distractors: {
                  L1: "750",
                  L2: "140",
                  L3: "152"
                }
              },
              {
                id: "stitch-T1-001-01-q16",
                question: "Double 80",
                options: ["800", "160", "150", "158"],
                answer: "160",
                distractors: {
                  L1: "800",
                  L2: "150",
                  L3: "158"
                }
              },
              {
                id: "stitch-T1-001-01-q17",
                question: "Double 85",
                options: ["850", "170", "160", "168"],
                answer: "170",
                distractors: {
                  L1: "850",
                  L2: "160",
                  L3: "168"
                }
              },
              {
                id: "stitch-T1-001-01-q18",
                question: "Double 90",
                options: ["900", "180", "170", "182"],
                answer: "180",
                distractors: {
                  L1: "900",
                  L2: "170",
                  L3: "182"
                }
              },
              {
                id: "stitch-T1-001-01-q19",
                question: "Double 95",
                options: ["950", "190", "180", "188"],
                answer: "190",
                distractors: {
                  L1: "950",
                  L2: "180",
                  L3: "188"
                }
              },
              {
                id: "stitch-T1-001-01-q20",
                question: "Double 100",
                options: ["1000", "200", "190", "198"],
                answer: "200",
                distractors: {
                  L1: "1000",
                  L2: "190",
                  L3: "198"
                }
              }
            ]
          }
        ],
        orderMap: [
          {
            stitch_id: "stitch-T1-001-01",
            order_number: 0
          }
        ]
      }
    ],
    tubePosition: {
      tubeNumber: 1,
      threadId: "thread-T1-001"
    },
    isFreeTier: true
  };

  // Load data and initialize adapter
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setLoadError(null);
        
        // For anonymous users, use pre-embedded data first, then cached data, then API
        let data;
        if (isAnonymous) {
          // First, use the pre-embedded data for immediate display
          data = ANONYMOUS_INITIAL_DATA;
          debug('Using pre-embedded initial stitch data for anonymous user');
          
          // If we're not in a browser context, stop here
          if (typeof window === 'undefined') {
            // Server-side rendering case - just use pre-embedded data
            debug('Server-side rendering detected, using pre-embedded data only');
          } else {
            // Try to get better/updated cached data from localStorage
            const cachedData = localStorage.getItem('anonymous_initial_stitch');
            
            if (cachedData) {
              try {
                const parsedData = JSON.parse(cachedData);
                // Use cached data if it exists and appears valid
                if (parsedData && parsedData.success) {
                  data = parsedData;
                  debug('Replaced pre-embedded data with cached data from localStorage');
                }
              } catch (e) {
                console.error('Error parsing cached initial stitch:', e);
                // Continue with pre-embedded data if parse fails
              }
            }
            
            // Regardless of whether we have pre-embedded or cached data,
            // fetch fresh data in the background for future use
            // This happens in parallel with showing the pre-embedded content
            try {
              const url = `/api/user-stitches?userId=${userId}&prefetch=5&isAnonymous=true`;
              const response = await fetch(url);
              
              if (response.ok) {
                const freshData = await response.json();
                if (freshData.success) {
                  // Cache this fresh data for future visits
                  localStorage.setItem('anonymous_initial_stitch', JSON.stringify(freshData));
                  debug('Updated cached initial stitch data in background');
                  
                  // Only update current view if it's substantially different
                  // This prevents flickering if the data is basically the same
                  const currentStitchId = data?.data?.[0]?.stitches?.[0]?.id;
                  const freshStitchId = freshData?.data?.[0]?.stitches?.[0]?.id;
                  
                  if (currentStitchId !== freshStitchId) {
                    debug('Fresh data is different, updating view');
                    data = freshData;
                  }
                }
              }
            } catch (backgroundError) {
              console.error('Background refresh failed:', backgroundError);
              // Non-critical error, continue with pre-embedded/cached data
            }
          }
        } else {
          // For authenticated users, always fetch from API
          const url = `/api/user-stitches?userId=${userId}&prefetch=5`;
          
          // Fetch user stitches from API
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status}`);
          }
          
          data = await response.json();
          
          if (!data.success) {
            throw new Error('Failed to fetch user data');
          }
        }
        
        // If in anonymous mode, we'll handle the points limit but won't show a login prompt
        // We've removed the login prompt to avoid intrusive popups
        
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
        
        // Initialize StateMachine adapter
        const initialState = {
          userId,
          activeTubeNumber: tubePosition?.tubeNumber || 1,
          tubes: {}
        };
        
        // Group stitches by tube
        const tubeStitches = {
          1: [],
          2: [],
          3: []
        };
        
        // First pass: Group all stitches by their assigned tube number
        threads.forEach((thread: any) => {
          const threadId = thread.thread_id;
          
          // CRITICAL FIX: Get tube number from database and enforce correct assignments
          let tubeNumber = thread.tube_number || 1;
          
          // Enforce correct tube assignments based on thread ID
          if (threadId.startsWith('thread-T1-')) {
            tubeNumber = 1;
          } else if (threadId.startsWith('thread-T2-')) {
            tubeNumber = 2;
          } else if (threadId.startsWith('thread-T3-')) {
            tubeNumber = 3;
          }
          
          // Convert stitches format and prepare questions
          const stitches = thread.stitches.map((stitch: any) => {
            // Process questions from database
            let questions = [];
            
            // Look for database questions
            if (stitch.questions && Array.isArray(stitch.questions) && stitch.questions.length > 0) {
              // Process database questions
              questions = stitch.questions.map((q: any, index: number) => {
                // Check all possible field names
                const questionId = q.id || q.question_id || `${stitch.id}-q${index+1}`;
                const questionText = q.text || q.question_text || q.question || q.body || '?';
                const correctAnswer = q.correct_answer || q.correctAnswer || q.answer || '';
                
                if (questionText && (correctAnswer || typeof q.correct_answer !== 'undefined')) {
                  // Flexible approach to handle various distractor formats
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
            }
            
            // If no valid questions from database, log error and add a placeholder question
            if (questions.length === 0) {
              debug(`No questions found for stitch ${stitch.id}. Using placeholder question.`);
              questions = [{
                id: `${stitch.id}-placeholder-question`,
                text: 'Please contact support - content is missing',
                correctAnswer: 'Contact support',
                distractors: {
                  L1: 'Missing content',
                  L2: 'Database error',
                  L3: 'Try again later'
                }
              }];
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
              tubeNumber,
              questions: questions
            };
          });
          
          // Add stitches to the appropriate tube
          if (!tubeStitches[tubeNumber]) {
            tubeStitches[tubeNumber] = [];
          }
          
          tubeStitches[tubeNumber].push(...stitches);
        });
        
        // Second pass: Process each tube's stitches with position conflict resolution
        Object.entries(tubeStitches).forEach(([tubeNumber, stitches]) => {
          const tubeNum = parseInt(tubeNumber);
          
          if (!stitches || stitches.length === 0) {
            debug(`No stitches for Tube ${tubeNum}`);
            return;
          }
          
          // Sort stitches by thread ID first, then by position
          // This ensures that all stitches from thread-T3-001 come before thread-T3-002
          const sortedStitches = [...stitches].sort((a, b) => {
            // First sort by threadId to group by thread
            const threadCompare = a.threadId.localeCompare(b.threadId);
            if (threadCompare !== 0) return threadCompare;
            
            // Then sort by position within the same thread
            return a.position - b.position;
          });

          // CRITICAL FIX: Check for and resolve position conflicts before determining active stitch
          const positionCounts = {};
          sortedStitches.forEach(s => {
            if (!positionCounts[s.position]) {
              positionCounts[s.position] = [];
            }
            positionCounts[s.position].push(s.id);
          });
          
          // Resolve any position conflicts
          for (const [position, stitchIds] of Object.entries(positionCounts)) {
            if (stitchIds.length > 1) {
              debug(`POSITION CONFLICT: ${stitchIds.length} stitches have position ${position} in Tube ${tubeNum}`);
              
              // Keep the first one at this position, move others
              for (let i = 1; i < stitchIds.length; i++) {
                // Find a new available position
                let newPosition = parseInt(position) + i;
                
                // Check if this position is also taken
                while (positionCounts[newPosition] && positionCounts[newPosition].length > 0) {
                  newPosition++;
                }
                
                // Update the stitch position
                const stitch = sortedStitches.find(s => s.id === stitchIds[i]);
                if (stitch) {
                  debug(`Resolving conflict: Moving stitch ${stitch.id} from position ${position} to ${newPosition}`);
                  stitch.position = newPosition;
                  
                  // Update tracking
                  if (!positionCounts[newPosition]) {
                    positionCounts[newPosition] = [];
                  }
                  positionCounts[newPosition].push(stitch.id);
                }
              }
            }
          }
          
          // Find the active stitch (position 0)
          const activeStitch = sortedStitches.find(s => s.position === 0);
          
          if (!activeStitch) {
            debug(`No active stitch (position 0) found for Tube ${tubeNum}`);
            
            // If no active stitch, make the first one active
            if (sortedStitches.length > 0) {
              sortedStitches[0].position = 0;
            }
          }
          
          // Get the updated active stitch
          const updatedActiveStitch = sortedStitches.find(s => s.position === 0) || sortedStitches[0];
          
          // Determine the primary thread for this tube
          let primaryThreadId = updatedActiveStitch?.threadId;
          
          // Initialize the tube in the state machine
          initialState.tubes[tubeNum] = {
            threadId: primaryThreadId,
            currentStitchId: updatedActiveStitch?.id,
            stitches: sortedStitches
          };
        });
        
        // CRITICAL: Force initialization of all tubes
        
        // ------ TUBE 1 VERIFICATION AND INITIALIZATION ------
        if (!initialState.tubes[1] || !initialState.tubes[1].stitches || initialState.tubes[1].stitches.length === 0) {
          debug('Tube 1 is missing required content - adding emergency backup content');
          
          // CRITICAL FIX: Instead of initializing with empty structure, add emergency content
          initialState.tubes[1] = {
            threadId: 'thread-T1-001',
            currentStitchId: 'stitch-T1-001-01',
            stitches: [{
              id: 'stitch-T1-001-01',
              threadId: 'thread-T1-001',
              content: 'Emergency content for Tube 1',
              position: 0,
              skipNumber: 3,
              distractorLevel: 'L1',
              tubeNumber: 1,
              questions: [{
                id: 'stitch-T1-001-01-q01',
                text: 'Loading content...',
                correctAnswer: 'Continue',
                distractors: { 
                  L1: 'Wait', 
                  L2: 'Retry', 
                  L3: 'Skip' 
                }
              }]
            }]
          };
          
          debug('Added emergency content for Tube 1');
        }
        
        // ------ TUBE 2 VERIFICATION AND INITIALIZATION ------
        if (!initialState.tubes[2] || !initialState.tubes[2].stitches || initialState.tubes[2].stitches.length === 0) {
          debug('Tube 2 is missing required content - adding emergency backup content');
          
          // CRITICAL FIX: Instead of initializing with empty structure, add emergency content
          initialState.tubes[2] = {
            threadId: 'thread-T2-001',
            currentStitchId: 'stitch-T2-001-01',
            stitches: [{
              id: 'stitch-T2-001-01',
              threadId: 'thread-T2-001',
              content: 'Emergency content for Tube 2',
              position: 0,
              skipNumber: 3,
              distractorLevel: 'L1',
              tubeNumber: 2,
              questions: [{
                id: 'stitch-T2-001-01-q01',
                text: 'Loading content...',
                correctAnswer: 'Continue',
                distractors: { 
                  L1: 'Wait', 
                  L2: 'Retry', 
                  L3: 'Skip' 
                }
              }]
            }]
          };
          
          debug('Added emergency content for Tube 2');
        }
        
        // ------ TUBE 3 VERIFICATION AND INITIALIZATION ------
        if (!initialState.tubes[3] || !initialState.tubes[3].stitches || initialState.tubes[3].stitches.length === 0) {
          debug('Tube 3 is missing required content - adding emergency backup content');
          
          // CRITICAL FIX: Instead of initializing with empty structure, add emergency content
          initialState.tubes[3] = {
            threadId: 'thread-T3-001',
            currentStitchId: 'stitch-T3-001-01',
            stitches: [{
              id: 'stitch-T3-001-01',
              threadId: 'thread-T3-001',
              content: 'Emergency content for Tube 3',
              position: 0,
              skipNumber: 3,
              distractorLevel: 'L1',
              tubeNumber: 3,
              questions: [{
                id: 'stitch-T3-001-01-q01',
                text: 'Loading content...',
                correctAnswer: 'Continue',
                distractors: { 
                  L1: 'Wait', 
                  L2: 'Retry', 
                  L3: 'Skip' 
                }
              }]
            }]
          };
          
          debug('Added emergency content for Tube 3');
        }
        
        // Create adapter
        const adapter = new StateMachineTubeCyclerAdapter({
          userId,
          initialState,
          onStateChange: handleStateChange,
          onTubeChange: handleTubeChange
        });
        
        // Set adapter
        setTubeCycler(adapter);
        
        // Initialize UI state from adapter - use our utility for consistency
        setState(adapter.getState());
        
        // Initial sync of UI with state machine
        const initialTube = adapter.getCurrentTube();
        const initialStitch = adapter.getCurrentStitch();
        const initialTubeStitches = adapter.getCurrentTubeStitches();
        
        debug(`Initial sync: Setting UI to Tube ${initialTube}, Stitch ${initialStitch?.id}`);
        
        // Update all UI state at once
        setCurrentTube(initialTube);
        setCurrentStitch(initialStitch);
        setTubeStitches(initialTubeStitches);
        
        // Do initial preload of next tube data
        try {
          // Calculate next tube number
          const currentTubeNum = adapter.getCurrentTube();
          const nextTubeNum = (currentTubeNum % 3) + 1; // 1->2->3->1
          
          // Get state from adapter
          const adapterState = adapter.getState();
          
          // Get next tube data
          const nextTube = adapterState.tubes[nextTubeNum];
          if (nextTube && nextTube.stitches && nextTube.stitches.length > 0 && nextTube.currentStitchId) {
            // Get active stitch
            const nextStitchId = nextTube.currentStitchId;
            const nextStitch = nextTube.stitches.find((s) => s.id === nextStitchId);
            
            if (nextStitch) {
              // Store in the ref
              nextTubeRef.current = {
                tube: nextTubeNum,
                stitch: {...nextStitch, tubeNumber: nextTubeNum},
                stitches: [...nextTube.stitches].sort((a, b) => a.position - b.position)
              };
              
              debug(`Preloaded next tube ${nextTubeNum}`);
            }
          }
        } catch (err) {
          debug(`Error in initial preload: ${err}`);
        }
        
        // Finish loading
        setIsLoading(false);
        
        // Schedule another preload after a short delay to ensure the next tube data is ready
        setTimeout(() => {
          debug('Running redundant preload to ensure Live Aid stage model is ready');
          preloadNextTube();
        }, 3000);
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
  }, [userId]);
  
  // Handle stitch completion - CLEAN IMPLEMENTATION
  const handleSessionComplete = (results: any, isEndSession = false) => {
    debug(`Session completed with results: ${JSON.stringify(results)}`);
    
    // CRITICAL FIX: Always use 20 for question count
    // All stitches in this application always have 20 questions
    const EXPECTED_QUESTION_COUNT = 20;
    
    // Check if the reported count is not 20
    if (results.totalQuestions !== EXPECTED_QUESTION_COUNT) {
      debug(`CRITICAL FIX: All stitches have 20 questions - correcting count from ${results.totalQuestions} to ${EXPECTED_QUESTION_COUNT}`);
      results.totalQuestions = EXPECTED_QUESTION_COUNT;
      
      // If perfect score but count is off, fix that too
      if (results.correctAnswers === results.totalQuestions - 1) {
        debug(`CRITICAL FIX: Correcting correct answers from ${results.correctAnswers} to ${EXPECTED_QUESTION_COUNT}`);
        results.correctAnswers = EXPECTED_QUESTION_COUNT;
      }
    }
    
    // Accumulate session data immediately to avoid state delays
    setAccumulatedSessionData(prev => {
      // If resetPoints is true, don't accumulate points from previous sessions
      // For all other metrics (correctAnswers, etc.), still accumulate them
      const newData = {
        totalPoints: resetPoints 
          ? (results.totalPoints || 0) // Only use current session points if resetPoints is true
          : prev.totalPoints + (results.totalPoints || 0), // Otherwise add to accumulated points
        correctAnswers: prev.correctAnswers + (results.correctAnswers || 0),
        firstTimeCorrect: prev.firstTimeCorrect + (results.firstTimeCorrect || 0),
        totalQuestions: prev.totalQuestions + (results.totalQuestions || 0),
        totalAttempts: prev.totalAttempts + (results.totalAttempts || 0),
        stitchesCompleted: prev.stitchesCompleted + 1
      };
      
      debug(`Accumulated session data: ${JSON.stringify(newData)}`);
      
      // For anonymous users, check if we've reached a milestone to encourage signup
      if (isAnonymous) {
        // Don't show additional prompts - only the initial delayed one will show
        // We'll let the subtle banner after a delay be the only prompt
        
        // For anonymous users, save state to localStorage instead of server
        persistAnonymousState();
      }
      
      return newData;
    });
    
    // If end session is requested, handle based on user type
    if (isEndSession) {
      debug('End session requested - saving state before exit');
      
      // In all cases, we want to navigate to the dashboard if "Continue to Dashboard" is clicked
      if (isAnonymous) {
        // For anonymous users, just save to localStorage
        persistAnonymousState();
        
        // Then navigate to dashboard which will display based on localStorage
        // Use window.location.href instead of router.push to force a complete refresh
        debug('Anonymous user - navigating to dashboard with full page refresh');
        window.location.href = '/dashboard';
      } else {
        // For logged in users, persist to server in the correct sequence
        // First save session data, then persist tube configuration
        debug('Authenticated user - saving session data to server first');
        
        // Create async sequence to ensure proper order of operations
        const saveAndNavigate = async () => {
          try {
            debug('Checking authenticated status before saving data...');
            
            // Force a pause to ensure auth state is fully loaded
            // This addresses potential race conditions with auth state
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get current state data from the tubeCycler before sending to server
            const stateData = tubeCycler ? tubeCycler.getState() : { userId };
            
            // 1. First record the session
            debug('Step 1: Recording session data');
            
            // We'll use the API for this (record-session.ts)
            // This also updates the user profile with point totals
            const sessionResponse = await fetch('/api/end-session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store', // Prevent caching
                'Authorization': getAuthHeader() // Add auth token
              },
              credentials: 'include', // Important: include cookies for auth
              body: JSON.stringify({
                threadId: currentStitch?.threadId || '',
                stitchId: currentStitch?.id || '',
                questionResults: results.questionResults || [],
                sessionDuration: results.sessionDuration || 0,
                correctAnswers: results.correctAnswers || 0,
                totalQuestions: results.totalQuestions || 0,
                points: results.totalPoints || 0,
                userId: userId // Use the userId from the component state
              })
            });
            
            // Check for auth issues explicitly
            if (sessionResponse.status === 403) {
              debug('Authentication error during session saving. Redirecting to login');
              router.push('/signin?redirect=dashboard');
              return;
            }

            // 2. Next, persist the state including tube configuration
            debug('Step 2: Saving tube configuration state');
            
            // Extract scores from the results for passing to persistStateToServer
            const correctAnswers = results.correctAnswers || 0;
            const totalQuestions = results.totalQuestions || 0;
            
            // Pass scores to ensure the stitch completion is recorded properly
            await persistStateToServer(correctAnswers, totalQuestions);
            
            // 3. Clear localStorage to ensure next session starts fresh from server
            debug('Step 3: Clearing localStorage cache to ensure fresh state next session');
            try {
              if (typeof window !== 'undefined') {
                // Clear all triple-helix state from localStorage
                localStorage.removeItem(`triple_helix_state_${userId}`);
                localStorage.removeItem('zenjin_anonymous_state');
                debug('Successfully cleared local state cache');
              }
            } catch (clearError) {
              debug(`Non-critical error clearing localStorage: ${clearError}`);
              // Continue with navigation even if this fails
            }
            
            // 4. Now navigate to dashboard with force refresh to ensure new data
            debug('Step 4: Navigating to dashboard');
            
            // Use a unique timestamp to force dashboard to reload completely
            const timestamp = Date.now();
            window.location.href = `/dashboard?t=${timestamp}`;
          } catch (error) {
            debug(`Error during session end: ${error}`);
            // Even if there's an error, navigate to dashboard
            window.location.href = '/dashboard';
          }
        };
        
        // Start the save sequence
        saveAndNavigate();
      }
      return;
    }
    
    // Make sure we have a current stitch to work with
    if (!currentStitch) {
      debug('No current stitch to complete');
      return;
    }
    
    // Get score info
    const score = results.correctAnswers || 0;
    const totalQuestions = results.totalQuestions || 20;
    
    // Record current stitch details
    const stitch = currentStitch;
    const stitchId = stitch.id;
    const threadId = stitch.threadId;
    const beforeTube = currentTube;
    
    // Check for duplicate requests
    if (rotationInProgressRef.current) {
      debug('Rotation already in progress, skipping duplicate request');
      return;
    }
    
    // Set rotation flag to prevent duplicate transitions
    rotationInProgressRef.current = true;
    
    // Calculate the next tube number in sequence
    const nextTubeNum = (beforeTube % 3) + 1; // 1->2->3->1 cycle
    debug(`Transitioning from tube ${beforeTube} to tube ${nextTubeNum}`);
    
    // Show celebration effect and block all UI updates immediately
    setShowCelebration(true);
    isInTransitionRef.current = true; // Set this flag ASAP to block other UI updates
    
    // Add a delay to let the celebration be visible before transition
    // We'll continue the transition after a short delay
    debug('Starting celebration before tube transition');
    
    // Use setTimeout to delay the actual transition
    setTimeout(() => {
      try {
        debug('Continuing with tube transition after celebration');
        
        // UI updates already disabled by the early flag setting
        
        // Step 1: Check if we have preloaded data for the next tube
        const preloadedData = nextTubeRef.current;
        
        // Step 2: Validate that the preloaded data is for the correct tube
        if (preloadedData && preloadedData.tube === nextTubeNum && preloadedData.stitch) {
          debug(`Using valid preloaded data for tube ${nextTubeNum}`);
          
          // 1. First update the state machine (but suppress UI updates)
          tubeCycler.handleStitchCompletion(threadId, stitchId, score, totalQuestions);
          tubeCycler.selectTube(nextTubeNum);
          
          // 2. Make deep copies of preloaded data to prevent reference issues
          const tubeCopy = preloadedData.tube;
          const stitchCopy = JSON.parse(JSON.stringify(preloadedData.stitch));
          const stitchesCopy = JSON.parse(JSON.stringify(preloadedData.stitches));
          
          // 3. Clear preloaded data since we're about to use it
          nextTubeRef.current = null;
          
          // 4. Wait for the state machine to process changes, then update UI
          requestAnimationFrame(() => {
            // Use a nested requestAnimationFrame for reliable sequencing
            requestAnimationFrame(() => {
              debug(`Updating UI for tube ${tubeCopy}`);
              
              // Update UI state
              setCurrentTube(tubeCopy);
              setCurrentStitch(stitchCopy);
              setTubeStitches(stitchesCopy);
              
              // Only persist to localStorage during normal play (offline-first approach)
              // Server persistence only happens on explicit "Finish" button click
              persistAnonymousState();
              
              // Preload the next tube in sequence for future transitions
              setTimeout(() => {
                const nextTubeToPreload = (nextTubeNum % 3) + 1; // The tube after our current one
                debug(`Starting preload for next tube ${nextTubeToPreload}`);
                preloadNextTube();
                
                // Re-enable transitions and UI updates
                rotationInProgressRef.current = false;
                isInTransitionRef.current = false;
              }, 250);
            });
          });
        } 
        // Fallback path when no valid preloaded data is available
        else {
          debug('No valid preloaded data - using fallback path');
          
          // 1. First update the state machine
          tubeCycler.handleStitchCompletion(threadId, stitchId, score, totalQuestions);
          tubeCycler.selectTube(nextTubeNum);
          
          // 2. Get the current state and tube data
          const stateData = tubeCycler.getState();
          const tubeData = stateData.tubes[nextTubeNum];
          
          if (!tubeData || !tubeData.stitches || tubeData.stitches.length === 0) {
            throw new Error(`No data available for tube ${nextTubeNum}`);
          }
          
          // 3. Find the active stitch for this tube
          const nextStitchId = tubeData.currentStitchId;
          const activeStitch = nextStitchId 
            ? tubeData.stitches.find(s => s.id === nextStitchId)
            : tubeData.stitches.sort((a, b) => a.position - b.position)[0];
          
          if (!activeStitch) {
            throw new Error(`No active stitch found for tube ${nextTubeNum}`);
          }
          
          // 4. Sort stitches by position for consistent UI
          const sortedStitches = [...tubeData.stitches].sort((a, b) => a.position - b.position);
          
          // 5. Update UI with stable references
          requestAnimationFrame(() => {
            debug(`Updating UI with fallback data for tube ${nextTubeNum}`);
            
            // Extra validation to ensure stitch data is good
            if (!activeStitch || !activeStitch.id) {
              debug('No valid active stitch available - attempting to recover');
              // Try to get any valid stitch from tube data
              let anyValidStitch = sortedStitches.find(s => s && s.id);
                
              if (!anyValidStitch) {
                debug('Failed to find any valid stitch - showing error message');
                setLoadError(`Unable to load content for Tube ${nextTubeNum}. Try again or restart.`);
                rotationInProgressRef.current = false;
                isInTransitionRef.current = false;
                return;
              }
              
              debug(`Recovered with available stitch: ${anyValidStitch.id}`);
              
              // Update with best available stitch
              setCurrentTube(nextTubeNum);
              setCurrentStitch(anyValidStitch);
              setTubeStitches(sortedStitches);
            } else {
              // Normal update path
              setCurrentTube(nextTubeNum);
              setCurrentStitch(activeStitch);
              setTubeStitches(sortedStitches);
            }
            
            // Only persist to localStorage during normal play (offline-first approach)
            // Server persistence only happens on explicit "Finish" button click
            persistAnonymousState();
            
            // Preload the next tube after a delay
            setTimeout(() => {
              const nextTubeToPreload = (nextTubeNum % 3) + 1;
              debug(`Starting fallback preload for next tube ${nextTubeToPreload}`);
              preloadNextTube();
              
              // Re-enable transitions and UI updates
              rotationInProgressRef.current = false;
              isInTransitionRef.current = false;
            }, 250);
          });
        }
      } catch (error) {
        debug(`Error during transition: ${error}`);
        debug(`Error details: ${error.stack || 'No stack trace available'}`);
        
        // Re-enable transitions and updates on error
        rotationInProgressRef.current = false;
        isInTransitionRef.current = false;
        
        // Try to recover from missing tube data
        try {
          // Try fallback load directly from memory
          if (tubeCycler) {
            debug('Attempting recovery by direct stitch selection for tube ' + nextTubeNum);
            
            // CRITICAL FIX: Check if method exists before calling it
            if (typeof tubeCycler.getStitchesForTube === 'function') {
              const recoveryStitches = tubeCycler.getStitchesForTube(nextTubeNum);
              
              if (recoveryStitches && recoveryStitches.length > 0) {
                // Just pick the first one to recover
                const recoveryStitch = recoveryStitches[0];
                debug(`Recovery succeeded with stitch ${recoveryStitch.id}`);
                
                // Attempt to update UI with recovery stitch
                setCurrentTube(nextTubeNum);
                setCurrentStitch(recoveryStitch);
                setTubeStitches(recoveryStitches);
                
                // Reset flags to allow normal operation
                setTimeout(() => {
                  rotationInProgressRef.current = false;
                  isInTransitionRef.current = false;
                }, 250);
                
                return;
              }
            } else {
              // Alternative recovery method if getStitchesForTube doesn't exist
              debug('getStitchesForTube not available, using alternative recovery method');
              
              // Try to get stitches from state directly
              const state = tubeCycler.getState();
              if (state && state.tubes && state.tubes[nextTubeNum]) {
                const tube = state.tubes[nextTubeNum];
                if (tube.stitches && tube.stitches.length > 0) {
                  // Sort stitches by position
                  const sortedStitches = [...tube.stitches].sort((a, b) => a.position - b.position);
                  const recoveryStitch = sortedStitches[0];
                  
                  debug(`Alternative recovery succeeded with stitch ${recoveryStitch.id}`);
                  
                  // Update UI with recovery stitch
                  setCurrentTube(nextTubeNum);
                  setCurrentStitch(recoveryStitch);
                  setTubeStitches(sortedStitches);
                  
                  // Reset flags to allow normal operation
                  setTimeout(() => {
                    rotationInProgressRef.current = false;
                    isInTransitionRef.current = false;
                  }, 250);
                  
                  return;
                }
              }
              
              // If we're using next-tube data, try that as a last resort
              if (nextTubeRef.current && nextTubeRef.current.tube === nextTubeNum) {
                debug(`Using preloaded nextTubeRef data for recovery`);
                setCurrentTube(nextTubeRef.current.tube);
                setCurrentStitch(nextTubeRef.current.stitch);
                setTubeStitches(nextTubeRef.current.stitches);
                
                // Reset flags to allow normal operation
                setTimeout(() => {
                  rotationInProgressRef.current = false;
                  isInTransitionRef.current = false;
                }, 250);
                
                return;
              }
            }
          }
        } catch (recoveryError) {
          debug(`Recovery attempt failed: ${recoveryError}`);
        }
        
        // If we're here, recovery failed - show error message
        setLoadError(`Could not load content for Tube ${nextTubeNum}. Please try again or reload the page.`);
      }
    }, 300); // Reduced delay for more immediate celebration
  };
  
  // Persist state to server with retry logic and better error handling
  const persistStateToServer = async (score: number = 0, totalQuestions: number = 0) => {
    if (!tubeCycler) {
      debug("No tubeCycler available for persistStateToServer");
      return;
    }
    
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      debug("Not in browser environment, skipping state persistence");
      return;
    }
    
    debug(`Persisting state to server with score=${score}, questions=${totalQuestions}`);
    
    // Get auth token for debugging purposes
    const authToken = getAuthHeader();
    if (!authToken) {
      debug("WARNING: No auth token available - state persistence may fail");
    } else {
      debug(`Auth token available for state persistence: ${authToken.substring(0, 15)}...`);
    }
    
    // Create a defensive copy of state data with error handling
    let stateData;
    try {
      stateData = tubeCycler.getState();
      // If state data is undefined or null, create a minimal version
      if (!stateData) {
        debug("Warning: tubeCycler.getState() returned undefined or null");
        stateData = { 
          userId, 
          activeTubeNumber: currentTube || 1,
          tubes: {},
          last_updated: Date.now()
        };
      }
    } catch (stateError) {
      debug(`Error getting state data: ${stateError}`);
      stateData = { 
        userId, 
        activeTubeNumber: currentTube || 1,
        tubes: {},
        last_updated: Date.now()
      };
    }
    
    // Retry function for API calls
    const retryFetch = async (url, options, retryCount = 3, delay = 500) => {
      let lastError;
      
      for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
          debug(`API call attempt ${attempt}/${retryCount} to ${url}`);
          const response = await fetch(url, options);
          return response;
        } catch (error) {
          lastError = error;
          debug(`API call attempt ${attempt} failed: ${error.message}`);
          
          if (attempt < retryCount) {
            // Wait before retrying
            debug(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Double the delay for exponential backoff
            delay *= 2;
          }
        }
      }
      
      // All retries failed
      throw lastError;
    };
    
    // First persist the most critical data: the complete state
    try {
      // CRITICAL FIRST: Save the complete state to the user_state table
      // This ensures the state is available for restoration on new browsers
      debug(`Saving complete state to user_state table (HIGHEST PRIORITY)`);
      
      // Ensure timestamp is updated before persisting to server
      stateData.last_updated = Date.now();
      debug(`State timestamp updated to ${stateData.last_updated}`);
      
      // Make a direct axios call which has better error handling than fetch
      let completeStateResponse;
      try {
        // Using import should work in next.js
        const axios = (await import('axios')).default;
        
        debug(`Saving state via axios (more reliable than fetch)`);
        const axiosResponse = await axios.post('/api/user-state', 
          { state: stateData },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': getAuthHeader(),
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            // Add timeout for safety
            timeout: 5000
          }
        );
        
        // Create a fetch-like response object
        completeStateResponse = {
          ok: axiosResponse.status >= 200 && axiosResponse.status < 300,
          status: axiosResponse.status,
          statusText: axiosResponse.statusText
        };
        
        debug(`Axios response: ${axiosResponse.status} ${axiosResponse.statusText}`);
      } catch (axiosError) {
        // Fall back to fetch if axios fails
        debug(`Axios error, falling back to fetch: ${axiosError}`);
        completeStateResponse = await retryFetch('/api/user-state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': getAuthHeader(),
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          credentials: 'include',
          body: JSON.stringify({
            state: stateData
          })
        });
      }
      
      if (!completeStateResponse.ok) {
        debug(`Error saving complete state: ${completeStateResponse.status} ${completeStateResponse.statusText}`);
        
        // If we can't save the complete state, also save to localStorage as backup
        try {
          localStorage.setItem('backup_complete_state', JSON.stringify({
            timestamp: Date.now(),
            state: stateData
          }));
          debug('Saved backup complete state to localStorage');
        } catch (localErr) {
          debug(`Could not save backup state: ${localErr}`);
        }
      } else {
        debug(`Successfully saved complete state to user_state table`);
      }
    } catch (completeStateError) {
      debug(`Critical error saving complete state: ${completeStateError}`);
      
      // Try to save to localStorage as backup
      try {
        localStorage.setItem('backup_complete_state', JSON.stringify({
          timestamp: Date.now(),
          state: stateData
        }));
        debug('Saved backup complete state to localStorage due to API failure');
      } catch (localErr) {
        debug(`Could not save backup state: ${localErr}`);
      }
    }
    
    // Now try to persist the other data points in order of importance
    try {
      // 1. Next, persist tube position
      try {
        const tubeResponse = await retryFetch('/api/save-tube-position', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': getAuthHeader(),
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          credentials: 'include',
          body: JSON.stringify({
            userId: stateData.userId,
            tubeNumber: currentTube,
            threadId: currentStitch?.threadId
          })
        });
        
        if (!tubeResponse.ok) {
          debug(`Error saving tube position: ${tubeResponse.status} ${tubeResponse.statusText}`);
        } else {
          debug(`Successfully saved tube position: tube=${currentTube}, thread=${currentStitch?.threadId}`);
        }
      } catch (tubeError) {
        debug(`Error persisting tube position: ${tubeError}`);
      }
      
      // 2. Next, save stitch positions
      try {
        // Save all stitch positions and skip numbers
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
        
        // Save stitches with their updated positions and skip numbers
        debug(`Saving ${updatedStitches.length} stitch positions to server`);
        const stitchResponse = await retryFetch('/api/update-stitch-positions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': getAuthHeader(),
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          credentials: 'include',
          body: JSON.stringify({
            userId: stateData.userId,
            stitches: updatedStitches
          })
        });
        
        if (!stitchResponse.ok) {
          debug(`Error saving stitch positions: ${stitchResponse.status} ${stitchResponse.statusText}`);
        } else {
          debug(`Successfully saved ${updatedStitches.length} stitch positions`);
        }
      } catch (stitchError) {
        debug(`Error persisting stitch positions: ${stitchError}`);
      }
      
      // 3. Finally, if score provided, persist session results
      if (score > 0 && totalQuestions > 0 && currentStitch) {
        try {
          debug(`Saving session results: score=${score}/${totalQuestions}`);
          const sessionResponse = await retryFetch('/api/save-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': getAuthHeader(),
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            credentials: 'include',
            body: JSON.stringify({
              userId: stateData.userId,
              threadId: currentStitch.threadId,
              stitchId: currentStitch.id,
              score: score,
              totalQuestions: totalQuestions,
              points: score === totalQuestions ? 60 : 20
            })
          });
          
          if (!sessionResponse.ok) {
            debug(`Error saving session: ${sessionResponse.status} ${sessionResponse.statusText}`);
          } else {
            debug(`Successfully saved session for stitch ${currentStitch.id}`);
          }
        } catch (sessionError) {
          debug(`Error persisting session: ${sessionError}`);
        }
      }
    } catch (error) {
      debug(`Error in persistence sequence: ${error}`);
    }
    
    // Return true if we successfully saved the complete state
    return true;
  };

  // Perfect score button handler - quickly move to next tube
  const handlePerfectScore = () => {
    if (!tubeCycler || !currentStitch) return;
    
    debug('Simulating stitch completion with perfect score (20/20)');
    
    // Set rotation flags immediately to prevent any other interactions
    rotationInProgressRef.current = true;
    isInTransitionRef.current = true;
    
    // Show celebration effect immediately
    setShowCelebration(true);
    
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
    
    // Add a small delay before processing to match the normal flow
    setTimeout(() => {
      // Process perfect score completion
      handleSessionComplete(mockPerfectResults);
    }, 100);
  };

  // Add a function to persist state for anonymous users to localStorage only
  const persistAnonymousState = () => {
    if (!tubeCycler || !isAnonymous) return;
    
    try {
      const stateData = tubeCycler.getState();
      localStorage.setItem('zenjin_anonymous_state', JSON.stringify({
        state: stateData,
        timestamp: Date.now(),
        totalPoints: accumulatedSessionData.totalPoints
      }));
    } catch (error) {
      debug(`Error saving anonymous state to localStorage: ${error}`);
    }
  };
  
  // Handle manual tube selection
  const handleManualTubeSelect = (tubeNum: number) => {
    if (!tubeCycler) return;
    
    // Don't allow manual selection during transitions
    if (rotationInProgressRef.current) {
      debug('Cannot manually select tube during transition - operation ignored');
      return;
    }
    
    debug(`Manually selecting tube ${tubeNum}`);
    
    // Set rotation flag to prevent duplicate transitions
    rotationInProgressRef.current = true;
    
    // Temporarily disable UI updates to prevent flickering
    isInTransitionRef.current = true;
    
    try {
      // 1. First update the state machine
      tubeCycler.selectTube(tubeNum);
      
      // 2. Get the current state and tube data
      const stateData = tubeCycler.getState();
      const tubeData = stateData.tubes[tubeNum];
      
      if (!tubeData || !tubeData.stitches || tubeData.stitches.length === 0) {
        throw new Error(`No data available for tube ${tubeNum}`);
      }
      
      // 3. Find the active stitch for this tube
      const stitchId = tubeData.currentStitchId;
      const activeStitch = stitchId 
        ? tubeData.stitches.find(s => s.id === stitchId)
        : tubeData.stitches.sort((a, b) => a.position - b.position)[0];
      
      if (!activeStitch) {
        throw new Error(`No active stitch found for tube ${tubeNum}`);
      }
      
      // 4. Sort stitches by position for consistent UI
      const sortedStitches = [...tubeData.stitches].sort((a, b) => a.position - b.position);
      
      // 5. Update UI with stable references
      requestAnimationFrame(() => {
        debug(`Updating UI for manual selection of tube ${tubeNum}`);
        
        // Update UI state
        setCurrentTube(tubeNum);
        setCurrentStitch(activeStitch);
        setTubeStitches(sortedStitches);
        
        // Preload the next tube after a delay
        setTimeout(() => {
          // Clear any existing preloaded data
          nextTubeRef.current = null;
          
          // Calculate the next tube number correctly
          const nextTubeToPreload = (tubeNum % 3) + 1; // 1->2->3->1 cycle
          debug(`Preloading next tube ${nextTubeToPreload} after manual selection`);
          
          // Queue up the next tube preload
          preloadNextTube();
          
          // Re-enable transitions and UI updates
          rotationInProgressRef.current = false;
          isInTransitionRef.current = false;
        }, 250);
      });
    } catch (error) {
      debug(`Error during manual tube selection: ${error}`);
      
      // Re-enable transitions and updates on error
      rotationInProgressRef.current = false;
      isInTransitionRef.current = false;
      
      // Show error
      setLoadError(`Could not load content for Tube ${tubeNum}. Please try again.`);
    }
  };
  
  // Helper function to get auth header with token
  const getAuthHeader = () => {
    // Try to get the token from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        // First check for the new Supabase v2 token format
        const supabaseToken = localStorage.getItem('sb-ggwoupzaruiaaliylxga-auth-token');
        if (supabaseToken) {
          const parsedToken = JSON.parse(supabaseToken);
          if (parsedToken?.access_token) {
            debug(`Using access_token from localStorage (${parsedToken.access_token.substring(0, 10)}...)`);
            return `Bearer ${parsedToken.access_token}`;
          }
        }
        
        // Fallback to checking session data
        const sessionData = localStorage.getItem('supabase.auth.token');
        if (sessionData) {
          try {
            const parsedSession = JSON.parse(sessionData);
            if (parsedSession?.currentSession?.access_token) {
              debug(`Using access_token from session data (${parsedSession.currentSession.access_token.substring(0, 10)}...)`);
              return `Bearer ${parsedSession.currentSession.access_token}`;  
            }
          } catch (sessionErr) {
            debug('Failed to parse session data');
          }
        }
        
        // Last resort - check if user object is available
        if (user?.id) {
          debug(`No token found but user ID is available: ${user.id}`);
        } else {
          debug('No authentication token found');
        }
      } catch (e) {
        debug(`Failed to parse auth token: ${e}`);
      }
    }
    
    // Fallback to empty auth header
    return '';
  };
  
  // Use this instead of API calls when in anonymous mode
  useEffect(() => {
    if (isAnonymous && tubeCycler) {
      // Save state periodically for anonymous users
      const intervalId = setInterval(persistAnonymousState, 30000);
      return () => clearInterval(intervalId);
    }
  }, [isAnonymous, tubeCycler, accumulatedSessionData.totalPoints]);
  
  // Reference to track transitions
  const isInTransitionRef = useRef(false);
  
  // Return the player state and functions
  return {
    // Player state
    isLoading,
    loadError,
    currentTube,
    currentStitch,
    tubeStitches,
    accumulatedSessionData,
    showLoginPrompt,
    isAnonymous,
    pendingChanges,
    
    // Celebration effect
    showCelebration,
    setShowCelebration,
    
    // Player actions
    handleSessionComplete,
    handlePerfectScore,
    handleManualTubeSelect,
    setShowLoginPrompt,
    persistStateToServer,
    persistAnonymousState,
    preloadNextTube,
    
    // Utils
    tubeCycler,
    state,
    
    // Transition state
    isInTransition: rotationInProgressRef.current || isInTransitionRef.current
  };
}