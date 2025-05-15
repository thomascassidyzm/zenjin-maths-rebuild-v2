import React, { useState, useEffect } from 'react';

interface SimpleTransitionProps {
  onTransitionComplete: () => void;
  duration?: number; // Duration in milliseconds
  children?: React.ReactNode; // Child content to show after transition
}

/**
 * Simple transition component that fades between content
 * No card flip animation - just a clean fade transition
 */
const SimpleTransition: React.FC<SimpleTransitionProps> = ({
  onTransitionComplete,
  duration = 1500, // 1.5 seconds default
  children 
}) => {
  const [stage, setStage] = useState<'message'|'transition'|'content'>('message');
  
  useEffect(() => {
    // First phase - show message
    const messageTimer = setTimeout(() => {
      // Second phase - transition
      setStage('transition');
      
      // Final phase - show content and complete
      const contentTimer = setTimeout(() => {
        setStage('content');
        
        // Allow a moment for the animation to complete
        setTimeout(onTransitionComplete, 200);
      }, duration / 2);
      
      return () => clearTimeout(contentTimer);
    }, duration / 2);
    
    return () => clearTimeout(messageTimer);
  }, [duration, onTransitionComplete]);
  
  return (
    <div className="flex items-center justify-center" style={{ width: '375px', height: '500px' }}>
      <div className="w-full h-full relative rounded-2xl shadow-xl overflow-hidden bg-gradient-to-b from-teal-800 to-teal-900">
        {/* Message view */}
        {(stage === 'message' || stage === 'transition') && (
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
            style={{
              opacity: stage === 'message' ? 1 : 0,
              transition: 'opacity 0.5s ease'
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
        
        {/* Content view */}
        {(stage === 'transition' || stage === 'content') && (
          <div 
            className="absolute inset-0"
            style={{
              opacity: stage === 'content' ? 1 : 0,
              transition: 'opacity 0.5s ease'
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