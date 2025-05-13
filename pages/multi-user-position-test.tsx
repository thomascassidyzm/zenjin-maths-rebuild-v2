/**
 * Multi-User Position Test Page
 * 
 * A comprehensive test environment that:
 * - Supports multiple test users with different state progressions
 * - Allows switching between users to test server persistence
 * - Visualizes the position-based model for each user
 * - Lets you make changes and validate server persistence for each user
 */

import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useZenjinStore } from '../lib/store/zenjinStore';

// Interface for a test user
interface TestUser {
  id: string;
  name: string;
  color: string;
  lastSynced?: string;
}

export default function MultiUserPositionTest() {
  // Standard Zustand hooks
  const userInfo = useZenjinStore(state => state.userInformation);
  const tubeState = useZenjinStore(state => state.tubeState);
  const learningProgress = useZenjinStore(state => state.learningProgress);
  const isInitialized = useZenjinStore(state => state.isInitialized);
  
  // Position-based actions
  const getStitchPositions = useZenjinStore(state => state.getStitchPositions);
  const getStitchAtPosition = useZenjinStore(state => state.getStitchAtPosition);
  const updateStitchPosition = useZenjinStore(state => state.updateStitchPosition);
  const moveStitch = useZenjinStore(state => state.moveStitch);
  
  // Other store actions
  const initializeState = useZenjinStore(state => state.initializeState);
  const resetStore = useZenjinStore(state => state.resetStore);
  const setActiveTube = useZenjinStore(state => state.setActiveTube);
  const incrementPoints = useZenjinStore(state => state.incrementPoints);
  const incrementStitchesCompleted = useZenjinStore(state => state.incrementStitchesCompleted);
  
  // Local state
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [activeTab, setActiveTab] = useState<'grid' | 'stats' | 'history'>('grid');
  const [activeTubeNum, setActiveTubeNum] = useState<1 | 2 | 3>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationResult, setOperationResult] = useState('');
  const [operationHistory, setOperationHistory] = useState<Array<{
    userId: string;
    timestamp: string;
    action: string;
    details: string;
  }>>([]);
  
  // Load test users from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Add enhanced console logging
      console.log('🧠 ZUSTAND MULTI-USER TEST PAGE LOADED 🧠');
      console.log('This page tests server persistence for the position-based tube model');
      console.log('- Create multiple test users and perform actions with each');
      console.log('- Save each user\'s state to the server using "Save User State"');
      console.log('- Load state back from the server using "Load User State"');
      console.log('- Verify that state persists between different users');

      // Load saved test users from localStorage
      const savedUsers = localStorage.getItem('multi-user-test-users');
      if (savedUsers) {
        try {
          const parsedUsers = JSON.parse(savedUsers) as TestUser[];
          setTestUsers(parsedUsers);
          console.log(`🧪 Loaded ${parsedUsers.length} test users from localStorage`);
        } catch (e) {
          console.error('Failed to parse saved users', e);
        }
      } else {
        console.log('📝 No saved test users found. Create a test user to begin.');
      }
    }
  }, []);
  
  // Add operation to history
  const addOperationToHistory = useCallback((action: string, details: string) => {
    setOperationHistory(prev => [
      {
        userId: activeUserId,
        timestamp: new Date().toISOString(),
        action,
        details
      },
      ...prev
    ]);
  }, [activeUserId]);
  
  // Create a new test user
  const createTestUser = useCallback(() => {
    if (!newUserName.trim()) {
      setOperationResult('Please enter a user name');
      return;
    }
    
    // Generate a unique ID
    const userId = `test-user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Generate a random color
    const colors = ['blue', 'green', 'purple', 'pink', 'orange', 'teal', 'red', 'yellow'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Create the new user
    const newUser: TestUser = {
      id: userId,
      name: newUserName.trim(),
      color: randomColor
    };
    
    // Add to our list
    const updatedUsers = [...testUsers, newUser];
    setTestUsers(updatedUsers);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('multi-user-test-users', JSON.stringify(updatedUsers));
    }
    
    // Select the new user
    setActiveUserId(userId);
    setIsCreatingUser(false);
    setNewUserName('');
    
    // Reset the store and initialize for this user
    resetStore();
    initializeUserState(userId, newUserName.trim());
    
    addOperationToHistory('Create User', `Created new test user: ${newUserName.trim()}`);
  }, [newUserName, testUsers, addOperationToHistory]);
  
  // Delete a test user
  const deleteTestUser = useCallback((userId: string) => {
    if (typeof window !== 'undefined' && confirm('Are you sure you want to delete this test user? This cannot be undone.')) {
      const updatedUsers = testUsers.filter(user => user.id !== userId);
      setTestUsers(updatedUsers);
      
      // Save to localStorage
      localStorage.setItem('multi-user-test-users', JSON.stringify(updatedUsers));
      
      // If this was the active user, reset the store and clear active user
      if (userId === activeUserId) {
        resetStore();
        setActiveUserId('');
      }
      
      setOperationResult(`Deleted user ${userId}`);
    }
  }, [activeUserId, testUsers]);
  
  // Switch to a different test user
  const switchToUser = useCallback(async (userId: string) => {
    if (userId === activeUserId) return;

    setIsProcessing(true);

    try {
      // First, reset the store to clear any existing data
      resetStore();

      // Set the new active user
      setActiveUserId(userId);

      console.log(`Switching to user ${userId}, loading state from server...`);

      // Try to load this user's data from the server
      const loadResult = await useZenjinStore.getState().loadFromServer(userId);

      if (loadResult) {
        setOperationResult(`Successfully loaded state for user ${userId} from server`);
        addOperationToHistory('Switch User', `Loaded data for user ${userId} from server`);
      } else {
        console.log(`Server load failed, trying localStorage fallback...`);

        // Try loading from localStorage before initializing fresh state
        if (typeof window !== 'undefined') {
          const storeKey = `multi-user-test-state-${userId}`;
          const savedStateJson = localStorage.getItem(storeKey);

          if (savedStateJson) {
            try {
              // Parse the saved state from localStorage
              const savedState = JSON.parse(savedStateJson);

              // Update the store with the saved state
              const { userInformation, tubeState, learningProgress } = savedState;

              useZenjinStore.getState().initializeState({
                userInformation,
                tubeState,
                learningProgress,
                isInitialized: true,
                lastUpdated: new Date().toISOString()
              });

              setOperationResult(`Loaded state for user ${userId} from localStorage`);
              addOperationToHistory('Switch User', `Loaded data from localStorage for user ${userId}`);
              return;
            } catch (parseError) {
              console.log(`Error parsing localStorage state:`, parseError);
              // Continue to initialize fresh state if localStorage fails
            }
          }
        }

        // If server and localStorage both fail, initialize with fresh state
        const user = testUsers.find(u => u.id === userId);
        initializeUserState(userId, user?.name || 'Unknown User');
        setOperationResult(`Initialized fresh state for user ${userId}`);
        addOperationToHistory('Switch User', `Initialized fresh state for user ${userId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setOperationResult(`Error switching user: ${errorMessage}`);

      // Initialize with fresh state
      const user = testUsers.find(u => u.id === userId);
      initializeUserState(userId, user?.name || 'Unknown User');
    } finally {
      setIsProcessing(false);
    }
  }, [activeUserId, testUsers, addOperationToHistory, resetStore, initializeUserState]);
  
  // Initialize state for a user
  const initializeUserState = useCallback((userId: string, userName: string) => {
    if (!userId) return;
    
    console.log(`Initializing state for user ${userName} (${userId})`);
    
    // Generate test stitches (10 for each tube)
    const generateTubeStitches = (tubeNum: number) => {
      return Array.from({ length: 10 }, (_, i) => `stitch-T${tubeNum}-001-${(i+1).toString().padStart(2, '0')}`);
    };
    
    const tube1Stitches = generateTubeStitches(1);
    const tube2Stitches = generateTubeStitches(2);
    const tube3Stitches = generateTubeStitches(3);
    
    // Create a test setup with 3 tubes and 10 stitches each
    initializeState({
      userInformation: {
        userId: userId,
        isAnonymous: false,
        displayName: userName,
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
      learningProgress: {
        userId: userId,
        totalTimeSpentLearning: 0,
        evoPoints: 0,
        evolutionLevel: 1,
        currentBlinkSpeed: 1,
        previousSessionBlinkSpeeds: [],
        completedStitchesCount: 0,
        perfectScoreStitchesCount: 0
      },
      isInitialized: true
    });
  }, [initializeState]);
  
  // Save active user state to server
  const syncActiveUserToServer = useCallback(async () => {
    if (!activeUserId) {
      setOperationResult('No active user selected');
      return;
    }

    setIsProcessing(true);

    try {
      // Make sure the userInformation in the store has the correct user ID
      const currentState = useZenjinStore.getState();

      // If userInformation is missing or has a different userId, update it
      if (!currentState.userInformation || currentState.userInformation.userId !== activeUserId) {
        const user = testUsers.find(u => u.id === activeUserId);
        useZenjinStore.getState().setUserInformation({
          userId: activeUserId,
          isAnonymous: false,
          displayName: user?.name || 'Unknown User',
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString()
        });
      }

      // Call the actual store's syncToServer method
      console.log(`Syncing user ${activeUserId} state to server...`);
      const result = await useZenjinStore.getState().syncToServer();

      if (result) {
        // Update the lastSynced timestamp for this user
        const now = new Date().toISOString();
        const updatedUsers = testUsers.map(user =>
          user.id === activeUserId ? { ...user, lastSynced: now } : user
        );

        setTestUsers(updatedUsers);

        // Save updated user list to localStorage
        localStorage.setItem('multi-user-test-users', JSON.stringify(updatedUsers));

        setOperationResult(`Successfully saved state for user ${activeUserId} to server`);
        addOperationToHistory('Save State', `Saved state for current user to server`);
      } else {
        setOperationResult(`Failed to save state for user ${activeUserId} to server`);
        addOperationToHistory('Save Error', `Failed to save state to server`);

        // Fallback to localStorage if server sync fails
        console.log(`Server sync failed, falling back to localStorage...`);

        // User-specific store key for localStorage
        const storeKey = `multi-user-test-state-${activeUserId}`;

        // Save the state to localStorage as fallback
        localStorage.setItem(storeKey, JSON.stringify({
          userInformation: useZenjinStore.getState().userInformation,
          tubeState: useZenjinStore.getState().tubeState,
          learningProgress: useZenjinStore.getState().learningProgress,
          lastUpdated: new Date().toISOString()
        }));

        setOperationResult(`Server sync failed, saved state to localStorage instead`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setOperationResult(`Error saving state: ${errorMessage}`);
      addOperationToHistory('Save Error', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [activeUserId, testUsers, addOperationToHistory]);
  
  // Load active user state from server
  const loadActiveUserFromServer = useCallback(async () => {
    if (!activeUserId) {
      setOperationResult('No active user selected');
      return;
    }

    setIsProcessing(true);

    try {
      // Reset the store first to clear any existing data
      resetStore();

      console.log(`Loading state for user ${activeUserId} from server...`);

      // Call the actual store's loadFromServer method
      const result = await useZenjinStore.getState().loadFromServer(activeUserId);

      if (result) {
        setOperationResult(`Successfully loaded state for user ${activeUserId} from server`);
        addOperationToHistory('Load State', `Loaded state for current user from server`);
        return true;
      } else {
        setOperationResult(`Failed to load state from server for user ${activeUserId}`);
        addOperationToHistory('Load Error', `Failed to load state from server`);

        // Try loading from localStorage as fallback
        if (typeof window !== 'undefined') {
          console.log(`Server load failed, trying localStorage fallback...`);

          // User-specific store key
          const storeKey = `multi-user-test-state-${activeUserId}`;

          // Try to load the state from localStorage
          const savedStateJson = localStorage.getItem(storeKey);

          if (savedStateJson) {
            try {
              // Parse the saved state
              const savedState = JSON.parse(savedStateJson);

              // Update the store with the saved state
              const { userInformation, tubeState, learningProgress } = savedState;

              useZenjinStore.getState().initializeState({
                userInformation,
                tubeState,
                learningProgress,
                isInitialized: true,
                lastUpdated: new Date().toISOString()
              });

              setOperationResult(`Server load failed, loaded from localStorage instead`);
              addOperationToHistory('Load State', `Loaded state from localStorage fallback`);
              return true;
            } catch (parseError) {
              // If localStorage also fails, initialize fresh state
              initializeUserState(activeUserId, testUsers.find(u => u.id === activeUserId)?.name || 'Unknown User');
              setOperationResult(`Both server and localStorage failed. Initialized fresh state.`);
              addOperationToHistory('Load State', `Initialized fresh state after all fallbacks failed`);
            }
          } else {
            // No saved state in localStorage either, initialize fresh state
            initializeUserState(activeUserId, testUsers.find(u => u.id === activeUserId)?.name || 'Unknown User');
            setOperationResult(`No state found for user ${activeUserId}. Initialized fresh state.`);
            addOperationToHistory('Load State', `Initialized fresh state (no saved state found)`);
          }
        }
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setOperationResult(`Error loading state: ${errorMessage}`);
      addOperationToHistory('Load Error', errorMessage);

      // Initialize fresh state on error
      initializeUserState(activeUserId, testUsers.find(u => u.id === activeUserId)?.name || 'Unknown User');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [activeUserId, testUsers, addOperationToHistory, resetStore, initializeUserState]);
  
  // Simulate perfect completion of the active stitch
  const simulatePerfectCompletion = useCallback(async () => {
    if (!activeUserId || !tubeState) {
      setOperationResult('No active user or tube state');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const tube = tubeState.tubes[activeTubeNum];
      if (!tube) throw new Error(`Tube ${activeTubeNum} not found`);
      
      // Get the current stitch at position 0
      const currentStitchPosition = getStitchAtPosition(activeTubeNum, 0);
      if (!currentStitchPosition) throw new Error('No stitch at position 0');
      
      const currentStitchId = currentStitchPosition.stitchId;
      const currentSkipNumber = currentStitchPosition.skipNumber;
      
      // Calculate new skip number based on progression
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
      addOperationToHistory('Perfect Completion', result);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setOperationResult(`Error during simulation: ${errorMessage}`);
      addOperationToHistory('Error', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [activeUserId, tubeState, activeTubeNum, getStitchAtPosition, moveStitch, updateStitchPosition, incrementPoints, incrementStitchesCompleted, addOperationToHistory]);
  
  // Simulate cycling to the next tube
  const simulateCycleTube = useCallback(() => {
    if (!activeUserId || !tubeState) {
      setOperationResult('No active user or tube state');
      return;
    }
    
    const currentTube = activeTubeNum;
    const nextTube = currentTube >= 3 ? 1 : (currentTube + 1) as 1 | 2 | 3;
    
    setActiveTubeNum(nextTube);
    setActiveTube(nextTube);
    
    // Record this operation
    const result = `Cycled from tube ${currentTube} to tube ${nextTube}`;
    setOperationResult(result);
    addOperationToHistory('Cycle Tube', result);
  }, [activeUserId, tubeState, activeTubeNum, setActiveTube, addOperationToHistory]);
  
  // Clear all user data
  const clearAllUserData = useCallback(() => {
    if (typeof window !== 'undefined' && confirm('Are you sure you want to delete ALL test users? This cannot be undone.')) {
      localStorage.removeItem('multi-user-test-users');
      setTestUsers([]);
      resetStore();
      setActiveUserId('');
      setOperationResult('Cleared all test user data');
      setOperationHistory([]);
    }
  }, []);
  
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
  
  // Format date
  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleDateString();
    } catch (e) {
      return timestamp;
    }
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
  
  // Render grid view
  const renderGridView = () => {
    // Create a grid of positions from 0-15
    const positions = Array.from({ length: 16 }, (_, i) => i);

    return (
      <div className="space-y-6">
        {/* Slot machine visualization for active stitches */}
        <div className="bg-gray-800/60 rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-3 text-center">Active Stitches (Position 0)</h3>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(tube => {
              const tubeNum = tube as 1 | 2 | 3;
              const activeStitch = getStitchAtPosition(tubeNum, 0);
              const isActiveTube = activeTubeNum === tube;

              return (
                <div
                  key={`active-tube-${tube}`}
                  className={`
                    p-4 rounded-lg border-2
                    ${isActiveTube ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800'}
                    cursor-pointer transition-all hover:bg-gray-700
                  `}
                  onClick={() => setActiveTubeNum(tubeNum)}
                >
                  <div className="text-center font-semibold mb-1">Tube {tube}</div>

                  {activeStitch ? (
                    <div className="p-3 bg-black/30 rounded-lg shadow-inner flex flex-col items-center">
                      <div className="font-mono text-sm mb-1">{activeStitch.stitchId.split('-').pop()}</div>
                      <div className="font-mono text-sm text-blue-300 mb-2">
                        {activeStitch.stitchId}
                      </div>
                      <div className="flex space-x-2 mb-1">
                        <span className="px-2 py-1 bg-purple-900/70 rounded text-xs">
                          Skip: {activeStitch.skipNumber}
                        </span>
                        <span className="px-2 py-1 bg-blue-900/70 rounded text-xs">
                          L{activeStitch.distractorLevel}
                        </span>
                      </div>
                      <div className="text-xs text-gray-300">
                        {activeStitch.perfectCompletions > 0 ? (
                          <span>Completed {activeStitch.perfectCompletions} times</span>
                        ) : (
                          <span>Never completed</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-black/30 rounded-lg shadow-inner text-center text-gray-500">
                      No active stitch
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Full position grid for all tubes */}
        <div className="bg-gray-800/60 rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-3">Position Grid</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left bg-gray-800 rounded-tl-lg">Tube</th>
                  {positions.map(position => (
                    <th
                      key={`header-${position}`}
                      className={`
                        p-2 text-center bg-gray-800
                        ${position === 0 ? 'bg-green-900/70 font-bold' : ''}
                        ${position === positions.length - 1 ? 'rounded-tr-lg' : ''}
                      `}
                    >
                      {position}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map(tube => {
                  const tubeNum = tube as 1 | 2 | 3;
                  const isActiveTube = activeTubeNum === tube;

                  return (
                    <tr
                      key={`tube-${tube}`}
                      className={`${isActiveTube ? 'bg-blue-900/20' : ''}`}
                    >
                      <td
                        className={`
                          p-2 font-semibold border border-gray-700
                          ${isActiveTube ? 'bg-blue-900/40' : 'bg-gray-800'}
                          cursor-pointer hover:bg-gray-700
                        `}
                        onClick={() => setActiveTubeNum(tubeNum)}
                      >
                        Tube {tube}
                      </td>

                      {positions.map(position => {
                        const hasStitch = hasStitchAtPosition(tubeNum, position);
                        const positionData = getPositionData(tubeNum, position);
                        const isActivePosition = position === 0;

                        return (
                          <td
                            key={`tube-${tube}-pos-${position}`}
                            className={`
                              p-0 border border-gray-700 h-[80px] min-w-[80px] align-top
                              ${hasStitch ? (
                                isActivePosition ? 'bg-green-900/40' : 'bg-gray-800/80'
                              ) : 'bg-gray-900/20'}
                            `}
                          >
                            {hasStitch ? (
                              <div className="p-2 h-full flex flex-col justify-between">
                                <div className="font-mono text-xs truncate w-full">
                                  {positionData?.stitchId.split('-').pop()}
                                </div>

                                <div className="flex flex-col space-y-1 mt-auto items-start">
                                  <div className="flex flex-wrap gap-1 mb-1">
                                    <span className="px-1 bg-purple-900/70 rounded text-[9px]">
                                      Skip: {positionData?.skipNumber}
                                    </span>
                                    <span className="px-1 bg-blue-900/70 rounded text-[9px]">
                                      L{positionData?.distractorLevel}
                                    </span>
                                  </div>

                                  {positionData?.perfectCompletions > 0 && (
                                    <span className="px-1 bg-green-900/70 rounded text-[9px]">
                                      ✓ {positionData?.perfectCompletions}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full text-xs text-gray-500">
                                -
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };
  
  // Render statistics view
  const renderStatsView = () => {
    if (!tubeState || !learningProgress) {
      return (
        <div className="text-center p-8 text-gray-400">
          No state data available for the current user
        </div>
      );
    }
    
    // Get positions for each tube
    const tube1Positions = getStitchPositions(1) || {};
    const tube2Positions = getStitchPositions(2) || {};
    const tube3Positions = getStitchPositions(3) || {};
    
    // Count stitches with different skip numbers across all tubes
    const skipNumberCounts = {
      3: 0,
      5: 0,
      10: 0,
      25: 0,
      100: 0
    };
    
    // Count total stitches and completions
    let totalStitches = 0;
    let totalCompletions = 0;
    
    // Process tube 1
    Object.values(tube1Positions).forEach(pos => {
      totalStitches++;
      totalCompletions += pos.perfectCompletions || 0;
      skipNumberCounts[pos.skipNumber] = (skipNumberCounts[pos.skipNumber] || 0) + 1;
    });
    
    // Process tube 2
    Object.values(tube2Positions).forEach(pos => {
      totalStitches++;
      totalCompletions += pos.perfectCompletions || 0;
      skipNumberCounts[pos.skipNumber] = (skipNumberCounts[pos.skipNumber] || 0) + 1;
    });
    
    // Process tube 3
    Object.values(tube3Positions).forEach(pos => {
      totalStitches++;
      totalCompletions += pos.perfectCompletions || 0;
      skipNumberCounts[pos.skipNumber] = (skipNumberCounts[pos.skipNumber] || 0) + 1;
    });
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">User Statistics</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="text-gray-400">EvoPoints:</div>
              <div className="font-medium">{learningProgress.evoPoints}</div>
            </div>
            <div className="flex justify-between">
              <div className="text-gray-400">Evolution Level:</div>
              <div className="font-medium">{learningProgress.evolutionLevel}</div>
            </div>
            <div className="flex justify-between">
              <div className="text-gray-400">Blink Speed:</div>
              <div className="font-medium">{learningProgress.currentBlinkSpeed.toFixed(2)}</div>
            </div>
            <div className="flex justify-between">
              <div className="text-gray-400">Total Stitches:</div>
              <div className="font-medium">{totalStitches}</div>
            </div>
            <div className="flex justify-between">
              <div className="text-gray-400">Total Completions:</div>
              <div className="font-medium">{totalCompletions}</div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Skip Number Distribution</h3>
          <div className="space-y-2">
            {Object.entries(skipNumberCounts).map(([skipNumber, count]) => (
              <div key={skipNumber} className="flex items-center">
                <div className="w-16 text-gray-400">Skip {skipNumber}:</div>
                <div className="flex-1 mx-2">
                  <div className="bg-gray-700 h-4 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        skipNumber === '3' ? 'bg-blue-500' :
                        skipNumber === '5' ? 'bg-green-500' :
                        skipNumber === '10' ? 'bg-yellow-500' :
                        skipNumber === '25' ? 'bg-orange-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${(count / totalStitches) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-8 text-right font-medium">{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };
  
  // Render history view
  const renderHistoryView = () => {
    // Filter history for the active user if one is selected
    const filteredHistory = activeUserId 
      ? operationHistory.filter(entry => entry.userId === activeUserId)
      : operationHistory;
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-lg font-semibold">Operation History</div>
          {operationHistory.length > 0 && (
            <button
              onClick={() => setOperationHistory([])}
              className="px-2 py-1 text-xs bg-red-600/30 hover:bg-red-600/50 rounded transition-colors"
            >
              Clear History
            </button>
          )}
        </div>
        
        {filteredHistory.length === 0 ? (
          <div className="text-center p-4 text-gray-400">
            No operation history available
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-auto">
            {filteredHistory.map((entry, index) => (
              <div key={index} className="bg-gray-800/50 rounded-lg p-3 border-l-4 border-blue-500">
                <div className="flex justify-between items-start">
                  <div className="font-medium">{entry.action}</div>
                  <div className="text-xs text-gray-400">{formatTime(entry.timestamp)}</div>
                </div>
                <div className="mt-1 text-sm">{entry.details}</div>
                {!activeUserId && (
                  <div className="mt-1 text-xs text-gray-500">
                    User: {entry.userId.substring(0, 8)}...
                  </div>
                )}
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
        <title>Multi-User Position Test - Zenjin Maths</title>
        <meta name="description" content="Test the position-based tube model with multiple users" />
        <style jsx global>{`
          .grid-cols-16 {
            grid-template-columns: repeat(16, minmax(50px, 1fr));
          }
        `}</style>
      </Head>
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-1 text-center">Multi-User Position Test</h1>
        <p className="text-gray-300 text-center mb-6">
          Test the position-based model with multiple users and server persistence
        </p>
        
        {/* User Selection */}
        <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Test Users</h2>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setIsCreatingUser(true)}
                className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-sm font-medium"
                disabled={isCreatingUser}
              >
                Create User
              </button>
              
              {testUsers.length > 0 && (
                <button
                  onClick={clearAllUserData}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm font-medium"
                >
                  Reset All
                </button>
              )}
            </div>
          </div>
          
          {isCreatingUser ? (
            <div className="flex items-center space-x-2 mb-4">
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="User name"
                className="flex-1 px-3 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={createTestUser}
                className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded font-medium"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreatingUser(false);
                  setNewUserName('');
                }}
                className="px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded font-medium"
              >
                Cancel
              </button>
            </div>
          ) : null}
          
          {testUsers.length === 0 ? (
            <div className="text-center p-4 text-gray-400">
              No test users created yet. Click "Create User" to add one.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {testUsers.map(user => (
                <div
                  key={user.id}
                  className={`
                    p-3 rounded-lg cursor-pointer transition-all
                    ${user.id === activeUserId 
                      ? `bg-${user.color}-900/50 ring-2 ring-${user.color}-500` 
                      : 'bg-gray-700/50 hover:bg-gray-700'}
                  `}
                  onClick={() => switchToUser(user.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-semibold">{user.name}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTestUser(user.id);
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-red-800/50 hover:bg-red-700 text-xs"
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-gray-300 truncate">{user.id}</div>
                  <div className="mt-1 text-xs text-gray-400">
                    {user.lastSynced 
                      ? `Last synced: ${formatDate(user.lastSynced)}`
                      : 'Never synced'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Action Panel - only visible when a user is selected */}
        {activeUserId && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-sm font-medium mb-2">Stitch Actions</div>
              <div className="space-y-2">
                <button
                  onClick={simulatePerfectCompletion}
                  disabled={isProcessing}
                  className="w-full px-3 py-2 text-sm bg-green-600 hover:bg-green-500 rounded transition-colors disabled:opacity-50"
                >
                  Perfect Completion (20/20)
                </button>
                <button
                  onClick={simulateCycleTube}
                  disabled={isProcessing}
                  className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded transition-colors disabled:opacity-50"
                >
                  Cycle to Next Tube
                </button>
              </div>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-sm font-medium mb-2">State Persistence</div>
              <div className="space-y-2">
                <button
                  onClick={syncActiveUserToServer}
                  disabled={isProcessing}
                  className="w-full px-3 py-2 text-sm bg-purple-600 hover:bg-purple-500 rounded transition-colors disabled:opacity-50"
                >
                  Save User State
                </button>
                <button
                  onClick={loadActiveUserFromServer}
                  disabled={isProcessing}
                  className="w-full px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 rounded transition-colors disabled:opacity-50"
                >
                  Load User State
                </button>
              </div>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-sm font-medium mb-2">Result</div>
              <div className="bg-gray-900 p-2 rounded min-h-[68px] text-sm font-mono break-words">
                {operationResult || 'No operations performed yet'}
              </div>
            </div>
          </div>
        )}
        
        {/* Tabs - only visible when a user is selected */}
        {activeUserId && (
          <>
            <div className="flex border-b border-gray-700 mb-4">
              <button
                className={`px-4 py-2 font-medium ${activeTab === 'grid' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
                onClick={() => setActiveTab('grid')}
              >
                Position Grid
              </button>
              <button
                className={`px-4 py-2 font-medium ${activeTab === 'stats' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
                onClick={() => setActiveTab('stats')}
              >
                Statistics
              </button>
              <button
                className={`px-4 py-2 font-medium ${activeTab === 'history' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
                onClick={() => setActiveTab('history')}
              >
                History
              </button>
            </div>
            
            <div className="mb-6">
              {activeTab === 'grid' && renderGridView()}
              {activeTab === 'stats' && renderStatsView()}
              {activeTab === 'history' && renderHistoryView()}
            </div>
          </>
        )}
        
        {/* Message when no user is selected */}
        {!activeUserId && testUsers.length > 0 && (
          <div className="text-center p-8 bg-gray-800/50 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Select a User</h3>
            <p className="text-gray-400">
              Click on a user above to view and modify their position-based tube state
            </p>
          </div>
        )}
      </main>
    </div>
  );
}