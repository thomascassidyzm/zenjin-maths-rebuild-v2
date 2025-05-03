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