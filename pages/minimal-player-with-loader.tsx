import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useZenjinStore } from '../lib/store';

// Static placeholder during SSR
const StaticPlaceholder = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900 text-white p-6">
    <h1 className="text-3xl font-bold mb-4">Loading Player...</h1>
    <p className="text-lg max-w-md text-center mb-6">
      This page demonstrates the integration of PlayerWithLoader and MinimalDistinctionPlayer.
    </p>
    <div className="animate-pulse text-xl">Please wait...</div>
  </div>
);

// Dynamically import components to avoid SSR issues
const DynamicPlayerContent = dynamic(
  () => import('../components/MinimalPlayerWithLoaderContent'),
  { 
    ssr: false,
    loading: () => <StaticPlaceholder />
  }
);

/**
 * Minimal Player with Loader Demo Page
 * 
 * This page demonstrates how to properly integrate:
 * 1. PlayerWithLoader - For managing content loading
 * 2. MinimalDistinctionPlayer - For rendering the player UI
 * 3. LoadingScreen - For displaying a welcome message during loading
 */
export default function MinimalPlayerWithLoaderPage() {
  // Set page title
  useEffect(() => {
    document.title = 'Minimal Player with Loader';
  }, []);

  return <DynamicPlayerContent />;
}