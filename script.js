// Basic interactions: live price ticker, theme toggle, wallet connect scaffolding.
// NOTE: For production, handle errors, rate limits, CORS, and secure API keys where needed.

const CSPR_WALLET_APP_ID = '019ae32b-4115-7d44-b2c3-a8091354c9a2';

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

// Wallet connect with support for CasperWallet (CSPR Wallet), CasperSigner and CSPR.CLOUD
async function connectWalletHandler(){
  const casperWalletProvider = typeof window.CasperWalletProvider === 'function' ? window.CasperWalletProvider() : null;
  const casperSigner = window.casperlabsHelper || window.CasperWallet;
  const csprCloud = window.csprclick;

  if(!casperWalletProvider && !casperSigner && !csprCloud){
    alert('No Casper wallet detected. Please install Casper Wallet, CasperSigner, or CSPR.CLOUD.');
    return;
  }

  const choices = [];
  if(casperWalletProvider) choices.push('casperwallet');
  if(casperSigner) choices.push('caspersigner');
  if(csprCloud) choices.push('csprcloud');

  let selectedWallet = choices[0];
  if(choices.length > 1){
    const choice = prompt(`Select wallet (${choices.join(', ')}):`, choices[0]);
    if(choice && choices.includes(choice.trim().toLowerCase())){
      selectedWallet = choice.trim().toLowerCase();
    }
  }

  try{
    let connectedAccount = null;

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
      console.log('Connecting to CasperSigner...');
      if(window.casperlabsHelper){
        connectedAccount = await window.casperlabsHelper.requestConnection();
      } else if(window.CasperWallet){
        connectedAccount = await window.CasperWallet.requestConnection();
      }
      console.log('Connected to CasperSigner:', connectedAccount);
    }

    const connectBtn = document.getElementById('connectWallet');
    if(connectedAccount){
      const shortKey = typeof connectedAccount === 'string' && connectedAccount.length > 12
        ? `${connectedAccount.slice(0, 6)}…${connectedAccount.slice(-4)}`
        : connectedAccount;
      connectBtn.textContent = `Connected: ${shortKey}`;
      connectBtn.classList.add('connected');
      window.connectedWallet = selectedWallet;
      window.connectedAccount = connectedAccount;
    }
  }catch(err){
    console.error('Wallet connection failed', err);
    alert('Wallet connection failed: ' + (err.message || err));
  }
}

async function requestCasperWalletConnection(provider){
  if(!provider?.requestConnection) return;
  try{
    return await provider.requestConnection({appId: CSPR_WALLET_APP_ID});
  }catch(err){
    console.warn('Casper Wallet connection with appId failed, retrying without appId', err);
    return provider.requestConnection();
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