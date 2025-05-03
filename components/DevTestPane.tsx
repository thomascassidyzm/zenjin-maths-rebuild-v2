import React, { useState } from 'react';
import { useTripleHelixPlayer } from '../lib/playerUtils';

interface DevTestPaneProps {
  player: any; // Make this more flexible
  show?: boolean;
}

/**
 * Simple DevTest Pane for Triple-Helix Player
 * 
 * A minimal testing panel that provides buttons to complete
 * stitches with perfect scores and cycle tubes.
 */
const DevTestPane: React.FC<DevTestPaneProps> = ({ player, show = true }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
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
        // Call handleStitchCompletion directly on the tubeCycler (StateMachine)
        // This will advance the stitch within the same tube without cycling
        player.tubeCycler.handleStitchCompletion(threadId, stitchId, 20, 20);
        
        // Force a UI refresh after stitch advancement
        setTimeout(() => {
          try {
            // Get the updated stitch and state
            const updatedStitch = player.tubeCycler.getCurrentStitch();
            
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
    if (!player || !player.cycleTubes) {
      console.error("Player object doesn't support cycleTubes");
      return;
    }
    player.cycleTubes();
  };
  
  // Let user select a specific tube
  const selectTube = (tubeNum: number) => {
    if (!player || !player.handleManualTubeSelect) {
      console.error("Player object doesn't support handleManualTubeSelect");
      return;
    }
    player.handleManualTubeSelect(tubeNum);
  };
  
  // If not showing, render nothing
  if (!show) return null;
  
  return (
    <div className="fixed bottom-0 right-0 z-50 max-w-lg bg-gray-900/90 backdrop-blur-sm text-white font-mono text-xs rounded-tl-lg overflow-hidden shadow-lg border-l border-t border-gray-700">
      {/* Header bar */}
      <div 
        className="p-2 bg-indigo-800 flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="font-bold">
          🔧 DevTest Pane {player?.currentStitch && `- Tube ${player.currentTube}`}
        </h3>
        <span>{isExpanded ? '▼' : '▲'}</span>
      </div>
      
      {/* Expandable content */}
      {isExpanded && (
        <div className="p-3">
          {/* Current stitch info */}
          <div className="mb-3 border-b border-gray-700 pb-2">
            <h4 className="font-bold mb-1">Current State:</h4>
            {player?.currentStitch ? (
              <div>
                <p>Stitch: <span className="text-teal-300">{player.currentStitch.id}</span></p>
                <p>Thread: <span className="text-amber-300">{player.currentStitch.threadId}</span></p>
                <p>Tube: <span className="text-purple-300">{player.currentTube}</span></p>
              </div>
            ) : (
              <p className="text-red-400">No active stitch</p>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="space-y-2">
            <h4 className="font-bold mb-1">Actions:</h4>
            
            <div className="flex flex-col space-y-2">
              <button
                onClick={completeCurrentStitch}
                className="bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded w-full"
                disabled={!player?.currentStitch}
              >
                Complete Stitch (Stay in Tube)
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
                className="bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded w-full"
                disabled={!player?.currentStitch}
              >
                Complete & Cycle Tubes
              </button>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={cycleTubes}
                className="bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded flex-1"
              >
                Cycle Tubes
              </button>
              
              <div className="flex space-x-1">
                {[1, 2, 3].map(tubeNum => (
                  <button
                    key={tubeNum}
                    onClick={() => selectTube(tubeNum)}
                    className={`px-2 py-1 rounded ${
                      player?.currentTube === tubeNum
                        ? 'bg-teal-700 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                  >
                    T{tubeNum}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Dev note */}
          <div className="mt-3 pt-2 border-t border-gray-700 text-gray-500 text-xs">
            DevTest Pane: Complete stitches with perfect scores to test position handling
          </div>
        </div>
      )}
    </div>
  );
};

export default DevTestPane;