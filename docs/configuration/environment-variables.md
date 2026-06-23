# Environment Variables

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Environment Variables

---
# Environment Variables Guide

This document describes the required environment variables for the Mugiwara-Kaizoku application.

## Network Configuration

By default, the server will now listen on all network interfaces (0.0.0.0) so it can be accessed from other devices on the network. This means you can access the application using:

1. Local access: `http://localhost:3000`
2. Network access: `http://YOUR_IP_ADDRESS:3000` (where YOUR_IP_ADDRESS is your computer's IP address on the network)

You can use `ifconfig` (macOS/Linux) or `ipconfig` (Windows) to find your IP address.

### Important Note on NextAuth URL

For NextAuth to work correctly with cookies and JWT:

- Use `NEXTAUTH_URL=http://localhost:3000` for local development
- When accessing from other devices on the network, you need to update the NEXTAUTH_URL to match how you're accessing the site:
  - Example: `NEXTAUTH_URL=http://your.host.local:3000`

**Do not use 0.0.0.0 in NEXTAUTH_URL** as it causes JWT decryption errors. Always use either:
- `localhost` for local-only access
- Your machine's actual IP address for network access

## Required Environment Variables

The following environment variables are required for the application to function properly:

| Variable | Description | Default Value | Notes |
|----------|-------------|---------------|-------|
| `KAIZOKU_PORT` | The port on which the application server will run | `3000` | Used by Next.js server and health checks |
| `NODE_ENV` | The environment mode (development/production) | `development` | Affects build process and runtime behavior |
| `DATABASE_URL` | The PostgreSQL connection string | `postgresql://kaizoku:kaizoku@localhost:5432/kaizoku` | Used by Prisma ORM and application |
| `NEXTAUTH_URL` | The base URL of your application | `http://localhost:3000` | Used by NextAuth for callbacks - must match how you access the site in browser |
| `NEXTAUTH_SECRET` | Secret key for encrypting tokens | _(none)_ | **Required in production.** No default; generate with `openssl rand -base64 32`. Placeholder values are rejected in production. |
| `AUTH_SECRET` | Secondary auth secret | _(none)_ | Generated/managed alongside `NEXTAUTH_SECRET` |

> The validated env schema lives in `src/env/server.ts`; see `.env.example` for the full annotated list. (`JWT_EXPIRES_IN`, `NEXTAUTH_SESSION_STRATEGY`, and `NEXTAUTH_SESSION_MAX_AGE` are **not** used by this project.)

## Manual Configuration

To manually configure environment variables, create or edit a `.env` file at the root of the project with the following content:

```
# Application settings
KAIZOKU_PORT=3000
NODE_ENV=development

# Database settings
DATABASE_URL="postgresql://kaizoku:kaizoku@localhost:5432/kaizoku"

# NextAuth settings
NEXTAUTH_URL=http://localhost:3000
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=
AUTH_SECRET=
# For network access from other devices, uncomment and update with your IP address:
# NEXTAUTH_URL=http://192.168.X.X:3000
```

## Troubleshooting

If you encounter the error `Required environment variable KAIZOKU_PORT is not set`, it means your `.env` file is missing the KAIZOKU_PORT variable. Add it to your `.env`: `KAIZOKU_PORT=3000` (anything not set falls back to the defaults validated in `src/env/server.ts`).

## Advanced Configuration

For production deployments, you may want to customize the following:

- `KAIZOKU_PORT` - Change to a different port if 3000 is in use
- `DATABASE_URL` - Update to point to your production database
- `NODE_ENV` - Set to `production` for optimized builds

For Docker deployments, ensure that the port mapping in docker-compose.yml matches your KAIZOKU_PORT setting.