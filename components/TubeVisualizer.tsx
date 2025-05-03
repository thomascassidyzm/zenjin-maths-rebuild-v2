import React, { useState, useEffect } from 'react';
import { ThreadData } from '../lib/types/distinction-learning';

interface TubeVisualizerProps {
  threadData: ThreadData[];
  maxPositions?: number; // Maximum positions to display (default 50)
  highlightUpdates?: boolean; // Whether to highlight recent updates
}

/**
 * TubeVisualizer - Visualizes the current state of all tubes
 * Shows the contents of each tube with position numbers and stitch IDs
 * Helps debugging the spaced repetition and tube cycling system
 */
const TubeVisualizer: React.FC<TubeVisualizerProps> = ({
  threadData,
  maxPositions = 50,
  highlightUpdates = true
}) => {
  // Create a map of tube positions for easier visualization
  type TubeMap = Record<number, Record<number, {
    stitch: string;
    threadId: string;
    isReady: boolean;
    isHighlighted?: boolean;
  }[]>>;

  const [tubeMap, setTubeMap] = useState<TubeMap>({});
  const [previousMap, setPreviousMap] = useState<TubeMap>({});
  const [updateCount, setUpdateCount] = useState(0);

  // Assign a virtual tube number based on thread ID pattern if needed
  const getVirtualTubeNumber = (threadId: string) => {
    // Extract letter from thread ID (thread-A -> A, thread-B -> B, etc.)
    const letter = threadId.match(/thread-([A-Z])/)?.[1] || '';
    
    if (!letter) return 1; // Default to tube 1 if no pattern found
    
    // Map specific letters to tube numbers (one tube per letter)
    // A -> Tube-1
    // B -> Tube-2
    // C -> Tube-3
    // D -> Tube-3 (continuation of C)
    // E -> Tube-2 (continuation of B)
    // F -> Tube-1 (continuation of A)
    // This ensures threads appear in sequence within each tube
    
    switch (letter) {
      case 'A': return 1;
      case 'B': return 2;
      case 'C': return 3;
      case 'D': return 3; // Same tube as C
      case 'E': return 2; // Same tube as B
      case 'F': return 1; // Same tube as A
      default:
        // Fallback for other letters
        const charCode = letter.charCodeAt(0) - 65; // A=0, B=1, etc.
        return (charCode % 3) + 1;
    }
  };

  // Process thread data into a map for visualization
  useEffect(() => {
    // Save the previous state if we have one, for highlighting changes
    if (Object.keys(tubeMap).length > 0) {
      setPreviousMap(tubeMap);
    }

    // Create a new map for the current state
    const newMap: TubeMap = {};
    
    // Initialize the tubes (1, 2, 3)
    for (let tubeNumber = 1; tubeNumber <= 3; tubeNumber++) {
      newMap[tubeNumber] = {};
    }

    // First, organize threads by tube and alphabetical order
    interface OrganizedThread extends ThreadData {
      _virtualTubeNumber?: number;
    }
    
    const tubeThreads: Record<number, OrganizedThread[]> = {
      1: [],
      2: [],
      3: []
    };
    
    // Assign each thread to a tube
    threadData.forEach(thread => {
      const threadId = thread.thread_id;
      
      // Determine the tube number for this thread
      let tubeNumber: number;
      
      if (typeof thread.tube_number === 'number' && thread.tube_number >= 1 && thread.tube_number <= 3) {
        // Use the assigned tube number from the thread data if valid
        tubeNumber = thread.tube_number;
      } else {
        // Calculate a virtual tube number based on thread ID pattern
        tubeNumber = getVirtualTubeNumber(threadId);
      }
      
      // Add this thread to its tube group with virtual tube number
      tubeThreads[tubeNumber].push({
        ...thread,
        _virtualTubeNumber: tubeNumber
      });
    });
    
    // Sort threads alphabetically within each tube
    Object.keys(tubeThreads).forEach(tubeKey => {
      const tubeNumber = parseInt(tubeKey);
      tubeThreads[tubeNumber].sort((a, b) => {
        const letterA = a.thread_id.match(/thread-([A-Z])/)?.[1] || '';
        const letterB = b.thread_id.match(/thread-([A-Z])/)?.[1] || '';
        return letterA.localeCompare(letterB);
      });
      
      console.log(`Tube-${tubeNumber} thread order:`, tubeThreads[tubeNumber].map(t => t.thread_id).join(', '));
    });
    
    // Now create a position map for each tube
    // Process tubes in order (1, 2, 3)
    [1, 2, 3].forEach(tubeNumber => {
      const threads = tubeThreads[tubeNumber];
      
      // First, collect all stitches from all threads in this tube with their positions
      const allStitchesInTube: {
        threadId: string;
        threadLetter: string;
        stitchId: string;
        stitchNum: string;
        originalPosition: number;
        isReady: boolean;
      }[] = [];
      
      // Collect all stitches from all threads in this tube
      threads.forEach(thread => {
        const threadId = thread.thread_id;
        const threadLetter = threadId.match(/thread-([A-Z])/)?.[1] || '';
        
        thread.stitches.forEach(stitch => {
          // Extract a short stitch number
          let stitchShortId = stitch.id;
          if (stitchShortId.startsWith('stitch-')) {
            stitchShortId = stitchShortId.replace('stitch-', '');
          }
          
          // Try to extract stitch number
          const stitchNum = stitchShortId.match(/\d+/)?.[0] || stitchShortId;
          
          allStitchesInTube.push({
            threadId,
            threadLetter,
            stitchId: stitch.id,
            stitchNum,
            originalPosition: stitch.order_number,
            isReady: stitch.order_number === 0
          });
        });
      });
      
      // First group stitches by thread (this is critical)
      const stitchesByThread = new Map<string, typeof allStitchesInTube>();
      
      // Group all stitches by their thread letter
      allStitchesInTube.forEach(stitch => {
        if (!stitchesByThread.has(stitch.threadLetter)) {
          stitchesByThread.set(stitch.threadLetter, []);
        }
        stitchesByThread.get(stitch.threadLetter)?.push(stitch);
      });
      
      // Get thread letters in alphabetical order
      const threadLetters = Array.from(stitchesByThread.keys()).sort();
      
      // Sort stitches within each thread by position
      threadLetters.forEach(letter => {
        const threadStitches = stitchesByThread.get(letter);
        if (threadStitches) {
          threadStitches.sort((a, b) => a.originalPosition - b.originalPosition);
        }
      });
      
      // Now build a new array with all threads in sequence
      // Each thread's stitches come after the previous thread's stitches
      const sequencedStitches: typeof allStitchesInTube = [];
      
      // Process threads in alphabetical order
      threadLetters.forEach(letter => {
        const threadStitches = stitchesByThread.get(letter) || [];
        sequencedStitches.push(...threadStitches);
        console.log(`Tube-${tubeNumber}: Thread ${letter} has ${threadStitches.length} stitches`);
      });
      
      // Reorganize stitches to ensure only one stitch per position
      let nextAvailablePosition = 0;
      const seenPositions = new Set<number>();
      
      // First handle ready stitches (position 0)
      const readyStitches = sequencedStitches.filter(s => s.isReady);
      
      // Prioritize ready stitches (one per thread in alphabetical order)
      if (readyStitches.length > 0) {
        // Sort ready stitches by thread letter
        readyStitches.sort((a, b) => a.threadLetter.localeCompare(b.threadLetter));
        
        // Keep only one ready stitch (the first one alphabetically)
        const primaryReadyStitch = readyStitches[0];
        
        // Add the primary ready stitch to position 0
        if (!newMap[tubeNumber][0]) {
          newMap[tubeNumber][0] = [];
        }
        
        newMap[tubeNumber][0].push({
          stitch: `${primaryReadyStitch.threadLetter}-${primaryReadyStitch.stitchNum}`,
          threadId: primaryReadyStitch.threadId,
          isReady: true
        });
        
        seenPositions.add(0);
        nextAvailablePosition = 1;
        
        console.log(`Tube-${tubeNumber}: Assigned ready stitch ${primaryReadyStitch.stitchId} from thread ${primaryReadyStitch.threadId} to position 0`);
        
        // Handle any additional ready stitches by putting them in sequence
        if (readyStitches.length > 1) {
          for (let i = 1; i < readyStitches.length; i++) {
            const additionalReadyStitch = readyStitches[i];
            
            // Add to next available position
            if (!newMap[tubeNumber][nextAvailablePosition]) {
              newMap[tubeNumber][nextAvailablePosition] = [];
            }
            
            newMap[tubeNumber][nextAvailablePosition].push({
              stitch: `${additionalReadyStitch.threadLetter}-${additionalReadyStitch.stitchNum}`,
              threadId: additionalReadyStitch.threadId,
              isReady: false // No longer ready in our visualization
            });
            
            console.log(`Tube-${tubeNumber}: Moved additional ready stitch ${additionalReadyStitch.stitchId} from thread ${additionalReadyStitch.threadId} to position ${nextAvailablePosition}`);
            
            seenPositions.add(nextAvailablePosition);
            nextAvailablePosition++;
          }
        }
      }
      
      // Process all non-ready stitches in thread sequence order (grouped by thread)
      const nonReadyStitches = sequencedStitches.filter(s => !s.isReady);
      
      // Group non-ready stitches by thread letter for better ordering
      const stitchesByThreadLetter = new Map<string, typeof nonReadyStitches>();
      
      // Group by thread letter
      nonReadyStitches.forEach(stitch => {
        if (!stitchesByThreadLetter.has(stitch.threadLetter)) {
          stitchesByThreadLetter.set(stitch.threadLetter, []);
        }
        stitchesByThreadLetter.get(stitch.threadLetter)?.push(stitch);
      });
      
      // Get all thread letters in alphabetical order - this ensures C comes before D
      const threadLettersInOrder = Array.from(stitchesByThreadLetter.keys()).sort();
      
      console.log(`Tube-${tubeNumber} thread letters in order: ${threadLettersInOrder.join(', ')}`);
      
      // Process each thread's stitches in sequence, ensuring all stitches from one thread
      // come before any stitches from alphabetically later threads
      threadLettersInOrder.forEach(threadLetter => {
        const threadStitches = stitchesByThreadLetter.get(threadLetter) || [];
        
        console.log(`Processing ${threadStitches.length} stitches for thread ${threadLetter} in Tube-${tubeNumber}`);
        
        // Sort stitches within this thread by position
        threadStitches.sort((a, b) => a.originalPosition - b.originalPosition);
        
        // Process all stitches in this thread
        threadStitches.forEach(stitch => {
          // For non-ready stitches, try to use original position if not taken
          let assignedPosition = stitch.originalPosition;
          
          // If position is already taken, use next available position
          if (seenPositions.has(assignedPosition)) {
            assignedPosition = nextAvailablePosition;
            nextAvailablePosition++;
          }
          
          // Track this position as used
          seenPositions.add(assignedPosition);
          
          // Update next available position if needed
          if (assignedPosition >= nextAvailablePosition) {
            nextAvailablePosition = assignedPosition + 1;
          }
          
          // Add stitch to the map
          if (!newMap[tubeNumber][assignedPosition]) {
            newMap[tubeNumber][assignedPosition] = [];
          }
          
          newMap[tubeNumber][assignedPosition].push({
            stitch: `${stitch.threadLetter}-${stitch.stitchNum}`,
            threadId: stitch.threadId,
            isReady: false
          });
          
          if (stitch.originalPosition !== assignedPosition) {
            console.log(`Tube-${tubeNumber}: Reassigned stitch ${stitch.stitchId} from position ${stitch.originalPosition} to ${assignedPosition}`);
          }
        });
      });
    });
    
    // Flag changes if highlighting is enabled
    if (highlightUpdates && Object.keys(previousMap).length > 0) {
      for (const tubeNumber in newMap) {
        const tube = newMap[parseInt(tubeNumber)];
        for (const position in tube) {
          const pos = parseInt(position);
          const stitches = tube[pos];
          
          // Check if this position has changed
          const prevStitches = previousMap[parseInt(tubeNumber)]?.[pos] || [];
          const prevStitchIds = new Set(prevStitches.map(s => s.stitch));
          
          // Mark stitches that have moved to this position
          stitches.forEach(stitch => {
            if (!prevStitchIds.has(stitch.stitch)) {
              stitch.isHighlighted = true;
            }
          });
        }
      }
      
      // Increment update count to trigger animation
      setUpdateCount(prev => prev + 1);
    }
    
    setTubeMap(newMap);
  }, [threadData, highlightUpdates]);

  // Generate position rows from 0 to maxPositions
  const positions = Array.from({ length: maxPositions + 1 }, (_, i) => i);

  // Get all stitches at a specific position in a tube
  const getStitchesAtPosition = (tubeNumber: number, position: number) => {
    return tubeMap[tubeNumber]?.[position] || [];
  };

  return (
    <div className="tube-visualizer w-full overflow-x-auto">
      <div className="text-white font-medium mb-2">Tube Contents Visualization</div>
      
      <div className="flex flex-col">
        {/* Tube headers */}
        <div className="flex border-b border-gray-700 pb-2 mb-2">
          <div className="w-16 flex-shrink-0 px-2 font-bold text-gray-400">Position</div>
          <div className="flex-1 grid grid-cols-3 gap-2">
            <div className="px-2 font-bold text-teal-400">Tube-1</div>
            <div className="px-2 font-bold text-indigo-400">Tube-2</div>
            <div className="px-2 font-bold text-purple-400">Tube-3</div>
          </div>
        </div>
        
        {/* Scrollable content */}
        <div className="max-h-[500px] overflow-y-auto pr-2 tube-content-scroll">
          {positions.map(position => (
            <div 
              key={position} 
              className={`flex py-1 border-b border-gray-800 
                ${position === 0 ? 'bg-yellow-900/30 sticky top-0 z-10' : position % 5 === 0 ? 'bg-gray-900/30' : ''}`}
            >
              {/* Position number */}
              <div className={`w-16 flex-shrink-0 px-2 font-mono text-sm 
                ${position === 0 ? 'text-yellow-300 font-bold' : position % 5 === 0 ? 'text-gray-400 font-semibold' : 'text-gray-500'}`}>
                {position}
              </div>
              
              {/* Tube cells */}
              <div className="flex-1 grid grid-cols-3 gap-2">
                {[1, 2, 3].map(tubeNumber => {
                  const stitches = getStitchesAtPosition(tubeNumber, position);
                  const hasStitches = stitches.length > 0;
                  
                  // Determine tube color class
                  const tubeColorClass = tubeNumber === 1 
                    ? 'bg-teal-900/40 border-teal-800/80 text-teal-300' 
                    : tubeNumber === 2 
                      ? 'bg-indigo-900/40 border-indigo-800/80 text-indigo-300'
                      : 'bg-purple-900/40 border-purple-800/80 text-purple-300';
                  
                  return (
                    <div 
                      key={tubeNumber}
                      className={`px-2 py-1 rounded text-sm ${hasStitches 
                        ? `${tubeColorClass} border` 
                        : 'text-gray-600 border border-gray-800/50 bg-gray-900/20'}`}
                    >
                      {hasStitches ? (
                        <div className="flex flex-wrap gap-1">
                          {stitches.map((stitch, idx) => (
                            <span 
                              key={`${stitch.stitch}-${idx}`}
                              className={`inline-block px-1 rounded font-mono text-xs
                                ${stitch.isReady ? 'bg-yellow-500/80 text-black font-bold' : ''}
                                ${stitch.isHighlighted ? 'animate-pulse bg-white/20' : ''}`}
                            >
                              {stitch.stitch}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-4 text-sm flex items-center justify-end gap-4 text-gray-300">
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 mr-1 bg-yellow-500/80 rounded"></span>
          <span>Ready stitch (position 0)</span>
        </div>
        {highlightUpdates && (
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 mr-1 bg-white/20 rounded animate-pulse"></span>
            <span>Recently moved</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TubeVisualizer;