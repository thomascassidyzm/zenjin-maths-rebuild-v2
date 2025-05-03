/**
 * MinimalDistinctionPlayer Component Tests
 * 
 * Tests the question presentation and interaction logic for the main player component.
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MinimalDistinctionPlayer from '../../components/MinimalDistinctionPlayer';

// Mock the bonusCalculator
jest.mock('../../lib/bonusCalculator', () => ({
  calculateBonuses: jest.fn(() => ({
    consistency: 0.2,
    speed: 0.1,
    accuracy: 0.1,
    mastery: 0.1,
    isEligible: true,
    messages: ['Great consistency!']
  })),
  calculateTotalPoints: jest.fn(() => ({
    totalPoints: 30,
    multiplier: 1.5
  })),
  calculateBasePoints: jest.fn((firstTimeCorrect, eventuallyCorrect) => 
    (firstTimeCorrect * 3) + (eventuallyCorrect * 1))
}));

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key]),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.__SESSION_STATS__
Object.defineProperty(window, '__SESSION_STATS__', {
  value: {},
  writable: true
});

// Mock fetch API
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true })
  })
);

// Sample thread data for testing
const mockThread = {
  id: 'thread-T1-001',
  title: 'Addition Facts',
  stitches: [
    {
      id: 'stitch-T1-001-01',
      threadId: 'thread-T1-001',
      title: 'Addition Facts 1-10',
      content: 'Learn basic addition facts with numbers 1-10',
      questions: [
        {
          id: 'q1',
          text: '2 + 2',
          correctAnswer: '4',
          distractors: {
            L1: '3',
            L2: '5',
            L3: '22'
          }
        },
        {
          id: 'q2',
          text: '3 + 5',
          correctAnswer: '8',
          distractors: {
            L1: '7',
            L2: '6',
            L3: '35'
          }
        },
        {
          id: 'q3',
          text: '4 + 6',
          correctAnswer: '10',
          distractors: {
            L1: '9',
            L2: '8',
            L3: '46'
          }
        }
      ]
    }
  ]
};

describe('MinimalDistinctionPlayer', () => {
  // Reset mocks between tests
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    window.__SESSION_STATS__ = {};
    
    // Reset global fetch mock
    global.fetch.mockClear();
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    );
    
    // Mock the animation API
    Element.prototype.animate = jest.fn().mockReturnValue({
      cancel: jest.fn(),
      onfinish: null,
      pause: jest.fn()
    });
  });

  test('should render without crashing', () => {
    render(
      <MinimalDistinctionPlayer
        thread={mockThread}
        onComplete={jest.fn()}
        questionsPerSession={3}
        sessionTotalPoints={0}
      />
    );
    
    // Should show the first question
    expect(screen.getByText('2 + 2')).toBeInTheDocument();
  });

  test('should show options for the current question', () => {
    render(
      <MinimalDistinctionPlayer
        thread={mockThread}
        onComplete={jest.fn()}
        questionsPerSession={3}
        sessionTotalPoints={0}
      />
    );
    
    // Should show the correct answer and one distractor
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('should handle correct answer selection', async () => {
    // Create a jest mock for onComplete callback
    const onCompleteMock = jest.fn();
    
    render(
      <MinimalDistinctionPlayer
        thread={mockThread}
        onComplete={onCompleteMock}
        questionsPerSession={3}
        sessionTotalPoints={0}
      />
    );
    
    // Find the correct answer button and click it
    const correctButton = screen.getByText('4');
    await act(async () => {
      userEvent.click(correctButton);
    });
    
    // Should show next question after delay
    await waitFor(() => {
      expect(screen.getByText('3 + 5')).toBeInTheDocument();
    }, { timeout: 2000 });
    
    // Points should increase
    expect(screen.getByText('3')).toBeInTheDocument(); // 3 points for correct first-time answer
  });

  test('should handle incorrect answer selection', async () => {
    render(
      <MinimalDistinctionPlayer
        thread={mockThread}
        onComplete={jest.fn()}
        questionsPerSession={3}
        sessionTotalPoints={0}
      />
    );
    
    // Find the incorrect answer button and click it
    const incorrectButton = screen.getByText('3');
    await act(async () => {
      userEvent.click(incorrectButton);
    });
    
    // Should show the correct equation
    await waitFor(() => {
      expect(screen.getByText('2 + 2 = 4')).toBeInTheDocument();
    });
    
    // After a delay, it should repeat the same question
    await waitFor(() => {
      // Should get the same question again, not the next one
      expect(screen.getByText('2 + 2')).toBeInTheDocument();
    }, { timeout: 2000 });
    
    // Points should not increase for incorrect answer
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  test('should complete session after all questions are answered', async () => {
    // Create a jest mock for onComplete callback
    const onCompleteMock = jest.fn();
    
    render(
      <MinimalDistinctionPlayer
        thread={mockThread}
        onComplete={onCompleteMock}
        questionsPerSession={3}
        sessionTotalPoints={0}
      />
    );
    
    // Answer all 3 questions correctly
    const questions = mockThread.stitches[0].questions;
    
    for (let i = 0; i < questions.length; i++) {
      // Wait for the question to appear and find the correct answer
      const correctAnswer = questions[i].correctAnswer;
      
      await waitFor(() => {
        expect(screen.getByText(correctAnswer)).toBeInTheDocument();
      });
      
      // Click the correct answer
      const correctButton = screen.getByText(correctAnswer);
      await act(async () => {
        userEvent.click(correctButton);
      });
      
      // Wait for the next question or completion
      await waitFor(() => {}, { timeout: 1500 });
    }
    
    // Session should be completed after all questions
    await waitFor(() => {
      expect(onCompleteMock).toHaveBeenCalled();
    }, { timeout: 2000 });
    
    // Check if the completion data is correct
    const completionData = onCompleteMock.mock.calls[0][0];
    expect(completionData.threadId).toBe(mockThread.id);
    expect(completionData.stitchId).toBe(mockThread.stitches[0].id);
    expect(completionData.totalQuestions).toBe(3);
    expect(completionData.correctAnswers).toBe(3);
    expect(completionData.firstTimeCorrect).toBe(3);
    expect(completionData.totalPoints).toBe(9); // 3 questions * 3 points each
  });

  test('should handle manual session end with "Finish" button', async () => {
    // Create jest mocks for callbacks
    const onCompleteMock = jest.fn();
    const onEndSessionMock = jest.fn();
    
    render(
      <MinimalDistinctionPlayer
        thread={mockThread}
        onComplete={onCompleteMock}
        onEndSession={onEndSessionMock}
        questionsPerSession={3}
        sessionTotalPoints={0}
      />
    );
    
    // Answer the first question correctly
    const correctButton = screen.getByText('4');
    await act(async () => {
      userEvent.click(correctButton);
    });
    
    // Wait for the first question to be processed
    await waitFor(() => {
      expect(screen.getByText('3 + 5')).toBeInTheDocument();
    }, { timeout: 2000 });
    
    // Find and click the "Finish" button
    const finishButton = screen.getByText('Finish');
    await act(async () => {
      userEvent.click(finishButton);
    });
    
    // Session summary should appear
    await waitFor(() => {
      expect(screen.getByText('Session Complete!')).toBeInTheDocument();
    });
    
    // Should show the base points section
    expect(screen.getByText('Base Points:')).toBeInTheDocument();
    
    // Click "Continue" to see bonus multipliers
    const continueButton = screen.getByText('Continue');
    await act(async () => {
      userEvent.click(continueButton);
    });
    
    // Should show bonus multipliers section
    await waitFor(() => {
      expect(screen.getByText('Bonus Multipliers')).toBeInTheDocument();
    });
    
    // Click "Continue" again to see final totals
    const continueButton2 = screen.getByText('Continue');
    await act(async () => {
      userEvent.click(continueButton2);
    });
    
    // Should show total points section
    await waitFor(() => {
      expect(screen.getByText('Total Points Earned')).toBeInTheDocument();
    });
    
    // Find and click "Go to Dashboard" button
    const dashboardButton = screen.getByText('Go to Dashboard');
    await act(async () => {
      userEvent.click(dashboardButton);
    });
    
    // onEndSession should be called with session stats
    expect(onEndSessionMock).toHaveBeenCalled();
    
    // API calls should be made for non-anonymous users
    expect(global.fetch).toHaveBeenCalledWith('/api/record-session', expect.anything());
    expect(global.fetch).toHaveBeenCalledWith('/api/end-session', expect.anything());
  });

  test('should handle anonymous user mode correctly', async () => {
    render(
      <MinimalDistinctionPlayer
        thread={mockThread}
        onComplete={jest.fn()}
        onEndSession={jest.fn()}
        questionsPerSession={3}
        sessionTotalPoints={0}
        userId="anon-12345"
      />
    );
    
    // Answer the first question correctly
    const correctButton = screen.getByText('4');
    await act(async () => {
      userEvent.click(correctButton);
    });
    
    // Wait for the next question
    await waitFor(() => {
      expect(screen.getByText('3 + 5')).toBeInTheDocument();
    }, { timeout: 2000 });
    
    // Find and click the "Finish" button
    const finishButton = screen.getByText('Finish');
    await act(async () => {
      userEvent.click(finishButton);
    });
    
    // Session summary should appear
    await waitFor(() => {
      expect(screen.getByText('Session Complete!')).toBeInTheDocument();
    });
    
    // Continue through the summary
    await act(async () => {
      userEvent.click(screen.getByText('Continue'));
      await waitFor(() => {
        expect(screen.getByText('Bonus Multipliers')).toBeInTheDocument();
      });
      
      userEvent.click(screen.getByText('Continue'));
      await waitFor(() => {
        expect(screen.getByText('Total Points Earned')).toBeInTheDocument();
      });
      
      // For anonymous users, "Sign Up" button should be visible
      expect(screen.getByText('Sign Up to Save Progress')).toBeInTheDocument();
    });
    
    // Should store data in localStorage, not make API calls
    expect(localStorageMock.setItem).toHaveBeenCalled();
    
    // Anonymous users skip the API calls
    expect(global.fetch).not.toHaveBeenCalledWith('/api/record-session', expect.anything());
    expect(global.fetch).not.toHaveBeenCalledWith('/api/end-session', expect.anything());
  });

  test('should handle timeout when no answer is selected', async () => {
    jest.useFakeTimers();
    
    render(
      <MinimalDistinctionPlayer
        thread={mockThread}
        onComplete={jest.fn()}
        questionsPerSession={3}
        sessionTotalPoints={0}
      />
    );
    
    // Simulate timer completion
    const handleTimeout = jest.spyOn(HTMLElement.prototype, 'animate').mock.results[0].value.onfinish;
    
    // Manually trigger the onfinish callback
    act(() => {
      if (handleTimeout) handleTimeout();
    });
    
    // Advance timers to trigger timeout handling
    act(() => {
      jest.advanceTimersByTime(5100);
    });
    
    // Should show the correct answer
    await waitFor(() => {
      expect(screen.getByText('2 + 2 = 4')).toBeInTheDocument();
    });
    
    // After a delay, it should repeat the same question
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    
    await waitFor(() => {
      expect(screen.getByText('2 + 2')).toBeInTheDocument();
    });
    
    // No points should be awarded for timeout
    expect(screen.getByText('0')).toBeInTheDocument();
    
    jest.useRealTimers();
  });

  test('should show loading state when stitch data is not ready', () => {
    // Render with undefined stitches
    const incompleteThread = {
      id: 'thread-incomplete',
      title: 'Incomplete Thread',
      stitches: []
    };
    
    render(
      <MinimalDistinctionPlayer
        thread={incompleteThread}
        onComplete={jest.fn()}
        questionsPerSession={3}
        sessionTotalPoints={0}
      />
    );
    
    // Should show loading message
    expect(screen.getByText('No questions available')).toBeInTheDocument();
  });
});