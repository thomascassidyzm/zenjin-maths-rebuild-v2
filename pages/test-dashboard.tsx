import React from 'react';
import Link from 'next/link';
import Head from 'next/head';

/**
 * Test Dashboard - Provides links to all testing tools and documentation
 */
const TestDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Test Dashboard | Zenjin Maths</title>
        <meta name="description" content="Testing tools for Zenjin Maths platform" />
      </Head>

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Test Dashboard</h1>
          <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
            Back to Home
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* State Persistence Tests */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-green-600 p-4">
              <h2 className="text-xl font-bold text-white">State Persistence</h2>
            </div>
            <div className="p-4">
              <p className="text-gray-600 mb-4">
                Test the state persistence mechanisms including localStorage, IndexedDB, and the TubeCyclerAdapter.
              </p>
              <Link
                href="/test-persistence" 
                className="block w-full bg-green-100 hover:bg-green-200 text-green-800 text-center py-2 px-4 rounded"
              >
                Run Persistence Tests
              </Link>
            </div>
          </div>

          {/* Content Loading Tests */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-blue-600 p-4">
              <h2 className="text-xl font-bold text-white">Content Loading</h2>
            </div>
            <div className="p-4">
              <p className="text-gray-600 mb-4">
                Test the content loading mechanisms including caching, prefetching, and background loading.
              </p>
              <Link
                href="/test-content-loading"
                className="block w-full bg-blue-100 hover:bg-blue-200 text-blue-800 text-center py-2 px-4 rounded"
              >
                Run Content Loading Tests
              </Link>
            </div>
          </div>

          {/* Tube Cycler Tests */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-purple-600 p-4">
              <h2 className="text-xl font-bold text-white">Tube Cycler</h2>
            </div>
            <div className="p-4">
              <p className="text-gray-600 mb-4">
                Test the tube cycling functionality and integration with the adapter pattern.
              </p>
              <Link
                href="/tube-diagnostic"
                className="block w-full bg-purple-100 hover:bg-purple-200 text-purple-800 text-center py-2 px-4 rounded"
              >
                Run Tube Diagnostic
              </Link>
            </div>
          </div>

          {/* Tube Simulator */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-yellow-600 p-4">
              <h2 className="text-xl font-bold text-white">Tube Simulator</h2>
            </div>
            <div className="p-4">
              <p className="text-gray-600 mb-4">
                Interactive simulator for tube cycling and spaced repetition algorithm.
              </p>
              <Link
                href="/tube-simulator"
                className="block w-full bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-center py-2 px-4 rounded"
              >
                Launch Tube Simulator
              </Link>
            </div>
          </div>

          {/* Integration Tests */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-indigo-600 p-4">
              <h2 className="text-xl font-bold text-white">Database Tests</h2>
            </div>
            <div className="p-4">
              <p className="text-gray-600 mb-4">
                Test database integration and data synchronization with Supabase.
              </p>
              <Link
                href="/supabase-diagnostic"
                className="block w-full bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-center py-2 px-4 rounded"
              >
                Run Database Tests
              </Link>
            </div>
          </div>

          {/* View Documentation */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-gray-800 p-4">
              <h2 className="text-xl font-bold text-white">Documentation</h2>
            </div>
            <div className="p-4">
              <p className="text-gray-600 mb-4">
                View project documentation and implementation details.
              </p>
              
              <div className="space-y-2">
                <Link
                  href="/TUBE-CYCLING-DOCS.md" 
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-center py-2 px-4 rounded"
                >
                  Tube Cycling Documentation
                </Link>
                
                <Link
                  href="/TUBE-CYCLER-IMPLEMENTATION.md"
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-center py-2 px-4 rounded"
                >
                  Implementation Details
                </Link>
                
                <Link
                  href="/PROJECT-UPDATE-26-03-2025.md"
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-center py-2 px-4 rounded"
                >
                  Project Update (26/03)
                </Link>
                
                <Link
                  href="/TEST-SUITE.md"
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-center py-2 px-4 rounded font-medium"
                >
                  Test Suite Documentation
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Implementation Status */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Implementation Status</h2>
          
          <div className="mb-6">
            <div className="flex items-center mb-2">
              <div className="w-32 font-medium text-gray-700">Architecture:</div>
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                Complete
              </div>
            </div>
            
            <div className="flex items-center mb-2">
              <div className="w-32 font-medium text-gray-700">State Manager:</div>
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                Complete
              </div>
            </div>
            
            <div className="flex items-center mb-2">
              <div className="w-32 font-medium text-gray-700">Content Manager:</div>
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                Complete
              </div>
            </div>
            
            <div className="flex items-center mb-2">
              <div className="w-32 font-medium text-gray-700">Tube Adapter:</div>
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                Complete
              </div>
            </div>
            
            <div className="flex items-center mb-2">
              <div className="w-32 font-medium text-gray-700">Player Integration:</div>
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                Complete
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="w-32 font-medium text-gray-700">Testing:</div>
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                Comprehensive
              </div>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>Last updated: March 30, 2025</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestDashboard;