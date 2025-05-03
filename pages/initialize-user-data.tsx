import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function InitializeUserData() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const initializeUserData = async () => {
    if (!isAuthenticated || !user) {
      setError('You must be logged in to initialize user data.');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      setResult(null);

      // Call API to initialize user data for testing
      const response = await fetch('/api/user-stitches', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initialize user data');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Error initializing user data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Initialize User Data</h1>
            <button
              onClick={() => router.push('/')}
              className="text-blue-500 hover:text-blue-700"
            >
              Return Home
            </button>
          </div>

          {!isAuthenticated ? (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 mb-6">
              <h2 className="text-yellow-800 text-lg font-semibold mb-2">Authentication Required</h2>
              <p className="text-yellow-700 mb-4">You need to be logged in to initialize user data.</p>
              <button
                onClick={() => router.push('/login')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
              >
                Log In
              </button>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                <h2 className="text-blue-800 text-lg font-semibold mb-2">User Information</h2>
                <p className="text-blue-700">Logged in as: {user?.email || user?.id}</p>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  This page will initialize stitch data for your user account. This is useful for testing the
                  stitch sequencing functionality.
                </p>
                <button
                  onClick={initializeUserData}
                  disabled={isProcessing}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded transition-colors disabled:bg-gray-400"
                >
                  {isProcessing ? 'Initializing...' : 'Initialize User Data'}
                </button>
              </div>

              {error && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-100 mb-6">
                  <h2 className="text-red-800 text-lg font-semibold mb-2">Error</h2>
                  <p className="text-red-700">{error}</p>
                </div>
              )}

              {result && (
                <div className="mt-6">
                  <h2 className="text-lg font-semibold mb-2">Initialization Result</h2>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100 mb-4">
                    <p className="text-green-700">
                      {result.success ? 'User data initialized successfully!' : 'Initialization failed.'}
                    </p>
                  </div>
                  <div className="bg-gray-100 p-4 rounded-lg max-h-96 overflow-auto">
                    <h3 className="font-medium mb-2">Response Data:</h3>
                    <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-6 space-y-2">
            <p className="text-gray-600 text-sm">Next Steps:</p>
            <div className="flex space-x-4">
              <button
                onClick={() => router.push('/test-stitches')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Test Stitches
              </button>
              <button
                onClick={() => router.push('/check-db')}
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Check Database
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}