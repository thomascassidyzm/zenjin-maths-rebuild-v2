import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PlayerWrapper from '../../../components/subscription/PlayerWrapper';
import { useSubscriptionAwarePlayer } from '../../../hooks/useSubscriptionAwarePlayer';
import { AccessLevel } from '../../../lib/freeTierAccess';

// Mock the next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    asPath: '/play'
  })
}));

// Mock the subscription hook
jest.mock('../../../hooks/useSubscriptionAwarePlayer', () => ({
  useSubscriptionAwarePlayer: jest.fn()
}));

// Mock MinimalDistinctionPlayer component
jest.mock('../../../components/MinimalDistinctionPlayer', () => {
  const MinimalDistinctionPlayer = jest.fn(() => (
    <div data-testid="mock-player">Player Component</div>
  ));
  return MinimalDistinctionPlayer;
});

// Mock PremiumContentPaywall component
jest.mock('../../../components/subscription/PremiumContentPaywall', () => {
  const PremiumContentPaywall = jest.fn(() => (
    <div data-testid="mock-paywall">Paywall Component</div>
  ));
  return PremiumContentPaywall;
});

// Mock ContentUpgradePrompt component
jest.mock('../../../components/subscription/ContentUpgradePrompt', () => {
  const ContentUpgradePrompt = jest.fn(() => (
    <div data-testid="mock-upgrade-prompt">Upgrade Prompt</div>
  ));
  return ContentUpgradePrompt;
});

describe('PlayerWrapper Component', () => {
  const mockThread = {
    id: 'thread-1',
    title: 'Test Thread',
    stitches: [
      { id: 'stitch-1', title: 'Stitch 1', position: 0 },
      { id: 'stitch-2', title: 'Stitch 2', position: 1 }
    ]
  };

  const mockProps = {
    thread: mockThread,
    onComplete: jest.fn(),
    onEndSession: jest.fn(),
    questionsPerSession: 10,
    sessionTotalPoints: 0,
    userId: 'user-1'
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the MinimalDistinctionPlayer when user has access', () => {
    // Mock subscription hook to return free access
    (useSubscriptionAwarePlayer as jest.Mock).mockReturnValue({
      showPaywall: false,
      paywallStitch: null,
      subscriptionStatus: { active: false },
      closePaywall: jest.fn()
    });

    render(<PlayerWrapper {...mockProps} />);
    
    expect(screen.getByTestId('mock-player')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-paywall')).not.toBeInTheDocument();
  });

  it('renders the PremiumContentPaywall when user tries to access premium content', () => {
    // Mock subscription hook to return premium content restriction
    (useSubscriptionAwarePlayer as jest.Mock).mockReturnValue({
      showPaywall: true,
      paywallStitch: { id: 'stitch-premium', title: 'Premium Stitch' },
      accessResult: {
        hasAccess: false,
        accessLevel: AccessLevel.FREE,
        reason: 'This content requires a subscription'
      },
      subscriptionStatus: { active: false },
      closePaywall: jest.fn()
    });

    render(<PlayerWrapper {...mockProps} />);
    
    expect(screen.getByTestId('mock-paywall')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-player')).not.toBeInTheDocument();
  });

  it('shows upgrade prompt when approaching free tier limits', () => {
    // Mock subscription hook to show approaching limits
    (useSubscriptionAwarePlayer as jest.Mock).mockReturnValue({
      showPaywall: false,
      paywallStitch: null,
      subscriptionStatus: { active: false },
      closePaywall: jest.fn()
    });

    // Create a thread with 10 stitches to hit the threshold
    const threadWithManyStitches = {
      ...mockThread,
      stitches: Array(10).fill(0).map((_, index) => ({
        id: `stitch-${index}`,
        title: `Stitch ${index}`,
        position: index
      }))
    };

    render(<PlayerWrapper {...mockProps} thread={threadWithManyStitches} />);
    
    expect(screen.getByTestId('mock-player')).toBeInTheDocument();
    expect(screen.getByTestId('mock-upgrade-prompt')).toBeInTheDocument();
  });

  it('does not show upgrade prompt for premium users', () => {
    // Mock subscription hook to return premium access
    (useSubscriptionAwarePlayer as jest.Mock).mockReturnValue({
      showPaywall: false,
      paywallStitch: null,
      subscriptionStatus: { active: true },
      closePaywall: jest.fn()
    });

    // Create a thread with many stitches (would trigger prompt for free users)
    const threadWithManyStitches = {
      ...mockThread,
      stitches: Array(20).fill(0).map((_, index) => ({
        id: `stitch-${index}`,
        title: `Stitch ${index}`,
        position: index
      }))
    };

    render(<PlayerWrapper {...mockProps} thread={threadWithManyStitches} />);
    
    expect(screen.getByTestId('mock-player')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-upgrade-prompt')).not.toBeInTheDocument();
  });
});