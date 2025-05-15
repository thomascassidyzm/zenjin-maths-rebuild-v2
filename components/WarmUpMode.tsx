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
  startingTube?: number; // Which tube to start with (1, 2, or 3)
}

/**
 * WarmUpMode component that shows warm-up questions to users
 * while the main content loads in the background.
 */
const WarmUpMode: React.FC<WarmUpModeProps> = ({
  questionsCount = 8, // Reduced count per tube for faster cycling
  onWarmUpComplete,
  userId,
  contentIsReady = false, // Whether the main content is loaded and ready to show
  startingTube = 1 // Start with tube 1 by default
}) => {
  const [warmUpQuestions, setWarmUpQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentTube, setCurrentTube] = useState(startingTube);

  // Load warm-up questions when component mounts - directly use the embedded questions
  useEffect(() => {
    console.log(`Loading 10 warm-up questions directly...`);
    
    // Get exactly 10 warm-up questions directly from our embedded questions
    const questions = getRandomWarmUpQuestions(10, true);
    
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
  }, []); // No dependencies to prevent reloading

  // When warm-up session is completed
  const handleWarmUpComplete = useCallback((results: any) => {
    console.log('Warm-up session completed:', results);
    
    // Move to main content
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
  
  // Create a MULTI-TUBE data structure that doesn't involve Zustand at all
  // This gives us three separate tubes for the player to cycle through
  const warmUpTubeData = createWarmUpTube(questionsCount, startingTube);
  
  // Log the first tube's questions to verify format
  if (warmUpTubeData[startingTube].stitches[0].questions.length > 0) {
    console.log(`WarmUpMode: First question for tube ${startingTube}:`, {
      id: warmUpTubeData[startingTube].stitches[0].questions[0].id,
      text: warmUpTubeData[startingTube].stitches[0].questions[0].text,
      correctAnswer: warmUpTubeData[startingTube].stitches[0].questions[0].correctAnswer,
      distractors: warmUpTubeData[startingTube].stitches[0].questions[0].distractors,
      stitchId: warmUpTubeData[startingTube].stitches[0].id
    });
    
    // Also check tube 2 and 3 to verify we have distinct questions
    if (warmUpTubeData[2] && warmUpTubeData[2].stitches[0].questions.length > 0) {
      console.log('WarmUpMode: First question from tube 2 (for comparison):', {
        text: warmUpTubeData[2].stitches[0].questions[0].text,
        stitchId: warmUpTubeData[2].stitches[0].id
      });
    }
    
    if (warmUpTubeData[3] && warmUpTubeData[3].stitches[0].questions.length > 0) {
      console.log('WarmUpMode: First question from tube 3 (for comparison):', {
        text: warmUpTubeData[3].stitches[0].questions[0].text,
        stitchId: warmUpTubeData[3].stitches[0].id
      });
    }
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
      
      {/* Show loading indicator when loading questions */}
      {isLoading ? (
        <div className="z-10 relative flex items-center justify-center" style={{ background: 'transparent', width: '375px', height: '500px' }}>
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden p-6 text-center">
            <div className="inline-block animate-spin h-10 w-10 border-4 border-teal-300 border-t-transparent rounded-full mb-4"></div>
            <h2 className="text-white text-xl font-medium">Loading warm-up questions...</h2>
          </div>
        </div>
      ) : (
        /* Use the standard MinimalDistinctionPlayer with our warm-up data */
        <div className="z-10 relative" style={{ background: 'transparent', width: '375px', height: '500px' }}>
          <MinimalDistinctionPlayer
            tubeNumber={currentTube}
            tubeData={warmUpTubeData}
            onComplete={handleWarmUpComplete}
            onEndSession={handleEndSession}
            questionsPerSession={10} /* Fixed to exactly 10 questions */
            sessionTotalPoints={0}
            userId={userId}
            isWarmUpMode={true}
          />
          
          {/* Skip button positioned at the bottom - only show when content is ready */}
          {contentIsReady && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center items-center">
              <button
                onClick={onWarmUpComplete}
                className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-1.5 px-4 rounded-lg transition-colors text-sm z-20 animate-fadeIn shadow-lg"
              >
                I'm ready to start!
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WarmUpMode;