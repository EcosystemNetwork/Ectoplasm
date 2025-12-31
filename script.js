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

/**
 * Price ticker configuration
 * @constant {number}
 */
const PRICE_TICKER_BASE_INTERVAL = 60_000; // 60 seconds
const PRICE_TICKER_MAX_BACKOFF = 300_000;  // 5 minutes maximum backoff
const PRICE_TICKER_MAX_FAILURES = 3;       // Number of failures before backoff
const API_TIMEOUT = 10_000;                 // 10 seconds API timeout

/**
 * Swap configuration
 * @constant {number}
 */
const MAX_REASONABLE_SWAP = 1_000_000; // Maximum reasonable swap amount
const WALLET_CONNECTION_TIMEOUT = 30_000; // 30 seconds wallet connection timeout

/**
 * Performance thresholds
 * @constant {number}
 */
const DEBOUNCE_DELAY_SEARCH = 300;  // ms for search input
const DEBOUNCE_DELAY_CALC = 150;    // ms for calculations

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Debounce function to limit how often a function can be called
 * Useful for search inputs, resize events, etc.
 * 
 * @param {Function} func - The function to debounce
 * @param {number} wait - Milliseconds to wait before calling func
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Sanitize user input to prevent XSS attacks
 * Escapes HTML special characters
 * 
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Performance monitoring utility
 * Tracks and logs performance metrics for optimization
 */
