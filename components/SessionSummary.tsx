import React, { useState, useEffect } from 'react';

interface SessionData {
  sessionId: string;
  basePoints: number;
  multiplier: number;
  multiplierType: string;
  totalPoints: number;
  blinkSpeed: number | null;
  correctAnswers: number;
  totalQuestions: number;
  firstTimeCorrect: number;
}

interface SessionSummaryProps {
  sessionData: SessionData;
  onComplete: () => void;
  className?: string;
  isAuthenticated?: boolean;
}

/**
 * Animated session summary displayed after completing a learning session
 * Shows points earned, multiplier applied, and performance metrics
 */
const SessionSummary: React.FC<SessionSummaryProps> = ({ 
  sessionData, 
  onComplete, 
  className = '',
  isAuthenticated = false
}) => {
  // Animation stages
  const [stage, setStage] = useState<'initial' | 'multiplier' | 'final'>('initial');
  
  // Auto-advance through animation stages
  useEffect(() => {
    const sequence = async () => {
      // Initial display (1.5s)
      await new Promise(resolve => setTimeout(resolve, 1500));
      setStage('multiplier');
      
      // Multiplier reveal (2s)
      await new Promise(resolve => setTimeout(resolve, 2000));
      setStage('final');
      
      // Final display (5s)
      await new Promise(resolve => setTimeout(resolve, 5000));
      onComplete();
    };
    
    sequence();
  }, [onComplete]);

  // Format blink speed for display
  const formatBlinkSpeed = (speed: number | null) => {
    if (speed === null) return 'N/A';
    return `${speed.toFixed(1)}s`;
  };

  // Get multiplier accent color
  const getMultiplierColor = (multiplier: number) => {
    if (multiplier >= 5) return 'text-amber-400';
    if (multiplier >= 3) return 'text-purple-400';
    if (multiplier >= 2) return 'text-blue-400';
    return 'text-teal-400';
  };
  
  const multiplierColor = getMultiplierColor(sessionData.multiplier);

  return (
    <div className={`max-w-md mx-auto bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl shadow-2xl overflow-hidden ${className}`}>
      <div className="bg-indigo-800/40 p-4 text-center">
        <h2 className="text-2xl font-bold text-white">Session Complete!</h2>
        {!isAuthenticated && (
          <p className="text-blue-200 text-sm mt-1">Your progress is saved in your browser</p>
        )}
      </div>
      
      <div className="p-6 space-y-6">
        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-white/70 text-xs mb-1">Correct Answers</div>
            <div className="text-2xl font-bold text-white">
              {sessionData.correctAnswers}/{sessionData.totalQuestions}
            </div>
          </div>
          
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-white/70 text-xs mb-1">Blink Speed</div>
            <div className="text-2xl font-bold text-white">
              {formatBlinkSpeed(sessionData.blinkSpeed)}
            </div>
          </div>
        </div>
        
        {/* Points Calculation */}
        <div className="space-y-4 pt-2">
          {/* Base Points */}
          <div className="flex justify-center items-center transition-opacity duration-500">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {sessionData.basePoints}
              </div>
              <div className="text-white/70 text-sm">base points</div>
            </div>
          </div>
          
          {/* Multiplier (animated) */}
          {stage !== 'initial' && (
            <div className={`flex justify-center items-center transition-all duration-1000 ${
              stage === 'multiplier' ? 'scale-125 animate-pulse' : ''
            }`}>
              <div className="text-center">
                <div className={`text-lg font-medium ${multiplierColor} mb-1`}>
                  {sessionData.multiplierType}
                </div>
                <div className={`text-4xl font-bold ${multiplierColor}`}>
                  ×{sessionData.multiplier.toFixed(1)}
                </div>
              </div>
            </div>
          )}
          
          {/* Total Points (animated) */}
          {stage === 'final' && (
            <div className="flex justify-center items-center animate-fadeIn">
              <div className="h-px w-16 bg-white/20 mr-4"></div>
              <div className="text-center">
                <div className="text-4xl font-bold text-amber-400">
                  {sessionData.totalPoints}
                </div>
                <div className="text-white/70 text-sm">total points</div>
              </div>
              <div className="h-px w-16 bg-white/20 ml-4"></div>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 text-center bg-white/5">
        {isAuthenticated ? (
          <button 
            onClick={onComplete}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            Continue to Dashboard
          </button>
        ) : (
          <div className="space-y-2">
            <button 
              onClick={onComplete}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors w-full"
            >
              Continue Playing
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionSummary;