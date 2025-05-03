import React, { useEffect, useState } from 'react';

interface CelebrationEffectProps {
  isVisible: boolean;
  onComplete?: () => void;
}

const CELEBRATION_EMOJIS = [
  '🎉', '🎊', '✨', '🌟', '⭐', '🏆', '🥇', '👏', '💪', '🚀', '💯', '🔥', '🧠', '🤓'
];

const CELEBRATION_PHRASES = [
  'Great job!', 'Well done!', 'Amazing!', 'Excellent!', 'Brilliant!', 'Fantastic!', 
  'Superb!', 'Outstanding!', 'Perfect!', 'Incredible!', 'Smart thinking!'
];

const CelebrationEffect: React.FC<CelebrationEffectProps> = ({ 
  isVisible, 
  onComplete 
}) => {
  const [phrase, setPhrase] = useState('');

  // Select phrase and emoji when component becomes visible
  useEffect(() => {
    if (isVisible) {
      // Choose a random celebration phrase and emoji - do this on every show
      const randomPhrase = CELEBRATION_PHRASES[Math.floor(Math.random() * CELEBRATION_PHRASES.length)];
      const randomEmoji = CELEBRATION_EMOJIS[Math.floor(Math.random() * CELEBRATION_EMOJIS.length)];
      setPhrase(`${randomEmoji} ${randomPhrase} ${randomEmoji}`);
    }
  }, [isVisible]); // Run when visibility changes

  // Handle visibility changes separately
  useEffect(() => {
    if (isVisible) {
      // Call onComplete after animation finishes
      // Slightly shorter time to match the transition delay in playerUtils.ts
      const timer = setTimeout(() => {
        if (onComplete) onComplete();
      }, 1450);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="relative w-full h-full">
        {/* Text celebration */}
        <div 
          className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center"
          style={{
            opacity: 1,
            animation: 'celebration-fade 1.4s ease-out forwards',
            zIndex: 60
          }}
        >
          <div className="text-white font-bold text-4xl mb-2 text-shadow-lg">{phrase}</div>
        </div>
      </div>
      
      {/* Global styles for our animations */}
      <style jsx global>{`
        @keyframes celebration-fade {
          0% { opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        .text-shadow-lg {
          text-shadow: 0 0 10px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
};

export default CelebrationEffect;