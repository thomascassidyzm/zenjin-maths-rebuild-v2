import React, { useEffect, useState } from 'react';

/**
 * Extend the Window interface to include our global state
 */
declare global {
  interface Window {
    __PLAYER_STATE__?: {
      currentStitch?: {
        id: string;
        [key: string]: any;
      };
      [key: string]: any;
    };
  }
}

/**
 * StitchCelebration - A standalone celebration component that appears when a stitch is completed
 * This is completely separate from the MinimalDistinctionPlayer to avoid rendering issues
 */
interface StitchCelebrationProps {
  isVisible: boolean;
  onComplete: () => void;
}

// Celebration phrases and emojis
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

const CELEBRATION_EMOJIS = [
  // Subtle
  '✓', '✔️', '⭐', '★', '•', '○', '◦', '◇', ' ',
  
  // Minimal
  '👍', '👌', '✨', '💭', '✓', '↑', '→', '↗️',
  
  // Sometimes no emoji is cooler - empty space
  ' ', ' ', ' ', ' ', ' '
];

// Track animation and state
let activeAnimationId: number | null = null;
// Track the current celebration state to prevent duplicate renders
let celebrationState: {
  lastCompletedStitchId: string | null;
  lastCelebrationTimestamp: number;
  lastVisibleState: boolean;
} = {
  lastCompletedStitchId: null,
  lastCelebrationTimestamp: 0,
  lastVisibleState: false
};

const StitchCelebration: React.FC<StitchCelebrationProps> = ({ 
  isVisible, 
  onComplete 
}) => {
  const [phrase, setPhrase] = useState('');
  const [shouldRender, setShouldRender] = useState(false);
  const [key, setKey] = useState(Date.now());
  
  // Get the current stitch ID from the global state if available
  const getCurrentStitchId = () => {
    try {
      // Access window object safely
      if (typeof window !== 'undefined' && window.__PLAYER_STATE__?.currentStitch?.id) {
        return window.__PLAYER_STATE__.currentStitch.id;
      }
    } catch (e) {
      console.log('Error accessing player state:', e);
    }
    return `stitch-${Date.now()}`; // Fallback unique ID
  };

  // Generate celebration content when component becomes visible
  useEffect(() => {
    // Get current stitch ID if possible
    const currentStitchId = getCurrentStitchId();
    const now = Date.now();
    
    // Detect state transition from hidden to visible (actual showing event)
    const isNewVisibleState = isVisible && !celebrationState.lastVisibleState;
    
    // Double-render protection - require at least 1 second between celebrations
    const hasTimeBufferPassed = (now - celebrationState.lastCelebrationTimestamp) > 1000;
    
    // NOTE: We're allowing all celebrations regardless of stitch ID
    // const isNewStitch = currentStitchId !== celebrationState.lastCompletedStitchId;
    
    // Only check visibility and time buffer - allow any stitch
    if (isVisible && isNewVisibleState && hasTimeBufferPassed) {
      // Update tracking but RESET visibleState when done to allow future celebrations
      celebrationState.lastCompletedStitchId = currentStitchId;
      celebrationState.lastCelebrationTimestamp = now;
      celebrationState.lastVisibleState = true;
      
      // Schedule reset of visibility state to allow future celebrations
      setTimeout(() => {
        celebrationState.lastVisibleState = false;
      }, 2100); // Just after animation completes
      
      console.log(`🎬 Showing celebration for stitch: ${currentStitchId}`);
      
      // Generate a new key to force complete remount
      setKey(now);
      
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
      
      // Cancel any existing timer
      if (activeAnimationId !== null) {
        window.clearTimeout(activeAnimationId);
      }
      
      // Show the celebration
      setShouldRender(true);
      
      // Set a timer to complete after animation finishes
      activeAnimationId = window.setTimeout(() => {
        // Trigger the complete callback
        onComplete();
        
        // Hide the celebration
        setShouldRender(false);
        activeAnimationId = null;
      }, 2000); // Slightly longer than animation
    } 
    else if (!isVisible) {
      // Update tracking state when hidden
      celebrationState.lastVisibleState = false;
      
      // If a timer is active, clear it
      if (activeAnimationId !== null) {
        window.clearTimeout(activeAnimationId);
        activeAnimationId = null;
      }
      
      // Make sure we're not rendering
      setShouldRender(false);
    }
    
    // Cleanup function
    return () => {
      if (activeAnimationId !== null) {
        window.clearTimeout(activeAnimationId);
      }
    };
  }, [isVisible, onComplete]);
  
  // Only render the component when it should be visible
  if (!shouldRender) {
    return null;
  }
  
  return (
    <div className="stitch-celebration-pill" key={key}>
      {phrase}
      
      {/* Scoped styles for the celebration */}
      <style jsx>{`
        .stitch-celebration-pill {
          position: absolute;
          top: 40px; /* Positioned higher to match black pill */
          left: 50%;
          transform: translateX(-50%);
          z-index: 50;
          pointer-events: none;
          
          /* Match the black pill styling but with green color */
          background-color: #10b981; /* Green */
          color: white;
          font-size: 2rem; /* Much larger text */
          font-weight: bold;
          padding: 1rem 2.5rem; /* Larger padding */
          border-radius: 9999px;
          text-align: center;
          width: auto;
          max-width: 95%; /* Allow more width */
          
          /* Animation */
          animation: celebration-pill-animation 2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          
          /* Enhanced shadows - more prominent than black pill */
          box-shadow: 
            0 10px 20px rgba(16, 185, 129, 0.6), /* Outer shadow */
            0 6px 8px rgba(16, 185, 129, 0.4), /* Middle shadow */
            0 0 0 1px rgba(255, 255, 255, 0.2) inset, /* Inner border */
            0 0 15px 3px rgba(16, 185, 129, 0.3); /* Extra glow */
          
          /* Match black pill subtle text shadow */
          text-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
          
          /* Set transform origin for better animation */
          transform-origin: center top;
        }
        
        @keyframes celebration-pill-animation {
          0% { 
            opacity: 0;
            transform: translateY(-10px) scale(0.9);
          }
          5% { /* Appear faster */
            opacity: 1;
            transform: translateY(5px) scale(1.08); /* Pop down a bit */
          }
          15% { /* Small bounce */
            transform: translateY(-2px) scale(1.02);
          }
          25% { /* Settle */
            transform: translateY(0) scale(1.05);
          }
          80% { /* Stay visible */
            opacity: 1;
            transform: translateY(0) scale(1.05);
          }
          100% { 
            opacity: 0;
            transform: translateY(-15px) scale(0.9);
          }
        }
      `}</style>
    </div>
  );
};

export default StitchCelebration;