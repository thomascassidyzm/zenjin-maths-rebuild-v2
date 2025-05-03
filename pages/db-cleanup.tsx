import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function DatabaseCleanup() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  // Function to clean test data from database
  const cleanupTestData = async () => {
    if (confirmText !== 'CLEANUP') {
      setError('Please type CLEANUP to confirm');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/cleanup-test-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clean test data');
      }

      setResult(data);
    } catch (err) {
      console.error('Error cleaning test data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen player-bg">
      <Head>
        <title>Database Cleanup | Zenjin</title>
      </Head>

      <header className="bg-white bg-opacity-20 backdrop-blur-lg shadow-xl">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">Database Cleanup</h1>
          <div className="flex space-x-3">
            <button
              onClick={() => router.push('/tube-diagnostic')}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1 rounded"
            >
              Tube Diagnostic
            </button>
            <button
              onClick={() => router.push('/')}
              className="bg-gray-600 hover:bg-gray-500 text-white text-sm px-3 py-1 rounded"
            >
              Home
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl shadow-lg mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Clean Test Data</h2>
            
            <div className="bg-red-900/30 p-4 rounded-lg border border-red-500/30 mb-6">
              <h3 className="font-bold text-red-400 mb-2">⚠️ Warning: Destructive Operation</h3>
              <p className="text-white/80 text-sm">
                This will permanently delete all test data from your database, including:
              </p>
              <ul className="list-disc ml-5 mt-2 space-y-1 text-white/80 text-sm">
                <li>Any threads with IDs starting with "test-"</li>
                <li>Any stitches with IDs starting with "test-"</li>
                <li>Any thread-stitch mappings related to test threads or stitches</li>
                <li>Any user progress data related to test threads or stitches</li>
              </ul>
              <p className="mt-3 text-white/80 text-sm font-bold">This action cannot be undone!</p>
            </div>
            
            <div className="mb-4">
              <label className="block text-white mb-2 font-medium">
                Type CLEANUP to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                placeholder="CLEANUP"
              />
            </div>
            
            {error && (
              <div className="bg-red-900/30 text-red-300 p-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}
            
            <button
              onClick={cleanupTestData}
              disabled={isLoading || confirmText !== 'CLEANUP'}
              className={`w-full py-2 px-4 rounded-lg font-medium ${
                isLoading || confirmText !== 'CLEANUP'
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-500'
              } text-white transition-colors`}
            >
              {isLoading ? 'Cleaning...' : 'Clean Test Data'}
            </button>
          </div>
          
          {result && (
            <div className="bg-green-900/30 p-6 rounded-xl border border-green-500/30">
              <h3 className="font-bold text-green-400 mb-3">Cleanup Successful!</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 p-3 rounded-lg">
                  <p className="text-sm text-white/80">Threads Removed</p>
                  <p className="text-2xl font-bold text-white">{result.deleted.threads}</p>
                </div>
                
                <div className="bg-white/10 p-3 rounded-lg">
                  <p className="text-sm text-white/80">Stitches Removed</p>
                  <p className="text-2xl font-bold text-white">{result.deleted.stitches}</p>
                </div>
                
                <div className="bg-white/10 p-3 rounded-lg">
                  <p className="text-sm text-white/80">Mappings Removed</p>
                  <p className="text-2xl font-bold text-white">{result.deleted.mappings}</p>
                </div>
                
                <div className="bg-white/10 p-3 rounded-lg">
                  <p className="text-sm text-white/80">Progress Records Removed</p>
                  <p className="text-2xl font-bold text-white">{result.deleted.progress}</p>
                </div>
              </div>
              
              <div className="mt-4 text-center">
                <button
                  onClick={() => router.push('/tube-diagnostic')}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg"
                >
                  Go to Tube Diagnostic
                </button>
              </div>
            </div>
          )}
          
          <div className="mt-6 p-4 bg-blue-900/20 rounded-lg border border-blue-500/20">
            <h3 className="font-medium text-blue-400 mb-2">Next Steps</h3>
            <p className="text-white/80 text-sm">
              After cleaning up test data, use the Tube Diagnostic tool to verify that your tube integrity is correct. 
              The diagnostic tool will show exactly one ready stitch per tube when your database is properly set up.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}