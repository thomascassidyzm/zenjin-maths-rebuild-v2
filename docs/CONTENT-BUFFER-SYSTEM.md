# Content Buffer System

This document describes the Content Buffer System implemented for Zenjin Maths, which efficiently loads and manages learning content to ensure a smooth, responsive user experience.

## Overview

The Content Buffer System is designed to solve several key challenges:

1. **Performance:** Eliminate loading delays between questions by pre-loading content
2. **Bandwidth Efficiency:** Fetch content in optimal batches rather than one at a time
3. **Caching:** Store frequently accessed content locally to reduce server load
4. **State Management:** Track user progress and position in the learning sequence

The system consists of three main components:

- **Content Manifest API:** Provides a lightweight overview of all available content
- **Content Buffer Manager:** Client-side service that manages content loading and caching
- **useContentBuffer Hook:** React interface for components to access buffered content

## Architecture

### Content Manifest

The manifest is a lightweight JSON structure that provides metadata about all available content without including the full content itself. It's organized hierarchically:

```
ContentManifest
├── tubes (Record<number, TubeManifest>)
│   ├── 1 (TubeManifest)
│   │   └── threads (Record<string, ThreadManifest>)
│   │       ├── "thread-T1-001" (ThreadManifest)
│   │       │   ├── title: string
│   │       │   └── stitches: StitchReference[]
│   │       └── ...
│   ├── 2 (TubeManifest)
│   └── 3 (TubeManifest)
├── version: number
├── generated: string (ISO timestamp)
└── stats: { tubeCount, threadCount, stitchCount }
```

### User State

The user's state tracks their position in the learning sequence. We support two formats:

1. **Standard Format** (from StateManager):
```typescript
interface UserState {
  userId: string;
  tubes: Record<number, {
    threadId: string;
    currentStitchId: string;
    position: number;
  }>;
  activeTube: number;
  cycleCount: number;
  points: { session: number; lifetime: number; };
  lastUpdated: string;
}
```

2. **Position-Based Format** (for advanced content ordering):
```typescript
interface ContentBufferUserState {
  userId: string;
  tubes: Record<string, {
    threadId: string;
    currentStitchId: string;
    stitches: Array<{
      id: string;
      threadId: string;
      position: number;
      skipNumber: number;
      distractorLevel: string;
    }>;
  }>;
  activeTubeNumber: number;
  lastUpdated: string;
}
```

The Content Buffer system handles both formats transparently.

### Content Loading Flow

1. **Initial Load:**
   - User state is loaded from server or localStorage
   - Content manifest is fetched to understand available content
   - Active stitch (in-play stitch) is immediately loaded
   - Buffer is populated with upcoming stitches in the background

2. **Content Progression:**
   - When a stitch is completed, the next stitch is determined
   - Position-based sorting determines the new active stitch
   - User state is updated and persisted
   - Buffer is refreshed with new upcoming content

3. **Buffer Management:**
   - Each tube maintains a buffer of `BUFFER_SIZE` (default: 5) upcoming stitches
   - When the buffer needs refreshing, a batch request fetches multiple stitches at once
   - Stitches are cached client-side to avoid redundant requests

## API Endpoints

### 1. Content Manifest API

```
GET /api/content/manifest
```

Returns a lightweight representation of all content structure.

**Response:**
```json
{
  "success": true,
  "manifest": {
    "version": 1,
    "generated": "2025-05-02T12:34:56Z",
    "tubes": {
      "1": {
        "threads": {
          "thread-T1-001": {
            "title": "Number Facts",
            "stitches": [
              { "id": "stitch-T1-001-01", "order": 1, "title": "Introduction to Numbers" },
              { "id": "stitch-T1-001-02", "order": 2, "title": "Basic Addition" }
            ]
          }
        }
      }
    },
    "stats": {
      "tubeCount": 3,
      "threadCount": 10,
      "stitchCount": 50
    }
  }
}
```

