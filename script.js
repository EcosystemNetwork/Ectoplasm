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

// Wallet connect scaffolding using CasperSigner
async function connectWalletHandler(){
  // CasperSigner is the recommended wallet for Casper dApps
  // https://docs.casper.network/clients/wallets/caspersigner
  // This is a minimal example — please enhance for production (error handling, UI states).
  if(!window.casperlabsHelper && !window.CasperWallet){
    alert('CasperSigner not detected. Please install CasperSigner or use a supported wallet.');
    return;
  }
  try{
    // Example using Casper Signer protocol; actual integration depends on the wallet API you choose.
    // TODO: replace this flow with the latest CasperSigner connect method; this is a placeholder.
    // Many wallets inject window.casperlabsHelper or support an external connection protocol.
    console.log('Attempting wallet connect (placeholder).');
    // Set a UI state or update button text:
    document.getElementById('connectWallet').textContent = 'Connected';
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

  if (!fromAmt || !toAmt || !priceImpact) return;

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
  alert('Demo swap executed (UI only). Connect CasperSigner to enable real swaps.');
}