import React from 'react';
import Head from 'next/head';
import ContentBufferDemo from '../components/ContentBufferDemo';

/**
 * Demo page for the content buffer implementation
 */
const ContentBufferDemoPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Content Buffer Demo | Zenjin Maths</title>
        <meta name="description" content="Demonstration of content buffering for efficient learning" />
      </Head>
      
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">Content Buffer Demo</h1>
          <p className="text-sm text-gray-600 mt-1">
            This page demonstrates the content buffering system for efficient learning content delivery
          </p>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <ContentBufferDemo />
          </div>
        </div>
        
        <div className="mt-8 bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">How It Works</h2>
            
            <div className="prose prose-sm">
              <p>
                The content buffer system efficiently loads and caches learning material ahead of time,
                ensuring a smooth experience without loading delays between questions.
              </p>
              
              <h3>Key Features:</h3>
              <ul>
                <li>
                  <strong>Pre-loading:</strong> Loads upcoming content in the background while the user 
                  is working on the current stitch
                </li>
                <li>
                  <strong>Position-based Sorting:</strong> Uses a position-based system to track content order,
                  allowing for flexible spaced repetition
                </li>
                <li>
                  <strong>Triple Helix Model:</strong> Rotates between three tubes of learning content,
                  maintaining engagement and optimizing retention
                </li>
                <li>
                  <strong>Persistent State:</strong> Saves progress automatically to both local storage
                  and the server, with offline support
                </li>
              </ul>
              
              <h3>Technical Implementation:</h3>
              <ul>
                <li>React hooks for seamless integration with the UI</li>
                <li>Manifest API for lightweight content structure loading</li>
                <li>Batch API for efficient content fetching</li>
                <li>Client-side state management with server synchronization</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ContentBufferDemoPage;