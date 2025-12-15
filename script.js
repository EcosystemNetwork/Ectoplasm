/**
 * Ectoplasm DEX - Core JavaScript Module
 * 
 * This file handles all client-side interactions for the Ectoplasm DEX platform,
 * including wallet connections, theme management, swap calculations, and UI interactions.
 * 
 * Features:
 * - Multi-wallet support (CasperWallet, CasperSigner, CSPR.CLOUD)
 * - Real-time CSPR price ticker via CoinGecko API
 * - Dark/light theme toggle with localStorage persistence
 * - Swap demo with live calculations
 * - Dashboard rendering (tasks, quests, rewards)
 * - Launchpad token library with filtering
 * - Accessible UI interactions (popovers, menus, keyboard navigation)
 * 
 * NOTE: For production deployments:
 * - Implement proper error handling and user feedback
 * - Add API rate limiting and retry logic
 * - Secure API keys and move to environment variables
 * - Add CORS handling for external APIs
 * - Connect to actual Casper smart contracts for real swaps
 * - Implement backend services for persistent state
 * 
 * @version 1.0.0
 * @license MIT
 */

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

/**
 * Casper Wallet Application ID
 * Used for wallet connection requests with CSPR.CLOUD and CasperWallet
 * @constant {string}
 */
const CSPR_WALLET_APP_ID = '019ae32b-4115-7d44-b2c3-a8091354c9a2';

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the application when the DOM is fully loaded
 * Sets up all event listeners, initializes components, and hydrates dynamic content
 * 
 * Components initialized:
 * - Copyright year in footer
 * - Theme system (dark/light mode)
 * - CSPR price ticker
 * - Theme toggle button
 * - Wallet connection button
 * - Logo menu (mega menu)
 * - Swap demo calculator
 * - Popout controls (settings, details, network)
 * - Promotional budget slider
 * - Dashboard (if on dashboard.html)
 * - Launchpad token list (if on launchpad.html)
 */
document.addEventListener('DOMContentLoaded', () => {
  // Update copyright year in footer
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Initialize theme system (restores user preference or system default)
  hydrateTheme();
  
  // Start CSPR price ticker (fetches and updates every 60 seconds)
  initPriceTicker();

  // Setup event listeners for interactive elements
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  const connectWallet = document.getElementById('connectWallet');
  if (connectWallet) connectWallet.addEventListener('click', connectWalletHandler);

  if(window.location.hash === '#swap') activateSwapNav();
  window.addEventListener('hashchange', () => {
    if(window.location.hash === '#swap') activateSwapNav();
  });

  // Initialize page-specific components
  setupLogoMenu();        // Mega menu navigation
  setupSwapDemo();        // Swap calculator with order types
  setupPopouts();         // Settings/details/network popovers
  setupPromoSlider();     // Launchpad promotional budget slider
  renderDashboard();      // Dashboard tasks/quests/rewards
  renderLaunchpadTokens();// Launchpad token library table
});

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

/**
 * Hydrate theme from localStorage or system preference
 * 
 * Priority order:
 * 1. User's saved preference in localStorage
 * 2. System color scheme preference (prefers-color-scheme)
 * 3. Default to dark mode
 * 
 * Called on page load to restore the user's theme choice
 */
