# Subscription Integration Guide

This guide explains how to integrate the Stripe subscription system with the Triple-Helix Learning Player, implementing the "first 10 stitches free" model for each tube.

## Overview

The subscription integration includes:

1. **Free tier access control** - Limits access to first 10 stitches in each tube
2. **Subscription-aware Player** - Enhanced player hook that respects subscription status
3. **Premium content paywall** - UI component for converting free users to paid subscribers
4. **Backend API integration** - Modified endpoints to enforce access rules

## Implementation Steps

### 1. Use PlayerWrapper Component (Recommended)

The easiest way to integrate subscription awareness is to use the pre-built PlayerWrapper component:

```tsx
// Import the PlayerWrapper
import PlayerWrapper from '../components/subscription/PlayerWrapper';

// In your component
function PlayPage() {
  // Your existing code to get thread data
  
  return (
    <PlayerWrapper
      thread={thread}
      onComplete={handleComplete}
      onEndSession={handleEndSession}
      questionsPerSession={20}
      sessionTotalPoints={totalPoints}
      userId={userId}
    />
  );
}
```

The PlayerWrapper handles all subscription logic including:
- Free tier limitations
- Premium content paywalls
- Access control
- Upgrade prompts

### 2. Alternative: Replace Player Hook with Subscription-Aware Version

If you need more customization, you can directly use the subscription-aware hook:

```tsx
// Before
import { useTripleHelixPlayer } from '../lib/playerUtils';

// After
import { useSubscriptionAwarePlayer } from '../hooks/useSubscriptionAwarePlayer';

// In your component
const player = useSubscriptionAwarePlayer({ mode: 'default' });
```

### 3. Add Paywall Component to Player

Modify your Player component to include the paywall:

```tsx
import PremiumContentPaywall from '../components/subscription/PremiumContentPaywall';

function MinimalDistinctionPlayer() {
  const player = useSubscriptionAwarePlayer({ mode: 'default' });
  
  // ...existing code...
  
  return (
    <div className="player-container">
      {/* Existing player UI */}
      {/* ... */}
      
      {/* Paywall when trying to access premium content */}
      {player.showPaywall && player.paywallStitch && (
        <PremiumContentPaywall
          contentTitle={`Lesson: ${player.paywallStitch.title || 'Premium Content'}`}
          accessResult={player.accessResult}
          successRedirectUrl={window.location.href}
          onClose={player.closePaywall}
          teaserContent={
            <div className="premium-content-teaser">
              <h3>{player.paywallStitch.title}</h3>
              <p>{player.paywallStitch.content?.substring(0, 100)}...</p>
            </div>
          }
        />
      )}
    </div>
  );
}
```

### 3. Add a Subscription Status Indicator

Add a subscription status indicator to your player UI:

```tsx
function SubscriptionStatusBadge({ player }) {
  if (player.isLoadingSubscription) {
    return <span className="badge loading">Loading...</span>;
  }
  
  if (player.subscriptionStatus?.active) {
    return (
      <span className="badge premium">
        Premium
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  
  return (
    <span className="badge free" onClick={player.goToSubscriptionPage}>
      Free Tier
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
      </svg>
    </span>
  );
}
```

### 4. Add Free/Premium Indicators to Tube Stitches

When displaying the tube navigation, indicate which stitches are premium:

```tsx
{player.tubeStitches.map((stitch, index) => {
  // Check if this stitch requires subscription
  const access = player.checkStitchAccess(stitch);
  const isPremium = !access.hasAccess;
  
  return (
    <div 
      key={stitch.id} 
      className={`stitch-item ${isPremium ? 'premium' : ''}`}
      onClick={() => handleStitchSelect(stitch)}
    >
      <span className="stitch-number">{index + 1}</span>
      <span className="stitch-title">{stitch.title}</span>
      
      {isPremium && (
        <span className="premium-badge">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </span>
      )}
    </div>
  );
})}
```

### 5. Update API Handlers

Ensure your API handlers use the new freeTierAccess utility functions. This is already implemented in the updated `user-stitches.ts` file.

### 6. Add Subscription Page to Your Application

Create a dedicated subscription page in your application:

```tsx
// pages/subscription.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import SubscriptionManager from '../components/subscription/SubscriptionManager';
import { getSubscriptionStatus } from '../lib/client/payments';

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const router = useRouter();
  
  // Success redirect parameter
  const { success } = router.query;
  
  // Load subscription status
  useEffect(() => {
    async function loadStatus() {
      try {
        const status = await getSubscriptionStatus();
        setSubscription(status);
      } catch (error) {
        console.error('Failed to load subscription status:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadStatus();
  }, []);
  
  return (
    <div className="subscription-page container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Upgrade Your Zenjin Maths Experience
      </h1>
      
      {success === 'true' && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
          <p className="font-bold">Thank you for subscribing!</p>
          <p>Your subscription is now active. You now have full access to all content.</p>
        </div>
      )}
      
      <SubscriptionManager 
        redirectToSuccess={`${window.location.origin}/subscription?success=true`}
        redirectToCancel={`${window.location.origin}/subscription?canceled=true`}
      />
      
      <div className="mt-12 bg-gray-100 p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">What's Included in Premium</h2>
        <ul className="space-y-3">
          <li className="flex items-start">
            <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Access to all content in Zenjin Maths (not just the first 10 stitches)</span>
          </li>
          <li className="flex items-start">
            <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Unlimited practice sessions</span>
          </li>
          <li className="flex items-start">
            <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Advanced progression tracking</span>
          </li>
          <li className="flex items-start">
            <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Personalized learning recommendations</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
```

## Environment Setup

Ensure your environment variables are set up correctly:

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Stripe configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret

# Subscription prices (from Stripe Dashboard)
STRIPE_PRICE_MONTHLY=price_monthly_id_from_stripe
STRIPE_PRICE_ANNUAL=price_annual_id_from_stripe
```

## Testing

1. **Test free tier access:**
   - Create a new account without subscription
   - Verify only first 10 stitches in each tube are accessible
   - Verify paywall appears when trying to access other stitches

2. **Test subscription flow:**
   - Click Subscribe button and complete Stripe Checkout
   - Verify webhook processes subscription correctly
   - Verify user now has access to all content

3. **Test subscription cancellation:**
   - Cancel subscription in subscription management page
   - Verify subscription is marked as canceled
   - Verify access remains until end of billing period

## Troubleshooting

### Common Issues

1. **Webhook not working:**
   - Check webhook endpoint in Stripe Dashboard
   - Verify webhook secret is correct
   - Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/payments/webhook`

2. **Payment succeeds but access doesn't update:**
   - Check webhook logs
   - Verify database updates in webhook handler
   - Check subscription status API response

3. **User gets locked out after subscribing:**
   - Refresh subscription status manually
   - Check browser console for errors
   - Verify database subscription flags are set correctly

## Anonymous User Support

The system supports anonymous users who haven't created accounts yet:

1. **Setting Up Anonymous Mode Pages:**
   
   The premium-play.tsx page automatically handles anonymous users:
   
   ```tsx
   // premium-play.tsx
   export default function PremiumPlay() {
     // Create anonymous ID if needed
     useEffect(() => {
       if (!loading && !isAuthenticated && !localStorage.getItem('anonymousId')) {
         const anonymousId = `anon-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
         localStorage.setItem('anonymousId', anonymousId);
       }
     }, [isAuthenticated, loading]);
     
     // Get current user ID (either authenticated or anonymous)
     const currentUserId = isAuthenticated && user?.id 
       ? user.id 
       : (localStorage.getItem('anonymousId') || 'anonymous');
       
     // Then use PlayerWrapper with that ID
     return (
       <PlayerWrapper
         thread={thread}
         userId={currentUserId}
         {...otherProps}
       />
     );
   }
   ```

2. **Anonymous Dashboard:**
   
   Use the AnonymousUpgradePrompt component to encourage sign-ups:
   
   ```tsx
   import AnonymousUpgradePrompt from '../components/subscription/AnonymousUpgradePrompt';
   
   function AnonDashboard() {
     // Load data from localStorage
     const progressData = getProgressFromLocalStorage();
     
     return (
       <div className="dashboard">
         {/* User stats */}
         <div className="stats">...</div>
         
         {/* Upgrade prompt */}
         <AnonymousUpgradePrompt 
           points={progressData?.totalPoints || 0}
           hoursSpent={calculateHoursSpent()}
           onSignUp={() => router.push('/signin?mode=signup')}
         />
       </div>
     );
   }
   ```

3. **Data Persistence:**
   
   Data for anonymous users is stored in localStorage with these keys:
   - `anonymousId`: Unique identifier for the anonymous user
   - `progressData_[anonymousId]`: User progress data including points and evolution
   - `sessionData_[anonymousId]`: Latest session data

## Best Practices

1. **Free Tier Experience:**
   - Show premium content teasers to encourage upgrades
   - Clearly mark which content requires subscription
   - Make subscription benefits obvious
   - Support anonymous users with localStorage persistence

2. **Conversion Optimization:**
   - Place upgrade CTAs at strategic points (end of free stitches, dashboard)
   - Highlight value proposition of subscription
   - Use AnonymousUpgradePrompt to encourage sign-ups
   - Offer annual plan with discount for higher LTV

3. **Payment Experience:**
   - Maintain brand consistency in checkout flow
   - Provide clear success/failure feedback
   - Offer easy subscription management
   - Support smooth transition from anonymous to authenticated user

## Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Supabase Auth Documentation](https://supabase.io/docs/guides/auth)
- [Next.js API Routes Documentation](https://nextjs.org/docs/api-routes/introduction)