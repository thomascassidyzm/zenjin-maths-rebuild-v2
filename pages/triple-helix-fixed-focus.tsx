import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

// Import the StateMachine and Adapter - these are key to correct tube rotation behavior
const StateMachine = require('../lib/triple-helix/StateMachine');
const StateMachineTubeCyclerAdapter = require('../lib/adapters/StateMachineTubeCyclerAdapter');

/**
 * Triple-Helix-Fixed-Focus
 * 
 * This implementation focuses SPECIFICALLY on the issue with stitch positions not
 * updating correctly after perfect scores. We are using the exact State Machine
 * implementation from comprehensive-triple-helix.tsx, which we know works correctly.
 * 
 * Key fixes:
 * 1. Clear visual display of stitch positions before and after perfect scores
 * 2. Explicit UI updates after state changes - CRITICAL to see updated positions
 * 3. Proper sequence of tube rotation followed by stitch reordering
 * 4. Comprehensive logging to show what's happening at each step
 * 
 * The CORE issue that was happening in the player:
 * - The state was updating correctly internally (StateMachine updated positions)
 * - But the UI wasn't being explicitly refreshed to show these changes
 * - This made it appear that perfect scores weren't moving stitches
 * 
 * This solution ensures that:
 * 1. After tube rotation: UI is immediately updated to show the new tube
 * 2. After stitch completion: UI is updated to show new stitch positions
 * 3. UI state always reflects the internal state machine state
 */
