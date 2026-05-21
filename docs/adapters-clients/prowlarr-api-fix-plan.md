# Prowlarr Api Fix Plan

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Prowlarr Api Fix Plan

---
# Prowlarr API Implementation Fix Plan

## Issue Summary
The Prowlarr `/settings/indexers` endpoint doesn't exist in the Prowlarr API. The correct endpoint is `/api/v1/indexer`.

## Correct Prowlarr API Endpoints

Based on official documentation and Prowlarr source code:

### Core Endpoints
- `GET /api/v1/indexer` - Get all indexers
- `GET /api/v1/indexer/{id}` - Get specific indexer
- `POST /api/v1/indexer` - Add new indexer
- `PUT /api/v1/indexer/{id}` - Update indexer
- `DELETE /api/v1/indexer/{id}` - Delete indexer
- `POST /api/v1/indexer/test` - Test indexer configuration

### Status Endpoints
- `GET /api/v1/system/status` - System status
- `GET /api/v1/indexerstatus` - Get status of all indexers (often returns empty array)

### Search Endpoints
- `GET /api/v1/search` - Search across indexers

## Current Implementation Status

✅ **Correctly Implemented:**
- `src/api/prowlarrClient.ts` - Uses correct endpoints
- `src/utils/prowlarrApi.ts` - Properly formats API paths
- `src/pages/api/prowlarr.ts` - Proxy correctly adds `/api/v1` prefix
- `src/components/settings/prowlarr/ProwlarrIndexerList.tsx` - Calls correct methods

## Troubleshooting Steps

### 1. Test Script
Run the test script to verify Prowlarr connectivity:
```bash
# Set your Prowlarr details
export PROWLARR_URL="http://localhost:9696"
export PROWLARR_API_KEY="your-api-key-here"

# Run the test
node scripts/test-prowlarr-api.js
```

### 2. Common Issues and Solutions

#### Issue: 404 Not Found
**Cause:** Incorrect endpoint or URL
**Solution:** 
- Verify Prowlarr URL doesn't have trailing slash
- Ensure API key is correct
- Check Prowlarr is running

#### Issue: 401 Unauthorized
**Cause:** Invalid API key
**Solution:**
1. Get API key from Prowlarr: Settings → General → API Key
2. Update in Mugiwara-Kaizoku settings

#### Issue: Connection Refused
**Cause:** Prowlarr not running or network issue
**Solution:**
1. Verify Prowlarr is running
2. Check firewall/network settings
3. Test with curl: `curl -H "X-Api-Key: YOUR_KEY" http://localhost:9696/api/v1/system/status`

## Implementation Verification

### 1. Check Client Implementation
The `prowlarrClient.ts` correctly implements:
```typescript
// Correct implementation
async getIndexers(): Promise<ProwlarrIndexer[]> {
  return this.makeRequest<ProwlarrIndexer[]>({
    method: 'GET',
    endpoint: 'indexer'  // Becomes /api/v1/indexer
  });
}
```

### 2. Check Proxy Implementation
The proxy correctly formats URLs:
```typescript
// Correct URL construction
const apiPath = pathStr.startsWith('/') ? pathStr : `/${pathStr}`;
const url = `${normalizedUrl}/api/v1${apiPath}`;
```

### 3. UI Component Usage
Components correctly use the client:
```typescript
// Correct usage
const data = await client.getIndexers();
```

## No Code Changes Required

The current implementation is **correct**. If experiencing issues:

1. **Verify Prowlarr Configuration:**
   - URL: Should be like `http://localhost:9696` (no trailing slash)
   - API Key: Copy from Prowlarr Settings → General → API Key

2. **Check Prowlarr Status:**
   - Is Prowlarr running?
   - Can you access Prowlarr UI in browser?
   - Are there any indexers configured in Prowlarr?

3. **Test Connection:**
   - Use the Settings → Integrations → Prowlarr → Test Connection button
   - Check browser console for detailed errors
   - Check Prowlarr logs for API errors

## Debug Information

To debug connection issues:

1. **Browser Console:**
   - Open DevTools (F12)
   - Go to Network tab
   - Try to load indexers
   - Check for failed requests to `/api/prowlarr`

2. **Prowlarr Logs:**
   - In Prowlarr: System → Logs → Files
   - Look for API authentication errors

3. **Manual API Test:**
   ```bash
   # Test Prowlarr directly
   curl -H "X-Api-Key: YOUR_API_KEY" \
        http://localhost:9696/api/v1/indexer
   ```

## Summary

The Mugiwara-Kaizoku Prowlarr implementation is correct and uses the proper API endpoints. The `/settings/indexers` endpoint doesn't exist in Prowlarr's API. If you're experiencing issues, they are likely due to:

1. Configuration issues (wrong URL or API key)
2. Prowlarr not running or accessible
3. Network/firewall blocking connections
4. No indexers configured in Prowlarr

Use the test script and troubleshooting steps above to identify and resolve the issue.
