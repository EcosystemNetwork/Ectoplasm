# Deployment Guide

This guide walks you through deploying the Liquidnation landing page to Vercel.

## Prerequisites

- GitHub account
- Vercel account (free tier works fine)

## Method 1: Deploy via Vercel Dashboard (Recommended)

### Step 1: Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign in with your GitHub account
3. Grant Vercel access to your GitHub repositories

### Step 2: Import the Repository

1. Click the **"Add New Project"** button
2. Select **"Import Git Repository"**
3. Find and select the `EcosystemNetwork/Liquidnation` repository
4. Click **"Import"**

### Step 3: Configure Project

Vercel will automatically detect the project settings from `vercel.json`. You should see:

- **Framework Preset:** Other
- **Root Directory:** `./` (default)
- **Build Command:** (leave empty for static site)
- **Output Directory:** (leave empty for static site)

### Step 4: Deploy

1. Review the settings (no changes needed)
2. Click **"Deploy"**
3. Wait for the deployment to complete (usually 30-60 seconds)
4. Your site will be live at `https://[project-name].vercel.app`

### Step 5: Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain (e.g., `liquidnation.casper.network`)
3. Follow Vercel's instructions to configure DNS

## Method 2: Deploy via Vercel CLI

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

Or use npx without installing:

```bash
npx vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy

From the repository root directory:

```bash
# Deploy to preview (development)
vercel

# Deploy to production
vercel --prod
```

### Step 4: Link to Project (First Time Only)

The CLI will ask you:

- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N** (first time) or **Y** (if project exists)
- What's your project's name? `liquidnation` (or your choice)
- In which directory is your code located? `./` (press Enter)

## Post-Deployment

### Update Environment Variables (If Needed)

Currently, the site doesn't require any environment variables. If you add backend functionality later:

1. Go to Project Settings → Environment Variables
2. Add your variables
3. Redeploy for changes to take effect

### Automatic Deployments

Vercel automatically deploys:
- **Production:** Every push to the `main` branch
- **Preview:** Every push to any branch or pull request

### Monitor Deployments

- View deployment logs in the Vercel dashboard
- Check build logs if deployment fails
- Use the preview URLs to test changes before merging to main

## Troubleshooting

### Deployment Fails

1. Check the build logs in Vercel dashboard
2. Verify all files are committed and pushed to GitHub
3. Ensure `vercel.json` is valid JSON

### Assets Not Loading

1. Check file paths are correct (case-sensitive)
2. Verify assets are committed to the repository
3. Check browser console for 404 errors

### API Issues

If the CoinGecko price ticker fails:
- Check the Content-Security-Policy in `vercel.json`
- Verify the API endpoint is accessible
- Check rate limits

## Next Steps

After deployment, you should:

1. **Replace Placeholder Assets:**
   - Upload real logo and favicon to `/assets/`
   - Create proper OpenGraph image (1200x630px)
   - Update audit and insurance badges

2. **Update Content:**
   - Replace placeholder PDFs with real documents
   - Update the documentation page
   - Customize colors and branding

3. **Integrate Wallet:**
   - CasperSigner and CSPR.CLOUD wallet support included
   - Connect to your smart contracts
   - Test wallet connection flow with both wallet types

4. **Add Analytics:**
   - Set up Vercel Analytics or Google Analytics
   - Monitor user behavior and page performance

5. **Configure Custom Domain:**
   - Set up your domain in Vercel
   - Configure SSL (automatic with Vercel)
   - Update DNS records

## Support

- Vercel Documentation: https://vercel.com/docs
- Casper Network Docs: https://docs.casper.network
- GitHub Issues: https://github.com/EcosystemNetwork/Liquidnation/issues

## Security

The deployment includes security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` for XSS protection

Review and adjust these in `vercel.json` based on your security requirements.