function hydrateTheme(){
  const stored = localStorage.getItem('ectoplasm-theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const desired = stored || (prefersLight ? 'light' : 'dark');
  setTheme(desired);
}

/**
 * Initialize the CSPR price ticker
 * Fetches the current Casper Network (CSPR) price from CoinGecko API
 * and updates the price display every 60 seconds
 * 
 * Features:
 * - Initial fetch on page load
 * - Auto-refresh every 60 seconds
 * - Graceful error handling (leaves fallback text on failure)
 * - Only runs if price ticker element exists on page
 */
async function initPriceTicker(){
  const el = document.getElementById('priceTicker');
  if (!el) return; // Element not on this page
  
  /**
   * Fetch current CSPR price from CoinGecko API
   * Updates the price ticker element with formatted USD price
   */
  const fetchPrice = async () => {
    try{
      // CoinGecko API endpoint for Casper Network
      // Free tier, no API key required (rate-limited to 50 calls/min)
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=casper-network&vs_currencies=usd');
      if(!res.ok) throw new Error('price fetch failed');
      const data = await res.json();
      const price = data['casper-network']?.usd;
      if(price) el.textContent = `CSPR $${price.toFixed(2)}`;
    }catch(e){
      console.warn('Price load error', e);
      // Leave fallback text (CSPR $--.--) on error
    }
  };
  
  // Fetch immediately on load
  fetchPrice();
  
  // Refresh price every 60 seconds
  setInterval(fetchPrice, 60_000);
}

/**
 * Toggle between light and dark theme
 * Inverts the current theme and saves the choice to localStorage
 */
function toggleTheme(){
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  setTheme(isDark ? 'light' : 'dark');
}

/**
 * Set the application theme
 * 
 * @param {string} theme - The theme to apply ('light' or 'dark')
 * 
 * Actions:
 * - Sets data-theme attribute on <html> element
 * - Updates theme toggle button text and aria-pressed state
 * - Saves preference to localStorage for persistence
 */
function setTheme(theme){
  const btn = document.getElementById('themeToggle');
  const next = theme === 'light' ? 'dark' : 'light';

  // Apply theme to document root
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  
  // Update toggle button if present
  if (btn){
    btn.textContent = `${next} mode`;
    btn.setAttribute('aria-pressed', theme === 'light');
  }
  
  // Persist user preference
  localStorage.setItem('ectoplasm-theme', theme);
}

/**
 * Ensure the Swap nav item is visibly active
 */
function activateSwapNav(){
  document.querySelectorAll('.nav a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if(href.includes('#swap')){
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
}

// ============================================================================
// WALLET CONNECTION
// ============================================================================

/**
 * Handle wallet connection request
 * 
 * Supports three Casper wallet providers:
 * 1. CasperWallet - Browser extension wallet (window.CasperWalletProvider)
 * 2. CasperSigner - Official Casper Labs wallet (window.casperlabsHelper or window.CasperWallet)
 * 3. CSPR.CLOUD - Cloud-based wallet service (window.csprclick)
 * 
 * Flow:
 * 1. Detect available wallet providers
 * 2. Prompt user to select if multiple are available
 * 3. Request connection with selected wallet
 * 4. Display connected account in UI
 * 5. Store connection state in window global for contract interactions
 * 
 * @async
 */
async function connectWalletHandler(){
  // Detect available wallet providers
  const casperWalletProvider = typeof window.CasperWalletProvider === 'function' ? window.CasperWalletProvider() : null;
  const casperSigner = window.casperlabsHelper || window.CasperWallet;
  const csprCloud = window.csprclick;

  // Check if any wallet is available
  if(!casperWalletProvider && !casperSigner && !csprCloud){
    alert('No Casper wallet detected. Please install Casper Wallet, CasperSigner, or CSPR.CLOUD.');
    return;
  }

  // Build list of available wallets
  const choices = [];
  if(casperWalletProvider) choices.push('casperwallet');
  if(casperSigner) choices.push('caspersigner');
  if(csprCloud) choices.push('csprcloud');

  // If multiple wallets available, let user choose
  let selectedWallet = choices[0];
  if(choices.length > 1){
    const choice = prompt(`Select wallet (${choices.join(', ')}):`, choices[0]);
    if(choice && choices.includes(choice.trim().toLowerCase())){
      selectedWallet = choice.trim().toLowerCase();
    }
  }

  try{
    let connectedAccount = null;

    // Connect to selected wallet provider
    if(selectedWallet === 'casperwallet'){
      console.log('Connecting to Casper Wallet...');
      if(!casperWalletProvider){
        throw new Error('Casper Wallet provider not available.');
      }
      await requestCasperWalletConnection(casperWalletProvider);
      connectedAccount = await casperWalletProvider.getActivePublicKey();
      console.log('Connected to Casper Wallet:', connectedAccount);
    } else if(selectedWallet === 'csprcloud'){
      console.log('Connecting to CSPR.CLOUD wallet...');
      // Try different connection methods (API may vary by version)
      if(typeof csprCloud.requestConnection === 'function'){
        await csprCloud.requestConnection({appId: CSPR_WALLET_APP_ID});
      } else if(typeof csprCloud.connect === 'function'){
        await csprCloud.connect({appId: CSPR_WALLET_APP_ID});
      }
      if(typeof csprCloud.getActiveAccount !== 'function'){
        throw new Error('CSPR.CLOUD wallet API is unavailable.');
      }
      const account = await csprCloud.getActiveAccount();
      if(account){
        connectedAccount = account;
        console.log('Connected to CSPR.CLOUD:', connectedAccount);
      } else {
        throw new Error('No active account found in CSPR.CLOUD wallet');
      }
    } else {
      // CasperSigner connection
      console.log('Connecting to CasperSigner...');
      if(window.casperlabsHelper){
        connectedAccount = await window.casperlabsHelper.requestConnection();
      } else if(window.CasperWallet){
        connectedAccount = await window.CasperWallet.requestConnection();
      }
      console.log('Connected to CasperSigner:', connectedAccount);
    }

    // Update UI with connected account
    const connectBtn = document.getElementById('connectWallet');
    if(connectedAccount){
      // Truncate long public keys for display (first 6 + last 4 chars)
      const shortKey = typeof connectedAccount === 'string' && connectedAccount.length > 12
        ? `${connectedAccount.slice(0, 6)}…${connectedAccount.slice(-4)}`
        : connectedAccount;
      
      connectBtn.textContent = `Connected: ${shortKey}`;
      connectBtn.classList.add('connected');
      
      // Store connection state globally for contract interactions
      window.connectedWallet = selectedWallet;
      window.connectedAccount = connectedAccount;
      
      // Update wallet status badge
      updateWalletStatus(`Connected via ${selectedWallet}`);
    }
  }catch(err){
    console.error('Wallet connection failed', err);
    alert('Wallet connection failed: ' + (err.message || err));
    updateWalletStatus('Connection failed');
  }
}

/**
 * Setup the logo menu (mega menu) interactions
 * Handles opening/closing the dropdown menu with proper accessibility
 * 
 * Features:
 * - Click to toggle menu
 * - Click outside to close
 * - Escape key to close
 * - Proper ARIA attributes for screen readers
 */
function setupLogoMenu(){
  const toggle = document.getElementById('logoMenuToggle');
  const menu = document.getElementById('logoMenu');
  if(!toggle || !menu) return;

  let closeTimer;

  /**
   * Close the mega menu
   */
  const closeMenu = () => {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };

  /**
   * Open the mega menu
   */
  const openMenu = () => {
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
  };

  const scheduleClose = () => {
    closeTimer = setTimeout(() => closeMenu(), 120);
  };

  const cancelScheduledClose = () => {
    if(closeTimer){
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  };

  // Open on hover or focus
  ['mouseenter', 'focus'].forEach((eventName) => {
    toggle.addEventListener(eventName, () => {
      cancelScheduledClose();
      openMenu();
    });
  });

  // Keep menu open while hovering
  menu.addEventListener('mouseenter', cancelScheduledClose);

  // Close when moving cursor away
  ['mouseleave', 'blur'].forEach((eventName) => {
    toggle.addEventListener(eventName, scheduleClose);
  });
  menu.addEventListener('mouseleave', scheduleClose);

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if(menu.hidden) return;
    if(!menu.contains(e.target) && !toggle.contains(e.target)){
      closeMenu();
    }
  });

  // Close on Escape key (from within menu)
  menu.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      closeMenu();
      toggle.focus();
    }
  });

  // Close on Escape key (from toggle button)
  toggle.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      closeMenu();
    }
  });
}

