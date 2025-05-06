/**
 * State Manager
 * 
 * Handles state transitions and persistence for the player
 * Provides a clean interface for components to interact with application state
 */
import { UserState, StateAction, SessionResult } from './types';

// Initial empty state
const initialState: UserState = {
  tubes: {
    1: { threadId: '', currentStitchId: '', position: 0 },
    2: { threadId: '', currentStitchId: '', position: 0 },
    3: { threadId: '', currentStitchId: '', position: 0 }
  },
  activeTube: 1,
  activeTubeNumber: 1, // Add this for compatibility with both naming schemes
  cycleCount: 0,
  points: {
    session: 0,
    lifetime: 0
  },
  lastUpdated: new Date().toISOString(),
  userId: ''
};

/**
 * StateManager class
 * Implements a simplified state machine pattern
 */
export class StateManager {
  private state: UserState;
  private listeners: Set<(state: UserState) => void>;
  private syncInProgress: boolean;
  private pendingSync: boolean;
  
  constructor() {
    this.state = {...initialState};
    this.listeners = new Set();
    this.syncInProgress = false;
    this.pendingSync = false;
  }
  
  /**
   * Get the current state (immutable)
   */
  getState(): UserState {
    return {...this.state};
  }
  
  /**
   * Dispatch an action to update the state
   * @param action The action to dispatch
   * @param skipServerSync Optional flag to skip server sync (default: true)
   */
  dispatch(action: StateAction, skipServerSync: boolean = true): void {
    // Update state based on action type
    const newState = this.reducer(this.state, action);
    
    // Update timestamp
    newState.lastUpdated = new Date().toISOString();
    
    // Replace state
    this.state = newState;
    
    // Persist state changes (always to local storage, optionally to server)
    this.persistState(skipServerSync);
    
    // Notify all listeners
    this.notifyListeners();
  }
  
