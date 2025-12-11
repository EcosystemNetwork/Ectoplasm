// Basic interactions: live price ticker, theme toggle, wallet connect scaffolding.
// NOTE: For production, handle errors, rate limits, CORS, and secure API keys where needed.

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  
  initPriceTicker();
  
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
  
  const connectWallet = document.getElementById('connectWallet');
  if (connectWallet) connectWallet.addEventListener('click', connectWalletHandler);
  
  setupSwapDemo();
});

async function initPriceTicker(){
  const el = document.getElementById('priceTicker');
  if (!el) return; // Element not on this page
  
  const fetchPrice = async () => {
    try{
      // CoinGecko id for Casper Network is 'casper-network'
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=casper-network&vs_currencies=usd');
      if(!res.ok) throw new Error('price fetch failed');
      const data = await res.json();
      const price = data['casper-network']?.usd;
      if(price) el.textContent = `CSPR $${price.toFixed(2)}`;
    }catch(e){
      console.warn('Price load error', e);
      // leave fallback text
    }
  };
  fetchPrice();
  setInterval(fetchPrice, 60_000); // refresh every minute
}

function toggleTheme(){
  const btn = document.getElementById('themeToggle');
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  if(isDark){
    document.documentElement.setAttribute('data-theme', 'light');
    btn.textContent = 'Light';
    btn.setAttribute('aria-pressed', 'true');
  }else{
    document.documentElement.setAttribute('data-theme', 'dark');
    btn.textContent = 'Dark';
    btn.setAttribute('aria-pressed', 'false');
  }
}

// Wallet connect with support for CasperSigner and CSPR.CLOUD
async function connectWalletHandler(){
  // Detect available wallets
  const hasCasperSigner = window.casperlabsHelper || window.CasperWallet;
  const hasCsprCloud = window.csprclick;
  
  if(!hasCasperSigner && !hasCsprCloud){
    alert('No Casper wallet detected. Please install CasperSigner or CSPR.CLOUD wallet.');
    return;
  }
  
  // If both wallets available, let user choose
  let selectedWallet = null;
  if(hasCasperSigner && hasCsprCloud){
    const choice = confirm('Multiple Casper wallets detected.\n\nClick OK to connect with CSPR.CLOUD\nClick Cancel to connect with CasperSigner');
    selectedWallet = choice ? 'csprcloud' : 'caspersigner';
  } else if(hasCsprCloud){
    selectedWallet = 'csprcloud';
  } else {
    selectedWallet = 'caspersigner';
  }
  
  try{
    let connectedAccount = null;
    
    if(selectedWallet === 'csprcloud'){
      // CSPR.CLOUD wallet connection
      console.log('Connecting to CSPR.CLOUD wallet...');
      const accounts = await window.csprclick.getActiveAccount();
      if(accounts){
        connectedAccount = accounts;
        console.log('Connected to CSPR.CLOUD:', connectedAccount);
      } else {
        throw new Error('No active account found in CSPR.CLOUD wallet');
      }
    } else {
      // CasperSigner connection
      console.log('Connecting to CasperSigner...');
      // CasperSigner connection flow
      if(window.casperlabsHelper){
        connectedAccount = await window.casperlabsHelper.requestConnection();
      } else if(window.CasperWallet){
        connectedAccount = await window.CasperWallet.requestConnection();
      }
      console.log('Connected to CasperSigner:', connectedAccount);
    }
    
    // Update UI on successful connection
    const connectBtn = document.getElementById('connectWallet');
    if(connectedAccount){
      connectBtn.textContent = 'Connected';
      connectBtn.classList.add('connected');
      // Store wallet type for later use
      window.connectedWallet = selectedWallet;
      window.connectedAccount = connectedAccount;
    }
  }catch(err){
    console.error('Wallet connection failed', err);
    alert('Wallet connection failed: ' + (err.message || err));
  }
}

// Simple swap demo calculation to make UI interactive.
function setupSwapDemo(){
  const fromAmt = document.getElementById('fromAmount');
  const toAmt = document.getElementById('toAmount');
  const priceImpact = document.getElementById('priceImpact');

  if (!fromAmt || !toAmt || !priceImpact) {
    console.log('Swap demo elements not found on this page, skipping setup.');
    return;
  }

  fromAmt.addEventListener('input', () => {
    // naive demo: 1 CSPR = 0.5 ECT for UI demo
    const val = parseFloat(fromAmt.value) || 0;
    const rate = 0.5;
    toAmt.value = (val * rate).toFixed(6);
    const impact = Math.min(0.5, (val/1000)); // demo price impact
    priceImpact.textContent = (impact*100).toFixed(2) + '%';
  });
}

function demoSwap(){
  alert('Demo swap executed (UI only). Connect CasperSigner or CSPR.CLOUD wallet to enable real swaps.');
}