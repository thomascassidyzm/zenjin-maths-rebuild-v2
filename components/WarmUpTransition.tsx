import React, { useState, useEffect } from 'react';

interface WarmUpTransitionProps {
  onTransitionComplete: () => void;
  duration?: number; // Duration in milliseconds
}

/**
 * A component that shows a transition animation when moving from warm-up to main content
 */
const WarmUpTransition: React.FC<WarmUpTransitionProps> = ({
  onTransitionComplete,
  duration = 3000 // Default duration: 3 seconds
}) => {
  // Track animation progress
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    // Function to update progress
    const updateProgress = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const newProgress = Math.min(100, (elapsed / duration) * 100);
      
      setProgress(newProgress);
      
      // Continue animation if not complete
      if (now < endTime) {
        requestAnimationFrame(updateProgress);
      } else {
        // Animation complete
        setTimeout(() => {
          onTransitionComplete();
        }, 500); // Short delay after animation completes
      }
    };
    
    // Start animation
    requestAnimationFrame(updateProgress);
    
    // Cleanup function
    return () => {
      // Nothing to clean up with requestAnimationFrame
    };
  }, [duration, onTransitionComplete]);
  
  // Messages to display during transition
  const transitionMessages = [
    "Great warm-up!",
    "Preparing your personalized content...",
    "Let's continue your learning journey!",
    "Ready to learn!"
  ];
  
  // Calculate which message to show based on progress
  const messageIndex = Math.min(
    Math.floor(progress / (100 / transitionMessages.length)),
    transitionMessages.length - 1
  );
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-gradient-to-b from-indigo-900 to-blue-900">
      {/* Background animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="stars-container">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="star"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${0.5 + Math.random() * 1}s`
              }}
            />
          ))}
        </div>
      </div>
      
      {/* Main content */}
      <div className="relative z-10 text-center p-8 max-w-md">
        <h2 className="text-4xl font-bold mb-6 text-white">
          {transitionMessages[messageIndex]}
        </h2>
        
        {/* Progress bar */}
        <div className="w-full h-2 bg-white/20 rounded-full mt-6 mb-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-400 to-blue-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        {/* Brain loading animation */}
        <div className="mt-8">
          <div className="brain-loading">
            <svg width="80" height="80" viewBox="0 0 100 100" className="mx-auto">
              <path
                d="M50,15 C30,15 15,30 15,50 C15,70 30,85 50,85 C70,85 85,70 85,50 C85,30 70,15 50,15 Z"
                fill="none"
                stroke="white"
                strokeWidth="5"
                strokeDasharray="252"
                strokeDashoffset={252 - (252 * progress) / 100}
                strokeLinecap="round"
              />
              {/* Brain details */}
              <path
                d="M40,35 C45,30 55,30 60,35 M35,50 C40,45 45,47 50,45 C55,43 60,45 65,50 M40,65 C45,70 55,70 60,65"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeDasharray="120"
                strokeDashoffset={120 - (120 * Math.max(0, progress - 30)) / 70}
                strokeLinecap="round"
                style={{ opacity: progress > 30 ? 1 : 0 }}
              />
            </svg>
          </div>
        </div>
      </div>
      
      {/* CSS animations */}
      <style jsx>{`
        .stars-container {
          position: absolute;
          width: 100%;
          height: 100%;
        }
        
        .star {
          position: absolute;
          width: 3px;
          height: 3px;
          background-color: white;
          border-radius: 50%;
          opacity: 0;
          animation: twinkle linear infinite;
        }
        
        @keyframes twinkle {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); opacity: 0.8; }
          100% { transform: scale(0); opacity: 0; }
        }
        
        .brain-loading {
          transform-origin: center;
          animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default WarmUpTransition;