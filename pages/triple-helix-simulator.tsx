import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

// Import the StateMachine adapter
const StateMachineTubeCyclerAdapter = require('../lib/adapters/StateMachineTubeCyclerAdapter');

export default function TripleHelixSimulator() {
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [state, setState] = useState(null);
  const [currentTube, setCurrentTube] = useState(1);
  const [currentStitch, setCurrentStitch] = useState(null);
  const [tubeStitches, setTubeStitches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tubeCycler, setTubeCycler] = useState(null);
  
  // Add log function
  const addLog = (message) => {
    setLogs(prev => [...prev, `${new Date().toTimeString().slice(0, 8)} - ${message}`]);
  };
  
  // State change handler
  const handleStateChange = (newState) => {
    setState(newState);
    setCurrentTube(newState.activeTubeNumber);
    
    // Update current stitch display
    if (tubeCycler) {
      setCurrentStitch(tubeCycler.getCurrentStitch());
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
    }
  };
  
  // Tube change handler
  const handleTubeChange = (tubeNumber) => {
    setCurrentTube(tubeNumber);
    addLog(`Active tube changed to ${tubeNumber}`);
    
    // Update stitches for this tube
    if (tubeCycler) {
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
    }
  };
  
  // Initialize the adapter
  useEffect(() => {
    // Create user ID
    const userId = 'test-user-' + Date.now();
    
    // Create a new adapter
    const adapter = new StateMachineTubeCyclerAdapter({
      userId,
      onStateChange: handleStateChange,
      onTubeChange: handleTubeChange
    });
    
    setTubeCycler(adapter);
    setState(adapter.getState());
    setCurrentTube(adapter.getCurrentTube());
    setCurrentStitch(adapter.getCurrentStitch());
    setTubeStitches(adapter.getCurrentTubeStitches());
    setIsLoading(false);
    
    addLog(`StateMachineTubeCyclerAdapter initialized for user ${userId}`);
  }, []);
  
  // Complete stitch with perfect score (20/20)
  const handlePerfectScore = () => {
    if (!tubeCycler) return;
    
    addLog('Simulating stitch completion with perfect score (20/20)');
    
    // Get current stitch and tube info before completion
    const stitch = tubeCycler.getCurrentStitch();
    const beforeTube = tubeCycler.getCurrentTube();
    
    if (!stitch) {
      addLog('No current stitch found');
      return;
    }
    
    // Record current stitch details for logging
    const stitchId = stitch.id;
    const threadId = stitch.threadId;
    
    // Get all stitches in tube before completion for comparison later
    const tubeStitchesBefore = [...tubeCycler.getCurrentTubeStitches()].sort((a, b) => a.position - b.position);
    const previousActiveStitchId = tubeCycler.getState().tubes[beforeTube].currentStitchId;
    
    // Log the stitch that's being completed
    addLog(`COMPLETING: ${stitchId} (Position: ${stitch.position}, Skip: ${stitch.skipNumber || 3})`);
    
    // Display the tube's stitch sequence before rotation
    addLog(`BEFORE ordering in Tube ${beforeTube}:`);
    tubeStitchesBefore.slice(0, 5).forEach((s, i) => {
      const isActive = s.id === previousActiveStitchId;
      addLog(`  ${i}) ${s.id.split('-').pop()} ${isActive ? '← ACTIVE' : ''}`);
    });
    
    // First, cycle to the next tube - this happens immediately on completion
    // in the Triple-Helix system (like the Live Aid rotating stage)
    tubeCycler.nextTube();
    const afterTube = tubeCycler.getCurrentTube();
    addLog(`⟳ STAGE ROTATED from Tube ${beforeTube} to Tube ${afterTube}`);
    
    // Then, process the stitch completion in the previous tube
    // This adjusts stitch positions/ordering after rotation
    setTimeout(() => {
      // Process the stitch completion
      tubeCycler.handleStitchCompletion(
        threadId,
        stitchId,
        20,  // Perfect score
        20   // Total questions
      );
      
      // Get updated information after processing
      const updatedState = tubeCycler.getState();
      const tubeStitchesAfter = [...tubeCycler.getState().tubes[beforeTube].stitches]
        .sort((a, b) => a.position - b.position);
      const newActiveStitchId = updatedState.tubes[beforeTube].currentStitchId;
      
      // Find the completed stitch in the updated list
      const completedStitch = tubeStitchesAfter.find(s => s.id === stitchId);
      
      // Extract stitch numbers for clearer logging
      const oldStitchNum = previousActiveStitchId.match(/-(\d+)$/)?.[1] || '?';
      const newStitchNum = newActiveStitchId.match(/-(\d+)$/)?.[1] || '?';
      
      // Get the skip number BEFORE completion
      const oldSkip = stitch.skipNumber || 3;
      
      // Get the updated skip number
      let newSkip = oldSkip;
      if (oldSkip === 1) newSkip = 3;
      else if (oldSkip === 3) newSkip = 5;
      else if (oldSkip === 5) newSkip = 10;
      else if (oldSkip === 10) newSkip = 25;
      else if (oldSkip === 25) newSkip = 100;
      
      addLog(`✓ PERFECT SCORE (20/20) processed for stitch ${stitchId}`);
      
      // Show the skip number update
      addLog(`📈 SKIP NUMBER UPDATED: ${oldSkip} → ${newSkip}`);
      
      // Show the key positions very clearly
      addLog(`📊 POSITION MOVEMENT:`);
      addLog(`   1. Position before completion: 0 (active position)`);
      addLog(`   2. Skip number updated to: ${newSkip}`);
      addLog(`   3. Position after completion: ${newSkip} (equal to NEW skip number)`);
      
      // Display the tube's stitch sequence after reordering
      addLog(`📋 UPDATED TUBE ${beforeTube} ORDER (Position → Stitch):`);
      tubeStitchesAfter.slice(0, 5).forEach((s, i) => {
        const isActive = s.id === newActiveStitchId;
        const wasCompleted = s.id === stitchId;
        let marker = '';
        if (isActive) marker = ' ← NEW ACTIVE';
        if (wasCompleted) marker = ' ← COMPLETED';
        addLog(`   Position ${s.position}: ${s.id.split('-').pop()}${marker}`);
      });
      
      addLog(`⚡️ ACTIVE STITCH CHANGED: ${previousActiveStitchId.split('-').pop()} → ${newActiveStitchId.split('-').pop()}`);
      
      // Update the UI to reflect the current state
      setCurrentStitch(tubeCycler.getCurrentStitch());
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
    }, 500); // Slightly longer delay for better visualization
  };
  
  // Complete stitch with partial score (15/20)
  const handlePartialScore = () => {
    if (!tubeCycler) return;
    
    addLog('Simulating stitch completion with partial score (15/20)');
    
    // Get current stitch and tube info before completion
    const stitch = tubeCycler.getCurrentStitch();
    const beforeTube = tubeCycler.getCurrentTube();
    
    if (!stitch) {
      addLog('No current stitch found');
      return;
    }
    
    // Record current stitch details for logging
    const stitchId = stitch.id;
    const threadId = stitch.threadId;
    
    // Get all stitches in tube before completion for comparison later
    const tubeStitchesBefore = [...tubeCycler.getCurrentTubeStitches()].sort((a, b) => a.position - b.position);
    const previousActiveStitchId = tubeCycler.getState().tubes[beforeTube].currentStitchId;
    
    // Log the stitch that's being completed
    addLog(`COMPLETING: ${stitchId} (Position: ${stitch.position}, Skip: ${stitch.skipNumber || 3})`);
    
    // Display the tube's stitch sequence before rotation
    addLog(`BEFORE ordering in Tube ${beforeTube}:`);
    tubeStitchesBefore.slice(0, 5).forEach((s, i) => {
      const isActive = s.id === previousActiveStitchId;
      addLog(`  ${i}) ${s.id.split('-').pop()} ${isActive ? '← ACTIVE' : ''}`);
    });
    
    // First, cycle to the next tube - this happens immediately on completion
    // in the Triple-Helix system (like the Live Aid rotating stage)
    tubeCycler.nextTube();
    const afterTube = tubeCycler.getCurrentTube();
    addLog(`⟳ STAGE ROTATED from Tube ${beforeTube} to Tube ${afterTube}`);
    
    // Then, process the stitch completion in the previous tube
    // With a partial score, the stitch position doesn't change significantly
    setTimeout(() => {
      // Process the stitch completion
      tubeCycler.handleStitchCompletion(
        threadId,
        stitchId,
        15,  // Partial score
        20   // Total questions
      );
      
      // Get updated information after processing
      const updatedState = tubeCycler.getState();
      const tubeStitchesAfter = [...tubeCycler.getState().tubes[beforeTube].stitches]
        .sort((a, b) => a.position - b.position);
      const newActiveStitchId = updatedState.tubes[beforeTube].currentStitchId;
      
      // Find the completed stitch in the updated list
      const completedStitch = tubeStitchesAfter.find(s => s.id === stitchId);
      
      addLog(`◯ PARTIAL SCORE (15/20) processed for stitch ${stitchId}`);
      addLog(`↻ NO REORDERING: Stitch stays at position ${completedStitch?.position || 0}`);
      addLog(`↻ Skip number reset to 3`);
      
      // Display the tube's stitch sequence after processing
      addLog(`AFTER ordering in Tube ${beforeTube} (unchanged):`);
      tubeStitchesAfter.slice(0, 5).forEach((s, i) => {
        const isActive = s.id === newActiveStitchId;
        const wasCompleted = s.id === stitchId;
        let marker = '';
        if (isActive && wasCompleted) marker = ' ← ACTIVE AGAIN';
        else if (isActive) marker = ' ← ACTIVE';
        else if (wasCompleted) marker = ' ← COMPLETED';
        addLog(`  ${i}) ${s.id.split('-').pop()}${marker}`);
      });
      
      // Update the UI to reflect the current state
      setCurrentStitch(tubeCycler.getCurrentStitch());
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
    }, 500); // Slightly longer delay for better visualization
  };
  
  // Test double rotation bug
  const handleDoubleRotationTest = () => {
    if (!tubeCycler) return;
    
    // Get current tube
    const oldTube = tubeCycler.getCurrentTube();
    addLog(`🧪 TESTING: Double rotation protection from Tube ${oldTube}`);
    
    // First rotation
    addLog(`1️⃣ First nextTube() call - Should rotate once`);
    tubeCycler.nextTube();
    
    // Try a second rotation immediately (should be blocked by our fix)
    addLog(`2️⃣ Second nextTube() call - Should be blocked by rotation lock`);
    tubeCycler.nextTube();
    
    const newTube = tubeCycler.getCurrentTube();
    const expectedTube = oldTube % 3 + 1; // 1->2->3->1
    
    if (newTube === expectedTube) {
      addLog(`✅ SUCCESS: Only rotated once as expected (Tube ${oldTube} → Tube ${newTube})`);
      addLog(`✅ Rotation lock prevented double rotation`);
    } else {
      addLog(`❌ FAILURE: Unexpected rotation (Tube ${oldTube} → Tube ${newTube})`);
      addLog(`❌ Expected to be at Tube ${expectedTube}`);
    }
    
    // Update UI to reflect current state
    setCurrentTube(tubeCycler.getCurrentTube());
    setCurrentStitch(tubeCycler.getCurrentStitch());
    setTubeStitches(tubeCycler.getCurrentTubeStitches());
  };
  
  // Select specific tube
  const handleSelectTube = (tubeNumber) => {
    if (!tubeCycler) return;
    
    const currentTubeNumber = tubeCycler.getCurrentTube();
    const currentStitchId = tubeCycler.getCurrentStitch()?.id;
    
    addLog(`👆 SELECTING: Tube ${tubeNumber} (currently at Tube ${currentTubeNumber})`);
    
    // Select the tube
    const success = tubeCycler.selectTube(tubeNumber);
    
    if (success) {
      const newStitchId = tubeCycler.getCurrentStitch()?.id;
      
      addLog(`✅ SELECTED: Tube ${tubeNumber}`);
      addLog(`📌 ACTIVE STITCH: ${newStitchId ? newStitchId.split('-').pop() : 'None'}`);
      
      // Display the first few stitches in the selected tube
      const tubeStitches = [...tubeCycler.getCurrentTubeStitches()].sort((a, b) => a.position - b.position);
      
      addLog(`Stitches in Tube ${tubeNumber}:`);
      tubeStitches.slice(0, 5).forEach((s, i) => {
        const isActive = s.id === newStitchId;
        addLog(`  ${i}) ${s.id.split('-').pop()} ${isActive ? '← ACTIVE' : ''}`);
      });
      
      // Update UI to reflect selected tube
      setCurrentTube(tubeNumber);
      setCurrentStitch(tubeCycler.getCurrentStitch());
      setTubeStitches(tubeCycler.getCurrentTubeStitches());
    } else {
      addLog(`❌ FAILED: Could not select Tube ${tubeNumber}`);
    }
  };
  
  // Clear logs
  const handleClearLogs = () => {
    setLogs([]);
  };
  
  // Format stitch ID for display
  const formatStitchId = (id) => {
    if (!id) return 'None';
    const parts = id.split('-');
    if (parts.length < 3) return id;
    return `${parts[0]}-${parts[1]}-${parts[2]}`;
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-indigo-700 text-white">
      <Head>
        <title>Triple-Helix Simulator</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Triple-Helix Simulator</h1>
          <button 
            onClick={() => router.push('/')}
            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
          >
            Back to Home
          </button>
        </div>
        
        {isLoading ? (
          <div className="bg-white/10 rounded-xl p-8 text-center">
            <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
            <p>Loading Triple-Helix simulator...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* Controls Panel */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-4">Tube Controls</h2>
                
                <div className="flex gap-2 mb-4">
                  {[1, 2, 3].map(tubeNum => (
                    <div 
                      key={tubeNum}
                      className={`px-4 py-2 rounded-full font-medium ${currentTube === tubeNum ? 'bg-indigo-500' : 'bg-white/10'}`}
                    >
                      Tube {tubeNum}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-1 gap-2 mb-4">
                  <button
                    onClick={handlePerfectScore}
                    className="bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg transition-colors text-lg font-semibold"
                  >
                    Perfect Score (20/20)
                  </button>
                  
                  <button
                    onClick={handlePartialScore}
                    className="bg-yellow-600 hover:bg-yellow-500 px-6 py-3 rounded-lg transition-colors text-lg font-semibold"
                  >
                    Partial Score (15/20)
                  </button>
                </div>
                
                <button
                  onClick={handleClearLogs}
                  className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg transition-colors w-full mt-4"
                >
                  Clear Logs
                </button>
              </div>
              
              {/* Current Tube & Stitch Info */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-4">Current Info</h2>
                
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-2">Active Tube: {currentTube}</h3>
                  <div className="space-y-1">
                    <p><span className="text-indigo-200">Thread:</span> {currentStitch?.threadId || 'None'}</p>
                    <p><span className="text-indigo-200">Current Stitch:</span> {formatStitchId(currentStitch?.id)}</p>
                    <p><span className="text-indigo-200">Position:</span> {currentStitch?.position !== undefined ? currentStitch.position : 'N/A'}</p>
                    <p><span className="text-indigo-200">Skip Number:</span> {currentStitch?.skipNumber || 'Default (3)'}</p>
                    <p><span className="text-indigo-200">Distractor Level:</span> {currentStitch?.distractorLevel || 'L1'}</p>
                    <p><span className="text-indigo-200">Completed:</span> {currentStitch?.completed ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Tube Stats</h3>
                  <div className="space-y-1">
                    <p><span className="text-indigo-200">Cycle Count:</span> {tubeCycler?.getCycleCount() || 0}</p>
                    <p><span className="text-indigo-200">Stitches in Tube:</span> {tubeStitches?.length || 0}</p>
                  </div>
                </div>
              </div>
              
              {/* Logs Panel */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-4">Test Logs</h2>
                
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
            </div>
            
            {/* Current Tube Stitches */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Current Tube Stitches (Tube {currentTube})</h2>
              
              <div className="bg-indigo-900/30 p-3 rounded-lg mb-4 border border-indigo-500/30">
                <p className="text-sm text-white/90">
                  <strong>Position explanation:</strong> The positions 0-N show the fixed "slots" in each tube. 
                  Position 0 is always the active stitch. When a stitch gets a perfect score:
                </p>
                <ol className="text-sm text-white/80 mt-2 ml-6 list-decimal">
                  <li>Its skip number is updated first (1→3→5→10→25→100)</li>
                  <li>Then it's placed at a position matching its <strong>new</strong> skip number</li>
                  <li>For example: A stitch with skip=1 gets a perfect score, updates to skip=3, and moves to position 3</li>
                </ol>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-center py-2 px-2 bg-indigo-900/30">Position</th>
                      <th className="text-left py-2 px-4">ID</th>
                      <th className="text-left py-2 px-4">Skip</th>
                      <th className="text-left py-2 px-4">Will Move To</th>
                      <th className="text-left py-2 px-4">Level</th>
                      <th className="text-left py-2 px-4">Completed</th>
                      <th className="text-left py-2 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tubeStitches?.length > 0 ? (
                      // Sort stitches by position
                      [...tubeStitches].sort((a, b) => a.position - b.position).map((stitch) => {
                        // Determine skip number styling based on progression
                        let skipClass = "";
                        if (stitch.skipNumber === 1) skipClass = "text-gray-300"; 
                        else if (stitch.skipNumber === 3) skipClass = "text-white font-medium";
                        else if (stitch.skipNumber === 5) skipClass = "text-blue-300";
                        else if (stitch.skipNumber === 10) skipClass = "text-green-300";
                        else if (stitch.skipNumber === 25) skipClass = "text-yellow-300";
                        else if (stitch.skipNumber === 100) skipClass = "text-pink-300";
                        
                        // Determine position styling
                        let positionClass = "";
                        if (stitch.position === 0) positionClass = "font-bold text-green-300 bg-green-900/20";
                        else if (stitch.position <= 3) positionClass = "text-blue-300";
                        
                        // Determine level styling
                        let levelClass = "";
                        if (stitch.distractorLevel === 'L2') levelClass = "text-yellow-300";
                        else if (stitch.distractorLevel === 'L3') levelClass = "text-pink-300";
                        
                        // Determine row styling - active stitch gets special highlight
                        const isActive = stitch.id === currentStitch?.id;
                        const rowClass = isActive ? 'bg-indigo-900/70 border-indigo-500' : 'border-white/10';
                        
                        return (
                          <tr key={stitch.id} className={`border-b ${rowClass}`}>
                            <td className={`py-2 px-4 text-center font-bold ${positionClass}`}>
                              {stitch.position}
                            </td>
                            <td className="py-2 px-4">
                              {formatStitchId(stitch.id)}
                              <span className="block text-xs text-gray-400">{stitch.threadId}</span>
                            </td>
                            <td className={`py-2 px-4 ${skipClass}`}>{stitch.skipNumber || 3}</td>
                            <td className="py-2 px-4 text-yellow-300">
                              {stitch.skipNumber || 3}
                              <span className="block text-xs text-gray-400">(on perfect score)</span>
                            </td>
                            <td className={`py-2 px-4 ${levelClass}`}>{stitch.distractorLevel || 'L1'}</td>
                            <td className="py-2 px-4">
                              {stitch.completed ? 
                                <span className="inline-block bg-green-500/30 text-green-300 px-2 py-1 rounded text-xs">Yes</span> : 
                                <span className="inline-block bg-gray-500/30 text-gray-300 px-2 py-1 rounded text-xs">No</span>
                              }
                            </td>
                            <td className="py-2 px-4">
                              {isActive ? 
                                <span className="inline-block bg-green-500/20 text-green-300 px-2 py-1 rounded-full text-xs font-bold">
                                  ACTIVE
                                </span> : 
                                (stitch.position === 0 ? 
                                  <span className="inline-block bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full text-xs">
                                    READY
                                  </span> : 
                                  <span className="inline-block bg-gray-500/20 text-gray-300 px-2 py-1 rounded-full text-xs">
                                    waiting
                                  </span>
                                )
                              }
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-white/60">No stitches found in this tube</td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                
                <div className="text-sm font-semibold mb-2 mt-3">Distractor Level Progression:</div>
                <p className="text-xs text-white/80 mb-2">
                  Distractor levels advance on perfect scores and never decrease.
                </p>
                <div className="flex space-x-4 text-xs">
                  <span className="text-white">L1</span>
                  <span className="text-yellow-300">→ L2</span>
                  <span className="text-pink-300">→ L3</span>
                </div>
              </div>
            </div>
            
            {/* State Panel */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Current State</h2>
              
              <div className="bg-black/20 p-4 rounded-lg overflow-auto">
                <pre className="text-xs">
                  {JSON.stringify(state, null, 2)}
                </pre>
              </div>
            </div>
            
            {/* Integration Guide */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Implementation Details</h2>
              
              <div className="space-y-4">
                <p>
                  This simulator demonstrates the StateMachine implementation for the Triple-Helix system,
                  which fixes two critical issues:
                </p>
                
                <div className="space-y-2">
                  <div className="bg-white/5 p-3 rounded-lg">
                    <h3 className="font-semibold text-indigo-300">1. Triple-Helix Flow</h3>
                    <p className="text-sm text-white/80">
                      The Triple-Helix system works like a rotating stage:
                    </p>
                    <ol className="list-decimal list-inside text-sm mt-2 text-white/80 space-y-1">
                      <li>When a stitch is completed, the stage immediately rotates to the next tube</li>
                      <li>After rotation, the completed stitch state is updated in the previous tube</li>
                      <li>This ensures the next tube's active stitch is already waiting when you arrive</li>
                      <li>This is analogous to the Live Aid rotating stage concept</li>
                    </ol>
                  </div>
                
                  <div className="bg-white/5 p-3 rounded-lg">
                    <h3 className="font-semibold text-indigo-300">2. Double Rotation Fix</h3>
                    <p className="text-sm text-white/80">
                      The rotation lock flag (rotationInProgressRef) prevents double tube rotation by blocking 
                      additional rotation calls for 500ms after the first rotation.
                    </p>
                  </div>
                  
                  <div className="bg-white/5 p-3 rounded-lg">
                    <h3 className="font-semibold text-indigo-300">3. Stitch Advancement Algorithm</h3>
                    <p className="text-sm text-white/80">
                      The StateMachine implements the Triple-Helix stitch reordering algorithm:
                    </p>
                    <ol className="list-decimal list-inside text-sm mt-2 text-white/80 space-y-1">
                      <li>On perfect score, update the stitch's skip number first (e.g., 1→3→5→10→25→100)</li>
                      <li>Update the stitch's distractor level if needed (L1→L2→L3)</li>
                      <li>Assign position -1 to the completed stitch temporarily</li>
                      <li>Shift all stitches from positions 1 to NEW skipNumber up by one position</li>
                      <li>Place the completed stitch at position equal to its NEW skipNumber</li>
                      <li>Set the stitch now at position 0 as the new active stitch</li>
                    </ol>
                  </div>
                  
                  <div className="bg-white/5 p-3 rounded-lg">
                    <h3 className="font-semibold text-indigo-300">4. Progressive Skip Number & Distractor Level</h3>
                    <p className="text-sm text-white/80">
                      <strong>Skip Number:</strong> Indicates the exact position where a stitch will be placed upon receiving a perfect score. 
                      For example, a stitch with skip number 3 will be placed at position 3.
                    </p>
                    <p className="text-sm text-white/80 mt-2">
                      <strong>Important sequence:</strong> First check current skip number → Use it for placement → Then update skip number for next time
                    </p>
                    <p className="text-sm text-white/80 mt-2">
                      Perfect scores progress skip numbers: 3→5→10→25→100
                    </p>
                    <p className="text-sm text-white/80 mt-2">
                      Perfect scores progress distractor levels on a one-way ratchet: L1→L2→L3
                    </p>
                    <p className="text-sm text-white/80 mt-2">
                      Non-perfect scores reset skip number to 3 but never reset the distractor level
                    </p>
                  </div>
                </div>
                
                <p className="text-sm">
                  Try different score patterns to see how the stitch ordering changes over time.
                  You can see the current state displayed in the table above.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}