/**
 * Request connection to CasperWallet with app ID
 * Falls back to connection without app ID if the first attempt fails
 * 
 * @param {Object} provider - CasperWallet provider instance
 * @returns {Promise} Connection promise
 */
async function requestCasperWalletConnection(provider){
  if(!provider?.requestConnection) return;
  try{
    // Try with app ID first (preferred)
    return await provider.requestConnection({appId: CSPR_WALLET_APP_ID});
  }catch(err){
    // Fallback to connection without app ID
    console.warn('Casper Wallet connection with appId failed, retrying without appId', err);
    return provider.requestConnection();
  }
}

// ============================================================================
// SWAP INTERFACE
// ============================================================================

/**
 * Setup the swap demo interface
 * 
 * Features:
 * - Real-time swap amount calculations (demo mode with fixed rate)
 * - Order type switching (Swap, Limit, Buy, Sell)
 * - Slippage tolerance validation
 * - Price impact calculation
 * - Dynamic UI updates based on selected order type
 * 
 * NOTE: This is a demo implementation. For production:
 * - Connect to real liquidity pools for accurate pricing
 * - Implement actual AMM routing algorithms
 * - Add real-time slippage calculations
 * - Integrate with smart contracts for on-chain execution
 */
function setupSwapDemo(){
  // Get all required DOM elements
  const fromAmt = document.getElementById('fromAmount');
  const toAmt = document.getElementById('toAmount');
  const priceImpactDetail = document.getElementById('priceImpactDetail');
  const slippage = document.getElementById('slippage');
  const orderTabs = Array.from(document.querySelectorAll('[data-order-tab]'));
  const orderPill = document.getElementById('orderPill');
  const swapTitle = document.getElementById('swap-title');
  const orderSummary = document.getElementById('orderSummary');
  const actionBtn = document.getElementById('swapActionBtn');
  const limitControls = document.getElementById('limitControls');
  const limitPrice = document.getElementById('limitPrice');
  const swapFlip = document.getElementById('swapFlip');
  const fromToken = document.getElementById('fromToken');
  const toToken = document.getElementById('toToken');

  // Demo rate table for token pairs
  const rateTable = {
    cspr: {ecto: 0.5, cspr: 1},
    ecto: {cspr: 2, csprx: 2, ecto: 1},
    csprx: {ecto: 0.5, cspr: 1, csprx: 1}
  };

  if (!fromAmt || !toAmt) return; // Exit if not on swap page

  /**
   * Determine the demo rate for the current pair
   */
  const getRate = () => {
    const from = fromToken?.value || 'cspr';
    const to = toToken?.value || 'ecto';
    return rateTable[from]?.[to] || 1;
  };

  /**
   * Calculate output amount when inputs or tokens change
   * Demo calculation uses static rates per token pair
   */
  const updateOutputs = () => {
    const val = parseFloat(fromAmt.value) || 0;
    const rate = getRate();

    toAmt.value = (val * rate).toFixed(6);

    // Calculate price impact (simplified: grows with swap size)
    // In production, this should calculate actual impact based on pool depth
    const impact = Math.min(0.5, (val/1000));
    const impactText = (impact*100).toFixed(2) + '%';

    if(priceImpactDetail){
      priceImpactDetail.textContent = impactText;
    }
  };

  fromAmt.addEventListener('input', updateOutputs);
  if(fromToken) fromToken.addEventListener('change', updateOutputs);
  if(toToken) toToken.addEventListener('change', updateOutputs);

  /**
   * Validate slippage tolerance input
   * Keeps slippage between 0.1% and 5% to protect users
   */
  if(slippage){
    slippage.addEventListener('input', () => {
      slippage.value = Math.min(Math.max(parseFloat(slippage.value) || 0.1, 0.1), 5).toString();
    });
  }

  /**
   * Reverse selected tokens and entered amounts
   * Triggered via the mid-card arrow button
   */
  if(swapFlip){
    swapFlip.addEventListener('click', () => {
      // Swap token selections
      if(fromToken && toToken){
        const currentFrom = fromToken.value;
        fromToken.value = toToken.value;
        toToken.value = currentFrom;
      }

      // Swap numeric amounts
      const previousFrom = fromAmt.value;
      fromAmt.value = toAmt.value;
      toAmt.value = previousFrom;

      // Recalculate downstream amounts based on the new from value
      updateOutputs();
    });
  }

  /**
   * Helper function to select tokens in the swap form
   * @param {string} fromValue - Token symbol for "from" dropdown
   * @param {string} toValue - Token symbol for "to" dropdown
   */
  const selectTokens = (fromValue, toValue) => {
    const fromToken = document.getElementById('fromToken');
    const toToken = document.getElementById('toToken');
    if(fromToken && fromValue) fromToken.value = fromValue;
    if(toToken && toValue) toToken.value = toValue;
  };

  /**
   * Configuration for each order type mode
   * Defines the UI text, behavior, and token selection for each mode
   */
  const modeCopy = {
    swap: {
      pill: 'Swap',
      title: 'Balanced, fast swaps on Casper.',
      summary: '',
      action: 'swap',
      showLimit: false,
      tokens: null
    },
    limit: {
      pill: 'Limit',
      title: 'Post limit orders with off-chain resting and on-chain execution.',
      summary: 'Set a trigger price and let the relayer post once your terms are met.',
      action: 'place limit',
      showLimit: true,
      tokens: null
    },
    buy: {
      pill: 'Buy',
      title: 'Buy ECTO with CSPR while respecting your price cap.',
      summary: 'Define a ceiling price to protect buys in volatile markets.',
      action: 'buy',
      showLimit: true,
      tokens: { from: 'cspr', to: 'ecto' }
    },
    sell: {
      pill: 'Sell',
      title: 'Sell ECTO back to CSPR with tight routing.',
      summary: 'Lock a minimum receive amount before executing a sale.',
      action: 'sell',
      showLimit: true,
      tokens: { from: 'ecto', to: 'cspr' }
    }
  };

  /**
   * Set the active order mode
   * Updates UI elements, shows/hides limit controls, and selects appropriate tokens
   * 
   * @param {string} mode - The mode to activate ('swap', 'limit', 'buy', or 'sell')
   */
  const setMode = (mode) => {
    const config = modeCopy[mode] || modeCopy.swap;
    
    // Update tab button states
    orderTabs.forEach((btn) => {
      const active = btn.dataset.orderTab === mode;
      btn.classList.toggle('active', active);
      btn.classList.toggle('ghost', !active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    
    // Update UI text
    if(orderPill) orderPill.textContent = config.pill;
    if(swapTitle) swapTitle.textContent = config.title;
    if(orderSummary){
      orderSummary.textContent = config.summary;
      orderSummary.hidden = !config.summary;
    }

    // Show/hide limit price controls
    if(limitControls){
      limitControls.hidden = !config.showLimit;
      if(config.showLimit && limitPrice && !limitPrice.value){
        // Set default limit price (2x current output for demo)
        limitPrice.value = (parseFloat(toAmt.value) * 2 || 0.5).toFixed(4);
      }
    }
    
    // Auto-select tokens for buy/sell modes
    if(config.tokens){
      selectTokens(config.tokens.from, config.tokens.to);
    }
  };

  // Setup order type tab switching
  if(orderTabs.length){
    orderTabs.forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.orderTab)));
    setMode('swap'); // Default to swap mode
  }

  // Ensure CTA always routes to the swap tab and highlights nav
  if(actionBtn){
    actionBtn.addEventListener('click', () => {
      activateSwapNav();
      setMode('swap');
    });
  }

  updateOutputs();
}

