import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../lib/store/appStore';
import type { UserInformation, TubeState, LearningProgress, UserState } from '../lib/store/types'; // Ensure UserState is exported or defined
import { loadUserData } from '../lib/loadUserData';
import { saveStateWithRetry } from '../lib/enhancedStatePersistence';

const TestPersistencePage: React.FC = () => {
  // Zustand store selectors
  const storeUserInformation = useAppStore((state) => state.userInformation);
  const storeTubeState = useAppStore((state) => state.tubeState);
  const storeLearningProgress = useAppStore((state) => state.learningProgress);
  const storeLastUpdated = useAppStore((state) => state.lastUpdated);
  const storeIsInitialized = useAppStore((state) => state.isInitialized);

  // Zustand store actions
  const {
    setUserInformation,
    setTubeState,
    setActiveTube, // Assuming tubeId is string
    setLearningProgress,
    incrementPoints,
    initializeState,
    syncToServer,
  } = useAppStore.getState();

  // Local component state
  const [inputUserId, setInputUserId] = useState<string>(storeUserInformation?.userId || 'test-user-001');
  const [statusMessage, setStatusMessage] = useState<string>('Page loaded.');
  const [isSimulatingOffline, setIsSimulatingOffline] = useState<boolean>(false);
  
  // Keep inputUserId in sync with store's userId if store changes from outside
  useEffect(() => {
    setInputUserId(storeUserInformation?.userId || 'test-user-001');
  }, [storeUserInformation?.userId]);

  const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputUserId(e.target.value);
  };

  const handleSetUserInStore = () => {
    console.log(`Setting user ID in store: ${inputUserId}`);
    // Basic example: Assumes UserInformation structure
    setUserInformation({ userId: inputUserId, name: `Test User ${inputUserId}`, email: `${inputUserId}@example.com` });
    setStatusMessage(`User ID set in store to: ${inputUserId}`);
  };
  
  // --- Updated Test Actions ---

  const handleUpdatePoints = () => {
    const pointsToAdd = 10;
    console.log(`Adding ${pointsToAdd} points.`);
    incrementPoints(pointsToAdd);
    setStatusMessage(`${pointsToAdd} points added.`);
  };

  const handleCycleTube = () => {
    // Example: Cycle to a tube named 'tube-next' or a predefined ID
    const newActiveTubeId = `tube-${Math.floor(Math.random() * 3) + 1}`;
    console.log(`Cycling to tube: ${newActiveTubeId}`);
    setActiveTube(newActiveTubeId); // Ensure setActiveTube can handle string IDs
    setStatusMessage(`Cycled to tube: ${newActiveTubeId}`);
  };
  
  const handleForceSync = async () => {
    setStatusMessage('Syncing current store state to server...');
    console.log('Forcing sync of current store state...');
    try {
      const success = await syncToServer();
      setStatusMessage(success ? 'Sync successful!' : 'Sync failed.');
      console.log('Sync attempt finished. Success:', success);
    } catch (error: any) {
      setStatusMessage(`Sync error: ${error.message}`);
      console.error('Sync error:', error);
    }
  };

  const handleSaveWithRetry = async () => {
    setStatusMessage('Attempting to save state with retry logic...');
    console.log('Saving state with retry logic...');
    const currentState = useAppStore.getState();
    const payload: UserState = {
        userInformation: currentState.userInformation || { userId: inputUserId, name: 'Default Name' },
        tubeState: currentState.tubeState || { tubes: [], activeTube: null },
        learningProgress: currentState.learningProgress || { points: { session: 0, lifetime: 0 } },
    };
    try {
      const success = await saveStateWithRetry(payload.userInformation.userId || 'unknown-user', payload);
      setStatusMessage(success ? 'saveStateWithRetry successful!' : 'saveStateWithRetry failed. Check console for backup status.');
      console.log('saveStateWithRetry attempt finished. Success:', success);
    } catch (error: any) {
      setStatusMessage(`saveStateWithRetry error: ${error.message}`);
      console.error('saveStateWithRetry error:', error);
    }
  };
  
  const handleLoadUserData = async () => {
    setStatusMessage('Loading user data from server...');
    console.log('Loading user data...');
    try {
      // loadUserData now hydrates the store directly.
      // The userId parameter for loadUserData is optional, as API uses session.
      const result = await loadUserData(storeUserInformation?.userId); 
      setStatusMessage(result.success ? 'User data loaded and store hydrated.' : 'Failed to load user data.');
      console.log('Load user data result:', result);
    } catch (error: any) {
      setStatusMessage(`Error loading user data: ${error.message}`);
      console.error('Error loading user data:', error);
    }
  };

  // --- New Test Scenarios ---

  const handleFullSaveReloadCycle = async () => {
    setStatusMessage('Starting full save & reload cycle...');
    console.log('--- Test Full Save & Reload Cycle ---');
    
    // 1. Modify state
    const pointsToAdd = 5;
    incrementPoints(pointsToAdd);
    console.log('State modified (points incremented by 5). Current store state:', useAppStore.getState());
    setStatusMessage(`State modified (+${pointsToAdd}pts). Saving...`);
    await new Promise(r => setTimeout(r, 100)); // UI update

    // 2. Sync to server
    const syncSuccess = await syncToServer();
    if (!syncSuccess) {
      setStatusMessage('Full cycle aborted: Sync failed.');
      console.error('Full cycle: Sync to server failed.');
      return;
    }
    console.log('State synced to server. Current store state:', useAppStore.getState());
    setStatusMessage('Sync successful. Clearing store...');
    await new Promise(r => setTimeout(r, 100));

    // 3. Clear store (simulate app close/reopen or user switch)
    initializeState({ 
        userInformation: null, 
        tubeState: null, 
        learningProgress: null, 
        isInitialized: false 
    });
    console.log('Store cleared. Current store state:', useAppStore.getState());
    setStatusMessage('Store cleared. Reloading data...');
    await new Promise(r => setTimeout(r, 100));

    // 4. Load data
    try {
      await loadUserData(storeUserInformation?.userId); // Use original user's ID for loading
      setStatusMessage('Full cycle: User data reloaded. Verify state.');
      console.log('User data reloaded. Final store state:', useAppStore.getState());
    } catch (error: any) {
      setStatusMessage(`Full cycle failed: Error reloading data: ${error.message}`);
      console.error('Full cycle: Error reloading data:', error);
    }
    console.log('--- End Test Full Save & Reload Cycle ---');
  };

  const handleAnonymousToAuthTransition = async () => {
    setStatusMessage('Starting anonymous to auth transition test...');
    console.log('--- Test Anonymous to Auth Transition ---');
    const originalUserId = storeUserInformation?.userId;

    // 1. Simulate anonymous session & modify state
    setUserInformation(null); // Or a specific anonymous user structure if your app uses one
    incrementPoints(20);
    console.log('Simulating anonymous session, added 20 points. Store state:', useAppStore.getState());
    setStatusMessage('Anonymous session: +20pts. Simulating login...');
    await new Promise(r => setTimeout(r, 100));

    // 2. Simulate login
    const authUserId = `authed-user-${Date.now().toString().slice(-5)}`;
    setUserInformation({ userId: authUserId, name: 'Authenticated User' });
    console.log(`Simulated login for user: ${authUserId}. Store state:`, useAppStore.getState());
    setStatusMessage(`Logged in as ${authUserId}. Syncing...`);
    await new Promise(r => setTimeout(r, 100));
    
    // 3. Sync to server
    const syncSuccess = await syncToServer();
    setStatusMessage(syncSuccess ? `Transition: Synced for ${authUserId}.` : `Transition: Sync failed for ${authUserId}.`);
    console.log(`Sync after transition to ${authUserId}. Success: ${syncSuccess}. Store state:`, useAppStore.getState());
    
    // Note: Verification would involve checking DB that state is associated with authUserId
    // Optionally, restore original user for further testing
    // if (originalUserId) setUserInformation({ userId: originalUserId, name: 'Original User' });
    console.log('--- End Test Anonymous to Auth Transition ---');
  };
  
  let originalFetch: typeof window.fetch | null = null;

  const simulateOffline = () => {
    if (typeof window !== 'undefined' && !isSimulatingOffline) {
      originalFetch = window.fetch;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const urlString = typeof input === 'string' ? input : input.url;
        if (urlString.includes('/api/core_state_sync_v1')) {
          console.warn('SIMULATING OFFLINE: Blocking fetch to /api/core_state_sync_v1');
          throw new Error('Simulated network error: You are offline.');
        }
        return originalFetch!(input, init);
      };
      setIsSimulatingOffline(true);
      setStatusMessage('OFFLINE mode simulated for /api/core_state_sync_v1.');
      console.log('OFFLINE mode simulated for /api/core_state_sync_v1.');
    }
  };

  const simulateOnline = () => {
    if (typeof window !== 'undefined' && originalFetch && isSimulatingOffline) {
      window.fetch = originalFetch;
      originalFetch = null;
      setIsSimulatingOffline(false);
      setStatusMessage('ONLINE mode restored.');
      console.log('ONLINE mode restored.');
    }
  };

  const handleOfflineSyncAttempt = async () => {
    if (!isSimulatingOffline) {
      setStatusMessage('Warning: Not in simulated offline mode. Test might not be effective.');
      console.warn('Attempting offline sync test, but not in simulated offline mode.');
    }
    setStatusMessage('Attempting sync with retry (expecting backup)...');
    console.log('--- Test Offline Sync Attempt & Backup ---');
    incrementPoints(30); // Modify state
    console.log('State modified (+30 points). Attempting saveStateWithRetry...');
    
    const currentUserId = useAppStore.getState().userInformation?.userId || 'unknown-offline-user';
    const currentState = useAppStore.getState();
    const payload: UserState = {
        userInformation: currentState.userInformation || { userId: currentUserId, name: 'Default Name' },
        tubeState: currentState.tubeState || { tubes: [], activeTube: null },
        learningProgress: currentState.learningProgress || { points: { session: 0, lifetime: 0 } },
    };

    const success = await saveStateWithRetry(currentUserId, payload);
    console.log('saveStateWithRetry finished. Success:', success);

    if (!success) {
      const backupKey = `zenjin_state_backup_${currentUserId}`;
      const backupData = localStorage.getItem(backupKey);
      if (backupData) {
        setStatusMessage('Offline sync failed as expected. Backup found in localStorage.');
        console.log('Backup found in localStorage:', backupKey, JSON.parse(backupData));
      } else {
        setStatusMessage('Offline sync failed. NO BACKUP FOUND in localStorage.');
        console.error('NO BACKUP FOUND in localStorage for key:', backupKey);
      }
    } else {
      setStatusMessage('Offline sync unexpectedly succeeded. Check simulation.');
      console.warn('Offline sync test unexpectedly succeeded.');
    }
    console.log('--- End Test Offline Sync Attempt & Backup ---');
  };
  
  // --- UI Rendering ---
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">New State Persistence Test Page</h1>
      <p className="mb-4 text-sm text-gray-600">Status: {statusMessage}</p>

      {/* User ID Management */}
      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="text-lg font-semibold">User Management</h2>
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={inputUserId}
            onChange={handleUserIdChange}
            placeholder="Enter User ID"
            className="p-2 border rounded w-1/2"
          />
          <button onClick={handleSetUserInStore} className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600">
            Set User in Store
          </button>
        </div>
      </div>

      {/* Current State Display */}
      <div className="bg-gray-50 p-4 rounded mb-4">
        <h2 className="text-lg font-semibold">Current Store State</h2>
        <p>Initialized: {storeIsInitialized ? 'Yes' : 'No'}</p>
        <p>User ID: {storeUserInformation?.userId || 'N/A'}</p>
        <p>User Name: {storeUserInformation?.name || 'N/A'}</p>
        <p>Points (Session): {storeLearningProgress?.points?.session ?? 'N/A'}</p>
        <p>Points (Lifetime): {storeLearningProgress?.points?.lifetime ?? 'N/A'}</p>
        <p>Active Tube ID: {storeTubeState?.activeTube || 'N/A'}</p>
        <p>Last Updated (Store): {storeLastUpdated ? new Date(storeLastUpdated).toLocaleString() : 'N/A'}</p>
        <details className="text-xs cursor-pointer">
            <summary>Raw State Objects</summary>
            <pre className="bg-white p-2 rounded mt-1 overflow-x-auto">
                UserInformation: {JSON.stringify(storeUserInformation, null, 2) || 'null'}{'\n'}
                TubeState: {JSON.stringify(storeTubeState, null, 2) || 'null'}{'\n'}
                LearningProgress: {JSON.stringify(storeLearningProgress, null, 2) || 'null'}
            </pre>
        </details>
      </div>

      {/* Basic Actions */}
      <div className="bg-blue-50 p-4 rounded mb-4">
        <h2 className="text-lg font-semibold">Basic Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
          <button onClick={handleUpdatePoints} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Update Points (+10)</button>
          <button onClick={handleCycleTube} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Cycle Active Tube</button>
          <button onClick={handleForceSync} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">Force Sync (Store)</button>
          <button onClick={handleSaveWithRetry} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Save with Retry</button>
          <button onClick={handleLoadUserData} className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600">Load User Data (to Store)</button>
          <button onClick={() => initializeState({})} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Clear Store (Initialize Empty)</button>
        </div>
      </div>

      {/* Advanced Test Scenarios */}
      <div className="bg-purple-50 p-4 rounded mb-4">
        <h2 className="text-lg font-semibold">Advanced Test Scenarios</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
          <button onClick={handleFullSaveReloadCycle} className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">Test Full Save & Reload Cycle</button>
          <button onClick={handleAnonymousToAuthTransition} className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">Test Anonymous to Auth Transition</button>
        </div>
      </div>

      {/* Offline Simulation */}
      <div className="bg-red-50 p-4 rounded mb-4">
        <h2 className="text-lg font-semibold">Offline Simulation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
          <button onClick={simulateOffline} disabled={isSimulatingOffline} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50">Simulate Offline</button>
          <button onClick={simulateOnline} disabled={!isSimulatingOffline} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50">Simulate Online</button>
          <button onClick={handleOfflineSyncAttempt} className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">Test Offline Sync (saveStateWithRetry)</button>
        </div>
         <p className="text-sm mt-2">Current simulated status: {isSimulatingOffline ? 'OFFLINE' : 'ONLINE'}</p>
      </div>
      
      {/* Debug LocalStorage */}
      <div className="bg-yellow-50 p-4 rounded">
        <h2 className="text-lg font-semibold">LocalStorage Debug</h2>
        <div className="flex gap-2 mt-2">
            <button onClick={() => {
                const appState = localStorage.getItem('zenjin-app-state');
                console.log('Zustand Persisted State (zenjin-app-state):', appState ? JSON.parse(appState) : null);
                alert(`Zustand state (zenjin-app-state) ${appState ? 'found' : 'NOT found'}. Check console.`);
            }} className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600">Check 'zenjin-app-state'</button>
            <button onClick={() => {
                const backupKey = `zenjin_state_backup_${storeUserInformation?.userId || inputUserId || 'unknown-user'}`;
                const backupState = localStorage.getItem(backupKey);
                console.log(`Backup State (${backupKey}):`, backupState ? JSON.parse(backupState) : null);
                alert(`Backup state (${backupKey}) ${backupState ? 'found' : 'NOT found'}. Check console.`);
            }} className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600">Check Backup State</button>
        </div>
      </div>
    </div>
  );
};

export default TestPersistencePage;