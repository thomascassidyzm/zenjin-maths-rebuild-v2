# Shared Device Considerations

## Overview

This document outlines the design considerations and implementation details for supporting multiple users on shared devices (such as family computers, school computers, or shared tablets).

## The Problem

When multiple people use the same device to access Zenjin Maths, several issues can arise:

1. **Session Leakage**: One user might see another user's content or progress
2. **Authentication Confusion**: The app might use existing authentication cookies
3. **Browser State Persistence**: localStorage might contain mixed data from different users
4. **Privacy Concerns**: One user might accidentally access another user's account

## Solution Design

Our solution implements a clear separation between anonymous ("Guest") and authenticated sessions, with explicit UI elements to help users understand and control which mode they're using.

### 1. Forced Anonymous Mode

We've added a `force=true` parameter that allows users to explicitly use the anonymous mode **even when logged in**. This ensures that:

- Users can choose to use the app without their account credentials
- Parents can let children use the app without logging out
- Teachers can demonstrate the app without using their personal accounts

### 2. Clear Mode Indicators

The UI now clearly shows which mode is active:

- "Guest Mode" badge on the anonymous dashboard
- Special notification banner when logged-in users view anonymous content
- Different styling for the user welcome button when in forced anonymous mode
- Clear "Switch to My Account" button when authenticated users view anonymous content

### 3. Session Management

The app now properly handles session transitions:

- Anonymous session data is isolated in localStorage with a unique ID
- The "Start Fresh Session" button allows users to completely reset anonymous progress
- API calls are skipped for anonymous users to prevent errors and improve performance
- Proper redirects ensure users stay in their chosen mode until explicitly switching

### 4. Implementation Details

#### New Helper Functions

We've created a dedicated `anonymousData.ts` utility with functions for:

- Creating anonymous user IDs
- Retrieving and storing anonymous progress
- Clearing all anonymous data
- Starting fresh anonymous sessions

#### User Interface Updates

1. **Anonymous Dashboard:**
   - Added a banner for authenticated users viewing anonymous content
   - Implemented a "Start Fresh Session" button
   - Added "Guest Mode" badge to the header
   - Created button to switch between authenticated and anonymous modes

2. **Welcome Button:**
   - Now displays "Anonymous Mode" when in forced anonymous mode
   - Shows appropriate verification indicators based on mode
   - Maintains correct navigation based on current mode

3. **Minimal Player:**
   - Respects the `force=true` parameter to maintain anonymous mode
   - Properly redirects to the correct dashboard based on mode
   - Skips unnecessary API calls for anonymous users

## Usage Scenarios

### 1. Family Computer

A parent (authenticated user) can:
- Use their account normally for their own learning
- Let their child use the app in Guest Mode by clicking "Continue Playing" on the anonymous dashboard
- Switch back to their account when needed with the "Switch to My Account" button

### 2. Classroom Setting

A teacher can:
- Create a fresh anonymous session for each student using the "Start Fresh Session" button
- Avoid exposing their personal account by using forced anonymous mode
- Quickly reset progress between student sessions

### 3. Privacy-Conscious Users

Users concerned about privacy can:
- Use the app without creating an account
- Start fresh sessions to remove previous progress
- Understand exactly what data is being stored (via clear UI indicators)

## Testing Considerations

When testing this functionality, consider these scenarios:

1. **Browser Cache Tests**
   - Try with both empty and populated browser caches
   - Test with and without existing authentication cookies
   - Verify localStorage isolation between modes

2. **User Flow Tests**
   - Test transitioning from anonymous to authenticated and back
   - Verify that progress data is maintained separately
   - Check that "Start Fresh Session" properly resets all anonymous data

3. **Shared Device Simulation**
   - Simulate multiple users on the same device
   - Test with browser sessions left open between users
   - Verify no data leakage between different anonymous sessions

## Future Improvements

1. Consider adding a time-based expiration to anonymous sessions
2. Implement a dedicated "Family Mode" with parental controls
3. Add multi-profile support with PIN protection for shared devices
4. Create a session timeout feature for public computers