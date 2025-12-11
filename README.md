# Ectoplasm — Landing page (Casper DEX)

This repository contains a production-ready landing page for Ectoplasm, a DEX built on the Casper Network. The site is configured for deployment on Vercel.

## Contents

- `index.html` — landing page markup and demo swap UI
- `styles.css` — responsive, accessible styles, dark-mode-ready
- `script.js` — live CSPR price ticker, theme toggle, Casper wallet connect scaffolding
- `vercel.json` — Vercel configuration for static site deployment
- `assets/` — placeholder images and icons
- `docs/` — documentation page placeholder

## Features

- Clear hierarchy and onboarding for new users, with an immediate demo swap and wallet connect CTA
- Emphasis on security, audits, and transparency (audit artifacts and on-chain verifiability)
- Advanced product messaging: limit orders, LP protections, fee customization
- Performance-minded: small, static assets, and no heavy client frameworks for the landing page itself
- Accessibility and SEO built-in (semantic HTML, ARIA where needed, meta/OG tags)

## Deploy to Vercel

### Option 1: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Sign in with your GitHub account
3. Click "Add New Project"
4. Import this repository (`EcosystemNetwork/Ectoplasm`)
5. Vercel will auto-detect the configuration from `vercel.json`
6. Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (from repository root)
vercel

# Deploy to production
vercel --prod
```

## Customization

1. Replace placeholder images in `/assets/` with your real graphics (logo, OG image, audit badges)
2. Update `whitepaper.pdf` and `audit-report.pdf` with actual documents
3. Hook up wallet connect:
   - Integrate CasperSigner or your preferred Casper wallet according to their docs
   - Implement on-chain swap interactions in a secured backend or client-side contract calls
4. Replace the CoinGecko API call in `script.js` if you prefer your own price oracle
5. Update the documentation page in `docs/index.html` with your actual documentation

## Local Development

Simply open `index.html` in your browser, or use a local server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000`