### 2. Batch Content API

```
POST /api/content/batch
```

**Request Body:**
```json
{
  "stitchIds": ["stitch-T1-001-01", "stitch-T1-001-02", "stitch-T2-001-01"]
}
```

**Response:**
```json
{
  "success": true,
  "stitches": [
    {
      "id": "stitch-T1-001-01",
      "threadId": "thread-T1-001",
      "title": "Introduction to Numbers",
      "content": "...",
      "order": 1,
      "questions": [...]
    },
    ...
  ],
  "count": 3,
  "total": 3
}
```

### 3. Single Stitch API

```
GET /api/content/stitch/[id]
```

Returns a single stitch with its full content and questions.

## React Integration

### ContentBufferManager

The ContentBufferManager is a singleton class that handles loading and caching of content. It provides methods for:

- Loading the content manifest
- Determining which stitches need to be buffered
- Fetching stitches in batches
- Caching stitches for efficient access
- Getting the in-play stitch

### useContentBuffer Hook

The useContentBuffer hook provides a React interface for components to interact with the content buffer:

```typescript
const { 
  inPlayStitch,  // The currently active stitch 
  isLoading,     // Whether content is currently loading
  error,         // Any error that occurred
  completeStitch // Function to complete the current stitch
} = useContentBuffer();
```

#### Usage Example

```jsx
function MathQuestion() {
  const { inPlayStitch, isLoading, completeStitch } = useContentBuffer();
  
  if (isLoading) return <LoadingSpinner />;
  if (!inPlayStitch) return <NoContentMessage />;
  
  const handleAnswer = (isCorrect) => {
    // Complete the stitch and move to the next one
    completeStitch(isCorrect);
  };
  
  return (
    <div>
      <h2>{inPlayStitch.title}</h2>
      {inPlayStitch.questions.map(question => (
        <QuestionComponent 
          key={question.id}
          question={question}
          onAnswer={handleAnswer}
        />
      ))}
    </div>
  );
}
```

## Position-Based Content Ordering

The system uses a position-based approach for content ordering rather than fixed indices. This allows for:

1. **Spaced Repetition:** Items can be inserted at arbitrary positions based on learning algorithms
2. **Flexible Content Updates:** New content can be added without disrupting existing sequences
3. **Performance:** No need to reindex the entire sequence when items are reordered

### How It Works

- Each stitch has a `position` value (where 0 is the active stitch)
- When a stitch is completed with a perfect score:
  1. It moves back by its `skipNumber` positions
  2. The next stitch (at position 1) becomes the active stitch (position 0)

This creates a natural spaced repetition effect where items are revisited at increasing intervals.

## Triple Helix Learning Model

The content is organized into three "tubes" that the user rotates through:

1. **Tube 1:** Number Facts
2. **Tube 2:** Basic Operations
3. **Tube 3:** Problem Solving

After completing a stitch in one tube, the user automatically advances to the next tube. This rotation:

- Increases engagement by providing variety
- Improves retention through spaced practice
- Allows for connections between related concepts

## Performance Considerations

- The content manifest is cached with HTTP headers for efficient loading
- Batch loading reduces the number of HTTP requests
- Client-side caching prevents redundant fetches
- The buffer size is configurable to balance memory usage and performance

## Extending the System

To add new content types or functionality:

1. Update the `StitchContent` interface to include new fields
2. Extend the content batch API to return the new fields
3. Update the React components to handle the new content types

## Testing and Debugging

A demo page is available at `/content-buffer-demo` that shows the system in action. The ContentBufferDemo component includes debug information to help understand how the system works.

You can also monitor the buffer's activity in the browser console, where it logs operations like:
- Loading the manifest
- Updating the buffer
- Fetching stitches
- Completing stitches

## Conclusion

The Content Buffer System provides an efficient and flexible way to deliver learning content to users. By pre-loading content and managing state effectively, it creates a seamless learning experience while minimizing server load and bandwidth usage.