#!/bin/bash

# Simple deployment script for Vercel

echo "===== Triple-Helix Player Deployment ====="
echo ""

# Deploy to Vercel
echo "Deploying to Vercel..."
vercel --prod

echo ""
echo "Deployment complete! Check the URL above for your application."
echo ""
echo "Key Pages to Test:"
echo " - Working Player: /working-player"
echo " - Triple Helix Player: /triple-helix-player"
echo " - Triple Helix Test: /triple-helix-test"