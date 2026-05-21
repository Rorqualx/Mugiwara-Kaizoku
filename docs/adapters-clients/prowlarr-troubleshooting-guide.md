# Prowlarr Troubleshooting Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Prowlarr Troubleshooting Guide

---
# Prowlarr Integration Guide & Troubleshooting

## Quick Summary

**The Prowlarr implementation in Mugiwara-Kaizoku is correct and uses the proper API endpoints.**

If you're experiencing issues with Prowlarr indexers, the problem is NOT with the code but likely with:
- Configuration (URL, API key)
- Connectivity (network, firewall)
- Prowlarr setup (no indexers configured)

## Correct API Endpoints

Prowlarr uses these endpoints (all prefixed with `/api/v1`):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/indexer` | GET | Get all indexers |
| `/api/v1/indexer/{id}` | GET | Get specific indexer |
| `/api/v1/indexer` | POST | Add new indexer |
| `/api/v1/indexer/{id}` | PUT | Update indexer |
| `/api/v1/indexer/{id}` | DELETE | Delete indexer |
| `/api/v1/system/status` | GET | System status |

**Note:** There is NO `/settings/indexers` endpoint in Prowlarr's API.

## Testing Your Prowlarr Connection

### Option 1: Use the Test Script

```bash
# Set your Prowlarr details
export PROWLARR_URL="http://localhost:9696"
export PROWLARR_API_KEY="your-api-key-here"

# Run the test
node scripts/test-prowlarr-api.js
```

This will test all endpoints and show you exactly what's working or failing.

### Option 2: Manual curl Test

```bash
# Replace with your actual URL and API key
curl -H "X-Api-Key: YOUR_API_KEY" http://localhost:9696/api/v1/indexer
```

### Option 3: Browser Test

1. Open: `http://localhost:9696/api/v1/indexer?apikey=YOUR_API_KEY`
2. You should see JSON data or an error message

## Common Issues & Solutions

### 1. "404 Not Found" Error

**Causes:**
- Wrong Prowlarr URL
- URL has trailing slash (remove it)
- Prowlarr not running

**Fix:**
```javascript
// ❌ Wrong
baseURL: "http://localhost:9696/"  // trailing slash
baseURL: "http://localhost:9696/prowlarr"  // extra path

// ✅ Correct
baseURL: "http://localhost:9696"
```

### 2. "401 Unauthorized" Error

**Cause:** Invalid API key

**Fix:**
1. Go to Prowlarr UI
2. Settings → General → API Key
3. Copy the key
4. Update in Mugiwara-Kaizoku settings

### 3. "Connection Refused" Error

**Causes:**
- Prowlarr not running
- Wrong port
- Firewall blocking

**Fix:**
1. Start Prowlarr
2. Check port (default: 9696)
3. Check firewall rules

### 4. Empty Indexer List

**Cause:** No indexers configured in Prowlarr

**Fix:**
1. Open Prowlarr UI
2. Click "Indexers"
3. Add at least one indexer
4. Test the indexer in Prowlarr first

### 5. "path: undefined" Error

**Cause:** API proxy detecting "original test mode" incorrectly

**Symptoms:**
```
Path parameter check: {
  path: undefined,
  usingOriginalTests: true,
  ...
}
```

**Fix:**
1. Add to your `.env` file:
   ```bash
   USE_FIXED_TESTS=true
   ```
2. Restart the application
3. This prevents the proxy from entering "original test mode"

## Configuration in Mugiwara-Kaizoku

### 1. Via UI
1. Go to Settings → Integrations → Prowlarr
2. Enter:
   - Base URL: `http://localhost:9696` (no trailing slash)
   - API Key: (from Prowlarr settings)
3. Click "Test Connection"
4. Save

### 2. Via Environment Variables
```bash
PROWLARR_URL=http://localhost:9696
PROWLARR_API_KEY=your-api-key-here
```

## Debugging Steps

### 1. Check Browser Console
1. Open DevTools (F12)
2. Go to Network tab
3. Try to access Prowlarr features
4. Look for failed requests
5. Check response details

### 2. Check Prowlarr Logs
1. In Prowlarr: System → Logs → Files
2. Look for authentication errors
3. Check for API access attempts

### 3. Verify Implementation Files
All these files are correctly implemented:
- ✅ `src/api/prowlarrClient.ts`
- ✅ `src/utils/prowlarrApi.ts`
- ✅ `src/pages/api/prowlarr.ts`
- ✅ `src/components/settings/prowlarr/*.tsx`

## Docker Considerations

If using Docker:
```yaml
# docker-compose.yml
services:
  prowlarr:
    image: linuxserver/prowlarr:latest
    ports:
      - "9696:9696"
    # ...

  kaizoku:
    environment:
      - PROWLARR_URL=http://prowlarr:9696  # Use service name
      - PROWLARR_API_KEY=your-key
    # ...
```

## Still Having Issues?

1. **Run the test script** to diagnose the exact problem
2. **Check Prowlarr is accessible** in your browser
3. **Verify no proxy/VPN** is interfering
4. **Check Docker logs** if using containers
5. **Ensure indexers exist** in Prowlarr

The code implementation is correct. Focus on configuration and connectivity troubleshooting.
