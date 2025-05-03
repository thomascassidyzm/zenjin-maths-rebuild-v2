/**
 * Premium Navigation Item Component
 * 
 * A navigation item that shows a premium indicator and handles 
 * access control for premium content.
 */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '@supabase/auth-helpers-react';
import { getSubscriptionStatus } from '../../lib/client/payments';

interface PremiumNavItemProps {
  href: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  className?: string;
}

const PremiumNavItem: React.FC<PremiumNavItemProps> = ({
  href,
  label,
  icon,
  active = false,
  className = ''
}) => {
  const [hasPremium, setHasPremium] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      setHasPremium(false);
      setIsLoading(false);
      return;
    }

    const checkSubscription = async () => {
      try {
        setIsLoading(true);
        const status = await getSubscriptionStatus();
        setHasPremium(status.active);
      } catch (error) {
        console.error('Error checking subscription:', error);
        setHasPremium(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscription();
  }, [user]);

  const handleClick = (e: React.MouseEvent) => {
    if (!hasPremium) {
      e.preventDefault();
      router.push('/subscription');
    }
  };

  const baseClasses = `flex items-center py-2 px-4 rounded-lg transition-colors ${className}`;
  const activeClasses = active 
    ? 'bg-teal-600 text-white' 
    : 'hover:bg-white/10 text-white/80 hover:text-white';
  const disabledClasses = !hasPremium && !isLoading 
    ? 'cursor-pointer opacity-80 hover:bg-white/10' 
    : '';

  return (
    <div className="relative" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <Link 
        href={hasPremium ? href : '/subscription'} 
        onClick={handleClick}
        className={`${baseClasses} ${activeClasses} ${disabledClasses}`}
      >
        {icon && <span className="mr-3">{icon}</span>}
        <span>{label}</span>
        
        {/* Premium indicator */}
        {!isLoading && (
          <span className="ml-2 flex-shrink-0">
            {hasPremium ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                Premium
              </span>
            ) : (
              <svg 
                className="h-4 w-4 text-yellow-400" 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path 
                  fillRule="evenodd" 
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" 
                  clipRule="evenodd" 
                />
              </svg>
            )}
          </span>
        )}
      </Link>

      {/* Tooltip for non-premium users */}
      {showTooltip && !hasPremium && !isLoading && (
        <div className="absolute left-full ml-2 top-0 z-10 w-48 bg-gray-800 text-white text-xs rounded py-1 px-2 shadow-lg">
          This feature requires a premium subscription. Click to subscribe.
        </div>
      )}
    </div>
  );
};

export default PremiumNavItem;