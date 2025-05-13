import React from 'react';
import dynamic from 'next/dynamic';

// This is a very simple wrapper component that will load the actual component
// on the client-side only, avoiding all SSR issues
const PositionTestPage = () => (
  <div className="min-h-screen bg-gray-900 text-white p-6">
    <h1 className="text-2xl font-bold mb-4">Position Test Loading...</h1>
    <p>This page will load a client-side only component to test the position-based model.</p>
    <p>If you see this message for more than a few seconds, there may be an issue with your browser or connection.</p>
  </div>
);

// The actual component will be loaded only on the client side
// This avoids issues with SSR and ensures no hydration mismatches
export default dynamic(() => import('../components/position-test-ui'), {
  ssr: false,
  loading: () => <PositionTestPage />
});