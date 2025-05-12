import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import MinimalDistinctionPlayer from '../components/MinimalDistinctionPlayer';
import MinimalDistinctionPlayerWithUpgrade from '../components/MinimalDistinctionPlayerWithUpgrade';
import BackgroundBubbles from '../components/BackgroundBubbles';
import StitchCelebration from '../components/StitchCelebration';
import SubscriptionStatusIndicator from '../components/subscription/SubscriptionStatusIndicator';
import DevTestPane from '../components/DevTestPane';
import { useAuth } from '../context/AuthContext';
import { useTripleHelixPlayer } from '../lib/playerUtils';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';
import UserWelcomeButton from '../components/UserWelcomeButton';

// Component for playful loading messages that cycle every 2 seconds
const LoadingMessage = ({ isAnonymous }: { isAnonymous: boolean }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  
  // Different message sets for anonymous vs. logged-in users
  const anonymousMessages = [
    "Warming up our number powers...",
    "Getting your maths playground ready...",
    "Counting down to blast off...",
    "Preparing your brain challenge...",
    "Loading the number fun..."
  ];
  
  const memberMessages = [
    "Firing up the engines...",
    "Tuning the math circuits...",
    "Calculating all the things...",
    "Organizing your learning journey...",
    "Preparing your personalized content..."
  ];
  
  // Select the appropriate message set
  const messages = isAnonymous ? anonymousMessages : memberMessages;
  
  // Cycle through messages every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [messages.length]);
  
  return <>{messages[messageIndex]}</>;
};

/**
 * Minimal Player - Triple-Helix with minimal UI
 * 
 * This is a streamlined version of the player that removes the admin controls
 * but keeps the player component exactly the same
 */
