import React, { useEffect, useRef } from 'react';

// Persistent background bubbles component that won't reset with state changes
const BackgroundBubbles: React.FC = () => {
  // Use ref to ensure the bubbles data persists across renders
  const bubblesRef = useRef<Array<{
    id: number;
    size: number;
    left: string;
    delay: number;
    duration: number;
    direction: number; // Random movement direction (-1 = left, 0 = straight, 1 = right)
    sway: number; // Random sway amount
    opacity: number; // Random opacity
  }> | null>(null);
  
  // Generate bubbles only once
  useEffect(() => {
    if (!bubblesRef.current) {
      // Create bubbles with more randomness
      bubblesRef.current = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        size: Math.floor(Math.random() * 100) + 10, // 10-110px - more size variation
        left: `${Math.random() * 100}%`,
        delay: Math.random() * 15, // Reduced delays for quicker start (0-15s)
        duration: Math.random() * 25 + 15, // 15-40s for faster, more bubble-like animation
        direction: Math.floor(Math.random() * 3) - 1, // Random direction: -1, 0, or 1
        sway: Math.random() * 5, // Random sway amount 0-5
        opacity: Math.random() * 0.1 + 0.05, // Random opacity between 0.05 and 0.15
      }));
    }
  }, []);

  // If bubbles aren't generated yet, return nothing (during initial render)
  if (!bubblesRef.current) return null;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{zIndex: 2}}>
      {bubblesRef.current.map((bubble) => {
        return (
          <div
            key={bubble.id}
            className="bubble"
            style={{
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              left: bubble.left,
              bottom: '-100px',
              animationDelay: `${bubble.delay}s`,
              animationDuration: `${bubble.duration}s`,
              background: `rgba(255, 255, 255, ${bubble.opacity})`,
              // Apply CSS variables for dynamic animation in keyframes
              '--direction': bubble.direction,
              '--sway': bubble.sway,
              '--bubble-opacity': bubble.opacity
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
};

export default BackgroundBubbles;