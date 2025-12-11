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
  setupPromoSlider();
  setupLaunchpadRail();
  setupMintDrawer();
});

function hydrateTheme(){
  const stored = localStorage.getItem('ectoplasm-theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const desired = stored || (prefersLight ? 'light' : 'dark');
  setTheme(desired);
}

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
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  setTheme(isDark ? 'light' : 'dark');
}

function setTheme(theme){
  const btn = document.getElementById('themeToggle');
  const next = theme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  if (btn){
    btn.textContent = `${next} mode`;
    btn.setAttribute('aria-pressed', theme === 'light');
  }
  localStorage.setItem('ectoplasm-theme', theme);
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
      updateWalletStatus(`Connected via ${selectedWallet}`);
    }
  }catch(err){
    console.error('Wallet connection failed', err);
    alert('Wallet connection failed: ' + (err.message || err));
    updateWalletStatus('Connection failed');
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
  const slippage = document.getElementById('slippage');
  const swapHealth = document.getElementById('swapHealth');

  if (!fromAmt || !toAmt || !priceImpact) {
    console.log('Swap demo elements not found on this page, skipping setup.');
    return;
  }

  fromAmt.addEventListener('input', () => {
    // naive demo: 1 CSPR = 0.5 ECTO for UI demo
    const val = parseFloat(fromAmt.value) || 0;
    const rate = 0.5;
    toAmt.value = (val * rate).toFixed(6);
    const impact = Math.min(0.5, (val/1000)); // demo price impact
    priceImpact.textContent = (impact*100).toFixed(2) + '%';
    if (swapHealth){
      const severity = impact > 0.2 ? 'warn' : 'good';
      swapHealth.textContent = severity === 'warn' ? 'High impact — adjust size' : 'Optimal routing';
      swapHealth.dataset.state = severity;
    }
  });

  if(slippage){
    slippage.addEventListener('input', () => {
      slippage.value = Math.min(Math.max(parseFloat(slippage.value) || 0.1, 0.1), 5).toString();
    });
  }
}

function updateWalletStatus(message){
  const badge = document.getElementById('walletStatus');
  if(badge){
    badge.textContent = message;
  }
}

function demoSwap(){
  alert('Demo swap executed (UI only). Connect CasperSigner or CSPR.CLOUD wallet to enable real swaps.');
}

function setupPromoSlider(){
  const slider = document.getElementById('promoBudget');
  const label = document.getElementById('promoBudgetLabel');
  if(!slider || !label) return;

  const render = () => {
    const value = Number(slider.value || 0);
    label.textContent = `${value.toLocaleString()} CSPR`;
  };

  if(!slider.dataset.bound){
    slider.addEventListener('input', render);
    slider.dataset.bound = 'true';
  }
  render();
}

const railTokens = [];

function setupLaunchpadRail(){
  const rail = document.getElementById('tokenRail');
  if(!rail) return;

  const seeds = [
    {icon:'👻', name:'Ghost Cat', symbol:'GHOST'},
    {icon:'🧪', name:'Plasma Punk', symbol:'PLASM'},
    {icon:'🌊', name:'Ripple Ghost', symbol:'RPL'},
    {icon:'🌙', name:'Casper Moon', symbol:'MOON'},
    {icon:'🎯', name:'Sniper Frog', symbol:'SNP'},
    {icon:'🚀', name:'Boosted Ape', symbol:'APEX'},
    {icon:'🔥', name:'Ignite', symbol:'IGN'},
    {icon:'🛰️', name:'Orbiter', symbol:'ORB'},
    {icon:'🍀', name:'Lucky Slime', symbol:'LUCK'},
    {icon:'🦊', name:'Neon Fox', symbol:'FOX'},
    {icon:'🌀', name:'Vortex', symbol:'VTX'},
    {icon:'🧊', name:'Frostbyte', symbol:'FRST'}
  ];

  const statuses = ['Hot','New','Trending','Surging','Live'];
  const changes = [12,24,36,42,58,74,93,120,182];
  const volumeBase = [24000, 42000, 58000, 91000, 124000, 162000];

  railTokens.length = 0;
  for(let i=0;i<50;i++){
    const base = seeds[i % seeds.length];
    const multiplier = Math.floor(i / seeds.length) + 1;
    railTokens.push({
      icon: base.icon,
      name: `${base.name} ${multiplier}`,
      symbol: `$${base.symbol}${multiplier}`,
      status: statuses[i % statuses.length],
      change: `+${changes[(i * 2) % changes.length]}%`,
      volume: `$${(volumeBase[i % volumeBase.length] + i * 900).toLocaleString()}`
    });
  }

  renderRailTokens(rail);
}

function renderRailTokens(rail){
  if(!rail) return;
  rail.innerHTML = '';

  railTokens.forEach((token) => {
    const item = document.createElement('div');
    item.className = 'rail-token';
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
      <div class="rail-row">
        <span class="rail-meta">${token.icon} <strong>${token.name}</strong></span>
        <span class="rail-chip">${token.status}</span>
      </div>
      <div class="rail-meta">${token.symbol} · ${token.change} · ${token.volume}</div>
    `;
    rail.appendChild(item);
  });
}

function addTokenToRail(token){
  const rail = document.getElementById('tokenRail');
  if(!rail) return;
  railTokens.unshift(token);
  if(railTokens.length > 50){
    railTokens.length = 50;
  }
  renderRailTokens(rail);
}

function setupMintDrawer(){
  const drawer = document.getElementById('mintDrawer');
  if(!drawer) return;

  const openers = document.querySelectorAll('[data-open-mint]');
  const closers = drawer.querySelectorAll('[data-close-mint]');
  const form = document.getElementById('mintForm');

  const open = () => {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  };

  const close = () => {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
  };

  openers.forEach(btn => btn.addEventListener('click', open));
  closers.forEach(btn => btn.addEventListener('click', close));
  drawer.addEventListener('click', (event) => {
    if(event.target.dataset.closeMint !== undefined){
      close();
    }
  });
  document.addEventListener('keydown', (event) => {
    if(event.key === 'Escape') close();
  });

  if(form){
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = (data.get('project') || 'New Token').toString().trim();
      const symbolRaw = (data.get('symbol') || 'NEW').toString().trim().toUpperCase();
      addTokenToRail({
        icon: '✨',
        name,
        symbol: `$${symbolRaw}`,
        status: 'New',
        change: '+0%',
        volume: '$0'
      });

      form.reset();
      setupPromoSlider();
      close();
      alert(`${name} minted to the mock rail. Connect your wallet to deploy for real.`);
    });
  }
}
