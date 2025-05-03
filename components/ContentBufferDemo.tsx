import React, { useEffect, useState } from 'react';
import { useContentBuffer } from '../lib/client/useContentBuffer';
import { useUserState } from '../lib/state/useUserState';

/**
 * Demo component showing how to use the content buffer hook
 */
const ContentBufferDemo: React.FC = () => {
  const { inPlayStitch, isLoading, error, completeStitch, finishSession } = useContentBuffer();
  const { userState, initializeUserState } = useUserState();
  const [userId, setUserId] = useState<string>('');
  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('Back online. Click "Finish Session" to save your progress.');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('You are offline. Your progress is saved locally and will sync when you reconnect.');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Initialize user state if needed
  useEffect(() => {
    // Check if we have a user ID in localStorage or generate a new anonymous one
    const storedUserId = localStorage.getItem('user_id') || `anonymous-${Date.now()}`;
    setUserId(storedUserId);
    
    // Save for future sessions
    localStorage.setItem('user_id', storedUserId);
    
    // Initialize the state for this user
    initializeUserState(storedUserId);
  }, [initializeUserState]);
  
  // Handle answering a question
  const handleAnswer = (isCorrect: boolean) => {
    if (!inPlayStitch) return;
    
    // Move to next question if we have more
    if (currentQuestion < inPlayStitch.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // We've completed all questions
      // Determine if we got a perfect score
      // For demo purposes, just use the correct/incorrect of the last question
      completeStitch(isCorrect);
      setCurrentQuestion(0); // Reset for next stitch
      
      // Show a message that progress is saved locally
      setSyncStatus('Stitch completed! Progress saved locally.');
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };
  
  // Handle finishing the session (syncing progress to server)
  const handleFinishSession = async () => {
    if (!isOnline) {
      setSyncStatus('You are offline. Your progress is saved locally and will sync when you reconnect.');
      return;
    }
    
    setSyncStatus('Saving session to server...');
    
    try {
      const success = await finishSession();
      
      if (success) {
        setSyncStatus('Session saved successfully to the server!');
      } else {
        setSyncStatus('Failed to save session to the server. Your progress is still saved locally.');
      }
      
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (error) {
      console.error('Error finishing session:', error);
      setSyncStatus('Error saving session. Your progress is still saved locally.');
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };
  
  // Get the current question
  const currentQuestionData = inPlayStitch?.questions?.[currentQuestion];
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="p-6 max-w-lg mx-auto bg-white rounded-lg shadow-md">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-gray-500">Loading your learning content...</p>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="p-6 max-w-lg mx-auto bg-white rounded-lg shadow-md">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-lg font-semibold text-gray-900">Something went wrong</h3>
          <p className="mt-1 text-gray-500">{error}</p>
          <button 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
  
  // Render when no stitch is available
  if (!inPlayStitch) {
    return (
      <div className="p-6 max-w-lg mx-auto bg-white rounded-lg shadow-md">
        <p className="text-center">No learning content available. Please try again later.</p>
      </div>
    );
  }
  
  // Render the current stitch and question
  return (
    <div className="p-6 max-w-lg mx-auto bg-white rounded-lg shadow-md">
      {/* Connection status indicator */}
      <div className={`mb-4 p-2 rounded-md ${isOnline ? 'bg-green-50' : 'bg-red-50'}`}>
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <p className="text-sm font-medium">
            {isOnline ? 'Online' : 'Offline - Progress saved locally'}
          </p>
        </div>
        
        {syncStatus && (
          <p className="text-sm mt-1 text-gray-600">{syncStatus}</p>
        )}
      </div>
      
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-800">{inPlayStitch.title}</h2>
        <p className="text-sm text-gray-500">
          Question {currentQuestion + 1} of {inPlayStitch.questions.length}
        </p>
        
        {/* Display active tube */}
        <p className="text-sm text-gray-500 mt-1">
          Active Tube: {userState?.activeTube || userState?.activeTubeNumber}
        </p>
      </div>
      
      {/* Question content */}
      {currentQuestionData && (
        <div className="mb-6">
          <p className="text-lg font-medium text-gray-700">{currentQuestionData.text}</p>
          
          <div className="mt-4 space-y-2">
            {/* Correct answer as a button */}
            <button
              className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() => handleAnswer(true)}
            >
              {currentQuestionData.correctAnswer}
            </button>
            
            {/* Wrong answers as buttons */}
            {currentQuestionData.distractors && (
              <>
                {currentQuestionData.distractors.L1 && (
                  <button
                    className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => handleAnswer(false)}
                  >
                    {currentQuestionData.distractors.L1}
                  </button>
                )}
                {currentQuestionData.distractors.L2 && (
                  <button
                    className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => handleAnswer(false)}
                  >
                    {currentQuestionData.distractors.L2}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Finish session button */}
      <div className="mt-6">
        <button
          className="w-full py-3 px-4 rounded-md shadow-sm text-white font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={handleFinishSession}
          disabled={!isOnline}
        >
          {isOnline ? 'Finish Session' : 'Finish Session (Offline - Will sync when online)'}
        </button>
        
        <p className="mt-2 text-xs text-gray-500 text-center">
          Your progress is saved locally as you play. 
          Click "Finish Session" to save your progress to the server.
        </p>
      </div>
      
      {/* Debug info */}
      <div className="mt-8 pt-4 border-t border-gray-200">
        <details className="text-sm text-gray-600">
          <summary className="cursor-pointer font-medium">Debug Info</summary>
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
            {JSON.stringify({
              stitchId: inPlayStitch.id,
              threadId: inPlayStitch.threadId,
              questionCount: inPlayStitch.questions?.length || 0,
              currentTube: userState?.activeTube || userState?.activeTubeNumber,
              isOnline,
              hasLocalChanges: true // This would be tracked more accurately in a real implementation
            }, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};

export default ContentBufferDemo;