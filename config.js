/**
 * Liquidnation DEX Configuration
 * Contract addresses and network settings for Casper Network integration
 */
const LiquidnationConfig = {
  // Network Configuration
  networks: {
    testnet: {
      name: 'Casper Testnet',
      rpcUrl: 'https://rpc.testnet.casperlabs.io/rpc',
      chainName: 'casper-test',
    },
    mainnet: {
      name: 'Casper Mainnet',
      rpcUrl: 'https://rpc.mainnet.casperlabs.io/rpc',
      chainName: 'casper',
    }
  },

  // Current Network (toggle for deployment)
  currentNetwork: 'testnet',

  // Contract Package Hashes (deployed on testnet)
  contracts: {
    factory: 'hash-b42ef2718fd368fb40564b2c655550de5f5157b9d3788463ce4a7492db100816',
    router: 'hash-344a719930ebca4c37525d5801400b24b7f007a56f3426e9a5777cd6f56faca1',
    lpToken: 'hash-16eacd913f576394fbf114f652504e960367be71b560795fb9d7cf4d5c98ea68',
    // Trading pair contracts (with initial liquidity)
    pairs: {
      'ECTO/USDC': 'hash-7a9d232fb79ae73ad24f2f40f76ec97757df9f40c60913477b67e912a5ac7ddf',
      'WETH/USDC': 'hash-3a580a704165ce3fc5c4216819f372a19b765b736ecd89b009fa04725ebba0bf',
      'WBTC/USDC': 'hash-35db4ae07d69915fc04ef5441642911da75f48b05c0b55f31b59a9ae0504c8bf',
    },
  },

  // Token Configuration
  // Note: Token contracts need to be deployed and hashes updated here
  tokens: {
    CSPR: {
      hash: null, // Native token, no contract needed
      symbol: 'CSPR',
      decimals: 9, // CSPR uses 9 decimals (motes)
      name: 'Casper',
      icon: null
    },
    ECTO: {
      hash: 'hash-fb7c662bca66d1a32018ac6529b4ee588cf13178370ae5b59f979ae6e5e96029',
      symbol: 'LIQN',
      decimals: 18,
      name: 'Liquidnation Token',
      icon: null
    },
    USDC: {
      hash: 'hash-85c1770e3dd4e951d37b8ea9b0047fed7fb68578eb4006477d31f019b6d4d1ca',
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin',
      icon: null
    },
    WETH: {
      hash: 'hash-01db8d5ecf32d600c0f601b76a094ed5bb982226d5e0430386077bb7bf4a6a07',
      symbol: 'WETH',
      decimals: 18,
      name: 'Wrapped Ether',
      icon: null
    },
    WBTC: {
      hash: 'hash-e0d728136c25fd7345a1e75a5a9d483498025cee516a948a38e95a39a3ba891c',
      symbol: 'WBTC',
      decimals: 8,
      name: 'Wrapped Bitcoin',
      icon: null
    }
  },

  // Swap Settings
  swap: {
    defaultSlippage: 0.5,        // 0.5%
    maxSlippage: 50.0,           // 50% max
    deadlineMinutes: 20,         // Transaction deadline
    feePercent: 0.3,             // 0.3% swap fee (matches contract: 997/1000)
  },

  // Gas Limits (in motes - 1 CSPR = 1,000,000,000 motes)
  gasLimits: {
    approve: '3000000000',       // 3 CSPR
    swap: '15000000000',         // 15 CSPR
    addLiquidity: '20000000000', // 20 CSPR
    removeLiquidity: '15000000000', // 15 CSPR
  },

  // Helper to get current network config
  getNetwork() {
    return this.networks[this.currentNetwork];
  },

  // Helper to find token by symbol
  getToken(symbol) {
    return this.tokens[symbol?.toUpperCase()] || null;
  },

  // Helper to find token by hash
  getTokenByHash(hash) {
    return Object.values(this.tokens).find(t => t.hash === hash) || null;
  },

  // Check if token contracts are deployed
  areTokensDeployed() {
    return this.tokens.ECTO.hash !== null;
  }
};

// Freeze config objects to prevent accidental modification
Object.freeze(LiquidnationConfig.networks);
Object.freeze(LiquidnationConfig.networks.testnet);
Object.freeze(LiquidnationConfig.networks.mainnet);
Object.freeze(LiquidnationConfig.contracts);
Object.freeze(LiquidnationConfig.swap);
Object.freeze(LiquidnationConfig.gasLimits);
// Note: tokens not frozen so hashes can be updated after deployment

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LiquidnationConfig;
}
