/**
 * Anonymous Session Management
 * 
 * Handles session-only functionality for anonymous users
 * with no persistence beyond browser session.
 */

import {
  getAnonymousAccessProfile,
  filterContentByAccess,
  hasReachedTierLimit,
  getTierLimitMessage
} from './tier-manager';

// Generate a unique anonymous user ID
export const generateAnonymousId = (): string => {
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000000);
  return `anonymous-${timestamp}-${randomSuffix}`;
};

// Get thread data filtered for anonymous users
export const getAnonymousThreadData = (allThreadData: any[]): any[] => {
  // Get anonymous access profile and filter content accordingly
  const accessProfile = getAnonymousAccessProfile();
  return filterContentByAccess(allThreadData, accessProfile);
};

// Check if user has reached free tier point limit
export const hasReachedPointLimit = (points: number): boolean => {
  const accessProfile = getAnonymousAccessProfile();
  return accessProfile.maxPoints !== null && points >= accessProfile.maxPoints;
};

// Check if session needs to reset to beginning (when free content is exhausted)
export const shouldResetSession = (completedStitches: number, totalPoints: number): boolean => {
  const accessProfile = getAnonymousAccessProfile();
  return hasReachedTierLimit(completedStitches, totalPoints, accessProfile);
};

// Create login prompt message based on user progress
export const getLoginPromptMessage = (points: number, completedStitches: number): string => {
  const accessProfile = getAnonymousAccessProfile();
  const message = getTierLimitMessage(completedStitches, points, accessProfile);
  return message || "Create an account to save your progress and access more content.";
};