const performanceMonitor = {
  marks: new Map(),
  
  /**
   * Mark the start of a performance measurement
   * @param {string} name - Name of the measurement
   */
  start(name) {
    this.marks.set(name, performance.now());
  },
  
  /**
   * Mark the end of a performance measurement and log the duration
   * @param {string} name - Name of the measurement
   * @param {boolean} log - Whether to log the result (default: true in development)
   */
  end(name, log = true) {
    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`No start mark found for: ${name}`);
      return;
    }
    
    const duration = performance.now() - startTime;
    this.marks.delete(name);
    
    if (log) {
      console.log(`⚡ Performance: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  },
  
  /**
   * Get navigation timing metrics
   */
  getPageLoadMetrics() {
    if (!performance.timing) return null;
    
    const timing = performance.timing;
    return {
      dns: timing.domainLookupEnd - timing.domainLookupStart,
      tcp: timing.connectEnd - timing.connectStart,
      ttfb: timing.responseStart - timing.requestStart,
      download: timing.responseEnd - timing.responseStart,
      domInteractive: timing.domInteractive - timing.navigationStart,
      domComplete: timing.domComplete - timing.navigationStart,
      loadComplete: timing.loadEventEnd - timing.navigationStart
    };
  },
  
  /**
   * Log page load performance metrics
   */
  logPageLoad() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const metrics = this.getPageLoadMetrics();
        if (metrics) {
          console.log('📊 Page Load Metrics:', {
            'DNS Lookup': `${metrics.dns}ms`,
            'TCP Connection': `${metrics.tcp}ms`,
            'Time to First Byte': `${metrics.ttfb}ms`,
            'Content Download': `${metrics.download}ms`,
            'DOM Interactive': `${metrics.domInteractive}ms`,
            'DOM Complete': `${metrics.domComplete}ms`,
            'Load Complete': `${metrics.loadComplete}ms`
          });
        }
      }, 0);
    });
  }
};

// Initialize performance monitoring
performanceMonitor.logPageLoad();

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
 * 
 * Memory management:
 * - Properly cleans up intervals and event listeners
 * - Tracks active timers for cleanup on page unload
 */
document.addEventListener('DOMContentLoaded', () => {
  performanceMonitor.start('DOMContentLoaded');
  
  // Update copyright year in footer
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Initialize theme system (restores user preference or system default)
  hydrateTheme();
  
  // Restore wallet connection from previous session
  hydrateWalletConnection();
  
  // Start CSPR price ticker (fetches and updates every 60 seconds)
  initPriceTicker();

  // Setup event listeners for interactive elements
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
  
  // Also setup nav theme toggle button
  const navThemeToggle = document.getElementById('navThemeToggle');
  if (navThemeToggle) navThemeToggle.addEventListener('click', toggleTheme);

  const connectWallet = document.getElementById('connectWallet');
  if (connectWallet) {
    connectWallet.addEventListener('click', () => {
      // If already connected, disconnect; otherwise, connect
      if (window.connectedWallet && window.connectedAccount) {
        disconnectWalletHandler();
      } else {
        connectWalletHandler();
      }
    });
  }

  if(window.location.hash === '#swap') activateSwapNav();
  window.addEventListener('hashchange', () => {
    if(window.location.hash === '#swap') activateSwapNav();
  });

  // Initialize page-specific components
  performanceMonitor.start('setupLogoMenu');
  setupLogoMenu();        // Mega menu navigation
  performanceMonitor.end('setupLogoMenu', false);
  
  performanceMonitor.start('setupSwapDemo');
  setupSwapDemo();        // Swap calculator with order types
  performanceMonitor.end('setupSwapDemo', false);
  
  performanceMonitor.start('setupPopouts');
  setupPopouts();         // Settings/details/network popovers
  performanceMonitor.end('setupPopouts', false);
  
  performanceMonitor.start('setupPromoSlider');
  setupPromoSlider();     // Launchpad promotional budget slider
  performanceMonitor.end('setupPromoSlider', false);
  
  performanceMonitor.start('setupTokenModal');
  setupTokenModal();      // Token creation modal for launchpad
  performanceMonitor.end('setupTokenModal', false);
  
  performanceMonitor.start('renderDashboard');
  renderDashboard();      // Dashboard tasks/quests/rewards
  performanceMonitor.end('renderDashboard', false);
  
  performanceMonitor.start('renderLaunchpadTokens');
  renderLaunchpadTokens();// Launchpad token library table
  performanceMonitor.end('renderLaunchpadTokens', false);
  
  performanceMonitor.end('DOMContentLoaded');
});

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
  // Any active intervals or timers should be cleared
  // This is handled within each component, but we can add global cleanup here if needed
  console.log('🧹 Cleaning up before page unload');
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
  const desired = stored || 'dark'; // Default to dark mode
  setTheme(desired);
}

/**
 * Hydrate wallet connection from localStorage
 * 
 * Restores the wallet connection state from a previous session if available.
 * This ensures users stay logged in when navigating between pages.
 * 
 * Priority order:
 * 1. User's saved wallet connection in localStorage
 * 2. No connection (user needs to connect)
 * 
 * Called on page load to restore the user's wallet connection
 */
function hydrateWalletConnection() {
  const storedWallet = localStorage.getItem('ectoplasm-connected-wallet');
  const storedAccount = localStorage.getItem('ectoplasm-connected-account');
  
  if (storedWallet && storedAccount) {
    // Restore global state for contract interactions
    window.connectedWallet = storedWallet;
    window.connectedAccount = storedAccount;
    
    // Update UI with restored connection
    const connectBtn = document.getElementById('connectWallet');
    if (connectBtn) {
      const shortKey = typeof storedAccount === 'string' && storedAccount.length > 12
        ? `${storedAccount.slice(0, 6)}…${storedAccount.slice(-4)}`
        : storedAccount;
      
      connectBtn.textContent = `Connected: ${shortKey}`;
      connectBtn.classList.add('connected');
      connectBtn.disabled = false;
    }
    
    // Update wallet status badge
    updateWalletStatus(`Connected via ${storedWallet}`);
  }

  // Update dashboard visibility based on connection state
  updateDashboardVisibility();
}

/**
 * Update dashboard link visibility based on wallet connection state
 *
 * Dashboard link is now always visible in the navigation.
 * Previously, it was only shown when a wallet was connected, but now
 * it's accessible to all users regardless of connection state.
 */
function updateDashboardVisibility() {
  // Dashboard is now always visible - find all dashboard links and ensure they're shown
  const dashboardLinks = document.querySelectorAll('.nav a[href="/dashboard.html"], .nav a[href="dashboard.html"]');

  dashboardLinks.forEach(link => {
    link.style.display = '';
    link.removeAttribute('hidden');
  });
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
 * - Implements exponential backoff on API errors
 * - Request timeout to prevent hanging
 */
async function initPriceTicker(){
  const el = document.getElementById('priceTicker');
  if (!el) return; // Element not on this page
  
  let failureCount = 0;
  let currentInterval = PRICE_TICKER_BASE_INTERVAL;
  let intervalId = null;
  
  /**
   * Fetch current CSPR price from CoinGecko API
   * Updates the price ticker element with formatted USD price
   * Implements retry logic with exponential backoff
   */
  const fetchPrice = async () => {
    try{
      // CoinGecko API endpoint for Casper Network
      // Free tier, no API key required (rate-limited to 50 calls/min)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
      
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=casper-network&vs_currencies=usd', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if(!res.ok) throw new Error(`HTTP ${res.status}: price fetch failed`);
      const data = await res.json();
      const price = data['casper-network']?.usd;
      
      if(!isNaN(price)) {
        el.textContent = `CSPR $${price.toFixed(2)}`;
        el.setAttribute('data-last-update', new Date().toISOString());
        failureCount = 0; // Reset failure count on success
        
        // Reset to normal interval if we were in backoff mode
        if(currentInterval !== PRICE_TICKER_BASE_INTERVAL) {
          currentInterval = PRICE_TICKER_BASE_INTERVAL;
          resetInterval();
        }
      } else {
        throw new Error('Invalid price data received');
      }
    }catch(e){
      failureCount++;
      console.warn(`Price fetch error (attempt ${failureCount}/${PRICE_TICKER_MAX_FAILURES}):`, e.message);
      
      // Implement exponential backoff on repeated failures
      if(failureCount >= PRICE_TICKER_MAX_FAILURES) {
        currentInterval = Math.min(
          PRICE_TICKER_BASE_INTERVAL * Math.pow(2, failureCount - PRICE_TICKER_MAX_FAILURES),
          PRICE_TICKER_MAX_BACKOFF
        );
        resetInterval();
      }
      
      // Leave fallback text (CSPR $--.--) on error
      if(!el.hasAttribute('data-last-update')) {
        el.textContent = 'CSPR $--.--';
      }
    }
  };
  
  /**
   * Reset the interval timer with current interval value
   */
  const resetInterval = () => {
    if(intervalId) clearInterval(intervalId);
    intervalId = setInterval(fetchPrice, currentInterval);
  };
  
  // Fetch immediately on load
  fetchPrice();
  
  // Start interval timer
  intervalId = setInterval(fetchPrice, currentInterval);
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
  const navBtn = document.getElementById('navThemeToggle');
  const next = theme === 'light' ? 'dark' : 'light';

  // Apply theme to document root
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  
  // Update toggle button if present (in menu)
  if (btn){
    btn.textContent = `${next} mode`;
    btn.setAttribute('aria-pressed', theme === 'light');
  }
  
  // Update nav toggle button if present
  if (navBtn){
    navBtn.textContent = theme === 'light' ? '☀️' : '🌙';
    navBtn.setAttribute('aria-pressed', theme === 'light');
    navBtn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
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
 * Enhancements:
 * - Better error messages for user guidance
 * - Timeout protection for hanging connections
 * - Loading state indication
 * 
 * @async
 */
async function connectWalletHandler(){
  const connectBtn = document.getElementById('connectWallet');
  
  // Show loading state
  if(connectBtn) {
    connectBtn.textContent = 'Connecting...';
    connectBtn.disabled = true;
  }
  
  try {
    // Detect available wallet providers
    const casperWalletProvider = typeof window.CasperWalletProvider === 'function' ? window.CasperWalletProvider() : null;
    const casperSigner = window.casperlabsHelper || window.CasperWallet;
    const csprCloud = window.csprclick;

    // Check if any wallet is available
    if(!casperWalletProvider && !casperSigner && !csprCloud){
      throw new Error('NO_WALLET_DETECTED');
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
      if(!choice) {
        throw new Error('USER_CANCELLED');
      }
      if(choice && choices.includes(choice.trim().toLowerCase())){
        selectedWallet = choice.trim().toLowerCase();
      }
    }

    let connectedAccount = null;

    // Connect to selected wallet provider with timeout
    const connectionPromise = (async () => {
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
      return connectedAccount;
    })();
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('CONNECTION_TIMEOUT')), WALLET_CONNECTION_TIMEOUT);
    });
    
    connectedAccount = await Promise.race([connectionPromise, timeoutPromise]);

    // Update UI with connected account
    if(connectedAccount){
      // Truncate long public keys for display (first 6 + last 4 chars)
      const shortKey = typeof connectedAccount === 'string' && connectedAccount.length > 12
        ? `${connectedAccount.slice(0, 6)}…${connectedAccount.slice(-4)}`
        : connectedAccount;
      
      if(connectBtn) {
        connectBtn.textContent = `Connected: ${shortKey}`;
        connectBtn.classList.add('connected');
        connectBtn.disabled = false;
      }
      
      // Store connection state globally for contract interactions
      window.connectedWallet = selectedWallet;
      window.connectedAccount = connectedAccount;
      
      // Persist connection state to localStorage for cross-page sessions
      localStorage.setItem('ectoplasm-connected-wallet', selectedWallet);
      localStorage.setItem('ectoplasm-connected-account', connectedAccount);
      
      // Update wallet status badge
      updateWalletStatus(`Connected via ${selectedWallet}`);

      // Show dashboard link now that user is logged in
      updateDashboardVisibility();

      // Refresh token balances after connection
      if (typeof CasperService !== 'undefined') {
        updateTokenBalances();
      }
    }
  }catch(err){
    console.error('Wallet connection failed', err);
    
    // Provide user-friendly error messages
    let userMessage = 'Wallet connection failed. Please try again.';
    
    if(err.message === 'NO_WALLET_DETECTED'){
      userMessage = 'No Casper wallet detected. Please install CasperWallet, CasperSigner, or CSPR.CLOUD extension.';
    } else if(err.message === 'USER_CANCELLED'){
      userMessage = 'Wallet connection cancelled.';
    } else if(err.message === 'CONNECTION_TIMEOUT'){
      userMessage = 'Wallet connection timed out. Please check your wallet extension and try again.';
    } else if(err.message.includes('User rejected')){
      userMessage = 'Wallet connection rejected. Please approve the connection request in your wallet.';
    }
    
    alert(userMessage);
    updateWalletStatus('Connection failed');
    
    // Reset button state
    if(connectBtn) {
      connectBtn.textContent = 'Connect Wallet';
      connectBtn.disabled = false;
      connectBtn.classList.remove('connected');
    }
  }
}

/**
 * Handle wallet disconnection
 * 
 * Clears the wallet connection state from memory and localStorage,
 * and updates the UI to reflect the disconnected state.
 * 
 * This ensures a clean state when the user disconnects and prevents
 * stale connection data from persisting across sessions.
 */
function disconnectWalletHandler() {
  const connectBtn = document.getElementById('connectWallet');
  
  // Clear global state
  delete window.connectedWallet;
  delete window.connectedAccount;
  
  // Clear localStorage
  localStorage.removeItem('ectoplasm-connected-wallet');
  localStorage.removeItem('ectoplasm-connected-account');
  
  // Reset button state
  if (connectBtn) {
    connectBtn.textContent = 'Connect Wallet';
    connectBtn.disabled = false;
    connectBtn.classList.remove('connected');
  }
  
  // Update wallet status badge
  updateWalletStatus('Wallet disconnected');
  
  // Hide dashboard link now that user is logged out
  updateDashboardVisibility();

  console.log('Wallet disconnected');
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
  const rateDisplay = document.getElementById('rateDisplay');
  const minReceived = document.getElementById('minReceived');
  const feeDisplay = document.getElementById('feeDisplay');

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
   * Build a readable token symbol for UI text
   */
  const getTokenLabel = (el, fallback) => {
    if(!el) return fallback;
    const selected = el.options[el.selectedIndex];
    return (selected?.textContent || fallback || '').toUpperCase();
  };

  /**
   * Estimate a network fee for the demo UI
   */
  const estimateFee = (inputValue) => {
    const base = Math.max(0.003, inputValue * 0.0002);
    return base.toFixed(4);
  };

  /**
   * Calculate output amount when inputs or tokens change
   * Uses CasperService for real quotes when available, falls back to demo rates
   * Includes input validation and sanitization
   */
  const updateOutputs = async (source = 'from') => {
    const sellSymbol = getTokenLabel(fromToken, 'CSPR');
    const buySymbol = getTokenLabel(toToken, 'ECTO');
    const slippagePct = parseFloat(slippage?.value) || 0.5;
    let val;

    // Handle "to" input (reverse calculation)
    if(source === 'to'){
      const desired = parseFloat(toAmt.value) || 0;
      if(desired < 0){
        toAmt.value = 0;
      }
      // For now, use demo rate for reverse calculation
      const rate = getRate();
      val = Math.max(0, desired) / (rate || 1);
      fromAmt.value = val ? val.toFixed(6) : '';
    } else {
      val = parseFloat(fromAmt.value) || 0;

      // Prevent negative values and ensure reasonable limits
      if(val < 0) {
        fromAmt.value = 0;
        val = 0;
      }

      // Warn on excessively large values (potential input error)
      if(val > MAX_REASONABLE_SWAP) {
        console.warn('Unusually large swap amount detected:', val);
      }
    }

    // Try to get a real quote from CasperService
    let quote = null;
    if (typeof CasperService !== 'undefined' && val > 0) {
      quote = await getSwapQuote();
    }

    // Use quote data if available, otherwise fall back to demo rates
    if (quote && quote.valid) {
      // Update output amount from quote
      if (source !== 'to') {
        toAmt.value = quote.amountOut || '';
      }

      // Update price impact from real calculation
      const HIGH_IMPACT_THRESHOLD = 10; // 10% warning threshold
      if(priceImpactDetail){
        priceImpactDetail.textContent = `${quote.priceImpact}%`;
        const parentEl = priceImpactDetail.parentElement;
        if(parentEl) {
          parentEl.classList.toggle('warning', parseFloat(quote.priceImpact) > HIGH_IMPACT_THRESHOLD);
        }
      }

      // Update rate display
      if(rateDisplay){
        rateDisplay.textContent = `1 ${sellSymbol} ≈ ${quote.rate} ${buySymbol}`;
      }

      // Update order summary
      if(orderSummary){
        orderSummary.hidden = false;
        const demoNote = quote.demo ? ' (Demo)' : '';
        orderSummary.textContent = `You send ${val} ${sellSymbol} and will receive at least ${quote.minReceived} ${buySymbol} with ${slippagePct}% slippage.${demoNote}`;
        if(minReceived) minReceived.textContent = `${quote.minReceived} ${buySymbol}`;
      }
    } else {
      // Fall back to demo rate calculation
      const rate = getRate();
      const output = val * (rate || 1);

      if (source !== 'to') {
        toAmt.value = output ? output.toFixed(6) : '';
      }

      // Demo price impact (simplified: grows with swap size)
      const HIGH_IMPACT_THRESHOLD = 0.1;
      const impact = Math.min(0.5, (val/1000));
      const impactText = (impact*100).toFixed(2) + '%';

      if(priceImpactDetail){
        priceImpactDetail.textContent = impactText;
        const parentEl = priceImpactDetail.parentElement;
        if(parentEl) {
          parentEl.classList.toggle('warning', impact > HIGH_IMPACT_THRESHOLD);
        }
      }

      if(rateDisplay){
        rateDisplay.textContent = `1 ${sellSymbol} ≈ ${(rate).toFixed(4)} ${buySymbol}`;
      }

      if(orderSummary){
        const hasValue = val > 0;
        if(hasValue){
          const minValue = (val * rate) * (1 - slippagePct/100);
          orderSummary.hidden = false;
          orderSummary.textContent = `You send ${val || 0} ${sellSymbol} and will receive at least ${minValue.toFixed(6)} ${buySymbol} with ${slippagePct}% slippage.`;
          if(minReceived) minReceived.textContent = `${minValue.toFixed(6)} ${buySymbol}`;
        } else {
          orderSummary.hidden = true;
          orderSummary.textContent = '';
          if(minReceived) minReceived.textContent = '--';
        }
      }
    }

    if(feeDisplay){
      feeDisplay.textContent = `~${estimateFee(val)} ${sellSymbol}`;
    }
  };

  // Debounce updateOutputs for better performance during rapid input
  const debouncedUpdateOutputs = debounce((source = 'from') => updateOutputs(source), DEBOUNCE_DELAY_CALC);

  fromAmt.addEventListener('input', () => debouncedUpdateOutputs('from'));
  toAmt.addEventListener('input', () => debouncedUpdateOutputs('to'));
  if(fromToken) fromToken.addEventListener('change', () => {
    updateOutputs('from');
    // Update balance display for new token selection
    if (window.tokenBalances) {
      const symbol = fromToken.value?.toUpperCase();
      const bal = window.tokenBalances[symbol];
      const balanceEl = document.querySelector('.token-row:first-of-type .balance');
      if (balanceEl && bal) {
        balanceEl.textContent = `Balance: ${bal.formatted}`;
      }
    }
  });
  if(toToken) toToken.addEventListener('change', () => {
    updateOutputs('from');
    // Update balance display for new token selection
    if (window.tokenBalances) {
      const symbol = toToken.value?.toUpperCase();
      const bal = window.tokenBalances[symbol];
      const balanceEl = document.querySelector('.token-row:last-of-type .balance');
      if (balanceEl && bal) {
        balanceEl.textContent = `Balance: ${bal.formatted}`;
      }
    }
  });

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
      summary: '',
      action: 'place limit',
      showLimit: true,
      tokens: null
    },
    buy: {
      pill: 'Buy',
      title: 'Buy ECTO with CSPR while respecting your price cap.',
      summary: '',
      action: 'buy',
      showLimit: true,
      tokens: { from: 'cspr', to: 'ecto' }
    },
    sell: {
      pill: 'Sell',
      title: 'Sell ECTO back to CSPR with tight routing.',
      summary: '',
      action: 'sell',
      showLimit: true,
      tokens: { from: 'cspr', to: 'ecto' }
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

  // Create backdrop overlay for centered pool popouts (only created once on first call)
  let backdrop = document.getElementById('popout-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'popout-backdrop';
    backdrop.className = 'pool-popout-backdrop';
    document.body.appendChild(backdrop);
  }

  /**
   * Close all open popovers
   */
  const closeAll = () => {
    entries.forEach(({btn, popout}) => {
      popout.setAttribute('hidden', '');
      popout.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    });
    backdrop.style.display = 'none';
    backdrop.classList.remove('is-visible');
    document.body.classList.remove('pool-popout-open');
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
        popout.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        // Show backdrop for pool popouts
        if (popout.classList.contains('pool-popout')) {
          backdrop.style.display = 'block';
          backdrop.classList.add('is-visible');
          document.body.classList.add('pool-popout-open');
        }
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

  // Close all popovers when clicking outside or on backdrop
  document.addEventListener('click', closeAll);
  backdrop.addEventListener('click', closeAll);
  
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
 * Execute swap transaction
 * Uses CasperService for real contract interactions when available,
 * falls back to demo mode when contracts are not deployed
 */
async function demoSwap(){
  // Check if wallet is connected
  if (!window.connectedAccount || !window.connectedWallet) {
    alert('Please connect your wallet first');
    return;
  }

  // Check if CasperService is available
  if (typeof CasperService === 'undefined') {
    alert('CasperService not loaded. Please refresh the page.');
    return;
  }

  // Check if we have a valid quote
  if (!window.currentSwapQuote || !window.currentSwapQuote.valid) {
    alert('Please enter a valid swap amount first');
    return;
  }

  // Check if this is a demo quote (contracts not deployed)
  if (window.currentSwapQuote.demo) {
    alert('Demo mode: Token contracts not yet deployed on testnet.\n\nOnce contracts are deployed and config.js is updated with token hashes, real swaps will be enabled.');
    return;
  }

  const actionBtn = document.getElementById('swapActionBtn');
  const originalText = actionBtn ? actionBtn.textContent : 'Swap';

  try {
    if (actionBtn) {
      actionBtn.textContent = 'Approving...';
      actionBtn.style.pointerEvents = 'none';
    }

    const slippage = parseFloat(document.getElementById('slippage')?.value) || 0.5;

    // Execute the swap via CasperService
    const deployHash = await CasperService.executeSwap(window.currentSwapQuote, slippage);

    if (actionBtn) {
      actionBtn.textContent = 'Confirming...';
    }

    // Wait for transaction confirmation
    const result = await CasperService.waitForDeploy(deployHash);

    if (result.success) {
      alert(`Swap successful!\n\nTransaction hash:\n${deployHash}`);

      // Refresh balances
      await updateTokenBalances();

      // Clear form
      const fromAmt = document.getElementById('fromAmount');
      const toAmt = document.getElementById('toAmount');
      if (fromAmt) fromAmt.value = '';
      if (toAmt) toAmt.value = '';
      window.currentSwapQuote = null;
    } else {
      alert(`Swap failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Swap error:', error);
    alert(`Swap failed: ${error.message}`);
  } finally {
    if (actionBtn) {
      actionBtn.textContent = originalText;
      actionBtn.style.pointerEvents = '';
    }
  }
}

