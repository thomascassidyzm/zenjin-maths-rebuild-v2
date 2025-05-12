/**
 * StitchContentLoader Component
 * 
 * This component handles loading stitch content from the Zustand store
 * and provides a standardized loading/error UI.
 */

import React from 'react';
import { useStitchContent } from '../lib/hooks/useStitchContent';

interface StitchContentLoaderProps {
  stitchId: string;
  children: (stitch: any) => React.ReactNode;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
}

export default function StitchContentLoader({
  stitchId,
  children,
  loadingComponent,
  errorComponent
}: StitchContentLoaderProps) {
  const { stitch, loading, error } = useStitchContent(stitchId);
  
  // Show loading UI
  if (loading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    
    return (
      <div className="flex items-center justify-center min-h-[200px] bg-gradient-to-b from-white/5 to-white/10 rounded-xl backdrop-blur-sm p-6">
        <div className="flex flex-col items-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-3"></div>
          <p className="text-white text-opacity-70">Loading stitch content...</p>
        </div>
      </div>
    );
  }
  
  // Show error UI
  if (error || !stitch) {
    if (errorComponent) {
      return <>{errorComponent}</>;
    }
    
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
        <h3 className="text-red-200 text-lg font-medium mb-2">Failed to load content</h3>
        <p className="text-white/70 text-sm mb-4">
          {error ? error.message : `Content for stitch ID "${stitchId}" not found`}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }
  
  // Pass the stitch to the children render prop
  return <>{children(stitch)}</>;
}