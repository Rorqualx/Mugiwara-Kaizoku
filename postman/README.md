# Kaizoku API - Postman Collection

This directory contains Postman collection and environment files for testing the Kaizoku third-party API.

## Files

- `kaizoku-api.postman_collection.json` - Main collection with all API endpoints
- `kaizoku-api.postman_environment.json` - Development environment variables

## Setup

1. **Import Collection**
   - Open Postman
   - Click "Import" button
   - Select `kaizoku-api.postman_collection.json`

2. **Import Environment**
   - Click the gear icon in the top right
   - Click "Import"
   - Select `kaizoku-api.postman_environment.json`

3. **Configure Environment**
   - Select "Kaizoku API - Development" from the environment dropdown
   - Click the eye icon to view/edit variables
   - Set your `api_key` value

## Authentication

All requests use API key authentication via the `X-API-Key` header. The collection is configured to automatically include this header using the `{{api_key}}` environment variable.

## Collection Structure

### System
- Health Check - Verify API is running
- Get OpenAPI Spec - Download API specification

### Authentication
- Generate API Key - Create new API keys (requires existing auth)

### Manga
- List Manga - Get paginated list with filters
- Create Manga - Add new manga to library
- Get Manga Details - Retrieve specific manga info
- Update Manga - Modify manga properties
- Delete Manga - Remove manga from system
- Refresh Metadata - Update metadata from providers

### Libraries
- List Libraries - Get all libraries
- Create Library - Add new library
- Trigger Library Scan - Scan for new content

### Chapters
- List Chapters - Get chapters with filters
- Download Chapter - Queue chapter download

### Downloads
- List Downloads - View download queue
- Update Download - Pause/resume/cancel downloads
- Get Download Stats - Overall download statistics

### Search
- Advanced Search - Complex search with facets
- Search Suggestions - Auto-complete suggestions

### Metadata
- Search Metadata - Search across providers
- List Providers - Available metadata sources

### Batch Operations
- Execute Batch - Run multiple operations at once

### Webhooks
- List Webhooks - View configured webhooks
- Create Webhook - Set up new webhook
- Test Webhook - Send test event

### Metrics
- API Metrics - Usage statistics
- System Metrics - System health data
- User Activity - User behavior metrics

### Server-Sent Events
- Connect to SSE Stream - Real-time event stream

## Testing Features

### Pre-request Scripts
- Generates request timestamps
- Creates unique request IDs

### Test Scripts
- Validates response times
- Checks for required headers
- Monitors rate limits
- Verifies error formats

## Usage Tips

1. **Rate Limiting**
   - Monitor the console for rate limit information
   - Headers show remaining requests and reset times

2. **Batch Operations**
   - Use for bulk operations
   - Reference previous operation results with `${operationId.field}`

3. **Server-Sent Events**
   - SSE endpoint requires special client (not standard Postman)
   - Use browser EventSource or dedicated SSE client

4. **Dynamic Variables**
   - Some IDs are set dynamically from responses
   - Run requests in order for dependent operations

## Examples

### Create and Download Manga
1. Create Library (if needed)
2. Create Manga
3. Get Manga Details (note chapter IDs)
4. Download Chapter
5. Check Download Stats

### Setup Webhooks
1. Create Webhook (save the secret!)
2. Test Webhook
3. Monitor webhook deliveries

### Search Workflow
1. Get Search Suggestions
2. Perform Advanced Search
3. View faceted results

## Troubleshooting

- **401 Unauthorized**: Check your API key
- **429 Too Many Requests**: Rate limit exceeded, wait for reset
- **404 Not Found**: Verify resource IDs in environment
- **500 Internal Error**: Check server logs

## Export/Share

To share your configured collection:
1. Right-click the collection
2. Select "Export"
3. Choose "Collection v2.1"
4. Include environment variables (excluding secrets)