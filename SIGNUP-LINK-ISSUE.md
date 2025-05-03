# Sign Up Link Issue

## Issue Description

The "Sign Up to Save Progress" button in the session summary is pointing to an incorrect URL (`/signup`), which leads to a 404 error. It should point to `/signin` instead, which is the correct URL for the sign-in/sign-up page.

## Technical Analysis

The issue is in the `MinimalDistinctionPlayer.tsx` component:

```typescript
<a 
  href="/signup" 
  className="block w-full py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 text-white font-bold rounded-xl transition-colors text-center"
>
  Sign Up to Save Progress
</a>
```

The URL `/signup` is incorrect and should be `/signin`, which is the actual URL used for the sign-in/create account page, as seen in the home page (`index.tsx`):

```typescript
<Link href="/signin" passHref>
  <a className="block bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-xl transition-colors text-lg text-center shadow-lg">
    Sign In / Create Account
  </a>
</Link>
```

The correct URL is `https://maths.zenjin.cymru/signin`, not `https://maths.zenjin.cymru/signup`.

## Impact

This issue:
1. Creates a poor user experience as users who click the button encounter a 404 error
2. Prevents anonymous users from creating accounts to save their progress
3. Reduces conversion rate from anonymous to registered users

## Required Fix

Update the href attribute in the link to the correct URL:

```typescript
<a 
  href="/signin" 
  className="block w-full py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 text-white font-bold rounded-xl transition-colors text-center"
>
  Sign Up to Save Progress
</a>
```

This simple change will ensure the button correctly directs users to the sign-in/create account page.