/**
 * Update token balance displays in the swap UI
 * Fetches balances from CasperService and updates the balance labels
 */
async function updateTokenBalances() {
  if (typeof CasperService === 'undefined' || !window.connectedAccount) {
    return;
  }

  try {
    const balances = await CasperService.getAllBalances();

    // Update "from" token balance display
    const fromToken = document.getElementById('fromToken');
    const fromBalance = document.querySelector('.token-row:first-of-type .balance');
    if (fromToken && fromBalance) {
      const symbol = fromToken.value?.toUpperCase() || 'CSPR';
      const bal = balances[symbol];
      if (bal) {
        fromBalance.textContent = `Balance: ${bal.formatted}`;
      }
    }

    // Update "to" token balance display
    const toToken = document.getElementById('toToken');
    const toBalance = document.querySelector('.token-row:last-of-type .balance');
    if (toToken && toBalance) {
      const symbol = toToken.value?.toUpperCase() || 'ECTO';
      const bal = balances[symbol];
      if (bal) {
        toBalance.textContent = `Balance: ${bal.formatted}`;
      }
    }

    // Store balances globally for easy access
    window.tokenBalances = balances;
    console.log('Token balances updated:', balances);
  } catch (error) {
    console.error('Failed to update token balances:', error);
  }
}

