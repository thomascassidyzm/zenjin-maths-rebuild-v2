import React, { useEffect, useState } from 'react';
import PlayerComponent from '../components/PlayerComponent';
import { isFeatureEnabled, isAnonymousOrFreeUser } from '../lib/feature-flags';
import { offlineFirstContentBuffer } from '../lib/client/offline-first-content-buffer';

/**
 * Offline-First Test Page
 * 
 * This page allows testing the offline-first implementation with different user types:
 * - Anonymous user (no login)
 * - Free user (logged in but not premium)
 * - Premium user (logged in with premium access)
 * 
 * It verifies that:
 * 1. The app starts immediately without loading screens
 * 2. Content is available offline for anonymous and free users
 * 3. Feature flags are applied correctly for different user types
 */
export default function OfflineFirstTestPage() {
  // States for different user types
  const [userType, setUserType] = useState('anonymous');
  const [mockUser, setMockUser] = useState(null);
  
  // Feature flag status
  const [featureFlags, setFeatureFlags] = useState({});
  
  // Content buffer status
  const [contentStats, setContentStats] = useState({
    stitchCount: 0,
    userTier: '',
    tubeCount: 0
  });
  
  // Update mock user when user type changes
  useEffect(() => {
    let user = null;
    
    switch(userType) {
      case 'free':
        user = {
          id: 'mock-free-user-id',
          email: 'free-user@example.com',
          name: 'Free User',
          isPremium: false
        };
        break;
      case 'premium':
        user = {
          id: 'mock-premium-user-id',
          email: 'premium-user@example.com',
          name: 'Premium User',
          isPremium: true
        };
        break;
      case 'anonymous':
      default:
        user = null;
        break;
    }
    
    setMockUser(user);
    
    // Update feature flags for this user type
    updateFeatureFlags(user);
    
    // Update content buffer status
    updateContentBufferStatus(user);
  }, [userType]);
  
  // Update feature flags display
  const updateFeatureFlags = (user) => {
    const flags = {
      useBundledContentForFreeUsers: isFeatureEnabled('useBundledContentForFreeUsers', user),
      useInfinitePlayMode: isFeatureEnabled('useInfinitePlayMode', user),
      allowAnonymousUsers: isFeatureEnabled('allowAnonymousUsers', user),
      showDebugInfo: isFeatureEnabled('showDebugInfo', user),
      offlineFirstContent: isFeatureEnabled('offlineFirstContent', user),
      offlineFirstStartup: isFeatureEnabled('offlineFirstStartup', user),
      isAnonymousOrFree: isAnonymousOrFreeUser(user)
    };
    
    setFeatureFlags(flags);
  };
  
  // Update content buffer status
  const updateContentBufferStatus = (user) => {
    // Set user tier in the content buffer
    const isNonPremium = isAnonymousOrFreeUser(user);
    offlineFirstContentBuffer.setUserTier(isNonPremium);
    
    // Get stats about the content buffer
    const stats = {
      stitchCount: offlineFirstContentBuffer.getCachedStitchCount(),
      userTier: isNonPremium ? 'anonymous/free' : 'premium',
      tubeCount: 3 // Always 3 tubes in this system
    };
    
    setContentStats(stats);
  };
  
  // Switch user type
  const handleUserTypeChange = (type) => {
    setUserType(type);
  };
  
  return (
    <div className="offline-first-test">
      <h1>Offline-First Implementation Test</h1>
      
      {/* User type selector */}
      <div className="user-selector">
        <h2>Select User Type</h2>
        <div className="button-group">
          <button 
            onClick={() => handleUserTypeChange('anonymous')}
            className={userType === 'anonymous' ? 'active' : ''}
          >
            Anonymous User
          </button>
          <button 
            onClick={() => handleUserTypeChange('free')}
            className={userType === 'free' ? 'active' : ''}
          >
            Free User
          </button>
          <button 
            onClick={() => handleUserTypeChange('premium')}
            className={userType === 'premium' ? 'active' : ''}
          >
            Premium User
          </button>
        </div>
      </div>
      
      {/* Feature flags display */}
      <div className="feature-flags">
        <h2>Feature Flags for {userType} User</h2>
        <ul>
          {Object.entries(featureFlags).map(([flag, value]) => (
            <li key={flag}>
              <strong>{flag}:</strong> {String(value)}
            </li>
          ))}
        </ul>
      </div>
      
      {/* Content buffer status */}
      <div className="content-stats">
        <h2>Content Buffer Status</h2>
        <ul>
          <li><strong>User Tier:</strong> {contentStats.userTier}</li>
          <li><strong>Cached Stitches:</strong> {contentStats.stitchCount}</li>
          <li><strong>Number of Tubes:</strong> {contentStats.tubeCount}</li>
        </ul>
      </div>
      
      {/* Player component */}
      <div className="player-wrapper">
        <h2>Player Component ({userType} User)</h2>
        <p className="instruction">
          The player should start immediately without loading screens, 
          regardless of user type. Anonymous and free users should get identical content.
        </p>
        <PlayerComponent user={mockUser} />
      </div>
      
      {/* CSS */}
      <style jsx>{`
        .offline-first-test {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        h1 {
          color: #333;
          border-bottom: 2px solid #eee;
          padding-bottom: 10px;
        }
        
        h2 {
          color: #555;
          margin-top: 30px;
        }
        
        .user-selector {
          margin: 20px 0;
        }
        
        .button-group {
          display: flex;
          gap: 10px;
        }
        
        button {
          padding: 8px 16px;
          background: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
        }
        
        button.active {
          background: #4a90e2;
          color: white;
          border-color: #2a70c2;
        }
        
        .feature-flags, .content-stats {
          background: #f9f9f9;
          border: 1px solid #eee;
          border-radius: 4px;
          padding: 15px;
          margin-bottom: 20px;
        }
        
        ul {
          list-style-type: none;
          padding: 0;
        }
        
        li {
          margin-bottom: 5px;
        }
        
        .player-wrapper {
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 20px;
          margin-top: 30px;
        }
        
        .instruction {
          color: #666;
          font-style: italic;
          margin-bottom: 20px;
        }
      `}</style>
    </div>
  );
}