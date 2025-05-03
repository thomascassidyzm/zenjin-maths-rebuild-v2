#!/bin/bash

# Deploy the offline-first implementation to production

# Exit immediately if any command fails
set -e

echo "Deploying Offline-First Implementation to Production"
echo "---------------------------------------------------"

# Generate timestamp for deployment logs
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOYMENT_INFO="deployment-${TIMESTAMP}.txt"

# Record deployment info
echo "Deployment started: $(date)" > public/$DEPLOYMENT_INFO
echo "Deployment type: Offline-First Implementation" >> public/$DEPLOYMENT_INFO
echo "Build includes: Bundled content (30 stitches), Hardcoded Supabase URLs" >> public/$DEPLOYMENT_INFO

# Ensure all required dependencies are installed
echo "Checking dependencies..."

# Install framer-motion (required for animations)
echo "Installing framer-motion (required for animations)..."
npm install framer-motion

# Check for other common dependencies
echo "Installing any other missing dependencies..."
# Add a check if package.json contains the dependency but it's not installed
if grep -q '"@supabase/supabase-js"' package.json && ! ls node_modules/@supabase/supabase-js > /dev/null 2>&1; then
  echo "Installing @supabase/supabase-js..."
  npm install @supabase/supabase-js
fi

if grep -q '"next"' package.json && ! ls node_modules/next > /dev/null 2>&1; then
  echo "Installing next..."
  npm install next
fi

if grep -q '"react"' package.json && ! ls node_modules/react > /dev/null 2>&1; then
  echo "Installing react and react-dom..."
  npm install react react-dom
fi

# Build the application
echo "Building application..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "Build successful!"
    echo "Build completed successfully: $(date)" >> public/$DEPLOYMENT_INFO
else
    echo "Build failed!"
    echo "Build failed: $(date)" >> public/$DEPLOYMENT_INFO
    exit 1
fi

# Deploy to Vercel if vercel CLI is installed
if command -v vercel &> /dev/null; then
    echo "Deploying to Vercel..."
    
    # Deploy to production
    vercel --prod
    
    if [ $? -eq 0 ]; then
        echo "Deployment successful!"
        echo "Deployment completed successfully: $(date)" >> public/$DEPLOYMENT_INFO
    else
        echo "Deployment failed!"
        echo "Deployment failed: $(date)" >> public/$DEPLOYMENT_INFO
        exit 1
    fi
else
    echo "Vercel CLI not found. Please install it or deploy manually."
    echo "To install Vercel CLI: npm install -g vercel"
    echo "Manual deployment required - Vercel CLI not found: $(date)" >> public/$DEPLOYMENT_INFO
fi

# Suggest testing the simple offline test page
echo ""
echo "Deployment completed!"
echo ""
echo "Please test the implementation by visiting:"
echo "  - /simple-offline-test - Test page for bundled content"
echo "  - /offline-first-test - Test page for offline-first implementation"
echo ""
echo "Documentation has been updated in:"
echo "  - OFFLINE-FIRST-IMPLEMENTATION.md - Implementation details"
echo "  - DEPLOY-FIXES.md - Deployment fixes and procedures"
echo "  - CLaude.md - Implementation summary"