// ============================================================================
// POPOUT CONTROLS
// ============================================================================

/**
 * Setup popout/popover controls
 * Manages settings, details, and network status popovers in the swap interface
 * 
 * Features:
 * - Click trigger button to open/close
 * - Click outside to close all popovers
 * - Escape key to close all popovers
 * - Automatic focus management for accessibility
 * - Close button within each popover
 * 
 * Accessibility:
 * - Proper ARIA attributes (aria-expanded, aria-haspopup)
 * - Keyboard navigation support
 * - Focus trapping within active popover
 */
function setupPopouts(){
  const triggers = Array.from(document.querySelectorAll('[data-popout-target]'));
  if(!triggers.length) return;

  // Build list of popout entries (button + associated popout element)
  const entries = triggers
    .map((btn) => ({btn, popout: document.getElementById(btn.dataset.popoutTarget)}))
    .filter((entry) => entry.popout); // Only include entries with valid popouts

  /**
   * Close all open popovers
   */
  const closeAll = () => {
    entries.forEach(({btn, popout}) => {
      popout.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', 'false');
    });
  };

  // Setup each popout trigger
  entries.forEach(({btn, popout}) => {
    // Toggle popout on button click
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = !popout.hasAttribute('hidden');
      closeAll(); // Close all others first
      if(!isOpen){
        // Open this popout
        popout.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
        // Focus first interactive element for keyboard users
        const focusable = popout.querySelector('button, [href], input, select, textarea');
        if(focusable) focusable.focus();
      }
    });

    // Prevent clicks inside popout from closing it
    popout.addEventListener('click', (e) => e.stopPropagation());
    
    // Close button within popout
    popout.querySelectorAll('[data-popout-close]').forEach((closeBtn) => closeBtn.addEventListener('click', closeAll));
  });

  // Close all popovers when clicking outside
  document.addEventListener('click', closeAll);
  
  // Close all popovers on Escape key
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') closeAll();
  });
}

