# Anonymous User Flow

This document describes the implementation of the anonymous user flow in the Zenjin Maths application.

## Overview

The anonymous user flow allows visitors to try the Zenjin Maths learning experience without creating an account, while still preserving their progress data in their browser's localStorage. This provides a frictionless entry point for new users to experience the value of the application before committing to creating an account.

## Key Components

### User Identification

- Anonymous users are assigned a unique ID with the format `anon-[timestamp]-[random number]`
- This ID is stored in localStorage as `anonymousId`
- All progress data for the anonymous user is keyed by this ID in localStorage

### Progress Storage

Anonymous user data is stored in localStorage with the following structure:

- `sessionData_[anonymousId]`: Data from the most recent session, including:
  - `totalPoints`: Points earned in the most recent session
  - `blinkSpeed`: Average response time for the most recent session
  - `blinkSpeedTrend`: Trend of response time (steady, improving, declining)
  - `lastSessionDate`: ISO date string of the last session
  - `completedQuestions`: Count of questions completed in the last session

- `progressData_[anonymousId]`: Aggregated progress data, including:
  - `totalPoints`: Total points earned across all sessions
  - `blinkSpeed`: Current average response time
  - `blinkSpeedTrend`: Overall trend of response time
  - `evolution`: Object containing level information:
    - `currentLevel`: Name of the current level (e.g., "Mind Spark")
    - `levelNumber`: Numeric level (1-10)
    - `progress`: Percentage progress within the current level (0-100)
    - `nextLevel`: Name of the next level (e.g., "Thought Weaver")

### Dashboard Experience

The anonymous dashboard (`/anon-dashboard`) provides:

1. A visual representation of the user's progress
2. Evolution level badge showing their current skill level
3. Blink speed indicator showing their response time
4. Total points counter
5. "Continue Learning" button to resume practice
6. Clear call-to-action to create an account and save progress permanently

### Authentication Flow

- Anonymous users can sign up at any time via the "Create Free Account" button
- Their localStorage progress data can be associated with their new account
- After registration, users are automatically redirected to the authenticated dashboard

## Implementation Details

### 1. MinimalDistinctionPlayer Component

The `MinimalDistinctionPlayer` component has been enhanced to:

- Detect anonymous users via the `userId` prop (either null or starting with "anon-")
- Save session results to localStorage for anonymous users
- Include a `saveAnonymousSessionData` helper function that:
  - Stores session data in localStorage with the anonymous user's ID
  - Updates aggregate progress data
  - Calculates evolution level based on total points
- Set the `goDashboard` flag to true in session results to trigger proper redirection

### 2. Minimal Player Page

The `/minimal-player` page has been updated to:

- Detect anonymous users via authentication context and URL query parameters
- Direct anonymous users to `/anon-dashboard` instead of `/dashboard` when completing a session
- Include fallback navigation to ensure users always reach their dashboard

### 3. Anonymous Dashboard

The `/anon-dashboard` page:

- Loads progress data from localStorage using the anonymous ID
- Displays a warning banner about the temporary nature of browser-stored data
- Offers a prominent button to create an account and preserve progress
- Provides a "Continue Learning" button to resume practice
- Redirects authenticated users to the regular dashboard

### 4. Authentication Context

The authentication context supports anonymous users by:

- Providing a `signInAnonymously` function that initializes localStorage with default progress data
- Detecting anonymous IDs and persisting them during registration

## User Flow

1. User visits the site without signing in
2. User clicks "Try for Free" or similar entry point
3. System creates an anonymous ID and initializes localStorage data
4. User completes a learning session
5. Progress data is saved to localStorage
6. User is directed to the anonymous dashboard
7. User can continue learning or create an account to save progress permanently

## Technical Implementation

Key files involved in the anonymous user flow:

- `/components/MinimalDistinctionPlayer.tsx`: Player component with anonymous data saving
- `/pages/minimal-player.tsx`: Entry point for the learning experience 
- `/pages/anon-dashboard.tsx`: Dashboard for anonymous users
- `/context/AuthContext.tsx`: Authentication context with anonymous handling
- `/components/UserWelcomeButton.tsx`: Unified welcome button for all user types

## Future Improvements

1. Implement a way to transfer progress data to server when a user converts to a registered account
2. Add visual indicators showing what data could be lost if not signing up
3. Implement a reminder system to encourage anonymous users to create accounts
4. Track the conversion rate from anonymous to registered users