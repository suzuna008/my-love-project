# Deployment Guide

This is a static website that can be deployed to various platforms. Here are the easiest options:

## Option 1: GitHub Pages (Recommended - Free & Easy)

### Steps:

1. **Create a GitHub repository** (if you haven't already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Click on "Settings" tab
   - Scroll down to "Pages" section
   - Under "Source", select "Deploy from a branch"
   - Choose "main" branch and "/ (root)" folder
   - Click "Save"

3. **Your site will be live at**:
   `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

**Note**: It may take a few minutes for the site to be available.

---

## Option 2: Netlify (Free & Very Easy)

### Steps:

1. **Sign up** at [netlify.com](https://www.netlify.com) (free account)

2. **Deploy via Drag & Drop**:
   - Log into Netlify
   - Drag and drop your project folder onto the Netlify dashboard
   - Your site will be live instantly!

3. **Or deploy via Git**:
   - Connect your GitHub repository
   - Netlify will auto-deploy on every push

**Your site will be live at**: `https://YOUR_SITE_NAME.netlify.app`

---

## Option 3: Vercel (Free & Easy)

### Steps:

1. **Sign up** at [vercel.com](https://vercel.com) (free account)

2. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   Follow the prompts, and your site will be live!

**Your site will be live at**: `https://YOUR_SITE_NAME.vercel.app`

---

## Option 4: Cloudflare Pages (Free)

### Steps:

1. **Sign up** at [pages.cloudflare.com](https://pages.cloudflare.com)

2. **Connect your Git repository** or upload files directly

3. **Configure**:
   - Build command: (leave empty - no build needed)
   - Build output directory: `/` (root)

**Your site will be live at**: `https://YOUR_SITE_NAME.pages.dev`

---

## Important Notes Before Deploying

### 1. Google Maps API Key Security

⚠️ **IMPORTANT**: Your Google Maps API key is currently visible in the HTML file. Before deploying publicly:

1. **Restrict your API key** in Google Cloud Console:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to "APIs & Services" > "Credentials"
   - Click on your API key
   - Under "Application restrictions":
     - Select "HTTP referrers (web sites)"
     - Add your deployment URLs (e.g., `https://YOUR_SITE.netlify.app/*`)
   - Under "API restrictions":
     - Select "Restrict key"
     - Choose only: "Maps JavaScript API" and "Places API"

2. **Set up billing alerts** in Google Cloud Console to avoid unexpected charges

### 2. Testing Locally Before Deploying

Test your site locally first:
```bash
# Using Python 3
python3 -m http.server 8000

# Or using Node.js
npx http-server
```

Then visit `http://localhost:8000`

---

## Quick Deploy Commands

### GitHub Pages (after initial setup):
```bash
git add .
git commit -m "Deploy updates"
git push
```

### Netlify (via CLI):
```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Vercel:
```bash
vercel --prod
```

---

## Recommended: GitHub Pages

For this project, **GitHub Pages** is recommended because:
- ✅ Completely free
- ✅ Easy to set up
- ✅ Automatic deployments on git push
- ✅ Custom domain support
- ✅ HTTPS included
- ✅ No build process needed

---

## Troubleshooting

### Maps not loading?
- Check that your API key is correct
- Verify API restrictions allow your deployment URL
- Check browser console for errors

### Site not updating?
- Clear browser cache
- Wait a few minutes for CDN to update
- Check deployment logs in your platform's dashboard
