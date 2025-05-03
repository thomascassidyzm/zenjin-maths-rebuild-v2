# Subscription Implementation Plan

## Overview

This document outlines the plan for implementing subscription features in Zenjin Maths following the recent reversion to a stable player build. The implementation will follow strict isolation principles to ensure zero impact on the core player functionality.

## Design Principles

1. **Complete Feature Flag Control**: All subscription code will be behind feature flags
2. **Isolated State Management**: Subscription state will not interfere with player state
3. **Progressive Enhancement**: Features will be added as enhancements, not core requirements
4. **Defensive Coding**: All subscription code will defensively check for feature flags before execution
5. **Comprehensive Testing**: Testing will cover all scenarios with subscription features on and off

## Implementation Phases

### Phase 1: Foundation (Without Modifying Player)

1. **Feature Flag Setup**
   - Add `ENABLE_SUBSCRIPTION_FEATURES` environment variable
   - Add flag to `feature-flags.ts`
   - Add conditional exports to prevent code execution when disabled

2. **Subscription Context**
   - Create isolated `SubscriptionContext.tsx`
   - Implement basic tier management (`free`, `basic`, `premium`)
   - Create feature definitions per tier
   - Implement feature access checks

3. **UI Components**
   - Create `FeatureCheck` component for conditional rendering
   - Create `SubscriptionStatusIndicator` component
   - Update `PremiumNavItem` component

4. **API Endpoints**
   - Implement `/api/payments/subscription-status.ts` endpoint
   - Add mock data for testing

### Phase 2: Integration (Minimal Player Touches)

1. **Application Provider**
   - Add conditional SubscriptionProvider to `_app.tsx`
   - Use feature flag to conditionally render provider
   - Create a Conditional HOC to wrap components that need subscription access

2. **Protected Routes**
   - Implement subscription checking for premium content pages
   - Create higher-order component for route protection

3. **Demo Pages**
   - Create `/subscription-demo` page
   - Add demonstration UI for all subscription features

4. **Testing**
   - Implement comprehensive tests for all subscription components
   - Test player functionality with subscription features enabled/disabled

### Phase 3: Payment Integration

1. **Stripe Integration**
   - Complete Stripe API integration
   - Implement checkout flow
   - Add subscription management UI

2. **User Profile**
   - Add subscription information to user profile
   - Create subscription management interface

3. **Analytics**
   - Track subscription conversion events
   - Monitor feature usage by subscription tier

## Technical Architecture

```
lib/
  └── context/
      └── SubscriptionContext.tsx (Isolated context)
  └── feature-flags.ts (Add subscription flag)
  └── subscription/
      └── tier-features.ts (Feature definitions)
      └── subscription-api.ts (API client)

components/
  └── subscription/
      └── FeatureCheck.tsx (Conditional rendering)
      └── SubscriptionStatusIndicator.tsx (Status display)
      └── PlanSelector.tsx (Plan selection)
  
pages/
  └── _app.tsx (Conditional provider)
  └── subscription/
      └── index.tsx (Plans page)
      └── manage.tsx (Management page)
      └── success.tsx (Success page)
      └── cancel.tsx (Cancellation page)
  └── subscription-demo.tsx (Feature showcase)

pages/api/
  └── payments/
      └── subscription-status.ts (Status endpoint)
      └── create-checkout.ts (Checkout endpoint)
      └── webhook.ts (Stripe webhook)
```

## Integration Guidelines

When integrating with the player:

1. **Never modify player directly**:
   ```tsx
   // INCORRECT - modifies player directly
   <PlayerProvider subscription={subscriptionData}>
   
   // CORRECT - keeps player unchanged
   <FeatureCheck feature="advancedAnalytics">
     <AdvancedPlayerControls />
   </FeatureCheck>
   ```

2. **Use conditional rendering**:
   ```tsx
   {ENABLE_SUBSCRIPTION_FEATURES && isSubscribed && (
     <PremiumFeature />
   )}
   ```

3. **Feature check component pattern**:
   ```tsx
   <FeatureCheck 
     feature="practiceMode"
     fallback={<UpgradePrompt />}
   >
     <PracticeMode />
   </FeatureCheck>
   ```

## Testing Requirements

1. **Player functionality** must be verified with subscription features enabled/disabled
2. **Feature access** must be correctly limited based on subscription tier
3. **Stripe integration** must handle all edge cases (cancellation, expiration, etc.)
4. **Performance impact** must be measured with subscription features enabled

## Timeline

1. **Phase 1**: 1-2 days - Foundation without player modification
2. **Phase 2**: 2-3 days - Integration with minimal player touches
3. **Phase 3**: 3-5 days - Payment integration and final testing

Total estimated time: 6-10 days

## Success Criteria

1. Player functionality works identically with subscription features on/off
2. Users can subscribe to different tiers with Stripe
3. Feature access is correctly limited based on subscription tier
4. Subscription status is clearly displayed throughout the application
5. No performance degradation with subscription features enabled