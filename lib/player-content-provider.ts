/**
 * Player Content Provider
 * 
 * This module manages content loading based on user tier:
 * - Anonymous users and free accounts get bundled content only
 * - Premium users get their personalized content from the server
 * 
 * The core principle is that all users without premium accounts 
 * should get exactly the same content experience.
 */

import { UserState } from './state/types';
import { StitchContent } from './client/content-buffer';
import { BUNDLED_FULL_CONTENT } from './expanded-bundled-content';
import { contentBuffer } from './client/content-buffer';

// User tier types
export enum UserTier {
  ANONYMOUS = 'anonymous',
  FREE = 'free',
  PREMIUM = 'premium'
}

/**
 * Determine user tier from user object
 * @param user The user object
 * @returns The user's tier
 */
export function getUserTier(user: any): UserTier {
  if (!user) return UserTier.ANONYMOUS;
  
  // Anonymous users have the isAnonymous flag or anonymous ID
  if (user.isAnonymous || user.id?.startsWith('anonymous-')) {
    return UserTier.ANONYMOUS;
  }
  
  // Check for premium subscription
  // This will depend on your subscription implementation
  if (user.isPremium || user.subscription?.status === 'active') {
    return UserTier.PREMIUM;
  }
  
  // Default to free tier for authenticated users
  return UserTier.FREE;
}

/**
 * Check if a user should use bundled content
 * @param user The user object
 * @returns True if the user should use bundled content
 */
export function shouldUseBundledContent(user: any): boolean {
  const tier = getUserTier(user);
  return tier === UserTier.ANONYMOUS || tier === UserTier.FREE;
}

/**
 * Get a stitch by ID, prioritizing bundled content for non-premium users
 * @param stitchId The stitch ID to fetch
 * @param user The user object
 * @returns The stitch content
 */
export async function getStitchContent(stitchId: string, user: any): Promise<StitchContent | null> {
  // For anonymous and free users, always use bundled content
  if (shouldUseBundledContent(user)) {
    // Check if the stitch is in our bundled content
    if (BUNDLED_FULL_CONTENT[stitchId]) {
      return BUNDLED_FULL_CONTENT[stitchId];
    }
    
    // If not in bundled content, generate fallback stitch
    // This should only happen if there's a misconfiguration
    console.warn(`Stitch ${stitchId} not found in bundled content for non-premium user`);
    return generateFallbackStitch(stitchId);
  }
  
  // For premium users, use the regular content buffer
  try {
    return await contentBuffer.getStitch(stitchId);
  } catch (error) {
    console.error(`Error fetching stitch ${stitchId} for premium user:`, error);
    
    // Fall back to bundled content if available
    if (BUNDLED_FULL_CONTENT[stitchId]) {
      console.log(`Using bundled content as fallback for premium user (stitch ${stitchId})`);
      return BUNDLED_FULL_CONTENT[stitchId];
    }
    
    // Last resort fallback
    return generateFallbackStitch(stitchId);
  }
}

/**
 * Generate a fallback stitch as a last resort
 * @param stitchId The stitch ID
 * @returns A basic stitch with minimal content
 */
function generateFallbackStitch(stitchId: string): StitchContent {
  // Extract tube, thread and stitch number from ID if possible
  const match = stitchId.match(/stitch-T(\d+)-(\d+)-(\d+)/);
  
  if (match) {
    const [_, tubeNum, threadNum, stitchNum] = match;
    
    return {
      id: stitchId,
      threadId: `thread-T${tubeNum}-${threadNum}`,
      title: `Fallback Content for Tube ${tubeNum}`,
      content: `This is automatically generated content for Tube ${tubeNum}.`,
      order: parseInt(stitchNum),
      questions: [
        {
          id: `${stitchId}-fallback-q01`,
          text: 'What is 2 + 2?',
          correctAnswer: '4',
          distractors: {
            L1: '3',
            L2: '5',
            L3: '22'
          }
        }
      ]
    };
  }
  
  // Last resort fallback
  return {
    id: stitchId,
    threadId: 'fallback-thread',
    title: 'Fallback Content',
    content: 'This is automatically generated content.',
    order: 1,
    questions: [
      {
        id: `${stitchId}-fallback-q01`,
        text: 'What is 1 + 1?',
        correctAnswer: '2',
        distractors: {
          L1: '3',
          L2: '11',
          L3: '0'
        }
      }
    ]
  };
}

/**
 * Initialize the content buffer based on user tier
 * @param user The user object
 * @returns True if initialization was successful
 */
export async function initializeContentForUser(user: any): Promise<boolean> {
  try {
    const isNewUser = !user || getUserTier(user) !== UserTier.PREMIUM;
    await contentBuffer.initialize(isNewUser);
    return true;
  } catch (error) {
    console.error('Error initializing content buffer:', error);
    return false;
  }
}

/**
 * Get the in-play stitch for the current user state
 * @param userState The user's state
 * @param user The user object
 * @returns The current in-play stitch
 */
export async function getInPlayStitchForUser(userState: UserState, user: any): Promise<StitchContent | null> {
  // For standard state, the active tube is activeTube
  const activeTubeNumber = userState.activeTube || userState.activeTubeNumber;
  const activeTube = userState.tubes[activeTubeNumber];
  
  if (!activeTube) {
    console.error(`Active tube ${activeTubeNumber} not found in user state`);
    return null;
  }
  
  // Get the stitch using the appropriate source
  return getStitchContent(activeTube.currentStitchId, user);
}