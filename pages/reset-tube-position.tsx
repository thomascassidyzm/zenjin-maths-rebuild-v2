import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Head from 'next/head';

export default function ResetTubePosition() {
  const { user, isAuthenticated, loading } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    // Set the user ID when authentication is loaded
    if (!loading && isAuthenticated && user) {
      setUserId(user.id);
    }
  }, [loading, isAuthenticated, user]);

  const resetTubePosition = async () => {
    if (!userId) {
      setResetResult({
        success: false,
        message: 'No user ID available. Please log in first.'
      });
      return;
    }

    setIsResetting(true);
    setResetResult(null);

    try {
      const response = await fetch('/api/initialize-user-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();

      if (response.ok) {
        setResetResult({
          success: true,
          message: 'Your tube position has been reset to Tube-1 with Thread-A. You can now return to the player page.'
        });
      } else {
        setResetResult({
          success: false,
          message: `Error: ${data.error || 'Unknown error occurred'}`
        });
      }
    } catch (error) {
      setResetResult({
        success: false,
        message: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsResetting(false);
    }
  };

  const goToPlayerPage = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Reset Tube Position</title>
      </Head>

      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h1 className="text-lg font-medium text-gray-900">Reset Tube Position</h1>
          
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              This tool will reset your tube position to the default starting position: 
              <span className="font-medium text-blue-600"> Tube-1 with Thread-A</span>.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Use this if you're experiencing issues with the player or if you want to start fresh.
            </p>
          </div>

          {loading ? (
            <div className="mt-4">
              <p className="text-sm text-gray-500">Loading user information...</p>
            </div>
          ) : (
            <>
              {isAuthenticated ? (
                <div className="mt-4">
                  <p className="text-sm text-gray-600">
                    User ID: <span className="font-mono">{userId}</span>
                  </p>
                </div>
              ) : (
                <div className="mt-4 bg-yellow-50 p-3 rounded">
                  <p className="text-sm text-yellow-700">
                    You are not logged in. Please log in to reset your tube position.
                  </p>
                </div>
              )}
            </>
          )}

          {resetResult && (
            <div className={`mt-4 p-3 rounded ${resetResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className={`text-sm ${resetResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {resetResult.message}
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-col sm:flex-row sm:space-x-3">
            <button
              type="button"
              onClick={resetTubePosition}
              disabled={isResetting || loading || !isAuthenticated}
              className={`inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isResetting || loading || !isAuthenticated
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {isResetting ? 'Resetting...' : 'Reset Position'}
            </button>

            <button
              type="button"
              onClick={goToPlayerPage}
              className="mt-3 sm:mt-0 inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Return to Player
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}