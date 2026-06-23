# Prowlarr Integration

This document explains how the Prowlarr integration works in Kaizoku and provides guidance for development and troubleshooting.

## Introduction

[Prowlarr](https://github.com/Prowlarr/Prowlarr) is an indexer manager/proxy that integrates with various applications. Kaizoku uses Prowlarr to enhance manga searching by providing access to additional sources and indexers.

## Architecture

The Prowlarr integration follows a standardized API-based approach:

1. **Client-Side Components**: The context, hooks, and UI components that interact with Prowlarr
2. **API Endpoint**: A single, centralized endpoint for all Prowlarr communication
3. **Utility Functions**: Shared utilities for both client and server-side Prowlarr communication

### Key Files

- `src/utils/prowlarrApi.ts`: Central utility functions for Prowlarr communication
- `src/pages/api/prowlarr.ts`: API endpoint for proxying requests to Prowlarr
- `src/components/settings/indexers/hooks/useProwlarrConfig.ts`: Hook for managing Prowlarr configuration state
- `src/components/settings/indexers/hooks/useProwlarrIndexers.ts`: Hook for fetching Prowlarr indexers
- `src/server/services/prowlarr/`: Server-side Prowlarr service modules

## Configuration

To configure Prowlarr integration:

1. **Environment Variables** (for development or Docker):
   ```
   PROWLARR_URL=http://your-prowlarr-instance:9696
   PROWLARR_API_KEY=your-api-key
   ```

2. **User Interface**:
   - Navigate to Settings → Integrations → Prowlarr
   - Enter your Prowlarr URL and API key
   - Click "Test Connection" to verify the configuration
   - Save the settings

## Development Notes

### Making API Calls to Prowlarr

#### Client-Side

```typescript
import { createProwlarrClient } from '@/utils/prowlarrApi';

// Create a client instance
const prowlarrClient = createProwlarrClient({
  baseURL: 'http://localhost:9696',
  apiKey: 'your-api-key',
});

// Use the client to make requests
await prowlarrClient.search('One Piece');
await prowlarrClient.getIndexers();
await prowlarrClient.testConnection();
```

#### Using the Prowlarr Hooks

```typescript
import { useProwlarrConfig } from '@/components/settings/indexers/hooks/useProwlarrConfig';
import { useProwlarrIndexers } from '@/components/settings/indexers/hooks/useProwlarrIndexers';

function YourComponent() {
  const config = useProwlarrConfig();
  const { indexersState, fetchIndexers } = useProwlarrIndexers();
  const { indexers, isLoading, error } = indexersState;
  
  // Use config and indexers in your component
  return (
    // Your component JSX
  );
}
```

#### Server-Side

```typescript
import { prowlarrClientRequest } from '@/utils/prowlarrApi';

// Make a request to Prowlarr via the proxy endpoint
const results = await prowlarrClientRequest(config, {
  path: '/search',
  method: 'POST',
  body: {
    query: 'One Piece',
  },
});
```

## Error Handling

The Prowlarr integration includes robust error handling:

- **Automatic Retries**: Failed requests are automatically retried with exponential backoff
- **Timeout Handling**: Requests have configurable timeouts to prevent hanging
- **Detailed Error Messages**: Errors include detailed information to aid debugging
- **Connection Monitoring**: The connection status is monitored with automatic reconnection attempts

## Troubleshooting

### Common Issues

1. **Connection Failures**:
   - Verify the Prowlarr URL is correct and accessible
   - Check that the API key is valid and has the necessary permissions
   - Ensure there are no network restrictions preventing communication

2. **Authentication Issues**:
   - Confirm the API key is set correctly
   - Check Prowlarr logs for authentication failures

3. **Timeouts**:
   - Increase the timeout value for slow connections
   - Check if Prowlarr is under heavy load

### Debugging Tools

- **Browser DevTools**: Check the Network tab to see the API requests and responses
- **Prowlarr Logs**: Check Prowlarr logs for API errors
- **Kaizoku Logs**: Check the console output for detailed error messages

## Extending the Integration

To add new Prowlarr functionality:

1. Add new methods to the client creation function in `src/utils/prowlarrApi.ts`
2. Add or update hooks in `src/components/settings/indexers/hooks/` to expose the new functionality
3. Add UI components to utilize the new features

## Resources

- [Prowlarr API Documentation](https://prowlarr.com/docs/api/)
- [Prowlarr GitHub Repository](https://github.com/Prowlarr/Prowlarr)
