/**
 * State Manager Component
 * 
 * Ensures all state operations are routed through the Zustand store
 * for a consistent source of truth.
 */

import React, { useEffect, useCallback } from 'react';
import { useZenjinStore } from '../store';

/**
 * Component that provides state management and sync capabilities
 * All API calls go through Zustand as the single source of truth
 */
const StateManager = ({ 
  children,
  autoSync = true,
  syncInterval = 60000, // 1 minute
  onStateChange = null
}) => {
  const { 
    syncStateToServer, 
    loadStateFromServer,
    userInformation,
    lastUpdated 
  } = useZenjinStore();
  
  // Sync state to server at regular intervals
  useEffect(() => {
    if (!autoSync || !userInformation?.userId) return;
    
    console.log('Setting up automatic state sync');
    
    // Initial sync
    syncStateToServer();
    
    // Schedule regular syncs
    const syncTimer = setInterval(() => {
      console.log('Auto-syncing state to server');
      syncStateToServer();
    }, syncInterval);
    
    // Clean up
    return () => {
      clearInterval(syncTimer);
    };
  }, [autoSync, syncInterval, syncStateToServer, userInformation]);
  
  // Sync when state changes
  useEffect(() => {
    if (onStateChange && typeof onStateChange === 'function') {
      onStateChange({
        lastUpdated,
        userId: userInformation?.userId
      });
    }
  }, [lastUpdated, onStateChange, userInformation]);
  
  // Provide sync function to child components
  const handleSyncState = useCallback(async () => {
    if (!userInformation?.userId) {
      console.warn('Cannot sync state: No user ID available');
      return false;
    }
    
    return await syncStateToServer();
  }, [syncStateToServer, userInformation]);
  
  // Provide load function to child components
  const handleLoadState = useCallback(async (userId) => {
    const targetUserId = userId || userInformation?.userId;
    
    if (!targetUserId) {
      console.warn('Cannot load state: No user ID available');
      return false;
    }
    
    return await loadStateFromServer(targetUserId);
  }, [loadStateFromServer, userInformation]);
  
  // Create props for children
  const childProps = {
    syncState: handleSyncState,
    loadState: handleLoadState,
    lastStateUpdate: lastUpdated
  };
  
  // Clone and augment child element
  return React.cloneElement(children, childProps);
};

export default StateManager;