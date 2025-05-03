import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { createClient } from '../lib/supabase/client';

// Create a client-side Supabase client
const supabase = createClient();

export default function AuthTest() {
  const { user, isAuthenticated, loading, signInWithEmail, verifyCode, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');
  const [databaseTest, setDatabaseTest] = useState<any>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<any>(null);
  
  // Handle sign in with email
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginMessage('Sending verification code...');
    
    const result = await signInWithEmail(email);
    
    if (result.success) {
      setVerificationSent(true);
      setLoginMessage('Verification code sent! Check your email.');
    } else {
      setLoginMessage(`Error: ${result.error?.message || 'Failed to send verification code'}`);
    }
  };
  
  // Handle verification code submission
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginMessage('Verifying code...');
    
    const result = await verifyCode(code);
    
    if (result.success) {
      setLoginMessage('Verification successful!');
      setVerificationSent(false);
      setCode('');
    } else {
      setLoginMessage(`Error: ${result.error?.message || 'Invalid verification code'}`);
    }
  };
  
  // Handle sign out
  const handleSignOut = async () => {
    setLoginMessage('Signing out...');
    await signOut();
    setLoginMessage('Signed out successfully');
  };
  
  // Test direct database access
  const testDatabase = async () => {
    try {
      // Test if we can fetch from the threads table
      const { data, error } = await supabase
        .from('threads')
        .select('*')
        .limit(1);
        
      if (error) {
        throw error;
      }
      
      setDatabaseTest({
        success: true,
        message: 'Database connection successful!',
        data
      });
    } catch (error: any) {
      setDatabaseTest({
        success: false,
        message: `Database error: ${error.message || 'Unknown error'}`,
        error
      });
    }
  };
  
  // Test API access with authentication
  const testApi = async () => {
    setIsTestingApi(true);
    setApiTestResult(null);
    
    try {
      // Attempt to fetch user stitches from API
      const response = await fetch('/api/user-stitches?prefetch=2');
      const result = await response.json();
      
      setApiTestResult({
        success: response.ok,
        status: response.status,
        message: response.ok ? 'API connection successful!' : 'API request failed',
        data: result
      });
    } catch (error: any) {
      setApiTestResult({
        success: false,
        message: `API error: ${error.message || 'Unknown error'}`,
        error: String(error)
      });
    } finally {
      setIsTestingApi(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Authentication Test Page</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">Auth Status</h2>
        <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
        <p><strong>Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
        {user && (
          <div className="mt-2">
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Email:</strong> {user.email || 'Not available'}</p>
          </div>
        )}
      </div>
      
      {!isAuthenticated ? (
        !verificationSent ? (
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Sign In</h2>
            <form onSubmit={handleSignIn}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2" htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
              >
                Send Verification Code
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Verify Code</h2>
            <form onSubmit={handleVerify}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2" htmlFor="code">
                  Verification Code
                </label>
                <input
                  id="code"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter code from email"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600"
              >
                Verify Code
              </button>
              <button
                type="button"
                className="w-full mt-2 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                onClick={() => setVerificationSent(false)}
              >
                Back to Email
              </button>
            </form>
          </div>
        )
      ) : (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Signed In</h2>
          <p className="mb-4">You are signed in as {user?.email}.</p>
          <button
            onClick={handleSignOut}
            className="w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600"
          >
            Sign Out
          </button>
        </div>
      )}
      
      {loginMessage && (
        <div className={`p-4 mb-6 rounded-md ${
          loginMessage.startsWith('Error') 
            ? 'bg-red-100 text-red-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {loginMessage}
        </div>
      )}
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Database Connection Test</h2>
        <p className="mb-4">Test direct database access using the Supabase client.</p>
        <button
          onClick={testDatabase}
          className="w-full bg-purple-500 text-white py-2 px-4 rounded-md hover:bg-purple-600 mb-4"
        >
          Test Database
        </button>
        
        {databaseTest && (
          <div className={`p-4 rounded-md ${
            databaseTest.success ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <p className={databaseTest.success ? 'text-green-700' : 'text-red-700'}>
              {databaseTest.message}
            </p>
            {databaseTest.success && databaseTest.data && (
              <pre className="bg-gray-50 p-2 mt-2 overflow-auto text-xs">
                {JSON.stringify(databaseTest.data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">API Connection Test</h2>
        <p className="mb-4">Test API access with authentication cookies.</p>
        <button
          onClick={testApi}
          className="w-full bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-600 mb-4"
          disabled={isTestingApi}
        >
          {isTestingApi ? 'Testing...' : 'Test API'}
        </button>
        
        {apiTestResult && (
          <div className={`p-4 rounded-md ${
            apiTestResult.success ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <p className={apiTestResult.success ? 'text-green-700' : 'text-red-700'}>
              {apiTestResult.message}
            </p>
            <p className="text-gray-700">Status: {apiTestResult.status}</p>
            {apiTestResult.data && (
              <pre className="bg-gray-50 p-2 mt-2 overflow-auto text-xs max-h-64">
                {JSON.stringify(apiTestResult.data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}