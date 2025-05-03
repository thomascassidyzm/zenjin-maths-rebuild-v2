import React from 'react';

interface EvolutionLevel {
  currentLevel: string;
  levelNumber: number;
  progress: number;
  nextLevel: string | null;
}

interface EvolutionBadgeProps {
  evolution: EvolutionLevel;
  className?: string;
}

/**
 * Displays the user's evolution level with progress towards the next level
 */
const EvolutionBadge: React.FC<EvolutionBadgeProps> = ({ evolution, className = '' }) => {
  // Color mapping for different level ranges
  const getLevelColor = (level: number) => {
    if (level <= 3) return 'from-teal-500 to-cyan-400';
    if (level <= 6) return 'from-blue-500 to-indigo-400';
    if (level <= 9) return 'from-purple-500 to-fuchsia-400';
    return 'from-amber-500 to-pink-400';
  };

  const bgGradient = getLevelColor(evolution.levelNumber);

  return (
    <div className={`rounded-xl overflow-hidden shadow-lg ${className}`}>
      <div className={`p-4 bg-gradient-to-r ${bgGradient}`}>
        <div className="flex items-center">
          <div className="flex-shrink-0 mr-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl border-2 border-white/40">
              {evolution.levelNumber}
            </div>
          </div>
          <div>
            <h3 className="text-white font-bold text-xl">{evolution.currentLevel}</h3>
            <p className="text-white/80 text-sm">Evolution Level</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white/10 backdrop-blur-sm p-4 text-white">
        {evolution.nextLevel ? (
          <>
            <div className="flex justify-between text-sm mb-1">
              <span>Progress to next level</span>
              <span className="font-medium">{evolution.progress}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2.5 mb-3">
              <div 
                className={`h-2.5 rounded-full bg-gradient-to-r ${bgGradient}`}
                style={{ width: `${evolution.progress}%` }}
              />
            </div>
            <div className="text-sm text-white/70">
              Next: <span className="font-medium text-white">{evolution.nextLevel}</span>
            </div>
          </>
        ) : (
          <div className="text-center py-2">
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
              Maximum Level Achieved!
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvolutionBadge;