import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../context/AuthContext';

// Import the SQL script as a string
const userStateTableSQL = `
-- Create table for authenticated user state
CREATE TABLE IF NOT EXISTS user_state (
  user_id TEXT PRIMARY KEY, -- Authenticated user ID
  state JSONB NOT NULL, -- JSON representation of the user state
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS user_state_user_id_idx ON user_state(user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update timestamp automatically
DROP TRIGGER IF EXISTS update_user_state_timestamp ON user_state;
CREATE TRIGGER update_user_state_timestamp
BEFORE UPDATE ON user_state
FOR EACH ROW
EXECUTE FUNCTION update_user_state_timestamp();

-- Add RLS (Row Level Security) policies
ALTER TABLE user_state ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own state
CREATE POLICY "Users can read their own state" ON user_state
  FOR SELECT USING (
    auth.uid()::text = user_id
  );

-- Allow users to update their own state
CREATE POLICY "Users can update their own state" ON user_state
  FOR UPDATE USING (
    auth.uid()::text = user_id
  );

-- Allow users to insert their own state
CREATE POLICY "Users can insert their own state" ON user_state
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id
  );

-- Create policy to allow service role/admin access
CREATE POLICY "Service role can access all user state" 
ON user_state 
FOR ALL 
USING (true);
`;

const anonymousStateTableSQL = `
-- Create table for anonymous user state
CREATE TABLE IF NOT EXISTS anonymous_user_state (
  id TEXT PRIMARY KEY, -- Anonymous user ID (e.g. anonymous-1234)
  state JSONB NOT NULL, -- JSON representation of the user state
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS anonymous_user_state_id_idx ON anonymous_user_state(id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_anonymous_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update timestamp automatically
DROP TRIGGER IF EXISTS update_anonymous_state_timestamp ON anonymous_user_state;
CREATE TRIGGER update_anonymous_state_timestamp
BEFORE UPDATE ON anonymous_user_state
FOR EACH ROW
EXECUTE FUNCTION update_anonymous_state_timestamp();

-- Add RLS (Row Level Security) policy
ALTER TABLE anonymous_user_state ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous access via server-side API
CREATE POLICY anon_state_api_policy 
ON anonymous_user_state 
FOR ALL 
USING (true);
`;

