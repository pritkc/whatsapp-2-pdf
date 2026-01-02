# Deployment Guide

This guide will help you deploy WhatsApp2PDF to either GitHub Pages or Vercel.

## Option 1: GitHub Pages (Recommended)

### Step 1: Create GitHub Repository

1. Go to [https://github.com/new](https://github.com/new)
2. Repository name: `whatsapp-2-pdf`
3. Description: "Convert WhatsApp chats to PDF. 100% client-side. Private. Offline."
4. Choose **Public** (required for free GitHub Pages)
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click **Create repository**

### Step 2: Push Code to GitHub

The code is already committed locally. Run:

```bash
git push -u origin main
```

If prompted, authenticate with your GitHub credentials.

### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (in the left sidebar)
3. Under **Source**, select:
   - **Deploy from a branch**: `main`
   - **Folder**: `/ (root)`
4. Click **Save**
5. Wait 1-2 minutes for deployment
6. Your site will be live at: `https://YOUR_USERNAME.github.io/whatsapp-2-pdf/`

### Step 4: Update Repository URL (Optional)

If your GitHub username is different, update the remote:

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/whatsapp-2-pdf.git
```

## Option 2: Vercel (Alternative)

### Step 1: Login to Vercel

```bash
vercel login
```

Follow the prompts to authenticate.

### Step 2: Deploy

```bash
vercel --prod
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Your account
- **Link to existing project?** → No
- **Project name?** → `whatsapp-2-pdf` (or press Enter)
- **Directory?** → `.` (press Enter)
- **Override settings?** → No

### Step 3: Access Your Site

After deployment, Vercel will provide a URL like:
`https://whatsapp-2-pdf.vercel.app`

You can also find it in your [Vercel Dashboard](https://vercel.com/dashboard).

## Quick Deploy Script

For GitHub Pages, you can use this script after creating the repository:

```bash
#!/bin/bash
# Make sure you've created the GitHub repository first!

git push -u origin main
echo "✅ Code pushed! Now enable GitHub Pages in Settings → Pages"
```

## Troubleshooting

### GitHub Pages not updating?
- Check Actions tab for deployment status
- Ensure workflow file exists: `.github/workflows/deploy.yml`
- Verify Pages is enabled in Settings → Pages

### Vercel deployment fails?
- Run `vercel login` again
- Check `vercel.json` exists
- Ensure all files are committed

## Current Status

✅ Git repository initialized  
✅ Initial commit made  
✅ GitHub Pages workflow configured  
✅ Vercel configuration ready  
⏳ Repository needs to be created on GitHub  
⏳ Code needs to be pushed  
⏳ GitHub Pages needs to be enabled  

