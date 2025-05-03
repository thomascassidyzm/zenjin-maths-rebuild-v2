import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { useContentBuffer } from '../../../lib/client/useContentBuffer';
import { contentBuffer, StitchContent } from '../../../lib/client/content-buffer';
import * as useUserStateModule from '../../../lib/state/useUserState';

// Mock the modules we depend on
jest.mock('../../../lib/client/content-buffer', () => {
  const originalModule = jest.requireActual('../../../lib/client/content-buffer');
  return {
    ...originalModule,
    contentBuffer: {
      initialize: jest.fn().mockResolvedValue(true),
      getInPlayStitch: jest.fn(),
      updateBuffer: jest.fn(),
      getStitch: jest.fn()
    }
  };
});

jest.mock('../../../lib/state/useUserState', () => ({
  useUserState: jest.fn()
}));

// Test component that uses the hook
function TestComponent() {
  const { inPlayStitch, isLoading, error, completeStitch } = useContentBuffer();

  return (
    <div>
      {isLoading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}
      {inPlayStitch && (
        <div data-testid="stitch-content">
          <h2>{inPlayStitch.title}</h2>
          <p>{inPlayStitch.content}</p>
          <button onClick={() => completeStitch(true)} data-testid="complete-success">
            Complete Successfully
          </button>
          <button onClick={() => completeStitch(false)} data-testid="complete-failure">
            Complete With Failure
          </button>
        </div>
      )}
    </div>
  );
}

describe('useContentBuffer', () => {
  const mockUserState = {
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

  const mockStitch: StitchContent = {
    id: 'stitch-T1-001-01',
    threadId: 'thread-T1-001',
    title: 'Addition Facts',
    content: 'Learn addition facts',
    order: 1,
    questions: [
      {
        id: 'q1',
        text: 'What is 2 + 2?',
        correctAnswer: '4',
        distractors: { L1: '3', L2: '5', L3: '22' }
      }
    ]
  };

  const mockUpdateUserState = jest.fn().mockResolvedValue(true);
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock the useUserState hook
    (useUserStateModule.useUserState as jest.Mock).mockReturnValue({
      userState: mockUserState,
      updateUserState: mockUpdateUserState,
      initializeUserState: jest.fn(),
      syncState: jest.fn()
    });
    
    // Mock contentBuffer.getInPlayStitch to return a mock stitch
    (contentBuffer.getInPlayStitch as jest.Mock).mockResolvedValue(mockStitch);
  });

  test('should initialize the content buffer on mount', async () => {
    render(<TestComponent />);
    
    // Should show loading state initially
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    
    // Should call initialize
    expect(contentBuffer.initialize).toHaveBeenCalledTimes(1);
    
    // Should call getInPlayStitch with the user state
    await waitFor(() => {
      expect(contentBuffer.getInPlayStitch).toHaveBeenCalledWith(mockUserState);
    });
  });

  test('should display the in-play stitch when loaded', async () => {
    render(<TestComponent />);
    
    // Wait for the stitch content to be displayed
    await waitFor(() => {
      expect(screen.getByTestId('stitch-content')).toBeInTheDocument();
    });
    
    // Should display the stitch title and content
    expect(screen.getByText('Addition Facts')).toBeInTheDocument();
    expect(screen.getByText('Learn addition facts')).toBeInTheDocument();
  });

  test('should handle loading errors gracefully', async () => {
    // Mock an error when getting the in-play stitch
    (contentBuffer.getInPlayStitch as jest.Mock).mockRejectedValueOnce(new Error('Failed to load'));
    
    render(<TestComponent />);
    
    // Should display an error message
    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });
  });

  test('should update user state when completing a stitch successfully', async () => {
    render(<TestComponent />);
    
    // Wait for the stitch content to be loaded
    await waitFor(() => {
      expect(screen.getByTestId('stitch-content')).toBeInTheDocument();
    });
    
    // Click the complete successfully button
    await act(async () => {
      screen.getByTestId('complete-success').click();
    });
    
    // Should call updateUserState with the updated state
    expect(mockUpdateUserState).toHaveBeenCalledTimes(1);
    
    // The updated state should advance to the next tube
    const updatedState = mockUpdateUserState.mock.calls[0][0];
    expect(updatedState.activeTube).toBe(2); // Advanced from tube 1 to tube 2
    
    // Should reload the in-play stitch after completion
    expect(contentBuffer.getInPlayStitch).toHaveBeenCalledTimes(2);
  });

  test('should update user state when completing a stitch with failure', async () => {
    render(<TestComponent />);
    
    // Wait for the stitch content to be loaded
    await waitFor(() => {
      expect(screen.getByTestId('stitch-content')).toBeInTheDocument();
    });
    
    // Click the complete with failure button
    await act(async () => {
      screen.getByTestId('complete-failure').click();
    });
    
    // Should call updateUserState with the updated state
    expect(mockUpdateUserState).toHaveBeenCalledTimes(1);
    
    // The updated state should advance to the next tube
    const updatedState = mockUpdateUserState.mock.calls[0][0];
    expect(updatedState.activeTube).toBe(2); // Advanced from tube 1 to tube 2
    
    // Should reload the in-play stitch after completion
    expect(contentBuffer.getInPlayStitch).toHaveBeenCalledTimes(2);
  });

  test('should update buffer in the background after loading stitch', async () => {
    render(<TestComponent />);
    
    // Wait for the stitch content to be loaded
    await waitFor(() => {
      expect(screen.getByTestId('stitch-content')).toBeInTheDocument();
    });
    
    // Should call updateBuffer to load upcoming stitches
    expect(contentBuffer.updateBuffer).toHaveBeenCalledWith(mockUserState);
  });
});