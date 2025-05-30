import React, { useState, useEffect, useCallback } from 'react';
import { getRandomWarmUpQuestions, createWarmUpTube } from '../lib/warmUpQuestions';
import { Question } from '../lib/types/distinction-learning';
import MinimalDistinctionPlayer from './MinimalDistinctionPlayer';
import BackgroundBubbles from './BackgroundBubbles';

interface WarmUpModeProps {
  questionsCount?: number;
  onWarmUpComplete: () => void;
  userId?: string;
  contentIsReady?: boolean; // Whether the main content is ready to be shown
}

/**
 * WarmUpMode component that shows warm-up questions to users
 * while the main content loads in the background.
 */
const WarmUpMode: React.FC<WarmUpModeProps> = ({
  questionsCount = 10,
  onWarmUpComplete,
  userId,
  contentIsReady = false // Default to false until content is confirmed ready
}) => {
  const [warmUpQuestions, setWarmUpQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load warm-up questions when component mounts - directly use the embedded questions
  useEffect(() => {
    console.log(`Loading ${questionsCount} warm-up questions directly...`);
    
    // Get warm-up questions directly from our embedded questions
    const questions = getRandomWarmUpQuestions(questionsCount);
    
    // Debug the questions that were loaded
    console.log(`Got ${questions.length} warm-up questions from our embedded collection`);
    if (questions.length > 0) {
      console.log('First question sample:', {
        id: questions[0].id,
        text: questions[0].text,
        correctAnswer: questions[0].correctAnswer
      });
    }
    
    // Set the questions and mark loading as complete
    setWarmUpQuestions(questions);
    setIsLoading(false);
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
      console.log(`WarmUpMode: Initializing with ${warmUpQuestions.length} questions - no Zustand lookups needed`);
      
      // Log the first question for debugging
      if (warmUpQuestions.length > 0) {
        console.log('WarmUpMode: First question in initialization:', {
          id: warmUpQuestions[0].id,
          text: warmUpQuestions[0].text,
          correctAnswer: warmUpQuestions[0].correctAnswer
        });
      }
      
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

  // Get random warm-up questions without any Zustand involvement
  const warmUpQs = getRandomWarmUpQuestions(questionsCount);
  console.log(`WarmUpMode: Selected ${warmUpQs.length} questions for direct use in player`);
  
  // Create a SUPER-SIMPLE tube data structure that doesn't involve Zustand at all
  const warmUpTubeData = {
    1: {
      currentStitchId: 'warm-up-stitch',
      positions: {
        0: {
          stitchId: 'warm-up-stitch',
          skipNumber: 3,
          distractorLevel: 'L1'
        }
      },
      stitches: [
        {
          id: 'warm-up-stitch',
          position: 0,
          skipNumber: 3,
          distractorLevel: 'L1',
          questions: warmUpQs
        }
      ]
    }
  };
  
  // Log the first question to verify format
  if (warmUpQs.length > 0) {
    console.log('WarmUpMode: First question for player:', {
      id: warmUpQs[0].id,
      text: warmUpQs[0].text,
      correctAnswer: warmUpQs[0].correctAnswer,
      distractors: warmUpQs[0].distractors
    });
  }

  // Render the MinimalDistinctionPlayer with warm-up questions
  return (
    <div className="relative min-h-screen flex items-center justify-center" style={{ background: 'transparent' }}>
      {/* Background animations */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <BackgroundBubbles />
      </div>
      
      {/* Warm-up banner */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-teal-700 to-teal-500 text-white py-2 px-4 text-center font-medium shadow-lg">
        Warming Up Your Math Skills
      </div>
      
      {/* Use the standard MinimalDistinctionPlayer with our warm-up data */}
      <div className="z-10 relative" style={{ background: 'transparent', width: '375px', height: '500px' }}>
        <MinimalDistinctionPlayer
          tubeNumber={1}
          tubeData={warmUpTubeData}
          onComplete={handleWarmUpComplete}
          onEndSession={handleEndSession}
          questionsPerSession={questionsCount}
          sessionTotalPoints={0}
          userId={userId}
          isWarmUpMode={true}
        />
        
        {/* Skip button positioned at the bottom - only show when content is ready */}
        {contentIsReady && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center items-center">
            <button
              onClick={onWarmUpComplete}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-1.5 px-4 rounded-lg transition-colors text-sm z-20 animate-fadeIn"
            >
              I'm Ready!
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WarmUpMode;