# Question Timing Issue in Zenjin Maths

## Issue Description

There is a timing issue where the answers appear for at least 0.5 seconds before the question shows, creating an awkward user experience. This happens after encouragement is shown upon stitch completion.

## Technical Analysis

The issue has been identified in the `MinimalDistinctionPlayer` component:

1. **Timer Delay**: There is a 1200ms delay before starting the timer after a question loads:
   ```typescript
   const timeoutId = setTimeout(() => {
     startTimer();
   }, 1200); // Longer delay to give users time to read the question
   ```

2. **Synchronization Issue**: When `loadQuestion` is called, it immediately sets the current question and options:
   ```typescript
   setCurrentQuestion(question);
   // ...
   setOptions(shuffleArray(options));
   ```
   
   But there's no delay in showing the options, while the question and UI may still be processing or animating.

3. **Transition Animation**: The delay is compounded by the animation timing after showing the celebration pill:
   ```typescript
   // In CelebrationPill.tsx
   const timer = setTimeout(() => {
     if (onComplete) onComplete();
   }, 1450);
   ```
   
   This is followed by another delay when loading the next question.

## Visual Impact

This timing issue creates an unnatural experience where:
1. The user sees the previous question's feedback/encouragement
2. The UI then shows the answer options for the next question
3. After a delay, the question text itself appears

This timing mismatch makes the interaction feel broken or unpolished.

## Recommended Fix

To fix this issue:

1. **Reduce the Question Timer Delay**:
   Reduce the 1200ms delay to 500ms or less to make the question appear more quickly after loading.

2. **Synchronize UI Updates**:
   Consider using a single state update or a sequential animation approach where the question appears first, followed by the options.

3. **Clean Transition**:
   Ensure that when moving from one question to the next, there's a clean transition that clears the previous question completely before showing any part of the next question.

By addressing these timing issues, the user experience will feel more natural and responsive, with questions and answers appearing in the correct sequence.