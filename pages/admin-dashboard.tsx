import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

/**
 * Admin Dashboard - Access to all tools and pages
 */
export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-indigo-900 text-white">
      <Head>
        <title>Admin Dashboard</title>
      </Head>
      
      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <Link href="/working-player" className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm">
            Back to Working Player
          </Link>
        </div>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Working Player and Tools */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <span className="bg-green-500 h-2 w-2 rounded-full mr-2"></span>
              Working Implementation
            </h2>
            <div className="space-y-3">
              <Link href="/working-player" className="bg-green-600/40 hover:bg-green-600/60 px-4 py-3 rounded-lg flex items-center justify-between group">
                <div>
                  <div className="font-medium">Working Player</div>
                  <div className="text-xs text-white/70">Thread D in Tube 3 - Fixed Implementation</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/40 group-hover:text-white/70" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </Link>
              
              <Link href="/verify-tube-d" className="bg-blue-600/40 hover:bg-blue-600/60 px-4 py-3 rounded-lg flex items-center justify-between group">
                <div>
                  <div className="font-medium">Verify Thread D</div>
                  <div className="text-xs text-white/70">Check Thread D appears in Tube 3</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/40 group-hover:text-white/70" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </Link>
              
              <Link href="/triple-helix-debug" className="bg-yellow-600/40 hover:bg-yellow-600/60 px-4 py-3 rounded-lg flex items-center justify-between group">
                <div>
                  <div className="font-medium">Debug Tool</div>
                  <div className="text-xs text-white/70">Detailed tube assignment diagnostics</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/40 group-hover:text-white/70" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
          
          {/* Legacy Components */}
          <div className="bg-gray-800/40 backdrop-blur-lg rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <span className="bg-red-500 h-2 w-2 rounded-full mr-2"></span>
              Legacy Components
            </h2>
            <div className="text-white/70 text-sm mb-4 bg-red-900/20 p-3 rounded-lg">
              These components have issues and are not recommended for general use.
              They are kept for backward compatibility and development reference only.
            </div>
            <div className="space-y-2">
              <Link href="/triple-helix-player-fixed" className="bg-gray-700/40 hover:bg-gray-700/60 px-4 py-2 rounded-lg flex items-center justify-between group">
                <div>
                  <div className="font-medium">Triple-Helix Player</div>
                  <div className="text-xs text-white/50">Outdated player implementation</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/30 group-hover:text-white/50" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </Link>
              
              <Link href="/comprehensive-triple-helix" className="bg-gray-700/40 hover:bg-gray-700/60 px-4 py-2 rounded-lg flex items-center justify-between group">
                <div>
                  <div className="font-medium">Comprehensive TH</div>
                  <div className="text-xs text-white/50">Legacy comprehensive implementation</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/30 group-hover:text-white/50" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </Link>
              
              <Link href="/triple-helix-diagnostic-fixed" className="bg-gray-700/40 hover:bg-gray-700/60 px-4 py-2 rounded-lg flex items-center justify-between group">
                <div>
                  <div className="font-medium">TH Diagnostic Fixed</div>
                  <div className="text-xs text-white/50">Old diagnostic tool</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/30 group-hover:text-white/50" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </Link>
              
              <Link href="/triple-helix-simulator" className="bg-gray-700/40 hover:bg-gray-700/60 px-4 py-2 rounded-lg flex items-center justify-between group">
                <div>
                  <div className="font-medium">TH Simulator</div>
                  <div className="text-xs text-white/50">Original simulator</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/30 group-hover:text-white/50" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Documentation */}
        <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Documentation</h2>
          <p className="mb-4 text-sm text-white/80">
            The Thread D tube assignment fix ensures that Thread D stitches are correctly loaded into Tube 3,
            following the proper tube container architecture where multiple threads can be assigned to the same tube.
          </p>
          
          <div className="bg-black/20 p-4 rounded-lg font-mono text-sm text-white/80">
            <div className="mb-2 text-white">Thread → Tube Assignments:</div>
            <div>Thread A → Tube 1</div>
            <div>Thread B → Tube 2</div>
            <div>Thread C → Tube 3</div>
            <div className="text-green-300 font-bold">Thread D → Tube 3</div>
            <div>Thread E → Tube 2</div>
            <div>Thread F → Tube 1</div>
          </div>
        </div>
      </div>
    </div>
  );
}