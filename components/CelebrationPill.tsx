import React, { useEffect, useState } from 'react';

interface CelebrationPillProps {
  isVisible: boolean;
  onComplete?: () => void;
}

const CELEBRATION_EMOJIS = [
  // Subtle
  '✓', '✔️', '⭐', '★', '•', '○', '◦', '◇', ' ',
  
  // Minimal
  '👍', '👌', '✨', '💭', '✓', '↑', '→', '↗️',
  
  // Sometimes no emoji is cooler - empty space
  ' ', ' ', ' ', ' ', ' '
];

const CELEBRATION_PHRASES = [
  // Simple and genuine English
  'Nice!', 'Got it!', 'Spot on', 'Clean', 'Sorted', 'Correct',
  
  // Casual cool without trying
  'Checks out', 'Well played', 'Smooth', 'Sharp', 'On it', 'Clever',
  
  // Short and understated
  'Boom', 'Ace', 'Done', 'Yep', 'Now we\'re talking', 'Sweet',
  
  // More natural phrases
  'That works', 'Makes sense', 'Clear as day', 'Exactly',
  'Good thinking', 'Precisely', 'Getting it', 'Right on',
  
  // Subtle international but slightly more slangy
  'Du coup!', 'Génial', 'Voilà!', 'Allora!', 'Echt cool', 'Claro', 
  'Ottimo!', 'Exacto', 'Vale', 'Jetzt passt\'s', 'Ça marche',
  
  // Light number references without school context
  'Numbers don\'t lie', 'Precisely calculated', 'By the numbers',
  'Digit perfect', 'Equation solved', 'All adds up',
  
  // Subtle coolness
  'On point', 'Loving your work', 'Eating it up', 'Naturally',
  'Flawless', 'Like clockwork', 'Zero doubt', 'Next level'
];

const CelebrationPill: React.FC<CelebrationPillProps> = ({ 
  isVisible, 
  onComplete 
}) => {
  const [phrase, setPhrase] = useState('');

  // Generate celebration content once on component mount
  useEffect(() => {
    // Choose a random celebration phrase and emoji
    const randomPhrase = CELEBRATION_PHRASES[Math.floor(Math.random() * CELEBRATION_PHRASES.length)];
    const randomEmoji = CELEBRATION_EMOJIS[Math.floor(Math.random() * CELEBRATION_EMOJIS.length)];
    
    // Sometimes show just the phrase, sometimes with emoji
    const showBothEmojis = Math.random() < 0.3; // 30% chance for both emojis
    const showOneEmoji = Math.random() < 0.5;   // 50% chance for one emoji (if not showing both)
    
    if (showBothEmojis) {
      setPhrase(`${randomEmoji} ${randomPhrase} ${randomEmoji}`);
    } else if (showOneEmoji) {
      setPhrase(`${randomEmoji} ${randomPhrase}`);
    } else {
      setPhrase(randomPhrase);
    }
    
    // Call onComplete after animation finishes
    // Ensure the pill is visible long enough (1800ms)
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 1800);
    
    return () => {
      clearTimeout(timer);
    };
  }, []); // Only run once on mount, not when props change

  return (
    <div 
      className="question-pill celebration-pill text-center text-2xl py-3 px-6 font-bold"
      style={{
        animation: 'celebration-pill-animation 1.8s ease-out forwards',
        opacity: 1, // Start visible
      }}
    >
      {phrase}
      
      {/* CSS animations */}
      <style jsx>{`
        .celebration-pill {
          background-color: #10b981 !important; /* Green color */
          color: white;
          box-shadow: 
            0 10px 20px rgba(16, 185, 129, 0.5),
            0 6px 6px rgba(16, 185, 129, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.2) inset !important;
        }
        
        @keyframes celebration-pill-animation {
          0% { 
            opacity: 0;
            transform: perspective(800px) translateZ(0) scale(0.95);
          }
          8% { /* Appear faster */
            opacity: 1;
            transform: perspective(800px) translateZ(60px) scale(1.08);
          }
          85% { /* Stay visible longer */
            opacity: 1;
            transform: perspective(800px) translateZ(50px) scale(1.05);
          }
          100% { 
            opacity: 0;
            transform: perspective(800px) translateZ(50px) scale(1.05);
          }
        }
      `}</style>
    </div>
  );
};

export default CelebrationPill;