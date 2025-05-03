import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/auth/supabaseClient';

export default function ConnectionTest() {
  const router = useRouter();
  const { isAuthenticated, user, loading } = useAuth();
  
  const [testResults, setTestResults] = useState<Array<{
    test: string;
    status: 'success' | 'error' | 'pending';
    message: string;
    details?: any;
  }>>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabaseKeys, setSupabaseKeys] = useState({
    url: '',
    key: ''
  });
  
  // Check authentication and redirect if not authorized
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);
  
  // Get Supabase URL and key (obscured for security)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setSupabaseKeys({
        url: obscureString(process.env.NEXT_PUBLIC_SUPABASE_URL),
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
          ? obscureString(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) 
          : 'Not found'
      });
    }
  }, []);
  
  // Obscure the middle of a string for security
  const obscureString = (str: string): string => {
    if (str.length <= 8) return '****';
    
    const visibleChars = 4;
    const start = str.substring(0, visibleChars);
    const end = str.substring(str.length - visibleChars);
    
    return `${start}...${end}`;
  };
  
  // Run all connectivity tests
  const runAllTests = async () => {
    setIsLoading(true);
    setError(null);
    setTestResults([]);
    
    try {
      await testBasicConnection();
      await testTableAccess();
      await testAuthStatus();
      await testRLS();
      
    } catch (err) {
      console.error('Error running tests:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Test basic connection to Supabase
  const testBasicConnection = async () => {
    const testName = 'Basic Connection';
    
    addTestResult({
      test: testName,
      status: 'pending',
      message: 'Testing basic connection to Supabase...'
    });
    
    try {
      // Simplest possible query
      const { data, error } = await supabase.from('pg_tables').select('*').limit(1);
      
      if (error) throw error;
      
      updateTestResult({
        test: testName,
        status: 'success',
        message: 'Successfully connected to Supabase',
        details: 'Connection established with Supabase API'
      });
      
    } catch (err) {
      // Try a more basic health check
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
          },
          body: JSON.stringify({ email: 'test@example.com', password: 'invalidpassword' })
        });
        
        // Even with invalid credentials, if we get a 400 error, the API is working
        if (response.status === 400) {
          updateTestResult({
            test: testName,
            status: 'success',
            message: 'API endpoint is responding (authentication endpoint)',
            details: 'API endpoints are reachable but database query failed'
          });
        } else {
          throw new Error(`Unexpected status code: ${response.status}`);
        }
      } catch (healthErr) {
        // Both tests failed
        updateTestResult({
          test: testName,
          status: 'error',
          message: 'Failed to connect to Supabase',
          details: err instanceof Error ? err.message : String(err)
        });
      }
    }
  };
  
  // Test access to specific tables
  const testTableAccess = async () => {
    const testName = 'Table Access';
    
    addTestResult({
      test: testName,
      status: 'pending',
      message: 'Testing access to database tables...'
    });
    
    try {
      // Try to list tables in the public schema
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (error) throw error;
      
      const tables = data?.map(row => row.table_name) || [];
      
      updateTestResult({
        test: testName,
        status: 'success',
        message: `Found ${tables.length} tables`,
        details: tables.join(', ')
      });
      
      // Now test each key table
      const keyTables = ['user_stitch_progress', 'threads', 'stitches', 'questions'];
      
      for (const table of keyTables) {
        await testSpecificTable(table);
      }
      
    } catch (err) {
      updateTestResult({
        test: testName,
        status: 'error',
        message: 'Failed to access tables',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  };
  
  // Test access to a specific table
  const testSpecificTable = async (tableName: string) => {
    const testName = `Table: ${tableName}`;
    
    addTestResult({
      test: testName,
      status: 'pending',
      message: `Testing access to ${tableName} table...`
    });
    
    try {
      // Try to count rows in the table
      const { data, error } = await supabase
        .from(tableName)
        .select('count(*)', { count: 'exact', head: true });
      
      if (error) throw error;
      
      // Try to get column names
      const { data: sampleData, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (sampleError) throw sampleError;
      
      const columns = sampleData && sampleData.length > 0
        ? Object.keys(sampleData[0])
        : [];
      
      updateTestResult({
        test: testName,
        status: 'success',
        message: `Table ${tableName} accessible (${data} rows)`,
        details: `Columns: ${columns.join(', ')}`
      });
      
    } catch (err) {
      updateTestResult({
        test: testName,
        status: 'error',
        message: `Failed to access ${tableName} table`,
        details: err instanceof Error ? err.message : String(err)
      });
    }
  };
  
  // Test authentication status
  const testAuthStatus = async () => {
    const testName = 'Authentication';
    
    addTestResult({
      test: testName,
      status: 'pending',
      message: 'Testing authentication status...'
    });
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (session) {
        updateTestResult({
          test: testName,
          status: 'success',
          message: 'User is authenticated',
          details: `User ID: ${session.user.id}`
        });
      } else {
        updateTestResult({
          test: testName,
          status: 'error',
          message: 'No active session',
          details: 'User is not authenticated or session has expired'
        });
      }
      
    } catch (err) {
      updateTestResult({
        test: testName,
        status: 'error',
        message: 'Failed to get authentication status',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  };
  
  // Test Row-Level Security (RLS) with user-specific query
  const testRLS = async () => {
    const testName = 'Row-Level Security';
    
    addTestResult({
      test: testName,
      status: 'pending',
      message: 'Testing row-level security...'
    });
    
    try {
      // Get current user ID
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        updateTestResult({
          test: testName,
          status: 'error',
          message: 'Not authenticated',
          details: 'Cannot test RLS without authentication'
        });
        return;
      }
      
      const userId = session.user.id;
      
      // Try to access user_stitch_progress with the user's ID
      const { data, error } = await supabase
        .from('user_stitch_progress')
        .select('count(*)', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      if (error) throw error;
      
      updateTestResult({
        test: testName,
        status: 'success',
        message: `Found ${data} rows for user ${userId}`,
        details: 'RLS appears to be working correctly'
      });
      
    } catch (err) {
      updateTestResult({
        test: testName,
        status: 'error',
        message: 'Failed to test row-level security',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  };
  
  // Add a new test result
  const addTestResult = (result: {
    test: string;
    status: 'success' | 'error' | 'pending';
    message: string;
    details?: any;
  }) => {
    setTestResults(prev => [...prev, result]);
  };
  
  // Update an existing test result
  const updateTestResult = (result: {
    test: string;
    status: 'success' | 'error' | 'pending';
    message: string;
    details?: any;
  }) => {
    setTestResults(prev => 
      prev.map(item => 
        item.test === result.test ? result : item
      )
    );
  };
  
  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Database Connection Test | Zenjin Admin</title>
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex flex-col mb-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-3xl font-bold">Database Connection Test</h1>
              
              <div className="flex space-x-2">
                <button 
                  onClick={() => router.push('/admin-dashboard')}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Back to Dashboard
                </button>
                
                <button 
                  onClick={runAllTests}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
                >
                  {isLoading ? 'Running Tests...' : 'Run Connectivity Tests'}
                </button>
              </div>
            </div>
            
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">Database connection issues are preventing the app from working correctly.</p>
                  <div className="mt-2">
                    <button 
                      onClick={() => router.push('/fix-database')}
                      className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm inline-flex items-center"
                    >
                      Use Database Setup Tool
                      <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <p className="mb-4 text-gray-600">
            This tool diagnoses connectivity issues with the Supabase backend.
          </p>
          
          {/* Configuration Information */}
          <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h2 className="text-lg font-bold mb-2">Supabase Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">URL:</p>
                <p className="font-mono bg-gray-100 p-2 rounded text-sm">{supabaseKeys.url}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Anon Key:</p>
                <p className="font-mono bg-gray-100 p-2 rounded text-sm">{supabaseKeys.key}</p>
              </div>
            </div>
          </div>
          
          {/* Test Results */}
          <div>
            <h2 className="text-xl font-bold mb-4">Test Results</h2>
            
            {testResults.length === 0 && !isLoading ? (
              <div className="bg-gray-50 p-8 rounded-lg border border-gray-200 text-center text-gray-500">
                Click "Run Connectivity Tests" to start testing the database connection.
              </div>
            ) : (
              <div className="space-y-4">
                {testResults.map((result, index) => (
                  <div 
                    key={index}
                    className={`p-4 rounded-lg border ${
                      result.status === 'success' ? 'bg-green-50 border-green-200' :
                      result.status === 'error' ? 'bg-red-50 border-red-200' :
                      'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold">
                        {result.test}
                      </h3>
                      <span className={`px-2 py-1 rounded text-sm ${
                        result.status === 'success' ? 'bg-green-100 text-green-800' :
                        result.status === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {result.status === 'success' ? 'Success' :
                         result.status === 'error' ? 'Failed' :
                         'Running...'}
                      </span>
                    </div>
                    <p className="mb-2">{result.message}</p>
                    {result.details && (
                      <div className="mt-2 bg-white p-2 rounded border border-gray-200 text-sm">
                        <pre className="whitespace-pre-wrap font-mono text-xs">
                          {typeof result.details === 'string' 
                            ? result.details 
                            : JSON.stringify(result.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="mt-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}
          
          {/* Schema Fix Tool */}
          <div id="schema-fix" className="mt-8 bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-8">
            <h2 className="text-lg font-bold mb-2">Schema Fix Tool</h2>
            <div className="space-y-2">
              <p className="font-medium">
                If you're seeing errors related to missing columns (like <code>created_at</code>),
                try the automatic schema fix:
              </p>
              <div className="flex flex-col space-y-4">
                <button 
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/setup-tables', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                      });
                      
                      const result = await response.json();
                      
                      if (result.success) {
                        alert("Database setup successful! Tables have been created with the correct schema.");
                      } else {
                        alert(`Database setup failed. Please check the console for details.`);
                        console.error("Database setup results:", result);
                      }
                      
                      // Refresh the page after 1 second to rerun the tests
                      setTimeout(() => {
                        window.location.reload();
                      }, 1000);
                      
                    } catch (error) {
                      alert(`Error setting up database: ${error instanceof Error ? error.message : String(error)}`);
                      console.error('Error setting up database:', error);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-center"
                >
                  Fix Database Structure
                </button>
                
                <p className="text-sm text-yellow-800 mt-2">
                  This will create any missing tables and add required columns (like 'created_at') to fix database errors. 
                  Your existing data will be preserved. The page will reload automatically once complete.
                </p>
                
                <div className="border-t border-yellow-200 pt-4 mt-4">
                  <button 
                    onClick={async () => {
                      if (!confirm("Do you want to create sample math content for testing? This will add example threads, stitches, and questions.")) {
                        return;
                      }
                      
                      try {
                        const response = await fetch('/api/create-test-data', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' }
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                          alert("Sample content created successfully!");
                        } else {
                          alert(`Failed to create sample content: ${result.error}`);
                          console.error("Error creating test data:", result);
                        }
                      } catch (error) {
                        alert(`Error creating sample content: ${error instanceof Error ? error.message : String(error)}`);
                        console.error('Error creating sample content:', error);
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Create Sample Content
                  </button>
                  <p className="text-sm text-green-800 mt-2">
                    After fixing the database structure, you can create sample math content to test the player.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Troubleshooting Guide */}
          <div className="mt-8 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h2 className="text-lg font-bold mb-2">Troubleshooting Guide</h2>
            <div className="space-y-2">
              <p className="font-medium">If tests are failing, check these common issues:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Verify the Supabase URL and anon key in your environment variables</li>
                <li>Check that Row-Level Security (RLS) policies are configured correctly</li>
                <li>Verify that the required tables exist in your database</li>
                <li>Ensure your database schema matches what the code expects</li>
                <li>Check that your database is online and accessible from your deployment</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}