# Node Build

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Node Build

---
# Standard Node.js Production Build Guide

This document describes the standard Node.js production build process for the Mugiwara-Kaizoku application.

## Overview

The standard Node.js build process:

1. Creates a simplified but fully functional Express server
2. Copies all static assets to the server distribution
3. Implements basic API endpoints for health checks and status
4. Provides a clean user interface for system status
5. Includes database connectivity testing

## Key Features

- **No Webpack Issues** - Bypasses all webpack and Next.js build issues
- **Full Database Support** - Connects to the same database as the full application
- **API Endpoints** - Provides basic API functionality for testing
- **Enhanced UI** - Includes a responsive interface with system status
- **No Native Module Issues** - Avoids problematic native dependencies

## How It Works

The build script (`scripts/node-build.sh`) creates a simplified Node.js server:

1. **File Structure** - Creates a clean dist directory with server and public assets
2. **Server Implementation** - Provides a complete Express server with API endpoints
3. **Database Connectivity** - Includes Prisma client for database access
4. **Error Handling** - Implements proper error handling and graceful shutdowns
5. **Status UI** - Provides a clean UI with real-time status checks

## Usage

### Building the Application

```bash
# Using npm script (default)
npm run build

# Direct script execution
./scripts/node-build.sh
```

### Starting the Application

```bash
# Using npm script (default)
npm run start

# Direct script execution
./scripts/start-node.sh

# Without Docker
npm run start -- --no-docker

# Skip database setup
npm run start -- --skip-db
```

## API Endpoints

The standard Node.js build includes these API endpoints:

- `/api/health` - Simple health check endpoint
- `/api/version` - Version information
- `/api/db-test` - Database connectivity test

## Troubleshooting

If you encounter issues with the Node.js build:

1. Check that Prisma client is properly generated
2. Ensure proper database credentials in your .env file
3. Verify network connectivity for database access
4. Check for Node.js compatibility (requires v20+)

## Notes

- The Node.js build is compatible with all environments
- It provides a reliable fallback when Next.js builds fail
- Database migrations are still run during server startup
- The server includes proper graceful shutdown handling