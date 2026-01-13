# GitHub Pages Setup Guide

## Quick Setup Steps

### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on **Settings** (top menu)
3. Scroll down to **Pages** in the left sidebar
4. Under **Source**, select:
   - **Branch**: `main` (or `master` if that's your default branch)
   - **Folder**: `/ (root)`
5. Click **Save**

### 2. Wait for Deployment

- GitHub Pages will take 1-2 minutes to build and deploy your site
- You'll see a green checkmark when it's ready
- Your site will be available at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

### 3. Verify Your Files

Make sure these files are in the root of your repository:
- ✅ `index.html`
- ✅ `app.js`
- ✅ `styles.css`
- ✅ `.nojekyll` (this file prevents Jekyll processing)

### 4. Check Your Site

After enabling GitHub Pages, visit:
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

## Troubleshooting

### Still seeing 404?

1. **Check the branch**: Make sure you selected the correct branch (usually `main` or `master`)
2. **Wait a few minutes**: GitHub Pages can take 1-5 minutes to deploy
3. **Check repository settings**: Go to Settings → Pages and verify the source is set correctly
4. **Check Actions tab**: If enabled, you can see the deployment status in the Actions tab
5. **Clear browser cache**: Try opening the site in an incognito/private window

### Common Issues

- **404 Error**: Usually means GitHub Pages isn't enabled or the wrong branch is selected
- **Blank page**: Check browser console for JavaScript errors (F12)
- **API key issues**: Make sure your Google Maps API key is valid and has the correct APIs enabled

## Custom Domain (Optional)

If you want to use a custom domain:
1. Add a `CNAME` file to your repository root with your domain name
2. Configure DNS settings with your domain provider
3. Update GitHub Pages settings with your custom domain

## Need Help?

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Pages Troubleshooting](https://docs.github.com/en/pages/getting-started-with-github-pages/troubleshooting-github-pages)