  /**
   * State reducer
   */
  private reducer(state: UserState, action: StateAction): UserState {
    switch (action.type) {
      case 'INITIALIZE_STATE':
        // Replace the entire state
        return {
          ...action.payload,
          lastUpdated: new Date().toISOString()
        };
      
      case 'SET_ACTIVE_TUBE':
        return {
          ...state,
          activeTube: action.payload,
          activeTubeNumber: action.payload // Add this for compatibility with both naming schemes
        };
      
      case 'COMPLETE_STITCH': {
        const { tubeNumber, threadId, stitchId, nextStitchId, score, totalQuestions, skipNumber, distractorLevel } = action.payload;
        
        // Calculate points to add (3 points per correct answer)
        const pointsToAdd = score * 3;
        
        // CRITICAL FIX: Only update position if the score is perfect (20/20)
        // If it's not perfect, we leave the active stitch as is (same position, same stitch ID)
        const isPerfectScore = action.payload.isPerfectScore || score === totalQuestions;
        console.log(`Stitch completion - Score: ${score}/${totalQuestions} - Perfect score: ${isPerfectScore} - Will advance: ${isPerfectScore}`);
        
        // Current position for this tube
        const currentPosition = state.tubes[tubeNumber]?.position || 0;
        
        // Get current points
        const currentSessionPoints = state.points.session || 0;
        const currentLifetimePoints = state.points.lifetime || 0;
        
        // Log points update
        console.log(`POINTS: Adding ${pointsToAdd} points - Current session: ${currentSessionPoints}, lifetime: ${currentLifetimePoints}`);
        console.log(`POINTS: After update - Session: ${currentSessionPoints + pointsToAdd}, lifetime: ${currentLifetimePoints + pointsToAdd}`);
        
        // If this was a perfect score, log advancement
        if (isPerfectScore) {
          const newPosition = currentPosition + 1;
          console.log(`ADVANCEMENT: Perfect score - advancing position from ${currentPosition} to ${newPosition}`);
          console.log(`ADVANCEMENT: Changing stitch from ${stitchId} to ${nextStitchId}`);
          
          // CRITICAL FIX: Debug current state before and after update
          console.log(`STATE: Before update - Tube ${tubeNumber} has stitch ${state.tubes[tubeNumber]?.currentStitchId} at position ${currentPosition}`);
          console.log(`STATE: Will update to - stitch ${nextStitchId} at position ${newPosition}`);
        } else {
          console.log(`ADVANCEMENT: Non-perfect score - staying at position ${currentPosition}`);
          console.log(`ADVANCEMENT: Keeping same stitch ${stitchId}`);
        }
        
        const newState = {
          ...state,
          tubes: {
            ...state.tubes,
            [tubeNumber]: {
              ...state.tubes[tubeNumber],
              // Only update the stitch ID if it's a perfect score, otherwise keep the same stitch
              currentStitchId: isPerfectScore ? nextStitchId : stitchId,
              // Only increment position if the score is perfect
              position: isPerfectScore ? currentPosition + 1 : currentPosition
            }
          },
          points: {
            session: currentSessionPoints + pointsToAdd,
            lifetime: currentLifetimePoints + pointsToAdd
          }
        };
        
        // Log the state change for debugging
        if (isPerfectScore) {
          console.log(`STATE: After update - Tube ${tubeNumber} now has:`, 
            `stitch=${newState.tubes[tubeNumber]?.currentStitchId}`,
            `position=${newState.tubes[tubeNumber]?.position}`);
        }
        
        return newState;
      }
      
      // CRITICAL FIX: Add a new action type for forcing stitch updates
      // This is needed as a last resort to ensure stitch progression works
      case 'FORCE_STITCH_UPDATE': {
        const { tubeNumber, nextStitchId, position } = action.payload;
        
        console.log(`STATE MANAGER: CRITICAL FIX - Forcing stitch update for tube ${tubeNumber}`);
        console.log(`STATE MANAGER: CRITICAL FIX - Setting stitch ID to ${nextStitchId}`);
        console.log(`STATE MANAGER: CRITICAL FIX - Setting position to ${position}`);
        
        return {
          ...state,
          tubes: {
            ...state.tubes,
            [tubeNumber]: {
              ...state.tubes[tubeNumber],
              currentStitchId: nextStitchId,
              position: position
            }
          }
        };
      }
      
      case 'CYCLE_TUBE': {
        const { fromTube, toTube } = action.payload;
        
        // If we're cycling back to tube 1 from tube 3, increment cycle count
        // CRITICAL FIX: Make sure the condition is specific (tube 3 to tube 1)
        const newCycleCount = (fromTube === 3 && toTube === 1) 
          ? state.cycleCount + 1 
          : state.cycleCount;
        
        if (fromTube === 3 && toTube === 1) {
          console.log(`STATE MANAGER: Tube cycle completed! Incrementing cycle count from ${state.cycleCount} to ${newCycleCount}`);
        }
        
        return {
          ...state,
          activeTube: toTube,
          activeTubeNumber: toTube, // Add this for compatibility with both naming schemes
          cycleCount: newCycleCount
        };
      }
      
      case 'UPDATE_CYCLE_COUNT': {
        const { cycleCount } = action.payload;
        
        console.log(`STATE MANAGER: Directly updating cycle count to ${cycleCount}`);
        
        return {
          ...state,
          cycleCount
        };
      }
      
      case 'UPDATE_POINTS':
        return {
          ...state,
          points: {
            session: action.payload.sessionPoints,
            lifetime: action.payload.lifetimePoints
          }
        };
      
      default:
        return state;
    }
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: UserState) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Unsubscribe from state changes
   */
  unsubscribe(listener: (state: UserState) => void): void {
    this.listeners.delete(listener);
  }
  
  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('Error in state listener:', err);
      }
    });
  }
  
  /**
   * Initialize state from saved state or API
   */
  async initialize(userId: string): Promise<void> {
    try {
      console.log('Initializing state manager for user:', userId);
      
      // First attempt to load from browser storage
      const localState = this.loadFromLocalStorage(userId);
      let finalState: UserState | null = null;
      
      if (localState) {
        console.log('Found state in localStorage:', localState);
        finalState = localState;
      }
      
      // Then attempt to load from API (even if we found local state)
      // This ensures we have the most up-to-date state from server
      try {
        const apiState = await this.loadFromServer(userId);
        
        if (apiState) {
          console.log('Loaded state from server:', apiState);
          
          // If we have both local and server state, use the most recent one
          if (finalState) {
            const localDate = new Date(finalState.lastUpdated).getTime();
            const serverDate = new Date(apiState.lastUpdated).getTime();
            
            if (serverDate > localDate) {
              console.log('Server state is more recent than local state, using server state');
              finalState = apiState;
            } else {
              console.log('Local state is more recent than server state, using local state');
              // Keep using finalState from localStorage
            }
          } else {
            finalState = apiState;
          }
        }
      } catch (err) {
        console.error('Error loading state from server:', err);
        // Continue with localState if available
      }
      
      // If we have a state, initialize with it
      if (finalState) {
        // Make sure the userId is set
        finalState.userId = userId;
        
        // Always store userId in localStorage for resilience
        if (typeof window !== 'undefined') {
          localStorage.setItem('zenjin_user_id', userId);
          console.log(`STATE MANAGER: Saved userId ${userId} to localStorage during initialization`);
        }
        
        // Initialize state
        this.dispatch({ type: 'INITIALIZE_STATE', payload: finalState });
      } else {
        // Initialize with default state
        const defaultState: UserState = {
          ...initialState,
          userId,
          lastUpdated: new Date().toISOString()
        };
        
        // Always store userId in localStorage for resilience
        if (typeof window !== 'undefined') {
          localStorage.setItem('zenjin_user_id', userId);
          console.log(`STATE MANAGER: Saved userId ${userId} to localStorage during initialization`);
        }
        
        this.dispatch({ type: 'INITIALIZE_STATE', payload: defaultState });
      }
    } catch (err) {
      console.error('Error initializing state:', err);
      
      // Initialize with empty state as fallback
      const emptyState: UserState = {
        ...initialState,
        userId,
        lastUpdated: new Date().toISOString()
      };
      
      this.dispatch({ type: 'INITIALIZE_STATE', payload: emptyState });
    }
  }
  
  /**
   * Load state from localStorage
   */
  private loadFromLocalStorage(userId: string): UserState | null {
    try {
      const stateStr = localStorage.getItem(`zenjin_state_${userId}`);
      
      if (stateStr) {
        const state = JSON.parse(stateStr) as UserState;
        
        // Validate the state has the required fields
        if (state && 
            state.tubes && 
            state.activeTube !== undefined &&
            state.cycleCount !== undefined &&
            state.points &&
            state.lastUpdated) {
          return state;
        }
      }
      
      return null;
    } catch (err) {
      console.error('Error loading state from localStorage:', err);
      return null;
    }
  }
  
  /**
   * Load state from server
   */
  private async loadFromServer(userId: string): Promise<UserState | null> {
    try {
      console.log(`Attempting to load state from server for user: ${userId}`);
      
      // CRITICAL FIX: Safety check for empty userId to prevent invalid server requests
      if (!userId || userId === '') {
        console.error('CRITICAL ERROR: Empty userId provided to loadFromServer method');
        return null;
      }
      
      // Check if this is an anonymous user
      const isAnonymousUser = userId.startsWith('anonymous-');
      
      // For anonymous users, use the dedicated anonymous state endpoint
      const endpoint = isAnonymousUser 
        ? `/api/anonymous-state?id=${encodeURIComponent(userId)}`
        : `/api/user-state?userId=${encodeURIComponent(userId)}`;
      
      // Enhanced fetch with authentication token if available
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      };
      
      // Try to get auth token from localStorage
      if (typeof window !== 'undefined' && !isAnonymousUser) {
        try {
          // Check for Supabase token
          const supabaseToken = localStorage.getItem('sb-ggwoupzaruiaaliylxga-auth-token');
          if (supabaseToken) {
            try {
              const parsedToken = JSON.parse(supabaseToken);
              if (parsedToken.access_token) {
                headers['Authorization'] = `Bearer ${parsedToken.access_token}`;
                console.log('Added authentication token to server state request');
              }
            } catch (e) {
              console.warn('Could not parse supabase token:', e);
            }
          }
        } catch (e) {
          console.warn('Error getting auth token from localStorage:', e);
        }
      }
      
      // Fetch state from API with enhanced headers
      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      
      // Handle all error responses gracefully
      if (!response.ok) {
        console.warn(`Server issue (${response.status}) loading state from server. Using local state only.`);
        return null;
      }
      
      const data = await response.json();
      
      if (data.success && data.state) {
        console.log(`Successfully loaded state from server for user: ${userId}`);
        
        // CRITICAL FIX: Ensure server state always has correct userId
        // This fixes cases where server might return state with empty userId
        const state = data.state as UserState;
        if (!state.userId || state.userId === '') {
          console.log('CRITICAL FIX: Server returned state with empty userId, fixing it');
          state.userId = userId;
        }
        
        // Also store in localStorage as backup
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('zenjin_user_id', userId);
            console.log(`Saved userId to localStorage during state load: ${userId}`);
            
            // Also save to window.__CURRENT_USER_ID__ for cross-component access
            (window as any).__CURRENT_USER_ID__ = userId;
          } catch (e) {
            console.warn('Could not save userId to localStorage:', e);
          }
        }
        
        return state;
      }
      
      console.log(`No state found on server for user: ${userId}`);
      return null;
    } catch (err) {
      console.error('Error loading state from server:', err);
      return null;
    }
  }
  
  /**
   * Persist state to localStorage and optionally to server
   * @param skipServerSync Whether to skip syncing to the server (default: false)
   */
  private persistState(skipServerSync: boolean = false): void {
    const state = this.getState();
    
    // Always save to localStorage immediately for fast access
    this.saveToLocalStorage(state);
    
    // Also save to IndexedDB as a backup for offline mode
    try {
      this.saveToIndexedDB(state).catch(err => {
        console.warn('Failed to save to IndexedDB:', err);
      });
    } catch (e) {
      console.warn('Error saving to IndexedDB:', e);
    }
    
    // Optionally schedule server sync with debouncing
    if (!skipServerSync) {
      this.scheduleServerSync();
    }
  }
  
  /**
   * Save state to localStorage
   */
  private saveToLocalStorage(state: UserState): void {
    try {
      // Save to the primary state key
      localStorage.setItem(`zenjin_state_${state.userId}`, JSON.stringify(state));
      
      // For anonymous users, also save to the general anonymous state key
      // This ensures the data can be found during account conversion
      if (state.userId.startsWith('anonymous') || state.userId.startsWith('anon-')) {
        localStorage.setItem('zenjin_anonymous_state', JSON.stringify(state));
        
        // Also save to triple helix format for compatibility
        localStorage.setItem(`triple_helix_state_${state.userId}`, JSON.stringify(state));
      }
    } catch (err) {
      console.error('Error saving state to localStorage:', err);
    }
  }
  
  /**
   * Schedule server sync with debouncing
   */
  private scheduleServerSync(): void {
    if (this.syncInProgress) {
      // If sync is already in progress, mark that we need another one
      this.pendingSync = true;
      return;
    }
    
    // Start a sync
    this.syncInProgress = true;
    this.pendingSync = false;
    
    // Use timeout to batch rapid updates
    setTimeout(() => {
      this.syncToServer().finally(() => {
        this.syncInProgress = false;
        
        // If more changes happened during sync, schedule another one
        if (this.pendingSync) {
          this.scheduleServerSync();
        }
      });
    }, 500); // 500ms debounce
  }
  
  /**
   * Sync state to server
   */
  private async syncToServer(): Promise<void> {
    const state = this.getState();
    
    try {
      // Check if this is an anonymous user
      const isAnonymousUser = state.userId.startsWith('anonymous-');
      
      // Use the right endpoint based on user type
      const endpoint = isAnonymousUser 
        ? '/api/anonymous-state'
        : '/api/user-state'; // Always use the user-state endpoint for authenticated users
      
      // Use the Beacon API if available and page is about to unload
      if (navigator.sendBeacon && document.visibilityState === 'hidden') {
        const blob = new Blob([JSON.stringify({ 
          state,
          id: isAnonymousUser ? state.userId : undefined
        })], { type: 'application/json' });
        
        navigator.sendBeacon(endpoint, blob);
        return;
      }
      
      // Otherwise use fetch
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          state,
          id: isAnonymousUser ? state.userId : undefined
        }),
        credentials: 'include'
      });
      
      // Handle all error responses gracefully
      if (!response.ok) {
        console.warn(`Server issue (${response.status}) syncing state to server. Saving locally only.`);
        
        // Still try to save to IndexedDB for all error types
        if (typeof window !== 'undefined' && window.indexedDB) {
          try {
            await this.saveToIndexedDB(state);
          } catch (idbErr) {
            console.warn('Unable to save to IndexedDB:', idbErr);
          }
        }
        return;
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(`API error: ${data.error}`);
      }
    } catch (err) {
      console.error('Error syncing state to server:', err);
      
      // Register for background sync if available
      if ('serviceWorker' in navigator && 'SyncManager' in window && window.indexedDB) {
        try {
          // First check if the object store exists
          let db: IDBDatabase;
          const openRequest = indexedDB.open('zenjin_state_db', 1);
          
          // Create the store if it doesn't exist
          openRequest.onupgradeneeded = (event) => {
            db = openRequest.result;
            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains('state_sync')) {
              db.createObjectStore('state_sync', { keyPath: 'id' });
            }
          };
          
          openRequest.onsuccess = async (event) => {
            try {
              db = openRequest.result;
              
              // Save to IndexedDB for background sync
              await this.saveToIndexedDB(state);
              
              // Get service worker registration
              if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                
                // Register for background sync
                if ('SyncManager' in window) {
                  await registration.sync.register('sync-state');
                }
              }
            } catch (innerErr) {
              console.error('Error in IndexedDB sync operation:', innerErr);
            }
          };
          
          openRequest.onerror = (event) => {
            console.error('Error opening IndexedDB for sync:', event);
          };
        } catch (syncErr) {
          console.error('Error registering for background sync:', syncErr);
        }
      }
    }
  }
  
  /**
   * Save state to IndexedDB for background sync
   */
  private async saveToIndexedDB(state: UserState): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const openRequest = indexedDB.open('zenjin_state_db', 1);
        
        openRequest.onupgradeneeded = (event) => {
          const db = openRequest.result;
          
          // Create object store if it doesn't exist
          if (!db.objectStoreNames.contains('state_sync')) {
            db.createObjectStore('state_sync', { keyPath: 'id' });
          }
        };
        
        openRequest.onsuccess = (event) => {
          try {
            const db = openRequest.result;
            const transaction = db.transaction(['state_sync'], 'readwrite');
            const store = transaction.objectStore('state_sync');
            
            // Store the state with a unique ID
            const syncItem = {
              id: `state_${state.userId}_${Date.now()}`,
              state,
              timestamp: Date.now()
            };
            
            const request = store.put(syncItem);
            
            request.onsuccess = () => {
              resolve();
            };
            
            request.onerror = (err) => {
              reject(err);
            };
          } catch (err) {
            reject(err);
          }
        };
        
        openRequest.onerror = (err) => {
          reject(err);
        };
      } catch (err) {
        reject(err);
      }
    });
  }
  
  /**
   * Force a sync to the server
   * Called when saving important state or when page is about to unload
   */
  async forceSyncToServer(): Promise<boolean> {
    try {
      // Get a fresh copy of the state to ensure we have the latest
      let state = this.getState();
      
      console.log('STATE MANAGER: forceSyncToServer called with state', JSON.stringify({
        userId: state.userId,
        tubes: Object.keys(state.tubes || {}),
        activeTube: state.activeTube
      }));
      
      // ENHANCED RECOVERY: Make sure we have a valid userId - critical for persistence
      if (!state.userId || state.userId === '') {
        console.error('STATE MANAGER: No userId found in state - attempting multi-stage recovery');
        
        // Recovery mechanism 1: Try to recover userId from localStorage for authenticated users
        if (typeof window !== 'undefined') {
          // Try our specific user ID key first
          const storedUserId = localStorage.getItem('zenjin_user_id');
          if (storedUserId && storedUserId !== '') {
            console.log(`STATE MANAGER: Recovered userId ${storedUserId} from localStorage zenjin_user_id`);
            state.userId = storedUserId;
            
            // Update the internal state with the recovered userId
            this.dispatch({ 
              type: 'INITIALIZE_STATE', 
              payload: { ...state, userId: storedUserId }
            });
          } 
          // Recovery mechanism 2: Check for Supabase authentication token
          else {
            try {
              const supabaseToken = localStorage.getItem('sb-ggwoupzaruiaaliylxga-auth-token');
              if (supabaseToken) {
                const parsedToken = JSON.parse(supabaseToken);
                if (parsedToken?.user?.id) {
                  console.log(`STATE MANAGER: Recovered userId ${parsedToken.user.id} from Supabase token`);
                  state.userId = parsedToken.user.id;
                  
                  // Save to localStorage for future recovery and update internal state
                  try {
                    localStorage.setItem('zenjin_user_id', parsedToken.user.id);
                    console.log(`STATE MANAGER: Saved recovered userId to localStorage for future use`);
                  } catch (storageErr) {
                    console.warn('STATE MANAGER: Could not save userId to localStorage', storageErr);
                  }
                  
                  // Update internal state
                  this.dispatch({
                    type: 'INITIALIZE_STATE',
                    payload: { ...state, userId: parsedToken.user.id }
                  });
                }
              }
            } catch (tokenErr) {
              console.warn('STATE MANAGER: Could not recover from Supabase token', tokenErr);
            }
          }
          
          // Recovery mechanism 3: Check window.__CURRENT_USER_ID__ as last resort
          if ((!state.userId || state.userId === '') && (window as any).__CURRENT_USER_ID__) {
            const globalUserId = (window as any).__CURRENT_USER_ID__;
            console.log(`STATE MANAGER: Recovered userId ${globalUserId} from window.__CURRENT_USER_ID__`);
            state.userId = globalUserId;
            
            // Update internal state
            this.dispatch({
              type: 'INITIALIZE_STATE',
              payload: { ...state, userId: globalUserId }
            });
          }
          
          // Recovery mechanism 4: Generate anonymous ID as final fallback
          if (!state.userId || state.userId === '') {
            const anonymousId = `anonymous-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            console.log(`STATE MANAGER: Generated fallback anonymous ID: ${anonymousId}`);
            state.userId = anonymousId;
            
            // Update internal state
            this.dispatch({
              type: 'INITIALIZE_STATE',
              payload: { ...state, userId: anonymousId }
            });
          }
        } else {
          console.error('STATE MANAGER: Not in browser environment, cannot recover userId');
          return false;
        }
      }
      
      // Check if this is an anonymous user
      const isAnonymousUser = state.userId.startsWith('anonymous-');
      
      // Use the right endpoint based on user type
      const endpoint = isAnonymousUser 
        ? '/api/anonymous-state'
        : '/api/user-state'; // Always use user-state endpoint for authenticated users
      
      console.log(`STATE MANAGER: Using endpoint ${endpoint} for user ${state.userId}`);
      
      // Save to local storage first to ensure we have a backup
      this.saveToLocalStorage(state);
      console.log('STATE MANAGER: State saved to localStorage');
      
      // If available, also save to IndexedDB
      if (typeof window !== 'undefined' && window.indexedDB) {
        try {
          await this.saveToIndexedDB(state);
          console.log('STATE MANAGER: State saved to IndexedDB');
        } catch (idbError) {
          console.warn('Could not save to IndexedDB:', idbError);
        }
      }
      
      // Add debug logging
      console.log(`STATE MANAGER: Sending state to server at ${endpoint}`);
      console.log('STATE MANAGER: State contains tubes:', Object.keys(state.tubes));
      console.log('STATE MANAGER: State contains activeTube:', state.activeTube);
      
      // Use fetch for immediate sync
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          state,
          id: isAnonymousUser ? state.userId : undefined
        }),
        credentials: 'include'
      });
      
      // Handle auth errors by considering local storage a success
      if (!response.ok) {
        console.error(`STATE MANAGER: Server returned error ${response.status} when syncing state`);
        
        try {
          // Try to get the response text to see what's happening
          const responseText = await response.text();
          console.error(`STATE MANAGER: Server response: ${responseText}`);
        } catch (textError) {
          console.error('STATE MANAGER: Could not read response text', textError);
        }
        
        if (response.status === 401 || response.status === 403) {
          console.warn(`STATE MANAGER: Authentication issue (${response.status}) forcing state sync. State saved locally.`);
          return true; // Consider it a success since we saved locally
        }
        throw new Error(`Error syncing state: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('STATE MANAGER: Server sync response:', data);
      
      return data.success === true;
    } catch (err) {
      console.error('STATE MANAGER: Error force syncing state to server:', err);
      console.error('STATE MANAGER: Error details:', err.stack || 'No stack trace');
      
      // Verify the state was at least saved locally
      try {
        const state = this.getState();
        this.saveToLocalStorage(state);
        console.log('STATE MANAGER: State was saved locally despite server sync failure');
        return true; // Consider it a partial success
      } catch (localError) {
        console.error('STATE MANAGER: Failed to save state even locally:', localError);
        return false;
      }
    }
  }
  
  /**
   * Register event handlers for page visibility and unload
   * Ensures state is saved when page is closing
   */
  registerPageEvents(): void {
    if (typeof window !== 'undefined') {
      // Handle page visibility changes
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          // Page is hidden, try to sync
          this.forceSyncToServer();
        }
      });
      
      // Handle page unload
      window.addEventListener('beforeunload', () => {
        this.forceSyncToServer();
      });
      
      // Handle page close
      window.addEventListener('pagehide', () => {
        this.forceSyncToServer();
      });
    }
  }
}

// Export a singleton instance
export const stateManager = new StateManager();