/**
 * Get swap quote using CasperService
 * Updates the UI with quote details including price impact and minimum received
 */
async function getSwapQuote() {
  if (typeof CasperService === 'undefined') {
    return null;
  }

  const fromToken = document.getElementById('fromToken');
  const toToken = document.getElementById('toToken');
  const fromAmt = document.getElementById('fromAmount');

  if (!fromToken || !toToken || !fromAmt) {
    return null;
  }

  const fromSymbol = fromToken.value?.toUpperCase() || 'CSPR';
  const toSymbol = toToken.value?.toUpperCase() || 'ECTO';
  const amount = fromAmt.value || '0';

  if (parseFloat(amount) <= 0) {
    window.currentSwapQuote = null;
    return null;
  }

  try {
    const quote = await CasperService.getSwapQuote(fromSymbol, toSymbol, amount);
    window.currentSwapQuote = quote;
    return quote;
  } catch (error) {
    console.error('Quote error:', error);
    window.currentSwapQuote = null;
    return null;
  }
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

/**
 * Setup token creation modal
 * Handles opening and closing the modal for creating new tokens
 * Inspired by pump.fun's modal pattern
 * 
 * Features:
 * - Click "Create Token" button to open modal
 * - Click close button (X) to close modal
 * - Click outside modal to close
 * - Press Escape key to close
 * - Proper focus management for accessibility
 * - Body scroll lock when modal is open
 */
function setupTokenModal(){
  const modal = document.getElementById('tokenModal');
  const openBtn = document.getElementById('createTokenBtn');
  const closeBtn = modal?.querySelector('.modal-close');
  const modalContainer = modal?.querySelector('.modal-container');
  
  if(!modal || !openBtn) return; // Not on launchpad page
  
  // Delay for focus management after modal opens (allows animation to complete)
  const FOCUS_DELAY_MS = 100;
  
  /**
   * Open the modal
   * Locks body scroll and focuses first input
   */
  const openModal = () => {
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
    
    // Focus first input for better UX (delay allows modal animation to complete)
    const firstInput = modal.querySelector('input[type="text"]');
    if(firstInput) {
      setTimeout(() => firstInput.focus(), FOCUS_DELAY_MS);
    }
    
    // Announce to screen readers
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-title');
  };
  
  /**
   * Close the modal
   * Restores body scroll and returns focus to trigger button
   */
  const closeModal = () => {
    modal.setAttribute('hidden', '');
    document.body.style.overflow = ''; // Restore scroll
    
    // Return focus to trigger button
    if(openBtn) openBtn.focus();
  };
  
  /**
   * Handle Escape key press
   * Only closes modal if it's currently open
   */
  const handleEscape = (e) => {
    if(e.key === 'Escape' && !modal.hasAttribute('hidden')) {
      closeModal();
    }
  };
  
  // Open modal on button click
  openBtn.addEventListener('click', openModal);
  
  // Close modal on close button click
  if(closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  // Close modal when clicking on overlay (outside modal content)
  modal.addEventListener('click', (e) => {
    if(e.target === modal) {
      closeModal();
    }
  });
  
  // Prevent clicks inside modal content from closing
  if(modalContainer) {
    modalContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  // Close modal on Escape key
  document.addEventListener('keydown', handleEscape);
}

// ============================================================================
// DASHBOARD GAMIFICATION
// ============================================================================

// Dashboard content configuration
const DASHBOARD_DATA = {
  dailyTasks: [
    { id: 0, title: 'Check-in and claim streak bonus', xp: 40 },
    { id: 1, title: 'Complete one swap on Casper', xp: 120 },
    { id: 2, title: 'Stake liquidity into any $ECTO pair', xp: 200 },
    { id: 3, title: 'Vote on one governance proposal', xp: 90 },
    { id: 4, title: 'Claim today’s login reward chest', xp: 60 },
    { id: 5, title: 'Finish a 3-trade combo route', xp: 140 }
  ],
  weeklyQuests: [
    { id: 'quest-0', title: 'Clear 5 swaps with <0.5% slippage', reward: 'Badge + 200 XP', xp: 200, actionType: 'swap', actionLabel: 'Log a swap' },
    { id: 'quest-1', title: 'Provide liquidity for 3 consecutive days', reward: 'Boosted APR day', xp: 150, actionType: 'liquidity', actionLabel: 'Log today’s liquidity' },
    { id: 'quest-2', title: 'Complete 10 trades across different pairs', reward: 'Trading bonus + 180 XP', xp: 180, actionType: 'pair', actionLabel: 'Log traded pair' }
  ],
  missions: [
    { id: 'mission-0', title: 'Create your first trade', detail: 'Swap any token pair once', reward: 'Starter chest + 120 XP', xp: 120, type: 'Starter' },
    { id: 'mission-1', title: 'Hit 10,000 CSPR volume', detail: 'Accumulate trading volume over the week', reward: 'Volume badge + 350 XP', xp: 350, type: 'Volume' },
    { id: 'mission-2', title: '7-day login streak', detail: 'Check in every day for a week', reward: 'Streak loot box + 280 XP', xp: 280, type: 'Streak' },
    { id: 'mission-3', title: 'Complete 3 liquidity quests', detail: 'Finish any three liquidity missions', reward: 'Liquidity booster + 320 XP', xp: 320, type: 'Liquidity' },
    { id: 'mission-4', title: 'Combo trader', detail: 'Execute trades on three different pairs in one session', reward: 'Combo flair + 260 XP', xp: 260, type: 'Combo' },
    { id: 'mission-5', title: 'Prize redemption run', detail: 'Redeem any reward from the catalog', reward: 'Mystery drop + 220 XP', xp: 220, type: 'Redemption' }
  ],
  rewards: [
    { id: 'reward-0', title: 'Swap fee rebate', cost: 400, detail: '5% off for 24h' },
    { id: 'reward-1', title: 'Launchpad priority slot', cost: 900, detail: 'Jump queue for next cohort' },
    { id: 'reward-2', title: 'Trading boost', cost: 700, detail: '1.2x rewards on trades for 48h' }
  ]
};

const DASHBOARD_CONSTANTS = {
  defaultSwapVolume: 2500
};

// Helpers
const getTodayKey = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const ensureArray = (value) => Array.isArray(value) ? value : [];

const uniqueList = (list = []) => Array.from(new Set(list));

const getConsecutiveDays = (days = []) => {
  const uniqueDays = uniqueList(days)
    .map(str => new Date(str))
    .filter(d => !isNaN(d))
    .sort((a, b) => b.getTime() - a.getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  let cursor = new Date(today);

  uniqueDays.forEach(day => {
    day.setHours(0, 0, 0, 0);
    if (day.getTime() === cursor.getTime()) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  });

  return streak;
};

/**
 * Dashboard state management
 * Handles user progress, task completion, and XP tracking
 * Persists to localStorage for cross-session continuity
 */
const DashboardState = {
  getDefaultState() {
    return {
      streak: 0,
      xp: 0,
      lastCheckIn: null,
      completedTasks: [],
      completedQuests: [],
      completedMissions: [],
      redeemedRewards: [],
      metrics: {
        swaps: 0,
        swapVolume: 0,
        liquidityDays: [],
        liquidityActions: 0,
        governanceVotes: 0,
        comboRuns: 0,
        rewardClaims: 0,
        rewardsRedeemed: 0,
        uniquePairs: [],
        checkIns: 0
      },
      questProgress: {
        'quest-0': 0,
        'quest-1': 0,
        'quest-2': 0
      },
      missionProgress: {
        'mission-0': 0,
        'mission-1': 0,
        'mission-2': 0,
        'mission-3': 0,
        'mission-4': 0,
        'mission-5': 0
      }
    };
  },

  normalizeState(rawState) {
    const defaultState = this.getDefaultState();
    const safeState = rawState || {};
    return {
      ...defaultState,
      ...safeState,
      completedTasks: ensureArray(safeState.completedTasks),
      completedQuests: ensureArray(safeState.completedQuests),
      completedMissions: ensureArray(safeState.completedMissions),
      redeemedRewards: ensureArray(safeState.redeemedRewards),
      metrics: {
        ...defaultState.metrics,
        ...(safeState.metrics || {}),
        liquidityDays: uniqueList(ensureArray(safeState.metrics?.liquidityDays)),
        uniquePairs: uniqueList(ensureArray(safeState.metrics?.uniquePairs))
      },
      questProgress: {
        ...defaultState.questProgress,
        ...(safeState.questProgress || {})
      },
      missionProgress: {
        ...defaultState.missionProgress,
        ...(safeState.missionProgress || {})
      }
    };
  },

  recalculateProgress(state, { awardXP = false } = {}) {
    const prevCompletedQuests = new Set(state.completedQuests);
    const prevCompletedMissions = new Set(state.completedMissions);
    const metrics = state.metrics;
    const liquidityStreak = getConsecutiveDays(metrics.liquidityDays);
    const questProgress = {
      'quest-0': Math.min(100, (metrics.swaps / 5) * 100),
      'quest-1': Math.min(100, (liquidityStreak / 3) * 100),
      'quest-2': Math.min(100, (uniqueList(metrics.uniquePairs).length / 10) * 100)
    };

    const missionProgress = {
      'mission-0': Math.min(100, (metrics.swaps > 0 ? 100 : 0)),
      'mission-1': Math.min(100, (metrics.swapVolume / 10_000) * 100),
      'mission-2': Math.min(100, (state.streak / 7) * 100),
      'mission-3': Math.min(100, (liquidityStreak / 3) * 100),
      'mission-4': Math.min(100, (metrics.comboRuns / 3) * 100),
      'mission-5': Math.min(100, (metrics.rewardsRedeemed > 0 ? 100 : 0))
    };

    state.questProgress = questProgress;
    state.missionProgress = missionProgress;
    state.completedQuests = Object.keys(questProgress).filter(id => questProgress[id] >= 100);
    state.completedMissions = Object.keys(missionProgress).filter(id => missionProgress[id] >= 100);

    if (awardXP) {
      state.completedQuests.forEach(id => {
        if (!prevCompletedQuests.has(id)) {
          const quest = DASHBOARD_DATA.weeklyQuests.find(q => q.id === id);
          if (quest?.xp) state.xp += quest.xp;
        }
      });

      state.completedMissions.forEach(id => {
        if (!prevCompletedMissions.has(id)) {
          const mission = DASHBOARD_DATA.missions.find(m => m.id === id);
          if (mission?.xp) state.xp += mission.xp;
        }
      });
    }

    return state;
  },

  applyTaskEffects(state, taskIndex, direction = 1) {
    const metrics = state.metrics;
    const todayKey = getTodayKey();
    switch (taskIndex) {
      case 0:
        if (direction > 0) {
          state.streak += 1;
          state.lastCheckIn = new Date().toISOString();
          metrics.checkIns = Math.max(0, metrics.checkIns + 1);
        } else {
          state.streak = Math.max(0, state.streak - 1);
          metrics.checkIns = Math.max(0, metrics.checkIns - 1);
          if (state.streak === 0) state.lastCheckIn = null;
        }
        break;
      case 1:
        metrics.swaps = Math.max(0, metrics.swaps + direction);
        metrics.swapVolume = Math.max(0, metrics.swapVolume + direction * DASHBOARD_CONSTANTS.defaultSwapVolume);
        if (direction > 0) {
          const nextPair = `Pair #${uniqueList(metrics.uniquePairs).length + 1}`;
          metrics.uniquePairs = uniqueList([...metrics.uniquePairs, nextPair]);
        } else if (metrics.uniquePairs.length > 0) {
          metrics.uniquePairs = metrics.uniquePairs.slice(0, Math.max(0, metrics.uniquePairs.length - 1));
        }
        break;
      case 2:
        if (direction > 0 && !metrics.liquidityDays.includes(todayKey)) {
          metrics.liquidityDays = uniqueList([...metrics.liquidityDays, todayKey]);
        } else if (direction < 0) {
          metrics.liquidityDays = metrics.liquidityDays.filter(day => day !== todayKey);
        }
        metrics.liquidityActions = Math.max(0, metrics.liquidityActions + direction);
        break;
      case 3:
        metrics.governanceVotes = Math.max(0, metrics.governanceVotes + direction);
        break;
      case 4:
        metrics.rewardClaims = Math.max(0, metrics.rewardClaims + direction);
        break;
      case 5:
        metrics.comboRuns = Math.max(0, metrics.comboRuns + direction);
        break;
      default:
        break;
    }
  },

  recordAction(actionType, payload = {}) {
    const state = this.get();
    const metrics = state.metrics;
    const todayKey = getTodayKey();
    switch (actionType) {
      case 'swap':
        metrics.swaps += payload.count || 1;
        metrics.swapVolume = Math.max(0, metrics.swapVolume + (payload.volume || DASHBOARD_CONSTANTS.defaultSwapVolume));
        metrics.uniquePairs = uniqueList([...(metrics.uniquePairs || []), payload.pair || `Pair #${metrics.swaps}`]);
        break;
      case 'liquidity':
        metrics.liquidityActions += payload.count || 1;
        if (!metrics.liquidityDays.includes(todayKey)) {
          metrics.liquidityDays = uniqueList([...(metrics.liquidityDays || []), todayKey]);
        }
        break;
      case 'pair':
        metrics.uniquePairs = uniqueList([...(metrics.uniquePairs || []), payload.pair || `Pair #${metrics.uniquePairs.length + 1}`]);
        metrics.swaps += 1;
        metrics.swapVolume += payload.volume || DASHBOARD_CONSTANTS.defaultSwapVolume;
        break;
      case 'combo':
        metrics.comboRuns += payload.count || 1;
        break;
      case 'redeem':
        metrics.rewardsRedeemed += payload.count || 1;
        break;
      default:
        break;
    }

    this.recalculateProgress(state, { awardXP: true });
    this.save(state);
    return state;
  },

  /**
   * Get current dashboard state from localStorage
   * @returns {Object} Dashboard state object
   */
  get() {
    const defaultState = this.getDefaultState();
    
    try {
      const stored = localStorage.getItem('ectoplasm-dashboard-state');
      if (!stored) return defaultState;
      
      const parsed = JSON.parse(stored);
      const state = this.normalizeState(parsed);
      
      // Check if we need to reset daily tasks
      const lastCheckIn = state.lastCheckIn ? new Date(state.lastCheckIn) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (!lastCheckIn || lastCheckIn < today) {
        // Reset daily tasks but keep streak if checked in yesterday
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastCheckIn && lastCheckIn >= yesterday) {
          // Checked in yesterday, keep streak
          state.completedTasks = [];
        } else if (lastCheckIn) {
          // Missed a day, reset streak
          state.streak = 0;
          state.completedTasks = [];
        }
      }

      this.recalculateProgress(state);
      
      return { ...defaultState, ...state };
    } catch (e) {
      console.error('Failed to load dashboard state:', e);
      return defaultState;
    }
  },
  
  /**
   * Save dashboard state to localStorage
   * @param {Object} state - State object to save
   */
  save(state) {
    try {
      localStorage.setItem('ectoplasm-dashboard-state', JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save dashboard state:', e);
    }
  },

  /**
   * Award or deduct XP directly
   * @param {number} amount - Positive or negative XP delta
   */
  addXP(amount = 0) {
    const state = this.get();
    state.xp = Math.max(0, state.xp + amount);
    this.recalculateProgress(state);
    this.save(state);
    return state;
  },
  
  /**
   * Complete a daily task
   * @param {number} taskIndex - Index of the task
   * @param {number} xpReward - XP to award
   */
  completeTask(taskIndex, xpReward) {
    const state = this.get();
    
    if (!state.completedTasks.includes(taskIndex)) {
      state.completedTasks.push(taskIndex);
      state.xp += xpReward;
      this.applyTaskEffects(state, taskIndex, 1);
      this.recalculateProgress(state, { awardXP: true });
      
      this.save(state);
    }
    
    return state;
  },
  
  /**
   * Uncomplete a daily task (for demo purposes)
   * @param {number} taskIndex - Index of the task
   * @param {number} xpReward - XP to deduct
   */
  uncompleteTask(taskIndex, xpReward) {
    const state = this.get();
    
    const index = state.completedTasks.indexOf(taskIndex);
    if (index > -1) {
      state.completedTasks.splice(index, 1);
      state.xp = Math.max(0, state.xp - xpReward);
      this.applyTaskEffects(state, taskIndex, -1);
      this.recalculateProgress(state);
      this.save(state);
    }
    
    return state;
  },
  
  /**
   * Update quest progress
   * @param {string} questId - Quest identifier
   * @param {number} progress - Progress percentage (0-100)
   */
  updateQuestProgress(questId, progress) {
    const state = this.get();
    state.questProgress[questId] = Math.min(100, Math.max(0, progress));
    
    // Award XP if quest is completed
    if (progress >= 100 && !state.completedQuests.includes(questId)) {
      state.completedQuests.push(questId);
      const quest = DASHBOARD_DATA.weeklyQuests.find(q => q.id === questId);
      if (quest?.xp) state.xp += quest.xp;
    }
    
    this.save(state);
    return state;
  },

  /**
   * Update mission progress
   * @param {string} missionId - Mission identifier
   * @param {number} progress - Progress percentage (0-100)
   */
  updateMissionProgress(missionId, progress) {
    const state = this.get();
    state.missionProgress[missionId] = Math.min(100, Math.max(0, progress));

    if (progress >= 100 && !state.completedMissions.includes(missionId)) {
      state.completedMissions.push(missionId);
      const mission = DASHBOARD_DATA.missions.find(m => m.id === missionId);
      if (mission?.xp) state.xp += mission.xp;
    }

    this.save(state);
    return state;
  },
  
  /**
   * Redeem a reward
   * @param {string} rewardId - Reward identifier
   * @param {number} cost - XP cost
   */
  redeemReward(rewardId, cost) {
    const state = this.get();
    
    if (state.xp >= cost && !state.redeemedRewards.includes(rewardId)) {
      state.xp -= cost;
      state.redeemedRewards.push(rewardId);
      state.metrics.rewardsRedeemed = Math.max(0, state.metrics.rewardsRedeemed + 1);
      this.recalculateProgress(state, { awardXP: true });
      this.save(state);
      return { success: true, state };
    }
    
    return { success: false, state, message: 'Insufficient XP' };
  }
};

/**
 * Render the dashboard with gamification elements
 * Displays daily tasks, weekly quests, and reward catalog
 * Now with full interactivity and persistence
 */
function renderDashboard(){
  const dailyTarget = document.getElementById('dailyTasks');
  const questGrid = document.getElementById('questGrid');
  const rewardGrid = document.getElementById('rewardCatalog');
  const missionBoard = document.getElementById('missionBoardGrid');
  const streakVal = document.getElementById('streakValue');
  const streakDays = document.getElementById('streakDays');
  const xpTotal = document.getElementById('xpTotal');
  const weeklyProgress = document.getElementById('weeklyProgress');
  const weeklyPercent = document.getElementById('weeklyPercent');
  const rewardRow = document.getElementById('rewardRow');

  // Exit if not on dashboard page
  if (!dailyTarget && !questGrid && !rewardGrid && !missionBoard) return;

  // Get current state
  const state = DashboardState.get();
  const { dailyTasks, weeklyQuests, missions, rewards } = DASHBOARD_DATA;
  
  /**
   * Update all stat displays
   */
  const updateStats = () => {
    const currentState = DashboardState.get();
    
    if (streakVal) streakVal.textContent = currentState.streak;
    if (streakDays) streakDays.textContent = currentState.streak;
    if (xpTotal) xpTotal.textContent = currentState.xp.toLocaleString();
    
    // Calculate overall weekly progress (average of all quests)
    const avgProgress = Object.values(currentState.questProgress).reduce((a, b) => a + b, 0) / weeklyQuests.length;
    if (weeklyProgress) weeklyProgress.style.width = `${avgProgress}%`;
    if (weeklyPercent) weeklyPercent.textContent = Math.round(avgProgress);
    
    // Update reward row message
    const completedCount = currentState.completedTasks.filter(id => id >= 0).length;
    const remaining = dailyTasks.length - completedCount;
    if (rewardRow) {
      if (remaining === 0) {
        rewardRow.innerHTML = `<p class="muted success">🎉 All tasks complete! Come back tomorrow for more XP!</p>`;
      } else {
        rewardRow.innerHTML = `<p class="muted">Next reward unlocks in <strong>${remaining} ${remaining === 1 ? 'task' : 'tasks'}</strong>. Keep the streak alive!</p>`;
      }
    }
  };

  /**
   * Handle task completion toggle
   */
  const handleTaskToggle = (taskIndex, xpReward, checkbox) => {
    if (checkbox.checked) {
      // Task completed
      const beforeXP = DashboardState.get().xp;
      const newState = DashboardState.completeTask(taskIndex, xpReward);
      
      // Visual feedback - animate the XP (includes bonuses)
      const delta = newState.xp - beforeXP;
      if (delta > 0) animateXPGain(delta);
      
      // Add completed class to parent for styling
      const listItem = checkbox.closest('li');
      if (listItem) {
        listItem.classList.add('completed');
      }
    } else {
      // Task uncompleted (for demo purposes)
      DashboardState.uncompleteTask(taskIndex, xpReward);
      
      // Remove completed class
      const listItem = checkbox.closest('li');
      if (listItem) {
        listItem.classList.remove('completed');
      }
    }
    
    updateStats();
  };

  /**
   * Quick progress logging from quest cards
   */
  const handleQuestAction = (quest) => {
    if (!quest?.actionType) return;
    const beforeXP = DashboardState.get().xp;
    const newState = DashboardState.recordAction(quest.actionType, {});
    const xpDelta = newState.xp - beforeXP;
    if (xpDelta > 0) animateXPGain(xpDelta);
    renderDashboard();
  };

  /**
   * Animate XP gain
   */
  const animateXPGain = (amount) => {
    if (!xpTotal) return;
    
    // Create floating XP indicator
    const indicator = document.createElement('span');
    indicator.className = 'xp-gain-indicator';
    indicator.textContent = `+${amount} XP`;
    indicator.style.cssText = `
      position: fixed;
      top: ${xpTotal.getBoundingClientRect().top}px;
      left: ${xpTotal.getBoundingClientRect().left}px;
      color: #4cf5c7;
      font-weight: 800;
      font-size: 1.2rem;
      pointer-events: none;
      z-index: 9999;
      animation: floatUp 1.5s ease-out forwards;
    `;
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      document.body.removeChild(indicator);
    }, 1500);
  };

  /**
   * Handle reward redemption
   */
  const handleRewardRedeem = (rewardId, cost, title, card) => {
    const result = DashboardState.redeemReward(rewardId, cost);
    
    if (result.success) {
      // Visual feedback
      card.classList.add('redeemed');
      card.style.opacity = '0.5';
      card.style.pointerEvents = 'none';
      
      // Show success message
      const msg = document.createElement('div');
      msg.className = 'success-message';
      msg.textContent = `✓ Redeemed: ${title}`;
      msg.style.cssText = 'margin-top: 8px; font-size: 0.9rem;';
      card.appendChild(msg);
      
      updateStats();
      
      // Animate XP deduction
      animateXPGain(-cost);
    } else {
      // Show error message
      alert(result.message || 'Unable to redeem reward');
    }
  };

  // Initialize stats
  updateStats();

  // Render daily tasks checklist
  if (dailyTarget){
    dailyTarget.innerHTML = '';
    dailyTasks.forEach(task => {
      const li = document.createElement('li');
      const isCompleted = state.completedTasks.includes(task.id);
      
      if (isCompleted) {
        li.classList.add('completed');
      }
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isCompleted;
      checkbox.id = `task-${task.id}`;
      
      checkbox.addEventListener('change', () => {
        handleTaskToggle(task.id, task.xp, checkbox);
      });
      
      const label = document.createElement('label');
      label.appendChild(checkbox);
      
      const span = document.createElement('span');
      span.textContent = task.title;
      label.appendChild(span);
      
      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.textContent = `+${task.xp} XP`;
      
      li.appendChild(label);
      li.appendChild(pill);
      dailyTarget.appendChild(li);
    });
  }

  // Render weekly quest cards
  if (questGrid){
    questGrid.innerHTML = '';
    weeklyQuests.forEach(quest => {
      const card = document.createElement('article');
      card.className = 'pool-card quest-card';
      
      const progress = state.questProgress[quest.id] || 0;
      const isCompleted = state.completedQuests.includes(quest.id);
      
      if (isCompleted) {
        card.classList.add('completed');
      }
      
      card.innerHTML = `
        <h3>${sanitizeHTML(quest.title)}</h3>
        <p class="muted">Reward: ${sanitizeHTML(quest.reward)}</p>
        <div class="progress">
          <div class="progress-bar" style="width:${progress}%"></div>
        </div>
        <small class="muted">${progress}% complete</small>
        <div class="quest-actions">
          <button class="btn ghost small" type="button" ${isCompleted ? 'disabled' : ''}>${sanitizeHTML(quest.actionLabel || 'Log progress')}</button>
        </div>
      `;

      const actionBtn = card.querySelector('button');
      if (actionBtn && !isCompleted) {
        actionBtn.addEventListener('click', () => handleQuestAction(quest));
      }
      
      questGrid.appendChild(card);
    });
  }

  // Render mission board
  if (missionBoard){
    missionBoard.innerHTML = '';
    missions.forEach(mission => {
      const card = document.createElement('article');
      card.className = 'pool-card mission-card';

      const progress = state.missionProgress[mission.id] || 0;
      const isCompleted = state.completedMissions.includes(mission.id);

      card.innerHTML = `
        <div class="mission-top">
          <span class="pill subtle">${sanitizeHTML(mission.type)}</span>
          <span class="pill filled">${sanitizeHTML(mission.reward)}</span>
        </div>
        <h3>${sanitizeHTML(mission.title)}</h3>
        <p class="muted">${sanitizeHTML(mission.detail)}</p>
        <div class="progress">
          <div class="progress-bar" style="width:${progress}%"></div>
        </div>
        <small class="muted">${progress}% complete</small>
        ${isCompleted ? '<div class="success-message" style="margin-top: 8px;">Loot ready to redeem</div>' : '<div class="muted tiny" style="margin-top:6px;">Progress updates from your activity</div>'}
      `;

      if (isCompleted) {
        card.classList.add('completed');
        card.style.borderColor = 'rgba(76,245,199,0.35)';
      }

      missionBoard.appendChild(card);
    });
  }

  // Render reward catalog
  if (rewardGrid){
    rewardGrid.innerHTML = '';
    rewards.forEach(reward => {
      const card = document.createElement('article');
      card.className = 'pool-card reward-card';
      
      const isRedeemed = state.redeemedRewards.includes(reward.id);
      const canAfford = state.xp >= reward.cost;
      
      if (isRedeemed) {
        card.classList.add('redeemed');
        card.style.opacity = '0.5';
      } else if (canAfford) {
        card.classList.add('affordable');
        card.style.cursor = 'pointer';
        card.style.borderColor = 'rgba(76, 245, 199, 0.3)';
      } else {
        card.style.opacity = '0.6';
      }
      
      card.innerHTML = `
        <h3>${sanitizeHTML(reward.title)}</h3>
        <p class="muted">${sanitizeHTML(reward.detail)}</p>
        <span class="pill">${reward.cost} XP</span>
        ${isRedeemed ? '<div class="success-message" style="margin-top: 8px;">✓ Redeemed</div>' : ''}
      `;
      
      // Make reward card clickable if not redeemed and can afford
      if (!isRedeemed && canAfford) {
        card.addEventListener('click', () => {
          if (confirm(`Redeem "${reward.title}" for ${reward.cost} XP?`)) {
            handleRewardRedeem(reward.id, reward.cost, reward.title, card);
          }
        });
      }
      
      rewardGrid.appendChild(card);
    });
  }
}

/**
 * Render launchpad token library
 * Displays a filterable table of 50 mock tokens with performance metrics
 * 
 * Features:
 * - 50 procedurally generated tokens for demo
 * - Real-time filtering by name or symbol (debounced for performance)
 * - Status badges (Hot, Trending, New)
 * - Performance metrics (24h change, liquidity)
 * - Formatted currency display
 * - Optimized rendering with document fragment
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
   * Uses document fragment for efficient DOM manipulation
   */
  const render = () => {
    const term = filterInput?.value?.toLowerCase().trim() || '';
    
    // Filter tokens by search term (searches name and symbol)
    const visible = !term ? tokens : tokens.filter(t => 
      `${t.name} ${t.symbol}`.toLowerCase().includes(term)
    );
    
    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Render table rows
    visible.forEach(token => {
      const row = document.createElement('div');
      row.className = 'table-row';
      row.setAttribute('role', 'row');
      row.innerHTML = `
        <span role="cell">${sanitizeHTML(token.name)}</span>
        <span role="cell">${sanitizeHTML(token.symbol)}</span>
        <span role="cell" class="${Number(token.change) >= 0 ? 'pos' : 'neg'}">${token.change}%</span>
        <span role="cell">${formatCurrency(token.liquidity)}</span>
        <span role="cell"><span class="chip">${sanitizeHTML(token.status)}</span></span>
      `;
      fragment.appendChild(row);
    });
    
    // Batch DOM update
    table.innerHTML = '';
    table.appendChild(fragment);

    // Update filter results text
    if (filterResult) filterResult.textContent = `Showing ${visible.length} of ${tokens.length} tokens`;
    if (tokenCount) tokenCount.textContent = tokens.length.toString();
  };

  // Initial render
  render();
  
  // Setup live filtering with debouncing to improve performance
  if (filterInput) {
    const debouncedRender = debounce(render, DEBOUNCE_DELAY_SEARCH);
    filterInput.addEventListener('input', debouncedRender);
  }
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

/**
 * Populate mock liquid staking positions on the liquidity page
 * Shows sample liquid staking positions for demonstration purposes
 */
function populateMockLPPositions() {
  const container = document.getElementById('lpPositionsContainer');
  if (!container) return;

  // Mock liquid staking position data
  const mockPositions = [
    {
      asset: 'CSPR',
      staked: '25,000 CSPR',
      liquidToken: '25,125 stCSPR',
      apr: '16.8%',
      earnings: '$3,920.40',
      autoCompound: true
    },
    {
      asset: 'ECTO',
      staked: '15,000 ECTO',
      liquidToken: '15,336 stECTO',
      apr: '22.4%',
      earnings: '$2,688.00',
      autoCompound: true
    },
    {
      asset: 'ETH',
      staked: '8.5 ETH',
      liquidToken: '8.661 stETH',
      apr: '18.9%',
      earnings: '$1,606.50',
      autoCompound: true
    }
  ];

  // Create HTML for liquid staking positions
  let positionsHTML = '<div style="margin-top: 12px;">';

  mockPositions.forEach((position, index) => {
    positionsHTML += `
      <div style="padding: 12px; background: var(--surface-1, rgba(0,0,0,0.02)); border-radius: 8px; margin-bottom: ${index < mockPositions.length - 1 ? '8px' : '0'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="font-size: 14px;">${sanitizeHTML(position.asset)} Liquid Staking</strong>
          ${position.autoCompound ? '<span class="pill success subtle" style="font-size: 11px; padding: 2px 8px;">Auto-compound</span>' : ''}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 12px;">
          <div>
            <div class="muted tiny">Staked</div>
            <div style="font-weight: 500; margin-top: 2px;">${sanitizeHTML(position.staked)}</div>
          </div>
          <div>
            <div class="muted tiny">APR</div>
            <div style="font-weight: 500; margin-top: 2px; color: var(--success, #22c55e);">${sanitizeHTML(position.apr)}</div>
          </div>
          <div>
            <div class="muted tiny">Earned</div>
            <div style="font-weight: 500; margin-top: 2px;">${sanitizeHTML(position.earnings)}</div>
          </div>
        </div>
        <div style="margin-top: 6px; font-size: 11px; color: var(--muted);">
          Liquid token: ${sanitizeHTML(position.liquidToken)}
        </div>
      </div>
    `;
  });

  positionsHTML += '</div>';

  // Insert the positions HTML
  container.innerHTML = positionsHTML;
}

// Initialize LP positions when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', populateMockLPPositions);
} else {
  populateMockLPPositions();
}

// ============================================================================
// MODERN HOVER-TRIGGERED ANIMATIONS (Native Web APIs)
// ============================================================================

/**
 * Magnet Effect Implementation
 * Creates magnetic pull effect on elements with .magnet-hover class
 * Uses native mousemove events and CSS transforms
 */
function initMagnetEffect() {
  const magnetElements = document.querySelectorAll('.magnet-hover');
  
  magnetElements.forEach(element => {
    // Configuration
    const padding = parseInt(element.dataset.magnetPadding) || 100;
    const strength = parseFloat(element.dataset.magnetStrength) || 2;
    
    // State
    let isActive = false;
    let rafId = null;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    
    // Smooth animation using requestAnimationFrame
    function animate() {
      const dx = targetX - currentX;
      const dy = targetY - currentY;
      
      currentX += dx * 0.1;
      currentY += dy * 0.1;
      
      element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        rafId = requestAnimationFrame(animate);
      } else {
        rafId = null;
      }
    }
    
    function handleMouseMove(e) {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const distX = Math.abs(centerX - e.clientX);
      const distY = Math.abs(centerY - e.clientY);
      
      // Check if mouse is within magnetic field
      if (distX < rect.width / 2 + padding && distY < rect.height / 2 + padding) {
        if (!isActive) {
          isActive = true;
          element.classList.add('magnet-active');
        }
        
        targetX = (e.clientX - centerX) / strength;
        targetY = (e.clientY - centerY) / strength;
        
        if (!rafId) {
          animate();
        }
      } else {
        if (isActive) {
          isActive = false;
          element.classList.remove('magnet-active');
        }
        
        targetX = 0;
        targetY = 0;
        
        if (!rafId) {
          animate();
        }
      }
    }
    
    // Add event listener
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    // Store cleanup function
    element._magnetCleanup = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  });
}

