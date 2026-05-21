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
| `DATABASE_URL` | The PostgreSQL connection string | `postgresql://postgres:kaizoku@localhost:5432/kaizoku` | Used by Prisma ORM and application |
| `NEXTAUTH_URL` | The base URL of your application | `http://localhost:3000` | Used by NextAuth for callbacks - must match how you access the site in browser |
| `NEXTAUTH_SECRET` | Secret key for encrypting tokens | `this-is-a-local-secret-key-change-in-production` | **Required in production** |
| `JWT_EXPIRES_IN` | JWT token expiration time in seconds | `2592000` (30 days) | Configures token lifetime |
| `NEXTAUTH_SESSION_STRATEGY` | Session handling method | `jwt` | Options: `jwt` or `database` |
| `NEXTAUTH_SESSION_MAX_AGE` | Session maximum age in seconds | `2592000` (30 days) | Controls how long sessions last |

See [Authentication Troubleshooting Guide](./auth-troubleshooting.md) for more details on resolving auth-related issues.

## Automatic Configuration

The application includes several scripts to help manage environment variables:

- `scripts/check-env.sh` - Automatically checks and sets required environment variables
- `scripts/reset-database.sh` - Resets the database and updates environment variables
- `scripts/kaizoku.sh` - Runs the check-env script before starting the application

## Manual Configuration

To manually configure environment variables, create or edit a `.env` file at the root of the project with the following content:

```
# Application settings
KAIZOKU_PORT=3000
NODE_ENV=development

# Database settings
DATABASE_URL="postgresql://postgres:kaizoku@localhost:5432/kaizoku"

# NextAuth settings
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=this-is-a-local-secret-key-change-in-production
JWT_EXPIRES_IN=2592000
NEXTAUTH_SESSION_STRATEGY=jwt
NEXTAUTH_SESSION_MAX_AGE=2592000
# For network access from other devices, uncomment and update with your IP address:
# NEXTAUTH_URL=http://192.168.X.X:3000

# Optional: Suwayomi integration status
DISABLE_SUWAYOMI=true  # Set to false if you have Java 11+ installed
```

## Troubleshooting

If you encounter the error `Required environment variable KAIZOKU_PORT is not set`, it means your `.env` file is missing the KAIZOKU_PORT variable. You can fix this by:

1. Running the check-env script: `./scripts/check-env.sh`
2. Manually adding the variable to your `.env` file: `KAIZOKU_PORT=3000`
3. Using the kaizoku.sh script to start the application: `./scripts/kaizoku.sh dev`

## Advanced Configuration

For production deployments, you may want to customize the following:

- `KAIZOKU_PORT` - Change to a different port if 3000 is in use
- `DATABASE_URL` - Update to point to your production database
- `NODE_ENV` - Set to `production` for optimized builds

For Docker deployments, ensure that the port mapping in docker-compose.yml matches your KAIZOKU_PORT setting.