/**
 * CasperService - Blockchain interaction module for Ectoplasm DEX
 * Handles all Casper Network interactions including:
 * - Token balance queries (CEP-18)
 * - Pair reserves queries
 * - Swap quote calculations
 * - Transaction building and signing
 */

/**
 * Convert hex string to Uint8Array (browser-compatible, no Buffer needed)
 * @param {string} hex - Hex string (with or without 'hash-' prefix)
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
  const cleanHex = hex.replace('hash-', '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// SDK class references (set during init)
let CasperClientClass = null;
let CLPublicKeyClass = null;
let CLValueBuilderClass = null;
let RuntimeArgsClass = null;
let DeployUtilClass = null;
let CLListClass = null;

const CasperService = {
  client: null,
  initialized: false,
  sdkAvailable: false,
  initError: null,

  /**
   * Initialize the Casper client and resolve SDK classes
   * @returns {boolean} Whether initialization was successful
   */
  init() {
    if (this.initialized) return this.sdkAvailable;

    const network = EctoplasmConfig.getNetwork();

    // Resolve SDK classes from global scope
    // lib.web.js exposes classes under different possible namespaces
    const sdk = window.Casper || window.CasperSDK || window.casper_js_sdk || window;

    // Try to find classes in various locations
    CasperClientClass = sdk.CasperClient || window.CasperClient;
    CLPublicKeyClass = sdk.CLPublicKey || window.CLPublicKey;
    CLValueBuilderClass = sdk.CLValueBuilder || window.CLValueBuilder;
    RuntimeArgsClass = sdk.RuntimeArgs || window.RuntimeArgs;
    DeployUtilClass = sdk.DeployUtil || window.DeployUtil;
    CLListClass = sdk.CLList || window.CLList;

    // Check if casper-js-sdk is loaded
    if (!CasperClientClass) {
      this.initError = 'Casper SDK not loaded. Blockchain features are unavailable.';
      console.warn('CasperService:', this.initError);
      console.warn('Make sure casper-js-sdk is loaded before casper.js');
      this.initialized = true;
      this.sdkAvailable = false;
      return false;
    }

    try {
      this.client = new CasperClientClass(network.rpcUrl);
      this.initialized = true;
      this.sdkAvailable = true;
      console.log(`CasperService initialized for ${network.name}`, {
        rpcUrl: network.rpcUrl,
        sdkClasses: {
          CasperClient: !!CasperClientClass,
          CLPublicKey: !!CLPublicKeyClass,
          CLValueBuilder: !!CLValueBuilderClass,
          DeployUtil: !!DeployUtilClass
        }
      });
      return true;
    } catch (error) {
      this.initError = `Failed to connect to ${network.name}: ${error.message}`;
      console.error('CasperService:', this.initError);
      this.initialized = true;
      this.sdkAvailable = false;
      return false;
    }
  },

  /**
   * Check if SDK is available and show user-friendly error if not
   * @returns {boolean} Whether SDK is available
   */
  isAvailable() {
    this.init();
    return this.sdkAvailable;
  },

  /**
   * Get initialization error message (for UI display)
   * @returns {string|null}
   */
  getError() {
    return this.initError;
  },

  /**
   * Ensure service is initialized and SDK is available
   * @throws {Error} If SDK is not available
   */
  ensureInit() {
    this.init();
    if (!this.sdkAvailable || !this.client) {
      throw new Error(this.initError || 'CasperService not initialized. Is casper-js-sdk loaded?');
    }
  },

  // ============================================
  // Token Balance Queries (CEP-18)
  // ============================================

  /**
   * Query CEP-18 token balance for an account
   * @param {string} tokenHash - Contract package hash (e.g., "hash-295f699...")
   * @param {string} publicKeyHex - Account public key in hex
   * @returns {Promise<{raw: bigint, formatted: string, decimals: number}>}
   */
  async getTokenBalance(tokenHash, publicKeyHex) {
    this.ensureInit();

    if (!tokenHash) {
      return { raw: BigInt(0), formatted: '0', decimals: 18 };
    }

    try {
      // Convert public key to account hash
      const publicKey = CLPublicKeyClass.fromHex(publicKeyHex);
      const accountHash = publicKey.toAccountHashStr();

      // Get state root hash
      const stateRootHash = await this.client.nodeClient.getStateRootHash();

      // CEP-18 stores balances in a dictionary keyed by account hash
      const balanceKey = accountHash.replace('account-hash-', '');
      const contractHash = tokenHash.replace('hash-', '');

      const result = await this.client.nodeClient.getDictionaryItemByName(
        stateRootHash,
        contractHash,
        'balances',
        balanceKey
      );

      // Parse U256 from CLValue
      const balance = BigInt(result.CLValue?.data?.toString() || '0');
      const tokenConfig = EctoplasmConfig.getTokenByHash(tokenHash);
      const decimals = tokenConfig?.decimals || 18;

      return {
        raw: balance,
        formatted: this.formatTokenAmount(balance, decimals),
        decimals
      };
    } catch (error) {
      // Balance of 0 returns an error (key not found) in Casper
      if (error.message?.includes('ValueNotFound') ||
          error.message?.includes('Failed to find') ||
          error.code === -32003) {
        return { raw: BigInt(0), formatted: '0', decimals: 18 };
      }
      console.error('Error fetching token balance:', error);
      throw error;
    }
  },

  /**
   * Get native CSPR balance using direct RPC call (no SDK required)
   * @param {string} publicKeyHex - Account public key in hex
   * @returns {Promise<{raw: bigint, formatted: string, decimals: number}>}
   */
  async getNativeBalance(publicKeyHex) {
    try {
      const network = EctoplasmConfig.getNetwork();

      // Use the query_balance RPC method directly
      const response = await fetch(network.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'query_balance',
          params: {
            purse_identifier: {
              main_purse_under_public_key: publicKeyHex
            }
          }
        })
      });

      const data = await response.json();

      if (data.error) {
        // Account might not exist or have no balance
        if (data.error.code === -32003 || data.error.message?.includes('not found')) {
          console.log('Account not found on chain (no transactions yet)');
          return { raw: BigInt(0), formatted: '0', decimals: 9 };
        }
        throw new Error(data.error.message || 'RPC error');
      }

      const balanceBigInt = BigInt(data.result?.balance || '0');

      console.log('CSPR balance fetched via RPC:', {
        publicKey: publicKeyHex.slice(0, 10) + '...',
        balance: balanceBigInt.toString(),
        formatted: this.formatTokenAmount(balanceBigInt, 9)
      });

      return {
        raw: balanceBigInt,
        formatted: this.formatTokenAmount(balanceBigInt, 9),
        decimals: 9
      };
    } catch (error) {
      console.error('Error fetching CSPR balance:', error.message || error);
      return { raw: BigInt(0), formatted: '0', decimals: 9 };
    }
  },

  /**
   * Get all configured token balances for connected wallet
   * @returns {Promise<Object>} Map of symbol -> balance info
   */
  async getAllBalances() {
    if (!window.connectedAccount) {
      throw new Error('Wallet not connected');
    }

    const balances = {};
    const tokens = EctoplasmConfig.tokens;

    // Get native CSPR balance first (uses REST API, doesn't need SDK)
    balances.CSPR = await this.getNativeBalance(window.connectedAccount);

    // Only fetch CEP-18 token balances if SDK is available
    if (this.isAvailable()) {
      const tokenPromises = Object.entries(tokens)
        .filter(([_, config]) => config.hash) // Only tokens with deployed contracts
        .map(async ([symbol, config]) => {
          try {
            const balance = await this.getTokenBalance(config.hash, window.connectedAccount);
            return [symbol, balance];
          } catch (e) {
            console.warn(`Failed to fetch ${symbol} balance:`, e);
            return [symbol, { raw: BigInt(0), formatted: '0', decimals: config.decimals }];
          }
        });

      const results = await Promise.all(tokenPromises);
      results.forEach(([symbol, balance]) => {
        balances[symbol] = balance;
      });
    } else {
      // SDK not available, set token balances to 0 for now
      console.warn('Casper SDK not available, token balances unavailable');
      Object.entries(tokens)
        .filter(([_, config]) => config.hash)
        .forEach(([symbol, config]) => {
          balances[symbol] = { raw: BigInt(0), formatted: '0', decimals: config.decimals };
        });
    }

    return balances;
  },

  // ============================================
  // Pair Reserves Queries
  // ============================================

  /**
   * Get pair contract address - first checks config, then Factory
   * @param {string} tokenA - First token contract hash
   * @param {string} tokenB - Second token contract hash
   * @returns {Promise<string|null>} Pair contract hash or null
   */
  async getPairAddress(tokenA, tokenB) {
    // First, check if we have a pre-configured pair address
    const configuredPair = this.getConfiguredPairAddress(tokenA, tokenB);
    if (configuredPair) {
      console.log('Using configured pair address:', configuredPair);
      return configuredPair;
    }

    // Fall back to querying Factory contract
    this.ensureInit();

    try {
      const factoryHash = EctoplasmConfig.contracts.factory;
      const stateRootHash = await this.client.nodeClient.getStateRootHash();

      // Factory stores pairs in a mapping: (token0, token1) -> pair_address
      // Tokens must be sorted (smaller hash first)
      const [token0, token1] = this.sortTokens(tokenA, tokenB);

      // Build the dictionary key (format may vary by implementation)
      const pairKey = `${token0.replace('hash-', '')}_${token1.replace('hash-', '')}`;

      const result = await this.client.nodeClient.getDictionaryItemByName(
        stateRootHash,
        factoryHash.replace('hash-', ''),
        'pairs',
        pairKey
      );

      return result?.CLValue?.data || null;
    } catch (error) {
      if (error.message?.includes('ValueNotFound') || error.message?.includes('Failed to find')) {
        return null; // Pair doesn't exist
      }
      console.error('Error fetching pair address:', error);
      throw error;
    }
  },

  /**
   * Look up pair address from pre-configured pairs in config.js
   * @param {string} tokenA - First token hash
   * @param {string} tokenB - Second token hash
   * @returns {string|null} Pair address or null if not configured
   */
  getConfiguredPairAddress(tokenA, tokenB) {
    const pairs = EctoplasmConfig.contracts.pairs;
    if (!pairs) return null;

    // Get token symbols for this pair
    const tokenAConfig = EctoplasmConfig.getTokenByHash(tokenA);
    const tokenBConfig = EctoplasmConfig.getTokenByHash(tokenB);

    if (!tokenAConfig || !tokenBConfig) return null;

    // Try both orderings (A/B and B/A)
    const key1 = `${tokenAConfig.symbol}/${tokenBConfig.symbol}`;
    const key2 = `${tokenBConfig.symbol}/${tokenAConfig.symbol}`;

    return pairs[key1] || pairs[key2] || null;
  },

  /**
   * Get reserves from a Pair contract
   * @param {string} tokenAHash - First token contract hash
   * @param {string} tokenBHash - Second token contract hash
   * @returns {Promise<{reserveA: bigint, reserveB: bigint, exists: boolean}>}
   */
  async getPairReserves(tokenAHash, tokenBHash) {
    this.ensureInit();

    try {
      // First, get the pair address from Factory
      const pairAddress = await this.getPairAddress(tokenAHash, tokenBHash);

      if (!pairAddress) {
        return { reserveA: BigInt(0), reserveB: BigInt(0), exists: false };
      }

      const stateRootHash = await this.client.nodeClient.getStateRootHash();

      // Query pair contract's reserve values
      const reserve0 = await this.queryContractNamedKey(pairAddress, 'reserve0', stateRootHash);
      const reserve1 = await this.queryContractNamedKey(pairAddress, 'reserve1', stateRootHash);

      // Sort tokens to match pair order (token0 < token1)
      const [token0] = this.sortTokens(tokenAHash, tokenBHash);

      // Map reserves back to input order
      if (tokenAHash === token0) {
        return {
          reserveA: BigInt(reserve0 || 0),
          reserveB: BigInt(reserve1 || 0),
          exists: true
        };
      } else {
        return {
          reserveA: BigInt(reserve1 || 0),
          reserveB: BigInt(reserve0 || 0),
          exists: true
        };
      }
    } catch (error) {
      console.error('Error fetching pair reserves:', error);
      return { reserveA: BigInt(0), reserveB: BigInt(0), exists: false };
    }
  },

  /**
   * Query a named key from a contract
   */
  async queryContractNamedKey(contractHash, keyName, stateRootHash) {
    try {
      const result = await this.client.nodeClient.getBlockState(
        stateRootHash || await this.client.nodeClient.getStateRootHash(),
        `hash-${contractHash.replace('hash-', '')}`,
        [keyName]
      );
      return result?.CLValue?.data?.toString();
    } catch (error) {
      console.warn(`Failed to query ${keyName}:`, error);
      return null;
    }
  },

  /**
   * Sort token addresses (smaller hash first, matching Pair contract logic)
   */
  sortTokens(tokenA, tokenB) {
    const hashA = tokenA.replace('hash-', '').toLowerCase();
    const hashB = tokenB.replace('hash-', '').toLowerCase();
    return hashA < hashB ? [tokenA, tokenB] : [tokenB, tokenA];
  },

  // ============================================
  // Swap Quote Calculations (Local)
  // ============================================

  /**
   * Calculate output amount for a swap using AMM formula
   * Implements: amount_out = (amount_in * 997 * reserve_out) / (reserve_in * 1000 + amount_in * 997)
   * @param {bigint} amountIn - Input amount (in smallest unit)
   * @param {bigint} reserveIn - Reserve of input token
   * @param {bigint} reserveOut - Reserve of output token
   * @returns {bigint} Output amount
   */
  getAmountOut(amountIn, reserveIn, reserveOut) {
    if (amountIn <= BigInt(0)) return BigInt(0);
    if (reserveIn <= BigInt(0) || reserveOut <= BigInt(0)) return BigInt(0);

    const amountInWithFee = amountIn * BigInt(997);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * BigInt(1000) + amountInWithFee;

    return numerator / denominator;
  },

  /**
   * Calculate input amount required for desired output
   * Implements: amount_in = (reserve_in * amount_out * 1000) / ((reserve_out - amount_out) * 997) + 1
   */
  getAmountIn(amountOut, reserveIn, reserveOut) {
    if (amountOut <= BigInt(0)) return BigInt(0);
    if (reserveIn <= BigInt(0) || reserveOut <= BigInt(0)) return BigInt(0);
    if (amountOut >= reserveOut) return BigInt(0); // Cannot request more than reserve

    const numerator = reserveIn * amountOut * BigInt(1000);
    const denominator = (reserveOut - amountOut) * BigInt(997);

    return numerator / denominator + BigInt(1);
  },

  /**
   * Get complete swap quote with price impact
   * @param {string} tokenInSymbol - Input token symbol
   * @param {string} tokenOutSymbol - Output token symbol
   * @param {string} amountIn - Human-readable input amount
   * @returns {Promise<SwapQuote>}
   */
  async getSwapQuote(tokenInSymbol, tokenOutSymbol, amountIn) {
    const tokenIn = EctoplasmConfig.getToken(tokenInSymbol);
    const tokenOut = EctoplasmConfig.getToken(tokenOutSymbol);

    if (!tokenIn || !tokenOut) {
      return {
        valid: false,
        error: `Invalid token: ${tokenInSymbol} or ${tokenOutSymbol}`,
        amountOut: '0',
        amountOutRaw: BigInt(0),
        priceImpact: '0',
        rate: '0'
      };
    }

    // Check if token contracts are deployed
    // Native CSPR (hash: null) requires special handling via WCSPR or router
    if (!tokenIn.hash || !tokenOut.hash) {
      // For swaps involving native CSPR, use demo mode until WCSPR is integrated
      console.log('Native CSPR swap - using demo quote (WCSPR integration pending)');
      return this.getDemoQuote(tokenInSymbol, tokenOutSymbol, amountIn);
    }

    // Check if CasperService is available for real quotes
    if (!this.isAvailable()) {
      console.log('CasperService not available - using demo quote');
      return this.getDemoQuote(tokenInSymbol, tokenOutSymbol, amountIn);
    }

    try {
      // Convert to raw amount
      const amountInRaw = this.parseTokenAmount(amountIn, tokenIn.decimals);

      // Get reserves
      const reserves = await this.getPairReserves(tokenIn.hash, tokenOut.hash);

      if (!reserves.exists) {
        return {
          valid: false,
          error: 'Pair does not exist',
          amountOut: '0',
          amountOutRaw: BigInt(0),
          priceImpact: '0',
          rate: '0'
        };
      }

      // Calculate output
      const amountOutRaw = this.getAmountOut(amountInRaw, reserves.reserveA, reserves.reserveB);
      const amountOut = this.formatTokenAmount(amountOutRaw, tokenOut.decimals);

      // Calculate price impact
      const spotPrice = Number(reserves.reserveB) / Number(reserves.reserveA);
      const executionPrice = Number(amountOutRaw) / Number(amountInRaw);
      const priceImpact = spotPrice > 0 ? ((spotPrice - executionPrice) / spotPrice) * 100 : 0;

      // Calculate rate
      const decimalAdjust = Math.pow(10, tokenIn.decimals - tokenOut.decimals);
      const rate = Number(amountOutRaw) / Number(amountInRaw) * decimalAdjust;

      // Calculate minimum received with slippage
      const slippage = EctoplasmConfig.swap.defaultSlippage / 100;
      const minReceivedRaw = amountOutRaw * BigInt(Math.floor((1 - slippage) * 10000)) / BigInt(10000);

      return {
        valid: true,
        tokenIn,
        tokenOut,
        amountIn,
        amountInRaw,
        amountOut,
        amountOutRaw,
        minReceived: this.formatTokenAmount(minReceivedRaw, tokenOut.decimals),
        minReceivedRaw,
        priceImpact: Math.max(0, priceImpact).toFixed(2),
        rate: rate.toFixed(6),
        path: [tokenIn.hash, tokenOut.hash],
        reserves
      };
    } catch (error) {
      console.error('Quote error:', error);
      return {
        valid: false,
        error: error.message || 'Failed to calculate quote',
        amountOut: '0',
        amountOutRaw: BigInt(0),
        priceImpact: '0',
        rate: '0'
      };
    }
  },

  /**
   * Demo quote for when contracts are not yet deployed
   * Uses static rates for UI demonstration
   */
  getDemoQuote(tokenInSymbol, tokenOutSymbol, amountIn) {
    // Demo rate table
    const demoRates = {
      cspr: { ecto: 0.05, usdc: 0.035, weth: 0.000015, wbtc: 0.0000008 },
      ecto: { cspr: 20, usdc: 0.70, weth: 0.0003, wbtc: 0.000016 },
      usdc: { cspr: 28.57, ecto: 1.43, weth: 0.00043, wbtc: 0.000023 },
      weth: { cspr: 66667, ecto: 3333, usdc: 2333, wbtc: 0.053 },
      wbtc: { cspr: 1250000, ecto: 62500, usdc: 43750, weth: 18.87 }
    };

    const fromKey = tokenInSymbol.toLowerCase();
    const toKey = tokenOutSymbol.toLowerCase();
    const rate = demoRates[fromKey]?.[toKey] || 1;

    const amountInNum = parseFloat(amountIn) || 0;
    const amountOutNum = amountInNum * rate;

    const tokenIn = EctoplasmConfig.getToken(tokenInSymbol);
    const tokenOut = EctoplasmConfig.getToken(tokenOutSymbol);

    const slippage = EctoplasmConfig.swap.defaultSlippage / 100;
    const minReceivedNum = amountOutNum * (1 - slippage);

    return {
      valid: true,
      demo: true, // Flag indicating this is a demo quote
      tokenIn,
      tokenOut,
      amountIn,
      amountInRaw: this.parseTokenAmount(amountIn, tokenIn?.decimals || 18),
      amountOut: amountOutNum.toFixed(6),
      amountOutRaw: this.parseTokenAmount(amountOutNum.toString(), tokenOut?.decimals || 18),
      minReceived: minReceivedNum.toFixed(6),
      minReceivedRaw: BigInt(0),
      priceImpact: '0.00', // Demo has no real impact
      rate: rate.toFixed(6),
      path: [],
      reserves: null
    };
  },

  // ============================================
  // Transaction Building & Signing
  // ============================================

  /**
   * Check if Router has sufficient allowance to spend user's tokens
   */
  async checkAllowance(tokenHash, ownerPublicKey, amount) {
    this.ensureInit();

    if (!tokenHash) return false;

    try {
      const accountHash = CLPublicKeyClass.fromHex(ownerPublicKey).toAccountHashStr();
      const routerHash = EctoplasmConfig.contracts.router;

      const stateRootHash = await this.client.nodeClient.getStateRootHash();
      const ownerKey = accountHash.replace('account-hash-', '');
      const spenderKey = routerHash.replace('hash-', '');

      // CEP-18 allowances stored with composite key
      const allowanceKey = `${ownerKey}_${spenderKey}`;

      const result = await this.client.nodeClient.getDictionaryItemByName(
        stateRootHash,
        tokenHash.replace('hash-', ''),
        'allowances',
        allowanceKey
      );

      const currentAllowance = BigInt(result?.CLValue?.data?.toString() || '0');
      return currentAllowance >= amount;
    } catch (error) {
      return false; // No allowance set
    }
  },

  /**
   * Build and sign approval transaction
   * @param {string} tokenHash - Token contract hash
   * @param {bigint} amount - Amount to approve
   * @returns {Promise<string>} Deploy hash
   */
  async approveToken(tokenHash, amount) {
    this.ensureInit();

    if (!window.connectedAccount || !window.connectedWallet) {
      throw new Error('Wallet not connected');
    }

    const publicKey = CLPublicKeyClass.fromHex(window.connectedAccount);
    const routerHash = EctoplasmConfig.contracts.router;
    const gasLimit = EctoplasmConfig.gasLimits.approve;
    const network = EctoplasmConfig.getNetwork();

    // Build deploy arguments for CEP-18 approve
    const args = RuntimeArgsClass.fromMap({
      spender: CLValueBuilderClass.key(
        CLValueBuilderClass.byteArray(
          hexToBytes(routerHash)
        )
      ),
      amount: CLValueBuilderClass.u256(amount.toString())
    });

    // Build the deploy
    const deploy = DeployUtilClass.makeDeploy(
      new DeployUtilClass.DeployParams(
        publicKey,
        network.chainName,
        1, // Gas price
        3600000 // TTL: 1 hour
      ),
      DeployUtilClass.ExecutableDeployItem.newStoredContractByHash(
        hexToBytes(tokenHash),
        'approve',
        args
      ),
      DeployUtilClass.standardPayment(gasLimit)
    );

    // Sign with connected wallet
    const signedDeploy = await this.signDeploy(deploy);

    // Submit to network
    const deployHash = await this.client.putDeploy(signedDeploy);

    return deployHash;
  },

  /**
   * Execute a swap transaction
   * @param {Object} quote - Quote from getSwapQuote()
   * @param {number} slippagePercent - Slippage tolerance
   * @returns {Promise<string>} Deploy hash
   */
  async executeSwap(quote, slippagePercent = EctoplasmConfig.swap.defaultSlippage) {
    this.ensureInit();

    if (!window.connectedAccount || !window.connectedWallet) {
      throw new Error('Wallet not connected');
    }

    if (!quote.valid) {
      throw new Error(quote.error || 'Invalid quote');
    }

    if (quote.demo) {
      throw new Error('Cannot execute swap: Token contracts not deployed');
    }

    // Step 1: Check and request approval if needed
    const hasAllowance = await this.checkAllowance(
      quote.path[0],
      window.connectedAccount,
      quote.amountInRaw
    );

    if (!hasAllowance) {
      console.log('Requesting token approval...');
      const approvalHash = await this.approveToken(quote.path[0], quote.amountInRaw);
      console.log('Approval submitted:', approvalHash);

      // Wait for approval to be processed
      const approvalResult = await this.waitForDeploy(approvalHash);
      if (!approvalResult.success) {
        throw new Error(`Approval failed: ${approvalResult.error}`);
      }
    }

    // Step 2: Build swap transaction
    const publicKey = CLPublicKeyClass.fromHex(window.connectedAccount);
    const routerHash = EctoplasmConfig.contracts.router;
    const gasLimit = EctoplasmConfig.gasLimits.swap;
    const network = EctoplasmConfig.getNetwork();

    // Calculate deadline (current time + configured minutes)
    const deadline = Date.now() + (EctoplasmConfig.swap.deadlineMinutes * 60 * 1000);

    // Calculate minimum output with slippage
    const slippageMultiplier = BigInt(Math.floor((1 - slippagePercent / 100) * 10000));
    const amountOutMin = quote.amountOutRaw * slippageMultiplier / BigInt(10000);

    // Build path as list of contract hashes
    const pathList = new CLListClass([
      CLValueBuilderClass.byteArray(hexToBytes(quote.path[0])),
      CLValueBuilderClass.byteArray(hexToBytes(quote.path[1]))
    ]);

    const args = RuntimeArgsClass.fromMap({
      amount_in: CLValueBuilderClass.u256(quote.amountInRaw.toString()),
      amount_out_min: CLValueBuilderClass.u256(amountOutMin.toString()),
      path: pathList,
      to: CLValueBuilderClass.key(CLValueBuilderClass.byteArray(publicKey.toAccountHash())),
      deadline: CLValueBuilderClass.u64(deadline)
    });

    const deploy = DeployUtilClass.makeDeploy(
      new DeployUtilClass.DeployParams(
        publicKey,
        network.chainName,
        1,
        3600000
      ),
      DeployUtilClass.ExecutableDeployItem.newStoredContractByHash(
        hexToBytes(routerHash),
        'swap_exact_tokens_for_tokens',
        args
      ),
      DeployUtilClass.standardPayment(gasLimit)
    );

    const signedDeploy = await this.signDeploy(deploy);
    const deployHash = await this.client.putDeploy(signedDeploy);

    return deployHash;
  },

  /**
   * Add liquidity to a pool
   * @param {string} tokenASymbol - First token symbol
   * @param {string} tokenBSymbol - Second token symbol
   * @param {string} amountA - Amount of token A (human-readable)
   * @param {string} amountB - Amount of token B (human-readable)
   * @param {number} slippagePercent - Slippage tolerance
   * @returns {Promise<string>} Deploy hash
   */
  async addLiquidity(tokenASymbol, tokenBSymbol, amountA, amountB, slippagePercent = 1.0) {
    this.ensureInit();

    if (!window.connectedAccount || !window.connectedWallet) {
      throw new Error('Wallet not connected');
    }

    const tokenA = EctoplasmConfig.getToken(tokenASymbol);
    const tokenB = EctoplasmConfig.getToken(tokenBSymbol);

    if (!tokenA?.hash || !tokenB?.hash) {
      throw new Error('Invalid tokens or token contracts not deployed');
    }

    const publicKey = CLPublicKeyClass.fromHex(window.connectedAccount);
    const routerHash = EctoplasmConfig.contracts.router;
    const gasLimit = EctoplasmConfig.gasLimits.addLiquidity;
    const network = EctoplasmConfig.getNetwork();

    // Parse amounts
    const amountADesired = this.parseTokenAmount(amountA, tokenA.decimals);
    const amountBDesired = this.parseTokenAmount(amountB, tokenB.decimals);

    // Calculate minimum amounts with slippage
    const slippageMultiplier = BigInt(Math.floor((1 - slippagePercent / 100) * 10000));
    const amountAMin = amountADesired * slippageMultiplier / BigInt(10000);
    const amountBMin = amountBDesired * slippageMultiplier / BigInt(10000);

    // Calculate deadline
    const deadline = Date.now() + (EctoplasmConfig.swap.deadlineMinutes * 60 * 1000);

    // Step 1: Approve both tokens for Router
    for (const [tokenHash, amount] of [[tokenA.hash, amountADesired], [tokenB.hash, amountBDesired]]) {
      const hasAllowance = await this.checkAllowance(tokenHash, window.connectedAccount, amount);
      if (!hasAllowance) {
        console.log(`Approving ${tokenHash}...`);
        const approvalHash = await this.approveToken(tokenHash, amount);
        const approvalResult = await this.waitForDeploy(approvalHash);
        if (!approvalResult.success) {
          throw new Error(`Token approval failed: ${approvalResult.error}`);
        }
      }
    }

    // Step 2: Build add_liquidity transaction
    const args = RuntimeArgsClass.fromMap({
      token_a: CLValueBuilderClass.key(CLValueBuilderClass.byteArray(hexToBytes(tokenA.hash))),
      token_b: CLValueBuilderClass.key(CLValueBuilderClass.byteArray(hexToBytes(tokenB.hash))),
      amount_a_desired: CLValueBuilderClass.u256(amountADesired.toString()),
      amount_b_desired: CLValueBuilderClass.u256(amountBDesired.toString()),
      amount_a_min: CLValueBuilderClass.u256(amountAMin.toString()),
      amount_b_min: CLValueBuilderClass.u256(amountBMin.toString()),
      to: CLValueBuilderClass.key(CLValueBuilderClass.byteArray(publicKey.toAccountHash())),
      deadline: CLValueBuilderClass.u64(deadline)
    });

    const deploy = DeployUtilClass.makeDeploy(
      new DeployUtilClass.DeployParams(
        publicKey,
        network.chainName,
        1,
        3600000
      ),
      DeployUtilClass.ExecutableDeployItem.newStoredContractByHash(
        hexToBytes(routerHash),
        'add_liquidity',
        args
      ),
      DeployUtilClass.standardPayment(gasLimit)
    );

    const signedDeploy = await this.signDeploy(deploy);
    const deployHash = await this.client.putDeploy(signedDeploy);

    return deployHash;
  },

  /**
   * Remove liquidity from a pool
   * @param {string} tokenASymbol - First token symbol
   * @param {string} tokenBSymbol - Second token symbol
   * @param {string} lpAmount - Amount of LP tokens to burn (human-readable)
   * @param {number} slippagePercent - Slippage tolerance
   * @returns {Promise<string>} Deploy hash
   */
  async removeLiquidity(tokenASymbol, tokenBSymbol, lpAmount, slippagePercent = 1.0) {
    this.ensureInit();

    if (!window.connectedAccount || !window.connectedWallet) {
      throw new Error('Wallet not connected');
    }

    const tokenA = EctoplasmConfig.getToken(tokenASymbol);
    const tokenB = EctoplasmConfig.getToken(tokenBSymbol);

    if (!tokenA?.hash || !tokenB?.hash) {
      throw new Error('Invalid tokens or token contracts not deployed');
    }

    const publicKey = CLPublicKeyClass.fromHex(window.connectedAccount);
    const routerHash = EctoplasmConfig.contracts.router;
    const lpTokenHash = EctoplasmConfig.contracts.lpToken;
    const gasLimit = EctoplasmConfig.gasLimits.removeLiquidity;
    const network = EctoplasmConfig.getNetwork();

    // LP tokens typically have 18 decimals
    const lpAmountRaw = this.parseTokenAmount(lpAmount, 18);

    // Calculate minimum amounts (we'd need reserves to calculate exact amounts)
    // For now, use very conservative minimum to ensure transaction succeeds
    const slippageMultiplier = BigInt(Math.floor((1 - slippagePercent / 100) * 10000));
    const amountAMin = BigInt(0); // Allow any amount (could be improved with reserve calculation)
    const amountBMin = BigInt(0);

    // Calculate deadline
    const deadline = Date.now() + (EctoplasmConfig.swap.deadlineMinutes * 60 * 1000);

    // Step 1: Approve LP tokens for Router
    const hasAllowance = await this.checkAllowance(lpTokenHash, window.connectedAccount, lpAmountRaw);
    if (!hasAllowance) {
      console.log('Approving LP tokens...');
      const approvalHash = await this.approveToken(lpTokenHash, lpAmountRaw);
      const approvalResult = await this.waitForDeploy(approvalHash);
      if (!approvalResult.success) {
        throw new Error(`LP token approval failed: ${approvalResult.error}`);
      }
    }

    // Step 2: Build remove_liquidity transaction
    const args = RuntimeArgsClass.fromMap({
      token_a: CLValueBuilderClass.key(CLValueBuilderClass.byteArray(hexToBytes(tokenA.hash))),
      token_b: CLValueBuilderClass.key(CLValueBuilderClass.byteArray(hexToBytes(tokenB.hash))),
      liquidity: CLValueBuilderClass.u256(lpAmountRaw.toString()),
      amount_a_min: CLValueBuilderClass.u256(amountAMin.toString()),
      amount_b_min: CLValueBuilderClass.u256(amountBMin.toString()),
      to: CLValueBuilderClass.key(CLValueBuilderClass.byteArray(publicKey.toAccountHash())),
      deadline: CLValueBuilderClass.u64(deadline)
    });

    const deploy = DeployUtilClass.makeDeploy(
      new DeployUtilClass.DeployParams(
        publicKey,
        network.chainName,
        1,
        3600000
      ),
      DeployUtilClass.ExecutableDeployItem.newStoredContractByHash(
        hexToBytes(routerHash),
        'remove_liquidity',
        args
      ),
      DeployUtilClass.standardPayment(gasLimit)
    );

    const signedDeploy = await this.signDeploy(deploy);
    const deployHash = await this.client.putDeploy(signedDeploy);

    return deployHash;
  },

  /**
   * Sign deploy using connected wallet provider
   */
  async signDeploy(deploy) {
    const deployJson = DeployUtilClass.deployToJson(deploy);

    if (window.connectedWallet === 'casperwallet') {
      // CasperWallet browser extension
      const provider = window.CasperWalletProvider();
      const signature = await provider.sign(
        JSON.stringify(deployJson),
        window.connectedAccount
      );
      return DeployUtilClass.setSignature(
        deploy,
        signature.signature,
        CLPublicKeyClass.fromHex(window.connectedAccount)
      );
    } else if (window.connectedWallet === 'caspersigner') {
      // Casper Signer (legacy)
      const helper = window.casperlabsHelper || window.CasperWallet;
      const signedDeployJson = await helper.sign(
        deployJson,
        window.connectedAccount
      );
      return DeployUtilClass.deployFromJson(signedDeployJson).unwrap();
    } else if (window.connectedWallet === 'csprcloud') {
      // CSPR.Cloud wallet
      const signedDeployJson = await window.csprclick.sign(deployJson);
      return DeployUtilClass.deployFromJson(signedDeployJson).unwrap();
    }

    throw new Error(`Unsupported wallet: ${window.connectedWallet}`);
  },

  /**
   * Wait for deploy to be processed
   * @param {string} deployHash - The deploy hash to wait for
   * @param {number} timeoutMs - Timeout in milliseconds
   */
  async waitForDeploy(deployHash, timeoutMs = 120000) {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await this.client.nodeClient.getDeployInfo(deployHash);

        if (result.execution_results?.length > 0) {
          const execResult = result.execution_results[0];
          if (execResult.result.Success) {
            return { success: true, result: execResult };
          } else {
            return {
              success: false,
              error: execResult.result.Failure?.error_message || 'Transaction failed'
            };
          }
        }
      } catch (e) {
        // Deploy not found yet, continue polling
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return { success: false, error: 'Transaction timed out' };
  },

  // ============================================
  // Utility Functions
  // ============================================

  /**
   * Format token amount with decimals for display
   * @param {bigint} amount - Raw amount
   * @param {number} decimals - Token decimals
   * @returns {string} Formatted amount
   */
  formatTokenAmount(amount, decimals) {
    if (typeof amount !== 'bigint') {
      amount = BigInt(amount || 0);
    }

    const divisor = BigInt(10 ** decimals);
    const intPart = amount / divisor;
    const fracPart = amount % divisor;

    // Pad fraction to full decimal places, then trim trailing zeros
    const fracStr = fracPart.toString().padStart(decimals, '0');
    // Keep up to 6 decimal places for display
    const trimmedFrac = fracStr.slice(0, 6).replace(/0+$/, '');

    if (trimmedFrac) {
      return `${intPart}.${trimmedFrac}`;
    }
    return intPart.toString();
  },

  /**
   * Parse human-readable amount to raw BigInt
   * @param {string} amount - Human-readable amount
   * @param {number} decimals - Token decimals
   * @returns {bigint} Raw amount
   */
  parseTokenAmount(amount, decimals) {
    const str = amount.toString();
    const parts = str.split('.');
    const intPart = parts[0] || '0';
    const fracPart = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
    return BigInt(intPart + fracPart);
  }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Delay init slightly to ensure SDK is loaded
  setTimeout(() => CasperService.init(), 100);
});

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CasperService;
}
