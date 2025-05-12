/**
 * ZustandContentProvider
 * 
 * A wrapper component that fetches stitch content using Zustand
 * and provides it to MinimalDistinctionPlayer in the expected format.
 * 
 * This component bridges the gap between our new Zustand-based content
 * system and the existing MinimalDistinctionPlayer component.
 */

import React, { useEffect, useState } from 'react';
import { useZenjinStore } from '../lib/store/zenjinStore';
import { useStitchContent } from '../lib/hooks/useStitchContent';
import MinimalDistinctionPlayer from './MinimalDistinctionPlayer';

interface ZustandContentProviderProps {
  stitchId: string;
  tubeNumber: 1 | 2 | 3;
  onComplete: (results: any) => void;
  onEndSession?: (results: any) => void;
  questionsPerSession?: number;
  sessionTotalPoints?: number;
}

export default function ZustandContentProvider({
  stitchId,
  tubeNumber,
  onComplete,
  onEndSession,
  questionsPerSession = 10,
  sessionTotalPoints = 0
}: ZustandContentProviderProps) {
  // Use the Zustand hook to fetch the stitch content
  const { stitch, loading, error } = useStitchContent(stitchId);
  
  // Get user information from Zustand store
  const userInfo = useZenjinStore(state => state.userInformation);
  const recordStitchInteraction = useZenjinStore(state => state.recordStitchInteraction);
  const incrementPoints = useZenjinStore(state => state.incrementPoints);
  
  // State to hold the thread object for MinimalDistinctionPlayer
  const [thread, setThread] = useState<any>(null);
  
  // Convert stitch content to thread format expected by MinimalDistinctionPlayer
  useEffect(() => {
    if (stitch && !loading && !error) {
      console.log(`Creating thread for stitch ${stitch.id} with ${stitch.questions?.length || 0} questions`);
      
      // Create a thread object with the stitch
      const threadData = {
        id: stitch.threadId || `thread-T${tubeNumber}-001`,
        name: `Tube ${tubeNumber}`,
        description: `Learning content for Tube ${tubeNumber}`,
        stitches: [{
          id: stitch.id,
          name: stitch.title || stitch.id.split('-').pop() || 'Stitch',
          description: stitch.content || `Stitch ${stitch.id}`,
          // Format questions to match expected structure
          questions: (stitch.questions || []).map((q: any) => ({
            id: q.id,
            text: q.text || q.questionText,
            correctAnswer: q.correctAnswer || q.correct_answer,
            distractors: q.distractors || {
              L1: q.distractors?.L1 || '',
              L2: q.distractors?.L2 || '',
              L3: q.distractors?.L3 || ''
            }
          }))
        }]
      };
      
      setThread(threadData);
    }
  }, [stitch, loading, error, tubeNumber]);
  
  // Handle completion and update Zustand store
  const handleComplete = (results: any) => {
    console.log('ZustandContentProvider: Session completed', results);
    
    // Update Zustand store with the results
    if (results.totalPoints > 0) {
      incrementPoints(results.totalPoints);
    }
    
    // Record stitch interaction in Zustand store
    if (stitchId) {
      recordStitchInteraction(
        stitchId, 
        results.correctAnswers > 0,
        results.firstTimeCorrect > 0
      );
    }
    
    // Pass results to parent component
    onComplete(results);
  };
  
  // Handle session end
  const handleEndSession = (results: any) => {
    console.log('ZustandContentProvider: Session ended manually', results);
    
    // Update Zustand store with the results
    if (results.totalPoints > 0) {
      incrementPoints(results.totalPoints);
    }
    
    // Pass results to parent component if callback exists
    if (onEndSession) {
      onEndSession(results);
    }
  };
  
  // Show loading state
  if (loading) {
    return (
      <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden p-6 text-center">
        <div className="animate-spin inline-block h-8 w-8 border-4 border-teal-300 border-t-transparent rounded-full mb-4"></div>
        <p className="text-white text-opacity-80">Loading content...</p>
      </div>
    );
  }
  
  // Show error state
  if (error || !stitch) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
        <h3 className="text-red-200 text-lg font-medium mb-2">Failed to load content</h3>
        <p className="text-white/70 text-sm mb-4">
          {error ? error.message : `Content for stitch ID "${stitchId}" not found`}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }
  
  // If we have a thread, render the MinimalDistinctionPlayer
  if (thread) {
    return (
      <MinimalDistinctionPlayer
        thread={thread}
        onComplete={handleComplete}
        onEndSession={handleEndSession}
        questionsPerSession={questionsPerSession}
        sessionTotalPoints={sessionTotalPoints}
        userId={userInfo?.userId}
      />
    );
  }
  
  // Fallback if none of the above conditions are met
  return (
    <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden p-6 text-center">
      <p className="text-white text-opacity-80">Preparing content...</p>
    </div>
  );
}