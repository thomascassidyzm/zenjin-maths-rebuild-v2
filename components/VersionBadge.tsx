import React, { useState, useEffect } from 'react';
import packageInfo from '../package.json';

/**
 * Get build timestamp from package.json if available,
 * otherwise generate it at runtime 
 * This will be unique for each deployment
 */
const buildTimestamp = packageInfo.buildTimestamp || new Date().toISOString();

// Extract the package version
const packageVersion = packageInfo.version;

// Create a short build ID from the timestamp
// Format: YYMMDD-HHMM
const getBuildId = () => {
  // Use the package timestamp if available
  const date = packageInfo.buildTimestamp 
    ? new Date(packageInfo.buildTimestamp)
    : new Date();
    
  const year = date.getFullYear().toString().slice(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}`;
};

interface VersionBadgeProps {
  /** Set to true to show more detailed version info */
  detailed?: boolean;
  /** Override default position styling */
  className?: string;
}

/**
 * Version badge component to display current build version
 * This helps identify which version is currently running,
 * especially useful when testing to ensure cache is properly cleared
 */
const VersionBadge: React.FC<VersionBadgeProps> = ({ 
  detailed = false, 
  className = "fixed bottom-2 right-2"
}) => {
  const [buildId, setBuildId] = useState<string>('');
  const [expanded, setExpanded] = useState<boolean>(false);
  
  // Generate build ID on client side to ensure it's always fresh
  useEffect(() => {
    setBuildId(getBuildId());
  }, []);
  
  // Toggle expanded view when clicked
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };
  
  // Don't render anything during SSR
  if (typeof window === 'undefined') {
    return null;
  }
  
  return (
    <div 
      className={`${className} z-[1000] ${expanded || detailed ? 'bg-slate-800' : 'bg-slate-800/70'} 
                 text-white text-xs rounded-md shadow-md cursor-pointer transition-all duration-300
                 ${expanded || detailed ? 'p-3 max-w-xs' : 'py-1 px-2'}`}
      onClick={toggleExpanded}
    >
      {expanded || detailed ? (
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Version:</span>
            <span>{packageVersion}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold">Build:</span>
            <span>{buildId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold">Deployed:</span>
            <span title={buildTimestamp}>
              {new Date(buildTimestamp).toLocaleString()}
            </span>
          </div>
          {detailed && (
            <div className="mt-1 text-xs text-white/70">
              Click to collapse
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center space-x-1">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-3 w-3" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span title={`Version ${packageVersion} (Build ${buildId})`}>
            v{packageVersion}-{buildId}
          </span>
        </div>
      )}
    </div>
  );
};

export default VersionBadge;