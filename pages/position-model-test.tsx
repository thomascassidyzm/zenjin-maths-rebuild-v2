/**
 * Position Model Test Page
 * 
 * A focused test page for the position-based tube model that:
 * - Shows an explicit visual representation of positions
 * - Allows direct manipulation of stitches and their positions
 * - Simulates the triple-helix progression with visualizations
 * - Validates both client-side and server-side persistence
 */

import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useZenjinStore } from '../lib/store/zenjinStore';

export default function PositionModelTest() {
  // Standard Zustand hooks
  const userInfo = useZenjinStore(state => state.userInformation);
  const tubeState = useZenjinStore(state => state.tubeState);
  const isInitialized = useZenjinStore(state => state.isInitialized);
  
  // Position-based actions
  const getStitchPositions = useZenjinStore(state => state.getStitchPositions);
  const getStitchAtPosition = useZenjinStore(state => state.getStitchAtPosition);
  const updateStitchPosition = useZenjinStore(state => state.updateStitchPosition);
  const moveStitch = useZenjinStore(state => state.moveStitch);
  
  // Other store actions
  const initializeState = useZenjinStore(state => state.initializeState);
  const setActiveTube = useZenjinStore(state => state.setActiveTube);
  const incrementPoints = useZenjinStore(state => state.incrementPoints);
  const incrementStitchesCompleted = useZenjinStore(state => state.incrementStitchesCompleted);
  
  // Local state
  const [testUserId, setTestUserId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'positions' | 'actions' | 'analysis'>('positions');
  const [activeTubeNum, setActiveTubeNum] = useState<1 | 2 | 3>(1);
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [operationResult, setOperationResult] = useState<string>('');
  const [operationHistory, setOperationHistory] = useState<Array<{
    timestamp: string;
    action: string;
    details: string;
  }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Get test user ID from localStorage (browser-safe)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let persistentTestUserId = localStorage.getItem('position-model-test-userId');
      
      if (!persistentTestUserId) {
        persistentTestUserId = `test-user-${Date.now()}`;
        localStorage.setItem('position-model-test-userId', persistentTestUserId);
      }
      
      setTestUserId(persistentTestUserId);
    }
  }, []);
  
  // Initialize store if needed
  useEffect(() => {
    if (testUserId && !isInitialized) {
      initializeTestState();
    }
  }, [testUserId, isInitialized]);
  
  // Initialize with test state
  const initializeTestState = () => {
    if (!testUserId) return;
    
    console.log('Initializing test state with user ID:', testUserId);
    
    // Generate test stitches (10 for each tube)
    const generateTubeStitches = (tubeNum: number) => {
      return Array.from({ length: 10 }, (_, i) => `stitch-T${tubeNum}-001-${(i+1).toString().padStart(2, '0')}`);
    };
    
    const tube1Stitches = generateTubeStitches(1);
    const tube2Stitches = generateTubeStitches(2);
    const tube3Stitches = generateTubeStitches(3);
    
    // Create a test setup with 3 tubes and 10 stitches each at different positions
    initializeState({
      userInformation: {
        userId: testUserId,
        isAnonymous: false,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      },
      tubeState: {
        activeTube: 1,
        tubes: {
          1: {
            threadId: 'thread-T1-001',
            currentStitchId: tube1Stitches[0],
            stitchOrder: tube1Stitches,
            positions: tube1Stitches.reduce((acc, stitchId, index) => {
              acc[index] = {
                stitchId,
                skipNumber: 3, // All start with skip number 3
                distractorLevel: 1,
                perfectCompletions: 0
              };
              return acc;
            }, {})
          },
          2: {
            threadId: 'thread-T2-001',
            currentStitchId: tube2Stitches[0],
            stitchOrder: tube2Stitches,
            positions: tube2Stitches.reduce((acc, stitchId, index) => {
              acc[index] = {
                stitchId,
                skipNumber: 3,
                distractorLevel: 1,
                perfectCompletions: 0
              };
              return acc;
            }, {})
          },
          3: {
            threadId: 'thread-T3-001',
            currentStitchId: tube3Stitches[0],
            stitchOrder: tube3Stitches,
            positions: tube3Stitches.reduce((acc, stitchId, index) => {
              acc[index] = {
                stitchId,
                skipNumber: 3,
                distractorLevel: 1,
                perfectCompletions: 0
              };
              return acc;
            }, {})
          }
        }
      },
      isInitialized: true
    });
    
    // Record this operation
    addOperationToHistory('Initialized test state', `Created 3 tubes with 10 stitches each. All stitches start with skipNumber 3.`);
  };
  
  // Add operation to history
  const addOperationToHistory = (action: string, details: string) => {
    setOperationHistory(prev => [
      {
        timestamp: new Date().toISOString(),
        action,
        details
      },
      ...prev
    ]);
  };
  
  // Simulate perfect completion of the active stitch
  const simulatePerfectCompletion = async () => {
    if (!tubeState) return;
    
    setIsProcessing(true);
    setOperationResult('');
    
    try {
      const tube = tubeState.tubes[activeTubeNum];
      if (!tube) throw new Error(`Tube ${activeTubeNum} not found`);
      
      // Get the current stitch at position 0
      const currentStitchPosition = getStitchAtPosition(activeTubeNum, 0);
      if (!currentStitchPosition) throw new Error('No stitch at position 0');
      
      const currentStitchId = currentStitchPosition.stitchId;
      const currentSkipNumber = currentStitchPosition.skipNumber;
      
      // Calculate new skip number
      const newSkipNumber = currentSkipNumber >= 25 ? 100 : 
                           (currentSkipNumber >= 10 ? 25 : 
                           (currentSkipNumber >= 5 ? 10 : 
                           (currentSkipNumber >= 3 ? 5 : 3)));
      
      // Award points (60 for a perfect 20/20 score)
      incrementPoints(60);
      incrementStitchesCompleted(true);
      
      // Update the stitch with new data
      const updatedStitchPosition = {
        ...currentStitchPosition,
        skipNumber: newSkipNumber,
        perfectCompletions: (currentStitchPosition.perfectCompletions || 0) + 1,
        lastCompleted: new Date().toISOString()
      };
      
      // First move the stitch to its new position
      moveStitch(activeTubeNum, 0, newSkipNumber);
      
      // Then update its properties
      updateStitchPosition(activeTubeNum, newSkipNumber, updatedStitchPosition);
      
      // Record this operation
      const result = `Stitch ${currentStitchId} completed with a perfect score. Skip number increased from ${currentSkipNumber} to ${newSkipNumber}. Moved from position 0 to position ${newSkipNumber}.`;
      setOperationResult(result);
      addOperationToHistory('Perfect completion', result);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setOperationResult(`Error: ${errorMessage}`);
      addOperationToHistory('Error', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Simulate cycling to the next tube
  const simulateCycleTube = () => {
    if (!tubeState) return;
    
    const currentTube = activeTubeNum;
    const nextTube = currentTube >= 3 ? 1 : (currentTube + 1) as 1 | 2 | 3;
    
    setActiveTubeNum(nextTube);
    setActiveTube(nextTube);
    
    // Record this operation
    const result = `Cycled from tube ${currentTube} to tube ${nextTube}`;
    setOperationResult(result);
    addOperationToHistory('Cycle tube', result);
  };
  
  // Sync state to server
  const syncToServer = async () => {
    setIsProcessing(true);
    setOperationResult('');
    
    try {
      const result = await useZenjinStore.getState().syncToServer();
      const resultMessage = result ? 'Successfully synced to server' : 'Failed to sync to server';
      setOperationResult(resultMessage);
      addOperationToHistory('Sync to server', resultMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setOperationResult(`Error syncing to server: ${errorMessage}`);
      addOperationToHistory('Sync error', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Load state from server
  const loadFromServer = async () => {
    if (!testUserId) {
      setOperationResult('No test user ID available');
      return;
    }
    
    setIsProcessing(true);
    setOperationResult('');
    
    try {
      const result = await useZenjinStore.getState().loadFromServer(testUserId);
      const resultMessage = result ? 'Successfully loaded state from server' : 'Failed to load state from server';
      setOperationResult(resultMessage);
      addOperationToHistory('Load from server', resultMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setOperationResult(`Error loading from server: ${errorMessage}`);
      addOperationToHistory('Load error', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Format timestamp
  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return timestamp;
    }
  };
  
  // Reset test state
  const resetTestState = () => {
    if (typeof window !== 'undefined' && confirm('Are you sure you want to reset the test state? This will create a fresh test environment.')) {
      localStorage.removeItem('position-model-test-userId');
      window.location.reload();
    }
  };
  
  // Get current positions for display (safely)
  const getCurrentPositions = (tubeNum: 1 | 2 | 3) => {
    if (!tubeState) return {};
    
    const positions = getStitchPositions(tubeNum);
    return positions || {};
  };
  
  // Check if a specific position has a stitch
  const hasStitchAtPosition = (tubeNum: 1 | 2 | 3, position: number) => {
    const stitch = getStitchAtPosition(tubeNum, position);
    return !!stitch;
  };
  
  // Get position data
  const getPositionData = (tubeNum: 1 | 2 | 3, position: number) => {
    return getStitchAtPosition(tubeNum, position);
  };
  
  // Visual position grid rendering
  const renderPositionGrid = () => {
    // Create a grid of positions from 0-20
    const positions = Array.from({ length: 21 }, (_, i) => i);
    
    return (
      <div className="overflow-x-auto">
        <div className="grid grid-cols-21 min-w-[1000px]">
          {/* Header row */}
          {positions.map(position => (
            <div key={`header-${position}`} className="p-2 text-center font-semibold border-b border-gray-700">
              {position}
            </div>
          ))}
          
          {/* Tube rows */}
          {[1, 2, 3].map(tube => (
            <React.Fragment key={`tube-${tube}`}>
              <div className="contents">
                {positions.map(position => {
                  const hasStitch = hasStitchAtPosition(tube as 1 | 2 | 3, position);
                  const isActiveTube = activeTubeNum === tube;
                  const isSelected = selectedPosition === position && activeTubeNum === tube;
                  const positionData = getPositionData(tube as 1 | 2 | 3, position);
                  
                  return (
                    <div
                      key={`tube-${tube}-pos-${position}`}
                      className={`
                        p-2 border border-gray-700 h-20 flex flex-col justify-center items-center text-xs
                        ${hasStitch ? 'bg-gray-800' : 'bg-gray-900/30'}
                        ${isActiveTube ? 'ring-2 ring-blue-500' : ''}
                        ${isSelected ? 'ring-2 ring-white' : ''}
                        ${position === 0 ? 'bg-gradient-to-r from-green-900/50 to-transparent' : ''}
                        ${position >= 20 ? 'bg-gradient-to-r from-red-900/30 to-transparent' : ''}
                        cursor-pointer hover:bg-gray-700/50 transition-colors
                      `}
                      onClick={() => {
                        setSelectedPosition(position);
                        setActiveTubeNum(tube as 1 | 2 | 3);
                      }}
                    >
                      {hasStitch ? (
                        <>
                          <div className="font-mono text-[9px] truncate w-full text-center">
                            {positionData?.stitchId.replace(/stitch-T\d+-\d+-/, '')}
                          </div>
                          <div className="mt-1 flex space-x-1 text-[8px]">
                            <span className="px-1 bg-purple-900/50 rounded">Skip: {positionData?.skipNumber}</span>
                            <span className="px-1 bg-blue-900/50 rounded">L{positionData?.distractorLevel}</span>
                          </div>
                          {positionData?.perfectCompletions > 0 && (
                            <div className="mt-1 text-[8px] px-1 bg-green-900/50 rounded">
                              ✓ {positionData.perfectCompletions}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-gray-500">Empty</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };
  
  // Actions panel
  const renderActionsPanel = () => {
    return (
      <div className="space-y-6">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Stitch Actions</h3>
          <div className="space-y-2">
            <button
              onClick={simulatePerfectCompletion}
              disabled={isProcessing}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : 'Simulate Perfect Completion (20/20)'}
            </button>
            
            <button
              onClick={simulateCycleTube}
              disabled={isProcessing}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cycle to Next Tube
            </button>
          </div>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">State Persistence</h3>
          <div className="space-y-2">
            <button
              onClick={syncToServer}
              disabled={isProcessing}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sync to Server
            </button>
            
            <button
              onClick={loadFromServer}
              disabled={isProcessing}
              className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Load from Server
            </button>
            
            <button
              onClick={resetTestState}
              disabled={isProcessing}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset Test State
            </button>
          </div>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Operation Result</h3>
          <div className="bg-gray-900 p-3 rounded-md min-h-[100px] whitespace-pre-wrap font-mono text-sm">
            {operationResult || 'No operations performed yet.'}
          </div>
        </div>
      </div>
    );
  };
  
  // Analysis panel
  const renderAnalysisPanel = () => {
    const positions = getCurrentPositions(activeTubeNum);
    const positionsArray = Object.entries(positions).sort(([posA, _], [posB, __]) => parseInt(posA) - parseInt(posB));
    
    // Check for stitchOrder consistency
    const tube = tubeState?.tubes[activeTubeNum];
    const stitchOrder = tube?.stitchOrder || [];
    
    // Compare stitchOrder with positions
    const positionStitchIds = positionsArray.map(([_, data]) => data.stitchId);
    const isConsistent = JSON.stringify(stitchOrder) === JSON.stringify(positionStitchIds);
    
    return (
      <div className="space-y-6">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Position Data</h3>
          <div className="overflow-auto max-h-[300px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-2 text-left">Position</th>
                  <th className="p-2 text-left">Stitch ID</th>
                  <th className="p-2 text-left">Skip #</th>
                  <th className="p-2 text-left">Distractor</th>
                  <th className="p-2 text-left">Completions</th>
                  <th className="p-2 text-left">Last Completed</th>
                </tr>
              </thead>
              <tbody>
                {positionsArray.length > 0 ? (
                  positionsArray.map(([position, data]) => (
                    <tr key={position} className="border-b border-gray-700">
                      <td className="p-2">{position}</td>
                      <td className="p-2 font-mono text-xs">{data.stitchId}</td>
                      <td className="p-2">{data.skipNumber}</td>
                      <td className="p-2">L{data.distractorLevel}</td>
                      <td className="p-2">{data.perfectCompletions || 0}</td>
                      <td className="p-2 text-xs">
                        {data.lastCompleted ? formatTime(data.lastCompleted) : 'Never'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-500">
                      No position data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">StitchOrder Comparison</h3>
          <div className="mb-2 flex gap-2 items-center">
            <div className={`w-3 h-3 rounded-full ${isConsistent ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isConsistent ? 'StitchOrder is consistent with positions' : 'Inconsistency detected'}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-semibold mb-1">StitchOrder Array</div>
              <div className="bg-gray-900 p-2 rounded text-xs font-mono h-[200px] overflow-auto">
                {stitchOrder.map((id, idx) => (
                  <div key={idx} className="py-0.5">
                    {idx}: {id}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="font-semibold mb-1">Positions Order</div>
              <div className="bg-gray-900 p-2 rounded text-xs font-mono h-[200px] overflow-auto">
                {positionsArray.map(([pos, data]) => (
                  <div key={pos} className="py-0.5">
                    {pos}: {data.stitchId}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render history panel
  const renderHistoryPanel = () => {
    return (
      <div className="bg-gray-800/50 rounded-lg p-4 max-h-[500px] overflow-auto">
        <h3 className="text-lg font-semibold mb-3">Operation History</h3>
        {operationHistory.length === 0 ? (
          <div className="text-gray-500 text-center p-4">No operations performed yet</div>
        ) : (
          <div className="space-y-2">
            {operationHistory.map((entry, idx) => (
              <div key={idx} className="bg-gray-900/50 p-3 rounded-lg border-l-4 border-blue-500">
                <div className="flex justify-between items-start">
                  <div className="font-medium">{entry.action}</div>
                  <div className="text-xs text-gray-400">{formatTime(entry.timestamp)}</div>
                </div>
                <div className="mt-1 text-sm">{entry.details}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <Head>
        <title>Position Model Test - Zenjin Maths</title>
        <meta name="description" content="Test the position-based tube model" />
        <style jsx global>{`
          .grid-cols-21 {
            grid-template-columns: repeat(21, minmax(45px, 1fr));
          }
        `}</style>
      </Head>
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2 text-center">Position Model Test</h1>
        <p className="text-gray-300 text-center mb-8">
          Test the position-based model for the Triple Helix learning system
        </p>
        
        {/* User ID and active tube info */}
        <div className="bg-gray-800/30 p-4 rounded-lg mb-6">
          <div className="flex flex-wrap justify-between items-center">
            <div>
              <div className="text-sm text-gray-400">Test User ID</div>
              <div className="font-mono text-sm">{testUserId || 'Not initialized'}</div>
            </div>
            
            <div>
              <div className="text-sm text-gray-400">Active Tube</div>
              <div className="font-mono text-sm">Tube {activeTubeNum}</div>
            </div>
            
            <div>
              <div className="text-sm text-gray-400">Status</div>
              <div className="font-mono text-sm">{isInitialized ? 'Initialized' : 'Not initialized'}</div>
            </div>
            
            {!isInitialized && testUserId && (
              <button
                onClick={initializeTestState}
                className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-sm font-medium"
              >
                Initialize Test State
              </button>
            )}
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-700 mb-6">
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'positions' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
            onClick={() => setActiveTab('positions')}
          >
            Position Grid
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'actions' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
            onClick={() => setActiveTab('actions')}
          >
            Actions
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'analysis' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
            onClick={() => setActiveTab('analysis')}
          >
            Analysis
          </button>
        </div>
        
        {/* Tab content */}
        <div className="mb-8">
          {activeTab === 'positions' && renderPositionGrid()}
          {activeTab === 'actions' && renderActionsPanel()}
          {activeTab === 'analysis' && renderAnalysisPanel()}
        </div>
        
        {/* Operation history - always visible */}
        {renderHistoryPanel()}
      </main>
    </div>
  );
}