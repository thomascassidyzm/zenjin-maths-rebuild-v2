# Warm-Up Mode Implementation

## Overview

The Warm-Up Mode feature serves as an engaging solution to the race condition issues that were previously occurring in the Zenjin Maths application. Rather than showing error messages or fallback questions when content isn't fully loaded, we now provide users with a set of warm-up questions while the main content loads in the background.

## Key Components

### 1. `warmUpQuestions.ts`

This module handles loading, normalization, and selection of warm-up questions from a pool of questions stored in `Warm-up Questions.json`.

- `normalizeQuestionFormat()`: Converts database format (snake_case) to component format (camelCase)
- `getRandomWarmUpQuestions()`: Selects a random subset of questions from the pool
- `createWarmUpStitch()`: Creates a synthetic stitch object with warm-up questions
- `validateQuestions()`: Ensures questions have all required properties

### 2. `WarmUpMode.tsx`

A React component that displays warm-up questions to users while the main content loads.

- Creates a tube-like data structure for MinimalDistinctionPlayer
- Shows engaging animations and visual elements to indicate this is a warm-up
- Uses the standard MinimalDistinctionPlayer with warm-up questions
- Calls `onWarmUpComplete` when the warm-up session is finished

### 3. `WarmUpTransition.tsx`

A transition component that displays an animation when moving from warm-up to the main content.

- Shows a progress bar and animated elements
- Provides feedback that personalized content is now ready
- Creates a smooth and meaningful transition experience

### 4. `PlayerWithLoader.tsx` (Modified)

The existing component was enhanced to support warm-up mode:

- New props: `useWarmUp` and `warmUpQuestionsCount`
- Shows warm-up questions while content loads in the background
- Handles the transition between warm-up and main content
- Ensures a smooth user experience throughout the process

## Flow Diagram

```
User enters → Loading Screen → Warm-Up Mode → Transition Animation → Main Content
                     ↓                ↑              ↓
            Content Loading ──────────┘              │
                     ↓                               │
            Content Loaded ───────────────────────────
```

## Usage

To use the warm-up mode in any page, simply add the warm-up props to the PlayerWithLoader component:

```jsx
<PlayerWithLoader
  tubeId={activeTubeNumber}
  stitchId={currentStitchId}
  minLoadingTime={3000}
  maxAttempts={3}
  useWarmUp={true}               // Enable warm-up mode
  warmUpQuestionsCount={10}      // Number of warm-up questions
>
  <YourPlayerComponent ... />
</PlayerWithLoader>
```

## Benefits

1. **Eliminates Race Conditions**: By design, the warm-up mode gives the system ample time to fully load content.

2. **Engaging User Experience**: Instead of showing error messages or loading screens, users immediately engage with math questions.

3. **Seamless Transitions**: The transition animation provides a natural and meaningful break between warm-up and personalized content.

4. **Consistent Format**: Warm-up questions use the same format and UI as regular questions, creating a cohesive experience.

5. **Background Loading**: Main content continues to load in the background while users work on warm-up questions.

## Technical Notes

- The warm-up questions are bundled with the application, ensuring immediate availability.
- Questions are randomly selected to provide variety across sessions.
- The format conversion ensures compatibility between database-format questions and the player components.
- Warm-up mode can be disabled if needed by setting `useWarmUp={false}`.
- The implementation works for both anonymous and authenticated users.

## Future Improvements

1. **Topic-Based Warm-Ups**: Select warm-up questions related to the user's current tube/topic.
2. **Difficulty Adaptation**: Adjust warm-up question difficulty based on user performance.
3. **Telemetry**: Collect metrics on warm-up performance to improve the experience.
4. **Progress Integration**: Consider incorporating warm-up performance into overall user progress.
5. **Custom Animations**: Develop tube-specific warm-up animations that relate to the learning content.