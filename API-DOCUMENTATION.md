# API Documentation for Zenjin Maths

This document explains the API endpoints available in the Zenjin Maths application, covering authentication, data persistence, and synchronization operations.

## Authentication API Endpoints

As part of the API rebuild, we've implemented a robust authentication layer with the following endpoints:

### Authentication Endpoints

#### 1. Send Magic Link (`/api/auth/magic-link`)

Sends a magic link or one-time password (OTP) to a user's email for passwordless authentication.

```json
POST /api/auth/magic-link
{
  "email": "user@example.com"
}

Response:
{
  "success": true,
  "message": "Verification email sent"
}
```

#### 2. Verify OTP (`/api/auth/verify`)

Verifies the one-time password (OTP) from the user's email and creates an authenticated session.

```json
POST /api/auth/verify
{
  "email": "user@example.com",
  "code": "123456"
}

Response:
{
  "success": true,
  "message": "Successfully verified",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com"
  }
}
```

#### 3. Create/Update Profile (`/api/auth/create-profile`)

Creates or updates a user profile after successful authentication. If an anonymous ID is provided, any data associated with the anonymous user is migrated to the authenticated account.

```json
POST /api/auth/create-profile
{
  "displayName": "User Name",
  "anonymousId": "anonymous-id-from-localstorage"
}

Response:
{
  "success": true,
  "message": "Profile created successfully"
}
```

#### 4. Sign Out (`/api/auth/signout`)

Ends the user's authenticated session and clears session cookies.

```json
POST /api/auth/signout
{}

Response:
{
  "success": true,
  "message": "Successfully signed out"
}
```

#### 5. Update Email (`/api/auth/update-email`)

Updates the authenticated user's email address. This sends a confirmation email to the new address.

```json
POST /api/auth/update-email
{
  "email": "newemail@example.com",
  "password": "current-password" // Optional, for re-authentication
}

Response:
{
  "success": true,
  "message": "Email update initiated. Please check your new email for verification."
}
```

#### 6. Update Password (`/api/auth/update-password`)

Updates the authenticated user's password. Requires the current password for verification.

```json
POST /api/auth/update-password
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}

Response:
{
  "success": true,
  "message": "Password updated successfully"
}
```

#### 7. Set Initial Password (`/api/auth/set-password`)

Sets an initial password for a user who signed in via magic link/OTP and doesn't have a password yet.

```json
POST /api/auth/set-password
{
  "password": "new-password"
}

Response:
{
  "success": true,
  "message": "Password set successfully"
}
```

#### 8. Reset Password (`/api/auth/reset-password`)

Initiates a password reset flow for a user who has forgotten their password. Sends a reset email.

```json
POST /api/auth/reset-password
{
  "email": "user@example.com"
}

Response:
{
  "success": true,
  "message": "Password reset instructions sent to your email"
}
```

### User Profile Endpoints

#### 1. Get User Profile (`/api/user/profile`)

Retrieves the authenticated user's profile information.

```json
GET /api/user/profile

Response:
{
  "success": true,
  "profile": {
    "id": "user-uuid",
    "displayName": "User Name",
    "totalPoints": 150,
    "avgBlinkSpeed": 2.5,
    "evolutionLevel": 1,
    "totalSessions": 5,
    "lastSessionDate": "2025-04-26T12:34:56Z",
    "createdAt": "2025-04-20T10:00:00Z",
    "updatedAt": "2025-04-26T12:34:56Z"
  }
}
```

#### 2. Update User Profile (`/api/user/update-profile`)

Updates the authenticated user's profile information.

```json
POST /api/user/update-profile
{
  "displayName": "New Name",
  "totalPoints": 200,
  "avgBlinkSpeed": 3.0,
  "evolutionLevel": 2,
  "totalSessions": 10
}

Response:
{
  "success": true,
  "message": "Profile updated successfully"
}
```

## Data Persistence Endpoints

These endpoints handle saving sessions and tracking progress in the learning journey.

### Session Recording

#### 1. Record Session (`/api/sessions/record`)

Records a completed learning session, including questions, answers, and points earned.

