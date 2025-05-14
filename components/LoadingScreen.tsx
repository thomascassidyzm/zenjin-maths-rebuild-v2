import React, { useState, useEffect, useCallback } from 'react';

// Loading messages that cycle every 3 seconds
const loadingMessages = [
  "Firing up the math engines...",
  "Getting all the numbers in order...",
  "Lining up the perfect questions...",
  "Calculating the optimal sequence...",
  "Preparing your learning journey...",
  "Organizing the math puzzles...",
  "Setting up personalized content...",
  "Generating optimal learning path...",
  "Warming up problem-solving circuits...",
  "Connecting to the world of numbers..."
];

interface LoadingScreenProps {
  isAnonymous?: boolean;
  userName?: string;
  onAnimationComplete?: () => void;
  minDisplayTime?: number; // minimum time to show in ms
  showDebugInfo?: boolean; // whether to show debug information
}

/**
 * A loading screen that displays while content is being loaded
 * Includes welcome message, brief instructions, and animated loading indicator
 */
const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isAnonymous = true,
  userName,
  onAnimationComplete,
  minDisplayTime = 3000, // show for at least 3 seconds
  showDebugInfo = false
}) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [loadingStartTime] = useState(Date.now());
  const [timeElapsed, setTimeElapsed] = useState(0);
  
  // Cycle through loading messages
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % loadingMessages.length);
    }, 3000);
    
    return () => clearInterval(messageInterval);
  }, []);
  
  // Update elapsed time for debugging
  useEffect(() => {
    if (showDebugInfo) {
      const updateInterval = setInterval(() => {
        setTimeElapsed(Date.now() - loadingStartTime);
      }, 100);
      
      return () => clearInterval(updateInterval);
    }
  }, [loadingStartTime, showDebugInfo]);
  
  // Ensure minimum display time
  useEffect(() => {
    // Log when this effect runs
    console.log(`LoadingScreen: Setting up minimum display time of ${minDisplayTime}ms`);
    
    const timer = setTimeout(() => {
      console.log(`LoadingScreen: Minimum display time of ${minDisplayTime}ms reached`);
      setAnimationComplete(true);
      
      if (onAnimationComplete) {
        console.log('LoadingScreen: Calling onAnimationComplete callback');
        onAnimationComplete();
      }
    }, minDisplayTime);
    
    return () => {
      console.log('LoadingScreen: Cleaning up minimum display time timer');
      clearTimeout(timer);
    };
  }, [minDisplayTime, onAnimationComplete]);
  
  // Simple countdown effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);
  
  // Generate some "math symbols" for the animation
  const mathSymbols = ['+', '-', '×', '÷', '=', '%', '∑', '∫', 'π', '√'];
  
  return (
    <div className="loading-screen fixed inset-0 flex flex-col items-center justify-center h-full w-full bg-gradient-to-b from-slate-800 to-slate-900 p-6">
      {/* Card Layout */}
      <div className="bg-gradient-to-b from-teal-500 to-teal-700 rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden">
        {/* Top decoration bar */}
        <div className="h-2 bg-gradient-to-r from-blue-400 via-teal-300 to-emerald-400"></div>
        
        <div className="p-8 text-white">
          {/* Welcome Message */}
          <div className="welcome-message text-center mb-6">
            <h2 className="text-2xl font-bold mb-3">
              {isAnonymous ? 'Welcome to Zenjin Maths!' : `Welcome back, ${userName || 'learner'}!`}
            </h2>
            <p className="text-lg max-w-md mx-auto">
              For every question, select the best answer. Even if you're not sure, make your best guess. 
              You'll learn as you go along!
            </p>
          </div>
          
          {/* Loading Animation */}
          <div className="relative w-56 h-56 mx-auto mb-6">
            {/* Circular progress track */}
            <div className="absolute inset-0 rounded-full border-8 border-teal-300 opacity-30"></div>
            
            {/* Spinning progress indicator */}
            <div className="absolute inset-0 rounded-full border-t-8 border-white animate-spin"></div>
            
            {/* Container for math symbols */}
            <div className="math-symbols-container absolute inset-0 flex items-center justify-center">
              {/* Floating math symbols */}
              {mathSymbols.map((symbol, index) => (
                <div 
                  key={index}
                  className="absolute text-2xl font-bold math-float"
                  style={{
                    animationDelay: `${index * 0.3}s`,
                    top: `${20 + Math.sin(index) * 40}%`,
                    left: `${20 + Math.cos(index) * 40}%`,
                    opacity: 0.8
                  }}
                >
                  {symbol}
                </div>
              ))}
              
              {/* Central countdown (optional) */}
              {countdown > 0 && (
                <div className="text-5xl font-bold loading-pulse">
                  {countdown}
                </div>
              )}
            </div>
          </div>
          
          {/* Loading message */}
          <div className="loading-progress text-center text-lg font-medium loading-pulse">
            {loadingMessages[messageIndex]}
          </div>
        </div>
        
        {/* Bottom decoration bar */}
        <div className="h-2 bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400"></div>
      </div>
      
      {/* Debug info */}
      {showDebugInfo && (
        <div className="fixed bottom-4 left-4 bg-black bg-opacity-50 p-2 rounded text-xs font-mono">
          <div>Time elapsed: {Math.floor(timeElapsed / 100) / 10}s</div>
          <div>Min time: {minDisplayTime / 1000}s</div>
          <div>Animation complete: {animationComplete ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
};

export default LoadingScreen;