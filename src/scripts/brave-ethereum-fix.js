/**
 * Brave Browser Ethereum Fix
 *
 * This script prevents runtime errors on mobile Brave browser
 * related to window.ethereum.selectedAddress access.
 *
 * The issue occurs when Brave's crypto wallet tries to initialize
 * but window.ethereum is undefined, causing the error:
 * "TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')"
 *
 * This fix creates a minimal window.ethereum object if it doesn't exist,
 * preventing the error while maintaining compatibility with actual Web3 functionality.
 *
 * @quality-check-skip - Browser script that runs before app logger is available
 */

/**
 * Creates a placeholder ethereum provider object
 * @returns {object} Minimal ethereum provider stub
 */
function createEthereumStub() {
  return {
    selectedAddress: undefined,
    isMetaMask: false,
    isBraveWallet: false,
    request: async () => { throw new Error('Ethereum provider not available'); },
    on: () => {},
    removeListener: () => {},
    __proto__: Object.create(null)
  };
}

/**
 * Initializes the Brave ethereum fix if needed
 */
function initBraveEthereumFix() {
  if (typeof window === 'undefined') return;
  if (window.ethereum) return;

  try {
    window.ethereum = createEthereumStub();
    Object.seal(window.ethereum);
  } catch (_error) {
    // Silently catch errors to prevent breaking the app
  }
}

// Execute the fix
initBraveEthereumFix();
