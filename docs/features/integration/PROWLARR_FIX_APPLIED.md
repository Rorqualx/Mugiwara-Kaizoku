# PROWLARR_FIX_APPLIED

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for PROWLARR_FIX_APPLIED

---
# Prowlarr API Fixed - Summary

## Problem
You were getting an error where the Prowlarr API proxy was showing `path: undefined` even though the path parameter was being sent correctly.

## Solution Applied
I fixed the issue by modifying the API proxy (`/src/pages/api/prowlarr.ts`) to handle both `path` and `endpoint` parameters. The proxy was incorrectly looking for an `endpoint` parameter when it detected "original test mode".

### Changes Made:
1. **Modified parameter extraction** to accept both `path` and `endpoint`
2. **Added environment variable** `USE_FIXED_TESTS=true` to `.env.example` to prevent this issue

## How to Apply the Fix

1. **Update your environment file**:
   ```bash
   # Add this to your .env file
   USE_FIXED_TESTS=true
   ```

2. **Restart your application**:
   ```bash
   pnpm dev
   # or
   pnpm start
   ```

3. **Test the connection**:
   - Go to Settings → Integrations → Prowlarr
   - Click "Test Connection"
   - It should now work correctly

## What Was Wrong?
The proxy was detecting "original test mode" because the `USE_FIXED_TESTS` environment variable wasn't set. In this mode, it was looking for an `endpoint` parameter instead of `path`, causing the API calls to fail.

## Verification
You can verify the fix is working by:
1. Checking the browser console - no more `path: undefined` errors
2. The Prowlarr indexers should load correctly
3. Test connection should succeed

The implementation itself was correct all along - it was just a parameter naming issue in the proxy.
