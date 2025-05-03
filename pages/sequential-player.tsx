import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import SequentialPlayer from '../components/SequentialPlayer';
import { ThreadData } from '../lib/types/distinction-learning';
import { getSampleThreadData } from '../lib/sample-data';

export default function SequentialPlayerPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [threadData, setThreadData] = useState<ThreadData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch thread data
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        
        // For authenticated users, use restore mode to ensure we load saved progress
        const queryParams = new URLSearchParams();
        
        // Always use restore mode for authenticated users to ensure proper progress loading
        if (isAuthenticated && user) {
          queryParams.append('mode', 'restore');
          console.log('Using restore mode to load saved user progress');
        }
        
        // Request a higher prefetch count to load more stitches per tube
        queryParams.append('prefetch', '5');
        
        const apiUrl = `/api/user-stitches${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        console.log(`Fetching user stitches from: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          credentials: 'include' // Include auth cookies with the request
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Unknown error');
        }
        
        console.log(`Fetched ${result.data.length} threads`);
        
        // If result has data, use it
        if (result.data && result.data.length > 0) {
          console.log(`Received ${result.data.length} threads from API`);
          
          // Log the tube assignments for debugging
          if (process.env.NODE_ENV === 'development') {
            console.log('Thread to tube assignments:');
            result.data.forEach((thread: ThreadData) => {
              // Try to extract tube letter from thread ID (thread-A -> A)
              const tubeLetter = thread.thread_id.match(/thread-([A-Z])/)?.[1] || '?';
              console.log(`- ${thread.thread_id}: Tube ${tubeLetter}`);
              console.log(`  Ready stitch: ${thread.stitches.find(s => s.order_number === 0)?.id || 'none'}`);
              console.log(`  Total stitches: ${thread.stitches.length}`);
            });
          }
          
          setThreadData(result.data);
        } else {
          // For authenticated users, we should NEVER use sample data
          if (isAuthenticated && user) {
            // This is a critical error - an authenticated user should always have real data
            const errorMsg = 'No thread data received from API for authenticated user. This indicates a database issue.';
            console.error(errorMsg);
            throw new Error(errorMsg);
          }
          
          // Only for anonymous users or development, create sample data
          else if (process.env.NODE_ENV === 'development') {
            console.log('Creating sample data for development mode only');
            
            // Use our enhanced sample data with comprehensive content
            const sampleData = getSampleThreadData();
            
            console.log('Created sample data with 3 threads (one for each tube)');
            setThreadData(sampleData);
          } else {
            throw new Error('No thread data received from API');
          }
        }
      } catch (error) {
        console.error('Error fetching thread data:', error);
        const message = error instanceof Error ? error.message : 'Failed to load thread data';
        setError(message);
        
        // In development, create sample data even on error, but only for non-authenticated users
        if (process.env.NODE_ENV === 'development' && (!isAuthenticated || !user)) {
          console.log('Creating sample data due to error (development mode only)');
          
          // Use our enhanced sample data with comprehensive content
          const sampleData = getSampleThreadData();
          
          setThreadData(sampleData);
          setError(null); // Clear error since we're providing sample data
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (!authLoading) {
      fetchData();
    }
  }, [authLoading]);

  // Render loading state
  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center">
        <div className="text-center text-white">
          <div className="inline-block animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full mb-4"></div>
          <p>{authLoading ? 'Checking authentication...' : 'Loading player data...'}</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-white mb-4 text-center">Authentication Required</h1>
          <p className="text-white text-opacity-80 text-center mb-6">
            You need to be logged in to access the sequential player.
          </p>
          <div className="flex space-x-4 justify-center">
            <a
              href="/login"
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Sign In
            </a>
            <a
              href="/"
              className="bg-white bg-opacity-10 hover:bg-opacity-20 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Back to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Handle errors
  if (error) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-white mb-4 text-center">Error</h1>
          <div className="bg-red-500/20 border border-red-300/30 text-red-100 rounded-lg p-4 mb-6">
            {error}
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors mr-4"
            >
              Try Again
            </button>
            <a
              href="/admin-dashboard"
              className="bg-white bg-opacity-10 hover:bg-opacity-20 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  // No thread data
  if (threadData.length === 0) {
    return (
      <div className="min-h-screen player-bg flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-white mb-4 text-center">No Threads Found</h1>
          <p className="text-white text-opacity-80 text-center mb-6">
            No thread data is available. Please check the database to ensure threads and stitches exist.
          </p>
          <div className="flex justify-center">
            <a
              href="/admin-dashboard"
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen player-bg p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-white">Sequential Player</h1>
            <div className="flex space-x-4">
              <a
                href="/test-thread-cycler"
                className="text-teal-300 hover:text-teal-200 transition-colors"
              >
                Thread Cycler
              </a>
              <a
                href="/admin-dashboard"
                className="text-teal-300 hover:text-teal-200 transition-colors"
              >
                Dashboard
              </a>
              <a
                href="/"
                className="text-teal-300 hover:text-teal-200 transition-colors"
              >
                Home
              </a>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-white text-opacity-80 mb-4">
              This player cycles through tubes (A→B→C→A) and automatically plays the active stitch from each tube.
              Each tube contains one or more threads, and stitches move within the tube based on your performance.
              When a stitch is completed, the player automatically moves to the next tube.
            </p>
          </div>

          {/* Sequential Player Component */}
          <SequentialPlayer 
            threadData={threadData}
            userId={user?.id || 'anonymous'}
          />
        </div>
      </div>
    </div>
  );
}