/**
 * Update wallet status badge
 * Displays connection status in the network popover
 * 
 * @param {string} message - Status message to display
 */
function updateWalletStatus(message){
  const badge = document.getElementById('walletStatus');
  if(badge){
    badge.textContent = message;
  }
}

/**
 * Demo swap execution
 * Placeholder for actual swap transaction
 * In production, this would sign and submit a transaction to the Casper Network
 */
function demoSwap(){
  alert('Demo swap executed (UI only). Connect CasperSigner or CSPR.CLOUD wallet to enable real swaps.');
}

// ============================================================================
// LAUNCHPAD
// ============================================================================

/**
 * Setup promotional budget slider
 * Updates the label text as the user drags the slider
 * Used in the launchpad token creation form
 */
function setupPromoSlider(){
  const slider = document.getElementById('promoBudget');
  const label = document.getElementById('promoBudgetLabel');
  if(!slider || !label) return;

  /**
   * Render the current slider value with formatting
   */
  const render = () => {
    const value = Number(slider.value || 0);
    label.textContent = `${value.toLocaleString()} CSPR`;
  };

  slider.addEventListener('input', render);
  render(); // Initial render
}

// ============================================================================
// DASHBOARD GAMIFICATION
// ============================================================================

/**
 * Render the dashboard with gamification elements
 * Displays daily tasks, weekly quests, and reward catalog
 * 
 * Features:
 * - Streak counter with XP total
 * - Daily task checklist (4 tasks)
 * - Weekly quest cards with progress bars
 * - Reward catalog with XP costs
 * 
 * NOTE: This uses hardcoded demo data. In production:
 * - Fetch user data from backend API
 * - Track task completion on-chain or in database
 * - Calculate real-time progress and XP
 * - Persist streak data across sessions
 */
