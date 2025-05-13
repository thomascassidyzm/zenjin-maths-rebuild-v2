/**
 * User State Actions for Zustand Store
 * 
 * This file provides functions for handling user state persistence
 * to ensure all API calls go through the Zustand store.
 */

/**
 * Save user state to the server API
 * 
 * @param userId User ID to associate with the state
 * @param stateData State data to persist
 * @param lastUpdated Timestamp of last update
 * @returns Promise resolving to success status
 */
export const saveUserStateToServer = async (
  userId: string,
  stateData: any,
  lastUpdated: string
): Promise<boolean> => {
  if (!userId) {
    console.error('Cannot save state: No user ID provided');
    return false;
  }
  
  try {
    console.log('Saving user state to server API');
    
    // Ensure thread IDs are present for tube-stitch model
    if (stateData?.tubeState?.tubes) {
      Object.keys(stateData.tubeState.tubes).forEach(tubeKey => {
        const tube = stateData.tubeState.tubes[tubeKey];
        
        // If tube is using position-based model but missing threadId
        if (tube.positions && !tube.threadId) {
          // Generate threadId from tubeKey
          tube.threadId = `thread-T${tubeKey}-001`;
          console.log(`Generated threadId ${tube.threadId} for tube ${tubeKey}`);
        }
      });
    }
    
    // Make API request to save state
    const response = await fetch('/api/user-state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        state: stateData,
        lastUpdated
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error saving state to server:', errorData);
      throw new Error(`Server returned ${response.status}: ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    console.log('State saved to server successfully');
    return data.success;
  } catch (error) {
    console.error('Error saving state to server:', error);
    return false;
  }
};

/**
 * Load user state from the server API
 * 
 * @param userId User ID to load state for
 * @returns Promise resolving to the loaded state or null
 */
export const loadUserStateFromServer = async (userId: string): Promise<any | null> => {
  if (!userId) {
    console.error('Cannot load state: No user ID provided');
    return null;
  }
  
  try {
    console.log('Loading user state from server API');
    
    // Make API request to load state
    const response = await fetch(`/api/user-state?userId=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`Error loading state from server: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.success || !data.state) {
      console.log('No state found on server or empty state returned');
      return null;
    }
    
    console.log('State loaded from server successfully');
    return data.state;
  } catch (error) {
    console.error('Error loading state from server:', error);
    return null;
  }
};