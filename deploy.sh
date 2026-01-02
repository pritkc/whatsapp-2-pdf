#!/bin/bash

# WhatsApp2PDF Deployment Script
# This script helps deploy to GitHub Pages

set -e

echo "🚀 WhatsApp2PDF Deployment Helper"
echo ""

# Check if remote exists
if git remote get-url origin &>/dev/null; then
    REMOTE_URL=$(git remote get-url origin)
    echo "📍 Remote repository: $REMOTE_URL"
    
    # Check if repo exists
    if git ls-remote --exit-code origin &>/dev/null; then
        echo "✅ Repository exists on GitHub"
        echo ""
        echo "📤 Pushing code to GitHub..."
        git push -u origin main
        
        echo ""
        echo "✅ Code pushed successfully!"
        echo ""
        echo "📝 Next steps:"
        echo "1. Go to: https://github.com/pritkc/whatsapp-2-pdf/settings/pages"
        echo "2. Under 'Source', select 'Deploy from a branch'"
        echo "3. Select branch: 'main' and folder: '/' (root)"
        echo "4. Click 'Save'"
        echo "5. Wait 1-2 minutes for deployment"
        echo "6. Your site will be live at: https://pritkc.github.io/whatsapp-2-pdf/"
    else
        echo "❌ Repository not found on GitHub"
        echo ""
        echo "📝 Please create the repository first:"
        echo "1. Go to: https://github.com/new"
        echo "2. Repository name: whatsapp-2-pdf"
        echo "3. Choose Public"
        echo "4. DO NOT initialize with README/gitignore/license"
        echo "5. Click 'Create repository'"
        echo ""
        echo "Then run this script again."
    fi
else
    echo "❌ No remote repository configured"
    echo ""
    echo "Setting up remote..."
    git remote add origin https://github.com/pritkc/whatsapp-2-pdf.git
    echo "✅ Remote added"
    echo ""
    echo "📝 Next: Create the repository on GitHub, then run this script again"
fi

