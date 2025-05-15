import React, { useState, useEffect } from 'react';

interface WarmUpTransitionProps {
  onTransitionComplete: () => void;
  duration?: number; // Duration in milliseconds
  children?: React.ReactNode; // Child content to show on back of card (actual player)
}

/**
 * A component that shows a transition animation when moving from warm-up to main content
 */
const WarmUpTransition: React.FC<WarmUpTransitionProps> = ({
  onTransitionComplete,
  duration = 2500, // Default duration: 2.5 seconds (shorter for better UX)
  children // The actual player component to show on the back of card
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
    <div className="flex items-center justify-center" style={{ width: '375px', height: '500px' }}>
      {/* Card with 3D flip effect */}
      <div 
        className="card-container"
        style={{
          width: '100%',
          height: '100%',
          perspective: '1500px'
        }}
      >
        <div 
          className="card-flipper" 
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transform: `rotateY(${progress * 1.8}deg)`, // 0 to 180 degrees
            transition: 'transform 0.3s ease-out',
          }}
        >
          {/* Front of card (visible at start) */}
          <div 
            className="card-front bg-gradient-to-b from-teal-800 to-teal-900 rounded-2xl shadow-xl p-6"
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
              backfaceVisibility: 'hidden',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              // Hide contents when card is edge-on (between 70 and 110 degrees)
              opacity: progress > 70 ? 0 : 1,
              transition: 'opacity 0.2s ease-out',
            }}
          >
            <h2 className="text-2xl font-bold mb-6 text-white text-center">
              {transitionMessages[0]}
            </h2>
            
            {/* Progress bar */}
            <div className="w-full h-2 bg-white/20 rounded-full mt-4 mb-6 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-400 to-teal-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            {/* Simple card flipping animation */}
            <div className="my-6 relative w-20 h-24">
              <div 
                className="absolute inset-0 bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg shadow-lg flex items-center justify-center"
                style={{ 
                  transform: `rotateY(${progress * 3.6}deg)`, 
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden'
                }}
              >
                <span className="text-white text-3xl font-bold">+</span>
              </div>
            </div>
            
            <p className="text-white/80 text-center">
              {transitionMessages[1]}
            </p>
          </div>
          
          {/* Back of card (visible at end) */}
          <div 
            className="card-back bg-gradient-to-b from-teal-800 to-teal-900 rounded-2xl shadow-xl p-6"
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              // Only show after we're past 90 degrees and fade in
              opacity: progress > 90 ? (progress - 90) / 60 : 0,
              transition: 'opacity 0.2s ease-out',
            }}
          >
            {children ? (
              // Show the actual player component passed as children
              <div 
                style={{ 
                  width: '100%', 
                  height: '100%',
                  opacity: progress > 100 ? 1 : 0,
                  transition: 'opacity 0.3s ease-out',
                }}
              >
                {children}
              </div>
            ) : (
              // Fallback content if no children provided
              <>
                <div className="brain-icon mb-4">
                  <svg width="60" height="60" viewBox="0 0 100 100" className="mx-auto">
                    <path
                      d="M50,15 C30,15 15,30 15,50 C15,70 30,85 50,85 C70,85 85,70 85,50 C85,30 70,15 50,15 Z"
                      fill="none"
                      stroke="#14b8a6" /* teal-500 */
                      strokeWidth="5"
                      strokeDasharray="252"
                      strokeDashoffset={252 - (252 * (progress > 110 ? progress - 110 : 0)) / 70}
                      strokeLinecap="round"
                    />
                    <path
                      d="M40,35 C45,30 55,30 60,35 M35,50 C40,45 45,47 50,45 C55,43 60,45 65,50 M40,65 C45,70 55,70 60,65"
                      fill="none"
                      stroke="#14b8a6" /* teal-500 */
                      strokeWidth="3"
                      strokeLinecap="round"
                      style={{ opacity: progress > 135 ? (progress - 135) / 45 : 0 }}
                    />
                  </svg>
                </div>
                
                <h2 className="text-2xl font-bold mb-4 text-white text-center">
                  {transitionMessages[2]}
                </h2>
                
                <p className="text-white/80 text-lg font-medium text-center">
                  {transitionMessages[3]}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    
      {/* CSS for animations */}
      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        
        .brain-icon {
          animation: pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default WarmUpTransition;