function renderDashboard(){
  const dailyTarget = document.getElementById('dailyTasks');
  const questGrid = document.getElementById('questGrid');
  const rewardGrid = document.getElementById('rewardCatalog');
  const streakVal = document.getElementById('streakValue');
  const streakDays = document.getElementById('streakDays');
  const xpTotal = document.getElementById('xpTotal');
  const weeklyProgress = document.getElementById('weeklyProgress');
  const weeklyPercent = document.getElementById('weeklyPercent');
  const rewardRow = document.getElementById('rewardRow');

  // Exit if not on dashboard page
  if (!dailyTarget && !questGrid && !rewardGrid) return;

  // Demo data - replace with real user data
  const streak = 7;
  const xp = 1260;
  
  /**
   * Daily tasks that refresh every 24 hours
   * Each task awards XP upon completion
   */
  const dailyTasks = [
    { title: 'Check-in and claim streak bonus', xp: 40 },
    { title: 'Complete one swap on Casper', xp: 120 },
    { title: 'Stake liquidity into any $ECTO pair', xp: 200 },
    { title: 'Vote on one governance proposal', xp: 90 }
  ];

  /**
   * Weekly quests for deeper engagement
   * Longer-term objectives with higher rewards
   */
  const weeklyQuests = [
    { title: 'Clear 5 swaps with <0.5% slippage', reward: 'Badge + 200 XP', progress: 60 },
    { title: 'Provide liquidity for 3 consecutive days', reward: 'Boosted APR day', progress: 40 },
    { title: 'Participate in privacy pool relay', reward: 'Shield bonus + 180 XP', progress: 20 }
  ];

  /**
   * Reward catalog items that can be purchased with XP
   * Provides utility and incentive for completing tasks
   */
  const rewards = [
    { title: 'Swap fee rebate', cost: '400 XP', detail: '5% off for 24h' },
    { title: 'Launchpad priority slot', cost: '900 XP', detail: 'Jump queue for next cohort' },
    { title: 'Privacy multiplier', cost: '700 XP', detail: '1.2x rewards on relays for 48h' }
  ];

  // Update user stats
  if (streakVal) streakVal.textContent = streak;
  if (streakDays) streakDays.textContent = streak;
  if (xpTotal) xpTotal.textContent = xp.toLocaleString();
  if (weeklyProgress) weeklyProgress.style.width = `${weeklyQuests[0].progress}%`;
  if (weeklyPercent) weeklyPercent.textContent = weeklyQuests[0].progress;

  // Render daily tasks checklist
  if (dailyTarget){
    dailyTarget.innerHTML = '';
    dailyTasks.forEach(task => {
      const li = document.createElement('li');
      li.innerHTML = `<label><input type="checkbox" /> <span>${task.title}</span></label><span class="pill">+${task.xp} XP</span>`;
      dailyTarget.appendChild(li);
    });
  }

  // Render weekly quest cards
  if (questGrid){
    questGrid.innerHTML = '';
    weeklyQuests.forEach(quest => {
      const card = document.createElement('article');
      card.className = 'pool-card quest-card';
      card.innerHTML = `
        <h3>${quest.title}</h3>
        <p class="muted">Reward: ${quest.reward}</p>
        <div class="progress">
          <div class="progress-bar" style="width:${quest.progress}%"></div>
        </div>
        <small class="muted">${quest.progress}% complete</small>
      `;
      questGrid.appendChild(card);
    });
  }

  // Render reward catalog
  if (rewardGrid){
    rewardGrid.innerHTML = '';
    rewards.forEach(reward => {
      const card = document.createElement('article');
      card.className = 'pool-card reward-card';
      card.innerHTML = `
        <h3>${reward.title}</h3>
        <p class="muted">${reward.detail}</p>
        <span class="pill">${reward.cost}</span>
      `;
      rewardGrid.appendChild(card);
    });
  }

  // Render next reward message
  if (rewardRow){
    rewardRow.innerHTML = `<p class="muted">Next reward unlocks in <strong>2 tasks</strong>. Keep the streak alive!</p>`;
  }
}