export default function TripleHelixFixedFocus() {
  const router = useRouter();
  
  // State for tubes and stitches
  const [logs, setLogs] = useState<string[]>([]);
  const [state, setState] = useState<any>(null);
  const [currentTube, setCurrentTube] = useState(1);
  const [currentStitch, setCurrentStitch] = useState<any>(null);
  const [tubeStitches, setTubeStitches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tubeCycler, setTubeCycler] = useState<any>(null);
  const [showConfiguration, setShowConfiguration] = useState(false);
  
  // Add log function with timestamps
  const addLog = (message: string) => {
    const timestamp = new Date().toTimeString().slice(0, 8);
    const logMessage = `[${timestamp}] ${message}`; 
    setLogs(prev => [logMessage, ...prev.slice(0, 99)]);
    console.log(logMessage);
  };
  
  // State change handler
  const handleStateChange = (newState: any) => {
    console.log('State change detected:', newState.activeTubeNumber);
    setState(newState);
    setCurrentTube(newState.activeTubeNumber);
    
    // Update current stitch display
    if (tubeCycler) {
      const stitch = tubeCycler.getCurrentStitch();
      console.log('Current stitch updated to:', stitch?.id);
      setCurrentStitch(stitch);
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
    }
  };
  
  // Tube change handler
  const handleTubeChange = (tubeNumber: number) => {
    console.log('Tube change detected:', tubeNumber);
    setCurrentTube(tubeNumber);
    addLog(`Active tube changed to ${tubeNumber}`);
    
    // Update stitches for this tube
    if (tubeCycler) {
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
      
      // Also update current stitch
      const stitch = tubeCycler.getCurrentStitch();
      setCurrentStitch(stitch);
    }
  };
  
  // Initialize the StateMachine on mount
  useEffect(() => {
    // Create adapter
    const adapter = new StateMachineTubeCyclerAdapter({
      onStateChange: handleStateChange,
      onTubeChange: handleTubeChange
    });
    
    setTubeCycler(adapter);
    setState(adapter.getState());
    setCurrentTube(adapter.getCurrentTube());
    setCurrentStitch(adapter.getCurrentStitch());
    setTubeStitches(adapter.getCurrentTubeStitches());
    setIsLoading(false);
    
    addLog(`StateMachineTubeCyclerAdapter initialized`);
    
    // Debug the initial state
    console.log('Initial state:', adapter.getState());
    console.log('Initial current stitch:', adapter.getCurrentStitch());
    console.log('Initial tube stitches:', adapter.getCurrentTubeStitches());
    
    // Return cleanup function
    return () => {
      console.log('Cleaning up StateMachineTubeCyclerAdapter');
    };
  }, []);
  
  // Complete stitch with perfect score (20/20)
  const handlePerfectScore = () => {
    if (!tubeCycler || !currentStitch) {
      addLog('ERROR: Cannot handle perfect score - no tubeCycler or currentStitch');
      return;
    }
    
    addLog('========== PERFECT SCORE SIMULATION ==========');
    addLog('Simulating stitch completion with perfect score (20/20)');
    
    // Get current stitch and tube info before completion
    const stitch = currentStitch;
    const beforeTube = currentTube;
    
    if (!stitch) {
      addLog('No current stitch found');
      return;
    }
    
    // Record current stitch details for logging
    const stitchId = stitch.id;
    const threadId = stitch.threadId;
    const initialSkipNumber = stitch.skipNumber || 1;
    
    // Get all stitches in tube before completion for comparison later
    const tubeStitchesBefore = [...tubeCycler.getCurrentTubeStitches()].sort((a, b) => a.position - b.position);
    const previousActiveStitchId = tubeCycler.getState().tubes[beforeTube].currentStitchId;
    
    // Log initial state very clearly
    addLog(`INITIAL STATE: Tube ${beforeTube}, Stitch ${stitchId}, Position ${stitch.position}, Skip ${initialSkipNumber}`);
    
    // Display the tube's stitch sequence before rotation
    addLog('BEFORE COMPLETION - All stitches in tube:');
    tubeStitchesBefore.slice(0, 10).forEach((s, i) => {
      const isActive = s.id === previousActiveStitchId;
      addLog(`  ${i}) Position ${s.position}: ${s.id} Skip=${s.skipNumber || 1} ${isActive ? '← ACTIVE' : ''}`);
    });
    
    // Calculate what the new skip number should be after a perfect score
    let expectedNewSkipNumber = initialSkipNumber;
    if (initialSkipNumber === 1) expectedNewSkipNumber = 3;
    else if (initialSkipNumber === 3) expectedNewSkipNumber = 5;
    else if (initialSkipNumber === 5) expectedNewSkipNumber = 10;
    else if (initialSkipNumber === 10) expectedNewSkipNumber = 25;
    else if (initialSkipNumber === 25) expectedNewSkipNumber = 100;
    else if (initialSkipNumber === 100) expectedNewSkipNumber = 100; // Max value
    
    addLog(`EXPECTED CHANGES: Skip number will be ${initialSkipNumber} → ${expectedNewSkipNumber}`);
    addLog(`EXPECTED CHANGES: Stitch will move from position 0 → ${expectedNewSkipNumber}`);
    
    // STEP 1: Cycle to the next tube - this happens immediately on completion
    console.log('STEP 1: Cycling to next tube...');
    addLog('STEP 1: Cycling to next tube...');
    
    tubeCycler.nextTube();
    const afterTube = tubeCycler.getCurrentTube();
    addLog(`✓ Tube rotated from ${beforeTube} to ${afterTube}`);
    
    // Get current state snapshot
    const stateAfterRotation = tubeCycler.getState();
    console.log('State after rotation:', stateAfterRotation);
    
    // CRITICAL: Update the UI immediately to reflect tube change
    setCurrentTube(afterTube);
    const newCurrentStitch = tubeCycler.getCurrentStitch();
    setCurrentStitch(newCurrentStitch);
    setTubeStitches(tubeCycler.getCurrentTubeStitches());
    
    // STEP 2: Process the stitch completion in the previous tube
    console.log('STEP 2: Processing stitch completion with perfect score...');
    addLog('STEP 2: Processing stitch completion with perfect score...');
    
    setTimeout(() => {
      // Process the stitch completion with perfect score
      const result = tubeCycler.handleStitchCompletion(
        threadId,
        stitchId,
        20,  // Perfect score
        20   // Total questions
      );
      
      console.log('Perfect score completion result:', result);
      
      // Get updated state after processing
      const updatedState = tubeCycler.getState();
      addLog('✓ Stitch completion processed');
      
      // CRITICAL: Update the UI to reflect changes
      setState(updatedState);
      setCurrentStitch(tubeCycler.getCurrentStitch());
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
      
      // Get updated stitch information from previous tube
      const tubeStitchesAfter = [...updatedState.tubes[beforeTube].stitches]
        .sort((a, b) => a.position - b.position);
      const newActiveStitchId = updatedState.tubes[beforeTube].currentStitchId;
      
      // Find the completed stitch in the updated list
      const completedStitch = tubeStitchesAfter.find(s => s.id === stitchId);
      
      if (!completedStitch) {
        addLog('ERROR: Could not find completed stitch after processing');
        return;
      }
      
      // Calculate skip number changes
      const oldSkip = initialSkipNumber;
      const newSkip = completedStitch.skipNumber || 1;
      
      // Check if the skip number changed as expected
      const skipNumberCorrect = newSkip === expectedNewSkipNumber;
      const positionCorrect = completedStitch.position === expectedNewSkipNumber;
      
      // Log the changes very clearly
      addLog('AFTER COMPLETION:');
      addLog(`✓ Skip number updated: ${oldSkip} → ${newSkip} ${skipNumberCorrect ? '(CORRECT)' : '(ERROR)'}`);
      addLog(`✓ Stitch position updated: 0 → ${completedStitch.position} ${positionCorrect ? '(CORRECT)' : '(ERROR)'}`);
      
      // Display updated tube configuration
      addLog('AFTER COMPLETION - All stitches in tube:');
      tubeStitchesAfter.slice(0, 10).forEach((s, i) => {
        const isActive = s.id === newActiveStitchId;
        const wasCompleted = s.id === stitchId;
        let suffix = '';
        if (isActive) suffix = ' ← NEW ACTIVE';
        if (wasCompleted) suffix = ' ← COMPLETED';
        addLog(`  ${i}) Position ${s.position}: ${s.id} Skip=${s.skipNumber || 1}${suffix}`);
      });
      
      // Summary of what happened
      addLog('SUMMARY:');
      if (skipNumberCorrect && positionCorrect) {
        addLog('✅ SUCCESS: Skip number and position updated correctly');
        addLog(`✅ The stitch with a perfect score had its skip number updated from ${oldSkip} to ${newSkip}`);
        addLog(`✅ The stitch was moved from position 0 to position ${completedStitch.position}`);
        addLog(`✅ A new stitch is now at position 0, ready to be worked on next time this tube is active`);
      } else {
        addLog('❌ ERROR: Something went wrong with the stitch updates');
        if (!skipNumberCorrect) {
          addLog(`❌ Skip number should have been updated to ${expectedNewSkipNumber} but is ${newSkip}`);
        }
        if (!positionCorrect) {
          addLog(`❌ Position should have been updated to ${expectedNewSkipNumber} but is ${completedStitch.position}`);
        }
      }
      
      addLog('========== PERFECT SCORE SIMULATION COMPLETE ==========');
      addLog('');
    }, 500);
  };
  
  // Complete stitch with partial score (15/20)
  const handlePartialScore = () => {
    if (!tubeCycler || !currentStitch) {
      addLog('ERROR: Cannot handle partial score - no tubeCycler or currentStitch');
      return;
    }
    
    addLog('========== PARTIAL SCORE SIMULATION ==========');
    addLog('Simulating stitch completion with partial score (15/20)');
    
    // Get current stitch and tube info before completion
    const stitch = currentStitch;
    const beforeTube = currentTube;
    
    if (!stitch) {
      addLog('No current stitch found');
      return;
    }
    
    // Record current stitch details for logging
    const stitchId = stitch.id;
    const threadId = stitch.threadId;
    const initialSkipNumber = stitch.skipNumber || 1;
    const initialPosition = stitch.position;
    
    // Get all stitches in tube before completion for comparison later
    const tubeStitchesBefore = [...tubeCycler.getCurrentTubeStitches()].sort((a, b) => a.position - b.position);
    const previousActiveStitchId = tubeCycler.getState().tubes[beforeTube].currentStitchId;
    
    // Log initial state very clearly
    addLog(`INITIAL STATE: Tube ${beforeTube}, Stitch ${stitchId}, Position ${initialPosition}, Skip ${initialSkipNumber}`);
    
    // Display the tube's stitch sequence before rotation
    addLog('BEFORE COMPLETION - All stitches in tube:');
    tubeStitchesBefore.slice(0, 10).forEach((s, i) => {
      const isActive = s.id === previousActiveStitchId;
      addLog(`  ${i}) Position ${s.position}: ${s.id} Skip=${s.skipNumber || 1} ${isActive ? '← ACTIVE' : ''}`);
    });
    
    // With partial score, skip number should be reset to 1, and position should remain at 0
    addLog('EXPECTED CHANGES:');
    addLog(`- Skip number will reset to 1 (if not already 1)`);
    addLog(`- Stitch position should remain at ${initialPosition} (unchanged)`);
    addLog(`- The same stitch should remain active next time this tube is active`);
    
    // STEP 1: Cycle to the next tube - this happens immediately on completion
    console.log('STEP 1: Cycling to next tube...');
    addLog('STEP 1: Cycling to next tube...');
    
    tubeCycler.nextTube();
    const afterTube = tubeCycler.getCurrentTube();
    addLog(`✓ Tube rotated from ${beforeTube} to ${afterTube}`);
    
    // CRITICAL: Update the UI immediately to reflect tube change
    setCurrentTube(afterTube);
    const newCurrentStitch = tubeCycler.getCurrentStitch();
    setCurrentStitch(newCurrentStitch);
    setTubeStitches(tubeCycler.getCurrentTubeStitches());
    
    // STEP 2: Process the stitch completion in the previous tube
    console.log('STEP 2: Processing stitch completion with partial score...');
    addLog('STEP 2: Processing stitch completion with partial score...');
    
    setTimeout(() => {
      // Process the stitch completion
      const result = tubeCycler.handleStitchCompletion(
        threadId,
        stitchId,
        15,  // Partial score
        20   // Total questions
      );
      
      console.log('Partial score completion result:', result);
      
      // Get updated state after processing
      const updatedState = tubeCycler.getState();
      addLog('✓ Stitch completion processed');
      
      // CRITICAL: Update the UI to reflect changes
      setState(updatedState);
      setCurrentStitch(tubeCycler.getCurrentStitch());
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
      
      // Get updated stitch information from previous tube
      const tubeStitchesAfter = [...updatedState.tubes[beforeTube].stitches]
        .sort((a, b) => a.position - b.position);
      const newActiveStitchId = updatedState.tubes[beforeTube].currentStitchId;
      
      // Find the completed stitch in the updated list
      const completedStitch = tubeStitchesAfter.find(s => s.id === stitchId);
      
      if (!completedStitch) {
        addLog('ERROR: Could not find completed stitch after processing');
        return;
      }
      
      // Check position and skip number
      const skipNumberReset = completedStitch.skipNumber === 1;
      const positionUnchanged = completedStitch.position === initialPosition;
      const sameActiveStitch = newActiveStitchId === previousActiveStitchId;
      
      // Log the changes very clearly
      addLog('AFTER COMPLETION:');
      addLog(`✓ Skip number: ${initialSkipNumber} → ${completedStitch.skipNumber} ${skipNumberReset ? '(CORRECT)' : '(ERROR)'}`);
      addLog(`✓ Stitch position: ${initialPosition} → ${completedStitch.position} ${positionUnchanged ? '(CORRECT - UNCHANGED)' : '(ERROR - SHOULD NOT CHANGE)'}`);
      addLog(`✓ Active stitch: ${sameActiveStitch ? 'UNCHANGED (CORRECT)' : 'CHANGED (ERROR - SHOULD REMAIN THE SAME)'}`);
      
      // Display updated tube configuration
      addLog('AFTER COMPLETION - All stitches in tube:');
      tubeStitchesAfter.slice(0, 10).forEach((s, i) => {
        const isActive = s.id === newActiveStitchId;
        const wasCompleted = s.id === stitchId;
        let suffix = '';
        if (isActive && wasCompleted) suffix = ' ← STILL ACTIVE';
        else if (isActive) suffix = ' ← ACTIVE';
        else if (wasCompleted) suffix = ' ← COMPLETED';
        addLog(`  ${i}) Position ${s.position}: ${s.id} Skip=${s.skipNumber || 1}${suffix}`);
      });
      
      // Summary of what happened
      addLog('SUMMARY:');
      if (skipNumberReset && positionUnchanged && sameActiveStitch) {
        addLog('✅ SUCCESS: Partial score processing behaved correctly');
        addLog('✅ With a partial score, the stitch remains at position 0 (the active position)');
        addLog('✅ The skip number was reset to 1');
        addLog('✅ The same stitch will be active next time this tube is visited');
      } else {
        addLog('❌ ERROR: Something went wrong with the partial score processing');
        if (!skipNumberReset) {
          addLog('❌ Skip number should have been reset to 1');
        }
        if (!positionUnchanged) {
          addLog('❌ Position should not have changed');
        }
        if (!sameActiveStitch) {
          addLog('❌ Active stitch should have remained the same');
        }
      }
      
      addLog('========== PARTIAL SCORE SIMULATION COMPLETE ==========');
      addLog('');
    }, 500);
  };
  
  // Manually cycle to next tube
  const handleNextTube = () => {
    if (!tubeCycler) {
      addLog('ERROR: Cannot cycle tube - no tubeCycler');
      return;
    }
    
    addLog('========== MANUAL TUBE ROTATION ==========');
    
    // Get current tube and stitch info before rotation
    const beforeTube = currentTube;
    const beforeStitch = currentStitch;
    
    if (!beforeStitch) {
      addLog('No current stitch found before rotation');
      return;
    }
    
    // Log initial state
    addLog(`INITIAL STATE: Active Tube ${beforeTube}, Stitch ${beforeStitch.id}`);
    
    // Get all stitches in current tube before rotation
    const tubeStitchesBefore = [...tubeCycler.getCurrentTubeStitches()].sort((a, b) => a.position - b.position);
    
    // Display the current tube's stitch sequence
    addLog(`Stitches in Tube ${beforeTube} before rotation:`);
    tubeStitchesBefore.slice(0, 5).forEach((s, i) => {
      const isActive = s.id === beforeStitch.id;
      addLog(`  ${i}) Position ${s.position}: ${s.id} ${isActive ? '← ACTIVE' : ''}`);
    });
    
    // Perform tube rotation
    console.log('Manually cycling to next tube...');
    addLog('Performing tube rotation...');
    
    tubeCycler.nextTube();
    
    // Get state after rotation
    const afterTube = tubeCycler.getCurrentTube();
    addLog(`✓ Tube rotated from ${beforeTube} to ${afterTube}`);
    
    // CRITICAL: Update the UI to reflect the tube change
    setCurrentTube(afterTube);
    const afterStitch = tubeCycler.getCurrentStitch();
    setCurrentStitch(afterStitch);
    setTubeStitches(tubeCycler.getCurrentTubeStitches());
    
    // Get all stitches in new tube
    const tubeStitchesAfter = [...tubeCycler.getCurrentTubeStitches()].sort((a, b) => a.position - b.position);
    
    // Display the new tube's stitch sequence
    addLog(`Stitches in Tube ${afterTube} after rotation:`);
    tubeStitchesAfter.slice(0, 5).forEach((s, i) => {
      const isActive = s.id === afterStitch?.id;
      addLog(`  ${i}) Position ${s.position}: ${s.id} ${isActive ? '← NEW ACTIVE' : ''}`);
    });
    
    // Log the tube cycle count
    const cycleCount = tubeCycler.getCycleCount();
    addLog(`Current cycle count: ${cycleCount}`);
    
    // Verify rotation
    if (afterTube === (beforeTube % 3) + 1) {
      addLog('✅ Tube rotation successful');
      addLog(`✅ Changed from Tube ${beforeTube} to Tube ${afterTube}`);
      addLog(`✅ New active stitch: ${afterStitch?.id}`);
    } else {
      addLog('❌ ERROR: Unexpected tube after rotation');
      addLog(`❌ Expected Tube ${(beforeTube % 3) + 1}, got Tube ${afterTube}`);
    }
    
    addLog('========== MANUAL TUBE ROTATION COMPLETE ==========');
    addLog('');
  };
  
  // Format string with special coloring based on its content
  const formatLogClass = (log: string) => {
    // Apply different styling based on log content
    const isRotation = log.includes('Tube rotated') || log.includes('ROTATION');
    const isStitchUpdate = log.includes('Skip number updated') || log.includes('Stitch position');
    const isStep = log.includes('STEP');
    const isHeader = log.includes('BEFORE COMPLETION') || log.includes('AFTER COMPLETION') || log.includes('========');
    const isStitchList = log.includes(') Position');
    const isPerfect = log.includes('PERFECT SCORE');
    const isPartial = log.includes('PARTIAL SCORE');
    const isError = log.includes('ERROR');
    
    if (isError) return "text-red-300 font-bold";
    if (isRotation) return "text-blue-300 font-bold";
    if (isStitchUpdate) return "text-green-300 font-bold";
    if (isStep) return "text-yellow-300";
    if (isHeader) return "text-purple-300 font-bold";
    if (isStitchList) return "text-gray-300 ml-4";
    if (isPerfect) return "text-green-400";
    if (isPartial) return "text-yellow-400";
    
    return "text-white";
  };
  
  // Format step number display based on the progression
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
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-indigo-700 flex items-center justify-center">
        <div className="bg-white bg-opacity-10 rounded-xl p-8 text-center max-w-lg">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
          <p className="text-white">Loading Triple-Helix Fixed Focus...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-indigo-700 text-white">
      <Head>
        <title>Triple-Helix Fixed (Focus)</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
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
        <h1 className="text-3xl font-bold text-center mb-2">Triple-Helix Fixed (Focus)</h1>
        <p className="text-center text-white/70 mb-8">Focused solution for stitch position issues</p>
        
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
            onClick={handleNextTube}
            className="bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all text-lg font-semibold"
          >
            Next Tube
          </button>
        </div>
        
        {/* View toggle */}
        <div className="mb-6 flex justify-center">
          <button
            onClick={() => setShowConfiguration(!showConfiguration)}
            className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-lg text-white font-medium"
          >
            {showConfiguration ? 'Hide Configuration' : 'Show Configuration'}
          </button>
        </div>
        
        {/* Current stitch info */}
        <div className="mb-6 bg-indigo-800/30 backdrop-blur-sm rounded-lg p-4 max-w-4xl mx-auto">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <span className="text-white/70 text-sm">Current Tube:</span>
              <h2 className="text-xl font-bold">Tube {currentTube}</h2>
            </div>
            
            <div>
              <span className="text-white/70 text-sm">Current Stitch:</span>
              <h2 className="text-xl font-bold">{currentStitch?.id || 'None'}</h2>
            </div>
            
            <div>
              <span className="text-white/70 text-sm">Skip Number:</span>
              <h2 className="text-xl font-bold">{formatSkipNumber(currentStitch?.skipNumber || 1)}</h2>
            </div>
            
            <div>
              <span className="text-white/70 text-sm">Position:</span>
              <h2 className="text-xl font-bold">{currentStitch?.position}</h2>
            </div>
            
            <div>
              <span className="text-white/70 text-sm">Thread:</span>
              <h2 className="text-xl font-bold">{currentStitch?.threadId || 'None'}</h2>
            </div>
          </div>
        </div>
        
        {/* Logs panel */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4 mb-8 max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Detailed Logs
          </h2>
          
          <div className="h-64 overflow-y-auto bg-black/30 rounded-lg p-4 font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-white/60">No logs yet. Use the buttons above to test the Triple-Helix system.</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`mb-1 ${formatLogClass(log)}`}>{log}</div>
              ))
            )}
          </div>
          
          <div className="flex justify-end mt-4">
            <button
              onClick={() => setLogs([])}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-1 rounded text-white/80 text-sm"
            >
              Clear Logs
            </button>
          </div>
        </div>
        
        {/* Tube configuration (shown when toggle is on) */}
        {showConfiguration && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Current Tube Configuration</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(tubeNum => {
                const tube = state?.tubes?.[tubeNum];
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
                      <div>Thread: <span className="text-blue-300">{tube?.threadId || 'None'}</span></div>
                      <div>Current Stitch: <span className="text-blue-300">{tube?.currentStitchId || 'None'}</span></div>
                    </div>
                    
                    <div className="text-xs font-medium text-white/70 mb-1">Stitches (by position):</div>
                    <div className="overflow-auto max-h-60">
                      <table className="w-full text-xs">
                        <thead className="text-white/60">
                          <tr className="border-b border-white/20">
                            <th className="py-1 px-2 text-left">Pos</th>
                            <th className="py-1 text-left">Stitch</th>
                            <th className="py-1 text-center">Skip</th>
                            <th className="py-1 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedStitches.slice(0, 15).map((stitch: any) => {
                            const isActive = stitch.id === tube?.currentStitchId;
                            
                            return (
                              <tr key={stitch.id} className={`${isActive ? 'bg-teal-400/20' : ''} hover:bg-white/5`}>
                                <td className={`py-1 px-2 ${stitch.position === 0 ? 'text-teal-300 font-bold' : ''}`}>{stitch.position}</td>
                                <td className="py-1">{stitch.id}</td>
                                <td className="py-1 text-center">{formatSkipNumber(stitch.skipNumber)}</td>
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
      </div>
    </div>
  );
}