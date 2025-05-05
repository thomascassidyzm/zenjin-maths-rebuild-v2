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
          Save Your Progress
        </h3>
        
        <div className="mb-5 text-white/90">
          <p>
            You've earned <span className="font-bold text-yellow-300">{formattedPoints} points</span>. 
            Create an account to save progress and access more content.
          </p>
        </div>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={handleSignUp}
            className="py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-white font-medium rounded-lg transition-colors"
          >
            Sign Up & Save Progress
          </button>
          
          <button
            onClick={() => router.push('/subscribe')}
            className="py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors border border-white/20"
          >
            View Premium Plans
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnonymousUpgradePrompt;