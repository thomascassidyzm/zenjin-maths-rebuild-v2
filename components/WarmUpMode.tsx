import React, { useState, useEffect, useCallback } from 'react';
import { getRandomWarmUpQuestions } from '../lib/warmUpQuestions';
import { Question } from '../lib/types/distinction-learning';
import MinimalDistinctionPlayer from './MinimalDistinctionPlayer';
import BackgroundBubbles from './BackgroundBubbles';

interface WarmUpModeProps {
  questionsCount?: number;
  onWarmUpComplete: () => void;
  userId?: string;
}

/**
 * WarmUpMode component that shows warm-up questions to users
 * while the main content loads in the background.
 */
const WarmUpMode: React.FC<WarmUpModeProps> = ({
  questionsCount = 10,
  onWarmUpComplete,
  userId
}) => {
  const [warmUpQuestions, setWarmUpQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load warm-up questions when component mounts
  useEffect(() => {
    try {
      const questions = getRandomWarmUpQuestions(questionsCount);
      setWarmUpQuestions(questions);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading warm-up questions:', error);
      setIsLoading(false);
    }
  }, [questionsCount]);

  // When warm-up session is completed
  const handleWarmUpComplete = useCallback((results: any) => {
    console.log('Warm-up session completed with results:', results);
    onWarmUpComplete();
  }, [onWarmUpComplete]);

  // Handle manual end session
  const handleEndSession = useCallback((results: any) => {
    console.log('Warm-up session ended manually with results:', results);
    onWarmUpComplete();
  }, [onWarmUpComplete]);
  
  // Initialize tube data for MinimalDistinctionPlayer
  useEffect(() => {
    if (!isLoading && warmUpQuestions.length > 0 && !isInitialized) {
      setIsInitialized(true);
    }
  }, [isLoading, warmUpQuestions, isInitialized]);

  // If still loading warm-up questions, show loading spinner
  if (isLoading) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden p-8 text-center">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-teal-300 border-t-transparent rounded-full mb-4"></div>
          <h2 className="text-white text-xl font-medium">Preparing your warm-up...</h2>
        </div>
      </div>
    );
  }

  // If we couldn't load warm-up questions, show error
  if (!isLoading && warmUpQuestions.length === 0) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden p-8 text-center">
          <h2 className="text-white text-xl font-medium mb-4">Unable to load warm-up questions</h2>
          <button
            onClick={onWarmUpComplete}
            className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    );
  }

  // Prepare tube data for MinimalDistinctionPlayer
  const warmUpTubeData = {
    1: { // Tube number 1 
      currentStitchId: 'warm-up-stitch',
      positions: {
        0: { // Position 0
          stitchId: 'warm-up-stitch',
          skipNumber: 3,
          distractorLevel: 'L1'
        }
      },
      // Add warm-up questions directly to the stitch
      stitches: [
        {
          id: 'warm-up-stitch',
          position: 0,
          skipNumber: 3,
          distractorLevel: 'L1',
          questions: warmUpQuestions
        }
      ]
    }
  };

  // Render the MinimalDistinctionPlayer with warm-up questions
  return (
    <div className="relative min-h-screen flex items-center justify-center" style={{ background: 'transparent' }}>
      {/* Background animations */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <BackgroundBubbles />
      </div>
      
      {/* Warm-up banner */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-indigo-600 to-teal-500 text-white py-2 px-4 text-center font-medium shadow-lg">
        Warming Up Your Math Skills
      </div>
      
      {/* Use the standard MinimalDistinctionPlayer with our warm-up data */}
      <div className="z-10" style={{ background: 'transparent', width: '375px', height: '500px' }}>
        <MinimalDistinctionPlayer
          tubeNumber={1}
          tubeData={warmUpTubeData}
          onComplete={handleWarmUpComplete}
          onEndSession={handleEndSession}
          questionsPerSession={questionsCount}
          sessionTotalPoints={0}
          userId={userId}
        />
      </div>
    </div>
  );
};

export default WarmUpMode;