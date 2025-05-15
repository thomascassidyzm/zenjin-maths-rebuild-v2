import React, { useState, useEffect } from 'react';

interface SimpleTransitionProps {
  onTransitionComplete: () => void;
  duration?: number; // Duration in milliseconds
  children?: React.ReactNode; // Child content to show after transition
}

/**
 * A completely redesigned transition component with no card flip 
 * Uses simple fade transitions for maximum reliability with cleaner styling
 */
const SimpleTransition: React.FC<SimpleTransitionProps> = ({
  onTransitionComplete,
  duration = 1500, // Default duration: 1.5 seconds - even shorter for better UX
  children // The actual player component to show after transition
}) => {
  // Track animation progress
  const [progress, setProgress] = useState(0);
  const [showMessage, setShowMessage] = useState(true);
  const [showContent, setShowContent] = useState(false);
  
  useEffect(() => {
    const startTime = Date.now();
    const midPoint = startTime + (duration / 2);
    const endTime = startTime + duration;
    let animationFrameId: number;
    
    // Function to update progress
    const updateProgress = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const newProgress = Math.min(100, (elapsed / duration) * 100);
      
      // Update progress state
      setProgress(newProgress);
      
      // Update visibility states based on progress
      if (now >= midPoint && showMessage) {
        setShowMessage(false);
        setTimeout(() => setShowContent(true), 100); // Very short delay for fade effect
      }
      
      // Continue animation if not complete
      if (now < endTime) {
        animationFrameId = requestAnimationFrame(updateProgress);
      } else {
        // Animation complete - allow a short delay to ensure smooth transition
        setTimeout(() => {
          onTransitionComplete();
        }, 100);
      }
    };
    
    // Start animation
    animationFrameId = requestAnimationFrame(updateProgress);
    
    // Cleanup function - properly cancel animation frame
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [duration, onTransitionComplete, showMessage]);
  
  return (
    <div 
      className="flex items-center justify-center" 
      style={{ 
        width: '375px', 
        height: '500px',
        position: 'relative',
        zIndex: 50
      }}
    >
      {/* Ultra-simplified transition that just fades between views */}
      <div className="w-full h-full relative rounded-2xl shadow-xl overflow-hidden bg-gradient-to-b from-teal-800 to-teal-900">
        {/* Loading message - shows first, then fades out */}
        {showMessage && (
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
            style={{
              opacity: Math.max(0, 1 - progress / 45), // Fade out in first half
              transition: 'opacity 0.25s ease-out',
              zIndex: 60
            }}
          >
            <h2 className="text-2xl font-bold text-white mb-3">
              Great warm-up!
            </h2>
            <p className="text-white/80 text-lg">
              Loading your personalized content...
            </p>
            <div className="mt-6 w-16 h-16">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
            </div>
          </div>
        )}
        
        {/* Main content - fades in after message fades out */}
        {showContent && (
          <div 
            className="absolute inset-0"
            style={{
              opacity: Math.min(1, (progress - 45) / 25), // Fade in during second half
              transition: 'opacity 0.25s ease-out',
              zIndex: 55
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleTransition;