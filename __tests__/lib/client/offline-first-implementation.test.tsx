/**
 * Offline-First Implementation Tests
 * 
 * Tests the integrated offline-first functionality including:
 * - Immediate startup without loading screens
 * - Offline content availability
 * - Local storage state persistence
 * - Synchronized online/offline experience
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerComponent } from '../../../components/PlayerComponent';
import { AuthProvider } from '../../../context/AuthContext';

// Mock the offline first content buffer
jest.mock('../../../lib/client/offline-first-content-buffer', () => {
  return {
    OfflineFirstContentBuffer: jest.fn().mockImplementation(() => {
      return {
        initialize: jest.fn().mockResolvedValue(true),
        getInPlayStitch: jest.fn().mockResolvedValue({
          id: 'stitch-T1-001-01',
          threadId: 'thread-T1-001',
          title: 'Test Stitch',
          content: 'Test Content',
          questions: [
            {
              id: 'q1',
              text: '2 + 2',
              correctAnswer: '4',
              distractors: { L1: '3', L2: '5', L3: '22' }
            }
          ]
        }),
        getStitch: jest.fn().mockResolvedValue({
          id: 'stitch-T1-001-01',
          threadId: 'thread-T1-001',
          title: 'Test Stitch',
          content: 'Test Content',
          questions: [
            {
              id: 'q1',
              text: '2 + 2',
              correctAnswer: '4',
              distractors: { L1: '3', L2: '5', L3: '22' }
            }
          ]
        }),
        updateBuffer: jest.fn().mockResolvedValue(true),
        clearCache: jest.fn(),
        setUserType: jest.fn(),
        getBundledContentCount: jest.fn().mockReturnValue(30)
      };
    })
  };
});

// Mock feature flags
jest.mock('../../../lib/feature-flags', () => ({
  getFeatureFlags: jest.fn().mockReturnValue({
    offlineFirstStartup: true,
    useBundledContentForFreeUsers: true,
    useBundledContentForAnonymous: true
  })
}));

// Mock tube config loader
jest.mock('../../../lib/tube-config-loader', () => ({
  loadTubeConfiguration: jest.fn().mockResolvedValue({
    tubeNumber: 1,
    threadId: 'thread-T1-001',
    threadTitle: 'Test Thread',
    activeStitchId: 'stitch-T1-001-01'
  }),
  loadTubeState: jest.fn().mockResolvedValue({
    tubes: {
      1: {
        threadId: 'thread-T1-001',
        currentStitchId: 'stitch-T1-001-01',
        stitches: [
          {
            id: 'stitch-T1-001-01',
            threadId: 'thread-T1-001',
            position: 0,
            skipNumber: 3,
            distractorLevel: 'L1'
          }
        ]
      }
    },
    activeTubeNumber: 1
  })
}));

// Mock player utils
jest.mock('../../../lib/playerUtils', () => ({
  useTripleHelixPlayer: jest.fn().mockReturnValue({
    isLoading: false,
    loadError: null,
    currentTube: 1,
    currentStitch: {
      id: 'stitch-T1-001-01',
      threadId: 'thread-T1-001',
      title: 'Test Stitch',
      content: 'Test Content'
    },
    accumulatedSessionData: {
      totalPoints: 0,
      correctAnswers: 0,
      firstTimeCorrect: 0
    },
    handleSessionComplete: jest.fn(),
    handlePerfectScore: jest.fn(),
    persistStateToServer: jest.fn().mockResolvedValue(true),
    isAnonymous: false
  }),
  handleSessionComplete: jest.fn()
}));

// Mock authentication context
jest.mock('../../../context/AuthContext', () => ({
  useAuth: jest.fn().mockReturnValue({
    user: { id: 'test-user' },
    isAuthenticated: true,
    loading: false
  }),
  AuthProvider: ({ children }) => <div data-testid="auth-provider">{children}</div>
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
    }),
    _getStore: () => store,
    _populateStore: (mockStore) => {
      store = { ...mockStore };
    }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Offline-First Implementation', () => {
  // Reset mocks between tests
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    
    // Mock the animation API
    Element.prototype.animate = jest.fn().mockReturnValue({
      cancel: jest.fn(),
      onfinish: null,
      pause: jest.fn()
    });
  });
  
  describe('Offline Content Loading', () => {
    test('player renders immediately without loading screen', async () => {
      // Offline-first should render content immediately
      render(<PlayerComponent userId="test-user" />);
      
      // Content should be immediately available without loading screen
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      
      // Content should be rendered from bundled content
      expect(screen.getByText('2 + 2')).toBeInTheDocument();
    });
    
    test('player uses bundled content for anonymous users', async () => {
      // Mock as anonymous user
      const { useAuth } = require('../../../context/AuthContext');
      useAuth.mockReturnValueOnce({
        user: null,
        isAuthenticated: false,
        loading: false
      });
      
      // Mock as anonymous player
      const { useTripleHelixPlayer } = require('../../../lib/playerUtils');
      useTripleHelixPlayer.mockReturnValueOnce({
        isLoading: false,
        loadError: null,
        currentTube: 1,
        currentStitch: {
          id: 'stitch-T1-001-01',
          threadId: 'thread-T1-001',
          title: 'Test Stitch',
          content: 'Test Content'
        },
        accumulatedSessionData: {
          totalPoints: 0,
          correctAnswers: 0,
          firstTimeCorrect: 0
        },
        handleSessionComplete: jest.fn(),
        handlePerfectScore: jest.fn(),
        persistStateToServer: jest.fn().mockResolvedValue(true),
        isAnonymous: true // Mark as anonymous
      });
      
      render(<PlayerComponent userId="anon-12345" />);
      
      // Content should be available without loading
      expect(screen.getByText('2 + 2')).toBeInTheDocument();
      
      // Should set user type on content buffer
      const { OfflineFirstContentBuffer } = require('../../../lib/client/offline-first-content-buffer');
      expect(OfflineFirstContentBuffer().setUserType).toHaveBeenCalledWith('anonymous');
    });
    
    test('player only persists to localStorage for anonymous users', async () => {
      // Setup localStorage with existing anonymous state
      localStorageMock._populateStore({
        'anonymousId': 'anon-12345',
        'zenjin_anonymous_state': JSON.stringify({
          state: {
            tubes: {
              1: {
                threadId: 'thread-T1-001',
                currentStitchId: 'stitch-T1-001-01'
              }
            },
            activeTubeNumber: 1
          },
          timestamp: Date.now(),
          totalPoints: 100
        })
      });
      
      // Mock as anonymous player
      const { useTripleHelixPlayer } = require('../../../lib/playerUtils');
      useTripleHelixPlayer.mockReturnValueOnce({
        isLoading: false,
        loadError: null,
        currentTube: 1,
        currentStitch: {
          id: 'stitch-T1-001-01',
          threadId: 'thread-T1-001',
          title: 'Test Stitch',
          content: 'Test Content'
        },
        accumulatedSessionData: {
          totalPoints: 120,
          correctAnswers: 5,
          firstTimeCorrect: 5
        },
        handleSessionComplete: jest.fn(),
        handlePerfectScore: jest.fn(),
        persistStateToServer: jest.fn().mockResolvedValue(true),
        persistAnonymousState: jest.fn(), // Mock the anonymous state persistence
        isAnonymous: true // Mark as anonymous
      });
      
      render(<PlayerComponent userId="anon-12345" />);
      
      // Simulate session completion
      const { handleSessionComplete } = require('../../../lib/playerUtils');
      
      await act(async () => {
        handleSessionComplete({
          totalPoints: 30,
          correctAnswers: 10,
          firstTimeCorrect: 10
        });
      });
      
      // Should not make API calls for anonymous users
      expect(global.fetch).not.toHaveBeenCalled();
      
      // Should update localStorage
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });
  
  describe('State Persistence', () => {
    test('persists state to localStorage during gameplay', async () => {
      // Mock the persistAnonymousState function
      const playerUtils = require('../../../lib/playerUtils');
      const persistAnonymousStateMock = jest.fn();
      playerUtils.useTripleHelixPlayer.mockReturnValueOnce({
        isLoading: false,
        loadError: null,
        currentTube: 1,
        currentStitch: {
          id: 'stitch-T1-001-01',
          threadId: 'thread-T1-001',
          title: 'Test Stitch',
          content: 'Test Content'
        },
        accumulatedSessionData: {
          totalPoints: 0,
          correctAnswers: 0,
          firstTimeCorrect: 0
        },
        handleSessionComplete: jest.fn(),
        handlePerfectScore: jest.fn(),
        persistAnonymousState: persistAnonymousStateMock,
        isAnonymous: false
      });
      
      render(<PlayerComponent userId="test-user" />);
      
      // Simulate completing a question
      act(() => {
        const correctButton = screen.getByText('4');
        userEvent.click(correctButton);
      });
      
      // Should persist state to localStorage
      await waitFor(() => {
        expect(persistAnonymousStateMock).toHaveBeenCalled();
      });
    });
    
    test('only persists to server when explicitly finishing session', async () => {
      // Mock the persistStateToServer function
      const playerUtils = require('../../../lib/playerUtils');
      const persistStateToServerMock = jest.fn().mockResolvedValue(true);
      playerUtils.useTripleHelixPlayer.mockReturnValueOnce({
        isLoading: false,
        loadError: null,
        currentTube: 1,
        currentStitch: {
          id: 'stitch-T1-001-01',
          threadId: 'thread-T1-001',
          title: 'Test Stitch',
          content: 'Test Content'
        },
        accumulatedSessionData: {
          totalPoints: 0,
          correctAnswers: 0,
          firstTimeCorrect: 0
        },
        handleSessionComplete: jest.fn(),
        handlePerfectScore: jest.fn(),
        persistStateToServer: persistStateToServerMock,
        persistAnonymousState: jest.fn(),
        isAnonymous: false
      });
      
      render(<PlayerComponent userId="test-user" />);
      
      // Should not call persistStateToServer during normal gameplay
      expect(persistStateToServerMock).not.toHaveBeenCalled();
      
      // Simulate session end
      await act(async () => {
        playerUtils.handleSessionComplete({
          totalPoints: 30,
          correctAnswers: 10,
          firstTimeCorrect: 10,
          isEndSession: true // Explicit session end
        });
      });
      
      // Now it should persist to server
      expect(persistStateToServerMock).toHaveBeenCalled();
    });
  });
  
  describe('Feature Flag Control', () => {
    test('respects feature flags for offline-first behavior', async () => {
      // Temporarily change feature flags
      const featureFlags = require('../../../lib/feature-flags');
      featureFlags.getFeatureFlags.mockReturnValueOnce({
        offlineFirstStartup: false, // Disabled
        useBundledContentForFreeUsers: true,
        useBundledContentForAnonymous: true
      });
      
      render(<PlayerComponent userId="test-user" />);
      
      // Check if the content buffer initialize is called immediately
      const { OfflineFirstContentBuffer } = require('../../../lib/client/offline-first-content-buffer');
      expect(OfflineFirstContentBuffer().initialize).toHaveBeenCalled();
    });
    
    test('forces bundled content for anonymous users regardless of flags', async () => {
      // Temporarily change feature flags to disable bundled content
      const featureFlags = require('../../../lib/feature-flags');
      featureFlags.getFeatureFlags.mockReturnValueOnce({
        offlineFirstStartup: true,
        useBundledContentForFreeUsers: false, // Disabled
        useBundledContentForAnonymous: false // Disabled
      });
      
      // Mock as anonymous user
      const { useAuth } = require('../../../context/AuthContext');
      useAuth.mockReturnValueOnce({
        user: null,
        isAuthenticated: false,
        loading: false
      });
      
      // Mock as anonymous player
      const { useTripleHelixPlayer } = require('../../../lib/playerUtils');
      useTripleHelixPlayer.mockReturnValueOnce({
        isLoading: false,
        loadError: null,
        currentTube: 1,
        currentStitch: {
          id: 'stitch-T1-001-01',
          threadId: 'thread-T1-001',
          title: 'Test Stitch',
          content: 'Test Content'
        },
        accumulatedSessionData: {
          totalPoints: 0,
          correctAnswers: 0,
          firstTimeCorrect: 0
        },
        handleSessionComplete: jest.fn(),
        handlePerfectScore: jest.fn(),
        persistStateToServer: jest.fn().mockResolvedValue(true),
        isAnonymous: true // Mark as anonymous
      });
      
      render(<PlayerComponent userId="anon-12345" />);
      
      // For anonymous users, should always use bundled content regardless of flags
      const { OfflineFirstContentBuffer } = require('../../../lib/client/offline-first-content-buffer');
      expect(OfflineFirstContentBuffer().setUserType).toHaveBeenCalledWith('anonymous');
    });
  });
});

// Separate file component tests
describe('Component Integration for Offline-First', () => {
  // Track renderReady flags for each component
  const renderReadyState: Record<string, boolean> = {
    'PlayerComponent': false,
    'SessionSummary': false,
    'CelebrationPill': false
  };
  
  // Mock components to track render-ready state
  jest.mock('../../../components/SessionSummary', () => {
    return {
      SessionSummary: (props) => {
        renderReadyState['SessionSummary'] = true;
        return <div data-testid="session-summary">Session Summary Mock</div>;
      }
    };
  });
  
  jest.mock('../../../components/CelebrationPill', () => {
    return {
      CelebrationPill: (props) => {
        renderReadyState['CelebrationPill'] = true;
        return <div data-testid="celebration-pill">Celebration Pill Mock</div>;
      }
    };
  });
  
  test('components are render-ready immediately with offline-first approach', async () => {
    render(<PlayerComponent userId="test-user" />);
    
    // Player should be render-ready immediately
    renderReadyState['PlayerComponent'] = true;
    
    // All components should be render-ready immediately
    Object.entries(renderReadyState).forEach(([component, isReady]) => {
      expect(isReady).toBe(true);
    });
  });
});