import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function FixTubeSchema() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Function to add the tube_number column to threads table
  const fixSchema = async () => {
    try {
      setIsLoading(true);
      setResult(null);
      setError(null);

      // Call the fix-schema API
      const response = await fetch('/api/fix-schema', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fix schema');
      }

      setResult(data);
      console.log('Schema fix result:', data);
    } catch (err) {
      console.error('Error fixing schema:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to directly add tube_number column
  const directAddTubeColumn = async () => {
    try {
      setIsLoading(true);
      setResult(null);
      setError(null);

      // Call the direct-sql API to add tube_number column
      const response = await fetch('/api/direct-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql: `
            -- Add tube_number column if it doesn't exist
            DO $$ 
            BEGIN
              IF NOT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'threads' 
                AND column_name = 'tube_number'
              ) THEN
                ALTER TABLE public.threads 
                ADD COLUMN tube_number INTEGER DEFAULT 1;
                
                -- Set tube numbers based on thread ID patterns
                UPDATE public.threads
                SET tube_number = 
                  CASE 
                    WHEN id LIKE '%A%' THEN 1
                    WHEN id LIKE '%B%' THEN 2
                    WHEN id LIKE '%C%' THEN 3
                    WHEN id LIKE '%D%' THEN 1
                    WHEN id LIKE '%E%' THEN 2
                    WHEN id LIKE '%F%' THEN 3
                    ELSE 1
                  END;
                  
                RAISE NOTICE 'Added tube_number column and set default values';
              ELSE
                RAISE NOTICE 'tube_number column already exists';
              END IF;
            END $$;
          `
        }),
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add tube_number column');
      }

      setResult({
        success: true,
        message: 'Direct SQL executed successfully to add tube_number column',
        details: data
      });
      console.log('Direct SQL result:', data);
    } catch (err) {
      console.error('Error executing direct SQL:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen player-bg flex items-center justify-center p-4">
      <Head>
        <title>Fix Tube Schema - Zenjin Player</title>
      </Head>

      <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Fix Tube Schema</h1>

        <div className="mb-8 text-white text-opacity-90">
          <p className="mb-4">
            This utility adds the <code className="bg-black/20 px-1 py-0.5 rounded">tube_number</code> column 
            to the threads table in the database. This is required for the new Tube Cycling feature to work correctly.
          </p>
          
          <div className="bg-black/30 p-4 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-2">What This Does:</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Adds a <code>tube_number</code> column to the threads table (if it doesn't exist)</li>
              <li>Sets tube numbers based on thread ID patterns (A→1, B→2, C→3, D→1, E→2, F→3)</li>
              <li>Ensures all threads have an assigned tube number for proper tube cycling</li>
            </ul>
          </div>
          
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 mb-8">
            <button
              onClick={fixSchema}
              disabled={isLoading}
              className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              {isLoading ? 'Processing...' : 'Fix Schema (Standard Method)'}
            </button>
            
            <button
              onClick={directAddTubeColumn}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              {isLoading ? 'Processing...' : 'Fix Schema (Direct SQL Method)'}
            </button>
          </div>
        </div>

        {/* Result display */}
        {result && (
          <div className={`mb-6 p-4 rounded-lg ${result.success ? 'bg-green-500/20 border border-green-300/30' : 'bg-red-500/20 border border-red-300/30'}`}>
            <h3 className="font-bold text-lg text-white mb-2">
              {result.success ? '✅ Success' : '❌ Error'}
            </h3>
            <p className="text-white text-opacity-90 mb-2">{result.message}</p>
            
            {result.fixes && result.fixes.length > 0 && (
              <div className="mt-2">
                <p className="text-white font-semibold">Changes made:</p>
                <ul className="list-disc pl-5 text-sm text-white text-opacity-80">
                  {result.fixes.map((fix: string, index: number) => (
                    <li key={index}>{fix}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-300/30 text-red-100 rounded-lg p-4">
            <h3 className="font-bold mb-2">Error</h3>
            <p>{error}</p>
          </div>
        )}

        <div className="flex justify-center space-x-4">
          <Link 
            href="/sequential-player"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Try Player
          </Link>
          
          <Link 
            href="/"
            className="bg-white bg-opacity-10 hover:bg-opacity-20 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}