import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { StitchWithProgress, ThreadData } from '../lib/types/distinction-learning';
import { StitchSequencer } from '../lib/StitchSequencer';

interface ThreadCyclerProps {
  threadData: ThreadData[];
  userId: string;
  onStitchSelected: (stitch: StitchWithProgress | null, threadId: string) => void;
}

// Define the ref interface
export interface ThreadCyclerRefHandle {
  nextThread: () => void;
  handleStitchCompletion: (threadId: string, stitchId: string, score: number, totalQuestions: number) => StitchWithProgress | null;
  getCurrentThread: () => string | null;
  getSortedThreads: () => ThreadData[];
  getCycleCount: () => number;
}

/**
 * ThreadCycler - Cycles through threads in order (A -> B -> C -> A)
 * and selects the active stitch from each thread
 */
const ThreadCycler = forwardRef<ThreadCyclerRefHandle, ThreadCyclerProps>(
  ({ threadData, userId, onStitchSelected }, ref) => {
    const [sequencer, setSequencer] = useState<StitchSequencer | null>(null);
    const [currentThreadIndex, setCurrentThreadIndex] = useState(0);
    const [cycleCount, setCycleCount] = useState(0);
    const [sortedThreads, setSortedThreads] = useState<ThreadData[]>([]);

    // Expose component methods via ref
    useImperativeHandle(ref, () => ({
      // Move to the next thread in the cycle
      nextThread: () => {
        nextThread();
        return true;
      },
      
      // Handle stitch completion and cycle to next thread
      handleStitchCompletion: (threadId, stitchId, score, totalQuestions) => {
        return handleStitchCompletion(threadId, stitchId, score, totalQuestions);
      },
      
      // Get current thread ID
      getCurrentThread: () => {
        return sortedThreads[currentThreadIndex]?.thread_id || null;
      },
      
      // Get alphabetically sorted threads
      getSortedThreads: () => {
        return sortedThreads;
      },
      
      // Get the number of complete cycles
      getCycleCount: () => {
        return cycleCount;
      }
    }));

    // Initialize sequencer and sort threads
    useEffect(() => {
      if (threadData && threadData.length > 0) {
        // Create new sequencer
        const newSequencer = new StitchSequencer(threadData, userId);
        setSequencer(newSequencer);
        
        // Sort threads to ensure consistent order (A, B, C)
        const sorted = [...threadData].sort((a, b) => {
          // Extract the letter part for sorting
          const aLetter = a.thread_id.match(/thread-([A-Z])/)?.[1] || '';
          const bLetter = b.thread_id.match(/thread-([A-Z])/)?.[1] || '';
          return aLetter.localeCompare(bLetter);
        });
        
        setSortedThreads(sorted);
        
        // Log thread ordering
        if (process.env.NODE_ENV === 'development') {
          console.log('Thread order:', sorted.map(t => t.thread_id).join(' -> '));
        }
      }
      
      // Cleanup
      return () => {
        if (sequencer) {
          sequencer.destroy();
        }
      };
    }, [threadData, userId]);

    // Handle thread cycling
    useEffect(() => {
      if (!sequencer || sortedThreads.length === 0) return;
      
      // Get the current thread
      const threadId = sortedThreads[currentThreadIndex]?.thread_id;
      if (!threadId) return;
      
      // Get active stitch for this thread
      const activeStitch = sequencer.getActiveStitch(threadId);
      
      // Log thread cycling for development
      if (process.env.NODE_ENV === 'development') {
        console.log(`Current thread: ${threadId}, Active stitch: ${activeStitch?.id || 'none'}`);
      }
      
      // If no active stitch in this thread, automatically move to next thread
      if (!activeStitch) {
        console.log(`No active stitch in thread ${threadId}, moving to next thread`);
        
        // Before moving to next thread, check if ANY thread has an active stitch
        const anyThreadHasActiveStitch = sortedThreads.some(thread => {
          return sequencer.getActiveStitch(thread.thread_id) !== null;
        });
        
        if (!anyThreadHasActiveStitch) {
          console.log('Warning: No active stitch found in any thread, forcing first thread active');
          
          // Force the first stitch of the first thread to be active
          if (sortedThreads[0] && sortedThreads[0].stitches.length > 0) {
            const firstThread = sortedThreads[0];
            const firstStitch = firstThread.stitches[0];
            
            // Force this stitch to be active by setting its order_number to 0
            firstStitch.order_number = 0;
            
            // Also update the order map
            const orderMapEntry = firstThread.orderMap.find(entry => entry.stitch_id === firstStitch.id);
            if (orderMapEntry) {
              orderMapEntry.order_number = 0;
            }
            
            // Sync this emergency update
            setTimeout(() => {
              if (sequencer) {
                sequencer.syncUpdates();
              }
            }, 500);
            
            // Notify parent of the forced active stitch
            onStitchSelected(firstStitch, firstThread.thread_id);
            return;
          }
        }
        
        // Use setTimeout to avoid React state update conflicts
        setTimeout(() => nextThread(), 100);
        return;
      }
      
      // Notify parent component
      onStitchSelected(activeStitch, threadId);
      
    }, [sequencer, sortedThreads, currentThreadIndex, onStitchSelected]);

    // Function to move to the next thread
    const nextThread = () => {
      // Get next index with wraparound
      const nextIndex = (currentThreadIndex + 1) % sortedThreads.length;
      
      // Log before changing threads
      console.log(`Moving from thread ${sortedThreads[currentThreadIndex]?.thread_id} (index ${currentThreadIndex}) to ${sortedThreads[nextIndex]?.thread_id} (index ${nextIndex})`);
      
      // Update current index
      setCurrentThreadIndex(nextIndex);
      
      // If we've wrapped around, increment cycle count
      if (nextIndex === 0) {
        setCycleCount(prev => prev + 1);
        console.log('Completed a full thread cycle!');
      }
      
      // Check if the new thread has an active stitch
      const newThreadId = sortedThreads[nextIndex]?.thread_id;
      if (newThreadId && sequencer) {
        const activeStitch = sequencer.getActiveStitch(newThreadId);
        console.log(`New thread ${newThreadId} has active stitch: ${activeStitch ? 'Yes - ' + activeStitch.id : 'No'}`);
      }
      
      return nextIndex;
    };

    // Function to handle stitch completion
    const handleStitchCompletion = (threadId: string, stitchId: string, score: number, totalQuestions: number) => {
      if (!sequencer) return null;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Completing stitch ${stitchId} with score ${score}/${totalQuestions}`);
      }
      
      // Complete the stitch
      const nextActiveStitch = sequencer.handleStitchCompletion(
        threadId,
        stitchId,
        score,
        totalQuestions
      );
      
      // Sync updates to server
      sequencer.syncUpdates();
      
      // Move to next thread
      nextThread();
      
      return nextActiveStitch;
    };

    return (
      <div className="thread-cycler">
        {/* This component doesn't render anything directly */}
        {/* It just manages the thread cycling and provides the current stitch */}
        
        {/* Debug UI - visible in development mode */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-black/30 p-3 rounded-lg text-white/90 text-sm mb-4">
            <h3 className="font-bold mb-2">Thread Cycler Status</h3>
            <p>
              Current Thread: {sortedThreads[currentThreadIndex]?.thread_id || 'none'} 
              <span className="ml-2 text-xs text-teal-300">
                ({currentThreadIndex + 1} of {sortedThreads.length})
              </span>
            </p>
            <p>Cycle Count: {cycleCount}</p>
            <p>Thread Order: {sortedThreads.map(t => t.thread_id.replace('thread-', '')).join(' → ')}</p>
            
            <button 
              onClick={nextThread}
              className="bg-teal-600 hover:bg-teal-500 px-3 py-1 mt-2 rounded text-xs text-white"
            >
              Next Thread
            </button>
          </div>
        )}
      </div>
    );
  }
);

// Display name for debugging
ThreadCycler.displayName = 'ThreadCycler';

export default ThreadCycler;