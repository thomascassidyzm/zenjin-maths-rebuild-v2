import { useState } from 'react';
import Head from 'next/head';

export default function FixStitchAdvancement() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [tubeNumber, setTubeNumber] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const testApi = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setResult(null);
      
      console.log(`Testing force-stitch-advancement API for userId=${userId}, tubeNumber=${tubeNumber}`);
      
      const response = await fetch('/api/force-stitch-advancement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tubeNumber })
      });
      
      const data = await response.json();
      console.log('API Response:', data);
      
      if (response.ok) {
        setResult(data);
      } else {
        setError(`API Error: ${data.error || response.statusText}`);
      }
    } catch (err) {
      console.error('Error testing API:', err);
      setError(`Exception: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-900 to-teal-700 p-6">
      <Head>
        <title>Fix Stitch Advancement Test</title>
      </Head>
      
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-center text-teal-800 mb-6">
          Test Force Stitch Advancement API
        </h1>
        
        <div className="grid gap-6 mb-6">
          <div>
            <label className="block text-gray-700 font-medium mb-2">User ID:</label>
            <input 
              type="text" 
              value={userId} 
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          
          <div>
            <label className="block text-gray-700 font-medium mb-2">Tube Number:</label>
            <select
              value={tubeNumber}
              onChange={(e) => setTubeNumber(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value={1}>Tube 1</option>
              <option value={2}>Tube 2</option>
              <option value={3}>Tube 3</option>
            </select>
          </div>
          
          <div>
            <button
              onClick={testApi}
              disabled={isLoading || !userId}
              className={`w-full px-4 py-3 text-white font-bold rounded-lg transition ${
                isLoading || !userId
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {isLoading ? 'Testing...' : 'Test API'}
            </button>
          </div>
          
          <div className="mt-4">
            <label className="block text-gray-700 font-medium mb-2">Get Current User ID:</label>
            <button
              onClick={() => {
                const authedUserId = localStorage.getItem('supabase.auth.token')
                  ? JSON.parse(localStorage.getItem('supabase.auth.token') || '{}')?.currentSession?.user?.id
                  : null;
                
                if (authedUserId) {
                  setUserId(authedUserId);
                  console.log('Found authenticated user ID:', authedUserId);
                } else {
                  console.log('No authenticated user found');
                  setError('No authenticated user found. Please log in first.');
                }
              }}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition"
            >
              Use Current User ID
            </button>
          </div>
        </div>
        
        {error && (
          <div className="p-4 mb-6 bg-red-100 border border-red-400 text-red-700 rounded">
            <h3 className="font-bold">Error:</h3>
            <p className="whitespace-pre-wrap">{error}</p>
          </div>
        )}
        
        {result && (
          <div className="p-4 mb-6 bg-green-100 border border-green-400 text-green-700 rounded">
            <h3 className="font-bold">Success!</h3>
            <div className="mt-2">
              <p><strong>Previous Stitch:</strong> {result.data.previousStitchId}</p>
              <p><strong>New Stitch:</strong> {result.data.newStitchId}</p>
              <p><strong>Thread:</strong> {result.data.threadId}</p>
              <p><strong>Tube:</strong> {result.data.tubeNumber}</p>
              <p><strong>Position Incremented:</strong> {result.data.positionIncremented ? 'Yes' : 'No'}</p>
            </div>
            <pre className="mt-4 p-3 bg-gray-100 rounded text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}