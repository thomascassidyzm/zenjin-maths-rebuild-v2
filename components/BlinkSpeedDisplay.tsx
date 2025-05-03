import React from 'react';

interface BlinkSpeedDisplayProps {
  blinkSpeed: number;
  trend: 'improving' | 'steady' | 'declining';
  className?: string;
}

/**
 * Displays the user's blink speed (average response time) with trend indicator
 * Special visual effects for exceptional speeds
 */
const BlinkSpeedDisplay: React.FC<BlinkSpeedDisplayProps> = ({ 
  blinkSpeed, 
  trend, 
  className = '' 
}) => {
  // Define speed categories with thresholds
  const getSpeedCategory = (speed: number) => {
    if (speed <= 1) return {
      name: "Mind Warp",
      className: "border-purple-400 bg-purple-700/20 shadow-purple",
      effect: "animate-pulse-purple"
    };
    if (speed <= 3) return {
      name: "Thought Flash",
      className: "border-blue-400 bg-blue-700/20 shadow-blue",
      effect: "animate-pulse-blue"
    };
    if (speed <= 5) return {
      name: "Time Bender",
      className: "border-teal-400 bg-teal-700/20 shadow-teal",
      effect: "animate-pulse-teal"
    };
    return {
      name: null,
      className: "border-white/20 bg-white/10",
      effect: ""
    };
  };

  // Get trend arrow and color
  const getTrendIndicator = (trendValue: string) => {
    switch (trendValue) {
      case 'improving':
        return { arrow: '↑', color: 'text-green-400', label: 'Improving' };
      case 'declining':
        return { arrow: '↓', color: 'text-red-400', label: 'Room for Growth' };
      default:
        return { arrow: '→', color: 'text-yellow-400', label: 'Steady' };
    }
  };

  const speedCategory = getSpeedCategory(blinkSpeed);
  const trendIndicator = getTrendIndicator(trend);

  return (
    <div className={`rounded-xl border p-4 ${speedCategory.className} ${speedCategory.effect} ${className}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-white">Blink Speed</h3>
        {speedCategory.name && (
          <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium">
            {speedCategory.name}!
          </span>
        )}
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          <div className="text-3xl font-bold text-white flex items-center">
            {blinkSpeed.toFixed(1)}
            <span className="text-white/60 text-lg ml-1">sec</span>
          </div>
          <div className="text-xs text-white/70">
            Average response time
          </div>
        </div>
        
        <div className={`flex flex-col items-end ${trendIndicator.color}`}>
          <span className="text-2xl font-bold">{trendIndicator.arrow}</span>
          <span className="text-xs">{trendIndicator.label}</span>
        </div>
      </div>
    </div>
  );
};

export default BlinkSpeedDisplay;