/**
 * Render launchpad token library
 * Displays a filterable table of 50 mock tokens with performance metrics
 * 
 * Features:
 * - 50 procedurally generated tokens for demo
 * - Real-time filtering by name or symbol
 * - Status badges (Hot, Trending, New)
 * - Performance metrics (24h change, liquidity)
 * - Formatted currency display
 * 
 * NOTE: This uses generated demo data. In production:
 * - Fetch real token data from backend API or blockchain
 * - Display actual liquidity pool metrics
 * - Show real-time price changes
 * - Link to individual token detail pages
 * - Add sorting capabilities
 */
function renderLaunchpadTokens(){
  const table = document.getElementById('tokenTable');
  const filterInput = document.getElementById('tokenFilter');
  const filterResult = document.getElementById('filterResult');
  const tokenCount = document.getElementById('tokenCount');

  if (!table) return; // Exit if not on launchpad page

  /**
   * Generate 50 mock tokens for demonstration
   * Uses procedural generation to create varied but predictable data
   */
  const tokens = Array.from({ length: 50 }, (_, i) => {
    const index = i + 1;
    const name = `Mock Token ${index.toString().padStart(2, '0')}`;
    const symbol = `M${index.toString().padStart(2, '0')}`;
    // Use sin function for varied but deterministic price changes
    const change = (Math.sin(index) * 8).toFixed(2);
    const liquidity = 50_000 + (index * 1234);
    // Rotate status based on index
    const status = index % 3 === 0 ? 'Hot' : (index % 2 === 0 ? 'Trending' : 'New');
    return { name, symbol, change, liquidity, status };
  });

  /**
   * Render the token table with optional filtering
   */
  const render = () => {
    const term = filterInput?.value?.toLowerCase().trim() || '';
    
    // Filter tokens by search term (searches name and symbol)
    const visible = !term ? tokens : tokens.filter(t => `${t.name} ${t.symbol}`.toLowerCase().includes(term));
    
    // Render table rows
    table.innerHTML = visible.map(token => `
      <div class="table-row" role="row">
        <span role="cell">${token.name}</span>
        <span role="cell">${token.symbol}</span>
        <span role="cell" class="${Number(token.change) >= 0 ? 'pos' : 'neg'}">${token.change}%</span>
        <span role="cell">${formatCurrency(token.liquidity)}</span>
        <span role="cell"><span class="chip">${token.status}</span></span>
      </div>
    `).join('');

    // Update filter results text
    if (filterResult) filterResult.textContent = `Showing ${visible.length} of ${tokens.length} tokens`;
    if (tokenCount) tokenCount.textContent = tokens.length.toString();
  };

  // Initial render
  render();
  
  // Setup live filtering
  if (filterInput) filterInput.addEventListener('input', render);
}

/**
 * Format number as currency string
 * 
 * @param {number} value - The numeric value to format
 * @returns {string} Formatted currency string (e.g., "$1,234")
 */
function formatCurrency(value){
  return `$${value.toLocaleString()}`;
}