/**
 * Tilt Effect Implementation
 * Creates 3D tilt effect on elements with .tilt-hover class
 * Uses native mousemove events and CSS 3D transforms
 */
function initTiltEffect() {
  const tiltElements = document.querySelectorAll('.tilt-hover');
  
  tiltElements.forEach(element => {
    // Configuration
    const maxTilt = parseInt(element.dataset.tiltMax) || 10;
    
    function handleMouseMove(e) {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate tilt based on mouse position relative to center
      const percentX = (e.clientX - centerX) / (rect.width / 2);
      const percentY = (e.clientY - centerY) / (rect.height / 2);
      
      const tiltY = percentX * maxTilt;
      const tiltX = -percentY * maxTilt;
      
      element.style.setProperty('--tilt-x', `${tiltX}deg`);
      element.style.setProperty('--tilt-y', `${tiltY}deg`);
    }
    
    function handleMouseLeave() {
      element.style.setProperty('--tilt-x', '0deg');
      element.style.setProperty('--tilt-y', '0deg');
    }
    
    // Add event listeners
    element.addEventListener('mousemove', handleMouseMove, { passive: true });
    element.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    
    // Store cleanup function
    element._tiltCleanup = () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  });
}

/**
 * Apply hover animations to specific elements
 * Automatically adds appropriate classes based on element type
 */
