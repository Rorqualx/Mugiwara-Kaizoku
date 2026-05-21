#!/bin/bash

# Script to remove legacy NZBGet code and clean up the codebase

echo "🧹 Cleaning up legacy NZBGet code..."

# Remove archived legacy files
echo "Removing archived legacy files..."
rm -f archive/nzbget.old.ts
rm -f archive/nzbgetClient.old.ts

# Remove test-direct endpoint (was for debugging only)
echo "Removing temporary test endpoints..."
rm -f src/pages/api/download-clients/nzbget/test-direct.ts

# Remove diagnostic and temporary files
echo "Removing diagnostic files..."
rm -f NZBGET_CONNECTION_FIX_SUMMARY.md
rm -f NZBGET_AUTH_ISSUE.md
rm -f NZBGET_IMPLEMENTATION_FIX_SUMMARY.md
rm -f NZBGET_FINAL_STATUS.md

# Remove any .fixed or .old files related to nzbget
echo "Checking for any .fixed or .old files..."
find . -name "*nzbget*.fixed.*" -type f -delete 2>/dev/null
find . -name "*nzbget*.old.*" -type f -delete 2>/dev/null

# Archive documentation to docs/archive
echo "Archiving documentation..."
mkdir -p docs/archive/nzbget-legacy
mv -f docs/nzbget-client-asyncresult-pattern.md docs/archive/nzbget-legacy/ 2>/dev/null || true
mv -f docs/nzbget-connection-test-fix.md docs/archive/nzbget-legacy/ 2>/dev/null || true
mv -f docs/nzbgetClient-fixes.md docs/archive/nzbget-legacy/ 2>/dev/null || true
mv -f docs/nzbget-connection-fix.md docs/archive/nzbget-legacy/ 2>/dev/null || true

# Create final consolidated documentation
cat > docs/nzbget-client-implementation.md << 'EOF'
# NZBGet Client Implementation

## Overview
The NZBGet client provides integration with NZBGet usenet download manager through its JSON-RPC API.

## Location
- Main implementation: `/src/api/downloadClients/nzbgetClient.ts`
- Configuration hook: `/src/hooks/useNZBGetConfig.ts`
- Proxy endpoint: `/src/pages/api/proxy/nzbget.ts`
- Test endpoint: `/src/pages/api/download-clients/nzbget/test.ts`

## Features
- Full JSON-RPC API support
- Authentication with username/password
- Download management (add, pause, resume, remove)
- Status tracking
- Error handling with clear messages

## Configuration
The client requires:
- `baseURL`: NZBGet server URL (default: http://localhost:6789)
- `username`: NZBGet username
- `password`: NZBGet password
- `category`: Optional category for downloads (default: manga)

## Common Issues

### Authentication Failed (401 Unauthorized)
This is the most common issue. To resolve:
1. Check your NZBGet configuration file for the correct credentials
2. Default credentials are often: username `nzbget`, password `tegbzn6789`
3. Verify credentials work by accessing the NZBGet web interface

### Connection Refused
Ensure NZBGet is running and accessible on the specified port.

## API Methods
- `append`: Add download by URL (not `appendurl`)
- `listgroups`: Get active downloads
- `history`: Get completed downloads
- `editqueue`: Manage downloads (pause, resume, delete)
- `status`: Get server status

## Implementation Details
- Uses correct JSON-RPC method names per official API
- Parameters must be in exact order (positional parameters)
- Handles authentication via HTTP Basic Auth
- Proper error detection for auth failures (401 responses)
EOF

echo "✅ Legacy NZBGet code cleanup complete!"
echo ""
echo "Remaining files:"
echo "- src/api/downloadClients/nzbgetClient.ts (main implementation)"
echo "- src/hooks/useNZBGetConfig.ts (configuration hook)"
echo "- src/pages/api/proxy/nzbget.ts (proxy endpoint)"
echo "- src/pages/api/download-clients/nzbget/test.ts (test endpoint)"
echo "- docs/nzbget-client-implementation.md (documentation)"
echo ""
echo "Archived documentation in: docs/archive/nzbget-legacy/"
