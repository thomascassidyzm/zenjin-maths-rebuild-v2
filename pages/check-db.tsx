import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function CheckDatabase() {
  const router = useRouter();
  const [dbInfo, setDbInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkDb() {
      try {
        setIsLoading(true);
        
        console.log('Fetching database info...');
        const response = await fetch('/api/check-tables');
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch database info');
        }
        
        const data = await response.json();
        console.log('Database info:', data);
        setDbInfo(data);
        setError(null);
      } catch (err) {
        console.error('Error checking database:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    checkDb();
  }, []);

  // Render loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600">Checking database...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full">
          <h2 className="text-red-500 text-xl font-semibold mb-4">Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Database Tables</h1>
            <button
              onClick={() => router.push('/')}
              className="text-blue-500 hover:text-blue-700"
            >
              Return Home
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h2 className="text-lg font-semibold text-blue-800 mb-2">Tables Overview</h2>
              {dbInfo?.tables && (
                Array.isArray(dbInfo.tables) ? (
                  <div>
                    <p className="text-blue-800 mb-2">
                      Found {dbInfo.tables.length} tables in the database:
                    </p>
                    <ul className="list-disc list-inside">
                      {dbInfo.tables.map((table: string) => (
                        <li key={table} className="mb-1">
                          {table} 
                          {dbInfo.counts && dbInfo.counts[table] && (
                            <span className="text-gray-600 text-sm ml-2">
                              ({dbInfo.counts[table].count ?? 0} rows)
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-white rounded-lg shadow-sm">
                      <h3 className="font-semibold">threads table</h3>
                      <p>
                        Exists: <span className={dbInfo.tables.threads.exists ? "text-green-600" : "text-red-600"}>
                          {dbInfo.tables.threads.exists ? "Yes" : "No"}
                        </span>
                      </p>
                      {dbInfo.tables.threads.error && (
                        <p className="text-red-600 text-sm mt-1">{dbInfo.tables.threads.error}</p>
                      )}
                      {dbInfo.tables.threads.count !== undefined && (
                        <p className="text-gray-600 text-sm">Rows: {dbInfo.tables.threads.count}</p>
                      )}
                    </div>

                    <div className="p-3 bg-white rounded-lg shadow-sm">
                      <h3 className="font-semibold">stitches table</h3>
                      <p>
                        Exists: <span className={dbInfo.tables.stitches.exists ? "text-green-600" : "text-red-600"}>
                          {dbInfo.tables.stitches.exists ? "Yes" : "No"}
                        </span>
                      </p>
                      {dbInfo.tables.stitches.error && (
                        <p className="text-red-600 text-sm mt-1">{dbInfo.tables.stitches.error}</p>
                      )}
                      {dbInfo.tables.stitches.count !== undefined && (
                        <p className="text-gray-600 text-sm">Rows: {dbInfo.tables.stitches.count}</p>
                      )}
                    </div>

                    <div className="p-3 bg-white rounded-lg shadow-sm">
                      <h3 className="font-semibold">user_threads table</h3>
                      <p>
                        Exists: <span className={dbInfo.tables.user_threads.exists ? "text-green-600" : "text-red-600"}>
                          {dbInfo.tables.user_threads.exists ? "Yes" : "No"}
                        </span>
                      </p>
                      {dbInfo.tables.user_threads.error && (
                        <p className="text-red-600 text-sm mt-1">{dbInfo.tables.user_threads.error}</p>
                      )}
                      {dbInfo.tables.user_threads.count !== undefined && (
                        <p className="text-gray-600 text-sm">Rows: {dbInfo.tables.user_threads.count}</p>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-2">Raw Database Info</h2>
              <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto max-h-96">
                {JSON.stringify(dbInfo, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}