function applyHoverAnimations() {
  // Apply glare effect to cards
  const heroCards = document.querySelectorAll('.hero-card:not(.glare-hover)');
  heroCards.forEach(card => card.classList.add('glare-hover'));
  
  const featureCards = document.querySelectorAll('.feature-card:not(.glare-hover)');
  featureCards.forEach(card => card.classList.add('glare-hover'));
  
  const questCards = document.querySelectorAll('.quest-card:not(.glare-hover)');
  questCards.forEach(card => card.classList.add('glare-hover'));
  
  const missionCards = document.querySelectorAll('.mission-card:not(.glare-hover)');
  missionCards.forEach(card => card.classList.add('glare-hover'));
  
  const launchpadCards = document.querySelectorAll('.launchpad-card:not(.glare-hover)');
  launchpadCards.forEach(card => card.classList.add('glare-hover'));
  
  // Apply magnet effect to primary buttons
  const primaryButtons = document.querySelectorAll('.btn.primary:not(.magnet-hover)');
  primaryButtons.forEach(btn => {
    btn.classList.add('magnet-hover');
    btn.dataset.magnetPadding = '60';
    btn.dataset.magnetStrength = '3';
  });
  
  // Apply tilt effect to icon buttons
  const iconButtons = document.querySelectorAll('.icon-btn:not(.tilt-hover)');
  iconButtons.forEach(btn => {
    btn.classList.add('tilt-hover');
    btn.dataset.tiltMax = '8';
  });
  
  // Apply shimmer to certain cards on dashboard
  const rewardCards = document.querySelectorAll('.reward-card:not(.shimmer-hover)');
  rewardCards.forEach(card => card.classList.add('shimmer-hover'));
}

