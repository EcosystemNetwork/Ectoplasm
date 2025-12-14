// Basic interactions: live price ticker, theme toggle, wallet connect scaffolding.
// NOTE: For production, handle errors, rate limits, CORS, and secure API keys where needed.

const CSPR_WALLET_APP_ID = '019ae32b-4115-7d44-b2c3-a8091354c9a2';

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  hydrateTheme();
  initPriceTicker();

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  const connectWallet = document.getElementById('connectWallet');
  if (connectWallet) connectWallet.addEventListener('click', connectWalletHandler);

  setupLogoMenu();
  setupSwapDemo();
  setupPromoSlider();
  renderDashboard();
  renderLaunchpadTokens();
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

function setupLogoMenu(){
  const toggle = document.getElementById('logoMenuToggle');
  const menu = document.getElementById('logoMenu');
  if(!toggle || !menu) return;

  const closeMenu = () => {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };

  const openMenu = () => {
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
  };

  toggle.addEventListener('click', () => {
    if(menu.hidden){
      openMenu();
    } else {
      closeMenu();
    }
  });

  document.addEventListener('click', (e) => {
    if(menu.hidden) return;
    if(!menu.contains(e.target) && !toggle.contains(e.target)){
      closeMenu();
    }
  });

  menu.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      closeMenu();
      toggle.focus();
    }
  });

  toggle.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      closeMenu();
    }
  });
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

  slider.addEventListener('input', render);
  render();
}

// Dashboard renderer for daily tasks, quests, and rewards
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

  if (!dailyTarget && !questGrid && !rewardGrid) return;

  const streak = 7;
  const xp = 1260;
  const dailyTasks = [
    { title: 'Check-in and claim streak bonus', xp: 40 },
    { title: 'Complete one swap on Casper', xp: 120 },
    { title: 'Stake liquidity into any $ECTO pair', xp: 200 },
    { title: 'Vote on one governance proposal', xp: 90 }
  ];

  const weeklyQuests = [
    { title: 'Clear 5 swaps with <0.5% slippage', reward: 'Badge + 200 XP', progress: 60 },
    { title: 'Provide liquidity for 3 consecutive days', reward: 'Boosted APR day', progress: 40 },
    { title: 'Participate in privacy pool relay', reward: 'Shield bonus + 180 XP', progress: 20 }
  ];

  const rewards = [
    { title: 'Swap fee rebate', cost: '400 XP', detail: '5% off for 24h' },
    { title: 'Launchpad priority slot', cost: '900 XP', detail: 'Jump queue for next cohort' },
    { title: 'Privacy multiplier', cost: '700 XP', detail: '1.2x rewards on relays for 48h' }
  ];

  if (streakVal) streakVal.textContent = streak;
  if (streakDays) streakDays.textContent = streak;
  if (xpTotal) xpTotal.textContent = xp.toLocaleString();
  if (weeklyProgress) weeklyProgress.style.width = `${weeklyQuests[0].progress}%`;
  if (weeklyPercent) weeklyPercent.textContent = weeklyQuests[0].progress;

  if (dailyTarget){
    dailyTarget.innerHTML = '';
    dailyTasks.forEach(task => {
      const li = document.createElement('li');
      li.innerHTML = `<label><input type="checkbox" /> <span>${task.title}</span></label><span class="pill">+${task.xp} XP</span>`;
      dailyTarget.appendChild(li);
    });
  }

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

  if (rewardRow){
    rewardRow.innerHTML = `<p class="muted">Next reward unlocks in <strong>2 tasks</strong>. Keep the streak alive!</p>`;
  }
}

// Launchpad token list for 50 mock assets
function renderLaunchpadTokens(){
  const table = document.getElementById('tokenTable');
  const filterInput = document.getElementById('tokenFilter');
  const filterResult = document.getElementById('filterResult');
  const tokenCount = document.getElementById('tokenCount');

  if (!table) return;

  const tokens = Array.from({ length: 50 }, (_, i) => {
    const index = i + 1;
    const name = `Mock Token ${index.toString().padStart(2, '0')}`;
    const symbol = `M${index.toString().padStart(2, '0')}`;
    const change = (Math.sin(index) * 8).toFixed(2);
    const liquidity = 50_000 + (index * 1234);
    const status = index % 3 === 0 ? 'Hot' : (index % 2 === 0 ? 'Trending' : 'New');
    return { name, symbol, change, liquidity, status };
  });

  const render = () => {
    const term = filterInput?.value?.toLowerCase().trim() || '';
    const visible = !term ? tokens : tokens.filter(t => `${t.name} ${t.symbol}`.toLowerCase().includes(term));
    table.innerHTML = visible.map(token => `
      <div class="table-row" role="row">
        <span role="cell">${token.name}</span>
        <span role="cell">${token.symbol}</span>
        <span role="cell" class="${Number(token.change) >= 0 ? 'pos' : 'neg'}">${token.change}%</span>
        <span role="cell">${formatCurrency(token.liquidity)}</span>
        <span role="cell"><span class="chip">${token.status}</span></span>
      </div>
    `).join('');

    if (filterResult) filterResult.textContent = `Showing ${visible.length} of ${tokens.length} tokens`;
    if (tokenCount) tokenCount.textContent = tokens.length.toString();
  };

  render();
  if (filterInput) filterInput.addEventListener('input', render);
}

function formatCurrency(value){
  return `$${value.toLocaleString()}`;
}
