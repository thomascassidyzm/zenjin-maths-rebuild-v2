import React, { useState, useEffect } from 'react';

// Loading messages that cycle every 3 seconds
const loadingMessages = [
  "Firing up the math engines...",
  "Getting all the numbers in order...",
  "Lining up the perfect questions...",
  "Calculating the optimal sequence...",
  "Preparing your learning journey...",
  "Organizing the math puzzles..."
];

interface LoadingScreenProps {
  isAnonymous?: boolean;
  userName?: string;
  onAnimationComplete?: () => void;
  minDisplayTime?: number; // minimum time to show in ms
}

/**
 * A loading screen that displays while content is being loaded
 * Includes welcome message, brief instructions, and animated loading indicator
 */
const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isAnonymous = true,
  userName,
  onAnimationComplete,
  minDisplayTime = 2500 // show for at least 2.5 seconds
}) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [animationComplete, setAnimationComplete] = useState(false);
  
  // Cycle through loading messages
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % loadingMessages.length);
    }, 3000);
    
    return () => clearInterval(messageInterval);
  }, []);
  
  // Ensure minimum display time
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationComplete(true);
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    }, minDisplayTime);
    
    return () => clearTimeout(timer);
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
    <div className="loading-screen fixed inset-0 flex flex-col items-center justify-center h-full w-full bg-gradient-to-b from-teal-500 to-teal-700 text-white p-6 shadow-xl">
      {/* Welcome Message */}
      <div className="welcome-message text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">
          {isAnonymous ? 'Welcome to Zenjin Maths!' : `Welcome back, ${userName || 'learner'}!`}
        </h2>
        <p className="text-lg max-w-md mx-auto">
          For every question, select the best answer. Even if you're not sure, make your best guess. 
          You'll learn as you go along!
        </p>
      </div>
      
      {/* Loading Animation */}
      <div className="relative w-64 h-64 mb-6">
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
  );
};

export default LoadingScreen;