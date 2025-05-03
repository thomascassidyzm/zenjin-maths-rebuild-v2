import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { clearAnonymousData } from '../lib/anonymousData';
import { useTripleHelixPlayer } from '../lib/playerUtils';

/**
 * Testing Utilities Page
 * 
 * This page provides helpful tools for testing user flows, especially for
 * multi-user scenarios and authentication edge cases.
 * 
 * IMPORTANT: This page should be disabled or removed in production builds!
 */
export default function TestUtils() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tubeNum, setTubeNum] = useState<number>(1);
  const [completionScore, setCompletionScore] = useState<number>(20);
  
  // Initialize the player hook to access its functions
  const player = useTripleHelixPlayer({
    debug: (msg) => console.log(`[TestUtils] ${msg}`)
  });
  
  // Clear all localStorage data related to anonymous users
  const handleClearAnonymousData = () => {
    try {
      clearAnonymousData();
      setMessage('✅ Successfully cleared all anonymous user data');
      setError(null);
    } catch (err) {
      setError(`❌ Error clearing anonymous data: ${err}`);
      setMessage(null);
    }
  };
  
  // Clear all localStorage data (complete reset)
  const handleClearAllLocalStorage = () => {
    try {
      localStorage.clear();
      setMessage('✅ Successfully cleared all localStorage data');
      setError(null);
    } catch (err) {
      setError(`❌ Error clearing localStorage: ${err}`);
      setMessage(null);
    }
  };
  
  // Attempt to clear cookies (note: this has security limitations)
  const handleClearCookies = () => {
    try {
      // This simple approach only works for cookies without HttpOnly flag
      const cookies = document.cookie.split(";");
      
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      }
      
      setMessage('✅ Attempted to clear cookies. Some secure HttpOnly cookies may persist');
      setError(null);
    } catch (err) {
      setError(`❌ Error clearing cookies: ${err}`);
      setMessage(null);
    }
  };
  
  // Reset all browser state and reload
  const handleCompleteReset = () => {
    try {
      // First clear all local storage
      localStorage.clear();
      
      // Then attempt to clear cookies
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      }
      
      // Then reload the page to clear any in-memory state
      // Using the location.href to truly reset everything
      window.location.href = '/';
    } catch (err) {
      setError(`❌ Error during complete reset: ${err}`);
      setMessage(null);
    }
  };
  
  // Launch forced anonymous mode
  const launchAnonymousMode = () => {
    // First clear anonymous data to ensure a fresh start
    clearAnonymousData();
    
    // Then navigate to minimal player with forced anonymous mode
    window.location.href = '/minimal-player?mode=anonymous&force=true';
  };
  
  // Complete current stitch with perfect score
  const completeCurrentStitch = () => {
    try {
      if (!player.currentStitch) {
        throw new Error("No active stitch found. Please load a stitch first.");
      }
      
      const stitchId = player.currentStitch.id;
      const threadId = player.currentStitch.threadId;
      
      // Create a mock session result with perfect score
      const totalQuestions = completionScore;
      const mockSessionResults = {
        sessionId: `session-${Date.now()}`,
        correctAnswers: totalQuestions,
        firstTimeCorrect: totalQuestions,
        totalQuestions: totalQuestions,
        totalPoints: totalQuestions * 3, // 3 points per first-time correct
        questionResults: Array(totalQuestions).fill(0).map((_, i) => ({
          questionId: `q-${i+1}`,
          correct: true,
          timeToAnswer: 1500, // 1.5 seconds per question
          firstTimeCorrect: true
        })),
        blinkSpeed: 1.5, // Fast response time
        sessionDuration: totalQuestions * 1.5,
        completedAt: new Date().toISOString()
      };
      
      // Use the player hook to handle the session completion
      player.handleSessionComplete(mockSessionResults);
      
      setMessage(`✅ Successfully completed stitch ${stitchId} with perfect score (${totalQuestions}/${totalQuestions})`);
      setError(null);
    } catch (err) {
      setError(`❌ Error completing stitch: ${err}`);
      setMessage(null);
    }
  };
  
  // Complete specific tube's active stitch
  const completeSpecificTubeStitch = () => {
    try {
      // First select the tube
      player.handleManualTubeSelect(tubeNum);
      
      // Then complete after a short delay to allow tube selection to complete
      setTimeout(() => {
        if (!player.currentStitch) {
          setError(`❌ No active stitch found for tube ${tubeNum}`);
          return;
        }
        
        // Create a mock session result with perfect score
        const totalQuestions = completionScore;
        const mockSessionResults = {
          sessionId: `session-${Date.now()}`,
          correctAnswers: totalQuestions,
          firstTimeCorrect: totalQuestions,
          totalQuestions: totalQuestions,
          totalPoints: totalQuestions * 3, // 3 points per first-time correct
          questionResults: Array(totalQuestions).fill(0).map((_, i) => ({
            questionId: `q-${i+1}`,
            correct: true,
            timeToAnswer: 1500, // 1.5 seconds per question
            firstTimeCorrect: true
          })),
          blinkSpeed: 1.5, // Fast response time
          sessionDuration: totalQuestions * 1.5,
          completedAt: new Date().toISOString()
        };
        
        // Complete the session
        player.handleSessionComplete(mockSessionResults);
        
        setMessage(`✅ Successfully completed stitch in tube ${tubeNum} with score (${totalQuestions}/${totalQuestions})`);
        setError(null);
      }, 500); // Wait for tube selection to complete
    } catch (err) {
      setError(`❌ Error completing tube stitch: ${err}`);
      setMessage(null);
    }
  };
  
  // Complete multiple stitches in sequence
  const completeBulkStitches = async () => {
    try {
      // Use state to prevent conflicts
      setMessage("🔄 Running sequential stitch completions...");
      setError(null);
      
      // Define how many stitches to complete per tube
      const stitchesPerTube = 3;
      let completedCount = 0;
      let finalMessage = "";
      
      // Helper function to complete one stitch and wait
      const completeOneStitch = () => {
        return new Promise((resolve, reject) => {
          try {
            // Check if we have a current stitch
            if (!player.currentStitch) {
              reject("No current stitch found");
              return;
            }
            
            const stitchId = player.currentStitch.id;
            const currentTubeNum = player.currentTube;
            
            // Create mock result with perfect score
            const totalQuestions = completionScore;
            const mockSessionResults = {
              sessionId: `session-${Date.now()}-${completedCount}`,
              correctAnswers: totalQuestions,
              firstTimeCorrect: totalQuestions,
              totalQuestions: totalQuestions,
              totalPoints: totalQuestions * 3,
              questionResults: Array(totalQuestions).fill(0).map((_, i) => ({
                questionId: `q-${i+1}`,
                correct: true,
                timeToAnswer: 1500,
                firstTimeCorrect: true
              })),
              blinkSpeed: 1.5,
              sessionDuration: totalQuestions * 1.5,
              completedAt: new Date().toISOString()
            };
            
            // Complete the session
            player.handleSessionComplete(mockSessionResults);
            completedCount++;
            
            // Add to final message
            finalMessage += `✅ Tube ${currentTubeNum}: Completed stitch ${stitchId}\n`;
            
            // Allow time for the stitch completion to process
            setTimeout(resolve, 1200);
          } catch (err) {
            reject(err);
          }
        });
      };
      
      // Process each tube
      for (let tube = 1; tube <= 3; tube++) {
        // First select the tube
        player.handleManualTubeSelect(tube);
        
        // Wait for selection to complete
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Complete stitches in this tube
        for (let i = 0; i < stitchesPerTube; i++) {
          try {
            await completeOneStitch();
            
            // Update progress message
            setMessage(`🔄 Processing... Completed ${completedCount} stitches so far`);
            
            // Allow UI to update between stitches
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error) {
            console.error(`Error completing stitch in tube ${tube}:`, error);
            finalMessage += `❌ Error in Tube ${tube}: ${error}\n`;
            break;
          }
        }
      }
      
      // Final message
      setMessage(`${finalMessage}\n\nBulk operation complete! Total stitches completed: ${completedCount}`);
    } catch (err) {
      setError(`❌ Error in bulk stitch completion: ${err}`);
    }
  };
  
  // List information about current browser state
  const getCurrentState = () => {
    const state: Record<string, any> = {};
    
    // List localStorage keys
    const localStorageKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) localStorageKeys.push(key);
    }
    state.localStorageKeys = localStorageKeys;
    
    // Get anonymous ID if exists
    state.anonymousId = localStorage.getItem('anonymousId');
    
    // Get all cookie names
    state.cookies = document.cookie.split(';').map(cookie => cookie.trim().split('=')[0]);
    
    // Display Supabase auth token status (not the actual token)
    const hasSupabaseToken = localStorage.getItem('sb-ggwoupzaruiaaliylxga-auth-token') !== null;
    state.hasSupabaseAuthToken = hasSupabaseToken;
    
    setMessage(JSON.stringify(state, null, 2));
  };
  
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col text-white">
      <Head>
        <title>Test Utils | Zenjin Maths</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      {/* Warning banner */}
      <div className="bg-red-800 text-white px-4 py-2 text-center font-bold">
        🚨 TESTING UTILITIES - DO NOT USE IN PRODUCTION 🚨
      </div>
      
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Testing Utilities</h1>
          <Link 
            href="/"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>
        
        {/* Status messages */}
        {message && (
          <div className="bg-green-900/50 border border-green-700 rounded-lg p-4 mb-6 whitespace-pre-wrap font-mono text-sm">
            {message}
          </div>
        )}
        
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6 text-red-200">
            {error}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white/10 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-4">Anonymous Data</h2>
            <div className="space-y-2">
              <button
                onClick={handleClearAnonymousData}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg transition-colors"
              >
                Clear Anonymous Data
              </button>
              
              <button
                onClick={launchAnonymousMode}
                className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors"
              >
                Launch Forced Anonymous Mode
              </button>
            </div>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-4">Browser State</h2>
            <div className="space-y-2">
              <button
                onClick={getCurrentState}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
              >
                Show Current State
              </button>
              
              <button
                onClick={handleClearAllLocalStorage}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
              >
                Clear All localStorage
              </button>
              
              <button
                onClick={handleClearCookies}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
              >
                Clear Cookies (Limited)
              </button>
            </div>
          </div>
        </div>
        
        <div className="bg-white/10 rounded-lg p-4 mb-8">
          <h2 className="text-xl font-bold mb-4">Stitch Testing Tools</h2>
          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <button
                onClick={completeCurrentStitch}
                className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
                disabled={!player.currentStitch}
              >
                Complete Current Stitch (Perfect Score)
              </button>
              
              <p className="text-sm text-white/70 italic">
                {player.currentStitch 
                  ? `Current stitch: ${player.currentStitch.id} (Tube ${player.currentTube})` 
                  : "No stitch loaded. Please go to the player first."}
              </p>
            </div>
            
            <div className="flex items-center space-x-2 mt-4">
              <span className="text-white">Complete Stitch in Tube: </span>
              <select 
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white"
                value={tubeNum}
                onChange={(e) => setTubeNum(parseInt(e.target.value))}
              >
                <option value={1}>Tube 1</option>
                <option value={2}>Tube 2</option>
                <option value={3}>Tube 3</option>
              </select>
              
              <span className="text-white ml-2">Score:</span>
              <select 
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white"
                value={completionScore}
                onChange={(e) => setCompletionScore(parseInt(e.target.value))}
              >
                <option value={10}>10/10</option>
                <option value={15}>15/15</option>
                <option value={20}>20/20</option>
              </select>
              
              <button
                onClick={completeSpecificTubeStitch}
                className="py-1 px-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
              >
                Complete
              </button>
            </div>
            
            <div className="mt-4">
              <button 
                onClick={completeBulkStitches}
                className="w-full py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg transition-colors"
              >
                Bulk Complete (3 stitches per tube)
              </button>
              <p className="text-sm text-white/70 italic mt-1">
                This will sequentially complete 3 stitches in each tube (9 total)
              </p>
            </div>
            
            <div className="mt-4">
              <button 
                onClick={() => {
                  setMessage("🔄 Resetting database positions...");
                  setError(null);
                  
                  // Call the reset-progress API
                  fetch('/api/reset-progress', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      userId: player.userId || 'anonymous'
                    })
                  })
                    .then(response => response.json())
                    .then(data => {
                      if (data.success) {
                        // Clear local storage state to ensure we start fresh
                        localStorage.removeItem(`triple_helix_state_${player.userId || 'anonymous'}`);
                        setMessage(`✅ Successfully reset database positions for user ${player.userId || 'anonymous'}\n\n${data.message}\n\nInitialized ${data.initializedThreads} threads and ${data.initializedStitches} stitches.\n\nReload the page to see the changes.`);
                      } else {
                        setError(`❌ Error resetting database positions: ${data.error}\n${data.details || ''}`);
                      }
                    })
                    .catch(err => {
                      setError(`❌ Failed to reset positions: ${err.message}`);
                    });
                }}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors"
              >
                Reset Database Positions
              </button>
              <p className="text-sm text-white/70 italic mt-1">
                This will reset all stitch positions to default values in the database, fixing any position conflicts.
              </p>
            </div>
            
            <div className="flex justify-between mt-4">
              <Link
                href="/minimal-player"
                className="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
              >
                Go to Player
              </Link>
              
              <Link
                href="/minimal-player?dev=true"
                className="py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors"
              >
                Go to Dev Player
              </Link>
              
              <Link
                href="/dashboard"
                className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
        
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">Reset Everything</h2>
          <div className="space-y-4">
            <p className="text-white/80">
              This will clear all localStorage, attempt to clear cookies, and reload the application.
              Use this to simulate a completely fresh session.
            </p>
            
            <button
              onClick={handleCompleteReset}
              className="w-full py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-lg transition-colors"
            >
              Complete Reset & Reload
            </button>
          </div>
        </div>
        
        <div className="mt-8 text-center text-white/60 text-sm">
          These utilities are for testing purposes only and should be disabled in production builds.
        </div>
      </div>
    </div>
  );
}