```json
POST /api/sessions/record
{
  "threadId": "thread-A",
  "stitchId": "stitch-A-01",
  "score": 10,
  "totalQuestions": 10,
  "points": 50,
  "results": [
    {
      "questionId": "q1",
      "answer": "42",
      "correct": true
    },
    ...
  ]
}

Response:
{
  "success": true,
  "message": "Session recorded successfully",
  "sessionId": "session-1234567890-123",
  "isPerfectScore": true
}
```

This endpoint:
- Works for both anonymous and authenticated users
- Automatically updates progress if the user gets a perfect score
- Updates the user's profile with accumulated points

### Progress Tracking

#### 1. Update Progress (`/api/progress/update`)

Updates a user's progress on a specific stitch (learning unit).

```json
POST /api/progress/update
{
  "threadId": "thread-A",
  "stitchId": "stitch-A-01",
  "orderNumber": 3,
  "skipNumber": 5,
  "distractorLevel": "L2"
}

Response:
{
  "success": true,
  "message": "Progress updated successfully"
}
```

This endpoint:
- Uses a progressive approach with multiple fallback strategies
- Works for both anonymous and authenticated users
- Updates the user's place in the learning sequence

#### 2. Bulk Sync (`/api/progress/bulk-sync`)

Synchronizes multiple progress records and sessions at once, ideal for offline-to-online transitions.

```json
POST /api/progress/bulk-sync
{
  "progress": [
    {
      "threadId": "thread-A",
      "stitchId": "stitch-A-01",
      "orderNumber": 3,
      "skipNumber": 5
    },
    {
      "threadId": "thread-B",
      "stitchId": "stitch-B-02",
      "orderNumber": 2,
      "distractorLevel": "L3"
    }
  ],
  "sessions": [
    {
      "threadId": "thread-A",
      "stitchId": "stitch-A-01",
      "score": 10,
      "totalQuestions": 10,
      "points": 50
    }
  ]
}

Response:
{
  "success": true,
  "message": "Bulk synchronization completed",
  "results": {
    "progress": { "success": 2, "failed": 0, "errors": [] },
    "sessions": { "success": 1, "failed": 0, "errors": [] }
  }
}
```

This endpoint:
- Processes multiple records in a single request
- Returns detailed success/failure information for each record
- Updates the user's profile with accumulated points

## Authentication Flow

The authentication API supports the following user flow:

1. **Anonymous User**: User starts with an anonymous ID stored in localStorage
2. **Email Verification**: User enters email, receives OTP/magic link
3. **Account Creation**: Upon verification, user account is created
4. **Profile Creation**: User profile is created, anonymous data migrated
5. **Optional Password Setup**: User can set a password for future password-based logins
6. **Authenticated Usage**: User continues with an authenticated session

## Data Synchronization Points

The APIs provide explicit points where data syncs with the server:

1. **Authentication**: When user signs in/up
2. **Session Completion**: When a learning session finishes
3. **Progress Update**: When position in learning sequence changes
4. **Bulk Sync**: When transitioning from offline to online mode

## Error Handling

All API endpoints follow a consistent error handling pattern:

```json
// Success response
{
  "success": true,
  "message": "Operation successful",
  ...additional data
}

// Error response
{
  "success": false,
  "error": "User-friendly error message",
  "details": null  // Detailed error info (only in development)
}
```

HTTP status codes are used appropriately to indicate the type of error:
- 200: Successful operation
- 201: Resource created successfully
- 400: Bad request (invalid input)
- 401: Unauthorized (authentication required)
- 404: Resource not found
- 500: Server error

## Testing the API

To test the new endpoints:

```javascript
// Example: Test record session endpoint
fetch('/api/sessions/record', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    threadId: 'thread-A',
    stitchId: 'stitch-A-01',
    score: 10,
    totalQuestions: 10,
    points: 50
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

## Troubleshooting

If you encounter API errors:

1. Check browser console for detailed error messages
2. Verify that the database tables exist with proper RLS policies
3. Ensure the appropriate authentication cookies are being set
4. Check that all required environment variables are correctly set
5. Verify the appropriate Supabase permissions are configured