export default function MinimalPlayer() {
  const router = useRouter();
  const { mode, force, resetPoints, dev, admin, continue: shouldContinue } = router.query;
  const { user, isAuthenticated, loading: authLoading, signOut } = useAuth();
  const { isSubscribed, tier } = useSubscriptionStatus();

  // Add state for admin tube debugging
  const [tubeInfo, setTubeInfo] = useState<any>({});
  const [showAdminControls] = useState(admin === 'true');
  const [adminMessage, setAdminMessage] = useState('');

  // Simply check if auth is loading - no need for additional state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center player-bg">
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-xl shadow-xl text-center">
          <div className="animate-spin mb-4 h-12 w-12 border-4 border-t-teal-500 border-teal-200 rounded-full mx-auto"></div>
          <h2 className="text-xl font-medium text-white">Preparing Your Learning Experience</h2>
          <p className="text-white/70 mt-2">Loading your personalized content...</p>
        </div>
      </div>
    );
  }
  
  // Check if we should reset points but maintain stitch progress
  const shouldResetPoints = resetPoints === 'true';
  
  // Check if we should continue from previous state (important for "Continue Playing" button)
  // Get continue flag from both the query parameter and localStorage
  // This ensures we continue from the previous state even if the URL parameter isn't present
  const continuePreviousState = 
    shouldContinue === 'true' || 
    (typeof window !== 'undefined' && localStorage.getItem('zenjin_continue_previous_state') === 'true');
    
  // Clear the flag after reading it to prevent persisting the state indefinitely
  if (typeof window !== 'undefined' && localStorage.getItem('zenjin_continue_previous_state') === 'true') {
    console.log('CRITICAL: Clearing zenjin_continue_previous_state flag after reading');
    localStorage.removeItem('zenjin_continue_previous_state');
  }
  
  // Check if dev mode is enabled
  const showDevTools = dev === 'true';
  
  // Determine the correct player mode based solely on auth state - simple and clear
  const playerMode = isAuthenticated && user?.id ? 'authenticated' : 'anonymous';

  // Simplified logging - just a single log statement
  console.log(`Auth state: User is ${isAuthenticated ? 'authenticated' : 'anonymous'}, mode: ${playerMode}, ID: ${user?.id || 'anonymous'}`);

  // Function to manually switch tubes (for debugging)
  const switchTube = (tubeNumber: number) => {
    // Get the user ID
    const uid = localStorage.getItem('zenjin_user_id') ||
                localStorage.getItem('zenjin_anonymous_id') ||
                user?.id || 'anonymous';

    try {
      // Update main state
      const stateKey = `zenjin_state_${uid}`;
      const stateJson = localStorage.getItem(stateKey);

      if (stateJson) {
        const state = JSON.parse(stateJson);
        state.activeTube = tubeNumber;
        state.activeTubeNumber = tubeNumber;
        state.lastUpdated = new Date().toISOString();
        localStorage.setItem(stateKey, JSON.stringify(state));

        // Also update anonymous state if it exists
        const anonStateJson = localStorage.getItem('zenjin_anonymous_state');
        if (anonStateJson) {
          try {
            const anonState = JSON.parse(anonStateJson);
            if (anonState.state) {
              anonState.state.activeTube = tubeNumber;
              anonState.state.activeTubeNumber = tubeNumber;
              localStorage.setItem('zenjin_anonymous_state', JSON.stringify(anonState));
            }
          } catch (e) {
            console.error('Error updating anonymous state:', e);
          }
        }

        // Also update triple helix state
        const tripleHelixJson = localStorage.getItem(`triple_helix_state_${uid}`);
        if (tripleHelixJson) {
          try {
            const tripleHelix = JSON.parse(tripleHelixJson);
            tripleHelix.activeTube = tubeNumber;
            tripleHelix.activeTubeNumber = tubeNumber;
            localStorage.setItem(`triple_helix_state_${uid}`, JSON.stringify(tripleHelix));
          } catch (e) {
            console.error('Error updating triple helix state:', e);
          }
        }

        // Reload to see changes
        window.location.reload();
      } else {
        alert('No state found to update');
      }
    } catch (e) {
      console.error('Error switching tube:', e);
      alert(`Error: ${e.message}`);
    }
  };
  
  // If the user is anonymous and we have the create flag, ensure we create a proper account
  if (typeof window !== 'undefined' && !isAuthenticated) {
    const createAnonymousState = localStorage.getItem('zenjin_create_anonymous_state') === 'true';
    if (createAnonymousState) {
      console.log('DEBUGGING: Anonymous account creation flag detected in minimal-player');
      // Clear the flag after detecting it to prevent repeated creation
      localStorage.removeItem('zenjin_create_anonymous_state');
      console.log('DEBUGGING: Cleared anonymous creation flag after handling');
      // Flag will be handled by _app.tsx and createAnonymousUser in anonymousData.ts
    } else {
      console.log('DEBUGGING: No anonymous creation flag found in minimal-player');
    }
  }
  
  // Use the shared player hook with the appropriate mode
  const player = useTripleHelixPlayer({
    mode: playerMode,
    resetPoints: shouldResetPoints, // Reset points but maintain stitch progress
    continuePreviousState: continuePreviousState, // Continue from previous state (for Continue Playing button)
    // Enhanced debug for better visibility of player continuation issues
    debug: (message) => {
      console.log(`🔄 PLAYER[${playerMode}]: ${message}`);

      // Add extra debugging for tube state issues
      if (message.includes('tube') || message.includes('Tube') ||
          message.includes('state') || message.includes('State') ||
          message.includes('continue') || message.includes('Continue')) {
        console.log(`🔍 TUBE-DEBUG: ${message}`);
      }
    }
  });

  // Effect to get tube state info when admin mode is enabled
  useEffect(() => {
    if (!showAdminControls || typeof window === 'undefined') return;

    // Get the user ID
    const uid = localStorage.getItem('zenjin_user_id') ||
              localStorage.getItem('zenjin_anonymous_id') ||
              user?.id || 'anonymous';

    // Get tube info from localStorage
    const info: any = {};

    // Check main state
    try {
      const stateKey = `zenjin_state_${uid}`;
      const stateJson = localStorage.getItem(stateKey);

      if (stateJson) {
        const state = JSON.parse(stateJson);
        info.main = {
          activeTube: state.activeTube || state.activeTubeNumber,
          lastUpdated: state.lastUpdated ? new Date(state.lastUpdated).toLocaleString() : 'unknown',
          tubes: {}
        };

        // Add tube data
        if (state.tubes) {
          [1, 2, 3].forEach(tubeNumber => {
            if (state.tubes[tubeNumber]) {
              const tube = state.tubes[tubeNumber];
              info.main.tubes[tubeNumber] = {
                stitchCount: tube.stitches?.length || 0,
                currentStitch: tube.stitches?.find((s: any) => s.position === 0)?.id || 'none'
              };
            }
          });
        }
      }
    } catch (e) {
      console.error('Error reading main state:', e);
    }

    // Check anonymous state
    try {
      const anonStateJson = localStorage.getItem('zenjin_anonymous_state');
      if (anonStateJson) {
        const anonState = JSON.parse(anonStateJson);
        if (anonState.state) {
          const state = anonState.state;
          info.anonymous = {
            activeTube: state.activeTube || state.activeTubeNumber,
            lastUpdated: state.lastUpdated ? new Date(state.lastUpdated).toLocaleString() : 'unknown'
          };
        }
      }
    } catch (e) {
      console.error('Error reading anonymous state:', e);
    }

    // Check triple helix state
    try {
      const tripleHelixJson = localStorage.getItem(`triple_helix_state_${uid}`);
      if (tripleHelixJson) {
        const state = JSON.parse(tripleHelixJson);
        info.tripleHelix = {
          activeTube: state.activeTube || state.activeTubeNumber,
          lastUpdated: state.lastUpdated ? new Date(state.lastUpdated).toLocaleString() : 'unknown'
        };
      }
    } catch (e) {
      console.error('Error reading triple helix state:', e);
    }

    // Check continue flag
    info.continueFlag = localStorage.getItem('zenjin_continue_previous_state') === 'true';

    // Update state
    setTubeInfo(info);

    // Global adapter reference
    if (typeof window !== 'undefined') {
      // Wait a bit for adapter to initialize
      setTimeout(() => {
        const adapter = (window as any).__stateMachineTubeCyclerAdapter;
        if (adapter) {
          console.log('Admin controls: Found tube cycler adapter in global scope');
        } else {
          console.log('Admin controls: No tube cycler adapter found in global scope');
        }
      }, 2000);
    }
  }, [showAdminControls, user?.id]);

  // We no longer need URL correction since we don't use mode parameters

  return (
    <div className="min-h-screen player-bg relative">
      <Head>
        <title>{player.isAnonymous ? 'Free Maths Practice' : 'Zenjin Maths'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      {/* Background bubbles at the page level for continuous animation */}
      <BackgroundBubbles />

      {/* Simple debug buttons - remove after testing */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 bg-black/50 p-3 rounded-lg backdrop-blur-sm">
        <div className="text-white text-xs font-bold mb-1">Debug Controls:</div>
        <div className="text-white text-xs mb-2">Current Tube: <span className="font-bold">{player.currentStitch?.tubeNumber || '?'}</span></div>
        <div className="flex gap-2">
          <button
            onClick={() => switchTube(1)}
            className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
          >
            Tube 1
          </button>
          <button
            onClick={() => switchTube(2)}
            className="text-xs bg-green-600 text-white px-2 py-1 rounded"
          >
            Tube 2
          </button>
          <button
            onClick={() => switchTube(3)}
            className="text-xs bg-purple-600 text-white px-2 py-1 rounded"
          >
            Tube 3
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              // Try to complete with perfect score
              const adapter = (window as any).__stateMachineTubeCyclerAdapter;

              if (adapter && player.currentStitch) {
                try {
                  adapter.handleStitchCompletion(
                    player.currentStitch.threadId,
                    player.currentStitch.id,
                    20, // Perfect score
                    20  // Total questions
                  );
                  alert('Completed stitch with perfect score (20/20)');
                  window.location.reload();
                } catch (e) {
                  console.error('Error completing stitch:', e);
                  alert(`Error: ${e.message}`);
                }
              } else {
                alert('No adapter or stitch available');
              }
            }}
            className="text-xs bg-green-600 text-white px-2 py-1 rounded"
          >
            Complete 20/20
          </button>
          <button
            onClick={() => {
              // Try to complete with partial score
              const adapter = (window as any).__stateMachineTubeCyclerAdapter;

              if (adapter && player.currentStitch) {
                try {
                  adapter.handleStitchCompletion(
                    player.currentStitch.threadId,
                    player.currentStitch.id,
                    10, // Partial score
                    20  // Total questions
                  );
                  alert('Completed stitch with partial score (10/20)');
                  window.location.reload();
                } catch (e) {
                  console.error('Error completing stitch:', e);
                  alert(`Error: ${e.message}`);
                }
              } else {
                alert('No adapter or stitch available');
              }
            }}
            className="text-xs bg-amber-600 text-white px-2 py-1 rounded"
          >
            Complete 10/20
          </button>
        </div>
        <button
          onClick={() => {
            localStorage.setItem('zenjin_continue_previous_state', 'true');
            window.location.href = '/dashboard';
          }}
          className="text-xs bg-purple-600 text-white px-2 py-1 rounded"
        >
          End + Go Dashboard
        </button>
      </div>

      {/* Track current stitch ID in a global variable to help the StitchCelebration component */}
      {player.currentStitch && (
        <script dangerouslySetInnerHTML={{
          __html: `
            window.__PLAYER_STATE__ = window.__PLAYER_STATE__ || {};
            window.__PLAYER_STATE__.currentStitch = {
              id: "${player.currentStitch.id}",
              threadId: "${player.currentStitch.threadId}",
              timestamp: ${Date.now()}
            };
            // Track celebrations at window level to ensure consistency
            window.__PLAYER_CELEBRATIONS__ = window.__PLAYER_CELEBRATIONS__ || {};
            // Debug output in case we need it
            console.log('Current stitch in player: ${player.currentStitch.id}');
          `
        }} />
      )}
      
      {/* Welcome message with user name */}
      <div className="absolute top-4 left-4 z-20">
        <UserWelcomeButton user={user} isAuthenticated={isAuthenticated} />
      </div>
      
      {/* Remove login prompt for anonymous users */}
      
      {/* Main content area */}
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen relative" style={{zIndex: 'auto'}}>
        {player.isLoading ? (
          <div className="bg-white/20 backdrop-blur-lg rounded-xl p-6 text-center shadow-xl">
            <div className="inline-block animate-spin h-10 w-10 border-4 border-blue-300 border-t-transparent rounded-full mb-2"></div>
            <p className="text-white text-lg">
              {/* Fun loading messages that cycle every 2 seconds */}
              <LoadingMessage isAnonymous={player.isAnonymous} />
            </p>
          </div>
        ) : player.loadError ? (
          <div className="bg-white/20 backdrop-blur-lg rounded-xl p-8 text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-white">Error Loading Content</h2>
            <div className="bg-red-500/20 border border-red-300/30 text-red-100 rounded-lg p-4 mb-6">
              {player.loadError}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : !player.currentStitch ? (
          <div className="bg-white/20 backdrop-blur-lg rounded-xl p-8 text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-white">No Content Available</h2>
            <p className="mb-4 text-white">There is no active content.</p>
            <button
              onClick={() => router.push('/')}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Back to Home
            </button>
          </div>
        ) : (
          /* Render the player with celebration pill properly positioned relative to it */
          <div className="relative">
            {/* Position the celebration inside the player container */}
            {player.showCelebration && (
              <StitchCelebration 
                isVisible={player.showCelebration}
                onComplete={() => {
                  console.log('🎬 MinimalPlayer: StitchCelebration complete - setting showCelebration to false');
                  player.setShowCelebration(false);
                }}
              />
            )}
            
            {/* Use the subscription-aware player component */}
            <MinimalDistinctionPlayerWithUpgrade
              thread={{
                id: player.currentStitch.threadId,
                name: player.currentStitch.threadId,
                description: `Thread ${player.currentStitch.threadId}`,
                stitches: [player.currentStitch],
                // Add original stitch count to help the upgrade component determine limits
                originalStitchCount: player.currentStitch.totalStitchesInThread || undefined
              }}
              onComplete={(results) => {
                console.log('🎯 MinimalPlayer: onComplete called with results', { points: results.totalPoints });
                // Just handle stitch progression normally - continue in the player
                player.handleSessionComplete(results);
              }}
              onEndSession={(results) => {
                console.log('🚪 MinimalPlayer: onEndSession called with results', { 
                  points: results.totalPoints, 
                  goDashboard: results.goDashboard || false
                });
                
                // Force navigation to dashboard when the user clicks "Continue to Dashboard"
                if (results.goDashboard) {
                  console.log('🚪 Forcing navigation to dashboard as requested by Continue to Dashboard button');
                  // First record the session
                  player.handleSessionComplete(results, true);
                
                  // Determine which dashboard to navigate to based on authentication state
                  // Authenticated users should always go to the authenticated dashboard
                  const isAnonymous = !isAuthenticated && (player.isAnonymous || mode === 'anonymous');
                  const dashboardUrl = isAnonymous ? '/anon-dashboard' : '/dashboard';
                  
                  console.log(`🚪 Preparing navigation to ${dashboardUrl} (user is ${isAnonymous ? 'anonymous' : 'authenticated'})`);
                  
                  // Fallback navigation - after a delay, if we're still here, force navigation to appropriate dashboard
                  setTimeout(() => {
                    console.log(`🚪 Fallback navigation to ${dashboardUrl} (delayed)`);
                    // Use router.push instead of window.location for better state preservation
                    router.push(dashboardUrl);
                  }, 2000);
                } else {
                  // Normal end session flow:
                  // 1. Session data is saved (either to localStorage or server)
                  // 2. Tube configuration is persisted (for continuation later)
                  // 3. Navigation to dashboard happens automatically in handleSessionComplete
                  player.handleSessionComplete(results, true);
                }
              }}
              questionsPerSession={20}
              sessionTotalPoints={player.accumulatedSessionData.totalPoints}
              userId={user?.id} // Pass the user ID for authentication
            />
          </div>
        )}
      </div>
      
      {/* DevTest Pane - only shown when dev=true query param is provided */}
      {showDevTools && <DevTestPane player={player} />}

      {/* Simple Admin Controls - only shown when admin=true query param is provided */}
      {showAdminControls && (
        <div className="fixed top-20 right-4 z-50 bg-gray-900/90 p-4 rounded-lg shadow-lg text-white text-sm max-w-xs">
          <h3 className="text-lg font-semibold mb-3 border-b border-gray-700 pb-2">Tube Admin Controls</h3>

          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <span>Current Tube:</span>
              <span className="font-bold">{player.currentStitch?.tubeNumber || 'Unknown'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Current Stitch:</span>
              <span className="font-mono text-xs">{player.currentStitch?.id || 'Unknown'}</span>
            </div>

            {/* Storage state summary */}
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="text-xs mb-1 font-semibold">State Storage Summary:</div>

              {/* Main state */}
              {tubeInfo.main && (
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span>Main state tube:</span>
                  <span className={`font-medium ${tubeInfo.main.activeTube === player.currentStitch?.tubeNumber ? 'text-green-400' : 'text-red-400'}`}>
                    Tube {tubeInfo.main.activeTube}
                  </span>
                </div>
              )}

              {/* Anonymous state */}
              {tubeInfo.anonymous && (
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span>Anonymous state tube:</span>
                  <span className={`font-medium ${tubeInfo.anonymous.activeTube === player.currentStitch?.tubeNumber ? 'text-green-400' : 'text-red-400'}`}>
                    Tube {tubeInfo.anonymous.activeTube}
                  </span>
                </div>
              )}

              {/* Triple helix state */}
              {tubeInfo.tripleHelix && (
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span>Triple helix state tube:</span>
                  <span className={`font-medium ${tubeInfo.tripleHelix.activeTube === player.currentStitch?.tubeNumber ? 'text-green-400' : 'text-red-400'}`}>
                    Tube {tubeInfo.tripleHelix.activeTube}
                  </span>
                </div>
              )}

              {/* Continue flag */}
              <div className="flex items-center justify-between mb-1 text-xs">
                <span>Continue flag:</span>
                <span className={tubeInfo.continueFlag ? 'text-green-400' : 'text-gray-400'}>
                  {tubeInfo.continueFlag ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            {[1, 2, 3].map(tubeNumber => (
              <button
                key={tubeNumber}
                onClick={() => {
                  // Access any available adapter on the window object
                  const adapter = (window as any).__stateMachineTubeCyclerAdapter;

                  if (adapter && typeof adapter.setActiveTube === 'function') {
                    try {
                      adapter.setActiveTube(tubeNumber);
                      setAdminMessage(`Switched to Tube ${tubeNumber}`);

                      // Force refresh by location change to avoid React state issues
                      setTimeout(() => {
                        window.location.href = `/minimal-player?admin=true${shouldContinue ? '&continue=true' : ''}`;
                      }, 500);
                    } catch (e) {
                      console.error('Error switching tube:', e);
                      setAdminMessage(`Error: ${e.message}`);
                    }
                  } else {
                    // Try direct localStorage manipulation as fallback
                    try {
                      const uid = localStorage.getItem('zenjin_user_id') ||
                                localStorage.getItem('zenjin_anonymous_id') ||
                                user?.id || 'anonymous';

                      const stateKey = `zenjin_state_${uid}`;
                      const stateJson = localStorage.getItem(stateKey);

                      if (stateJson) {
                        const state = JSON.parse(stateJson);

                        // Update tube number
                        state.activeTube = tubeNumber;
                        state.activeTubeNumber = tubeNumber;
                        state.lastUpdated = new Date().toISOString();

                        // Save back to localStorage
                        localStorage.setItem(stateKey, JSON.stringify(state));

                        // Also save to anonymous state if that exists
                        const anonStateJson = localStorage.getItem('zenjin_anonymous_state');
                        if (anonStateJson) {
                          try {
                            const anonState = JSON.parse(anonStateJson);
                            if (anonState.state) {
                              anonState.state.activeTube = tubeNumber;
                              anonState.state.activeTubeNumber = tubeNumber;
                              anonState.state.lastUpdated = new Date().toISOString();
                              localStorage.setItem('zenjin_anonymous_state', JSON.stringify(anonState));
                            }
                          } catch (e) {
                            console.error('Error updating anonymous state:', e);
                          }
                        }

                        // Also save to triple helix state
                        const tripleHelixJson = localStorage.getItem(`triple_helix_state_${uid}`);
                        if (tripleHelixJson) {
                          try {
                            const tripleHelix = JSON.parse(tripleHelixJson);
                            tripleHelix.activeTube = tubeNumber;
                            tripleHelix.activeTubeNumber = tubeNumber;
                            tripleHelix.lastUpdated = new Date().toISOString();
                            localStorage.setItem(`triple_helix_state_${uid}`, JSON.stringify(tripleHelix));
                          } catch (e) {
                            console.error('Error updating triple helix state:', e);
                          }
                        }

                        setAdminMessage(`Switched to Tube ${tubeNumber}`);

                        // Force refresh by location change to avoid React state issues
                        setTimeout(() => {
                          window.location.href = `/minimal-player?admin=true${shouldContinue ? '&continue=true' : ''}`;
                        }, 500);
                      } else {
                        setAdminMessage('No state found to update');
                      }
                    } catch (e) {
                      console.error('Error manipulating localStorage:', e);
                      setAdminMessage(`Error: ${e.message}`);
                    }
                  }
                }}
                className={`py-2 px-4 rounded-lg font-medium ${
                  player.currentStitch?.tubeNumber === tubeNumber
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                Switch to Tube {tubeNumber}
              </button>
            ))}

            <button
              onClick={() => {
                // Try to complete current stitch with perfect score
                const adapter = (window as any).__stateMachineTubeCyclerAdapter;

                if (adapter && player.currentStitch) {
                  try {
                    adapter.handleStitchCompletion(
                      player.currentStitch.threadId,
                      player.currentStitch.id,
                      20, // Perfect score
                      20  // Total questions
                    );
                    setAdminMessage('Completed stitch with perfect score (20/20)');

                    // Force refresh
                    setTimeout(() => {
                      window.location.href = `/minimal-player?admin=true${shouldContinue ? '&continue=true' : ''}`;
                    }, 500);
                  } catch (e) {
                    console.error('Error completing stitch:', e);
                    setAdminMessage(`Error: ${e.message}`);
                  }
                } else {
                  setAdminMessage('No adapter or stitch available');
                }
              }}
              className="mt-2 py-2 px-4 rounded-lg bg-green-700 hover:bg-green-600 text-white"
            >
              Complete Stitch 20/20
            </button>

            <button
              onClick={() => {
                // Set continue flag and force refresh
                localStorage.setItem('zenjin_continue_previous_state', 'true');
                setAdminMessage('Set continue flag to true');
                setTimeout(() => {
                  window.location.href = '/dashboard';
                }, 500);
              }}
              className="py-2 px-4 rounded-lg bg-teal-700 hover:bg-teal-600 text-white"
            >
              End & Go to Dashboard
            </button>

            <button
              onClick={() => {
                window.location.href = `/minimal-player?admin=true${shouldContinue ? '&continue=true' : ''}`;
              }}
              className="py-2 px-4 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
            >
              Refresh
            </button>
          </div>

          {adminMessage && (
            <div className="mt-3 p-2 bg-gray-800 rounded text-xs text-gray-300">
              {adminMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}