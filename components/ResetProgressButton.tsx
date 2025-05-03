import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface ResetProgressButtonProps {
  className?: string;
  onComplete?: () => void;
}

/**
 * Reset Progress Button
 * 
 * A button component that allows users to reset their progress
 * to the initial state with default configurations.
 */
const ResetProgressButton: React.FC<ResetProgressButtonProps> = ({ 
  className = '', 
  onComplete 
}) => {
  const { user } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resetResult, setResetResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Handle reset button click
  const handleResetClick = () => {
    setIsModalOpen(true);
    setResetResult(null);
  };

  // Handle modal close
  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (resetResult?.success && onComplete) {
      onComplete();
    }
  };

  // Handle reset confirmation
  const handleConfirmReset = async () => {
    if (!user) return;
    
    try {
      setIsResetting(true);
      setResetResult(null);
      
      // Clear all localStorage state to prevent stale references
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('triple_helix_') || 
            key.startsWith('zenjin_') || 
            key === 'supabase.auth.token' ||
            key.includes('stitch') || 
            key.includes('thread')) {
          console.log(`Clearing localStorage key: ${key}`);
          localStorage.removeItem(key);
        }
      });
      
      // Call reset API endpoint
      const response = await fetch('/api/reset-user-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });
      
      const result = await response.json();
      
      // Clear remaining localStorage items regardless of result
      localStorage.removeItem(`triple_helix_state_${user.id}`);
      localStorage.removeItem(`zenjin_anonymous_state`);
      
      setResetResult({
        success: result.success,
        message: result.success 
          ? 'Your progress has been reset successfully. The page will reload.'
          : `Error: ${result.error || 'Failed to reset progress'}`
      });
      
      // If successful, reload the page after a short delay
      if (result.success) {
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    } catch (error) {
      console.error('Error resetting progress:', error);
      setResetResult({
        success: false,
        message: 'An unexpected error occurred. Please try again.'
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleResetClick}
        className={`px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors ${className}`}
        title="Reset your progress to the beginning"
      >
        Reset Progress
      </button>
      
      {/* Reset Confirmation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Reset Progress</h2>
            
            {!resetResult ? (
              <>
                <p className="mb-6 text-gray-700">
                  Are you sure you want to reset all your progress? This will:
                </p>
                <ul className="list-disc pl-5 mb-6 text-gray-700">
                  <li>Reset all your tutorial progress</li>
                  <li>Clear all your session results</li>
                  <li>Start from the beginning of each tube</li>
                </ul>
                <p className="mb-6 text-gray-700 font-semibold">
                  This action cannot be undone.
                </p>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                    disabled={isResetting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmReset}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    disabled={isResetting}
                  >
                    {isResetting ? 'Resetting...' : 'Reset My Progress'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={`p-4 rounded-md mb-6 ${resetResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {resetResult.message}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {resetResult.success ? 'Please wait...' : 'Close'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ResetProgressButton;