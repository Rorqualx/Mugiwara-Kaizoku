# Prowlarr Api Flow Diagram

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Prowlarr Api Flow Diagram

---
# Prowlarr API Flow Diagram

## Current (Correct) Implementation Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   UI Component  │────▶│  prowlarrClient  │────▶│  /api/prowlarr  │
│                 │     │                  │     │   (proxy)       │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                           │
                                                           ▼
                                                  ┌────────────────┐
                                                  │   Prowlarr     │
                                                  │   Instance     │
                                                  └────────────────┘
```

## API Endpoint Mapping

```
UI Request              →  Client Method        →  Actual API Call
─────────────────────────────────────────────────────────────────────
Get Indexers           →  getIndexers()        →  GET /api/v1/indexer
Get Specific Indexer   →  getIndexer(id)       →  GET /api/v1/indexer/{id}
Add Indexer            →  addIndexer(data)     →  POST /api/v1/indexer
Update Indexer         →  updateIndexer(data)  →  PUT /api/v1/indexer/{id}
Delete Indexer         →  deleteIndexer(id)    →  DELETE /api/v1/indexer/{id}
Test Connection        →  testConnection()     →  GET /api/v1/system/status
```

## ❌ Invalid Endpoint (Does Not Exist)
```
/settings/indexers  →  404 Not Found
```

This endpoint is not part of Prowlarr's API specification.

## Example: Getting Indexers

### 1. UI Component Request
```typescript
// ProwlarrIndexerList.tsx
const client = createProwlarrClient(config);
const indexers = await client.getIndexers();
```

### 2. Client Formats Request
```typescript
// prowlarrClient.ts
async getIndexers() {
  return this.makeRequest({
    method: 'GET',
    endpoint: 'indexer'  // Note: no /api/v1 prefix here
  });
}
```

### 3. Proxy Adds API Prefix
```typescript
// pages/api/prowlarr.ts
const apiPath = '/indexer';
const url = `${PROWLARR_URL}/api/v1${apiPath}`;
// Result: http://localhost:9696/api/v1/indexer
```

### 4. Prowlarr Responds
```json
[
  {
    "id": 1,
    "name": "Example Indexer",
    "protocol": "torrent",
    "enabled": true,
    ...
  }
]
```

## Common Configuration

### Environment Variables
```bash
PROWLARR_URL=http://localhost:9696    # No trailing slash!
PROWLARR_API_KEY=your-api-key-here
```

### UI Settings
- Base URL: `http://localhost:9696` (no `/api/v1`, no trailing slash)
- API Key: From Prowlarr Settings → General → API Key

### Docker Networking
```yaml
services:
  prowlarr:
    container_name: prowlarr
    ports:
      - "9696:9696"
  
  kaizoku:
    environment:
      - PROWLARR_URL=http://prowlarr:9696  # Use container name
```