/**
 * Check if user prefers reduced motion
 */
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Initialize all hover animations
 */
function initHoverAnimations() {
  // Skip if user prefers reduced motion
  if (prefersReducedMotion()) {
    console.log('Hover animations disabled due to user preference for reduced motion');
    return;
  }
  
  // Apply animation classes to elements
  applyHoverAnimations();
  
  // Initialize interactive effects
  initMagnetEffect();
  initTiltEffect();
  
  console.log('Modern hover animations initialized');
}

/**
 * Cleanup hover animations
 * Useful for SPA navigation or dynamic content
 */
function cleanupHoverAnimations() {
  // Cleanup magnet effects
  document.querySelectorAll('.magnet-hover').forEach(element => {
    if (element._magnetCleanup) {
      element._magnetCleanup();
      delete element._magnetCleanup;
    }
  });
  
  // Cleanup tilt effects
  document.querySelectorAll('.tilt-hover').forEach(element => {
    if (element._tiltCleanup) {
      element._tiltCleanup();
      delete element._tiltCleanup;
    }
  });
}

// Initialize hover animations when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHoverAnimations);
} else {
  initHoverAnimations();
}

// Listen for motion preference changes
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
  if (e.matches) {
    cleanupHoverAnimations();
    console.log('Hover animations disabled due to motion preference change');
  } else {
    initHoverAnimations();
    console.log('Hover animations enabled due to motion preference change');
  }
});

