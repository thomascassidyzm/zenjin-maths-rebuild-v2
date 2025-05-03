/**
 * Anonymous User Upgrade Prompt
 * 
 * Component that encourages anonymous users to sign up for an account
 * and subscribe to premium. This bridges the gap between anonymous
 * free tier users and fully authenticated premium users.
 */
import React from 'react';
import { useRouter } from 'next/router';

interface AnonymousUpgradePromptProps {
  /**
   * CSS class name for container
   */
  className?: string;
  
  /**
   * Total points accumulated in anonymous mode
   */
  points?: number;
  
  /**
   * Hours spent in the app
   */
  hoursSpent?: number;
  
  /**
   * Size variant for the prompt (small or large)
   */
  size?: 'small' | 'large';
  
  /**
   * Callback when user clicks sign up
   */
  onSignUp?: () => void;
}

const AnonymousUpgradePrompt: React.FC<AnonymousUpgradePromptProps> = ({
  className = '',
  points = 0,
  hoursSpent = 0,
  size = 'large',
  onSignUp
}) => {
  const router = useRouter();
  
  // Format points with commas
  const formattedPoints = points.toLocaleString();
  
  // Round hours to one decimal place
  const formattedHours = Math.round(hoursSpent * 10) / 10;
  
  // Handle sign up action
  const handleSignUp = () => {
    if (onSignUp) {
      onSignUp();
    } else {
      router.push('/signin?mode=signup&redirect=/subscription');
    }
  };
  
  if (size === 'small') {
    return (
      <div className={`bg-gradient-to-r from-blue-600/90 to-indigo-600/90 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden ${className}`}>
        <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-white">
            <p className="font-medium">Sign up to save your progress!</p>
            <p className="text-sm text-white/80">
              You've earned <span className="font-bold text-yellow-300">{formattedPoints} points</span>. 
              Don't lose them.
            </p>
          </div>
          
          <button
            onClick={handleSignUp}
            className="px-4 py-2 bg-white text-indigo-700 rounded font-medium hover:bg-yellow-100 transition-colors self-stretch sm:self-center"
          >
            Sign Up Now
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-gradient-to-r from-blue-600/90 to-indigo-700/90 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden ${className}`}>
      <div className="p-6">
        <h3 className="text-xl font-bold text-white mb-3">
          You're using Zenjin Maths in Guest Mode
        </h3>
        
        <div className="mb-4 text-white/90">
          <p className="mb-2">
            You've earned <span className="font-bold text-yellow-300">{formattedPoints} points</span> and 
            spent <span className="font-bold text-teal-300">{formattedHours} hours</span> learning mathematics.
          </p>
          <p>
            Create an account to save your progress, unlock premium content, and continue your learning journey.
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-white/10 rounded-lg p-3">
            <h4 className="font-bold text-white">What You'll Keep</h4>
            <ul className="text-sm text-white/80 mt-1 space-y-1">
              <li>• All your earned points</li>
              <li>• Your progress level</li>
              <li>• Your learning history</li>
            </ul>
          </div>
          
          <div className="bg-white/10 rounded-lg p-3">
            <h4 className="font-bold text-white">What You'll Gain</h4>
            <ul className="text-sm text-white/80 mt-1 space-y-1">
              <li>• Sync across devices</li>
              <li>• Premium content access</li>
              <li>• Personalized learning path</li>
            </ul>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleSignUp}
            className="py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-white font-medium rounded-lg transition-colors"
          >
            Sign Up & Save Progress
          </button>
          
          <button
            onClick={() => router.push('/subscription')}
            className="py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-medium rounded-lg transition-colors"
          >
            View Premium Plans
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnonymousUpgradePrompt;