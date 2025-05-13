import React, { useState, useEffect } from 'react';
import { useTripleHelixPlayer } from '../lib/playerUtils';

interface DevTestPaneProps {
  player: any; // Make this more flexible
  show?: boolean;
}

/**
 * Enhanced DevTest Pane for Triple-Helix Player
 * 
 * A testing panel that provides buttons to complete
 * stitches with perfect scores and cycle tubes.
 * 
 * Now supports both anonymous and authenticated users with enhanced
 * recovery for the underlying state machine stats functions.
 */
const DevTestPane: React.FC<DevTestPaneProps> = ({ player, show = true }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStatsAvailable, setIsStatsAvailable] = useState(false);
  
  // Check if getStats is available on this player instance
  useEffect(() => {
    if (player && player.tubeCycler) {
      try {
        // If tubeCycler exists but getStats doesn't, patch it in
        if (typeof player.tubeCycler.getStats !== 'function') {
          console.log('DevTestPane: Adding getStats to tubeCycler');
          
          // Add a simplified getStats implementation that works with all player types
          player.tubeCycler.getStats = () => {
            try {
              const state = player.tubeCycler.getState();
              return {
                pendingChanges: 0,
                currentTube: state.activeTubeNumber || player.currentTube,
                userId: state.userId,
                tubes: Object.keys(state.tubes || {}).length
              };
            } catch (e) {
              console.error('Error in getStats implementation:', e);
              return { 
                pendingChanges: 0,
                currentTube: player.currentTube || 1,
                error: true 
              };
            }
          };
          setIsStatsAvailable(true);
        } else {
          // getStats already exists
          setIsStatsAvailable(true);
        }
      } catch (e) {
        console.error('DevTestPane: Error checking/patching getStats:', e);
        setIsStatsAvailable(false);
      }
    }
  }, [player]);
  
  // Get player stats safely (with recovery mechanism)
  const getPlayerStats = () => {
    try {
      if (player && player.tubeCycler) {
        if (typeof player.tubeCycler.getStats === 'function') {
          return player.tubeCycler.getStats();
        } else {
          // Fallback stats that are always valid
          return {
            pendingChanges: 0,
            currentTube: player.currentTube || 1,
            userId: player.userId || 'unknown'
          };
        }
      }
      return null;
    } catch (e) {
      console.error('Error getting player stats:', e);
      return null;
    }
  };
  
  // Complete current stitch with perfect score (20/20) without cycling tubes
  const completeCurrentStitch = () => {
    try {
      if (!player || !player.currentStitch) {
        console.error("No active stitch found");
        return;
      }

      // Get the current stitch and thread info
      const currentStitch = player.currentStitch;
      const threadId = currentStitch.threadId;
      const stitchId = currentStitch.id;

      console.log(`DevTestPane: Direct stitch completion for ${stitchId} in thread ${threadId}`);

      // For stitch advancement without tube cycling, we need to call StateMachine directly
      // This bypasses the normal handleSessionComplete flow that would cycle tubes
      if (player.tubeCycler) {
        // Safety check if handleStitchCompletion exists
        if (typeof player.tubeCycler.handleStitchCompletion === 'function') {
          try {
            // Call handleStitchCompletion directly on the tubeCycler (StateMachine)
            // This will advance the stitch within the same tube without cycling
            player.tubeCycler.handleStitchCompletion(threadId, stitchId, 20, 20);
          } catch (err) {
            console.error('Error in direct handleStitchCompletion call:', err);
            
            // Try recovery via regular session completion
            console.log('Falling back to regular session completion after error');
            player.handleSessionComplete({
              sessionId: `dev-session-${Date.now()}`,
              correctAnswers: 20,
              firstTimeCorrect: 20,
              totalQuestions: 20,
              totalPoints: 60,
              questionResults: Array(20).fill(0).map((_, i) => ({
                questionId: `q-${i+1}`,
                correct: true,
                timeToAnswer: 1500,
                firstTimeCorrect: true
              }))
            });
          }
        } else {
          console.error("tubeCycler does not have handleStitchCompletion method, using fallback");
          // Fallback to regular session completion
          player.handleSessionComplete({
            sessionId: `dev-session-${Date.now()}`,
            correctAnswers: 20,
            firstTimeCorrect: 20,
            totalQuestions: 20,
            totalPoints: 60,
            questionResults: Array(20).fill(0).map((_, i) => ({
              questionId: `q-${i+1}`,
              correct: true,
              timeToAnswer: 1500,
              firstTimeCorrect: true
            }))
          });
          return;
        }
        
        // Force a UI refresh after stitch advancement
        setTimeout(() => {
          try {
            // Get the updated stitch and state with safety checks
            let updatedStitch;
            if (player.tubeCycler && typeof player.tubeCycler.getCurrentStitch === 'function') {
              updatedStitch = player.tubeCycler.getCurrentStitch();
            } else if (player.currentStitch) {
              // Fallback - just use the current stitch as we can't get an updated one
              console.log("No getCurrentStitch method available, using current stitch");
              updatedStitch = player.currentStitch;
            }
            
            // Update the player's UI with the new stitch
            if (updatedStitch) {
              console.log(`Updated stitch after completion: ${updatedStitch.id}`);
              
              // Try several methods to force UI update based on the player implementation
              if (typeof player.setCurrentStitch === 'function') {
                player.setCurrentStitch(updatedStitch);
              } 
              
              // Force a page refresh if needed (this will make the UI reflect the new stitch state)
              // This is a last resort option for when the UI doesn't update properly
              // Remove comment to enable refresh: window.location.reload();
              
              // Add some visual feedback that the stitch was completed
              const devPane = document.querySelector('.fixed.bottom-0.right-0.z-50');
              if (devPane) {
                devPane.animate(
                  [
                    { backgroundColor: 'rgba(22, 163, 74, 0.3)' }, // green-700 with opacity
                    { backgroundColor: 'rgba(0, 0, 0, 0)' }
                  ],
                  { duration: 800, iterations: 1 }
                );
              }
            }
          } catch (err) {
            console.error('Error updating UI after stitch completion:', err);
          }
        }, 100);

        console.log('DevTestPane: Direct stitch advancement completed - staying in same tube');
      } else {
        // Fallback to the normal handleSessionComplete if tubeCycler is not available
        console.log('DevTestPane: Using standard session completion (may cycle tubes)');
        
        // Create a mock session result with perfect score (20/20)
        const mockSessionResults = {
          sessionId: `dev-session-${Date.now()}`,
          correctAnswers: 20,
          firstTimeCorrect: 20,
          totalQuestions: 20,
          totalPoints: 60, // 3 points per first-time correct answer (20 × 3 = 60)
          questionResults: Array(20).fill(0).map((_, i) => ({
            questionId: `q-${i+1}`,
            correct: true,
            timeToAnswer: 1500, // 1.5 seconds per question
            firstTimeCorrect: true
          })),
          blinkSpeed: 1.5, // Fast response time
          sessionDuration: 30,
          completedAt: new Date().toISOString()
        };
        
        // Complete the session using the standard flow
        player.handleSessionComplete(mockSessionResults);
      }
    } catch (err) {
      console.error('Error completing stitch:', err);
    }
  };
  
  // Cycle to next tube
  const cycleTubes = () => {
    if (!player) {
      console.error("Player object is not available");
      return;
    }
    
    // Try multiple methods to cycle tubes
    if (typeof player.cycleTubes === 'function') {
      player.cycleTubes();
    } else if (player.tubeCycler && typeof player.tubeCycler.cycleTubes === 'function') {
      player.tubeCycler.cycleTubes();
    } else if (player.handlePerfectScore) {
      // Last resort: just simulate a perfect score which should cycle tubes
      console.log("Using handlePerfectScore as fallback for tube cycling");
      player.handlePerfectScore();
    } else {
      console.error("No method available to cycle tubes");
    }
  };
  
  // Let user select a specific tube
  const selectTube = (tubeNum: number) => {
    if (!player) {
      console.error("Player object is not available");
      return;
    }
    
    // Try multiple methods to select a tube
    if (typeof player.handleManualTubeSelect === 'function') {
      player.handleManualTubeSelect(tubeNum);
    } else if (player.tubeCycler && typeof player.tubeCycler.selectTube === 'function') {
      player.tubeCycler.selectTube(tubeNum);
    } else {
      console.error("No method available to manually select tube");
    }
  };
  
  // If not showing, render nothing
  if (!show) return null;
  
  // Function to get if state has valid userId
  const hasValidUserId = () => {
    try {
      if (player && player.tubeCycler && player.tubeCycler.getState) {
        const state = player.tubeCycler.getState();
        return !!state.userId;
      }
      return false;
    } catch (e) {
      console.error('Error checking userId:', e);
      return false;
    }
  };
  
  // Get user info for display
  const getUserInfo = () => {
    try {
      if (player && player.tubeCycler && player.tubeCycler.getState) {
        const state = player.tubeCycler.getState();
        return {
          userId: state.userId || 'Not set',
          isAuthenticated: state.userId && !state.userId.startsWith('anonymous'),
          tubeTotals: Object.entries(state.tubes || {}).reduce((acc, [tubeNum, tube]) => {
            // Support both position-based and legacy stitches array formats
            let stitchCount = 0;

            // First check if we have positions (new format)
            if (tube?.positions && Object.keys(tube.positions).length > 0) {
              stitchCount = Object.keys(tube.positions).length;
            }
            // Fall back to legacy stitches array if available
            else if (tube?.stitches && tube.stitches.length > 0) {
              stitchCount = tube.stitches.length;
            }

            // @ts-ignore
            acc[tubeNum] = stitchCount;
            return acc;
          }, {1: 0, 2: 0, 3: 0}),
        };
      }
      return {
        userId: 'Unknown',
        isAuthenticated: false,
        tubeTotals: {1: 0, 2: 0, 3: 0}
      };
    } catch (e) {
      console.error('Error getting user info:', e);
      return {
        userId: 'Error',
        isAuthenticated: false,
        tubeTotals: {1: 0, 2: 0, 3: 0}
      };
    }
  };
  
  // Get panel color based on authentication status
  const getPanelColor = () => {
    const userInfo = getUserInfo();
    return userInfo.isAuthenticated ? 'bg-green-800' : 'bg-indigo-800';
  };
  
  return (
    <div className="fixed top-20 right-0 z-50 w-48 bg-gray-900/90 backdrop-blur-sm text-white font-mono text-xs rounded-l-lg overflow-hidden shadow-lg border-l border-t border-b border-gray-700">
      {/* Header bar */}
      <div 
        className={`p-2 ${getPanelColor()} flex justify-between items-center cursor-pointer`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="font-bold text-xs">
          🔧 DevTest {player?.currentTube && `T${player.currentTube}`}
        </h3>
        <span>{isExpanded ? '►' : '◄'}</span>
      </div>
      
      {/* Expandable content */}
      {isExpanded && (
        <div className="p-2">
          {/* User info */}
          <div className="mb-2 border-b border-gray-700 pb-2 text-[9px]">
            <div className="space-y-0.5">
              <p className="truncate text-gray-400">
                User: <span className={getUserInfo().isAuthenticated ? 'text-green-300' : 'text-yellow-300'}>
                  {getUserInfo().userId.substring(0, 12)}
                  {getUserInfo().userId.length > 12 ? '...' : ''}
                </span>
              </p>
              <div className="flex justify-between text-gray-400">
                <span>T1: {getUserInfo().tubeTotals[1]}</span>
                <span>T2: {getUserInfo().tubeTotals[2]}</span>
                <span>T3: {getUserInfo().tubeTotals[3]}</span>
              </div>
            </div>
          </div>
          
          {/* Current stitch info */}
          <div className="mb-2 border-b border-gray-700 pb-2 text-[10px]">
            {player?.currentStitch ? (
              <div className="space-y-0.5">
                <p className="truncate text-teal-300">{player.currentStitch.id}</p>
                <p className="truncate text-amber-300">{player.currentStitch.threadId}</p>
              </div>
            ) : (
              <p className="text-red-400 text-[10px]">No active stitch</p>
            )}
          </div>
          
          {/* Action buttons - vertically stacked */}
          <div className="space-y-1.5">
            <button
              onClick={completeCurrentStitch}
              className="bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded-sm w-full text-[10px]"
              disabled={!player?.currentStitch}
            >
              Complete Stitch
            </button>
            
            <button
              onClick={() => {
                try {
                  if (!player || !player.currentStitch) {
                    console.error("No active stitch found");
                    return;
                  }
                  
                  // Create a mock session result with perfect score (20/20)
                  const mockSessionResults = {
                    sessionId: `dev-session-${Date.now()}`,
                    correctAnswers: 20,
                    firstTimeCorrect: 20,
                    totalQuestions: 20,
                    totalPoints: 60, // 3 points per first-time correct answer (20 × 3 = 60)
                    questionResults: Array(20).fill(0).map((_, i) => ({
                      questionId: `q-${i+1}`,
                      correct: true,
                      timeToAnswer: 1500, // 1.5 seconds per question
                      firstTimeCorrect: true
                    })),
                    blinkSpeed: 1.5, // Fast response time
                    sessionDuration: 30,
                    completedAt: new Date().toISOString()
                  };
                  
                  // Use the standard session completion which cycles tubes
                  console.log('DevTestPane: Normal session completion (with tube cycling)');
                  player.handleSessionComplete(mockSessionResults);
                } catch (err) {
                  console.error('Error completing stitch with tube cycling:', err);
                }
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded-sm w-full text-[10px]"
              disabled={!player?.currentStitch}
            >
              Complete & Cycle
            </button>
            
            <button
              onClick={cycleTubes}
              className="bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded-sm w-full text-[10px]"
            >
              Cycle Tubes
            </button>
            
            <div className="flex space-x-1">
              {[1, 2, 3].map(tubeNum => (
                <button
                  key={tubeNum}
                  onClick={() => selectTube(tubeNum)}
                  className={`px-2 py-1 rounded-sm text-[10px] ${
                    player?.currentTube === tubeNum
                      ? 'bg-teal-700 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  } flex-1`}
                >
                  T{tubeNum}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevTestPane;