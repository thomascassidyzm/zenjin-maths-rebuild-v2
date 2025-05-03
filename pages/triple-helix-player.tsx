import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { ThreadData, StitchWithProgress } from '../lib/types/distinction-learning';
import DistinctionPlayer from '../components/DistinctionPlayer';
import axios from 'axios';

// Import the enhanced Triple-Helix components
import { TubeCyclerAdapter, ContentManager, SessionManager } from '../lib/triple-helix';

/**
 * Triple-Helix Player - Enhanced Version
 * 
 * An integrated player using the improved Triple-Helix architecture:
 * - Correct skip number progression (1→3→5→10→25→100)
 * - Proper stitch repositioning after perfect scores
 * - Content preloading for smooth transitions
 * - Batch persistence of changes
 * 
 * This maintains the DistinctionPlayer UI while implementing the
 * correct Triple-Helix logic "under the hood".
 */
export default function TripleHelixPlayer() {
  const router = useRouter();
  const { isAuthenticated, user, userEmail } = useAuth();
  
  // State
  const [userId, setUserId] = useState<string>('anonymous');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeStitch, setActiveStitch] = useState<any>(null);
  const [activeThreadId, setActiveThreadId] = useState<string>('');
  const [currentTube, setCurrentTube] = useState<number>(1);
  const [tubeCycler, setTubeCycler] = useState<any>(null);
  const [sessionResults, setSessionResults] = useState<any>(null);
  const [points, setPoints] = useState<number>(0);
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [pendingChanges, setPendingChanges] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string>('Loading Triple-Helix player...');
  
  // Debug mode for development
  const DEBUG = process.env.NODE_ENV === 'development';
  
  // Initialize the Triple-Helix system
  useEffect(() => {
    if (initialized) return;
    
    // Set userId based on authentication state
    const uid = isAuthenticated ? (user?.id || 'anonymous') : `anonymous-${Date.now()}`;
    setUserId(uid);
    
    if (DEBUG) console.log(`Initializing Triple-Helix for user: ${uid}`);
    
    // Initialize TubeCyclerAdapter with all enhancements
    const adapter = new TubeCyclerAdapter({
      userId: uid,
      debug: DEBUG, // Enable debug logging in development
      onStateChange: (state: any) => {
        if (DEBUG) console.log('State changed:', state.activeTubeNumber);
        
        // Update current tube
        const tubeNumber = state.activeTubeNumber;
        setCurrentTube(tubeNumber);
        
        // Get active stitch from adapter
        const stitch = adapter.getCurrentStitch();
        if (stitch) {
          setActiveStitch(stitch);
          setActiveThreadId(stitch.threadId);
        }
        
        // Update points
        setTotalPoints(state.totalPoints || 0);
        
        // Update pending changes count
        const pendingCount = state.pendingChanges?.length || 0;
        setPendingChanges(pendingCount);
      },
      onTubeChange: (tubeNumber: number) => {
        if (DEBUG) console.log(`Tube changed to: ${tubeNumber}`);
        setCurrentTube(tubeNumber);
      },
      onContentLoad: (stitchId: string) => {
        if (DEBUG) console.log(`Content loaded for stitch: ${stitchId}`);
      },
      // Configure auto persistence (every 5 minutes)
      persistenceInterval: 5 * 60 * 1000, // 5 minutes in milliseconds
      autoPersist: true
    });
    
    setTubeCycler(adapter);
    
    // Initial state setting
    setCurrentTube(adapter.getCurrentTube());
    setActiveStitch(adapter.getCurrentStitch());
    setActiveThreadId(adapter.getCurrentThread());
    setTotalPoints(adapter.getState().totalPoints || 0);
    
    // Try to load state from server if authenticated
    if (isAuthenticated && user?.id) {
      setLoadingMessage('Loading your progress...');
      loadStateFromServer(uid, adapter);
    } else {
      setIsLoading(false);
      setInitialized(true);
      if (DEBUG) console.log('Triple-Helix initialized with default state for anonymous user');
    }
    
    // Clean up on unmount
    return () => {
      if (adapter) {
        adapter.destroy(); // This handles persisting remaining changes
      }
    };
  }, [isAuthenticated, user?.id, initialized]);
  
  // Load state from server
  const loadStateFromServer = async (userId: string, adapter: any) => {
    try {
      setLoadingMessage('Loading saved progress...');
      const response = await axios.get(`/api/user-state?userId=${userId}&debug=true`);
      
      if (response.data.success && response.data.state) {
        if (DEBUG) {
          console.log('Loaded saved state from server');
          
          // Check if state is in the expected format
          if (typeof response.data.state === 'object' && response.data.state.tubes) {
            console.log('Server state timestamp:', response.data.state.last_updated || 'unknown');
          } else if (response.data.last_updated) {
            console.log('Server state timestamp (from response):', response.data.last_updated);
          } else {
            console.log('No timestamp found in state');
          }
        }
        
        // Update adapter with saved state from server
        // We've changed the strategy to ALWAYS use server state
        const savedState = response.data.state;
        if (savedState.tubes) {
          // Clear any existing local state to avoid confusion
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem(`triple_helix_state_${userId}`);
              if (DEBUG) console.log('Cleared local state to enforce server state');
            } catch (err) {
              if (DEBUG) console.warn('Could not clear localStorage:', err);
            }
          }
          
          // Set the adapter state directly from server
          adapter.stateMachine.state = savedState;
          
          // Check which state was actually used (local or server)
          if (DEBUG) {
            const currentState = adapter.getState();
            console.log(
              'Final state used timestamp:', 
              currentState.last_updated || 'unknown',
              'Source:', currentState.last_updated === savedState.last_updated ? 'SERVER' : 'LOCAL'
            );
          }
          
          // Update local state
          setCurrentTube(adapter.getCurrentTube());
          setActiveStitch(adapter.getCurrentStitch());
          setActiveThreadId(adapter.getCurrentThread());
          setTotalPoints(adapter.getState().totalPoints || 0);
          
          if (DEBUG) console.log('State loaded and reconciled successfully');
        }
      } else {
        if (DEBUG) console.log('No state found on server or failed to load');
      }
    } catch (error) {
      if (DEBUG) console.log('Error loading state from server:', error);
    } finally {
      setIsLoading(false);
      setInitialized(true);
      
      // Start preloading content
      if (adapter) {
        const nextStitches = adapter.stateMachine.getNextStitchesToPreload?.(5) || [];
        if (nextStitches.length > 0 && adapter.contentManager?.preloadStitches) {
          adapter.contentManager.preloadStitches(nextStitches);
        }
      }
    }
  };
  
  // Format stitch for DistinctionPlayer
  const formatStitchForPlayer = (stitch: any) => {
    if (!stitch) return null;
    
    // Ensure stitch has questions
    if (!stitch.questions || !Array.isArray(stitch.questions) || stitch.questions.length === 0) {
      // Generate sample math questions
      const mathOperations = ['+', '-', '×', '÷'];
      const sampleQuestions = [];
      
      // Generate 20 sample math questions
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
      
      stitch.questions = sampleQuestions;
    }
    
    return {
      ...stitch,
      order_number: stitch.position,
      skip_number: stitch.skipNumber,
      distractor_level: stitch.distractorLevel
    };
  };
  
  // Handle stitch completion - THIS IS THE CORE FUNCTION
  const handleStitchCompletion = (results: any) => {
    if (!tubeCycler || !activeStitch) return;
    
    if (DEBUG) console.log('Stitch completed with results:', results);
    setSessionResults(results);
    
    // Get score information
    const score = results.correctAnswers || 0;
    const totalQuestions = results.totalQuestions || 20;
    const isPerfectScore = score === totalQuestions;
    
    // Update local points
    setPoints(prev => prev + score);
    
    if (DEBUG) console.log(`${isPerfectScore ? 'PERFECT' : 'PARTIAL'} score: ${score}/${totalQuestions}`);
    
    // TRUE LIVE AID MODEL IMPLEMENTATION
    // 1. FIRST: Process the completion BEFORE UI changes
    // This ensures all state is consistent before any UI changes
    
    // Process the stitch completion with the enhanced adapter
    tubeCycler.handleStitchCompletion(
      activeThreadId,
      activeStitch.id,
      score,
      totalQuestions
    );
    
    // 2. THEN rotate to the next tube - after state is fully updated
    tubeCycler.nextTube();
    
    // Get stats before clearing the results
    if (DEBUG) {
      // Get statistics (development only)
      const stats = tubeCycler.getStats();
      console.log('Session stats:', stats);
    }
    
    // 3. FINALLY: Update UI after all processing is complete
    setSessionResults(null);
  };
  
  // Handle session end
  const handleEndSession = async (results: any) => {
    if (!tubeCycler) return;
    
    if (DEBUG) console.log('Session ended with results:', results);
    setSessionResults(results);
    
    // Process any final results
    if (activeStitch) {
      const score = results.correctAnswers || 0;
      const totalQuestions = results.totalQuestions || 20;
      
      tubeCycler.handleStitchCompletion(
        activeThreadId,
        activeStitch.id,
        score,
        totalQuestions
      );
    }
    
    // Always force persistence of state changes, even if pendingChanges is 0
    // This ensures the server has the latest state
    try {
      setLoadingMessage('Saving your progress...');
      setIsLoading(true);
      
      // Force immediate persistence of all changes
      if (tubeCycler.persist) {
        await tubeCycler.persist();
      }
      
      // Ensure state is sent to the server
      if (isAuthenticated && user?.id) {
        // Make a direct API call to ensure state persistence
        try {
          const state = tubeCycler.getState();
          
          // Update timestamp
          state.last_updated = Date.now();
          
          if (DEBUG) console.log('Sending final state to server:', state.last_updated);
          
          const response = await axios.post('/api/user-state', { 
            state 
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            }
          });
          
          if (response.data.success) {
            if (DEBUG) console.log('Final state successfully saved to server');
          } else {
            if (DEBUG) console.error('Server returned error when saving state:', response.data.error);
          }
        } catch (serverErr) {
          if (DEBUG) console.error('Error sending state to server:', serverErr);
        }
      }
      
      if (DEBUG) console.log('Final state persisted to server');
    } catch (error) {
      if (DEBUG) console.error('Error persisting final state:', error);
    } finally {
      setIsLoading(false);
    }
    
    // Redirect to home
    setTimeout(() => {
      router.push('/');
    }, 1000);
  };
  
  // Prepare stitch and thread for player
  const playerStitch = formatStitchForPlayer(activeStitch);
  const playerThread = playerStitch ? {
    id: activeThreadId,
    name: `Thread ${activeThreadId.split('-').pop()}`,
    description: `Thread in Tube ${currentTube}`,
    stitches: [playerStitch]
  } : null;
  
  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center">
        <div className="text-center text-white">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
          <p>{loadingMessage}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen player-bg">
      <Head>
        <title>Triple-Helix Player | Zenjin Maths</title>
      </Head>
      
      {/* Tube indicator */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm flex items-center space-x-6">
          {[1, 2, 3].map(tubeNum => (
            <div key={tubeNum} className="flex items-center">
              <div 
                className={`w-3 h-3 rounded-full mr-1.5 ${tubeNum === currentTube ? 'bg-teal-400' : 'bg-white/30'}`}
              />
              <span className={tubeNum === currentTube ? 'text-teal-300' : 'text-white/50'}>
                Tube {tubeNum}
              </span>
            </div>
          ))}
          
          {/* Add pending changes indicator */}
          {pendingChanges > 0 && (
            <div className="ml-3 text-xs text-white/70 bg-indigo-600/50 px-2 py-0.5 rounded-full flex items-center">
              <span className="animate-pulse mr-1">⬤</span> {pendingChanges}
            </div>
          )}
        </div>
      </div>
      
      {/* Main player */}
      {sessionResults ? (
        /* Loading spinner during tube transition */
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center text-white">
            <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
            <p>Moving to next stitch...</p>
            {isPerfectScore(sessionResults) && (
              <p className="text-sm text-green-300 mt-1">Perfect Score! Advancing stitch...</p>
            )}
          </div>
        </div>
      ) : playerThread ? (
        /* DistinctionPlayer with active stitch */
        <div className="p-4 py-8">
          <DistinctionPlayer
            thread={playerThread}
            onComplete={handleStitchCompletion}
            onEndSession={handleEndSession}
            questionsPerSession={20}
            sessionTotalPoints={totalPoints}
          />
        </div>
      ) : (
        /* Error state - no active stitch */
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="bg-black/40 backdrop-blur-lg text-white rounded-xl p-8 max-w-md">
            <h2 className="text-xl font-bold mb-4">No Active Stitch</h2>
            <p className="mb-6">Could not find an active stitch in tube {currentTube}.</p>
            <button
              onClick={() => router.push('/')}
              className="bg-teal-600 hover:bg-teal-500 text-white py-2 px-4 rounded-lg"
            >
              Return Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to check if score is perfect
function isPerfectScore(results: any) {
  if (!results) return false;
  const score = results.correctAnswers || 0;
  const totalQuestions = results.totalQuestions || 0;
  return score === totalQuestions && totalQuestions > 0;
}