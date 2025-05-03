#!/bin/bash
# Rename stitches script
# This script renames stitch IDs to match the new thread naming convention

# Load environment variables
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# Check for required environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: Missing environment variables"
  echo "Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set"
  exit 1
fi

echo "📋 Stitch Renaming Tool"
echo "======================="
echo "This script will rename all stitch IDs to match the new thread naming convention."
echo "Format: stitch-T{tube_number}-{thread_order}-{stitch_order}"
echo ""
echo "📊 Example: stitch-A-01 -> stitch-T1-001-01"
echo ""
echo "⚠️ WARNING: This is a destructive operation. Please make sure you have a backup of your database."
echo "The script will execute the following steps:"
echo "1. Create a mapping of old stitch IDs to new stitch IDs"
echo "2. Update references in the questions table"
echo "3. Update references in the user_stitch_progress table"
echo "4. Update the stitches table itself"
echo ""
read -p "Are you sure you want to continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Operation cancelled."
  exit 1
fi

# Create temporary directory for SQL execution
TEMP_DIR=$(mktemp -d)
RENAME_SQL="$TEMP_DIR/rename_stitches.sql"

# Copy the SQL file to the temp directory
cp ./scripts/rename-stitches.sql "$RENAME_SQL"

echo "🔍 Connecting to Supabase..."
echo "🔄 Executing stitch renaming script..."

# Execute the SQL script
PGPASSWORD=$SUPABASE_SERVICE_ROLE_KEY psql \
  -h "$(echo $NEXT_PUBLIC_SUPABASE_URL | sed 's|^https\?://||' | sed 's|/.*$||').supabase.co" \
  -U postgres \
  -d postgres \
  -f "$RENAME_SQL" 2>&1

if [ $? -ne 0 ]; then
  echo "❌ Error: SQL script execution failed"
  rm -rf "$TEMP_DIR"
  exit 1
fi

echo "✅ Stitch renaming completed successfully!"
echo "🧹 Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

echo ""
echo "🎉 All stitches have been renamed to the new format!"
echo "The new format is: stitch-T{tube_number}-{thread_order}-{stitch_order}"
echo ""
echo "Next steps:"
echo "1. Check that all stitch references are updated correctly"
echo "2. Make sure your application uses the new stitch ID format"
echo ""