export default function FixDatabase() {
  const router = useRouter();
  const { isAuthenticated, user, loading } = useAuth();
  
  const [logs, setLogs] = useState<Array<{message: string; level: 'info' | 'success' | 'error' | 'warning'}>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showTables, setShowTables] = useState<string[]>([]);
  const [fixAttempted, setFixAttempted] = useState(false);
  const [testResults, setTestResults] = useState<{[key: string]: boolean}>({});
  const [showScript, setShowScript] = useState(false);
  
  // Function to add a log message
  const addLog = (message: string, level: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => [...prev, { message, level }]);
  };
  
  // Function to scroll logs to bottom
  const scrollToBottom = () => {
    const logsContainer = document.getElementById('logs-container');
    if (logsContainer) {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }
  };
  
  // Auto-scroll logs
  useEffect(() => {
    scrollToBottom();
  }, [logs]);
  
  // Check existing tables
  const checkTables = async () => {
    try {
      addLog('Checking existing database tables...', 'info');
      setIsRunning(true);
      
      // Create client with admin credentials - note this requires SUPABASE_SERVICE_ROLE_KEY to be set
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      );
      
      // List all tables in the database
      const { data, error } = await supabaseAdmin
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');
      
      if (error) {
        addLog(`Error listing tables: ${error.message}`, 'error');
        return { hasUserState: false, hasAnonymousState: false };
      }
      
      // Extract table names
      const tables = data?.map(row => row.tablename) || [];
      setShowTables(tables);
      
      const hasUserState = tables.includes('user_state');
      const hasAnonymousState = tables.includes('anonymous_user_state');
      
      if (hasUserState) {
        addLog('✅ user_state table already exists', 'success');
      } else {
        addLog('❌ user_state table is missing', 'warning');
      }
      
      if (hasAnonymousState) {
        addLog('✅ anonymous_user_state table already exists', 'success');
      } else {
        addLog('❌ anonymous_user_state table is missing', 'warning');
      }
      
      return { hasUserState, hasAnonymousState };
    } catch (err) {
      addLog(`Error checking tables: ${err instanceof Error ? err.message : String(err)}`, 'error');
      return { hasUserState: false, hasAnonymousState: false };
    } finally {
      setIsRunning(false);
    }
  };
  
  // Execute SQL directly
  const executeSql = async (sql: string, description: string) => {
    try {
      addLog(`Executing SQL: ${description}...`, 'info');
      
      // Create client with admin credentials
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      );
      
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
      
      if (error) {
        addLog(`Error executing SQL: ${error.message}`, 'error');
        return false;
      }
      
      addLog(`✅ Successfully executed: ${description}`, 'success');
      return true;
    } catch (err) {
      addLog(`Error executing SQL: ${err instanceof Error ? err.message : String(err)}`, 'error');
      return false;
    }
  };
  
  // Fix missing tables
  const fixTables = async () => {
    try {
      addLog('Starting database fix...', 'info');
      setIsRunning(true);
      
      // Check existing tables first
      const { hasUserState, hasAnonymousState } = await checkTables() || { hasUserState: false, hasAnonymousState: false };
      
      // Fix user_state table if missing
      if (!hasUserState) {
        addLog('Creating user_state table...', 'info');
        await executeSql(userStateTableSQL, 'Create user_state table');
      }
      
      // Fix anonymous_user_state table if missing
      if (!hasAnonymousState) {
        addLog('Creating anonymous_user_state table...', 'info');
        await executeSql(anonymousStateTableSQL, 'Create anonymous_user_state table');
      }
      
      setFixAttempted(true);
      
      // Verify the fix by checking tables again
      await checkTables();
      
    } catch (err) {
      addLog(`Error fixing database: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };
  
  // Run database diagnostic and attempt fixes
  const runDiagnostic = async () => {
    try {
      addLog('Running full database diagnostic...', 'info');
      setIsRunning(true);
      
      // Check if tables exist
      const { hasUserState, hasAnonymousState } = await checkTables() || 
        { hasUserState: false, hasAnonymousState: false };
      
      // If tables are missing, attempt to fix them
      if (!hasUserState || !hasAnonymousState) {
        addLog('Missing tables detected. Attempting to fix...', 'warning');
        await fixTables();
      }
      
      // Test API endpoints
      await testAPI();
      
    } catch (err) {
      addLog(`Error running diagnostic: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };
  
  // Test API endpoints
  const testAPI = async () => {
    try {
      addLog('Testing API endpoints...', 'info');
      setIsRunning(true);
      
      const results: {[key: string]: boolean} = {};
      
      // Test the API endpoints
      if (user && isAuthenticated) {
        // 1. Test GET on user-state API
        try {
          addLog(`Testing GET /api/user-state for user ${user.id.slice(0, 8)}...`, 'info');
          
          const getResponse = await fetch(`/api/user-state?userId=${encodeURIComponent(user.id)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });
          
          // Success is either 200 (state found) or 404 (not found yet)
          if (getResponse.ok || getResponse.status === 404) {
            addLog(`✅ GET /api/user-state working: ${getResponse.status}`, 'success');
            results.getUserState = true;
          } else {
            addLog(`❌ GET /api/user-state failed: ${getResponse.status}`, 'error');
            const errorData = await getResponse.json();
            addLog(`Error details: ${JSON.stringify(errorData)}`, 'error');
            results.getUserState = false;
          }
        } catch (getError) {
          addLog(`Error testing GET /api/user-state: ${getError instanceof Error ? getError.message : String(getError)}`, 'error');
          results.getUserState = false;
        }
        
        // 2. Test POST on update-state API
        try {
          addLog(`Testing POST /api/update-state for user ${user.id.slice(0, 8)}...`, 'info');
          
          const testState = {
            userId: user.id,
            tubes: {
              1: { threadId: 'test-thread', currentStitchId: 'test-stitch', position: 0 },
              2: { threadId: '', currentStitchId: '', position: 0 },
              3: { threadId: '', currentStitchId: '', position: 0 }
            },
            activeTube: 1,
            cycleCount: 0,
            points: { session: 0, lifetime: 0 },
            lastUpdated: new Date().toISOString()
          };
          
          const postResponse = await fetch('/api/update-state', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ state: testState }),
            credentials: 'include'
          });
          
          if (postResponse.ok) {
            addLog('✅ POST /api/update-state working', 'success');
            results.updateState = true;
          } else {
            addLog(`❌ POST /api/update-state failed: ${postResponse.status}`, 'error');
            const errorData = await postResponse.json();
            addLog(`Error details: ${JSON.stringify(errorData)}`, 'error');
            results.updateState = false;
          }
        } catch (postError) {
          addLog(`Error testing POST /api/update-state: ${postError instanceof Error ? postError.message : String(postError)}`, 'error');
          results.updateState = false;
        }
      } else {
        // Test with anonymous user
        const anonymousId = `anonymous-test-${Date.now()}`;
        
        // 1. Test GET on anonymous-state API
        try {
          addLog(`Testing GET /api/anonymous-state for ID ${anonymousId}...`, 'info');
          
          const getResponse = await fetch(`/api/anonymous-state?id=${encodeURIComponent(anonymousId)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          // Success is either 200 (state found) or 404 (not found yet)
          if (getResponse.ok || getResponse.status === 404) {
            addLog(`✅ GET /api/anonymous-state working: ${getResponse.status}`, 'success');
            results.getAnonymousState = true;
          } else {
            addLog(`❌ GET /api/anonymous-state failed: ${getResponse.status}`, 'error');
            const errorData = await getResponse.json();
            addLog(`Error details: ${JSON.stringify(errorData)}`, 'error');
            results.getAnonymousState = false;
          }
        } catch (getError) {
          addLog(`Error testing GET /api/anonymous-state: ${getError instanceof Error ? getError.message : String(getError)}`, 'error');
          results.getAnonymousState = false;
        }
        
        // 2. Test POST on anonymous-state API
        try {
          addLog(`Testing POST /api/anonymous-state for ID ${anonymousId}...`, 'info');
          
          const testState = {
            userId: anonymousId,
            tubes: {
              1: { threadId: 'test-thread', currentStitchId: 'test-stitch', position: 0 },
              2: { threadId: '', currentStitchId: '', position: 0 },
              3: { threadId: '', currentStitchId: '', position: 0 }
            },
            activeTube: 1,
            cycleCount: 0,
            points: { session: 0, lifetime: 0 },
            lastUpdated: new Date().toISOString()
          };
          
          const postResponse = await fetch('/api/anonymous-state', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              state: testState,
              id: anonymousId
            })
          });
          
          if (postResponse.ok) {
            addLog('✅ POST /api/anonymous-state working', 'success');
            results.updateAnonymousState = true;
          } else {
            addLog(`❌ POST /api/anonymous-state failed: ${postResponse.status}`, 'error');
            const errorData = await postResponse.json();
            addLog(`Error details: ${JSON.stringify(errorData)}`, 'error');
            results.updateAnonymousState = false;
          }
        } catch (postError) {
          addLog(`Error testing POST /api/anonymous-state: ${postError instanceof Error ? postError.message : String(postError)}`, 'error');
          results.updateAnonymousState = false;
        }
      }
      
      setTestResults(results);
      
      // Final status
      const allSuccess = Object.values(results).every(Boolean);
      if (allSuccess) {
        addLog('✅ All API tests passed! The issue should be fixed.', 'success');
      } else {
        addLog('❌ Some API tests failed. See details above.', 'error');
      }
      
    } catch (err) {
      addLog(`Error testing API: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };
  
  // Copy SQL to clipboard
  const copySql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    addLog('SQL script copied to clipboard!', 'success');
  };
  
  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Fix Database | Better Player</title>
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Database Fix Tool</h1>
            
            <div className="flex space-x-2">
              <button 
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Back to Home
              </button>
            </div>
          </div>
          
          <p className="mb-4 text-gray-600">
            This tool fixes database issues causing the 500 errors with the player state persistence.
            It creates the required tables for state storage if they are missing.
          </p>
          
          {!isAuthenticated && !loading ? (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
              <p>Note: You are not authenticated. Some tests will use anonymous user state only.</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <p className="ml-4">Loading authentication status...</p>
            </div>
          ) : (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              <p>Authenticated as: {user?.email || user?.id}</p>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={checkTables}
              disabled={isRunning}
              className="px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300 flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M15 5a1 1 0 00-1-1H6a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V5zm-2 2H7v6h6V7z" clipRule="evenodd" />
              </svg>
              Check Tables
            </button>
            
            <button
              onClick={fixTables}
              disabled={isRunning}
              className="px-4 py-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-green-300 flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 00-2 0v3.586L7.707 9.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
              </svg>
              Create Missing Tables
            </button>
            
            <button
              onClick={testAPI}
              disabled={isRunning}
              className="px-4 py-3 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-purple-300 flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clipRule="evenodd" />
              </svg>
              Test API Endpoints
            </button>
          </div>
          
          {/* Full Diagnostic Button */}
          <div className="mb-6">
            <button
              onClick={runDiagnostic}
              disabled={isRunning}
              className="w-full px-4 py-4 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Run Full Diagnostic & Fix
            </button>
          </div>
          
          {/* SQL Scripts */}
          <div className="mb-6">
            <button
              onClick={() => setShowScript(!showScript)}
              className="mb-4 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              {showScript ? 'Hide SQL Scripts' : 'Show SQL Scripts'}
            </button>
            
            {showScript && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold">user_state Table SQL</h3>
                    <button
                      onClick={() => copySql(userStateTableSQL)}
                      className="px-2 py-1 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="bg-gray-800 text-gray-200 p-3 rounded-lg overflow-auto max-h-64">
                    <pre className="whitespace-pre-wrap text-xs font-mono">{userStateTableSQL}</pre>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    This script creates the user_state table for authenticated users.
                  </p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold">anonymous_user_state Table SQL</h3>
                    <button
                      onClick={() => copySql(anonymousStateTableSQL)}
                      className="px-2 py-1 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="bg-gray-800 text-gray-200 p-3 rounded-lg overflow-auto max-h-64">
                    <pre className="whitespace-pre-wrap text-xs font-mono">{anonymousStateTableSQL}</pre>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    This script creates the anonymous_user_state table for non-authenticated users.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Existing Tables */}
          {showTables.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2">Database Tables</h2>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-medium mb-2">Existing Tables:</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {showTables.map((table, index) => (
                    <div key={index} className={`p-2 rounded-lg ${
                      table === 'user_state' || table === 'anonymous_user_state' 
                        ? 'bg-green-100 border border-green-200' 
                        : 'bg-gray-100 border border-gray-200'
                    }`}>
                      {table}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* API Test Results */}
          {Object.keys(testResults).length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2">API Test Results</h2>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(testResults).map(([endpoint, success], index) => (
                    <div key={index} className={`p-3 rounded-lg ${
                      success ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'
                    }`}>
                      <span className={success ? 'text-green-800' : 'text-red-800'}>
                        {success ? '✅ ' : '❌ '} {endpoint}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Logs */}
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-2">Operation Logs</h2>
            <div 
              id="logs-container"
              className="bg-black text-white p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto"
            >
              {logs.length > 0 ? (
                logs.map((log, index) => (
                  <div 
                    key={index} 
                    className={`py-1 ${
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warning' ? 'text-yellow-400' :
                      log.level === 'success' ? 'text-green-400' :
                      'text-gray-300'
                    }`}
                  >
                    {log.message}
                  </div>
                ))
              ) : (
                <div className="text-gray-500">No logs yet. Run operations to see results here.</div>
              )}
            </div>
          </div>
          
          {/* Status Summary and Next Steps */}
          {fixAttempted && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2">Status and Next Steps</h2>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-medium mb-2 text-blue-800">Database Fix Status:</h3>
                <p className="mb-2">
                  {showTables.includes('user_state') && showTables.includes('anonymous_user_state')
                    ? '✅ All necessary tables have been created.'
                    : '❌ Some tables may still be missing. See the logs for details.'}
                </p>
                
                <h3 className="font-medium mb-2 mt-4 text-blue-800">Next Steps:</h3>
                <ol className="list-decimal pl-5 space-y-1 text-blue-900">
                  <li>Click "Test API Endpoints" to verify the fix is working</li>
                  <li>If tests pass, return to the player page to test persistence</li>
                  <li>If issues persist, check the logs for specific errors to address</li>
                  <li>Try the <a href="/sequential-player" className="text-blue-600 underline">Sequential Player</a> to test the full experience</li>
                </ol>
              </div>
            </div>
          )}
          
          {/* Manual SQL Instructions for Supabase */}
          <div className="mt-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h2 className="text-lg font-bold mb-2">Manual SQL Execution in Supabase</h2>
            <p className="mb-4 text-gray-600">
              If the automatic fixes don't work, you can manually execute the SQL scripts in your Supabase dashboard:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-gray-700">
              <li>Log in to your <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Supabase Dashboard</a></li>
              <li>Select your project</li>
              <li>Navigate to the "SQL Editor" section</li>
              <li>Copy the SQL scripts above and paste them into the editor</li>
              <li>Click "Run" to execute the SQL</li>
              <li>Return to this page and click "Check Tables" to verify the tables were created</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}