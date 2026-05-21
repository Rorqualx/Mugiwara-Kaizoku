# Brave Browser Ethereum Error Fix

## Issue Description

**Error**: `TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')`

**Affected Environment**: Mobile version of Brave browser

**Date Fixed**: July 2025

## Root Cause

Brave browser includes built-in cryptocurrency wallet features that attempt to inject Web3/Ethereum functionality into web pages. On mobile versions of Brave, this injection can fail or be incomplete, causing the browser to try to set properties on `window.ethereum` when the object doesn't exist.

The specific error occurs when code (likely from Brave's internals) tries to execute:
```javascript
window.ethereum.selectedAddress = undefined
```

But `window.ethereum` itself is undefined, causing the TypeError.

## Solution

Created a protective script that runs before any other application code to ensure `window.ethereum` exists with minimal functionality. This prevents the error while maintaining compatibility with actual Web3 applications.

### Implementation

1. **Created Fix Script**: `/src/scripts/brave-ethereum-fix.js`
   - Creates a minimal `window.ethereum` object if it doesn't exist
   - Includes basic properties and methods expected by Brave
   - Seals the object to prevent property assignment errors while allowing extensions

2. **Applied Fix in App Entry Point**: `/src/pages/_app.tsx`
   - Added import for the fix script before all other imports
   - Ensures the fix runs before any other code that might trigger the error

### Code Details

The fix creates a minimal ethereum object with:
- `selectedAddress: undefined` - The property Brave tries to set
- `isMetaMask: false` - Common property checked by dApps
- `isBraveWallet: false` - Brave-specific property
- `request()` - Minimal method that throws an error (no actual Web3 functionality)
- Event methods (`on`, `removeListener`) - No-op implementations

## Testing

After applying this fix:
1. The error should no longer appear on mobile Brave browser
2. The application should load normally
3. Console should show: "Created placeholder window.ethereum object for Brave browser compatibility"
4. Any actual Web3 functionality would still fail gracefully with "Ethereum provider not available"

## Future Considerations

- This fix is specifically for preventing runtime errors, not for enabling Web3 functionality
- If the application needs actual Web3 features in the future, a proper Web3 provider library should be integrated
- The fix is designed to be harmless on browsers that already have `window.ethereum` properly configured
