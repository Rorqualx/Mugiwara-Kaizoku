# Authentication Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Authentication Guide

---
# Authentication System Guide

This document provides a comprehensive overview of Kaizoku's authentication system.

## Overview

Kaizoku uses Auth.js (next-auth v5) for authentication with a JWT-based session strategy. The system supports:

- Username/email and password authentication
- Role-based access control (ADMIN and USER roles)
- Protected routes via middleware and component-level HOCs
- Persistent sessions using JWT tokens

## Configuration

The authentication system is configured in a centralized location following Auth.js v5 patterns:

- **Config File**: `/auth.config.ts` - Contains static Auth.js configuration
- **Main Auth File**: `/auth.ts` - Initializes Auth.js with adapter and exports auth functions
- **API Endpoint**: `src/pages/api/auth/[...nextauth].ts` - Handles all Auth.js requests
- **Type Extensions**: `src/types/auth-types.d.ts` - Extends Auth.js types

## Key Components

1. **Auth Configuration** (`/auth.config.ts`)
   - Contains static Auth.js configuration
   - Sets up credentials provider for username/email login
   - Defines callback functions for JWT and session customization

2. **Auth Main File** (`/auth.ts`)
   - Initializes Auth.js with the PrismaAdapter
   - Configures JWT session strategy
   - Exports Auth.js functions like `auth`, `signIn`, and `signOut`

3. **Authentication Middleware** (`src/middleware.ts`)
   - Uses the Auth.js `auth()` function for route protection
   - Implements role-based access control for admin routes
   - Uses pattern matching to specify which routes to protect

4. **User Context** (`src/contexts/UserContext.tsx`)
   - Provides global user state management
   - Maps Auth.js session to application user format
   - Offers utilities like `isAuthenticated`, `isAdmin`, and `isLoading`

5. **Higher-Order Components** (`src/components/auth/withAuth.tsx`)
   - `withAuth` - Protects routes requiring authentication
   - `withAdmin` - Protects routes requiring admin role
   - Handles loading states and redirects for unauthenticated users

## Authentication Flow

1. **Login**:
   - User submits credentials to `/api/auth/login` or uses the `signIn()` function
   - Credentials are verified against database
   - JWT token is created with user data and role
   - Session is established

2. **Session Management**:
   - Sessions are managed through JWT tokens
   - Token includes user ID, role, and other essential data
   - Sessions expire after 30 days by default
   - Session data can be accessed via the `auth()` function or `useSession()` hook

3. **Route Protection**:
   - Protected routes are specified in middleware config
   - Authentication status is checked via Auth.js `auth()` function
   - Admin routes check for ADMIN role in user session
   - Unauthenticated users are redirected to login page

4. **Logout**:
   - User signs out via `/api/auth/signout` or uses the `signOut()` function
   - JWT token is invalidated
   - Session is destroyed

## Environment Configuration

The authentication system requires the following environment variables:

```
# Required
AUTH_SECRET=your-secret-key   # Secret for JWT signing
AUTH_URL=http://localhost:3000  # Base URL for callbacks

# Optional (for backward compatibility)
NEXTAUTH_SECRET=your-secret-key  # Same as AUTH_SECRET
NEXTAUTH_URL=http://localhost:3000  # Same as AUTH_URL
AUTH_TRUST_HOST=true  # For proxy environments
```

Note: Auth.js v5 uses the `AUTH_` prefix for environment variables instead of `NEXTAUTH_` but supports both for backward compatibility.

## Development Setup

To set up authentication for development:

1. Add the required environment variables to your `.env` file
2. Start the application with `pnpm dev`
3. Create an admin user with `pnpm create-admin`

## Testing Authentication

You can test the authentication system with:

```bash
# Test Auth.js migration
pnpm test:auth-js

# Legacy test script (for backward compatibility)
pnpm test:auth
```

These scripts:
- Test user registration
- Test login functionality
- Test protected route access
- Test role-based access control
- Test logout functionality
- Test Auth.js session handling

## Extending the System

To add new authentication features:

1. **New Provider**: Add new provider to `src/lib/auth/config.ts`
2. **Custom Claims**: Extend JWT payload in `callbacks.jwt` function
3. **New Permissions**: Add role checks to middleware for new protected routes

## Troubleshooting

Common issues:

1. **Invalid JWT Token**: Check that AUTH_SECRET is consistent across environments
2. **Session Not Persisting**: Ensure cookies are being properly set and stored
3. **Redirect Loop**: Check middleware configuration for conflicting route patterns
4. **Role-Based Issues**: Verify user role is being properly set in JWT token

## Future Plans

The authentication system is designed to be easily migrated to Auth.js (the successor to NextAuth.js) in the future. The configuration structure follows Auth.js conventions to make this transition smoother when Auth.js becomes more stable and compatible with the codebase.