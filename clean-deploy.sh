#!/bin/bash

# Clean deployment script for Vercel
# This removes potential environment variable interference

echo "===== Clean Vercel Deployment ====="
echo ""

# Clear environment variables that might interfere
unset HTTP_PROXY
unset HTTPS_PROXY
unset NODE_OPTIONS
unset NODE_TLS_REJECT_UNAUTHORIZED
unset OPENSSL_CONF

# Deploy with minimum options
cd "$(dirname "$0")"
env -i PATH="$PATH" HOME="$HOME" vercel --prod

echo ""
echo "If deployment failed, try:"
echo "1. vercel logout"
echo "2. vercel login"
echo "3. ./clean-deploy.sh"