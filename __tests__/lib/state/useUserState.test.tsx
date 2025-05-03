import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { useUserState } from '../../../lib/state/useUserState';
import { stateManager } from '../../../lib/state/stateManager';
import { UserState } from '../../../lib/state/types';

// Mock the stateManager module
jest.mock('../../../lib/state/stateManager', () => ({
  stateManager: {
    getState: jest.fn(),
    subscribe: jest.fn(),
    dispatch: jest.fn(),
    initialize: jest.fn(),
    forceSyncToServer: jest.fn()
  }
}));

// Test component that uses the hook
function TestComponent() {
  const { userState, initializeUserState, updateUserState, syncState } = useUserState();

  return (
    <div>
      <div data-testid="user-state">{JSON.stringify(userState)}</div>
      <button onClick={() => initializeUserState('test-user')} data-testid="initialize">
        Initialize
      </button>
      <button 
        onClick={() => {
          if (userState) {
            const newState = { 
              ...userState,
              activeTube: userState.activeTube === 3 ? 1 : userState.activeTube + 1 
            };
            updateUserState(newState);
          }
        }} 
        data-testid="update"
      >
        Update
      </button>
      <button onClick={() => syncState()} data-testid="sync">
        Sync
      </button>
    </div>
  );
}

describe('useUserState', () => {
  const mockInitialState: UserState = {
    userId: 'test-user',
    tubes: {
      1: {
        threadId: 'thread-T1-001',
        currentStitchId: 'stitch-T1-001-01',
        position: 0
      },
      2: {
        threadId: 'thread-T2-001',
        currentStitchId: 'stitch-T2-001-01',
        position: 0
      },
      3: {
        threadId: 'thread-T3-001',
        currentStitchId: 'stitch-T3-001-01',
        position: 0
      }
    },
    activeTube: 1,
    cycleCount: 0,
    points: {
      session: 0,
      lifetime: 0
    },
    lastUpdated: new Date().toISOString()
  };
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock the initial state
    (stateManager.getState as jest.Mock).mockReturnValue(mockInitialState);
    
    // Mock the subscribe function to call the callback immediately with the initial state
    (stateManager.subscribe as jest.Mock).mockImplementation((callback) => {
      callback(mockInitialState);
      return jest.fn(); // Return a mock unsubscribe function
    });
    
    // Mock the initialize function
    (stateManager.initialize as jest.Mock).mockResolvedValue(undefined);
    
    // Mock the forceSyncToServer function
    (stateManager.forceSyncToServer as jest.Mock).mockResolvedValue(true);
  });

  test('should return the initial state from stateManager', async () => {
    render(<TestComponent />);
    
    // Should display the initial state
    const userStateElement = screen.getByTestId('user-state');
    expect(userStateElement.textContent).toContain('test-user');
    expect(userStateElement.textContent).toContain('thread-T1-001');
  });

  test('should subscribe to state changes on mount', () => {
    render(<TestComponent />);
    
    // Should call subscribe once on mount
    expect(stateManager.subscribe).toHaveBeenCalledTimes(1);
  });

  test('should call initialize when initializeUserState is called', async () => {
    render(<TestComponent />);
    
    // Click the initialize button
    await act(async () => {
      screen.getByTestId('initialize').click();
    });
    
    // Should call initialize with the user ID
    expect(stateManager.initialize).toHaveBeenCalledWith('test-user');
  });

  test('should dispatch action and sync when updateUserState is called', async () => {
    render(<TestComponent />);
    
    // Click the update button
    await act(async () => {
      screen.getByTestId('update').click();
    });
    
    // Should call dispatch with INITIALIZE_STATE action
    expect(stateManager.dispatch).toHaveBeenCalledTimes(1);
    const [action] = stateManager.dispatch.mock.calls[0];
    expect(action.type).toBe('INITIALIZE_STATE');
    expect(action.payload.activeTube).toBe(2); // Should increment the active tube
    
    // Should call forceSyncToServer to persist changes
    expect(stateManager.forceSyncToServer).toHaveBeenCalledTimes(1);
  });

  test('should call forceSyncToServer when syncState is called', async () => {
    render(<TestComponent />);
    
    // Click the sync button
    await act(async () => {
      screen.getByTestId('sync').click();
    });
    
    // Should call forceSyncToServer
    expect(stateManager.forceSyncToServer).toHaveBeenCalledTimes(1);
  });

  test('should update state when stateManager notifies subscribers', async () => {
    // Setup a mock subscription callback capture
    let subscriberCallback: ((state: UserState) => void) | null = null;
    (stateManager.subscribe as jest.Mock).mockImplementation((callback) => {
      subscriberCallback = callback;
      return jest.fn(); // Return a mock unsubscribe function
    });
    
    render(<TestComponent />);
    
    // Verify the subscriber callback was captured
    expect(subscriberCallback).not.toBeNull();
    
    // Define an updated state
    const updatedState: UserState = {
      ...mockInitialState,
      activeTube: 2,
      lastUpdated: new Date().toISOString()
    };
    
    // Simulate a state update from the stateManager
    await act(async () => {
      if (subscriberCallback) subscriberCallback(updatedState);
    });
    
    // Should update the displayed state
    const userStateElement = screen.getByTestId('user-state');
    expect(userStateElement.textContent).toContain('"activeTube":2');
  });

  test('should unsubscribe when component unmounts', () => {
    // Create a mock unsubscribe function
    const mockUnsubscribe = jest.fn();
    (stateManager.subscribe as jest.Mock).mockReturnValue(mockUnsubscribe);
    
    const { unmount } = render(<TestComponent />);
    
    // Should subscribe on mount
    expect(stateManager.subscribe).toHaveBeenCalledTimes(1);
    
    // Unmount the component
    unmount();
    
    // Should call the unsubscribe function
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});