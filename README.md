# Ectoplasm 👻

<div align="center">

**A next-generation decentralized exchange (DEX) built on the Casper Network**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/EcosystemNetwork/Ectoplasm)

*Fast swaps • Deep liquidity • Gamified engagement • Privacy-first*

</div>

---

## 📖 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Customization](#customization)
- [Wallet Integration](#wallet-integration)
- [Pages & Features](#pages--features)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

---

## 🌟 Overview

Ectoplasm is a comprehensive DEX platform built on the Casper Network, offering a complete trading ecosystem with innovative features:

- **Swap Terminal**: Instant token swaps with multiple order types (swap, limit, buy, sell)
- **Liquidity Pools**: Deep liquidity with LP rewards and impermanent loss protection
- **Token Launchpad**: Pump.fun-style token creation with bonding curves
- **Gamified Dashboard**: Daily quests, streaks, and XP rewards to drive user engagement

This repository contains the production-ready landing page and web interface for the Ectoplasm DEX. The site is designed to be fast, accessible, and fully responsive, with native support for Casper wallet providers.

---

## ✨ Key Features

### 🔄 Trading & Swaps
- **Multi-mode swap interface** with instant, limit, buy, and sell order types
- **Real-time CSPR price ticker** via CoinGecko API integration
- **Smart slippage controls** with quick preset options
- **Price impact warnings** and optimal routing visualization
- **Demo mode** for UI exploration without wallet connection

### 💧 Liquidity & Farming
- **Adaptive fee tiers** for volatile vs. stable pairs
- **Impermanent loss protection** for select pools
- **Auto-compounding vaults** with transparent reward schedules
- **On-chain analytics** to monitor pool utilization

### 🚀 Token Launchpad
- **Bonding curve presets** (linear, sigmoid, steep)
- **Auto-liquidity routing** for newly launched tokens
- **50 mock tokens** for UI demonstration
- **Pump.fun-inspired** creation flow with promotional budget sliders

### 🎮 Gamification
- **Daily task checklists** with XP rewards
- **Weekly quest system** for deeper engagement
- **Return streak tracking** with bonus multipliers
- **Reward catalog** for fee rebates, launchpad priority, and boost multipliers

### 🎨 User Experience
- **Dark/light theme toggle** with system preference detection
- **Fully responsive design** for mobile, tablet, and desktop
- **Accessible UI** with ARIA labels and semantic HTML
- **SEO optimized** with meta tags and OpenGraph support
- **Performance-first** architecture with no heavy frameworks

### 🔐 Security
- **Multi-wallet support**: CasperWallet, CasperSigner, CSPR.CLOUD
- **Security headers** configured in Vercel deployment
- **Content Security Policy** for XSS protection
- **Audit-ready** with placeholder badges and documentation

---

## 📁 Project Structure

```
Ectoplasm/
├── index.html          # Main landing page with swap terminal
├── dashboard.html      # Gamified user dashboard with quests
├── launchpad.html      # Token creation and launchpad library
├── liquidity.html      # Liquidity pools and LP rewards
├── swap.html           # Redirect page to main swap interface
├── script.js           # Core JavaScript functionality
├── styles.css          # Complete stylesheet with theming
├── vercel.json         # Vercel deployment configuration
├── site.webmanifest    # PWA manifest file
├── DEPLOYMENT.md       # Detailed deployment guide
├── README.md           # This file
├── assets/             # Static assets (images, icons)
│   ├── electoplasmlogo.png
│   ├── favicon.ico
│   ├── og-image.png
│   └── ...
├── docs/               # Documentation pages
│   └── index.html
├── whitepaper.pdf      # Project whitepaper (placeholder)
└── audit-report.pdf    # Security audit report (placeholder)
```

### Core Files

#### `index.html`
The main landing page featuring:
- Hero section with integrated swap terminal
- Product overview and feature showcase
- Interactive swap card with 4 order modes
- Settings, details, and network popovers
- Protocol statistics and roadmap
- Security and audit information
- Responsive navigation with mega menu

#### `dashboard.html`
Gamification hub featuring:
- Streak tracker with daily check-in rewards
- Daily task checklist with XP values
- Weekly quest cards with progress bars
- Reward catalog for XP redemption
- User stats (streak, XP, progress)

#### `launchpad.html`
Token creation platform featuring:
- Launch configuration form with bonding curve selection
- Promotional budget slider
- Token library table with 50 mock tokens
- Filter and search functionality
- Token status badges (Hot, Trending, New)

#### `liquidity.html`
LP management page featuring:
- Prime pairs overview
- LP incentive programs
- Risk control information
- Impermanent loss protection details

#### `script.js`
JavaScript functionality including:
- Theme management (dark/light mode)
- CSPR price ticker with CoinGecko API
- Wallet connection for 3 providers
- Swap demo calculations
- Popover/dropdown interactions
- Dashboard rendering (tasks, quests, rewards)
- Launchpad token table with filtering
- Logo menu navigation
- Promotional budget slider

#### `styles.css`
Complete stylesheet with:
- CSS custom properties for theming
- Responsive grid layouts
- Component styling (buttons, cards, forms)
- Accessibility features
- Dark/light mode support
- Glass-morphism effects
- Gradient accents

---

## 🛠 Technology Stack

### Frontend
- **HTML5**: Semantic markup with ARIA accessibility
- **CSS3**: Modern CSS with custom properties, grid, and flexbox
- **Vanilla JavaScript**: No framework dependencies for optimal performance
- **Progressive Enhancement**: Works without JavaScript for basic content

### APIs & Integrations
- **CoinGecko API**: Real-time CSPR price data
- **Casper Wallet Providers**:
  - CasperWallet (via CasperWalletProvider)
  - CasperSigner (casperlabsHelper)
  - CSPR.CLOUD (csprclick)

### Deployment
- **Vercel**: Serverless static hosting with automatic deployments
- **Security Headers**: CSP, X-Frame-Options, X-Content-Type-Options
- **Cache Control**: Optimized caching for static assets

### Development
- **No build step required**: Pure static site
- **No dependencies**: Zero npm packages to install
- **Fast iteration**: Edit and refresh workflow

---

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- A local web server (optional, for testing)
- Git (for cloning the repository)

### Local Development

#### Option 1: Open Directly
Simply open `index.html` in your web browser. Most features will work, though some APIs may require a local server due to CORS policies.

#### Option 2: Use a Local Server (Recommended)

**Using Python:**
```bash
cd /path/to/Ectoplasm
python3 -m http.server 8000
```

**Using Node.js:**
```bash
cd /path/to/Ectoplasm
npx serve
```

**Using PHP:**
```bash
cd /path/to/Ectoplasm
php -S localhost:8000
```

Then navigate to `http://localhost:8000` in your browser.

### Exploring the Interface

1. **Swap Terminal** (index.html): The default landing page with integrated swap
2. **Dashboard** (/dashboard.html): Check daily tasks and quests
3. **Launchpad** (/launchpad.html): Browse 50 mock tokens and launch form
4. **Liquidity** (/liquidity.html): Learn about LP opportunities

### Testing Wallet Connection

To test wallet integration:
1. Install a Casper wallet extension:
   - [CasperWallet](https://www.casperwallet.io/)
   - [CasperSigner](https://www.casperlabs.io/wallet)
   - [CSPR.CLOUD](https://cspr.cloud/)
2. Click "Connect Wallet" in the navigation
3. Select your wallet provider
4. Approve the connection request
5. Your wallet address will appear in the UI

---

## 🌐 Deployment

### Deploy to Vercel (Recommended)

#### Method 1: Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Import the `EcosystemNetwork/Ectoplasm` repository
4. Vercel auto-detects configuration from `vercel.json`
5. Click **"Deploy"**
6. Your site will be live at `https://[project-name].vercel.app`

#### Method 2: Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

#### Method 3: Deploy Button

Click the button below to deploy directly:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/EcosystemNetwork/Ectoplasm)

### Other Hosting Options

This is a static site and can be deployed to any static hosting service:

- **Netlify**: Drag and drop the folder or connect via Git
- **GitHub Pages**: Enable in repository settings
- **Cloudflare Pages**: Connect via GitHub integration
- **AWS S3**: Upload files and enable static website hosting
- **Azure Static Web Apps**: Deploy via GitHub Actions

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 🎨 Customization

### Branding & Assets

1. **Replace Logo and Favicon:**
   ```
   assets/electoplasmlogo.png  → Your logo (38×38px recommended)
   assets/favicon.ico          → Your favicon (32×32px)
   assets/apple-touch-icon.ico → iOS icon (180×180px)
   ```

2. **Update OpenGraph Image:**
   ```
   assets/og-image.png → Social media preview (1200×630px)
   ```

3. **Replace Placeholder Documents:**
   ```
   whitepaper.pdf    → Your actual whitepaper
   audit-report.pdf  → Your security audit report
   ```

### Theme Customization

Edit CSS custom properties in `styles.css`:

```css
:root {
  --bg: #04131a;              /* Background color */
  --card: #07242c;            /* Card background */
  --muted: #8ccfc0;           /* Muted text color */
  --accent: linear-gradient(...); /* Accent gradient */
  --glass: rgba(86,255,211,0.08); /* Glass effect */
  --radius: 12px;             /* Border radius */
  --max-width: 1150px;        /* Content max width */
}
```

### Content Updates

1. **Update Project Name:**
   - Search and replace "Ectoplasm" in HTML files
   - Update `<title>` tags in each HTML file
   - Update meta descriptions

2. **Modify Navigation:**
   - Edit the `.nav` section in each HTML file
   - Update the mega menu in `index.html`

3. **Customize Features:**
   - Edit feature lists in each page
   - Update statistics in the stats section
   - Modify roadmap items

### API Configuration

**Price Ticker:**
Edit the CoinGecko API call in `script.js`:
```javascript
// Change the coin ID if needed
const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=casper-network&vs_currencies=usd');
```

**Wallet App ID:**
Update the Casper wallet app ID in `script.js`:
```javascript
const CSPR_WALLET_APP_ID = 'your-app-id-here';
```

---

## 🔗 Wallet Integration

### Supported Wallets

Ectoplasm supports three Casper wallet providers:

1. **CasperWallet** - Browser extension wallet
2. **CasperSigner** - Official Casper Labs wallet
3. **CSPR.CLOUD** - Cloud-based wallet service

### Connection Flow

The wallet connection system:
- Detects available wallet providers on page load
- Prompts user to select if multiple wallets are installed
- Displays truncated wallet address after connection
- Stores connection state in browser

### Integration Guide

To integrate with smart contracts:

1. **Listen for wallet connection:**
   ```javascript
   // Access connected wallet
   const wallet = window.connectedWallet;    // 'casperwallet' | 'caspersigner' | 'csprcloud'
   const account = window.connectedAccount;  // Public key string
   ```

2. **Sign transactions:**
   ```javascript
   // Example for CasperSigner
   const deploy = /* your deploy object */;
   const signature = await window.casperlabsHelper.sign(deploy);
   ```

3. **Handle disconnection:**
   ```javascript
   // Add disconnect button and clear state
   delete window.connectedWallet;
   delete window.connectedAccount;
   ```

For detailed wallet integration, refer to:
- [Casper Wallet Docs](https://www.casperwallet.io/docs)
- [CasperSigner Docs](https://docs.casperlabs.io/workflow/signer-guide/)
- [CSPR.CLOUD Docs](https://cspr.cloud/docs)

---

## 📄 Pages & Features

### Home Page (`/`)
**Purpose**: Combined landing page and swap terminal

**Sections**:
- Hero with integrated swap card
- Order type tabs (Swap, Limit, Buy, Sell)
- Settings popover (slippage, quick amounts)
- Trade details popover (route, fees, impact)
- Network status popover
- Overview section explaining the platform
- Feature grid with 6 key features
- Protocol statistics (volume, TVL, uptime)
- How it works walkthrough
- Roadmap timeline
- Security and audit section

**Interactions**:
- Theme toggle (dark/light)
- Wallet connection
- Real-time price ticker
- Swap amount calculations
- Order mode switching
- Popover controls

### Dashboard (`/dashboard.html`)
**Purpose**: Gamified user engagement hub

**Features**:
- Current streak counter
- Weekly quest progress bar
- Daily task checklist (4 tasks with XP values)
- Weekly quest cards (3 quests with progress)
- Reward catalog (3 redeemable items)
- XP total display

**Gamification Loop**:
1. User completes daily tasks → earns XP
2. Maintains streak → multiplies rewards
3. Completes weekly quests → unlocks badges
4. Spends XP → redeems rewards

### Launchpad (`/launchpad.html`)
**Purpose**: Token creation and discovery

**Features**:
- Launch configuration form
- Bonding curve selection (linear, sigmoid, steep)
- Promotional budget slider
- Token library table (50 mock tokens)
- Filter/search functionality
- Token status badges
- Liquidity and performance metrics

**Demo Data**:
- 50 procedurally generated tokens
- Randomized growth percentages
- Status rotation (Hot, Trending, New)
- Formatted liquidity values

### Liquidity (`/liquidity.html`)
**Purpose**: LP education and pool overview

**Content**:
- Prime pairs explanation
- LP incentive programs
- Risk control measures
- Impermanent loss protection
- Auto-compounding vaults
- Adaptive fee tiers

---

## ⚙️ Configuration

### `vercel.json`

Security and caching configuration:

```json
{
  "version": 2,
  "public": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {"key": "X-Content-Type-Options", "value": "nosniff"},
        {"key": "X-Frame-Options", "value": "DENY"},
        {"key": "Content-Security-Policy", "value": "..."}
      ]
    },
    {
      "source": "/:path*.(js|css|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)",
      "headers": [
        {"key": "Cache-Control", "value": "public, max-age=31536000, immutable"}
      ]
    }
  ]
}
```

**Key Settings**:
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-Frame-Options**: Prevents clickjacking
- **CSP**: Restricts resource loading for security
- **Cache-Control**: Optimizes asset caching

### `site.webmanifest`

PWA configuration for mobile installation:
- App name and short name
- Theme color
- Background color
- Display mode
- Icon references

---

## 🤝 Contributing

We welcome contributions to improve Ectoplasm! Here's how you can help:

### Reporting Issues

1. Check existing issues to avoid duplicates
2. Use the issue template (if available)
3. Include browser version and steps to reproduce
4. Add screenshots for UI issues

### Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test thoroughly across browsers
5. Commit with clear messages: `git commit -m "Add: feature description"`
6. Push to your fork: `git push origin feature/your-feature`
7. Open a pull request

### Development Guidelines

- Maintain the existing code style
- Keep JavaScript vanilla (no frameworks)
- Ensure accessibility (ARIA labels, semantic HTML)
- Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- Update documentation for significant changes
- Optimize images before committing

### Code Style

- Use 2 spaces for indentation
- Use meaningful variable names
- Comment complex logic
- Keep functions small and focused
- Prefer const over let, avoid var

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Third-Party Resources

- **CoinGecko API**: Used for CSPR price data (free tier)
- **Casper Network**: Blockchain platform
- **Casper Wallet Providers**: Third-party wallet integrations

---

## 💬 Support

### Documentation
- [Deployment Guide](DEPLOYMENT.md) - Detailed deployment instructions
- [Casper Network Docs](https://docs.casper.network) - Blockchain documentation
- [Vercel Docs](https://vercel.com/docs) - Hosting platform docs

### Community
- **GitHub Issues**: [Report bugs or request features](https://github.com/EcosystemNetwork/Ectoplasm/issues)
- **Casper Discord**: Join the Casper community
- **Twitter**: Follow for updates

### Contact
- **Email**: support@ecosystemnetwork.io (example)
- **Website**: https://ectoplasm.casper.network (example)

---

## 🙏 Acknowledgments

- **Casper Network** for the blockchain infrastructure
- **Uniswap** for DEX design inspiration
- **Pump.fun** for launchpad concept inspiration
- **CoinGecko** for price API
- **Vercel** for hosting and deployment tools

---

<div align="center">

**Built with ♥️ for the Casper Network ecosystem**

[Website](https://ectoplasm.casper.network) • [Twitter](https://twitter.com/ectoplasm) • [Discord](https://discord.gg/casper)

© 2025 EcosystemNetwork • Open Source • MIT License

</div>