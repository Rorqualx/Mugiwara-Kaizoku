# Express Implementation Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Express Implementation Guide

---
# Express Implementation Guide

This document explains the Express.js implementation of the Mugiwara Kaizoku application, which provides a standard Node.js alternative to the Next.js-based implementation.

## Overview

The Express.js implementation provides a simplified, lightweight alternative to the Next.js-based implementation. It serves the application as a static single-page application (SPA) with client-side routing, while also providing the necessary API endpoints for functionality.

Key components:
- Express.js server for static file serving and API endpoints
- Single-page application with client-side routing
- Prisma integration for database connectivity
- Mock API endpoints for testing without a database

## Directory Structure

```
/dist/
  /public/            # Static assets and client-side application
    index.html        # Main SPA entry point
    *.js, *.css       # Static assets
  server.js           # Express.js server implementation
```

## Server Implementation

The Express.js server (`server.js`) provides:

1. Static file serving from the `dist/public` directory
2. API endpoints for:
   - Authentication (`/api/auth/login`)
   - Health checks (`/api/health`)
   - Version information (`/api/version`)
   - Database testing (`/api/db-test`)
   - System information (`/api/system/info`)
   - Manga data (`/api/manga`)
3. Fallback routing to serve `index.html` for client-side routing
4. Error handling middleware

## Client Implementation

The client-side application (`dist/public/index.html`) provides:

1. A single-page application with client-side routing
2. Components matching the original application structure:
   - Header with logo, search, and system menu
   - Navbar with collapsible sections for navigation
   - Action bar with library management, view options, and alphabet navigation
   - Main content area with manga grid
   - Login page with authentication form

## Build and Start Scripts

The following scripts are available for building and running the Express implementation:

### Build Scripts

- `npm run build:client` - Copies static assets to the `dist/public` directory
- `npm run build:express` - Copies the Express server to the `dist` directory
- `npm run build:standalone` - Builds both client and server for standalone deployment

### Start Scripts

- `npm start` - Starts the Express server with production settings
- `npm run start:debug` - Starts the server in debug mode
- `npm run start:no-docker` - Starts without Docker database initialization
- `npm run start:skip-db` - Starts without any database initialization

## Authentication

The Express implementation includes a simple mock authentication system:

- Login with username `admin` and password `password`
- Authentication state is stored in localStorage
- Protected routes require authentication

## Database Integration

The Express server connects to a PostgreSQL database using Prisma:

- Database connection is established via Prisma client
- Database tests and statistics are available via the `/api/db-test` endpoint
- Database initialization can be skipped with the `--skip-db` flag

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Returns system health information |
| `/api/version` | GET | Returns version information |
| `/api/db-test` | GET | Tests database connectivity and returns stats |
| `/api/system/info` | GET | Returns detailed system information |
| `/api/auth/login` | POST | Authenticates a user and returns a token |
| `/api/manga` | GET | Returns a list of manga entries |

## Deployment

To deploy the Express implementation:

1. Build the application:
   ```
   npm run build:standalone
   ```

2. Start the server:
   ```
   cd dist
   node server.js
   ```

For production deployment, consider:
- Using a process manager like PM2
- Setting up proper environment variables
- Configuring a reverse proxy like Nginx
- Setting up SSL/TLS for secure connections

## Extending the Implementation

To extend the Express implementation:

1. **Add new API endpoints** in `server.js`:
   ```javascript
   app.get('/api/new-endpoint', (req, res) => {
     // Implementation
     res.json({ data: 'response data' });
   });
   ```

2. **Add new client-side features** in `dist/public/index.html`:
   - Add new HTML components
   - Add new JavaScript functions
   - Add new CSS styles

3. **Add authentication middleware** for protected routes:
   ```javascript
   const authMiddleware = (req, res, next) => {
     const token = req.headers.authorization?.split(' ')[1];
     if (!token) {
       return res.status(401).json({ error: 'Unauthorized' });
     }
     // Validate token
     next();
   };
   
   app.get('/api/protected', authMiddleware, (req, res) => {
     // Protected endpoint implementation
   });
   ```

## Troubleshooting

Common issues and solutions:

- **Database connection errors**: Ensure PostgreSQL is running and the connection details are correct in `.env`
- **Static file serving issues**: Check that files are correctly copied to `dist/public`
- **API endpoint errors**: Check the server console for error logs and fix the corresponding endpoint
- **Client-side routing issues**: Ensure the server is correctly serving `index.html` for all unknown routes