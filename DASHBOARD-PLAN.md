# Zenjin Maths Dashboard Plan

This document outlines the plan for implementing the Zenjin Maths dashboard, focusing on metrics, user progression, and interface design.

## Core Metrics

The dashboard will focus on two primary metrics:

1. **Total Points**
   - Primary progression metric
   - Cumulative measure of achievement
   - Powers the evolution level system

2. **Blink Speed**
   - Average response time for correct answers
   - Measures mathematical fluency and confidence
   - Lower is better (faster responses = higher fluency)

## Dashboard Organization

The dashboard will be organized into three main sections:

### 1. Session Performance
- Shown immediately after completing a session
- Includes:
  - Points earned (with multiplier animation)
  - Correct answers
  - Blink Speed for the session
  - Multiplier applied (with animation)

### 2. Overall Progress
- Prominently displayed in main dashboard
- Features:
  - Total points (all-time)
  - Current evolution level with progress to next
  - Average Blink Speed (with trend indicator)

### 3. Daily Standing
- Single comparison metric updated once per active day
- Shows: "Top X% globally today!"
- Updates only on days with activity
- Remains visible until next active day

## Evolution Level System

Users progress through an evolution system based on a formula combining points and speed:

```
Evolution Score = Total Points ÷ Average Blink Speed
```

Each 1,000 point increase in Evolution Score triggers advancement to the next level.

### Evolution Levels

Levels use imaginative names that evoke mental processes without being overtly mathematical:

```
Level 1: Mind Spark          (0-1,000 points)
Level 2: Thought Weaver      (1,000-3,000 points)
Level 3: Pattern Seeker      (3,000-6,000 points)
Level 4: Vision Runner       (6,000-10,000 points)
Level 5: Insight Chaser      (10,000-15,000 points)
Level 6: Clarity Crafter     (15,000-25,000 points)
Level 7: Perception Prowler  (25,000-40,000 points)
Level 8: Enigma Explorer     (40,000-60,000 points)
Level 9: Riddle Ranger       (60,000-85,000 points)
Level 10: Puzzle Prophet     (85,000-120,000 points)
```

Higher levels continue with increasingly impressive names.

### Blink Speed Milestones

Special designations appear when users achieve certain Blink Speed thresholds:

- Blink Speed under 5s: "Time Bender" (special visual effect)
- Blink Speed under 3s: "Thought Flash" (enhanced animation)
- Blink Speed under 1s: "Mind Warp" (ultimate special effect)

## Point Multiplier System

The system will include surprise multipliers that appear without warning:

- Random "lucky day" multipliers
- Pattern-based rewards that aren't explicitly communicated
- Varied multiplier levels (×2, ×3, ×5, ×10) for different achievements

### Multiplier Categories

Multipliers are grouped into categories with intentionally vague names:

1. **"Consistency Charm"** - Rewards regular engagement patterns
2. **"Explorer's Fortune"** - Rewards trying different content areas
3. **"Mastery Magic"** - Rewards performance improvements
4. **"Golden Moment"** - Pure randomness/luck factor
5. **"Quantum Leap"** - Significant progress milestones

The exact triggering conditions remain hidden from users to maintain an element of surprise and prevent gaming the system.

## Implementation Plan

### 1. Data Collection Layer

Ensure we're capturing the right data to power our metrics:

```typescript
// Session metrics to capture
interface SessionMetrics {
  userId: string;
  sessionId: string;
  timestamp: string;
  totalPoints: number;
  correctAnswers: number;
  totalQuestions: number;
  firstTimeCorrect: number;
  sessionDuration: number;
  blinkSpeed: number;
  multiplier: number;
}

// Individual question data
interface QuestionData {
  questionId: string;
  correct: boolean;
  timeToAnswer: number;
  firstTimeCorrect: boolean;
}
```

### 2. Backend Storage & Aggregation

Set up database tables to store user performance and global metrics:

```sql
-- Sessions table for performance data
CREATE TABLE user_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  total_points INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  first_time_correct INTEGER NOT NULL,
  session_duration INTEGER NOT NULL,
  blink_speed FLOAT NOT NULL,
  multiplier FLOAT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Daily aggregation table for efficient queries
CREATE TABLE daily_user_stats (
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  avg_blink_speed FLOAT,
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Global daily stats for comparisons
CREATE TABLE global_daily_stats (
  date DATE PRIMARY KEY,
  total_users INTEGER NOT NULL,
  points_distribution JSON NOT NULL, -- Percentile data
  updated_at TIMESTAMP NOT NULL
);
```

### 3. Dashboard UI Components

#### Session Summary Component
- Shows session results immediately after completion
- Animated sequence revealing points and multiplier
- Transitions to dashboard after viewing

#### Dashboard Main Component
- Central hub for all user progression data
- Tab-based navigation between sections
- Prominently features evolution level and global standing

#### Evolution Badge Component
- Visual representation of current level
- Progress bar showing advancement to next level
- Special effects for milestone achievements

#### Global Standing Component
- Shows user's percentile ranking for the day
- Updates on days with activity
- Always framed positively ("Top X%")

## Development Phases

### Phase 1: Core Metrics & Storage
- Implement data collection for sessions
- Set up database schema for metrics
- Create API endpoints for dashboard data

### Phase 2: Evolution System
- Implement evolution level calculation
- Create visual assets for each level
- Develop progress visualization

### Phase 3: Session Summary Screen
- Build animated session summary
- Create multiplier reveal animations
- Implement transition to dashboard

### Phase 4: Dashboard UI
- Develop main dashboard layout
- Implement tabs for different sections
- Create data visualization components

### Phase 5: Global Comparisons
- Implement daily global statistics calculation
- Create percentile calculation system
- Develop display for user's global standing

### Phase 6: Multiplier System
- Implement hidden multiplier triggers
- Create multiplier animations and effects
- Develop backend for pattern recognition

## Testing Plan

1. **Performance Testing**
   - Ensure dashboard loads quickly with large datasets
   - Test calculation efficiency for global metrics

2. **User Testing**
   - Verify clarity of dashboard metrics
   - Test user comprehension of evolution system
   - Evaluate emotional response to multipliers and achievements

3. **Data Integrity Testing**
   - Verify accuracy of calculation formulas
   - Test edge cases for evolution calculation
   - Ensure consistent data across different views

## Future Considerations

1. **Accessibility Improvements**
   - Ensure colorblind-friendly design
   - Add screen reader support for key metrics

2. **Expansion Options**
   - Support for different mathematical content types
   - Potential for topic-specific dashboards
   - Community features and friend comparisons

3. **Mobile Optimization**
   - Ensure dashboard functions well on small screens
   - Consider simplified mobile view for key metrics