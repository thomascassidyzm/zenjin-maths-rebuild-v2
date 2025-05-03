import React, { useState } from 'react';
import Head from 'next/head';

// SQL scripts
const DELETE_TEST_THREAD_SQL = `
-- Delete the test thread and all associated stitches
-- First, check if the thread exists
SELECT * FROM threads WHERE id = 'test-thread';

-- Delete any user progress or positions associated with this thread
DELETE FROM user_stitch_progress WHERE thread_id = 'test-thread';
DELETE FROM user_tube_position WHERE thread_id = 'test-thread';

-- Delete any stitches associated with this thread
DELETE FROM stitches WHERE thread_id = 'test-thread';

-- Finally delete the thread itself
DELETE FROM threads WHERE id = 'test-thread';

-- Verify the thread is gone
SELECT * FROM threads WHERE id = 'test-thread';
`;

export default function RunSQL() {
  const [adminKey, setAdminKey] = useState('');
  const [sql, setSql] = useState(DELETE_TEST_THREAD_SQL);
  const [operation, setOperation] = useState('delete-test-thread');
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeSQL = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminKey) {
      setError('Admin key is required');
      return;
    }
    
    if (!sql.trim()) {
      setError('SQL query is required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/execute-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ sql, operation })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute SQL');
      }
      
      setResult(data);
    } catch (err) {
      console.error('Error executing SQL:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  const selectPredefinedSQL = (type: string) => {
    switch (type) {
      case 'delete-test-thread':
        setSql(DELETE_TEST_THREAD_SQL);
        setOperation('delete-test-thread');
        break;
      default:
        setSql('');
        setOperation('custom');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Database Maintenance</title>
      </Head>
      
      <h1 className="text-3xl font-bold mb-6">Database Maintenance</h1>
      
      <div className="mb-8 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
        <h2 className="text-xl font-bold text-yellow-800 mb-2">⚠️ Warning</h2>
        <p className="text-yellow-800">
          This tool executes SQL directly against the database. 
          Incorrect usage can result in data loss. Use with extreme caution.
        </p>
      </div>
      
      <form onSubmit={executeSQL} className="mb-8">
        <div className="mb-4">
          <label htmlFor="adminKey" className="block text-sm font-medium mb-1">
            Admin Key
          </label>
          <input
            type="password"
            id="adminKey"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="predefinedSQL" className="block text-sm font-medium mb-1">
            Predefined SQL Operations
          </label>
          <select
            id="predefinedSQL"
            onChange={(e) => selectPredefinedSQL(e.target.value)}
            value={operation}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="delete-test-thread">Delete Test Thread</option>
            <option value="custom">Custom SQL</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label htmlFor="sql" className="block text-sm font-medium mb-1">
            SQL Query
          </label>
          <textarea
            id="sql"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md font-mono text-sm h-64"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className={`px-4 py-2 rounded-md text-white ${
            isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Executing...' : 'Execute SQL'}
        </button>
      </form>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg">
          <h3 className="text-lg font-bold text-red-800 mb-1">Error</h3>
          <p className="text-red-800">{error}</p>
        </div>
      )}
      
      {result && (
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-2">Result</h3>
          <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg overflow-auto">
            <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}