/**
 * CasperService - Blockchain interaction module for Ectoplasm DEX
 * Handles all Casper Network interactions including:
 * - Token balance queries (CEP-18)
 * - Pair reserves queries
 * - Swap quote calculations
 * - Transaction building and signing
 */
const CasperService = {
  client: null,
  initialized: false,

  /**
   * Initialize the Casper client
   */
  init() {
    if (this.initialized) return;

    const network = EctoplasmConfig.getNetwork();

    // Check if casper-js-sdk is loaded
    if (typeof CasperClient === 'undefined') {
      console.warn('CasperService: casper-js-sdk not loaded yet');
      return;
    }

    try {
      this.client = new CasperClient(network.rpcUrl);
      this.initialized = true;
      console.log(`CasperService initialized for ${network.name}`);
    } catch (error) {
      console.error('CasperService: Failed to initialize', error);
    }
  },

  /**
   * Ensure service is initialized
   */
  ensureInit() {
    if (!this.initialized) {
      this.init();
    }
    if (!this.client) {
      throw new Error('CasperService not initialized. Is casper-js-sdk loaded?');
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
      const publicKey = CLPublicKey.fromHex(publicKeyHex);
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
   * Get native CSPR balance
   * @param {string} publicKeyHex - Account public key in hex
   * @returns {Promise<{raw: bigint, formatted: string, decimals: number}>}
   */
  async getNativeBalance(publicKeyHex) {
    this.ensureInit();

    try {
      const publicKey = CLPublicKey.fromHex(publicKeyHex);
      
      // Use the account hash to query balance via state_get_balance RPC
      // This is more reliable across Casper network versions
      const accountHash = publicKey.toAccountHashStr();
      const stateRootHash = await this.client.nodeClient.getStateRootHash();
      
      // Query the account's main purse balance
      // First, get the account info to find the main purse URef
      const accountInfo = await this.client.nodeClient.getBlockState(
        stateRootHash,
        accountHash,
        []
      );
      
      // Extract the main purse URef from account info
      const mainPurse = accountInfo?.Account?.main_purse;
      if (!mainPurse) {
        // Account may not exist yet (no balance)
        return { raw: BigInt(0), formatted: '0', decimals: 9 };
      }
      
      // Query the balance of the main purse
      const balanceResult = await this.client.nodeClient.getAccountBalance(
        stateRootHash,
        mainPurse
      );
      
      // Safely convert balance to BigInt, defaulting to 0 if null/undefined
      const balance = balanceResult ? BigInt(balanceResult.toString()) : BigInt(0);

      return {
        raw: balance,
        formatted: this.formatTokenAmount(balance, 9),
        decimals: 9
      };
    } catch (error) {
      // Handle specific error cases
      if (error.message?.includes('ValueNotFound') || 
          error.message?.includes('Failed to find') ||
          error.message?.includes('query_balance') ||
          error.code === -32003 ||
          error.code === -32602) {
        // Account doesn't exist or has no balance
        return { raw: BigInt(0), formatted: '0', decimals: 9 };
      }
      console.error('Error fetching CSPR balance:', error);
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

    // Fetch all CEP-18 token balances in parallel
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

    // Get native CSPR balance
    balances.CSPR = await this.getNativeBalance(window.connectedAccount);

    return balances;
  },

  // ============================================
  // Pair Reserves Queries
  // ============================================

  /**
   * Get pair contract address from Factory
   * @param {string} tokenA - First token contract hash
   * @param {string} tokenB - Second token contract hash
   * @returns {Promise<string|null>} Pair contract hash or null
   */
  async getPairAddress(tokenA, tokenB) {
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
    if (!tokenIn.hash || !tokenOut.hash) {
      // Return demo quote for now if tokens not deployed
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
      const accountHash = CLPublicKey.fromHex(ownerPublicKey).toAccountHashStr();
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

    const publicKey = CLPublicKey.fromHex(window.connectedAccount);
    const routerHash = EctoplasmConfig.contracts.router;
    const gasLimit = EctoplasmConfig.gasLimits.approve;
    const network = EctoplasmConfig.getNetwork();

    // Build deploy arguments for CEP-18 approve
    const args = RuntimeArgs.fromMap({
      spender: CLValueBuilder.key(
        CLValueBuilder.byteArray(
          Uint8Array.from(Buffer.from(routerHash.replace('hash-', ''), 'hex'))
        )
      ),
      amount: CLValueBuilder.u256(amount.toString())
    });

    // Build the deploy
    const deploy = DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(
        publicKey,
        network.chainName,
        1, // Gas price
        3600000 // TTL: 1 hour
      ),
      DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Uint8Array.from(Buffer.from(tokenHash.replace('hash-', ''), 'hex')),
        'approve',
        args
      ),
      DeployUtil.standardPayment(gasLimit)
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
    const publicKey = CLPublicKey.fromHex(window.connectedAccount);
    const routerHash = EctoplasmConfig.contracts.router;
    const gasLimit = EctoplasmConfig.gasLimits.swap;
    const network = EctoplasmConfig.getNetwork();

    // Calculate deadline (current time + configured minutes)
    const deadline = Date.now() + (EctoplasmConfig.swap.deadlineMinutes * 60 * 1000);

    // Calculate minimum output with slippage
    const slippageMultiplier = BigInt(Math.floor((1 - slippagePercent / 100) * 10000));
    const amountOutMin = quote.amountOutRaw * slippageMultiplier / BigInt(10000);

    // Build path as list of contract hashes
    const pathList = new CLList([
      CLValueBuilder.byteArray(Uint8Array.from(Buffer.from(quote.path[0].replace('hash-', ''), 'hex'))),
      CLValueBuilder.byteArray(Uint8Array.from(Buffer.from(quote.path[1].replace('hash-', ''), 'hex')))
    ]);

    const args = RuntimeArgs.fromMap({
      amount_in: CLValueBuilder.u256(quote.amountInRaw.toString()),
      amount_out_min: CLValueBuilder.u256(amountOutMin.toString()),
      path: pathList,
      to: CLValueBuilder.key(CLValueBuilder.byteArray(publicKey.toAccountHash())),
      deadline: CLValueBuilder.u64(deadline)
    });

    const deploy = DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(
        publicKey,
        network.chainName,
        1,
        3600000
      ),
      DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Uint8Array.from(Buffer.from(routerHash.replace('hash-', ''), 'hex')),
        'swap_exact_tokens_for_tokens',
        args
      ),
      DeployUtil.standardPayment(gasLimit)
    );

    const signedDeploy = await this.signDeploy(deploy);
    const deployHash = await this.client.putDeploy(signedDeploy);

    return deployHash;
  },

  /**
   * Sign deploy using connected wallet provider
   */
  async signDeploy(deploy) {
    const deployJson = DeployUtil.deployToJson(deploy);

    if (window.connectedWallet === 'casperwallet') {
      // CasperWallet browser extension
      const provider = window.CasperWalletProvider();
      const response = await provider.sign(
        JSON.stringify(deployJson),
        window.connectedAccount
      );
      
      // Handle different response formats from CasperWallet
      let signatureHex;
      if (response.signature) {
        signatureHex = response.signature;
      } else if (response.deploy?.approvals?.[0]?.signature) {
        signatureHex = response.deploy.approvals[0].signature;
      } else {
        throw new Error('Invalid signature response from CasperWallet');
      }
      
      // Ensure signature is properly formatted (with algorithm prefix)
      if (!signatureHex.startsWith('01') && !signatureHex.startsWith('02')) {
        // Add the appropriate signature prefix based on key type (01=Ed25519, 02=Secp256k1)
        const publicKey = CLPublicKey.fromHex(window.connectedAccount);
        const keyType = publicKey.isEd25519() ? '01' : '02';
        signatureHex = keyType + signatureHex;
      }
      
      return DeployUtil.setSignature(
        deploy,
        signatureHex,
        CLPublicKey.fromHex(window.connectedAccount)
      );
    } else if (window.connectedWallet === 'caspersigner') {
      // Casper Signer (legacy)
      const helper = window.casperlabsHelper || window.CasperWallet;
      const signedDeployJson = await helper.sign(
        deployJson,
        window.connectedAccount
      );
      
      // Handle both direct JSON and wrapped response formats
      const deployData = signedDeployJson.deploy || signedDeployJson;
      const result = DeployUtil.deployFromJson(deployData);
      if (result.err) {
        throw new Error(`Failed to parse signed deploy: ${result.err}`);
      }
      return result.unwrap();
    } else if (window.connectedWallet === 'csprcloud') {
      // CSPR.Cloud wallet
      const signedDeployJson = await window.csprclick.sign(deployJson);
      
      // Handle both direct JSON and wrapped response formats
      const deployData = signedDeployJson.deploy || signedDeployJson;
      const result = DeployUtil.deployFromJson(deployData);
      if (result.err) {
        throw new Error(`Failed to parse signed deploy: ${result.err}`);
      }
      return result.unwrap();
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
