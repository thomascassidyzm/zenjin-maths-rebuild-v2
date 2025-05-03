/**
 * User Welcome Button Component
 * 
 * A consistent welcome button design across all screens with WhatsApp-style status ticks:
 * - Anonymous users: No ticks
 * - Authenticated free users: Two grey ticks
 * - Paid premium users: Two blue ticks
 */
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
  
  // Navigate to appropriate dashboard when clicked
  const handleClick = () => {
    if (isAuthenticated) {
      router.push('/dashboard?tab=account');
    } else {
      router.push('/anon-dashboard');
    }
  };
  
  // Check if this is a forced anonymous session
  const isForcedAnonymous = typeof window !== 'undefined' && 
    window.location.href.includes('mode=anonymous') &&
    window.location.href.includes('force=true');
  
  return (
    <button 
      onClick={handleClick}
      className={`px-4 py-2 ${isForcedAnonymous ? 'bg-amber-600/30 hover:bg-amber-500/30' : 'bg-white/10 hover:bg-white/20'} text-white rounded-lg transition-colors text-sm flex items-center`}
    >
      <span className="mr-2">
        {isForcedAnonymous ? 'Anonymous Mode' : `Hi, ${getDisplayName()}`}
        {isAuthenticated && isForcedAnonymous && <span className="ml-1 text-amber-300">(Account Available)</span>}
      </span>
      
      {/* Subscription status ticks (WhatsApp style) */}
      {isAuthenticated && !isForcedAnonymous && (
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
      
      {/* Anonymous indicator */}
      {isForcedAnonymous && (
        <span className="ml-1 text-amber-300 text-xs">
          (Guest)
        </span>
      )}
    </button>
  );
};

export default UserWelcomeButton;