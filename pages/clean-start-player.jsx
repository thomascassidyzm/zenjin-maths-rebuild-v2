import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Static placeholder during SSR
const StaticPlaceholder = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-teal-500 to-teal-700 text-white p-6">
    <h1 className="text-3xl font-bold mb-4">Loading Clean Player...</h1>
    <p className="text-lg max-w-md text-center mb-6">
      This page will load a completely fresh player instance without any localStorage data.
    </p>
    <div className="animate-pulse text-xl">Please wait...</div>
  </div>
);

// Dynamically import the actual component with client-side only rendering
const CleanStartPlayerContent = dynamic(
  () => import('../components/CleanStartPlayerContent'),
  { 
    ssr: false,
    loading: () => <StaticPlaceholder />
  }
);

/**
 * Clean Start Player Page
 * 
 * This page provides a clean testing environment by:
 * 1. Clearing localStorage entirely before initialization
 * 2. Rendering everything client-side only to avoid SSR issues
 * 3. Providing manual controls for testing loading states
 */
export default function CleanStartPlayerPage() {
  // Set page title
  useEffect(() => {
    document.title = 'Clean Start Player';
  }, []);

  return <CleanStartPlayerContent />;
}