// Expose functions for potential manual usage
window.EctoplasmAnimations = {
  init: initHoverAnimations,
  cleanup: cleanupHoverAnimations,
  applyToElement: (element, type) => {
    if (prefersReducedMotion()) return;
    
    switch(type) {
      case 'glare':
        element.classList.add('glare-hover');
        break;
      case 'magnet':
        element.classList.add('magnet-hover');
        initMagnetEffect();
        break;
      case 'tilt':
        element.classList.add('tilt-hover');
        initTiltEffect();
        break;
      case 'shimmer':
        element.classList.add('shimmer-hover');
        break;
      case 'glow':
        element.classList.add('glow-hover');
        break;
      case 'float':
        element.classList.add('float-hover');
        break;
    }
  }
};

// ============================================================================
// LIQUID BLOB MOUSE AVOIDANCE
// ============================================================================

/**
 * Make liquid blobs avoid the mouse cursor
 * Creates a repulsion effect where blobs move away from the cursor
 */
function initLiquidBlobAvoidance() {
  const liquidContainer = document.querySelector('.liquid-container');
  if (!liquidContainer) return;
  
  const blobs = document.querySelectorAll('.liquid-blob');
  if (!blobs.length) return;
  
  let mouseX = 0;
  let mouseY = 0;
  let rafId = null;
  
  // Configuration
  const avoidanceRadius = 200; // Distance at which blobs start avoiding
  const avoidanceStrength = 80; // How far blobs move away
  
  function handleMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    if (!rafId) {
      rafId = requestAnimationFrame(updateBlobPositions);
    }
  }
  
  function updateBlobPositions() {
    blobs.forEach(blob => {
      const rect = blob.getBoundingClientRect();
      const blobCenterX = rect.left + rect.width / 2;
      const blobCenterY = rect.top + rect.height / 2;
      
      // Calculate distance from mouse to blob center
      const dx = blobCenterX - mouseX;
      const dy = blobCenterY - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If mouse is within avoidance radius, push blob away
      if (distance < avoidanceRadius && distance > 0) {
        const force = (avoidanceRadius - distance) / avoidanceRadius;
        const pushX = (dx / distance) * avoidanceStrength * force;
        const pushY = (dy / distance) * avoidanceStrength * force;
        
        blob.classList.add('avoiding-mouse');
        blob.style.transform = `translate(${pushX}px, ${pushY}px)`;
      } else {
        blob.classList.remove('avoiding-mouse');
        blob.style.transform = '';
      }
    });
    
    rafId = null;
  }
  
  // Add event listener
  liquidContainer.addEventListener('mousemove', handleMouseMove, { passive: true });
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    liquidContainer.removeEventListener('mousemove', handleMouseMove);
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  });
}

// Initialize liquid blob avoidance when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLiquidBlobAvoidance);
} else {
  initLiquidBlobAvoidance();
}
