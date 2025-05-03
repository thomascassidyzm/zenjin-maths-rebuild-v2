#!/bin/bash

# This script helps deploy to Vercel when the CLI is experiencing SSL issues
# It creates a deployment-ready package and opens the Vercel dashboard

echo "===== Zenjin Maths Deployment Helper ====="
echo ""
echo "This script helps work around SSL issues with the Vercel CLI"
echo ""

# Create a temporary directory for the deployment
DEPLOY_DIR="/tmp/vercel-deploy-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEPLOY_DIR"

# Copy project files to the deployment directory
echo "Copying project files to $DEPLOY_DIR..."
cp -R /Users/tomcassidy/claude-code-experiments/zenjin-maths/vercel-source/* "$DEPLOY_DIR"

# Create a deployment info file
echo "Writing deployment info..."
cat > "$DEPLOY_DIR/public/deployment-$(date +%Y%m%d_%H%M%S).txt" << EOL
DEPLOYMENT: Bundled Content Integration

Date: $(date)

CHANGES:
- Added expanded bundled content with 10 stitches per tube (30 total)
- Implemented content tier system (same content for anonymous & free users)
- Added InfinitePlayStateMachine for continuous cycling
- Enhanced content buffer to prioritize bundled content
- Added feature flags for toggling bundled content usage

HOW TO TEST:
1. Use incognito window to test as anonymous user
2. Verify content loads without network requests
3. Complete multiple stitches in each tube
4. Test offline functionality by disconnecting network
5. Check that content continues to cycle properly

DOCUMENTATION:
See BUNDLED-CONTENT-INTEGRATION.md for full implementation details
EOL

# Create a zip file for easy uploading
echo "Creating deployment ZIP file..."
ZIP_FILE="/tmp/vercel-deployment-$(date +%Y%m%d-%H%M%S).zip"
cd "$DEPLOY_DIR" && zip -r "$ZIP_FILE" .

echo ""
echo "===== Deployment Package Ready ====="
echo ""
echo "Package created at: $ZIP_FILE"
echo ""
echo "To deploy:"
echo "1. Go to https://vercel.com/dashboard"
echo "2. Click on your 'vercel-source' project"
echo "3. Click 'Import Project' or 'Deploy' button"
echo "4. Select 'Upload' and choose the ZIP file"
echo ""
echo "Opening Vercel dashboard in your browser..."

# Try to open the Vercel dashboard
open "https://vercel.com/dashboard" || echo "Please open https://vercel.com/dashboard in your browser"

echo ""
echo "After deploying, test your application at the provided Vercel URL"