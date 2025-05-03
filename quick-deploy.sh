#!/bin/bash

# First login to Vercel
echo "First, login to Vercel using:"
echo "vercel login"
echo ""

# Then deploy
echo "Then deploy using:"
echo "cd /Users/tomcassidy/claude-code-experiments/zenjin-maths/vercel-source && vercel --prod"
echo ""

echo "If you're still having SSL issues, try using a different network or:"
echo "1. Reset your network settings"
echo "2. Use a different device or terminal"
echo "3. Update Vercel CLI: npm install -g vercel@latest"