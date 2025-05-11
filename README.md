# Triple-Helix Learning Player

A sophisticated educational content player implementing the Triple-Helix spaced repetition learning system.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

## Key Pages

- `/working-player` - Main Triple-Helix player with all fixes
- `/triple-helix-player` - Alternative player implementation
- `/triple-helix-test` - Testing environment for Triple-Helix features
- `/tube-simulator` - Visual demonstration of tube cycling

## Recent Updates

The application has recently received important improvements:

### Thread Naming and Ordering

A new thread naming convention has been implemented to ensure proper content loading order:

```
thread-T{tube_number}-{thread_order}
```

This system ensures:
- Tube assignment is explicitly part of the thread ID
- Threads within tubes have a clear ordering
- ALL stitches from one thread are processed before ANY from the next thread

See [Thread Ordering System](THREAD-ORDER.md) for details on the implementation.

### Database and API Fixes

- **UUID Handling**: Fixed issues with UUID comparison in database operations
- **Progress Data**: Ensured proper saving of learning progress across sessions
- **Anonymous Users**: Improved handling of anonymous user data
- **API Endpoints**: Enhanced error handling and data validation
- **User Initialization**: Improved new user setup to ensure correct content loading
- **Tube Configurations**: Fixed issues with invalid stitch references in tube configurations
- **State Management**: Implemented robust state handling with Zustand as single source of truth
- **Payload Optimization**: Reduced API payload sizes by 96% for improved performance
- **Authentication Flow**: Fixed TTL-based anonymous accounts to prevent unnecessary migrations

For detailed information on these changes, see:
- [Thread Ordering System](THREAD-ORDER.md)
- [User Initialization Fix](USER-INITIALIZATION-FIX.md)
- [Database Setup Guide](DATABASE-SETUP-GUIDE.md)
- [Database Fix Documentation](DATABASE-FIX.md)
- [Database Update Summary](DATABASE-UPDATE-SUMMARY.md)
- [API Documentation](API-DOCUMENTATION.md)
- [Maintenance Guide](MAINTENANCE-GUIDE.md)
- [State Management Optimization](STATE-MANAGEMENT-OPTIMIZATION.md)

## Database Scripts

The following SQL scripts are included for database setup and maintenance:

1. `setup-database.sql` - Main database schema and policy script
2. `enable-rls.sql` - Security permissions script
3. `ensure-anonymous-user.sql` - Script to handle UUID conversion for anonymous users
4. `verify-database.sql` - Script to verify the database setup
5. `complete-reset.sql` - Comprehensive reset script (preserves auth users)