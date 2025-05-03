import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function AuthDebug() {
  const router = useRouter();
  const { 
    isAuthenticated, 
    user, 
    loading, 
    signOut, 
    signInWithEmail, 
    signInWithEmailAndPassword 
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Helper to add logs
  const addLog = (log: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]}: ${log}`]);
  };

  // Test password login
  const testPasswordLogin = async () => {
    try {
      addLog(`Testing password login with email: ${email}`);
      setMessage(null);

      if (!email || !password) {
        setMessage('Please enter both email and password');
        return;
      }

      addLog('Calling signInWithEmailAndPassword...');
      const result = await signInWithEmailAndPassword(email, password);
      
      if (result.success) {
        addLog('Password login successful!');
        setMessage('Password login successful!');
      } else {
        addLog(`Password login failed: ${JSON.stringify(result.error)}`);
        setMessage(`Password login failed: ${result.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`Exception during password login: ${errorMsg}`);
      setMessage(`Error: ${errorMsg}`);
    }
  };

  // Test OTP login (request only)
  const testOtpRequest = async () => {
    try {
      addLog(`Testing OTP request with email: ${email}`);
      setMessage(null);

      if (!email) {
        setMessage('Please enter an email address');
        return;
      }

      addLog('Calling signInWithEmail...');
      const result = await signInWithEmail(email);
      
      if (result.success) {
        addLog('OTP email sent successfully!');
        setMessage('OTP email sent successfully! Check your email for the verification code.');
      } else {
        addLog(`OTP request failed: ${JSON.stringify(result.error)}`);
        setMessage(`OTP request failed: ${result.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`Exception during OTP request: ${errorMsg}`);
      setMessage(`Error: ${errorMsg}`);
    }
  };

  // Check which auth methods are available
  const checkAvailableAuthMethods = () => {
    addLog('Checking available auth methods...');
    
    const methods = {
      signInWithEmail: typeof signInWithEmail === 'function',
      signInWithEmailAndPassword: typeof signInWithEmailAndPassword === 'function',
      verifyCode: 'verifyCode' in useAuth,
      signOut: typeof signOut === 'function'
    };
    
    addLog(`Auth methods available: ${JSON.stringify(methods)}`);
    setMessage(`Available auth methods: ${JSON.stringify(methods, null, 2)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600">Loading authentication state...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Authentication Debug</h1>
            <div className="flex space-x-4">
              <button
                onClick={() => router.push('/')}
                className="text-blue-500 hover:text-blue-700"
              >
                Home
              </button>
              <button
                onClick={() => router.push('/admin-dashboard')}
                className="text-blue-500 hover:text-blue-700"
              >
                Dashboard
              </button>
            </div>
          </div>

          {/* Authentication status */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h2 className="text-lg font-semibold mb-3">Authentication Status</h2>
            <p className="mb-2">
              <span className="font-medium">Status:</span>{' '}
              <span className={isAuthenticated ? 'text-green-600' : 'text-red-600'}>
                {isAuthenticated ? 'Authenticated' : 'Not authenticated'}
              </span>
            </p>
            {isAuthenticated && user && (
              <>
                <p className="mb-2">
                  <span className="font-medium">User ID:</span> {user.id}
                </p>
                <p className="mb-4">
                  <span className="font-medium">Email:</span> {user.email || 'No email'}
                </p>
                <button
                  onClick={signOut}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>

          {/* Auth methods check */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
            <h2 className="text-lg font-semibold text-blue-800 mb-3">Check Auth Methods</h2>
            <button
              onClick={checkAvailableAuthMethods}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
            >
              Check Available Auth Methods
            </button>
          </div>

          {/* Debug Login Form */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h2 className="text-lg font-semibold mb-3">Test Authentication</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Password"
                />
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={testPasswordLogin}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors"
                >
                  Test Password Login
                </button>
                
                <button
                  onClick={testOtpRequest}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded transition-colors"
                >
                  Test OTP Request
                </button>
              </div>
            </div>
          </div>

          {/* Message Box */}
          {message && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
              <h2 className="text-lg font-semibold text-blue-800 mb-2">Message</h2>
              <pre className="bg-white p-3 rounded overflow-auto text-sm">{message}</pre>
            </div>
          )}
          
          {/* Debug Logs */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-3 text-white flex justify-between">
              <span>Debug Logs</span>
              <button 
                onClick={() => setLogs([])}
                className="text-xs text-gray-400 hover:text-white"
              >
                Clear
              </button>
            </h2>
            <div className="bg-black rounded overflow-auto h-48 p-2">
              {logs.length === 0 ? (
                <p className="text-gray-500">No logs yet.</p>
              ) : (
                <div className="font-mono text-xs">
                  {logs.map((log, index) => (
                    <div key={index} className="text-green-400">{log}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}