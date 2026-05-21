# API Proxy Implementation

This directory contains proxy middleware implementations for external API services used by the application. These proxies solve CORS (Cross-Origin Resource Sharing) issues that occur when the browser tries to make direct API requests to external services.

## Why We Need This

CORS restrictions prevent browsers from making direct API requests to servers that:
1. Don't explicitly allow the domain of our application
2. Don't include the necessary CORS headers in their responses

Services like Transmission, Prowlarr, and other download clients often don't have CORS support by default, causing network errors when trying to use their APIs directly from browser code.

## How It Works

1. Instead of making API requests directly from the browser to the external service, our front-end code makes requests to our own Next.js API routes
2. These routes act as proxies, forwarding the requests to the actual services from the server side
3. Since server-side requests aren't subject to CORS restrictions, the communication works without issues
4. Responses are then passed back to the client

## Proxy Endpoints

This directory contains proxy endpoints that facilitate communication between the frontend and various external services, handling authentication, CORS, and session management.

## Available Proxy Endpoints

### Download Clients

#### Transmission (`/api/proxy/transmission`)
Proxies requests to Transmission BitTorrent client's RPC API.

**Request Body:**
```json
{
  "baseURL": "http://localhost:9091",
  "apiKey": "username:password",
  "method": "session-get",
  "arguments": {}
}
```

#### Deluge (`/api/proxy/deluge`)
Proxies requests to Deluge's JSON-RPC API with session management.

**Request Body:**
```json
{
  "baseURL": "http://localhost:8112",
  "password": "deluge",
  "method": "auth.login",
  "params": ["password"],
  "id": 1
}
```

#### NZBGet (`/api/proxy/nzbget`)
Proxies requests to NZBGet's JSON-RPC API.

**Request Body:**
```json
{
  "baseURL": "http://localhost:6789",
  "username": "nzbget",
  "password": "tegbzn6789",
  "method": "status",
  "params": []
}
```

#### SABnzbd (`/api/proxy/sabnzbd`)
Proxies requests to SABnzbd's API.

**Request Body (POST):**
```json
{
  "baseURL": "http://localhost:8080",
  "apiKey": "your-api-key",
  "params": {
    "mode": "version"
  }
}
```

**Query Parameters (GET):**
```
/api/proxy/sabnzbd?baseURL=http://localhost:8080&apiKey=your-api-key&mode=version
```

#### Generic Download Client (`/api/proxy/download-client`)
Legacy generic proxy for download clients. Uses query parameters to specify the client type.

**Query Parameters:**
- `type`: Client type (transmission, deluge, sabnzbd, nzbget, prowlarr)
- `endpoint`: API endpoint path

### Indexers

#### Prowlarr (`/api/proxy/prowlarr`)
Proxies requests to Prowlarr indexer aggregator.

## Common Features

### Authentication
- Basic authentication for Transmission and NZBGet
- Session cookies for Deluge
- API keys for SABnzbd and Prowlarr

### Error Handling
All proxy endpoints return standardized error responses:

```json
{
  "error": "Error type",
  "details": "Detailed error message"
}
```

### Session Management
- Transmission: Handles X-Transmission-Session-Id header
- Deluge: Manages session cookies automatically

### CORS
All proxy endpoints handle CORS issues by making server-side requests to the external services.

## Security Notes

1. These endpoints should only be accessible to authenticated users
2. Credentials are retrieved from the database settings, not stored in code
3. All requests are logged for debugging purposes
4. Sensitive information is sanitized in error messages

- `transmission.ts`: Proxy for Transmission torrent client API
- `prowlarr.ts`: Proxy for Prowlarr indexer API
- `download-client.ts`: Generic proxy for all download clients

## How to Use

Replace direct API client implementations with proxy-aware versions:

```typescript
// Instead of this:
const api = new ProwlarrApi(baseURL, apiKey);

// Use this:
const api = new ProwlarrApiProxy(baseURL, apiKey);
```

The proxy clients maintain the same interface but route requests through our server-side proxies.

## Security Considerations

- All proxy endpoints validate user authentication using NextAuth sessions
- API keys are not exposed to the client
- The proxies only load configuration values from the database, never from client-supplied parameters
