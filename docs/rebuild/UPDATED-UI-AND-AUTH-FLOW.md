# Updated UI and Authentication Flow

*Last Updated: April 29, 2025*

This document outlines the updated UI and authentication flow implemented in the Zenjin Maths application.

## UI Consistency Improvements

### 1. User Welcome Button

We've implemented a consistent user welcome button across all screens with the following features:

- **Consistent Styling**: Same design across home, player, and dashboard pages
- **WhatsApp-Style Status Ticks**:
  - Anonymous users: No ticks
  - Authenticated free users: Two grey ticks
  - Paid premium users: Two blue ticks
- **Display Name Logic**:
  - Shows user's selected display name if available
  - Truncates email username to 10 characters with ellipsis (...) if no display name
  - Shows "Guest" for anonymous users
- **Navigation**: Clicking takes the user directly to the Account tab in the Dashboard

### 2. Simplified Navigation

- **Minimal Player**: Removed all header navigation except for welcome button
- **Dashboard**: Removed unnecessary "Home" and "Refresh" buttons 
- **Authentication Status**: Changed text indicator to checkmark icon

### 3. Color Scheme Consistency

- All loading spinners now use teal color scheme
- Background colors maintained throughout entire page load lifecycle
- Added meta theme-color for browser UI consistency
- Fixed flash transitions between pages

## Authentication Flow Updates

### 1. Sign-In Redirects

All sign-in redirects now point to the home page (`/`) instead of directly to the minimal player:

- Updated in `signin.tsx` to use `/` as default redirect
- Updated in `login-callback.tsx` for all authentication scenarios
- Updated in `dashboard.tsx` for session timeout handling

### 2. Account Management

When users click on their welcome button from any page, they are directed to the Account tab of the dashboard (`/dashboard?tab=account`) where they can:

- Update their display name
- Set a password if using email verification
- Manage their subscription
- Sign out

### 3. Anonymous to Authenticated Transition

The flow for anonymous users transitioning to authenticated users has been improved:

1. Anonymous user plays on the site with "Try Without Signing Up"
2. After engaging with content, they're prompted to create an account
3. Sign-up process using email verification (OTP)
4. Automatic migration of anonymous progress to new authenticated account
5. Redirect to home page where they can continue their journey

## UI Component Implementation

The new UserWelcomeButton component integrates the status indicators with user information:

```typescript
// components/UserWelcomeButton.tsx
import React from 'react';
import { useRouter } from 'next/router';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';

interface UserWelcomeButtonProps {
  user: any; // User object from authentication context
  isAuthenticated: boolean;
}

const UserWelcomeButton: React.FC<UserWelcomeButtonProps> = ({ user, isAuthenticated }) => {
  const router = useRouter();
  const { isSubscribed } = useSubscriptionStatus();
  
  // Function to truncate email or get display name
  const getDisplayName = () => {
    if (!user) return 'Guest';
    
    // Use display name if available
    if (user.user_metadata?.display_name) {
      return user.user_metadata.display_name;
    }
    
    // Truncate email at 10 chars if no display name
    if (user.email) {
      const username = user.email.split('@')[0];
      return username.length > 10 ? `${username.substring(0, 10)}...` : username;
    }
    
    return 'Guest';
  };
  
  // Navigate to account section when clicked
  const handleClick = () => {
    router.push('/dashboard?tab=account');
  };
  
  return (
    <button 
      onClick={handleClick}
      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm flex items-center"
    >
      <span className="mr-2">Hi, {getDisplayName()}</span>
      
      {/* Subscription status ticks (WhatsApp style) */}
      {isAuthenticated && (
        <span className="flex">
          {/* First tick */}
          <svg className={`h-3.5 w-3.5 ${isSubscribed ? 'text-blue-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
          </svg>
          
          {/* Second tick */}
          <svg className={`h-3.5 w-3.5 -ml-1.5 ${isSubscribed ? 'text-blue-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
          </svg>
        </span>
      )}
    </button>
  );
};

export default UserWelcomeButton;
```

## Implementation Details

### Dashboard Tab Navigation

The dashboard now responds to URL query parameters for direct tab access:

```typescript
// pages/dashboard.tsx
// Set active tab from query parameters if available
useEffect(() => {
  if (router.query.tab === 'account') {
    setActiveTab('account');
  }
}, [router.query]);
```

### Flash Prevention

To prevent flash of default colors during page loads:

```css
/* styles/globals.css */
body::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, #0f172a, #1e293b);
  z-index: -1;
}

#__next {
  height: 100%;
  background: linear-gradient(to bottom, #0f172a, #1e293b);
}
```

```tsx
// pages/_app.tsx
<Head>
  <meta name="theme-color" content="#0f172a" />
</Head>
```

## Next Steps

1. **User Account Sync**: Enhance the sync process when a user creates a new account to ensure all anonymous data is properly migrated
2. **Display Name Management**: Add a dedicated API for managing display names with proper validation
3. **Session Management**: Implement better session expiry handling to direct users to the sign-in page when their session expires
4. **Welcome Tour**: Consider adding a welcome tour for new users to highlight key features and navigation