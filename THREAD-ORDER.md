# Thread and Stitch Ordering System

This document explains how threads and stitches are organized and loaded in the Zenjin Maths player application.

## Thread Hierarchy

The Zenjin Maths app uses a three-tier hierarchy:

1. **Tubes** (1-3): The highest level containers that cycle in the triple-helix system
2. **Threads**: Collections of related learning content within a tube
3. **Stitches**: Individual learning units within a thread

## New Thread Naming Convention

Threads now follow a new naming convention that makes the hierarchy explicit:

```
thread-T{tube_number}-{thread_order}
```

For example:
- `thread-T1-001` = Tube 1, first thread
- `thread-T2-001` = Tube 2, first thread
- `thread-T3-001` = Tube 3, first thread
- `thread-T3-002` = Tube 3, second thread

This naming convention ensures that:
- The tube number is explicit in the thread ID
- Threads within each tube have a clear ordering
- Alphabetical sorting naturally respects the hierarchy

## Loading Order Rules

The player app follows these rules when loading content:

1. **Tube Order**: Content cycles through Tubes 1, 2, and 3 in sequence
2. **Thread Order**: Within each tube, threads are loaded in order of their thread_order (001, 002, etc.)
3. **Stitch Order**: Within each thread, stitches are loaded in numeric order (01, 02, 03, etc.)

This means that:
- ALL stitches from thread-T3-001 will be processed before ANY stitches from thread-T3-002
- Within each thread, stitches are processed in numeric order (01, 02, 03, etc.)

## Implementation Details

### Database Structure

Each thread includes:
- `id`: Follows the naming convention above (e.g., thread-T1-001)
- `tube_number`: The tube this thread belongs to (1, 2, or 3)
- `name` and `description`: Human-readable information

Each stitch includes:
- `id`: Usually follows the pattern stitch-{thread-letter}-{number} (e.g., stitch-A-01)
- `thread_id`: The thread this stitch belongs to
- `order`: The numeric position within the thread

### User Progress Tracking

The system tracks progress through:
- `user_stitch_progress`: Tracks which stitches the user has seen/completed
- `user_tube_position`: Remembers which tube and thread the user last accessed

## Content Loading Process

1. When a tube becomes active in the triple-helix:
   - The system finds the active thread for that tube
   - It then loads the active stitch (order_number = 0) from that thread

2. When a stitch is completed:
   - The stitch's order_number is updated based on its skip_number
   - The next stitch (with order_number = 0) becomes the active stitch

3. When all stitches in a thread are completed:
   - The system moves to the next thread in the same tube
   - If there are no more threads, it rotates to the next tube

## How This Improves User Experience

- Predictable content progression through the triple-helix
- Related content stays together (all stitches in a thread are processed together)
- Clear hierarchy makes content management easier
- Explicit naming convention improves application robustness

## Troubleshooting

If sample content is generated instead of loading from the database:
1. User may not have proper user_stitch_progress records
2. Thread IDs might not follow the new naming convention
3. Tube positions might be incorrect

To fix these issues:
1. Run the user initialization script
2. Run the thread migration utility
3. Reset tube configurations if needed