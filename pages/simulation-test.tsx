import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { StitchSequencer } from '../lib/StitchSequencer';
import { ThreadData, StitchWithProgress } from '../lib/types/distinction-learning';

// Simulation for testing tube cycling and stitch progression
export default function SimulationTest() {
  const router = useRouter();
  const { isAuthenticated, user, userEmail } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [threadData, setThreadData] = useState<ThreadData[]>([]);
  const [sequencer, setSequencer] = useState<StitchSequencer | null>(null);
  const [simLog, setSimLog] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [simulationPlan, setSimulationPlan] = useState<Array<{
    description: string;
    action: 'complete' | 'cycle' | 'reload';
    threadIndex: number;
    score: number;
  }>>([]);
  const [simResults, setSimResults] = useState<Array<{
    step: number;
    threadStates: Record<string, Array<{id: string; order: number; skip: number}>>;
  }>>([]);

  // Check authentication and redirect if not authorized
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Fetch thread data on mount
  useEffect(() => {
    const fetchThreadData = async () => {
      try {
        // Import the enhanced client with options support
        const { fetchUserStitches } = await import('../lib/supabase-client');
        
        // Force data retrieval with prefetch and restore mode
        const result = await fetchUserStitches({
          prefetch: 10, // Get more stitches 
          mode: 'restore' // Ensure consistent state
        });
        
        if (!result || result.threads.length === 0) {
          addToLog('Error: No thread data found. Make sure you have created threads and stitches.');
          setIsLoading(false);
          return;
        }
        
        const { threads, tubePosition } = result;
        
        addToLog(`Loaded ${threads.length} threads with ${threads.reduce((acc: number, t: ThreadData) => acc + t.stitches.length, 0)} total stitches`);
        
        if (tubePosition) {
          addToLog(`Found saved tube position: Tube-${tubePosition.tubeNumber}, Thread-${tubePosition.threadId}`);
        }
        
        // Create sequencer
        const newSequencer = new StitchSequencer(
          threads, 
          user?.id || 'anonymous', 
          {
            syncFrequency: 5000,
            forceSync: true
          },
          tubePosition ? {
            tubeNumber: tubePosition.tubeNumber,
            threadId: tubePosition.threadId
          } : undefined
        );
        
        setThreadData(threads);
        setSequencer(newSequencer);
        
        // Generate a simulation plan
        generateSimulationPlan(threads);
        
        // Capture initial state
        captureThreadStates(threads, 0, 'Initial state loaded');
        
        setIsLoading(false);
      } catch (error) {
        addToLog(`Error fetching thread data: ${error instanceof Error ? error.message : String(error)}`);
        setIsLoading(false);
      }
    };
    
    if (isAuthenticated) {
      fetchThreadData();
    }
  }, [isAuthenticated, user?.id]);
  
  // Helper to add to simulation log
  const addToLog = (message: string) => {
    setSimLog(prev => [...prev, `[${new Date().toISOString().slice(11, 19)}] ${message}`]);
  };
  
  // Generate a simulation plan based on thread data
  const generateSimulationPlan = (threads: ThreadData[]) => {
    const plan: Array<{
      description: string;
      action: 'complete' | 'cycle' | 'reload';
      threadIndex: number;
      score: number;
    }> = [];
    
    // Create a plan for 20 steps
    for (let i = 0; i < 20; i++) {
      const threadIndex = i % threads.length;
      const action = i % 5 === 4 ? 'reload' as const : (i % 2 === 0 ? 'complete' as const : 'cycle' as const);
      const score = i % 3 === 0 ? 20 : (i % 3 === 1 ? 18 : 10); // Perfect, almost perfect, poor
      
      plan.push({
        description: action === 'reload' ? 
          'Simulate page reload (test persistence)' : 
          (action === 'cycle' ? 
            `Cycle to next tube` : 
            `Complete stitch in thread ${threadIndex} with score ${score}/20`),
        action,
        threadIndex,
        score
      });
    }
    
    setSimulationPlan(plan);
    addToLog(`Generated ${plan.length} step simulation plan`);
  };
  
  // Capture the current state of all threads
  const captureThreadStates = (threads: ThreadData[], step: number, description: string) => {
    // Create a mapping of thread ID to stitch states
    const threadStates: Record<string, Array<{id: string; order: number; skip: number}>> = {};
    
    threads.forEach(thread => {
      // Sort stitches by order_number for clear display
      const sortedStitches = [...thread.stitches].sort((a, b) => a.order_number - b.order_number);
      
      threadStates[thread.thread_id] = sortedStitches.map(stitch => ({
        id: stitch.id.split('-').pop() || stitch.id,  // Just the short ID
        order: stitch.order_number,
        skip: stitch.skip_number
      }));
    });
    
    setSimResults(prev => [...prev, { step, threadStates }]);
    addToLog(`Captured thread states at step ${step}: ${description}`);
  };
  
  // Execute the next step in the simulation
  const executeNextStep = async () => {
    if (!sequencer || !threadData || currentStep >= simulationPlan.length) {
      addToLog('Simulation complete or no sequencer available');
      return;
    }
    
    const step = simulationPlan[currentStep];
    addToLog(`Executing step ${currentStep + 1}: ${step.description}`);
    
    try {
      // Different action based on plan
      if (step.action === 'reload') {
        // Simulate page reload by recreating sequencer
        addToLog('Simulating page reload to test persistence...');
        
        // Ensure all changes are synced
        if (sequencer) {
          await sequencer.forceSync();
        }
        
        // Reload thread data from API
        const { fetchUserStitches } = await import('../lib/supabase-client');
        const result = await fetchUserStitches({
          prefetch: 10,
          mode: 'restore'
        });
        
        if (!result) {
          addToLog('Error: Failed to reload thread data');
          return;
        }
        
        const { threads, tubePosition } = result;
        
        // Create new sequencer with fresh data
        const newSequencer = new StitchSequencer(
          threads, 
          user?.id || 'anonymous', 
          {
            syncFrequency: 5000,
            forceSync: true
          },
          tubePosition ? {
            tubeNumber: tubePosition.tubeNumber,
            threadId: tubePosition.threadId
          } : undefined
        );
        
        setThreadData(threads);
        setSequencer(newSequencer);
        
        addToLog('Reload complete - fresh data loaded from database');
        if (tubePosition) {
          addToLog(`Found saved tube position: Tube-${tubePosition.tubeNumber}, Thread-${tubePosition.threadId}`);
        }
        
        captureThreadStates(threads, currentStep + 1, 'After simulated reload');
      }
      else if (step.action === 'cycle') {
        // Just cycle to the next tube (thread)
        const threadId = threadData[step.threadIndex]?.thread_id;
        if (!threadId) {
          addToLog(`Error: No thread at index ${step.threadIndex}`);
          return;
        }
        
        addToLog(`Cycling to next tube from thread ${threadId}`);
        captureThreadStates(threadData, currentStep + 1, 'After cycling to next tube');
      }
      else if (step.action === 'complete') {
        // Complete the ready stitch in the specified thread
        const thread = threadData[step.threadIndex];
        if (!thread) {
          addToLog(`Error: No thread at index ${step.threadIndex}`);
          return;
        }
        
        const readyStitch = sequencer.getReadyStitch(thread.thread_id);
        if (!readyStitch) {
          addToLog(`Error: No ready stitch in thread ${thread.thread_id}`);
          return;
        }
        
        addToLog(`Completing stitch ${readyStitch.id} with score ${step.score}/20`);
        
        // Complete the stitch and get the new ready stitch
        sequencer.handleStitchCompletion(
          thread.thread_id,
          readyStitch.id,
          step.score,
          20 // total questions
        );
        
        // Force sync to ensure changes are persisted
        await sequencer.forceSync();
        
        // Wait for sync to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Update our thread data from the sequencer's internal state
        const updatedThreadData = Array.from(threadData).map(t => {
          if (t.thread_id === thread.thread_id) {
            // Get the latest stitches for this thread
            const updatedStitches: StitchWithProgress[] = [];
            for (const stitch of t.stitches) {
              // For each stitch, get its current order from the order map
              const orderEntry = t.orderMap.find(e => e.stitch_id === stitch.id);
              if (orderEntry) {
                updatedStitches.push({
                  ...stitch,
                  order_number: orderEntry.order_number
                });
              } else {
                updatedStitches.push(stitch);
              }
            }
            
            return {
              ...t,
              stitches: updatedStitches
            };
          }
          return t;
        });
        
        setThreadData(updatedThreadData);
        captureThreadStates(updatedThreadData, currentStep + 1, `After completing stitch with score ${step.score}/20`);
      }
    } catch (error) {
      addToLog(`Error executing step: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Move to next step
    setCurrentStep(prev => prev + 1);
  };
  
  // Clear simulation and start over
  const resetSimulation = async () => {
    if (sequencer) {
      // Force final sync before resetting
      await sequencer.forceSync();
    }
    
    setSimLog([]);
    setSimResults([]);
    setCurrentStep(0);
    
    // Reload data
    setIsLoading(true);
    
    try {
      const { fetchUserStitches } = await import('../lib/supabase-client');
      const result = await fetchUserStitches({
        prefetch: 10,
        mode: 'restore'
      });
      
      if (!result) {
        addToLog('Error: Failed to reload thread data');
        setIsLoading(false);
        return;
      }
      
      const { threads, tubePosition } = result;
      
      const newSequencer = new StitchSequencer(
        threads, 
        user?.id || 'anonymous', 
        {
          syncFrequency: 5000,
          forceSync: true
        },
        tubePosition ? {
          tubeNumber: tubePosition.tubeNumber,
          threadId: tubePosition.threadId
        } : undefined
      );
      
      setThreadData(threads);
      setSequencer(newSequencer);
      generateSimulationPlan(threads);
      captureThreadStates(threads, 0, 'Initial state after reset');
    } catch (error) {
      addToLog(`Error resetting simulation: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    setIsLoading(false);
  };
  
  // Run the full simulation automatically
  const runFullSimulation = async () => {
    if (currentStep >= simulationPlan.length) {
      resetSimulation();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const totalSteps = simulationPlan.length;
    addToLog(`Starting full simulation (${totalSteps} steps)...`);
    
    for (let i = currentStep; i < totalSteps; i++) {
      await executeNextStep();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between steps
    }
    
    addToLog('Full simulation completed.');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Tube Cycling Simulation | Zenjin Admin</title>
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold mb-2">Tube Cycling Simulation</h1>
          <p className="text-gray-600 mb-4">
            This tool simulates tube cycling, stitch completion, and reload scenarios to verify 
            persistence and proper stitch order progression.
          </p>
          
          {isAuthenticated ? (
            <div className="flex space-x-2">
              <button 
                onClick={() => router.push('/admin-dashboard')}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Back to Dashboard
              </button>
              
              <button 
                onClick={executeNextStep}
                disabled={isLoading || currentStep >= simulationPlan.length}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
              >
                Execute Next Step
              </button>
              
              <button 
                onClick={runFullSimulation}
                disabled={isLoading}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-green-300"
              >
                Run Full Simulation
              </button>
              
              <button 
                onClick={resetSimulation}
                disabled={isLoading}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-red-300"
              >
                Reset Simulation
              </button>
            </div>
          ) : (
            <button 
              onClick={() => router.push('/login')}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Login to Continue
            </button>
          )}
        </div>
        
        {isLoading ? (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="ml-4 text-gray-600">Loading simulation data...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Simulation Plan */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">Simulation Plan</span>
                <span className="text-sm bg-blue-100 text-blue-800 py-1 px-2 rounded">
                  Step {currentStep}/{simulationPlan.length}
                </span>
              </h2>
              
              <div className="h-96 overflow-y-auto">
                {simulationPlan.map((step, index) => (
                  <div 
                    key={index} 
                    className={`p-2 mb-2 rounded ${
                      index === currentStep ? 'bg-yellow-100 border-l-4 border-yellow-500' :
                      index < currentStep ? 'bg-green-50 border-l-4 border-green-500' :
                      'bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">Step {index + 1}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        step.action === 'complete' ? 'bg-blue-100 text-blue-800' :
                        step.action === 'cycle' ? 'bg-purple-100 text-purple-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {step.action}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Simulation Log */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Simulation Log</h2>
              
              <div className="h-96 overflow-y-auto font-mono text-xs bg-gray-900 text-gray-100 p-4 rounded">
                {simLog.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))}
                {simLog.length === 0 && (
                  <p className="text-gray-500 italic">No logs yet. Start the simulation to see logs.</p>
                )}
              </div>
            </div>
            
            {/* Results */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Results</h2>
              
              <div className="h-96 overflow-y-auto">
                {simResults.map((result, resultIndex) => (
                  <div key={resultIndex} className="mb-6 border-b pb-4">
                    <h3 className="font-bold text-lg mb-2">
                      Step {result.step}: {simulationPlan[result.step - 1]?.description || 'Initial State'}
                    </h3>
                    
                    {Object.entries(result.threadStates).map(([threadId, stitches]) => (
                      <div key={threadId} className="mb-4">
                        <h4 className="font-medium text-sm text-gray-700 mb-1">
                          Thread {threadId.replace('thread-', '')}
                        </h4>
                        
                        <div className="overflow-x-auto">
                          <table className="min-w-full bg-gray-50 border border-gray-200">
                            <thead>
                              <tr>
                                <th className="py-1 px-2 border-b text-xs">Stitch ID</th>
                                <th className="py-1 px-2 border-b text-xs">Order</th>
                                <th className="py-1 px-2 border-b text-xs">Skip</th>
                                <th className="py-1 px-2 border-b text-xs">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stitches.map((stitch, index) => (
                                <tr key={stitch.id} className={stitch.order === 0 ? 'bg-green-50' : ''}>
                                  <td className="py-1 px-2 border-b text-xs font-mono">{stitch.id}</td>
                                  <td className="py-1 px-2 border-b text-xs text-center">{stitch.order}</td>
                                  <td className="py-1 px-2 border-b text-xs text-center">{stitch.skip}</td>
                                  <td className="py-1 px-2 border-b text-xs">
                                    {stitch.order === 0 ? (
                                      <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">
                                        READY
                                      </span>
                                    ) : (
                                      <span className="text-gray-500">Waiting</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                
                {simResults.length === 0 && (
                  <p className="text-gray-500 italic">No results yet. Run the simulation to see results.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}